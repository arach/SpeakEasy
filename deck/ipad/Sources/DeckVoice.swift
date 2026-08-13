import Combine
import Foundation
import HudsonVoice
import OSLog

enum DeckCapturePhase: Equatable {
    case idle
    /// The Parakeet model is downloading and warming (0...1).
    case preparing(Double)
    case arming
    case recording
    case transcribing
    /// Audio captured before the model was ready, waiting to be transcribed.
    case held(Int)
    /// Transcripts the Mac has not accepted yet.
    case delivering(Int)

    var label: String {
        switch self {
        case .idle: "PARAKEET READY"
        case .preparing(let progress): "PARAKEET MODEL · \(Int(progress * 100))%"
        case .arming: "MICROPHONE STARTING"
        case .recording: "LISTENING · PARAKEET"
        case .transcribing: "PARAKEET · TRANSCRIBING"
        case .held(let count): "\(count) HELD · WAITING FOR MODEL"
        case .delivering(let count): "\(count) WAITING FOR MAC"
        }
    }

    var isBusy: Bool {
        switch self {
        case .arming, .recording, .transcribing: true
        default: false
        }
    }
}

/// Owns dictation on the iPad, end to end.
///
/// Speech is captured, transcribed, and stored entirely on this device: the
/// Mac is a destination, never a dependency. Hold to Speak works with the Mac
/// asleep, the socket dropped, or a response already in flight, and every
/// utterance is kept on disk until the Mac has confirmed it by id.
///
/// Two durable queues sit behind that promise. `HudDictation` holds *audio*
/// that could not be transcribed yet (the model is still downloading), and
/// `DeckTranscriptOutbox` holds *transcripts* the Mac has not accepted yet.
@MainActor
final class DeckVoice: ObservableObject {
    @Published private(set) var phase: DeckCapturePhase = .idle
    @Published private(set) var inputLevel: Double = 0
    @Published private(set) var status: String?
    /// Transcripts produced but not yet accepted by the Mac.
    @Published private(set) var undelivered: Int = 0
    /// Full text is exposed only so the operator can inspect and deliberately
    /// dismiss words that would otherwise remain pinned indefinitely.
    @Published private(set) var pendingTranscripts: [DeckTranscriptOutbox.Entry] = []
    /// Recordings waiting on the Parakeet model.
    @Published private(set) var heldAudio: Int = 0
    @Published private(set) var modelReady = false
    @Published private(set) var modelInstalled = false

    let dictation: HudDictation
    private let outbox = DeckTranscriptOutbox()
    private let logger = Logger(subsystem: "dev.arach.speakeasy.deck", category: "deck-voice")

    private weak var connection: DeckConnection?
    private var cancellables: Set<AnyCancellable> = []
    private var inFlight: (entry: DeckTranscriptOutbox.Entry, intentID: Int)?
    private var retryWork: DispatchWorkItem?
    private var captureStartIntentID: Int?
    private var isArming = false
    private var hasActivated = false

    private static func lane(fromContext context: String?) -> Int? {
        guard let context, context.hasPrefix("lane:") else { return nil }
        return Int(context.dropFirst("lane:".count))
    }

    init() {
        // Auto-download once the operator has a Mac to talk to; strict Parakeet
        // so nothing is ever resolved by a second engine behind their back.
        //
        // Never on the simulator. Parakeet downloads there fine but CoreML
        // cannot finish compiling it without an ANE, so the model sits at the
        // last few percent forever, dictation never arms, and every launch
        // leaves more compiled sub-graphs in com.apple.e5rt.e5bundlecache —
        // that cache reached 14GB before anyone noticed. The simulator is for
        // layout; transcription is verified on device.
        dictation = HudDictation(modelDownloadPolicy: Self.asrEnabled ? .eager : .never)
        dictation.parakeetOnly = true
        dictation.onFinal = { [weak self] text in
            self?.accept(transcript: text)
        }
        refreshQueues()
        trackDictation()

        // Audio inherited from a previous launch is already owed to the
        // operator, so it earns the model download on its own — no pairing,
        // no connection, no further hold required.
        if Self.asrEnabled, heldAudio > 0 { dictation.prepare() }
    }

    /// On-device speech recognition is unavailable on the simulator.
    static let asrEnabled: Bool = {
        #if targetEnvironment(simulator)
        return false
        #else
        return true
        #endif
    }()

    // MARK: - Wiring

    func attach(to connection: DeckConnection) {
        guard self.connection !== connection else { return }
        self.connection = connection
        cancellables.removeAll()

        connection.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.connectionStateChanged(state) }
            .store(in: &cancellables)

        connection.onAck = { [weak self] ack in self?.handle(ack) ?? false }

        // Anything inherited from a previous launch goes out now.
        pump()
    }

    private func connectionStateChanged(_ state: DeckConnectionState) {
        guard state == .connected else { return }
        if !hasActivated {
            hasActivated = true
            // Pairing is the moment the 461 MB model becomes worth fetching.
            dictation.activate()
            Task { await dictation.refreshStatus() }
            watchForStalledPreparation()
        }
        pump()
    }

    /// Recover a preparation that has finished without saying so.
    ///
    /// Vox loads the model and logs it; `HudDictation.preload()` is what turns
    /// that into `modelReady`. When its continuation is lost, the two disagree
    /// permanently: the engine holds a warm Parakeet while this surface shows
    /// "PARAKEET MODEL · 85%" forever, held audio is never drained, and because
    /// held audio is what makes `init()` call `prepare()`, every relaunch walks
    /// straight back into the same stall. Nothing breaks the loop from inside.
    ///
    /// `refreshStatus()` asks the engine directly — `models()` reports
    /// `preloaded`, and the setter drains the held queue — so it is the one
    /// path that can disagree with a stuck `state` and win. It is only ever
    /// called once, at pairing, which is exactly when a stall has not happened
    /// yet. So poll it while preparation claims to be in progress.
    ///
    /// Deliberately cheap and finite: every 5 s, only while `.preparing`, and
    /// it stops the moment the model reports ready. A genuine first download
    /// is minutes of real work and this simply observes it; a lost signal is
    /// caught within one tick of the model actually being warm.
    private func watchForStalledPreparation() {
        guard Self.asrEnabled else { return }
        Task { [weak self] in
            for _ in 0..<180 {
                try? await Task.sleep(for: .seconds(5))
                guard let self else { return }
                guard case .preparing = self.dictation.state else { return }
                await self.dictation.refreshStatus()
                if self.dictation.modelReady {
                    self.logger.notice("Recovered a preparation that had already completed")
                    return
                }
            }
        }
    }

    // MARK: - Push to talk

    func pttBegan() {
        // Say so plainly rather than arming a capture that can never resolve.
        guard Self.asrEnabled else {
            status = "DICTATION IS DEVICE-ONLY"
            return
        }

        let snapshot = connection?.snapshot
        // Ownership, not the thread id. A deck thread has no codex thread id
        // until its first turn answers, and gating on the id made that first
        // turn impossible — the lane could never become speakable.
        if let snapshot, snapshot.lane != 9, snapshot.activeLane?.isAssigned != true {
            status = "ASSIGN THIS LANE BEFORE SPEAKING"
            return
        }

        // The Mac is a destination, not a precondition: capture starts here even
        // with the socket down, and the transcript waits its turn. The lane
        // travels with the audio so speech held through a model download lands
        // where it was spoken, not wherever the operator has since navigated.
        dictation.captureContext = "lane:\(snapshot?.lane ?? 0)"
        isArming = true
        status = DeckCapturePhase.arming.label
        connection?.beginCapture()
        dictation.start()
        captureStartIntentID = connection?.sendIntent("capture.start")
        refreshPhase()
    }

    func pttEnded() {
        guard isArming || dictation.isListening else { return }
        isArming = false
        dictation.stop()
        connection?.endCapture()
        refreshPhase()
    }

    func pttCancelled() {
        guard isArming || dictation.isListening else { return }
        isArming = false
        dictation.cancel()
        connection?.endCapture()
        if captureStartIntentID != nil {
            connection?.sendIntent("capture.cancel", ["reason": "VOICE HOLD CANCELLED"])
            captureStartIntentID = nil
        }
        status = "CANCELLED"
        refreshPhase()
    }

    /// The transport STOP button. It abandons an in-progress hold but never
    /// touches transcripts already captured — those are the operator's words.
    func stopCapture() {
        if isArming || dictation.isListening {
            pttCancelled()
        }
    }

    // MARK: - Delivery

    private func accept(transcript: String) {
        let text = String(transcript.trimmingCharacters(in: .whitespacesAndNewlines).prefix(500))
        guard !text.isEmpty else {
            refreshPhase()
            return
        }
        // For a held utterance this is the lane from capture time, not now.
        let lane = Self.lane(fromContext: dictation.lastFinalContext)
            ?? connection?.snapshot?.lane
            ?? 0
        guard outbox.enqueue(text: text, lane: lane) != nil else {
            status = "COULD NOT SAVE TRANSCRIPT"
            return
        }
        logger.notice("Held a local transcript for delivery")
        refreshQueues()
        pump()
    }

    /// Send the oldest undelivered transcript, if any, and keep it until the
    /// Mac acknowledges that exact id.
    private func pump() {
        guard inFlight == nil else { return }
        refreshQueues()
        guard let entry = outbox.first else {
            refreshPhase()
            return
        }
        guard let connection, connection.state == .connected else {
            status = "\(undelivered) TRANSCRIPT\(undelivered == 1 ? "" : "S") WAITING FOR MAC"
            refreshPhase()
            return
        }

        guard let intentID = connection.sendIntent("capture.end", [
            "text": entry.text,
            "utteranceId": entry.id,
            "lane": entry.lane,
        ]) else {
            scheduleRetry(after: 2.5)
            return
        }

        inFlight = (entry, intentID)
        status = "SENDING TRANSCRIPT TO MAC"
        refreshPhase()
        // The socket can die between send and ack; nothing is retired on a timeout.
        scheduleRetry(after: 6)
    }

    @discardableResult
    private func handle(_ ack: DeckAck) -> Bool {
        if let captureStartIntentID, ack.id == captureStartIntentID {
            self.captureStartIntentID = nil
            if !ack.ok {
                // Recording continues regardless — the transcript will wait for
                // the lane instead of being thrown away like it used to be.
                status = (ack.error ?? "MAC NOT READY").uppercased()
            }
            return true
        }

        guard let pending = inFlight, ack.id == pending.intentID else { return false }
        inFlight = nil
        retryWork?.cancel()
        retryWork = nil

        guard ack.ok else {
            // Busy lane, restarted runtime, anything else: keep the words.
            status = (ack.error ?? "TRANSCRIPT NOT ACCEPTED").uppercased()
            refreshQueues()
            refreshPhase()
            scheduleRetry(after: 3)
            return true
        }

        outbox.retire(pending.entry.id)
        refreshQueues()
        status = undelivered == 0 ? "SENT · PARAKEET LOCAL" : nil
        refreshPhase()
        pump()
        return true
    }

    private func scheduleRetry(after seconds: TimeInterval) {
        retryWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.inFlight = nil
            self.pump()
        }
        retryWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    func discardTranscript(_ id: String) {
        guard pendingTranscripts.contains(where: { $0.id == id }) else { return }
        outbox.discard(id)
        if inFlight?.entry.id == id {
            inFlight = nil
            retryWork?.cancel()
            retryWork = nil
        }
        logger.notice("Operator discarded a held transcript")
        status = "TRANSCRIPT DISCARDED"
        refreshQueues()
        refreshPhase()
        pump()
    }

    // MARK: - Engine observation

    /// `HudDictation` is `@Observable`; mirror the parts this surface publishes.
    private func trackDictation() {
        withObservationTracking {
            _ = dictation.state
            _ = dictation.audioLevel
            _ = dictation.queuedCount
            _ = dictation.modelInstalled
            _ = dictation.modelReady
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in
                guard let self else { return }
                // Re-arm before reading: tracking is one-shot, and a transition
                // that lands between the two would otherwise go unnoticed.
                self.trackDictation()
                self.dictationChanged()
            }
        }
    }

    private func dictationChanged() {
        if case .listening = dictation.state { isArming = false }
        if case .unavailable(let message) = dictation.state {
            isArming = false
            status = message.uppercased()
        }

        let target = dictation.audioLevel
        let smoothing = target > inputLevel ? 0.62 : 0.2
        inputLevel += (target - inputLevel) * smoothing

        modelReady = dictation.modelReady
        modelInstalled = dictation.modelInstalled
        heldAudio = dictation.queuedCount
        refreshPhase()
    }

    private func refreshQueues() {
        pendingTranscripts = outbox.entries()
        undelivered = pendingTranscripts.count
        heldAudio = dictation.queuedCount
    }

    private func refreshPhase() {
        let next: DeckCapturePhase
        switch dictation.state {
        case .listening:
            next = .recording
        case .transcribing:
            next = .transcribing
        case .preparing(let progress):
            // Quantised to whole percent, and that is not a cosmetic choice.
            //
            // `HudDictation.prepare()` reports progress through a closure that
            // hops to the main actor on every tick, and CoreML emits those
            // continuously for the minutes it takes to compile a 424 MB encoder
            // for the Neural Engine. Every distinct `Double` here was a new
            // phase value, which republished this object, which re-rendered the
            // whole deck — lane rows, key bank, console, all of it — hundreds of
            // times a second. The main actor never got a free moment to service
            // a touch, so the app rendered perfectly and answered nothing.
            //
            // The label is `Int(progress * 100)`. Anything finer than a percent
            // was invisible work that cost the operator the use of the app.
            next = isArming ? .arming : .preparing(((progress * 100).rounded(.down)) / 100)
        case .idle, .unavailable:
            if isArming {
                next = .arming
            } else if heldAudio > 0 {
                next = .held(heldAudio)
            } else if undelivered > 0 {
                next = .delivering(undelivered)
            } else {
                next = .idle
            }
        }

        if next != phase { phase = next }
        if inputLevel != 0, next != .recording { inputLevel = 0 }
    }
}
