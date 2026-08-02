import Combine
import Foundation

enum CompletionSubscriptionPresentationState: String, Sendable {
    case off
    case subscribed
    case watching
    case muted
    case unavailable
    case failed

    var label: String {
        switch self {
        case .off: "Off"
        case .subscribed: "Subscribed"
        case .watching: "Watching"
        case .muted: "Muted"
        case .unavailable: "Unavailable"
        case .failed: "Needs attention"
        }
    }
}

/// Independent completion mode. It has no reference to the listening phase,
/// active lane, microphone, or interactive Codex submission state.
@MainActor
final class CompletionSubscriptionController: ObservableObject {
    static let shared = CompletionSubscriptionController()

    @Published private(set) var subscription: CompletionSubscription?
    @Published private(set) var channel: CompletionChannelConfiguration
    @Published private(set) var activities: [CompletionActivity]
    @Published private(set) var observerState: CompletionSubscriptionPresentationState = .off
    @Published private(set) var lastError: String?
    @Published private(set) var isFeatureEnabled: Bool

    private let store: CompletionSubscriptionStore
    private let observer: CodexCompletionObserver
    private let presenter: any CompletionPresenting
    private let narrator = ConfiguredResponseNarrator()
    private var playbackObservations: Set<AnyCancellable> = []
    private var processingTail: Task<Void, Never>?
    private var started = false

    init(
        store: CompletionSubscriptionStore = CompletionSubscriptionStore(),
        observer: CodexCompletionObserver? = nil,
        presenter: (any CompletionPresenting)? = nil,
        featureEnabled: Bool? = nil
    ) {
        self.store = store
        self.observer = observer ?? CodexCompletionObserver()
        self.presenter = presenter ?? CodexLunaCompletionPresenter()
        self.isFeatureEnabled = featureEnabled ?? ConfigManager.shared.observerPresenterEnabled
        do {
            let snapshot = try store.load()
            subscription = snapshot.subscription
            channel = snapshot.channel
            activities = snapshot.activities
            observerState = isFeatureEnabled && subscription?.isEnabled == true ? .subscribed : .off
        } catch {
            subscription = nil
            channel = .init()
            activities = []
            observerState = .failed
            lastError = error.localizedDescription
        }
        observePlayback()
    }

    var state: CompletionSubscriptionPresentationState { observerState }

    var queueCount: Int {
        activities.filter { $0.state == .queued || $0.state == .playing }.count
    }

    var mostRecentActivity: CompletionActivity? { activities.last }

    func start() {
        guard !started else { return }
        started = true
        guard isFeatureEnabled else {
            observerState = .off
            return
        }
        guard subscription?.isEnabled == true else { return }
        startObservation()
        recoverPendingActivities()
    }

    func stop() {
        observer.stop()
        started = false
        processingTail?.cancel()
        processingTail = nil
        if subscription?.isEnabled == true { observerState = .subscribed }
    }

    func isSubscribed(to taskID: String) -> Bool {
        subscription?.task.id == taskID
    }

    func subscribe(to task: ListeningTaskLock) {
        guard isFeatureEnabled else { return }
        observer.stop()
        subscription = CompletionSubscription(task: task)
        observerState = .subscribed
        lastError = nil
        persist()
        guard started else { return }
        startObservation()
        recoverPendingActivities()
    }

    func setEnabled(_ enabled: Bool) {
        guard isFeatureEnabled || !enabled else { return }
        guard var subscription else { return }
        subscription.isEnabled = enabled
        self.subscription = subscription
        persist()
        if enabled {
            guard started else { return }
            startObservation()
            recoverPendingActivities()
        } else {
            observer.stop()
            observerState = .off
        }
    }

    func unsubscribe() {
        observer.stop()
        subscription = nil
        observerState = .off
        lastError = nil
        persist()
    }

    func setMuted(_ muted: Bool) {
        channel.isMuted = muted
        if muted {
            for activity in activities where activity.state == .queued {
                PlaybackEngine.shared.removeQueuedCompletion(activityID: activity.id)
                updateActivity(activity.id) { $0.state = .muted }
            }
        }
        persist()
        guard subscription?.isEnabled == true else { return }
        observerState = muted ? .muted : (observer.isRunning ? .watching : .subscribed)
    }

    func setProvider(_ provider: String?) {
        channel.provider = provider?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        persist()
    }

    func setVoice(_ voice: String?) {
        channel.voice = voice?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        persist()
    }

    func setNarrationCue(_ cue: String?) {
        channel.narrationCue = cue?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        persist()
    }

    func setPlaybackRate(_ rate: Float) {
        channel.playbackRate = min(max(rate.isFinite ? rate : 1, 0.5), 2)
        persist()
    }

    func setVolume(_ volume: Double) {
        channel.volume = min(max(volume.isFinite ? volume : 0.7, 0), 1)
        persist()
    }

    func dismiss(_ activityID: UUID) {
        guard let index = activities.firstIndex(where: { $0.id == activityID }) else { return }
        if PlaybackEngine.shared.currentItem?.completionActivityID == activityID {
            PlaybackEngine.shared.stop()
        } else {
            PlaybackEngine.shared.removeQueuedCompletion(activityID: activityID)
        }
        activities[index].state = .dismissed
        activities[index].failure = nil
        persist()
    }

    /// Manual replay is an explicit user action and is allowed while the
    /// channel is muted. It changes only the speech projection, never Codex.
    func replay(_ activityID: UUID) {
        guard let activity = activities.first(where: { $0.id == activityID }) else { return }
        enqueueForReplay(activity)
    }

    private func startObservation() {
        guard isFeatureEnabled, let subscription, subscription.isEnabled else {
            observerState = .off
            return
        }
        observer.stop()
        do {
            try observer.start(
                taskID: subscription.task.id,
                cursorOffset: subscription.cursorOffset,
                rolloutIdentity: subscription.rolloutIdentity,
                onState: { [weak self] state, error in
                    guard let self else { return }
                    switch state {
                    case .watching:
                        self.observerState = self.channel.isMuted ? .muted : .watching
                    case .unavailable:
                        self.observerState = .unavailable
                    case .failed:
                        self.observerState = .failed
                    case .subscribed:
                        self.observerState = .subscribed
                    }
                    if let error {
                        self.lastError = error
                        self.persist()
                    }
                },
                onMessage: { [weak self] message in
                    self?.handle(message)
                }
            )
        } catch {
            if let bridgeError = error as? CodexCompletionBridgeError,
               bridgeError == .runtimeUnavailable || bridgeError == .bridgeUnavailable {
                observerState = .unavailable
            } else {
                observerState = .failed
            }
            lastError = error.localizedDescription
            persist()
        }
    }

    private func handle(_ message: CodexCompletionBridgeMessage) {
        guard let subscription else { return }
        switch message {
        case .baseline(let taskID, let cursorOffset, let rolloutIdentity):
            guard taskID == subscription.task.id else {
                failClosed(CodexCompletionBridgeError.taskMismatch)
                return
            }
            var next = subscription
            next.cursorOffset = max(cursorOffset, 0)
            next.rolloutIdentity = rolloutIdentity
            self.subscription = next
            persist()
        case .cursor(let taskID, let turnID, let cursorOffset):
            guard taskID == subscription.task.id else {
                failClosed(CodexCompletionBridgeError.taskMismatch)
                return
            }
            var next = subscription
            next.lastObservedTurnID = turnID
            next.cursorOffset = max(cursorOffset, next.cursorOffset ?? 0)
            self.subscription = next
            persist()
        case .completion(let event):
            guard event.taskID == subscription.task.id else {
                failClosed(CodexCompletionBridgeError.taskMismatch)
                return
            }
            if let rolloutIdentity = subscription.rolloutIdentity,
               rolloutIdentity != event.provenance.rolloutIdentity {
                failClosed(CodexCompletionBridgeError.invalidProvenance)
                return
            }
            let previous = processingTail
            processingTail = Task { @MainActor [weak self] in
                await previous?.value
                guard let self, !Task.isCancelled else { return }
                await self.process(event)
            }
        }
    }

    private func process(_ event: CodexCompletionEvent) async {
        guard isFeatureEnabled,
              var subscription,
              subscription.isEnabled,
              event.taskID == subscription.task.id
        else { return }

        let key = subscription.dedupeKey(turnID: event.turnID)
        if subscription.enqueuedTurnIDs.contains(key) {
            if let index = activities.firstIndex(where: { $0.dedupeKey == key }) {
                activities[index].deduplicatedCount += 1
                activities[index].state = .deduplicated
            }
            subscription.cursorOffset = max(event.cursorOffset, subscription.cursorOffset ?? 0)
            subscription.lastObservedTurnID = event.turnID
            self.subscription = subscription
            persist()
            return
        }

        let activityID: UUID
        if let existing = activities.first(where: { $0.dedupeKey == key }) {
            activityID = existing.id
        } else {
            let activity = CompletionActivity(
                taskID: event.taskID,
                turnID: event.turnID,
                response: event.response,
                completedAt: event.completedAt,
                state: .detected,
                provider: channel.provider,
                cursorOffset: event.cursorOffset
            )
            activities.append(activity)
            activityID = activity.id
        }
        subscription.cursorOffset = max(event.cursorOffset, subscription.cursorOffset ?? 0)
        subscription.lastObservedTurnID = event.turnID
        self.subscription = subscription
        persist() // detection and cursor survive a crash before TTS finishes

        if channel.isMuted {
            updateActivity(activityID) { $0.state = .muted }
            persist()
            return
        }
        await synthesizeAndEnqueue(activityID: activityID, markDurable: true)
    }

    private func recoverPendingActivities() {
        guard isFeatureEnabled, subscription?.isEnabled == true else { return }
        for activity in activities {
            switch activity.state {
            case .detected:
                guard !channel.isMuted else {
                    updateActivity(activity.id) { $0.state = .muted }
                    continue
                }
                enqueueActivityTask(activity.id, markDurable: true)
            case .queued, .playing:
                enqueueActivityTask(activity.id, markDurable: false)
            default:
                break
            }
        }
        persist()
    }

    private func enqueueActivityTask(_ activityID: UUID, markDurable: Bool) {
        let previous = processingTail
        processingTail = Task { @MainActor [weak self] in
            await previous?.value
            guard let self, !Task.isCancelled else { return }
            await self.synthesizeAndEnqueue(activityID: activityID, markDurable: markDurable)
        }
    }

    private func enqueueForReplay(_ activity: CompletionActivity) {
        let previous = processingTail
        processingTail = Task { @MainActor [weak self] in
            await previous?.value
            guard let self, !Task.isCancelled else { return }
            if let audioPath = activity.audioPath,
               FileManager.default.fileExists(atPath: audioPath) {
                self.enqueuePrepared(activityID: activity.id, audioPath: audioPath, markDurable: false)
            } else {
                await self.synthesizeAndEnqueue(activityID: activity.id, markDurable: false)
            }
        }
    }

    private func synthesizeAndEnqueue(activityID: UUID, markDurable: Bool) async {
        guard isFeatureEnabled,
              let activity = activities.first(where: { $0.id == activityID }),
              !activity.response.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return }
        if let audioPath = activity.audioPath,
           FileManager.default.fileExists(atPath: audioPath) {
            enqueuePrepared(activityID: activityID, audioPath: audioPath, markDurable: markDurable)
            return
        }

        do {
            let spokenText: String
            if let existing = activity.spokenText?
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !existing.isEmpty {
                spokenText = existing
            } else {
                guard let task = subscription?.task, task.id == activity.taskID else { return }
                let presentation = await presenter.present(CompletionPresentationRequest(
                    taskID: activity.taskID,
                    turnID: activity.turnID,
                    taskTitle: task.title,
                    projectPath: task.cwd,
                    response: activity.response
                ))
                guard subscription?.task.id == activity.taskID,
                      activities.contains(where: { $0.id == activityID && $0.turnID == activity.turnID })
                else { return }
                spokenText = presentation.spokenText
                updateActivity(activityID) {
                    $0.spokenText = presentation.spokenText
                    $0.presentationSource = presentation.source
                    $0.presentationModel = presentation.model
                    $0.presentationFailure = presentation.fallbackReason
                }
                persist()
            }
            let narration = channelNarrationConfiguration()
            let audioURL = try await narrator.render(text: spokenText, configuration: narration)
            guard subscription?.task.id == activity.taskID else {
                try? FileManager.default.removeItem(at: audioURL)
                return
            }
            updateActivity(activityID) {
                $0.audioPath = audioURL.path
                $0.provider = narration.provider
            }
            enqueuePrepared(activityID: activityID, audioPath: audioURL.path, markDurable: markDurable)
        } catch {
            updateActivity(activityID) {
                $0.state = .failed
                $0.failure = error.localizedDescription
            }
            lastError = error.localizedDescription
            persist()
        }
    }

    private func enqueuePrepared(activityID: UUID, audioPath: String, markDurable: Bool) {
        guard let index = activities.firstIndex(where: { $0.id == activityID }),
              FileManager.default.fileExists(atPath: audioPath)
        else { return }
        let activity = activities[index]
        let spokenText = activity.spokenText ?? CompletionSpeechProjector.project(activity.response)
        let narration = channelNarrationConfiguration()
        if markDurable, var subscription {
            let key = subscription.dedupeKey(turnID: activity.turnID)
            subscription.enqueuedTurnIDs.insert(key)
            subscription.lastEnqueuedTurnID = activity.turnID
            self.subscription = subscription
        }
        activities[index].state = .queued
        activities[index].failure = nil
        persist() // the exactly-once enqueue decision is durable before queue handoff

        let item = PlaybackItem(
            id: UUID(),
            audioPath: audioPath,
            title: subscription?.task.title ?? "Codex completion",
            text: spokenText,
            provider: narration.provider,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            synthesisRateWPM: narration.rate,
            sourceThreadId: activity.taskID,
            cleanupAfterPlayback: true,
            playbackRate: channel.playbackRate,
            channel: .completions,
            completionActivityID: activity.id
        )
        PlaybackEngine.shared.setVolume(Float(channel.volume))
        do {
            try PlaybackEngine.shared.enqueue(item, priority: .normal, interrupt: false, autoplay: true)
        } catch {
            updateActivity(activityID) {
                $0.state = .failed
                $0.failure = error.localizedDescription
            }
            lastError = error.localizedDescription
            persist()
        }
    }

    private func observePlayback() {
        PlaybackEngine.shared.$currentItem
            .receive(on: RunLoop.main)
            .sink { [weak self] item in
                guard let self, let activityID = item?.completionActivityID,
                      let index = self.activities.firstIndex(where: { $0.id == activityID })
                else { return }
                self.activities[index].state = .playing
                self.persist()
            }
            .store(in: &playbackObservations)

        PlaybackEngine.shared.$lastFinishedItemID
            .receive(on: RunLoop.main)
            .sink { [weak self] itemID in
                guard let self, let itemID,
                      let item = self.activities.first(where: { $0.id == itemID })
                else { return }
                self.updateActivity(item.id) {
                    $0.state = .announced
                    $0.failure = nil
                }
                self.persist()
            }
            .store(in: &playbackObservations)
    }

    private func channelNarrationConfiguration() -> SpeechNarrationConfiguration {
        let base = SpeechNarrationConfiguration.configured(from: ConfigManager.shared, provider: channel.provider)
        let voice = channel.voice ?? base.voice
        let instructions = [base.instructions, channel.narrationCue]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty }
            .joined(separator: "\n\n")
            .nilIfEmpty
        return SpeechNarrationConfiguration(
            provider: base.provider,
            voice: voice,
            model: base.model,
            apiKey: base.apiKey,
            instructions: instructions,
            rate: base.rate
        )
    }

    private func updateActivity(_ activityID: UUID, _ update: (inout CompletionActivity) -> Void) {
        guard let index = activities.firstIndex(where: { $0.id == activityID }) else { return }
        update(&activities[index])
    }

    private func failClosed(_ error: Error) {
        observer.stop()
        observerState = .failed
        lastError = error.localizedDescription
        persist()
    }

    private func persist() {
        do {
            try store.save(CompletionSubscriptionSnapshot(
                subscription: subscription,
                channel: channel,
                activities: activities
            ))
        } catch {
            lastError = error.localizedDescription
            observerState = .failed
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
