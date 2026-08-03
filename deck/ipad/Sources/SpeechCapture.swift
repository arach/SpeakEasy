import AVFAudio
import OSLog

/// Native hold-to-speak recorder.
///
/// Recognition deliberately does not happen on the iPad. Every utterance is
/// captured once as PCM WAV and sent to the paired Mac's local Parakeet model.
/// This keeps one transcription engine authoritative and avoids the latency,
/// permissions, and result drift of running Apple Speech first.
final class SpeechCapture: NSObject {
    var onStarted: () -> Void = {}
    var onRecordingReady: (URL) -> Void = { _ in }
    var onFailure: (String) -> Void = { _ in }
    var onLevel: (Float) -> Void = { _ in }

    private enum State {
        case idle
        case authorizing(UInt64)
        case capturing(UInt64)

        var token: UInt64? {
            switch self {
            case .idle: nil
            case .authorizing(let token), .capturing(let token): token
            }
        }
    }

    private let engine = AVAudioEngine()
    private let logger = Logger(subsystem: "dev.arach.speakeasy.deck", category: "speech-capture")
    private var recordingFile: AVAudioFile?
    private var recordingURL: URL?
    private var state: State = .idle
    private var nextToken: UInt64 = 0
    private var tapInstalled = false

    func start() {
        onMain { [weak self] in self?.startOnMain() }
    }

    private func startOnMain() {
        guard case .idle = state else { return }
        nextToken &+= 1
        let token = nextToken
        state = .authorizing(token)
        logger.info("Capture \(token) requesting microphone access for Parakeet")

        AVAudioApplication.requestRecordPermission { [weak self] granted in
            self?.onMain {
                guard let self, self.state.token == token else { return }
                guard granted else {
                    self.fail(token: token, message: "MICROPHONE PERMISSION REQUIRED")
                    return
                }
                self.begin(token: token)
            }
        }
    }

    private func begin(token: UInt64) {
        guard state.token == token, case .authorizing = state else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            logger.error("Capture \(token) could not activate audio session: \(error.localizedDescription, privacy: .public)")
            fail(token: token, message: "MICROPHONE START FAILED")
            return
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard session.isInputAvailable, Self.isUsable(format), !tapInstalled else {
            fail(token: token, message: "MICROPHONE INPUT UNAVAILABLE")
            return
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-parakeet-\(UUID().uuidString)")
            .appendingPathExtension("wav")
        let file: AVAudioFile
        do {
            file = try AVAudioFile(forWriting: url, settings: format.settings)
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            recordingFile = file
            recordingURL = url
        } catch {
            logger.error("Capture \(token) could not create its recording: \(error.localizedDescription, privacy: .public)")
            fail(token: token, message: "MICROPHONE RECORDING FAILED")
            return
        }

        var lastMeterUpdate = 0.0
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            do {
                try file.write(from: buffer)
            } catch {
                self?.logger.error("Capture \(token) could not write audio: \(error.localizedDescription, privacy: .public)")
            }

            let now = ProcessInfo.processInfo.systemUptime
            guard now - lastMeterUpdate >= 1.0 / 30.0 else { return }
            lastMeterUpdate = now
            self?.onLevel(Self.normalizedLevel(in: buffer))
        }
        tapInstalled = true
        engine.prepare()
        do {
            try engine.start()
        } catch {
            logger.error("Capture \(token) audio engine failed: \(error.localizedDescription, privacy: .public)")
            fail(token: token, message: "MICROPHONE START FAILED")
            return
        }

        state = .capturing(token)
        logger.info("Capture \(token) started at \(format.sampleRate, privacy: .public) Hz with \(format.channelCount) channel(s)")
        onStarted()
    }

    func finish() {
        onMain { [weak self] in
            guard let self else { return }
            switch self.state {
            case .authorizing(let token):
                self.fail(token: token, message: "MICROPHONE STILL STARTING · HOLD AGAIN")
            case .capturing(let token):
                guard let url = self.recordingURL else {
                    self.fail(token: token, message: "MICROPHONE RECORDING FAILED")
                    return
                }
                self.teardown(token: token, preserveRecording: true)
                let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue ?? 0
                guard bytes > 44 else {
                    try? FileManager.default.removeItem(at: url)
                    self.onFailure("NO SPEECH · TRY AGAIN")
                    return
                }
                self.logger.notice("Capture \(token) recorded \(bytes) bytes for local Parakeet")
                self.onRecordingReady(url)
            case .idle:
                break
            }
        }
    }

    func abort() {
        onMain { [weak self] in
            guard let self, let token = self.state.token else { return }
            self.teardown(token: token, preserveRecording: false)
        }
    }

    private func fail(token: UInt64, message: String) {
        guard state.token == token else { return }
        logger.error("Capture \(token) ended: \(message, privacy: .public)")
        teardown(token: token, preserveRecording: false)
        onFailure(message)
    }

    private func teardown(token: UInt64, preserveRecording: Bool) {
        guard state.token == token else { return }
        state = .idle
        if engine.isRunning { engine.stop() }
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        recordingFile = nil
        engine.reset()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        onLevel(0)

        let oldRecordingURL = recordingURL
        recordingURL = nil
        if !preserveRecording, let oldRecordingURL {
            try? FileManager.default.removeItem(at: oldRecordingURL)
        }
    }

    private static func isUsable(_ format: AVAudioFormat) -> Bool {
        format.sampleRate.isFinite && format.sampleRate > 0 && format.channelCount > 0
    }

    /// Convert the microphone's RMS energy into a perceptual 0...1 meter.
    /// Roughly -55 dB is silence and -10 dB is full scale for this surface.
    private static func normalizedLevel(in buffer: AVAudioPCMBuffer) -> Float {
        guard let channels = buffer.floatChannelData,
              buffer.frameLength > 0,
              buffer.format.channelCount > 0 else { return 0 }

        let frameCount = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        var sum: Float = 0
        for channel in 0..<channelCount {
            let samples = channels[channel]
            for frame in 0..<frameCount {
                let sample = samples[frame]
                sum += sample * sample
            }
        }

        let rms = sqrt(sum / Float(frameCount * channelCount))
        let decibels = 20 * log10(max(rms, 0.000_01))
        let linear = min(1, max(0, (decibels + 55) / 45))
        return pow(linear, 0.72)
    }

    private func onMain(_ operation: @escaping () -> Void) {
        if Thread.isMainThread {
            operation()
        } else {
            DispatchQueue.main.async(execute: operation)
        }
    }
}
