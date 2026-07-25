import Foundation
import VoxCore
import VoxEngine

actor VoxListeningService {
    static let modelID = "parakeet:v3"

    private let recorder = MicrophoneFileRecorder()
    private let engine = EngineManager()
    private var warmupTask: Task<Void, Error>?

    func warmUp() async throws {
        _ = try await engine.preload(modelId: Self.modelID) { _ in }
    }

    /// Opens the microphone first, then warms the local model in parallel with
    /// the utterance. Stopping waits for warmup before transcription.
    func startRecordingAndWarm() async throws -> AudioInputDeviceInfo {
        let recording = try await recorder.start(filePrefix: "speakeasy-listen")
        try? FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: recording.url.path
        )
        if warmupTask == nil {
            warmupTask = Task { [engine] in
                _ = try await engine.preload(modelId: Self.modelID) { _ in }
            }
        }
        return recording.inputDevice
    }

    func stopAndTranscribe() async throws -> String {
        let url = try await recorder.stop()
        defer { try? FileManager.default.removeItem(at: url) }
        if let warmupTask {
            defer { self.warmupTask = nil }
            try await warmupTask.value
        }
        return try await transcribe(url: url)
    }

    func transcribeFixture(url: URL) async throws -> String {
        try await transcribe(url: url)
    }

    func cancelRecording() async {
        // Keep an in-flight or completed warmup available for the next
        // utterance. Repeated cancel/re-engage gestures must not fan out model
        // loads that the underlying Core ML runtime cannot cancel promptly.
        await recorder.cancel()
    }

    private func transcribe(url: URL) async throws -> String {
        let output = try await engine.transcribe(url: url, modelId: Self.modelID)
        return output.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
