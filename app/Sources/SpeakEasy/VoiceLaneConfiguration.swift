import Foundation

/// The portable, user-editable definition of SpeakEasy's voice lanes.
///
/// Stored at `~/Library/Application Support/SpeakEasy/lanes.json` so the menu
/// bar app, a future lane editor, and companion/remote clients can share one
/// stable contract without depending on UserDefaults implementation details.
struct VoiceLaneConfiguration: Codable, Equatable, Sendable {
    static let currentSchemaVersion = 1

    let schemaVersion: Int
    var activeLane: Int?
    var lanes: [VoiceLane]

    init(
        schemaVersion: Int = Self.currentSchemaVersion,
        activeLane: Int? = nil,
        lanes: [VoiceLane] = []
    ) {
        self.schemaVersion = schemaVersion
        self.activeLane = activeLane
        self.lanes = lanes
    }

    func normalized(validNumbers: ClosedRange<Int>) -> Self {
        var lanesByNumber: [Int: VoiceLane] = [:]
        for lane in lanes where validNumbers.contains(lane.number) {
            lanesByNumber[lane.number] = lane
        }
        let normalizedLanes = lanesByNumber.values.sorted { $0.number < $1.number }
        let normalizedActiveLane = activeLane.flatMap { number in
            normalizedLanes.contains(where: { $0.number == number }) ? number : nil
        }
        return Self(
            schemaVersion: Self.currentSchemaVersion,
            activeLane: normalizedActiveLane,
            lanes: normalizedLanes
        )
    }

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case activeLane
        case lanes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion)
            ?? Self.currentSchemaVersion
        activeLane = try container.decodeIfPresent(Int.self, forKey: .activeLane)
        lanes = try container.decodeIfPresent([VoiceLane].self, forKey: .lanes) ?? []
    }
}

struct VoiceLaneConfigurationStore {
    let fileURL: URL

    init(fileURL: URL = Self.defaultFileURL()) {
        self.fileURL = fileURL
    }

    func load(validNumbers: ClosedRange<Int>) throws -> VoiceLaneConfiguration? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        let data = try Data(contentsOf: fileURL)
        let configuration = try JSONDecoder().decode(VoiceLaneConfiguration.self, from: data)
        guard configuration.schemaVersion <= VoiceLaneConfiguration.currentSchemaVersion else {
            throw VoiceLaneConfigurationError.unsupportedSchema(configuration.schemaVersion)
        }
        return configuration.normalized(validNumbers: validNumbers)
    }

    func save(_ configuration: VoiceLaneConfiguration, validNumbers: ClosedRange<Int>) throws {
        let normalized = configuration.normalized(validNumbers: validNumbers)
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        var data = try encoder.encode(normalized)
        data.append(0x0A)
        try data.write(to: fileURL, options: .atomic)
    }

    static func defaultFileURL(fileManager: FileManager = .default) -> URL {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support")
        return base
            .appendingPathComponent("SpeakEasy", isDirectory: true)
            .appendingPathComponent("lanes.json", isDirectory: false)
    }
}

enum VoiceLaneConfigurationError: LocalizedError, Equatable {
    case unsupportedSchema(Int)

    var errorDescription: String? {
        switch self {
        case .unsupportedSchema(let version):
            return "Lane configuration schema \(version) is newer than this version of SpeakEasy supports."
        }
    }
}
