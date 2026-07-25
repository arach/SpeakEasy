import Foundation
@preconcurrency import Speech

enum AppleSpeechTranscriptionError: LocalizedError {
    case audioFileMissing
    case permissionDenied
    case recognizerUnavailable
    case alreadyRunning
    case emptyTranscript
    case recognitionFailed(String)

    var errorDescription: String? {
        switch self {
        case .audioFileMissing:
            "The recorded audio file is no longer available."
        case .permissionDenied:
            "Apple Speech recognition permission was not granted."
        case .recognizerUnavailable:
            "Apple Speech recognition is unavailable right now."
        case .alreadyRunning:
            "Apple Speech is already transcribing another utterance."
        case .emptyTranscript:
            "Apple Speech did not detect any words."
        case .recognitionFailed(let message):
            "Apple Speech recognition failed: \(message)"
        }
    }
}

/// File-based Apple Speech fallback used while Vox's Parakeet model warms.
///
/// This mirrors the HudsonKit/Talkie cold-start pattern without coupling the
/// app to HudsonVoice, which is not part of the released HudsonKit XCFramework.
actor AppleSpeechFileTranscriber {
    private let locale: Locale
    private var recognitionTask: SFSpeechRecognitionTask?
    private var continuation: CheckedContinuation<String, Error>?
    private var authorizationTask: Task<Bool, Never>?

    init(locale: Locale = .autoupdatingCurrent) {
        self.locale = locale
    }

    deinit {
        recognitionTask?.cancel()
    }

    func requestAuthorizationIfNeeded() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            return true
        case .notDetermined:
            if let authorizationTask {
                return await authorizationTask.value
            }
            let task = Task {
                await withCheckedContinuation { continuation in
                    SFSpeechRecognizer.requestAuthorization { status in
                        continuation.resume(returning: status == .authorized)
                    }
                }
            }
            authorizationTask = task
            let authorized = await task.value
            authorizationTask = nil
            return authorized
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    func transcribe(url: URL) async throws -> String {
        guard recognitionTask == nil, continuation == nil else {
            throw AppleSpeechTranscriptionError.alreadyRunning
        }
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw AppleSpeechTranscriptionError.audioFileMissing
        }
        guard await requestAuthorizationIfNeeded() else {
            throw AppleSpeechTranscriptionError.permissionDenied
        }
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            throw AppleSpeechTranscriptionError.recognizerUnavailable
        }

        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                    Task {
                        await self?.handle(result: result, error: error)
                    }
                }
            }
        } onCancel: {
            Task { [weak self] in await self?.cancel() }
        }
    }

    private func handle(result: SFSpeechRecognitionResult?, error: Error?) {
        guard continuation != nil else { return }
        if let result, result.isFinal {
            let text = result.bestTranscription.formattedString
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else {
                resume(throwing: AppleSpeechTranscriptionError.emptyTranscript)
                return
            }
            resume(returning: text)
            return
        }
        if let error {
            resume(throwing: AppleSpeechTranscriptionError.recognitionFailed(error.localizedDescription))
        }
    }

    private func cancel() {
        recognitionTask?.cancel()
        resume(throwing: CancellationError(), cancelTask: false)
    }

    private func resume(returning text: String, cancelTask: Bool = true) {
        let continuation = continuation
        reset(cancelTask: cancelTask)
        continuation?.resume(returning: text)
    }

    private func resume(throwing error: Error, cancelTask: Bool = true) {
        let continuation = continuation
        reset(cancelTask: cancelTask)
        continuation?.resume(throwing: error)
    }

    private func reset(cancelTask: Bool) {
        if cancelTask { recognitionTask?.cancel() }
        recognitionTask = nil
        continuation = nil
    }
}
