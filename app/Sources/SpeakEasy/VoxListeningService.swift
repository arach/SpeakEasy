import Foundation
import VoxCore
import VoxEngine

actor VoxListeningService {
    static let modelID = "parakeet:v3"

    private let recorder = MicrophoneFileRecorder()
    private let engine = EngineManager()

    func warmUp() async throws {
        _ = try await engine.preload(modelId: Self.modelID) { _ in }
    }

    func startRecording() async throws -> AudioInputDeviceInfo {
        let recording = try await recorder.start(filePrefix: "speakeasy-listen")
        try? FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: recording.url.path
        )
        return recording.inputDevice
    }

    func stopAndTranscribe() async throws -> String {
        let url = try await recorder.stop()
        defer { try? FileManager.default.removeItem(at: url) }
        return try await transcribe(url: url)
    }

    func transcribeFixture(url: URL) async throws -> String {
        try await transcribe(url: url)
    }

    func cancelRecording() async {
        await recorder.cancel()
    }

    private func transcribe(url: URL) async throws -> String {
        let output = try await engine.transcribe(url: url, modelId: Self.modelID)
        return output.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
