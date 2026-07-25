import AVFoundation
import Foundation

@MainActor
final class PlaybackEngine: NSObject, ObservableObject, AVAudioPlayerDelegate {
    static let shared = PlaybackEngine()

    @Published private(set) var state: PlaybackState = .idle
    @Published private(set) var currentItem: PlaybackItem?
    @Published private(set) var queue: [PlaybackItem] = []
    @Published private(set) var currentTime: TimeInterval = 0
    @Published private(set) var duration: TimeInterval = 0
    @Published private(set) var audioLevel: Float = 0
    @Published private(set) var lastError: String?
    @Published var autoplayEnabled = true
    @Published private(set) var volume: Float = 0.8
    @Published private(set) var playbackRate: Float = 1

    private var player: AVAudioPlayer?
    private var progressTimer: Timer?

    private override init() {
        super.init()
    }

    deinit {
        progressTimer?.invalidate()
    }

    func enqueue(
        _ item: PlaybackItem,
        priority: QueuePriority = .normal,
        interrupt: Bool = false,
        autoplay: Bool? = nil
    ) throws {
        guard item.audioPath.hasPrefix("/") else {
            throw PlayerEngineError.audioPathMustBeAbsolute
        }
        guard FileManager.default.fileExists(atPath: item.audioPath) else {
            throw PlayerEngineError.audioFileMissing(item.audioPath)
        }

        if interrupt {
            stopCurrent(resetPosition: true)
            queue.insert(item, at: 0)
        } else if priority == .high {
            queue.insert(item, at: 0)
        } else {
            queue.append(item)
        }

        if (autoplay ?? autoplayEnabled) && currentItem == nil {
            try playNext()
        }
    }

    func pause() {
        guard let player, player.isPlaying else { return }
        player.pause()
        state = .paused
        refreshProgress()
    }

    func resume() throws {
        if let player, currentItem != nil {
            player.play()
            state = .playing
            startProgressTimer()
            return
        }
        try playNext()
    }

    func togglePlayback() throws {
        if state == .playing {
            pause()
        } else {
            try resume()
        }
    }

    func stop() {
        stopCurrent(resetPosition: true)
    }

    func skip() throws {
        stopCurrent(resetPosition: true)
        try playNext()
    }

    func clearQueue() {
        queue.removeAll()
    }

    func removeQueueItem(id: UUID) {
        queue.removeAll { $0.id == id }
    }

    func seek(to position: TimeInterval) {
        guard let player else { return }
        player.currentTime = min(max(position, 0), player.duration)
        refreshProgress()
    }

    func setVolume(_ newVolume: Float) {
        volume = min(max(newVolume, 0), 1)
        player?.volume = volume
    }

    func setPlaybackRate(_ newRate: Float) {
        playbackRate = min(max(newRate, 0.5), 2)
        player?.rate = playbackRate
    }

    func snapshot() -> PlayerSnapshot {
        PlayerSnapshot(
            state: state,
            currentItem: currentItem,
            queue: queue,
            currentTime: currentTime,
            duration: duration,
            volume: volume,
            playbackRate: playbackRate,
            autoplayEnabled: autoplayEnabled,
            audioLevel: audioLevel
        )
    }

    func handle(_ request: PlayerCommandRequest) -> PlayerCommandResponse {
        guard request.protocolVersion == playerProtocolVersion else {
            return response(
                to: request,
                error: "unsupported_protocol_version:\(request.protocolVersion)"
            )
        }

        do {
            switch request.command {
            case .enqueue:
                guard let item = request.arguments?.item else {
                    throw PlayerEngineError.missingArgument("item")
                }
                try enqueue(
                    item,
                    priority: request.arguments?.priority ?? .normal,
                    interrupt: request.arguments?.interrupt ?? false,
                    autoplay: request.arguments?.autoplay
                )
            case .pause:
                pause()
            case .resume:
                try resume()
            case .togglePlayback:
                try togglePlayback()
            case .stop:
                stop()
            case .skip:
                try skip()
            case .seek:
                guard let position = request.arguments?.positionSeconds else {
                    throw PlayerEngineError.missingArgument("positionSeconds")
                }
                seek(to: position)
            case .setVolume:
                guard let volume = request.arguments?.volume else {
                    throw PlayerEngineError.missingArgument("volume")
                }
                setVolume(volume)
            case .setPlaybackRate:
                guard let rate = request.arguments?.playbackRate else {
                    throw PlayerEngineError.missingArgument("playbackRate")
                }
                setPlaybackRate(rate)
            case .removeQueueItem:
                guard let itemId = request.arguments?.itemId else {
                    throw PlayerEngineError.missingArgument("itemId")
                }
                removeQueueItem(id: itemId)
            case .clearQueue:
                clearQueue()
            case .status:
                break
            }
            return response(to: request)
        } catch {
            lastError = error.localizedDescription
            return response(to: request, error: error.localizedDescription)
        }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.finishCurrentItem()
            if self.autoplayEnabled {
                do {
                    try self.playNext()
                } catch {
                    self.state = .failed
                    self.lastError = error.localizedDescription
                }
            }
        }
    }

    private func playNext() throws {
        guard !queue.isEmpty else {
            if currentItem == nil {
                state = .idle
            }
            return
        }

        let item = queue.removeFirst()
        state = .loading

        do {
            let nextPlayer = try AVAudioPlayer(contentsOf: URL(fileURLWithPath: item.audioPath))
            nextPlayer.delegate = self
            nextPlayer.enableRate = true
            nextPlayer.volume = volume
            nextPlayer.rate = playbackRate
            nextPlayer.isMeteringEnabled = true
            nextPlayer.prepareToPlay()

            player = nextPlayer
            currentItem = item
            currentTime = 0
            duration = nextPlayer.duration
            audioLevel = 0
            lastError = nil
            nextPlayer.play()
            state = .playing
            HUDWindowManager.shared.showPlayback(item)
            startProgressTimer()
        } catch {
            player = nil
            currentItem = nil
            state = .failed
            throw PlayerEngineError.couldNotOpenAudio(error.localizedDescription)
        }
    }

    private func stopCurrent(resetPosition: Bool) {
        player?.stop()
        if resetPosition {
            player?.currentTime = 0
        }
        finishCurrentItem()
    }

    private func finishCurrentItem() {
        let finishedItem = currentItem
        HUDWindowManager.shared.playbackDidFinish()
        progressTimer?.invalidate()
        progressTimer = nil
        player = nil
        currentItem = nil
        currentTime = 0
        duration = 0
        audioLevel = 0
        state = .idle
        if finishedItem?.cleanupAfterPlayback == true {
            try? FileManager.default.removeItem(atPath: finishedItem?.audioPath ?? "")
        }
    }

    private func startProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = Timer(timeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.refreshProgress()
            }
        }
        if let progressTimer {
            RunLoop.main.add(progressTimer, forMode: .common)
        }
    }

    private func refreshProgress() {
        guard let player else { return }
        currentTime = player.currentTime
        duration = player.duration
        player.updateMeters()
        let averagePower = player.averagePower(forChannel: 0)
        let normalized = pow(10, averagePower / 20)
        audioLevel = max(0, min(1, normalized))
        HUDWindowManager.shared.updatePlayback(
            audioLevel: audioLevel,
            currentTime: currentTime,
            duration: duration
        )
    }

    private func response(to request: PlayerCommandRequest, error: String? = nil) -> PlayerCommandResponse {
        PlayerCommandResponse(
            protocolVersion: playerProtocolVersion,
            requestId: request.requestId,
            ok: error == nil,
            snapshot: snapshot(),
            error: error
        )
    }
}

enum PlayerEngineError: LocalizedError {
    case audioPathMustBeAbsolute
    case audioFileMissing(String)
    case couldNotOpenAudio(String)
    case missingArgument(String)

    var errorDescription: String? {
        switch self {
        case .audioPathMustBeAbsolute:
            return "audio_path_must_be_absolute"
        case .audioFileMissing(let path):
            return "audio_file_missing:\(path)"
        case .couldNotOpenAudio(let detail):
            return "could_not_open_audio:\(detail)"
        case .missingArgument(let name):
            return "missing_argument:\(name)"
        }
    }
}
