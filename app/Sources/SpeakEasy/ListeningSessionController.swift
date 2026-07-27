import AppKit
import Combine
import Foundation
import VoxCore

enum ListeningPhase: String, Sendable {
    case unlocked
    case validatingLock
    case cueing
    case ready
    case warmingUp
    case recording
    case transcribing
    case submitting
    case preparingSpeech
    case speaking
    case failed

    var label: String {
        switch self {
        case .unlocked: "Choose a task"
        case .validatingLock: "Checking task"
        case .cueing: "Confirming"
        case .ready: "Ready"
        case .warmingUp: "Opening microphone"
        case .recording: "Listening"
        case .transcribing: "Transcribing"
        case .submitting: "Waiting for Codex"
        case .preparingSpeech: "Preparing narration"
        case .speaking: "Speaking"
        case .failed: "Needs attention"
        }
    }

    var acceptsHotkey: Bool {
        self == .ready || self == .failed || self == .recording || self == .speaking
    }
}

struct ListeningTaskLock: Codable, Equatable, Sendable {
    let id: String
    let title: String
    let cwd: String
}

struct ListeningTurnContext: Equatable, Sendable {
    let lock: ListeningTaskLock
    let laneNumber: Int?
    let narration: SpeechNarrationConfiguration
    let playbackVolume: Double
}

struct ListeningInputPreference: Codable, Equatable, Sendable {
    let id: String
    let name: String

    func isAvailable(in devices: [AudioInputDeviceInfo]) -> Bool {
        devices.contains { $0.id == id }
    }
}

enum CodexTaskLockPresentation: Equatable, Sendable {
    case background
    case revealInCodex

    var revealsCodex: Bool { self == .revealInCodex }
}

@MainActor
final class ListeningSessionController: ObservableObject {
    static let shared = ListeningSessionController()
    static let shortcutTitle = GlobalListeningShortcut.title
    static let laneRange = GlobalListeningShortcut.laneRange

    @Published private(set) var phase: ListeningPhase = .unlocked
    @Published private(set) var tasks: [CodexTaskSummary] = []
    @Published private(set) var isRefreshingTasks = false
    @Published var selectedTaskID = ""
    @Published private(set) var lockedTask: ListeningTaskLock?
    @Published private(set) var lanes: [VoiceLane] = []
    @Published private(set) var activeLaneNumber: Int?
    @Published private(set) var shortcutAvailable = false
    @Published private(set) var laneShortcutAvailability: [Int: Bool] = [:]
    @Published private(set) var confirmationShortcutAvailable = false
    @Published private(set) var inputDevices: [AudioInputDeviceInfo] = []
    @Published private(set) var inputPreference: ListeningInputPreference?
    @Published private(set) var inputDeviceName: String?
    @Published private(set) var lastTranscript = ""
    @Published private(set) var lastResponse = ""
    @Published private(set) var lastDelivery: CodexTurnDelivery?
    @Published private(set) var lastError: String?

    private let vox = VoxListeningService()
    private let router = CodexThreadRouter()
    private let narrator = ConfiguredResponseNarrator()
    private let laneCueStore = LaneCueStore()
    private let lockDefaultsKey = "speakeasy.listening.task-lock.v1"
    private let lanesDefaultsKey = "speakeasy.listening.voice-lanes.v1"
    private let activeLaneDefaultsKey = "speakeasy.listening.active-lane.v1"
    private let inputPreferenceDefaultsKey = "speakeasy.listening.input-device.v1"
    private var shortcut: GlobalListeningShortcut?
    private var maxRecordingTimer: Timer?
    private var playbackObservation: AnyCancellable?
    private var fixtureHasRun = false
    private var launchHotkeyHasRun = false
    private var launchLaneHasRun = false
    private var launchConfirmationHasRun = false
    private var restoredLockCandidate: ListeningTaskLock?
    private var pendingNarrationItemID: UUID?
    private var narrationDidStart = false
    private var validationID: UUID?
    private var recordingStartID: UUID?
    private var recordingContext: ListeningTurnContext?

    private init() {
        restoreState()
        playbackObservation = PlaybackEngine.shared.$state
            .receive(on: RunLoop.main)
            .sink { [weak self] state in
                guard let self, self.phase == .speaking else { return }
                if state == .playing,
                   PlaybackEngine.shared.currentItem?.id == self.pendingNarrationItemID {
                    self.narrationDidStart = true
                } else if state == .idle, self.narrationDidStart {
                    self.pendingNarrationItemID = nil
                    self.narrationDidStart = false
                    self.phase = self.lockedTask == nil ? .unlocked : .ready
                    self.diagnostic("voice loop playback completed")
                }
            }
    }

    func start() {
        diagnostic("starting listening controller")
        refreshInputDevices()
        if shortcut == nil {
            let shortcut = GlobalListeningShortcut { [weak self] action in
                self?.handleShortcut(action)
            }
            self.shortcut = shortcut
            shortcutAvailable = shortcut.registerCurrentLane()
            laneShortcutAvailability = shortcut.registerLanes()
            confirmationShortcutAvailable = shortcut.registerLaneConfirmation()
            diagnostic(shortcutAvailable
                ? "global shortcut \(Self.shortcutTitle) registered"
                : "global shortcut \(Self.shortcutTitle) unavailable")
            let registered = laneShortcutAvailability.filter(\.value).keys.sorted()
            diagnostic("lane shortcuts registered: \(registered.map(String.init).joined(separator: ","))")
            diagnostic(confirmationShortcutAvailable
                ? "lane confirmation shortcut \(GlobalListeningShortcut.confirmationTitle) registered"
                : "lane confirmation shortcut \(GlobalListeningShortcut.confirmationTitle) unavailable")
        }
        refreshTasks()
    }

    func stop() {
        maxRecordingTimer?.invalidate()
        maxRecordingTimer = nil
        recordingStartID = nil
        recordingContext = nil
        validationID = nil
        shortcut?.unregisterAll()
        shortcut = nil
        shortcutAvailable = false
        laneShortcutAvailability = [:]
        confirmationShortcutAvailable = false
        Task {
            await vox.cancelRecording()
            await router.shutdown()
        }
    }

    func refreshTasks() {
        guard !isRefreshingTasks else { return }
        isRefreshingTasks = true
        diagnostic("loading recent Codex tasks")
        Task {
            defer { isRefreshingTasks = false }
            do {
                let recent = try await router.listRecentTasks(limit: 50)
                diagnostic("loaded \(recent.count) recent Codex tasks")
                tasks = recent
                if !applyLaunchLockIfPresent(from: recent) {
                    revalidateRestoredLock(from: recent)
                }
                if selectedTaskID.isEmpty {
                    selectedTaskID = lockedTask?.id ?? recent.first?.id ?? ""
                }
                runLaunchFixtureIfPresent()
                runLaunchHotkeyTestIfPresent()
                runLaunchLaneTestIfPresent()
                runLaunchConfirmationTestIfPresent()
            } catch {
                recordFailure(error)
            }
        }
    }

    func lockSelectedTask() {
        guard let task = tasks.first(where: { $0.id == selectedTaskID }) else { return }
        lock(task)
    }

    func lock(_ task: CodexTaskSummary) {
        validateAndLock(
            taskID: task.id,
            expectedLane: nil,
            beginAfterLock: false,
            presentation: .revealInCodex
        )
    }

    func assignLockedTask(toLane number: Int) {
        guard Self.laneRange.contains(number), let lock = lockedTask else { return }
        assign(lock, toLane: number, makeActive: true)
    }

    func assign(_ task: CodexTaskSummary, toLane number: Int) {
        guard Self.laneRange.contains(number) else { return }
        assign(
            ListeningTaskLock(id: task.id, title: task.title, cwd: task.cwd),
            toLane: number,
            makeActive: false
        )
    }

    private func assign(_ lock: ListeningTaskLock, toLane number: Int, makeActive: Bool) {
        let previous = lane(number)
        if let previous {
            Task { await laneCueStore.removeCue(for: previous) }
        }
        let assignment = VoiceLane(
            number: number,
            task: lock,
            voiceOverride: previous?.voiceOverride,
            narrationCue: previous?.narrationCue
        )
        lanes.removeAll { $0.number == number }
        lanes.append(assignment)
        lanes.sort { $0.number < $1.number }
        if makeActive {
            activeLaneNumber = number
            UserDefaults.standard.set(number, forKey: activeLaneDefaultsKey)
        } else if activeLaneNumber == number, lockedTask?.id != lock.id {
            activeLaneNumber = nil
            UserDefaults.standard.removeObject(forKey: activeLaneDefaultsKey)
        }
        persistLanes()
        diagnostic("lane \(number) assigned to task \(lock.id)")
        prepareCue(for: assignment)
    }

    func removeLane(_ number: Int) {
        guard let assignment = lane(number) else { return }
        lanes.removeAll { $0.number == number }
        if activeLaneNumber == number {
            activeLaneNumber = nil
            UserDefaults.standard.removeObject(forKey: activeLaneDefaultsKey)
        }
        persistLanes()
        Task { await laneCueStore.removeCue(for: assignment) }
        diagnostic("lane \(number) removed")
    }

    func setVoiceOverride(provider: String, voiceID: String, forLane number: Int) {
        guard var assignment = lane(number) else { return }
        let voiceOverride = LaneVoiceOverride(provider: provider, voiceID: voiceID)
        guard assignment.voiceOverride != voiceOverride else { return }
        assignment.voiceOverride = voiceOverride
        lanes.removeAll { $0.number == number }
        lanes.append(assignment)
        lanes.sort { $0.number < $1.number }
        persistLanes()
        if let voiceOverride {
            diagnostic("lane \(number) voice set for \(voiceOverride.provider)")
        } else {
            diagnostic("lane \(number) voice reset to the global provider default")
        }
        prepareCue(for: assignment)
    }

    func setNarrationCue(_ cue: String, forLane number: Int) {
        guard var assignment = lane(number) else { return }
        let narrationCue = VoiceLane.normalizedNarrationCue(cue)
        guard assignment.narrationCue != narrationCue else { return }
        assignment.narrationCue = narrationCue
        lanes.removeAll { $0.number == number }
        lanes.append(assignment)
        lanes.sort { $0.number < $1.number }
        persistLanes()
        diagnostic(narrationCue == nil
            ? "lane \(number) narration cue cleared"
            : "lane \(number) narration cue updated")
        prepareCue(for: assignment)
    }

    func activateLane(_ number: Int, beginListening: Bool = false) {
        guard let assignment = lane(number) else {
            lastError = "Lane \(number) is not assigned yet. Lock a task, then assign it from SpeakEasy."
            if lockedTask != nil { phase = .failed }
            NSSound.beep()
            return
        }
        guard !isRoutingTurn else {
            lastError = "Finish the current voice turn before switching lanes."
            NSSound.beep()
            return
        }
        guard ![.validatingLock, .cueing, .warmingUp].contains(phase) else {
            NSSound.beep()
            return
        }
        if phase == .recording {
            if activeLaneNumber == number { finishRecording() }
            else {
                lastError = "Finish or cancel this utterance before switching lanes."
                NSSound.beep()
            }
            return
        }
        if phase == .speaking { PlaybackEngine.shared.stop() }
        activeLaneNumber = number
        UserDefaults.standard.set(number, forKey: activeLaneDefaultsKey)
        // Keep the destination visible in the HUD while its exact Desktop
        // ownership is revalidated. No recording or submission is permitted
        // during this phase.
        lockedTask = assignment.task
        validateAndLock(
            taskID: assignment.task.id,
            expectedLane: number,
            beginAfterLock: beginListening,
            presentation: .background
        )
    }

    func unlock() {
        guard phase != .recording else {
            cancelRecording()
            return
        }
        guard !isRoutingTurn, phase != .cueing, phase != .warmingUp else { return }
        if phase == .speaking { PlaybackEngine.shared.stop() }
        validationID = nil
        lockedTask = nil
        activeLaneNumber = nil
        UserDefaults.standard.removeObject(forKey: activeLaneDefaultsKey)
        phase = .unlocked
        lastError = nil
        UserDefaults.standard.removeObject(forKey: lockDefaultsKey)
    }

    func toggleListening() {
        switch phase {
        case .recording:
            finishRecording()
        case .ready, .failed:
            beginRecording()
        case .speaking:
            PlaybackEngine.shared.stop()
            beginRecording()
        default:
            NSSound.beep()
        }
    }

    func confirmActiveLane() {
        announceActiveLane()
    }

    func cancelRecording() {
        guard phase == .recording || phase == .warmingUp else { return }
        maxRecordingTimer?.invalidate()
        maxRecordingTimer = nil
        recordingStartID = nil
        recordingContext = nil
        Task {
            await vox.cancelRecording()
            phase = lockedTask == nil ? .unlocked : .ready
            diagnostic("recording cancelled")
        }
    }

    func lane(_ number: Int) -> VoiceLane? {
        lanes.first { $0.number == number }
    }

    func laneShortcutAvailable(_ number: Int) -> Bool {
        laneShortcutAvailability[number] == true
    }

    var selectedInputDeviceLabel: String {
        if let inputPreference {
            return inputPreference.isAvailable(in: inputDevices)
                ? inputPreference.name
                : "\(inputPreference.name) · unavailable"
        }
        return AudioInputDevices.effectiveLabel(preferredID: nil)
    }

    var selectedInputDeviceShortLabel: String {
        if let inputPreference { return inputPreference.name }
        return inputDevices.first(where: \.isSystemDefault)?.name ?? "System Default"
    }

    var selectedInputIsAvailable: Bool {
        guard let inputPreference else { return !inputDevices.isEmpty }
        return inputPreference.isAvailable(in: inputDevices)
    }

    func refreshInputDevices() {
        inputDevices = AudioInputDevices.available()
        diagnostic("found \(inputDevices.count) microphone inputs")
    }

    func selectSystemDefaultInput() {
        guard canChangeInputDevice else { return }
        inputPreference = nil
        UserDefaults.standard.removeObject(forKey: inputPreferenceDefaultsKey)
        refreshInputDevices()
        diagnostic("microphone follows the system default")
    }

    func selectInputDevice(_ device: AudioInputDeviceInfo) {
        guard canChangeInputDevice else { return }
        let preference = ListeningInputPreference(id: device.id, name: device.name)
        inputPreference = preference
        if let data = try? JSONEncoder().encode(preference) {
            UserDefaults.standard.set(data, forKey: inputPreferenceDefaultsKey)
        }
        refreshInputDevices()
        diagnostic("dedicated microphone set to \(device.name)")
    }

    #if DEBUG
    func installLaneSnapshotFixture() {
        let task = ListeningTaskLock(
            id: "019f99a4-7867-7c23-ac29-0c0eca7da603",
            title: "Prototype SpeakEasy listening mode",
            cwd: "/Users/arach/dev/SpeakEasy"
        )
        let secondTask = ListeningTaskLock(
            id: "019f9573-3e55-7701-8968-09c12d4fafe5",
            title: "Polish the Scout relay",
            cwd: "/Users/arach/dev/openscout"
        )
        tasks = [
            CodexTaskSummary(
                id: task.id,
                title: task.title,
                preview: "Make voice lanes fast and dependable",
                cwd: task.cwd,
                updatedAt: Date()
            ),
            CodexTaskSummary(
                id: secondTask.id,
                title: secondTask.title,
                preview: "Route work across local agents",
                cwd: secondTask.cwd,
                updatedAt: Date().addingTimeInterval(-90)
            ),
            CodexTaskSummary(
                id: "019fa197-2f03-7b50-973e-064e01f167e8",
                title: "Add lane mapping search",
                preview: "Make the task lock delightful",
                cwd: "/Users/arach/dev/SpeakEasy",
                updatedAt: Date().addingTimeInterval(-180)
            ),
            CodexTaskSummary(
                id: "019f8a79-20ad-7f88-9b69-29337de2fb15",
                title: "Review the Hudson shell",
                preview: "Tighten the native navigation chrome",
                cwd: "/Users/arach/dev/hudson",
                updatedAt: Date().addingTimeInterval(-270)
            )
        ]
        lockedTask = task
        lanes = [VoiceLane(number: 2, task: task), VoiceLane(number: 5, task: secondTask)]
        activeLaneNumber = 2
        shortcutAvailable = true
        laneShortcutAvailability = Dictionary(
            uniqueKeysWithValues: Self.laneRange.map { ($0, $0 != 4) }
        )
        confirmationShortcutAvailable = true
        inputDevices = [
            AudioInputDeviceInfo(id: "studio-mic", name: "Studio USB Mic", isSystemDefault: false),
            AudioInputDeviceInfo(id: "system-mic", name: "MacBook Air Mic", isSystemDefault: true)
        ]
        inputPreference = ListeningInputPreference(id: "studio-mic", name: "Studio USB Mic")
        phase = .ready
    }
    #endif

    private var isRoutingTurn: Bool {
        [.transcribing, .submitting, .preparingSpeech].contains(phase)
    }

    private var canChangeInputDevice: Bool {
        ![.warmingUp, .recording, .transcribing, .submitting, .preparingSpeech].contains(phase)
    }

    private func handleShortcut(_ action: ListeningShortcutAction) {
        switch action {
        case .toggleCurrentLane:
            toggleListening()
        case .selectLane(let number):
            activateLane(number, beginListening: true)
        case .announceActiveLane:
            announceActiveLane()
        }
    }

    private func validateAndLock(
        taskID: String,
        expectedLane: Int?,
        beginAfterLock: Bool,
        presentation: CodexTaskLockPresentation
    ) {
        if lockedTask?.id != taskID {
            lockedTask = nil
            UserDefaults.standard.removeObject(forKey: lockDefaultsKey)
        }
        selectedTaskID = taskID
        phase = .validatingLock
        lastError = nil
        if presentation.revealsCodex {
            openCodexTask(taskID)
        }
        let requestID = UUID()
        validationID = requestID
        Task {
            do {
                let validated = try await router.validateTask(taskID)
                guard validationID == requestID, selectedTaskID == taskID else { return }
                if let expectedLane,
                   lane(expectedLane)?.task.id != validated.id {
                    throw ListeningLoopError.laneAssignmentChanged
                }
                let lock = ListeningTaskLock(
                    id: validated.id,
                    title: validated.title,
                    cwd: validated.cwd
                )
                lockedTask = lock
                if let expectedLane {
                    activeLaneNumber = expectedLane
                    UserDefaults.standard.set(expectedLane, forKey: activeLaneDefaultsKey)
                    let refreshed = VoiceLane(
                        number: expectedLane,
                        task: lock,
                        voiceOverride: lane(expectedLane)?.voiceOverride,
                        narrationCue: lane(expectedLane)?.narrationCue
                    )
                    lanes.removeAll { $0.number == expectedLane }
                    lanes.append(refreshed)
                    lanes.sort { $0.number < $1.number }
                    persistLanes()
                }
                else {
                    activeLaneNumber = lanes.first(where: { $0.task.id == lock.id })?.number
                    if let activeLaneNumber {
                        UserDefaults.standard.set(activeLaneNumber, forKey: activeLaneDefaultsKey)
                    } else {
                        UserDefaults.standard.removeObject(forKey: activeLaneDefaultsKey)
                    }
                }
                persistLock(lock)
                phase = .ready
                diagnostic(presentation.revealsCodex
                    ? "locked to Desktop-owned Codex task \(taskID) and revealed it"
                    : "locked to Desktop-owned Codex task \(taskID) in the background")
                applyLaunchLaneAssignmentIfPresent()
                runLaunchFixtureIfPresent()
                runLaunchHotkeyTestIfPresent()
                runLaunchLaneTestIfPresent()
                runLaunchConfirmationTestIfPresent()
                if beginAfterLock {
                    beginRecording()
                }
            } catch {
                guard validationID == requestID else { return }
                recordFailure(error)
            }
        }
    }

    private func beginRecording() {
        guard let lock = lockedTask else {
            phase = .unlocked
            NSSound.beep()
            return
        }

        lastError = nil
        lastTranscript = ""
        lastResponse = ""
        lastDelivery = nil
        PlaybackEngine.shared.stop()
        let startID = UUID()
        recordingStartID = startID
        recordingContext = turnContext(for: lock)

        Task {
            guard recordingStartID == startID, lockedTask?.id == lock.id else { return }
            phase = .warmingUp
            do {
                // Vox starts capture before it warms the model. Natural speech
                // at hotkey-down is retained while recognition becomes ready.
                let device = try await vox.startRecordingAndWarm(
                    preferredInputDeviceID: inputPreference?.id,
                    preferredInputDeviceName: inputPreference?.name
                )
                guard recordingStartID == startID, lockedTask?.id == lock.id else {
                    await vox.cancelRecording()
                    return
                }
                inputDeviceName = device.name
                phase = .recording
                diagnostic("microphone active (\(device.name)); Vox warming concurrently")
                maxRecordingTimer?.invalidate()
                maxRecordingTimer = Timer.scheduledTimer(withTimeInterval: 120, repeats: false) { [weak self] _ in
                    Task { @MainActor in self?.finishRecording() }
                }
                if let rawDelay = ProcessInfo.processInfo.environment["SPEAKEASY_CANCEL_RECORDING_AFTER_SECONDS"],
                   let delay = TimeInterval(rawDelay), delay > 0 {
                    diagnostic("launch validation will cancel recording after \(delay) seconds")
                    Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
                        Task { @MainActor in self?.cancelRecording() }
                    }
                }
            } catch {
                guard recordingStartID == startID else { return }
                refreshInputDevices()
                recordFailure(error)
            }
        }
    }

    private func announceActiveLane() {
        guard phase == .ready || phase == .failed,
              let number = activeLaneNumber,
              let assignment = lane(number),
              lockedTask?.id == assignment.task.id
        else {
            NSSound.beep()
            return
        }

        let configuration = narrationConfiguration(
            from: ConfigManager.shared,
            lane: assignment
        )
        let volume = ConfigManager.shared.defaultVolume
        lastError = nil
        phase = .cueing
        Task {
            do {
                let cue: URL
                if let cached = await laneCueStore.cachedCue(
                    for: assignment,
                    configuration: configuration
                ) {
                    cue = cached
                } else {
                    cue = try await laneCueStore.prepare(
                        for: assignment,
                        configuration: configuration
                    )
                }
                guard activeLaneNumber == number, lockedTask?.id == assignment.task.id else { return }
                diagnostic("announcing active lane \(number) on demand")
                try await laneCueStore.play(cue, volume: volume)
                guard activeLaneNumber == number, lockedTask?.id == assignment.task.id else { return }
                phase = .ready
            } catch {
                recordFailure(error)
            }
        }
    }

    private func finishRecording() {
        guard phase == .recording, let context = recordingContext else { return }
        maxRecordingTimer?.invalidate()
        maxRecordingTimer = nil
        recordingStartID = nil
        recordingContext = nil
        phase = .transcribing
        Task {
            do {
                let result = try await vox.stopAndTranscribe()
                diagnostic("\(result.engine.rawValue) transcript selected")
                try await completeLoop(transcript: result.text, context: context)
            } catch {
                recordFailure(error)
            }
        }
    }

    private func completeLoop(transcript: String, context: ListeningTurnContext) async throws {
        let lock = context.lock
        let text = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw ListeningLoopError.emptyTranscript }
        guard lockedTask?.id == lock.id else { throw ListeningLoopError.taskLockChanged }

        lastTranscript = text
        phase = .submitting
        diagnostic("transcript ready (\(text.count) characters)")
        let result = try await router.submit(text, to: lock.id)
        guard lockedTask?.id == lock.id else { throw ListeningLoopError.taskLockChanged }

        lastResponse = result.response
        lastDelivery = result.delivery
        phase = .preparingSpeech
        let narration = context.narration
        let audioURL = try await narrator.render(text: result.response, configuration: narration)
        guard lockedTask?.id == lock.id else {
            try? FileManager.default.removeItem(at: audioURL)
            throw ListeningLoopError.taskLockChanged
        }

        let itemID = UUID()
        let item = PlaybackItem(
            id: itemID,
            audioPath: audioURL.path,
            title: lock.title,
            text: result.response,
            provider: narration.provider,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            synthesisRateWPM: narration.rate,
            sourceThreadId: lock.id,
            cleanupAfterPlayback: true
        )
        PlaybackEngine.shared.setVolume(Float(context.playbackVolume))
        pendingNarrationItemID = itemID
        narrationDidStart = false
        phase = .speaking
        try PlaybackEngine.shared.enqueue(item, priority: .high, interrupt: true, autoplay: true)
        diagnostic("\(result.delivery.rawValue) response queued with \(narration.provider)/\(narration.voice) narration from task \(lock.id)")
    }

    private func restoreState() {
        if let data = UserDefaults.standard.data(forKey: inputPreferenceDefaultsKey),
           let preference = try? JSONDecoder().decode(ListeningInputPreference.self, from: data) {
            inputPreference = preference
        }
        if let data = UserDefaults.standard.data(forKey: lanesDefaultsKey),
           let restored = try? JSONDecoder().decode([VoiceLane].self, from: data) {
            lanes = restored
                .filter { Self.laneRange.contains($0.number) }
                .sorted { $0.number < $1.number }
        }
        guard let data = UserDefaults.standard.data(forKey: lockDefaultsKey),
              let lock = try? JSONDecoder().decode(ListeningTaskLock.self, from: data)
        else { return }
        restoredLockCandidate = lock
        selectedTaskID = lock.id
        let persistedLane = UserDefaults.standard.object(forKey: activeLaneDefaultsKey) as? Int
        activeLaneNumber = persistedLane.flatMap { number in
            lanes.first(where: { $0.number == number && $0.task.id == lock.id })?.number
        } ?? lanes.first(where: { $0.task.id == lock.id })?.number
        phase = .validatingLock
    }

    private func persistLock(_ lock: ListeningTaskLock) {
        if let data = try? JSONEncoder().encode(lock) {
            UserDefaults.standard.set(data, forKey: lockDefaultsKey)
        }
    }

    private func persistLanes() {
        if let data = try? JSONEncoder().encode(lanes) {
            UserDefaults.standard.set(data, forKey: lanesDefaultsKey)
        }
    }

    @discardableResult
    private func applyLaunchLockIfPresent(from recent: [CodexTaskSummary]) -> Bool {
        guard let requestedID = ProcessInfo.processInfo.environment["SPEAKEASY_LOCK_THREAD_ID"],
              let requested = recent.first(where: { $0.id == requestedID })
        else { return false }
        validateAndLock(
            taskID: requested.id,
            expectedLane: nil,
            beginAfterLock: false,
            presentation: .background
        )
        return true
    }

    private func applyLaunchLaneAssignmentIfPresent() {
        guard let raw = ProcessInfo.processInfo.environment["SPEAKEASY_ASSIGN_LANE_NUMBER"],
              let number = Int(raw), Self.laneRange.contains(number),
              lockedTask != nil
        else { return }
        assignLockedTask(toLane: number)
    }

    private func revalidateRestoredLock(from recent: [CodexTaskSummary]) {
        guard let candidate = restoredLockCandidate else { return }
        restoredLockCandidate = nil
        if let task = recent.first(where: { $0.id == candidate.id }) {
            validateAndLock(
                taskID: task.id,
                expectedLane: activeLaneNumber,
                beginAfterLock: false,
                presentation: .background
            )
        } else {
            UserDefaults.standard.removeObject(forKey: lockDefaultsKey)
            selectedTaskID = recent.first?.id ?? ""
            lockedTask = nil
            activeLaneNumber = nil
            UserDefaults.standard.removeObject(forKey: activeLaneDefaultsKey)
            phase = .unlocked
            lastError = "The previously locked Codex task is no longer available. Choose a task to lock again."
        }
    }

    private func runLaunchFixtureIfPresent() {
        guard !fixtureHasRun,
              let path = ProcessInfo.processInfo.environment["SPEAKEASY_LISTENING_FIXTURE"],
              let lock = lockedTask
        else { return }
        fixtureHasRun = true
        let context = turnContext(for: lock)
        phase = .transcribing
        diagnostic("running launch transcription fixture")
        Task {
            do {
                let transcript = try await vox.transcribeFixture(url: URL(fileURLWithPath: path))
                try await completeLoop(transcript: transcript, context: context)
            } catch {
                recordFailure(error)
            }
        }
    }

    private func runLaunchHotkeyTestIfPresent() {
        guard !fixtureHasRun, !launchHotkeyHasRun,
              ProcessInfo.processInfo.environment["SPEAKEASY_TRIGGER_HOTKEY_ON_LAUNCH"] == "1",
              phase == .ready || phase == .failed
        else { return }
        launchHotkeyHasRun = true
        diagnostic("triggering registered hotkey action for launch test")
        shortcut?.triggerForTesting()
    }

    private func runLaunchLaneTestIfPresent() {
        guard !fixtureHasRun, !launchLaneHasRun,
              let raw = ProcessInfo.processInfo.environment["SPEAKEASY_TRIGGER_LANE_ON_LAUNCH"],
              let number = Int(raw), lane(number) != nil,
              phase == .ready || phase == .failed
        else { return }
        launchLaneHasRun = true
        diagnostic("triggering lane \(number) for launch test")
        shortcut?.triggerLaneForTesting(number)
    }

    private func runLaunchConfirmationTestIfPresent() {
        guard !fixtureHasRun, !launchConfirmationHasRun,
              ProcessInfo.processInfo.environment["SPEAKEASY_TRIGGER_LANE_CONFIRMATION_ON_LAUNCH"] == "1",
              activeLaneNumber != nil,
              lockedTask != nil,
              phase == .ready || phase == .failed
        else { return }
        launchConfirmationHasRun = true
        diagnostic("triggering active lane confirmation for launch test")
        shortcut?.triggerConfirmationForTesting()
    }

    private func prepareCue(for lane: VoiceLane) {
        let configuration = narrationConfiguration(from: ConfigManager.shared, lane: lane)
        Task {
            do {
                _ = try await laneCueStore.prepare(for: lane, configuration: configuration)
                diagnostic("premium lane \(lane.number) cue cached")
            } catch {
                // A cue is delight, not a routing dependency. Never fall back
                // to a system voice and never prevent the microphone opening.
                diagnostic("lane \(lane.number) cue unavailable: \(error.localizedDescription)")
            }
        }
    }

    private func narrationConfiguration(
        from config: ConfigManager,
        lane: VoiceLane? = nil
    ) -> SpeechNarrationConfiguration {
        let configuration: SpeechNarrationConfiguration
        switch config.defaultProvider {
        case "openai":
            configuration = SpeechNarrationConfiguration(
                provider: "openai", voice: config.openaiVoice, model: config.openaiModel,
                apiKey: config.openaiApiKey, instructions: config.openaiInstructions, rate: config.defaultRate
            )
        case "elevenlabs":
            configuration = SpeechNarrationConfiguration(
                provider: "elevenlabs", voice: config.elevenlabsVoiceId, model: config.elevenlabsModelId,
                apiKey: config.elevenlabsApiKey, instructions: nil, rate: config.defaultRate
            )
        case "groq":
            configuration = SpeechNarrationConfiguration(
                provider: "groq", voice: config.groqVoice, model: config.groqModel,
                apiKey: config.groqApiKey, instructions: nil, rate: config.defaultRate
            )
        case "gemini":
            configuration = SpeechNarrationConfiguration(
                provider: "gemini", voice: "Puck", model: config.geminiModel,
                apiKey: config.geminiApiKey, instructions: nil, rate: config.defaultRate
            )
        case "system":
            configuration = SpeechNarrationConfiguration(
                provider: "system", voice: config.systemVoice, model: nil,
                apiKey: "", instructions: nil, rate: config.defaultRate
            )
        default:
            configuration = SpeechNarrationConfiguration(
                provider: config.defaultProvider, voice: "", model: nil,
                apiKey: "", instructions: nil, rate: config.defaultRate
            )
        }
        return configuration.applying(lane: lane)
    }

    private func turnContext(for lock: ListeningTaskLock) -> ListeningTurnContext {
        let lane = activeLaneNumber
            .flatMap { self.lane($0) }
            .flatMap { $0.task.id == lock.id ? $0 : nil }
        let config = ConfigManager.shared
        return ListeningTurnContext(
            lock: lock,
            laneNumber: lane?.number,
            narration: narrationConfiguration(from: config, lane: lane),
            playbackVolume: config.defaultVolume
        )
    }

    private func openCodexTask(_ taskID: String) {
        guard let url = URL(string: "codex://threads/\(taskID)") else { return }
        NSWorkspace.shared.open(url)
    }

    private func recordFailure(_ error: Error) {
        maxRecordingTimer?.invalidate()
        maxRecordingTimer = nil
        recordingStartID = nil
        recordingContext = nil
        pendingNarrationItemID = nil
        narrationDidStart = false
        lastError = error.localizedDescription
        phase = lockedTask == nil ? .unlocked : .failed
        diagnostic("failed: \(error.localizedDescription)")
    }

    private func diagnostic(_ message: String) {
        let line = "SpeakEasy listening: \(message)"
        NSLog("%@", line)
        if let data = "\(line)\n".data(using: .utf8) {
            try? FileHandle.standardError.write(contentsOf: data)
        }
    }
}

enum ListeningLoopError: LocalizedError {
    case emptyTranscript
    case taskLockChanged
    case laneAssignmentChanged

    var errorDescription: String? {
        switch self {
        case .emptyTranscript: "No speech was detected. Try again and speak closer to the microphone."
        case .taskLockChanged: "The locked Codex task changed before the voice loop completed."
        case .laneAssignmentChanged: "That voice lane changed while SpeakEasy was validating it. Try again."
        }
    }
}
