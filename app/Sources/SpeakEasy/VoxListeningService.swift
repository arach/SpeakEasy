import Foundation
import VoxCore
import VoxEngine

enum ListeningTranscriptionEngine: String, Equatable, Sendable {
    case appleSpeech
    case parakeet
}

struct ListeningTranscriptionResult: Equatable, Sendable {
    let text: String
    let engine: ListeningTranscriptionEngine
}

enum VoxListeningServiceError: LocalizedError {
    case selectedInputUnavailable(String)

    var errorDescription: String? {
        switch self {
        case .selectedInputUnavailable(let name):
            "Your dedicated microphone “\(name)” is unavailable. Reconnect it or choose another input."
        }
    }
}

actor VoxListeningService {
    static let shared = VoxListeningService()
    static let modelID = "parakeet:v3"

    private enum ParakeetState {
        case cold
        case warming
        case ready
    }

    private let recorder = MicrophoneFileRecorder()
    private let engine = EngineManager()
    private let appleSpeech = AppleSpeechFileTranscriber()
    private var parakeetState = ParakeetState.cold
    private var warmupTask: Task<Void, Error>?

    static func preferredEngine(parakeetReady: Bool) -> ListeningTranscriptionEngine {
        parakeetReady ? .parakeet : .appleSpeech
    }

    func warmUp() async throws {
        startWarmupIfNeeded()
        if let warmupTask {
            try await warmupTask.value
        }
    }

    /// Opens the microphone first, then warms the local model in parallel with
    /// the utterance. Apple Speech handles the result until Parakeet is ready.
    func startRecordingAndWarm(
        preferredInputDeviceID: String? = nil,
        preferredInputDeviceName: String? = nil
    ) async throws -> AudioInputDeviceInfo {
        let normalizedID = preferredInputDeviceID?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let normalizedID, !normalizedID.isEmpty,
           !AudioInputDevices.available().contains(where: { $0.id == normalizedID }) {
            throw VoxListeningServiceError.selectedInputUnavailable(
                preferredInputDeviceName ?? "Selected microphone"
            )
        }

        let recording = try await recorder.start(
            preferredInputDeviceID: normalizedID,
            filePrefix: "speakeasy-listen"
        )
        try? FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: recording.url.path
        )
        startWarmupIfNeeded()
        if parakeetState != .ready {
            Task { [appleSpeech] in
                _ = await appleSpeech.requestAuthorizationIfNeeded()
            }
        }
        return recording.inputDevice
    }

    func stopAndTranscribe() async throws -> ListeningTranscriptionResult {
        let url = try await recorder.stop()
        defer { try? FileManager.default.removeItem(at: url) }

        let preferred = Self.preferredEngine(parakeetReady: parakeetState == .ready)
        if preferred == .parakeet {
            do {
                return ListeningTranscriptionResult(
                    text: try await transcribeWithParakeet(url: url),
                    engine: .parakeet
                )
            } catch {
                return ListeningTranscriptionResult(
                    text: try await appleSpeech.transcribe(url: url),
                    engine: .appleSpeech
                )
            }
        }

        do {
            return ListeningTranscriptionResult(
                text: try await appleSpeech.transcribe(url: url),
                engine: .appleSpeech
            )
        } catch {
            // Permission denial or temporary Apple unavailability must not make
            // dictation unusable. In this recovery path only, allow the already
            // running Parakeet warmup to finish and use it for this utterance.
            if parakeetState == .ready {
                return ListeningTranscriptionResult(
                    text: try await transcribeWithParakeet(url: url),
                    engine: .parakeet
                )
            }
            if let warmupTask {
                try await warmupTask.value
                return ListeningTranscriptionResult(
                    text: try await transcribeWithParakeet(url: url),
                    engine: .parakeet
                )
            }
            throw error
        }
    }

    func transcribeFixture(url: URL) async throws -> String {
        try await transcribeWithParakeet(url: url)
    }

    func cancelRecording() async {
        // Keep an in-flight or completed warmup available for the next
        // utterance. Repeated cancel/re-engage gestures must not fan out model
        // loads that the underlying Core ML runtime cannot cancel promptly.
        await recorder.cancel()
    }

    private func startWarmupIfNeeded() {
        guard parakeetState == .cold, warmupTask == nil else { return }
        parakeetState = .warming
        warmupTask = Task { [weak self, engine] in
            do {
                _ = try await engine.preload(modelId: Self.modelID) { _ in }
                await self?.finishWarmup(succeeded: true)
            } catch {
                await self?.finishWarmup(succeeded: false)
                throw error
            }
        }
    }

    private func finishWarmup(succeeded: Bool) {
        parakeetState = succeeded ? .ready : .cold
        warmupTask = nil
    }

    private func transcribeWithParakeet(url: URL) async throws -> String {
        let output = try await engine.transcribe(url: url, modelId: Self.modelID)
        return output.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
