import AVFAudio
import Combine
import Foundation
import CryptoKit
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

/// Owns the native iPad data plane: snapshots and intents over WebSocket, plus
/// device-side narration playback.
///
/// Dictation is deliberately *not* here. Speech is captured and transcribed on
/// the device by `DeckVoice`, which uses this class only as a delivery route —
/// so a dropped socket costs the operator a retry, never their words.
final class DeckConnection: NSObject, ObservableObject, URLSessionDelegate, URLSessionWebSocketDelegate, AVAudioPlayerDelegate {
    private struct HTTPIntentResult: Decodable {
        let ok: Bool
        let error: String?
    }

    @Published private(set) var snapshot: DeckSnapshot?
    @Published private(set) var state: DeckConnectionState = .disconnected
    @Published private(set) var localStatus: String?

    /// Live narration level and envelope. A separate observable on purpose --
    /// see `DeckPlaybackMeter` -- so 20 Hz metering does not invalidate the deck.
    let meter = DeckPlaybackMeter()
    @Published private(set) var waveformPreviews: [String: [Double]] = [:]
    private var waveformRequests = Set<String>()

    func loadWaveform(path: String) {
        guard waveformPreviews[path] == nil, !waveformRequests.contains(path),
              let audioURL = deckURL?.deckEndpoint(path: path), let session else { return }
        waveformRequests.insert(path)
        session.dataTask(with: audioURL) { [weak self, weak session] data, response, error in
            let valid = error == nil && (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } == true
            let envelope = valid ? data.flatMap { Self.decodeWaveform($0) } : nil
            DispatchQueue.main.async {
                guard let self, self.session === session else { return }
                self.waveformRequests.remove(path)
                if let envelope {
                    // Each envelope is only 120 numbers; keep earlier visible replies intact.
                    self.waveformPreviews[path] = envelope
                }
            }
        }.resume()
    }

    private static func decodeWaveform(_ data: Data) -> [Double]? {
        guard !data.isEmpty, data.count <= 32 * 1024 * 1024 else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".audio")
        defer { try? FileManager.default.removeItem(at: url) }
        do {
            try data.write(to: url)
            let file = try AVAudioFile(forReading: url)
            guard file.length > 0, file.length <= 60 * 60 * 192000,
                  let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 4096) else { return nil }
            var peaks = Array(repeating: 0.0, count: 120)
            var offset: AVAudioFramePosition = 0
            while offset < file.length {
                try file.read(into: buffer, frameCount: 4096)
                guard buffer.frameLength > 0, let channels = buffer.floatChannelData else { break }
                for frame in 0..<Int(buffer.frameLength) {
                    let bucket = min(119, Int((offset + Int64(frame)) * 120 / file.length))
                    for channel in 0..<Int(buffer.format.channelCount) {
                        let sample = Double(abs(channels[channel][frame]))
                        if sample.isFinite { peaks[bucket] = max(peaks[bucket], sample) }
                    }
                }
                offset += Int64(buffer.frameLength)
            }
            guard offset > 0 else { return nil }
            let maximum = max(0.01, peaks.max() ?? 0)
            return peaks.map { min(1, sqrt($0 / maximum)) }
        } catch { return nil }
    }


    /// Every intent acknowledgement, on the main thread. `DeckVoice` uses this
    /// to retire transcripts by id, and returns true for the ones it owns.
    var onAck: ((DeckAck) -> Bool)?

    /// Set while the microphone is open, so an arriving snapshot does not start
    /// narration playback over the operator's own voice.
    var isCapturing = false

    private let logger = Logger(subsystem: "dev.arach.speakeasy.deck", category: "native-connection")
    /// Stable across reconnects, distinct across paired hosts; never persist the capability URL.
    var transcriptHostIdentity: String? {
        guard let deckURL else { return nil }
        return SHA256.hash(data: Data(deckURL.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private var deckURL: URL?
    private var pairedHost: String?
    private var session: URLSession?
    private var socket: URLSessionWebSocketTask?
    private var reconnectWork: DispatchWorkItem?
    private var generation = 0
    private var lastSnapshotRevision = -1
    private var intentID = 0
    private let httpFallbackIntents: Set<String> = ["playback.stop", "capture.cancel", "turn.abort"]

    private var audioPlayer: AVAudioPlayer?
    private var audioPlayingID: String?
    private var audioLoadTask: URLSessionDataTask?
    private var progressTimer: Timer?
    private var meterTick = 0
    /// When the operator last moved the playhead on this device. See
    /// `syncPlayback` for why a seek needs a grace window.
    private var lastLocalSeek: Date?

    deinit {
        reconnectWork?.cancel()
        socket?.cancel(with: .goingAway, reason: nil)
        session?.invalidateAndCancel()
        stopLocalPlayback()
    }

    func connect(to url: URL) {
        if deckURL == url, state == .connected { return }
        generation &+= 1
        let currentGeneration = generation
        reconnectWork?.cancel()
        reconnectWork = nil
        closeTransport()
        lastSnapshotRevision = -1
        if deckURL != url { snapshot = nil; waveformPreviews.removeAll() }

        deckURL = url
        pairedHost = url.host
        state = .connecting
        localStatus = "OPENING NATIVE LINK"

        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 185
        let newSession = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        waveformRequests.removeAll()
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
                guard next.rev > self.lastSnapshotRevision else { return }
                self.lastSnapshotRevision = next.rev
                self.snapshot = next
                self.state = .connected
                self.localStatus = nil
                self.syncPlayback(to: next)
            }
        case "ack":
            guard let ack = try? JSONDecoder().decode(DeckAck.self, from: data) else { return }
            DispatchQueue.main.async { [weak self, weak task] in
                guard let self, let task, self.socket === task else { return }
                // Voice claims the acks for its own intents and reports them in
                // its own words; everything else falls through to transport status.
                if self.onAck?(ack) == true { return }
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
            if httpFallbackIntents.contains(name) { postControlIntent(name, arguments) }
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
                guard let self else { return }
                self.localStatus = error.localizedDescription.uppercased()
                if self.httpFallbackIntents.contains(name) {
                    self.postControlIntent(name, arguments)
                }
            }
        }
        return id
    }

    /// Control must remain reachable when the long-lived transport is the
    /// thing that failed. These intents are idempotent enough to retry after an
    /// ambiguous socket send, and the runtime already exposes the same parser
    /// over HTTP for exactly this independent route.
    private func postControlIntent(_ name: String, _ arguments: [String: Any]) {
        guard let url = deckURL?.deckEndpoint(path: "/api/intent") else {
            localStatus = "NO PAIRED MAC"
            return
        }
        var payload: [String: Any] = ["name": name]
        arguments.forEach { payload[$0.key] = $0.value }
        guard JSONSerialization.isValidJSONObject(payload),
              let body = try? JSONSerialization.data(withJSONObject: payload) else {
            localStatus = "CONTROL COMMAND INVALID"
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        // A dedicated session survives closeTransport() invalidating the dead
        // WebSocket's session while this one-shot recovery request is in flight.
        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 10
        let fallbackSession = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        fallbackSession.dataTask(with: request) { [weak self, fallbackSession] data, response, error in
            defer { fallbackSession.finishTasksAndInvalidate() }
            let http = response as? HTTPURLResponse
            let result = data.flatMap { try? JSONDecoder().decode(HTTPIntentResult.self, from: $0) }
            DispatchQueue.main.async {
                guard let self else { return }
                let alreadySatisfied = (name == "capture.cancel" && result?.error == "not recording")
                    || (name == "turn.abort" && result?.error == "nothing in flight")
                if let error {
                    self.localStatus = "CONTROL FAILED · \(error.localizedDescription.uppercased())"
                } else if !(200..<300).contains(http?.statusCode ?? 0) || (result?.ok != true && !alreadySatisfied) {
                    self.localStatus = (result?.error ?? "CONTROL COMMAND REJECTED").uppercased()
                } else if self.state != .connected {
                    self.localStatus = "CONTROL SENT · RECONNECTING"
                } else {
                    self.localStatus = nil
                }
            }
        }.resume()
    }

    func selectLane(_ index: Int) {
        sendIntent("lane.select", ["index": index])
    }

    func assignLane(_ index: Int, threadID: String?) {
        sendIntent("lane.assign", ["index": index, "threadId": threadID ?? NSNull(), "activate": threadID != nil])
    }

    /// Start a fresh deck-owned thread on a pad. The codex thread is created on
    /// the first turn, so the pad is speakable the moment this returns.
    func newThread(_ index: Int, cwd: String? = nil) {
        var payload: [String: Any] = ["index": index]
        if let cwd, !cwd.isEmpty { payload["cwd"] = cwd }
        sendIntent("lane.new", payload)
    }

    func refreshCatalog() {
        sendIntent("catalog.refresh")
    }

    func stop() {
        stopLocalPlayback()
        sendIntent("playback.stop")
    }

    /// Withdraw a turn already sent. Silences this device too, because a reply
    /// to a cancelled question should not keep talking.
    func abortTurn() {
        stopLocalPlayback()
        sendIntent("turn.abort")
    }

    func replay() { sendIntent("playback.replay") }
    func cycleSpeed() { sendIntent("playback.speed") }
    func toggleAutoplay() { sendIntent("playback.autoplay") }
    func setVolume(_ value: Double) { sendIntent("playback.volume", ["vol": min(1, max(0, value))]) }

    func togglePlayback(lane: Int, message: Int) {
        sendIntent("playback.toggle", ["id": "\(lane):\(message)"])
    }

    /// Play/pause whatever is under the playhead right now.
    ///
    /// The device player is toggled first so the button answers the thumb
    /// immediately, and the Mac is told in the same breath; its next snapshot
    /// confirms us, or corrects us if it disagreed.
    func togglePlayPause() {
        guard let id = audioPlayingID else { return }
        if let player = audioPlayer {
            if player.isPlaying { player.pause() } else { player.play() }
        }
        let parts = id.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return }
        togglePlayback(lane: parts[0], message: parts[1])
    }

    /// Move the playhead.
    ///
    /// `playback.scrub` is rejected by the Mac runtime -- afplay cannot seek --
    /// but the Mac is not the one playing this. For runtime-file audio the
    /// device owns the player, and the runtime explicitly adopts the device's
    /// clock from `playback.progress` rather than estimating its own. So the
    /// seek happens locally and is published upstream as progress, which is the
    /// same channel normal playback already uses. Nothing new is asked of the
    /// Mac, and the browser deck is unaffected.
    func seek(to seconds: Double) {
        guard let player = audioPlayer, let id = audioPlayingID else { return }
        let target = min(max(0, seconds), player.duration)
        player.currentTime = target
        meter.moved(to: target)
        lastLocalSeek = Date()
        sendIntent("playback.progress", ["id": id, "pos": target, "dur": player.duration])
    }

    var playbackDuration: Double { audioPlayer?.duration ?? 0 }

    /// Silence device narration for as long as the microphone is open.
    func beginCapture() {
        isCapturing = true
        stopLocalPlayback()
    }

    func endCapture() {
        isCapturing = false
    }

    private func syncPlayback(to snapshot: DeckSnapshot) {
        guard !isCapturing else { return }
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
            let expectedGeneration = generation
            let task = session.dataTask(with: audioURL) { [weak self] data, response, error in
                DispatchQueue.main.async {
                    guard let self, self.audioPlayingID == expectedID,
                          self.generation == expectedGeneration, !self.isCapturing,
                          let current = self.snapshot, current.playing == expectedID,
                          error == nil,
                          let http = response as? HTTPURLResponse,
                          (200..<300).contains(http.statusCode),
                          let data,
                          let player = try? AVAudioPlayer(data: data) else {
                        if self?.audioPlayingID == expectedID && self?.generation == expectedGeneration {
                            self?.audioPlayingID = nil
                            self?.localStatus = "AUDIO PLAYBACK FAILED"
                        }
                        return
                    }
                    self.audioPlayer = player
                    player.delegate = self
                    player.enableRate = true
                    player.isMeteringEnabled = true
                    self.lastLocalSeek = nil
                    self.configure(player, from: current)
                    player.currentTime = min(max(0, current.pos), player.duration)
                    player.prepareToPlay()
                    self.meter.begin(id: expectedID, duration: player.duration)
                    if !current.paused { player.play() }
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

        // Who owns the clock. For runtime-file audio this device is the player,
        // and the runtime's `pos` is an echo of the progress intents we send it
        // -- its own ticker deliberately declines to estimate while a live
        // client is playing. So a snapshot that disagrees with us is normally
        // just stale, and after a local seek it is guaranteed to be: the Mac
        // cannot know about the new position until our progress lands. Snapping
        // to it during that window is exactly how a scrub gets yanked back.
        //
        // The grace window ends the moment the Mac agrees with us, and expires
        // on its own after 3 s so a dropped intent cannot leave the two clocks
        // permanently divorced.
        if let seekedAt = lastLocalSeek {
            if abs(player.currentTime - snapshot.pos) <= 2 || Date().timeIntervalSince(seekedAt) > 3 {
                lastLocalSeek = nil
            }
        } else if abs(player.currentTime - snapshot.pos) > 2 {
            player.currentTime = snapshot.pos
            meter.moved(to: snapshot.pos)
        }
    }

    private func configure(_ player: AVAudioPlayer, from snapshot: DeckSnapshot) {
        player.rate = Float(DeckPlaybackSpeeds.value(at: snapshot.speedIx))
        player.volume = Float(min(1, max(0, snapshot.vol)))
        // Joining a stream the Mac already started. Skipped after a local seek
        // to zero, which would otherwise look identical to "never started".
        if player.currentTime == 0, snapshot.pos > 0, lastLocalSeek == nil {
            player.currentTime = snapshot.pos
        }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    /// One timer, two jobs. Metering runs at 20 Hz because that is what a
    /// readable speech envelope costs; the Mac still hears from us twice a
    /// second, which is all its snapshot rate can use.
    private func startProgressTimer() {
        progressTimer?.invalidate()
        meterTick = 0
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            guard let self, let player = self.audioPlayer, let id = self.audioPlayingID else { return }
            guard player.isPlaying else { return }
            player.updateMeters()
            self.meter.ingest(power: player.peakPower(forChannel: 0),
                              position: player.currentTime,
                              duration: player.duration)
            self.meterTick &+= 1
            if self.meterTick % 10 == 0 {
                self.sendIntent("playback.progress", ["id": id, "pos": player.currentTime, "dur": player.duration])
            }
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
        lastLocalSeek = nil
        meter.clear()
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        guard let id = audioPlayingID else { return }
        progressTimer?.invalidate()
        progressTimer = nil
        audioPlayer = nil
        audioPlayingID = nil
        lastLocalSeek = nil
        meter.clear()
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
