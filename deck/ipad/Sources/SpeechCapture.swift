import Speech
import AVFAudio
import OSLog

/// Native hold-to-speak capture. Apple Speech supplies low-latency partials
/// when it is healthy; every utterance is also recorded so the paired Mac can
/// fall back to its local Parakeet model without reopening the microphone.
final class SpeechCapture: NSObject {
    /// (text, isFinal, user-facing failure)
    var onTranscript: (String, Bool, String?) -> Void = { _, _, _ in }
    /// (private PCM WAV, reason Apple Speech was skipped/failed)
    var onFallback: (URL, String) -> Void = { _, _ in }

    private enum State {
        case idle
        case authorizing(UInt64)
        case capturing(UInt64)
        case finishing(UInt64)

        var token: UInt64? {
            switch self {
            case .idle: nil
            case .authorizing(let token), .capturing(let token), .finishing(let token): token
            }
        }
    }

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private let logger = Logger(subsystem: "dev.arach.speakeasy.deck", category: "speech-capture")
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recordingFile: AVAudioFile?
    private var recordingURL: URL?
    private var state: State = .idle
    private var nextToken: UInt64 = 0
    private var tapInstalled = false
    private var appleRecognitionEnabled = false
    private var recognitionFailure: String?
    private var latestText = ""
    private var finishBackstop: DispatchWorkItem?

    func start() {
        onMain { [weak self] in self?.startOnMain() }
    }

    private func startOnMain() {
        guard case .idle = state else { return }
        nextToken &+= 1
        let token = nextToken
        state = .authorizing(token)
        latestText = ""
        recognitionFailure = nil
        appleRecognitionEnabled = false
        logger.info("Capture \(token) requesting microphone access")

#if targetEnvironment(simulator)
        // iOS Simulator currently installs a device-specialized Apple Speech
        // asset that its local recognizer cannot load. Capture real audio and
        // go straight to Parakeet instead of failing after the mic opens.
        requestMicrophone(token: token)
#else
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            self?.onMain {
                guard let self, self.state.token == token else { return }
                self.appleRecognitionEnabled = status == .authorized && self.recognizer?.isAvailable == true
                if !self.appleRecognitionEnabled {
                    self.logger.notice("Capture \(token) will use local Parakeet because Apple Speech is unavailable")
                }
                self.requestMicrophone(token: token)
            }
        }
#endif
    }

    private func requestMicrophone(token: UInt64) {
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            self?.onMain {
                guard let self, self.state.token == token else { return }
                guard granted else {
                    self.complete(
                        token: token,
                        text: "",
                        failure: "MICROPHONE PERMISSION REQUIRED",
                        cancelTask: true
                    )
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
            complete(token: token, text: "", failure: "MICROPHONE START FAILED", cancelTask: true)
            return
        }

        let input = engine.inputNode
        let hardwareFormat = input.inputFormat(forBus: 0)
        let tapFormat = input.outputFormat(forBus: 0)
        guard session.isInputAvailable,
              Self.isUsable(hardwareFormat),
              Self.isUsable(tapFormat),
              !tapInstalled else {
            logger.error(
                "Capture \(token) has no usable input (available=\(session.isInputAvailable), hardware=\(hardwareFormat.sampleRate, privacy: .public)/\(hardwareFormat.channelCount), tap=\(tapFormat.sampleRate, privacy: .public)/\(tapFormat.channelCount), tapInstalled=\(self.tapInstalled))"
            )
            complete(token: token, text: "", failure: "MICROPHONE INPUT UNAVAILABLE", cancelTask: true)
            return
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-deck-\(UUID().uuidString)")
            .appendingPathExtension("wav")
        let file: AVAudioFile
        do {
            file = try AVAudioFile(forWriting: url, settings: tapFormat.settings)
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            recordingFile = file
            recordingURL = url
        } catch {
            logger.error("Capture \(token) could not create its recording: \(error.localizedDescription, privacy: .public)")
            complete(token: token, text: "", failure: "MICROPHONE RECORDING FAILED", cancelTask: true)
            return
        }

        if appleRecognitionEnabled {
            let speechRequest = SFSpeechAudioBufferRecognitionRequest()
            speechRequest.shouldReportPartialResults = true
            request = speechRequest
        }

        input.installTap(onBus: 0, bufferSize: 1024, format: tapFormat) { [weak self] buffer, _ in
            do {
                try file.write(from: buffer)
            } catch {
                self?.logger.error("Capture \(token) could not write audio: \(error.localizedDescription, privacy: .public)")
            }
            self?.request?.append(buffer)
        }
        tapInstalled = true
        engine.prepare()
        do {
            try engine.start()
        } catch {
            logger.error("Capture \(token) audio engine failed: \(error.localizedDescription, privacy: .public)")
            complete(token: token, text: "", failure: "MICROPHONE START FAILED", cancelTask: true)
            return
        }

        state = .capturing(token)
        logger.info("Capture \(token) started at \(tapFormat.sampleRate, privacy: .public) Hz with \(tapFormat.channelCount) channel(s)")

        if let recognizer, let request {
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                self?.onMain {
                    guard let self, self.state.token == token else { return }
                    if let result {
                        let text = result.bestTranscription.formattedString
                        self.latestText = text
                        if result.isFinal {
                            self.complete(token: token, text: text)
                            return
                        }
                        self.onTranscript(text, false, nil)
                    }
                    if let error {
                        self.logger.error("Capture \(token) Apple Speech failed: \(error.localizedDescription, privacy: .public)")
                        self.recognitionFailure = "APPLE SPEECH FAILED · USING PARAKEET"
                        self.request?.endAudio()
                        self.request = nil
                    }
                }
            }
        }
    }

    func finish() {
        onMain { [weak self] in
            guard let self else { return }
            switch self.state {
            case .authorizing(let token):
                self.complete(token: token, text: "", failure: "MICROPHONE STILL STARTING · HOLD AGAIN", cancelTask: true)
            case .capturing(let token):
                self.state = .finishing(token)
                self.stopAudioInput()
                self.request?.endAudio()

                if self.task == nil || self.recognitionFailure != nil {
                    self.complete(
                        token: token,
                        text: self.latestText,
                        failure: self.recognitionFailure ?? "TRANSCRIBING LOCALLY",
                        cancelTask: true
                    )
                    return
                }

                self.finishBackstop?.cancel()
                let work = DispatchWorkItem { [weak self] in
                    guard let self, self.state.token == token else { return }
                    self.complete(
                        token: token,
                        text: self.latestText,
                        failure: self.latestText.isEmpty ? "APPLE SPEECH TIMED OUT · USING PARAKEET" : nil,
                        cancelTask: true
                    )
                }
                self.finishBackstop = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: work)
            case .finishing, .idle:
                break
            }
        }
    }

    func abort() {
        onMain { [weak self] in
            guard let self, let token = self.state.token else { return }
            self.teardown(token: token, cancelTask: true, preserveRecording: false)
        }
    }

    private func complete(
        token: UInt64,
        text: String,
        failure: String? = nil,
        cancelTask: Bool = false
    ) {
        guard state.token == token else { return }
        let cleanedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let shouldFallback = recordingURL != nil && (failure != nil || cleanedText.isEmpty)
        let fallbackURL = shouldFallback ? recordingURL : nil
        teardown(token: token, cancelTask: cancelTask, preserveRecording: shouldFallback)

        if let fallbackURL {
            logger.notice("Capture \(token) recorded locally; sending it to Parakeet")
            onFallback(fallbackURL, failure ?? "TRANSCRIBING LOCALLY")
        } else {
            if let failure {
                logger.error("Capture \(token) ended: \(failure, privacy: .public)")
            } else {
                logger.info("Capture \(token) ended with \(cleanedText.count) transcript characters")
            }
            onTranscript(cleanedText, true, failure)
        }
    }

    private func stopAudioInput() {
        if engine.isRunning { engine.stop() }
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        recordingFile = nil
    }

    private func teardown(token: UInt64, cancelTask: Bool, preserveRecording: Bool) {
        guard state.token == token else { return }
        state = .idle
        finishBackstop?.cancel()
        finishBackstop = nil
        latestText = ""
        recognitionFailure = nil
        appleRecognitionEnabled = false

        let oldTask = task
        task = nil
        request = nil
        if cancelTask { oldTask?.cancel() }

        stopAudioInput()
        engine.reset()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        let oldRecordingURL = recordingURL
        recordingURL = nil
        if !preserveRecording, let oldRecordingURL {
            try? FileManager.default.removeItem(at: oldRecordingURL)
        }
    }

    private static func isUsable(_ format: AVAudioFormat) -> Bool {
        format.sampleRate.isFinite && format.sampleRate > 0 && format.channelCount > 0
    }

    private func onMain(_ operation: @escaping () -> Void) {
        if Thread.isMainThread {
            operation()
        } else {
            DispatchQueue.main.async(execute: operation)
        }
    }
}
