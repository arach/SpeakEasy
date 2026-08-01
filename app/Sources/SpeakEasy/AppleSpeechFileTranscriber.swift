import AppKit
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
            // Background lane hotkeys should never reveal Codex. The one-time
            // system consent sheet is the exception: macOS may defer it for an
            // inactive LSUIElement app, so briefly activate SpeakEasy and then
            // return the user to whichever app they were working in.
            let consent = await presentSystemConsentPreflight()
            guard consent.shouldRequest else {
                await restoreAfterSystemConsent(consent.previousApplication)
                return false
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
            await restoreAfterSystemConsent(consent.previousApplication)
            return authorized
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    @MainActor
    private func presentSystemConsentPreflight() -> (
        shouldRequest: Bool,
        previousApplication: NSRunningApplication?
    ) {
        let current = NSWorkspace.shared.frontmostApplication
        let previous = current?.bundleIdentifier == Bundle.main.bundleIdentifier ? nil : current

        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "Enable Speech Recognition?"
        alert.informativeText = "SpeakEasy uses Apple Speech for an immediate first voice turn while its on-device Parakeet model warms. Audio is captured only after your listening hotkey."
        alert.addButton(withTitle: "Continue")
        alert.addButton(withTitle: "Not Now")

        NSApplication.shared.activate(ignoringOtherApps: true)
        let response = alert.runModal()
        return (response == .alertFirstButtonReturn, previous)
    }

    @MainActor
    private func restoreAfterSystemConsent(_ application: NSRunningApplication?) {
        application?.activate(options: [])
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
