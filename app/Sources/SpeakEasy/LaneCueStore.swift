import CryptoKit
import Foundation

actor LaneCueStore {
    private let narrator = ConfiguredResponseNarrator()
    private let directory: URL

    init(fileManager: FileManager = .default) {
        let base = (try? fileManager.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? fileManager.temporaryDirectory
        directory = base.appendingPathComponent("SpeakEasy/LaneCues", isDirectory: true)
    }

    func cachedCue(
        for lane: VoiceLane,
        configuration: SpeechNarrationConfiguration
    ) -> URL? {
        let prefix = cachePrefix(for: lane, configuration: configuration)
        return try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ).first { $0.lastPathComponent.hasPrefix(prefix + ".") }
    }

    @discardableResult
    func prepare(
        for lane: VoiceLane,
        configuration: SpeechNarrationConfiguration
    ) async throws -> URL {
        if let cached = cachedCue(for: lane, configuration: configuration) { return cached }
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )

        // The HUD already names the lane. Speaking only the compact task title
        // keeps the select-to-microphone interval short and useful.
        let cue = "\(lane.spokenTitle)."
        let temporary = try await narrator.render(text: cue, configuration: configuration)
        defer { try? FileManager.default.removeItem(at: temporary) }

        let destination = directory
            .appendingPathComponent(cachePrefix(for: lane, configuration: configuration))
            .appendingPathExtension(temporary.pathExtension.isEmpty ? "audio" : temporary.pathExtension)
        if !FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.copyItem(at: temporary, to: destination)
            try FileManager.default.setAttributes(
                [.posixPermissions: 0o600],
                ofItemAtPath: destination.path
            )
        }
        return destination
    }

    func play(_ url: URL, volume: Double) async throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/afplay")
        process.arguments = [
            "-v", String(max(0, min(volume, 1))),
            "-r", "1.12",
            "-q", "1",
            url.path,
        ]
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw LaneCueError.playbackFailed(process.terminationStatus)
        }
    }

    func removeCue(for lane: VoiceLane) {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ) else { return }
        let lanePrefix = "lane-\(lane.number)-"
        for file in files where file.lastPathComponent.hasPrefix(lanePrefix) {
            try? FileManager.default.removeItem(at: file)
        }
    }

    private func cachePrefix(
        for lane: VoiceLane,
        configuration: SpeechNarrationConfiguration
    ) -> String {
        let identity = [
            "cue-v2",
            lane.task.id,
            lane.task.title,
            configuration.provider,
            configuration.voice,
            configuration.model ?? "",
            String(configuration.rate),
        ].joined(separator: "\u{1f}")
        let digest = SHA256.hash(data: Data(identity.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return "lane-\(lane.number)-\(digest.prefix(16))"
    }
}

enum LaneCueError: LocalizedError {
    case playbackFailed(Int32)

    var errorDescription: String? {
        switch self {
        case .playbackFailed(let status):
            return "The lane announcement could not play (status \(status))."
        }
    }
}
