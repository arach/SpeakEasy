import Speech
import AVFAudio

/// Native hold-to-speak engine. Owns the mic while a capture is active and
/// streams partial and final transcripts back through onTranscript.
final class SpeechCapture: NSObject {
    /// (text, isFinal)
    var onTranscript: (String, Bool) -> Void = { _, _ in }

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var running = false

    func start() {
        guard !running else { return }
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            guard let self, status == .authorized else {
                self?.onTranscript("", true) // page surfaces SPEECH ERROR
                return
            }
            AVAudioApplication.requestRecordPermission { granted in
                guard granted else {
                    self.onTranscript("", true)
                    return
                }
                DispatchQueue.main.async { self.begin() }
            }
        }
    }

    private func begin() {
        guard let recognizer, recognizer.isAvailable, !running else { return }
        running = true

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try? session.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        try? engine.start()

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                self.onTranscript(result.bestTranscription.formattedString, result.isFinal)
                if result.isFinal { self.teardown() }
            }
            if error != nil { self.teardown() }
        }
    }

    /// User released the pad — close the audio stream; the final result
    /// arrives through the task callback, with a short teardown backstop.
    func finish() {
        request?.endAudio()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.teardown()
        }
    }

    func abort() {
        task?.cancel()
        teardown()
    }

    private func teardown() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request = nil
        task = nil
        running = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
