import AVFAudio
import Combine
import Foundation
import OSLog
import Security

enum DeckConnectionState: Equatable {
    case disconnected
    case connecting
    case connected

    var label: String {
        switch self {
        case .disconnected: "MAC OFFLINE"
        case .connecting: "CONNECTING"
        case .connected: "MAC LIVE"
        }
    }
}

enum DeckCapturePhase: Equatable {
    case idle
    case arming
    case recording
    case transcribing

    var label: String {
        switch self {
        case .idle: "PARAKEET READY"
        case .arming: "MICROPHONE STARTING"
        case .recording: "LISTENING · PARAKEET"
        case .transcribing: "PARAKEET · TRANSCRIBING"
        }
    }
}

/// Owns the native iPad data plane: snapshots and intents over WebSocket,
/// Parakeet-first microphone uploads, and device-side narration playback.
final class DeckConnection: NSObject, ObservableObject, URLSessionDelegate, URLSessionWebSocketDelegate, AVAudioPlayerDelegate {
    @Published private(set) var snapshot: DeckSnapshot?
    @Published private(set) var state: DeckConnectionState = .disconnected
    @Published private(set) var capturePhase: DeckCapturePhase = .idle
    @Published private(set) var inputLevel: Double = 0
    @Published private(set) var localStatus: String?

    private let logger = Logger(subsystem: "dev.arach.speakeasy.deck", category: "native-connection")
    private let capture = SpeechCapture()
    private var deckURL: URL?
    private var pairedHost: String?
    private var session: URLSession?
    private var socket: URLSessionWebSocketTask?
    private var reconnectWork: DispatchWorkItem?
    private var generation = 0
    private var intentID = 0
    private var pttActive = false
    private var serverCaptureStarted = false
    private var transcriptionTask: URLSessionUploadTask?
    private var pendingCaptureText: String?
    private var pendingCaptureEndID: Int?
    private var captureEndRetryWork: DispatchWorkItem?
    private var cancelCaptureOnReconnect = false

    private var audioPlayer: AVAudioPlayer?
    private var audioPlayingID: String?
    private var audioLoadTask: URLSessionDataTask?
    private var progressTimer: Timer?

    override init() {
        super.init()
        capture.onStarted = { [weak self] in
            DispatchQueue.main.async { self?.captureDidStart() }
        }
        capture.onRecordingReady = { [weak self] url in
            DispatchQueue.main.async { self?.transcribeWithParakeet(url) }
        }
        capture.onFailure = { [weak self] message in
            DispatchQueue.main.async { self?.captureDidFail(message) }
        }
        capture.onLevel = { [weak self] level in
            DispatchQueue.main.async {
                guard let self else { return }
                guard self.capturePhase == .recording else {
                    self.inputLevel = 0
                    return
                }
                let target = Double(level)
                let smoothing = target > self.inputLevel ? 0.62 : 0.2
                self.inputLevel += (target - self.inputLevel) * smoothing
            }
        }
    }

    deinit {
        reconnectWork?.cancel()
        socket?.cancel(with: .goingAway, reason: nil)
        session?.invalidateAndCancel()
        capture.abort()
        stopLocalPlayback()
    }

    func connect(to url: URL) {
        if deckURL == url, state == .connected { return }
        if let deckURL, deckURL != url {
            resetCaptureRecovery()
        }
        generation &+= 1
        let currentGeneration = generation
        reconnectWork?.cancel()
        reconnectWork = nil
        closeTransport()

        deckURL = url
        pairedHost = url.host
        state = .connecting
        if pendingCaptureText != nil {
            capturePhase = .transcribing
            localStatus = "RECONNECTING TO FINISH CAPTURE"
        } else {
            localStatus = "OPENING NATIVE LINK"
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 185
        let newSession = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        session = newSession
        guard let socketURL = url.deckEndpoint(path: "/ws", webSocket: true) else {
            connectionLost("INVALID DECK ADDRESS", generation: currentGeneration)
            return
        }
        let newSocket = newSession.webSocketTask(with: socketURL)
        socket = newSocket
        newSocket.resume()
        receiveNext(from: newSocket, generation: currentGeneration)
    }

    func disconnect() {
        generation &+= 1
        reconnectWork?.cancel()
        reconnectWork = nil
        closeTransport()
        resetCaptureRecovery()
        deckURL = nil
        pairedHost = nil
        snapshot = nil
        state = .disconnected
        localStatus = nil
    }

    func reconnectNow() {
        guard let url = deckURL else {
            localStatus = "NO PAIRED MAC"
            return
        }
        state = .disconnected
        connect(to: url)
    }

    private func closeTransport() {
        capture.abort()
        transcriptionTask?.cancel()
        transcriptionTask = nil
        pttActive = false
        capturePhase = .idle
        inputLevel = 0
        stopLocalPlayback()
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        session?.invalidateAndCancel()
        session = nil
    }

    private func receiveNext(from task: URLSessionWebSocketTask, generation: Int) {
        task.receive { [weak self, weak task] result in
            guard let self, let task else { return }
            switch result {
            case .failure(let error):
                DispatchQueue.main.async {
                    guard self.socket === task else { return }
                    self.connectionLost(error.localizedDescription.uppercased(), generation: generation)
                }
            case .success(let message):
                let data: Data?
                switch message {
                case .data(let value): data = value
                case .string(let value): data = value.data(using: .utf8)
                @unknown default: data = nil
                }
                if let data { self.consume(data, from: task) }
                if self.socket === task {
                    self.receiveNext(from: task, generation: generation)
                }
            }
        }
    }

    private func consume(_ data: Data, from task: URLSessionWebSocketTask) {
        struct Envelope: Decodable { let type: String }
        guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else { return }
        switch envelope.type {
        case "snapshot":
            guard let next = try? JSONDecoder().decode(DeckSnapshot.self, from: data) else {
                logger.error("Rejected an invalid deck snapshot")
                return
            }
            DispatchQueue.main.async { [weak self, weak task] in
                guard let self, let task, self.socket === task else { return }
                guard next.rev > (self.snapshot?.rev ?? -1) else { return }
                self.snapshot = next
                self.state = .connected
                self.reconcileCapture(with: next)
                if self.capturePhase == .idle { self.localStatus = nil }
                self.syncPlayback(to: next)
            }
        case "ack":
            guard let ack = try? JSONDecoder().decode(DeckAck.self, from: data) else { return }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if self.handleCaptureEndAck(ack) { return }
                if !ack.ok { self.localStatus = (ack.error ?? "COMMAND REJECTED").uppercased() }
            }
        default:
            break
        }
    }

    private func connectionLost(_ message: String, generation currentGeneration: Int) {
        guard currentGeneration == generation else { return }
        state = .disconnected
        localStatus = "CONNECTION LOST · RETRYING"
        stopLocalPlayback()
        capture.abort()
        pttActive = false
        if serverCaptureStarted && pendingCaptureText == nil {
            cancelCaptureOnReconnect = true
        }
        capturePhase = pendingCaptureText == nil ? .idle : .transcribing
        inputLevel = 0
        socket = nil

        guard let reconnectURL = deckURL else { return }
        reconnectWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.generation == currentGeneration else { return }
            self.logger.notice("Reconnecting native deck after: \(message, privacy: .public)")
            self.connect(to: reconnectURL)
        }
        reconnectWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: work)
    }

    @discardableResult
    func sendIntent(_ name: String, _ arguments: [String: Any] = [:]) -> Int? {
        guard state == .connected, let socket else {
            localStatus = "MAC OFFLINE · RETRYING"
            return nil
        }
        intentID &+= 1
        let id = intentID
        var envelope: [String: Any] = ["type": "intent", "id": id, "name": name]
        arguments.forEach { envelope[$0.key] = $0.value }
        guard JSONSerialization.isValidJSONObject(envelope),
              let data = try? JSONSerialization.data(withJSONObject: envelope),
              let string = String(data: data, encoding: .utf8) else { return nil }
        socket.send(.string(string)) { [weak self] error in
            guard let error else { return }
            DispatchQueue.main.async {
                self?.localStatus = error.localizedDescription.uppercased()
            }
        }
        return id
    }

    func selectLane(_ index: Int) {
        sendIntent("lane.select", ["index": index])
    }

    func assignLane(_ index: Int, threadID: String?) {
        sendIntent("lane.assign", ["index": index, "threadId": threadID ?? NSNull(), "activate": threadID != nil])
    }

    func refreshCatalog() {
        sendIntent("catalog.refresh")
    }

    func stop() {
        if serverCaptureStarted { sendIntent("capture.cancel", ["reason": "CANCELLED ON IPAD"]) }
        capture.abort()
        transcriptionTask?.cancel()
        transcriptionTask = nil
        pttActive = false
        resetCaptureRecovery()
        capturePhase = .idle
        inputLevel = 0
        stopLocalPlayback()
        sendIntent("playback.stop")
    }

    func replay() { sendIntent("playback.replay") }
    func cycleSpeed() { sendIntent("playback.speed") }
    func toggleAutoplay() { sendIntent("playback.autoplay") }
    func setVolume(_ value: Double) { sendIntent("playback.volume", ["vol": min(1, max(0, value))]) }

    func togglePlayback(lane: Int, message: Int) {
        sendIntent("playback.toggle", ["id": "\(lane):\(message)"])
    }

    func pttBegan() {
        guard state == .connected, capturePhase == .idle, let snapshot else {
            localStatus = "MAC OFFLINE · OPEN SPEAKEASY"
            return
        }
        if snapshot.lane != 9, snapshot.activeLane?.threadId == nil {
            localStatus = "ASSIGN THIS LANE BEFORE SPEAKING"
            return
        }
        pttActive = true
        capturePhase = .arming
        localStatus = capturePhase.label
        stopLocalPlayback()
        capture.start()
    }

    func pttEnded() {
        guard pttActive else { return }
        pttActive = false
        capture.finish()
    }

    func pttCancelled() {
        guard pttActive || capturePhase != .idle else { return }
        pttActive = false
        capture.abort()
        transcriptionTask?.cancel()
        transcriptionTask = nil
        if serverCaptureStarted { sendIntent("capture.cancel", ["reason": "VOICE HOLD CANCELLED"]) }
        resetCaptureRecovery()
        capturePhase = .idle
        inputLevel = 0
        localStatus = "CANCELLED"
    }

    private func captureDidStart() {
        guard pttActive else {
            capture.abort()
            return
        }
        serverCaptureStarted = true
        capturePhase = .recording
        localStatus = capturePhase.label
        sendIntent("capture.start")
    }

    private func captureDidFail(_ message: String) {
        transcriptionTask?.cancel()
        transcriptionTask = nil
        if serverCaptureStarted { sendIntent("capture.cancel", ["reason": message]) }
        pttActive = false
        resetCaptureRecovery()
        capturePhase = .idle
        inputLevel = 0
        localStatus = message
    }

    private struct TranscriptionResult: Decodable {
        let ok: Bool
        let text: String?
        let engine: String?
        let error: String?
    }

    private func transcribeWithParakeet(_ fileURL: URL) {
        guard serverCaptureStarted,
              let endpoint = deckURL?.deckEndpoint(path: "/api/transcribe"),
              let session else {
            try? FileManager.default.removeItem(at: fileURL)
            captureDidFail("LOCAL PARAKEET UNAVAILABLE")
            return
        }
        inputLevel = 0
        capturePhase = .transcribing
        localStatus = capturePhase.label

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 185
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("audio/wav", forHTTPHeaderField: "Content-Type")

        let task = session.uploadTask(with: request, fromFile: fileURL) { [weak self] data, response, error in
            defer { try? FileManager.default.removeItem(at: fileURL) }
            DispatchQueue.main.async {
                guard let self,
                      self.serverCaptureStarted,
                      self.capturePhase == .transcribing else { return }
                self.transcriptionTask = nil
                if let error {
                    self.captureDidFail(error.localizedDescription.uppercased())
                    return
                }
                guard let http = response as? HTTPURLResponse,
                      let data,
                      let result = try? JSONDecoder().decode(TranscriptionResult.self, from: data),
                      (200..<300).contains(http.statusCode), result.ok,
                      let text = result.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                      !text.isEmpty else {
                    let result = data.flatMap { try? JSONDecoder().decode(TranscriptionResult.self, from: $0) }
                    self.captureDidFail((result?.error ?? "NO SPEECH · TRY AGAIN").uppercased())
                    return
                }
                // The Mac owns `listening`. Keep the native control in its
                // transcribing state until an ack or corrective snapshot says
                // the matching capture.end was accepted. If the socket drops,
                // the retained transcript is retried after reconnect.
                self.pendingCaptureText = String(text.prefix(500))
                self.localStatus = "SENDING TRANSCRIPT TO MAC"
                self.sendPendingCaptureEnd()
            }
        }
        transcriptionTask = task
        task.resume()
    }

    private func sendPendingCaptureEnd() {
        guard pendingCaptureEndID == nil,
              let text = pendingCaptureText else { return }
        guard let id = sendIntent("capture.end", ["text": text]) else {
            scheduleCaptureEndRetry(expectedID: nil)
            return
        }
        pendingCaptureEndID = id
        scheduleCaptureEndRetry(expectedID: id)
    }

    private func scheduleCaptureEndRetry(expectedID: Int?) {
        captureEndRetryWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.pendingCaptureText != nil else { return }
            guard self.pendingCaptureEndID == expectedID else { return }
            if self.snapshot?.listening == false {
                self.completeCaptureEnd()
                return
            }
            self.pendingCaptureEndID = nil
            self.localStatus = self.state == .connected
                ? "CONFIRMING TRANSCRIPT WITH MAC"
                : "RECONNECTING TO FINISH CAPTURE"
            self.sendPendingCaptureEnd()
        }
        captureEndRetryWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: work)
    }

    private func handleCaptureEndAck(_ ack: DeckAck) -> Bool {
        guard let id = ack.id, id == pendingCaptureEndID else { return false }
        captureEndRetryWork?.cancel()
        captureEndRetryWork = nil
        pendingCaptureEndID = nil
        if ack.ok || ack.error?.lowercased() == "not recording" {
            completeCaptureEnd()
        } else {
            localStatus = (ack.error ?? "TRANSCRIPT NOT ACCEPTED").uppercased()
            scheduleCaptureEndRetry(expectedID: nil)
        }
        return true
    }

    private func reconcileCapture(with snapshot: DeckSnapshot) {
        if pendingCaptureText != nil {
            if !snapshot.listening {
                completeCaptureEnd()
            } else if pendingCaptureEndID == nil {
                sendPendingCaptureEnd()
            }
            return
        }
        guard cancelCaptureOnReconnect else { return }
        cancelCaptureOnReconnect = false
        if snapshot.listening {
            sendIntent("capture.cancel", ["reason": "IPAD CAPTURE INTERRUPTED"])
        }
        serverCaptureStarted = false
    }

    private func completeCaptureEnd() {
        captureEndRetryWork?.cancel()
        captureEndRetryWork = nil
        pendingCaptureEndID = nil
        pendingCaptureText = nil
        serverCaptureStarted = false
        cancelCaptureOnReconnect = false
        capturePhase = .idle
        inputLevel = 0
        localStatus = "SENT · PARAKEET LOCAL"
    }

    private func resetCaptureRecovery() {
        captureEndRetryWork?.cancel()
        captureEndRetryWork = nil
        pendingCaptureEndID = nil
        pendingCaptureText = nil
        serverCaptureStarted = false
        cancelCaptureOnReconnect = false
    }

    private let speeds = [1.0, 1.25, 1.5, 0.75]

    private func syncPlayback(to snapshot: DeckSnapshot) {
        guard capturePhase == .idle else { return }
        guard let id = snapshot.playing else {
            stopLocalPlayback()
            return
        }
        guard let message = snapshot.message(id: id), let audioPath = message.audioUrl else { return }

        if audioPlayingID != id {
            audioLoadTask?.cancel()
            audioPlayer?.stop()
            audioPlayer = nil
            audioPlayingID = id
            guard let audioURL = deckURL?.deckEndpoint(path: audioPath), let session else { return }
            let expectedID = id
            let task = session.dataTask(with: audioURL) { [weak self] data, response, error in
                DispatchQueue.main.async {
                    guard let self, self.audioPlayingID == expectedID,
                          error == nil,
                          let http = response as? HTTPURLResponse,
                          (200..<300).contains(http.statusCode),
                          let data,
                          let player = try? AVAudioPlayer(data: data) else {
                        if self?.audioPlayingID == expectedID {
                            self?.localStatus = "AUDIO PLAYBACK FAILED"
                        }
                        return
                    }
                    self.audioPlayer = player
                    player.delegate = self
                    player.enableRate = true
                    self.configure(player, from: snapshot)
                    player.prepareToPlay()
                    if !snapshot.paused { player.play() }
                    self.startProgressTimer()
                }
            }
            audioLoadTask = task
            task.resume()
            return
        }

        guard let player = audioPlayer else { return }
        configure(player, from: snapshot)
        if snapshot.paused {
            player.pause()
        } else if !player.isPlaying {
            player.play()
        }
        if abs(player.currentTime - snapshot.pos) > 2 {
            player.currentTime = snapshot.pos
        }
    }

    private func configure(_ player: AVAudioPlayer, from snapshot: DeckSnapshot) {
        let speed = speeds.indices.contains(snapshot.speedIx) ? speeds[snapshot.speedIx] : 1
        player.rate = Float(speed)
        player.volume = Float(min(1, max(0, snapshot.vol)))
        if player.currentTime == 0, snapshot.pos > 0 { player.currentTime = snapshot.pos }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    private func startProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, let player = self.audioPlayer, player.isPlaying, let id = self.audioPlayingID else { return }
            self.sendIntent("playback.progress", ["id": id, "pos": player.currentTime, "dur": player.duration])
        }
    }

    private func stopLocalPlayback() {
        progressTimer?.invalidate()
        progressTimer = nil
        audioLoadTask?.cancel()
        audioLoadTask = nil
        audioPlayer?.stop()
        audioPlayer = nil
        audioPlayingID = nil
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        guard let id = audioPlayingID else { return }
        progressTimer?.invalidate()
        progressTimer = nil
        audioPlayer = nil
        audioPlayingID = nil
        sendIntent("playback.ended", ["id": id])
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              let pairedHost,
              challenge.protectionSpace.host.caseInsensitiveCompare(pairedHost) == .orderedSame,
              let anchor = DeckProvisioning.trustAnchor else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        SecTrustSetAnchorCertificates(trust, [anchor] as CFArray)
        SecTrustSetAnchorCertificatesOnly(trust, true)
        var error: CFError?
        guard SecTrustEvaluateWithError(trust, &error) else {
            logger.error("Rejected paired Deck certificate: \(error?.localizedDescription ?? "unknown trust error", privacy: .public)")
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        DispatchQueue.main.async { [weak self, weak webSocketTask] in
            guard let self, let webSocketTask, self.socket === webSocketTask else { return }
            self.state = .connected
            self.localStatus = "NATIVE LINK READY"
        }
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        DispatchQueue.main.async { [weak self, weak webSocketTask] in
            guard let self, let webSocketTask, self.socket === webSocketTask else { return }
            self.connectionLost("SOCKET CLOSED", generation: self.generation)
        }
    }
}
