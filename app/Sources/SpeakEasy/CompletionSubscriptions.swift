import Foundation

/// The one announcement channel shipped in the first completion slice. This
/// is deliberately a channel policy, not another voice lane or Codex task.
struct CompletionChannelConfiguration: Codable, Equatable, Sendable {
    static let id = "completions"

    var channelID: String
    var provider: String?
    var voice: String?
    var narrationCue: String?
    var playbackRate: Float
    var volume: Double
    var isMuted: Bool

    init(
        channelID: String = Self.id,
        provider: String? = nil,
        voice: String? = nil,
        narrationCue: String? = nil,
        playbackRate: Float = 1,
        volume: Double = 0.7,
        isMuted: Bool = false
    ) {
        self.channelID = channelID
        self.provider = provider?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.voice = voice?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.narrationCue = narrationCue?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        self.playbackRate = min(max(playbackRate.isFinite ? playbackRate : 1, 0.5), 2)
        self.volume = min(max(volume.isFinite ? volume : 0.7, 0), 1)
        self.isMuted = isMuted
    }

    private enum CodingKeys: String, CodingKey {
        case channelID, provider, voice, narrationCue, playbackRate, volume, isMuted
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            channelID: try container.decodeIfPresent(String.self, forKey: .channelID) ?? Self.id,
            provider: try container.decodeIfPresent(String.self, forKey: .provider),
            voice: try container.decodeIfPresent(String.self, forKey: .voice),
            narrationCue: try container.decodeIfPresent(String.self, forKey: .narrationCue),
            playbackRate: try container.decodeIfPresent(Float.self, forKey: .playbackRate) ?? 1,
            volume: try container.decodeIfPresent(Double.self, forKey: .volume) ?? 0.7,
            isMuted: try container.decodeIfPresent(Bool.self, forKey: .isMuted) ?? false
        )
    }
}

struct CompletionSubscription: Codable, Equatable, Sendable {
    static let currentSchemaVersion = 2

    let task: ListeningTaskLock
    var channelID: String
    var isEnabled: Bool
    var lastObservedTurnID: String?
    var lastEnqueuedTurnID: String?
    var cursorOffset: Int64?
    var rolloutIdentity: String?
    var enqueuedTurnIDs: Set<String>
    var subscribedAt: Date
    var schemaVersion: Int

    init(
        task: ListeningTaskLock,
        channelID: String = CompletionChannelConfiguration.id,
        isEnabled: Bool = true,
        lastObservedTurnID: String? = nil,
        lastEnqueuedTurnID: String? = nil,
        cursorOffset: Int64? = nil,
        rolloutIdentity: String? = nil,
        enqueuedTurnIDs: Set<String> = [],
        subscribedAt: Date = Date(),
        schemaVersion: Int = Self.currentSchemaVersion
    ) {
        self.task = task
        self.channelID = channelID
        self.isEnabled = isEnabled
        self.lastObservedTurnID = lastObservedTurnID
        self.lastEnqueuedTurnID = lastEnqueuedTurnID
        self.cursorOffset = cursorOffset
        self.rolloutIdentity = rolloutIdentity
        self.enqueuedTurnIDs = enqueuedTurnIDs
        self.subscribedAt = subscribedAt
        self.schemaVersion = schemaVersion
    }

    /// The durable dedupe identity is always exact task + exact turn. Never
    /// substitute title, project, path, response text, or recency here.
    func dedupeKey(turnID: String) -> String {
        "\(task.id)::\(turnID)"
    }

    private enum CodingKeys: String, CodingKey {
        case task, channelID, isEnabled, lastObservedTurnID, lastEnqueuedTurnID
        case cursorOffset, rolloutIdentity, enqueuedTurnIDs, subscribedAt, schemaVersion
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let task = try container.decode(ListeningTaskLock.self, forKey: .task)
        let oldLastEnqueued = try container.decodeIfPresent(String.self, forKey: .lastEnqueuedTurnID)
        let legacySet = oldLastEnqueued.map { ["\(task.id)::\($0)"] } ?? []
        self.init(
            task: task,
            channelID: try container.decodeIfPresent(String.self, forKey: .channelID)
                ?? CompletionChannelConfiguration.id,
            isEnabled: try container.decodeIfPresent(Bool.self, forKey: .isEnabled) ?? true,
            lastObservedTurnID: try container.decodeIfPresent(String.self, forKey: .lastObservedTurnID),
            lastEnqueuedTurnID: oldLastEnqueued,
            cursorOffset: try container.decodeIfPresent(Int64.self, forKey: .cursorOffset),
            rolloutIdentity: try container.decodeIfPresent(String.self, forKey: .rolloutIdentity),
            enqueuedTurnIDs: Set(
                (try container.decodeIfPresent([String].self, forKey: .enqueuedTurnIDs) ?? []) + legacySet
            ),
            subscribedAt: try container.decodeIfPresent(Date.self, forKey: .subscribedAt) ?? Date(),
            schemaVersion: try container.decodeIfPresent(Int.self, forKey: .schemaVersion)
                ?? Self.currentSchemaVersion
        )
    }
}

enum CompletionActivityState: String, Codable, Equatable, Sendable {
    case detected
    case muted
    case queued
    case playing
    case announced
    case failed
    case dismissed
    case deduplicated
}

struct CompletionActivity: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    let taskID: String
    let turnID: String
    let response: String
    let completedAt: Date
    let detectedAt: Date
    var state: CompletionActivityState
    var audioPath: String?
    var provider: String?
    var failure: String?
    var cursorOffset: Int64?
    var deduplicatedCount: Int

    init(
        id: UUID = UUID(),
        taskID: String,
        turnID: String,
        response: String,
        completedAt: Date,
        detectedAt: Date = Date(),
        state: CompletionActivityState = .detected,
        audioPath: String? = nil,
        provider: String? = nil,
        failure: String? = nil,
        cursorOffset: Int64? = nil,
        deduplicatedCount: Int = 0
    ) {
        self.id = id
        self.taskID = taskID
        self.turnID = turnID
        self.response = response
        self.completedAt = completedAt
        self.detectedAt = detectedAt
        self.state = state
        self.audioPath = audioPath
        self.provider = provider
        self.failure = failure
        self.cursorOffset = cursorOffset
        self.deduplicatedCount = deduplicatedCount
    }

    var dedupeKey: String { "\(taskID)::\(turnID)" }
}

struct CompletionSubscriptionSnapshot: Codable, Equatable, Sendable {
    static let currentSchemaVersion = 2

    var schemaVersion: Int
    var subscription: CompletionSubscription?
    var channel: CompletionChannelConfiguration
    var activities: [CompletionActivity]

    init(
        schemaVersion: Int = Self.currentSchemaVersion,
        subscription: CompletionSubscription? = nil,
        channel: CompletionChannelConfiguration = .init(),
        activities: [CompletionActivity] = []
    ) {
        self.schemaVersion = schemaVersion
        self.subscription = subscription
        self.channel = channel
        self.activities = activities
    }

    private enum CodingKeys: String, CodingKey {
        case schemaVersion, subscription, channel, activities
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            schemaVersion: try container.decodeIfPresent(Int.self, forKey: .schemaVersion)
                ?? Self.currentSchemaVersion,
            subscription: try container.decodeIfPresent(CompletionSubscription.self, forKey: .subscription),
            channel: try container.decodeIfPresent(CompletionChannelConfiguration.self, forKey: .channel)
                ?? .init(),
            activities: try container.decodeIfPresent([CompletionActivity].self, forKey: .activities) ?? []
        )
    }

    func normalized() -> Self {
        var copy = self
        copy.schemaVersion = Self.currentSchemaVersion
        copy.channel = CompletionChannelConfiguration(
            channelID: CompletionChannelConfiguration.id,
            provider: channel.provider,
            voice: channel.voice,
            narrationCue: channel.narrationCue,
            playbackRate: channel.playbackRate,
            volume: channel.volume,
            isMuted: channel.isMuted
        )
        copy.activities = Array(activities.suffix(100))
        if var subscription = copy.subscription {
            subscription.schemaVersion = CompletionSubscription.currentSchemaVersion
            subscription.channelID = CompletionChannelConfiguration.id
            copy.subscription = subscription
        }
        return copy
    }
}

enum CompletionSubscriptionStoreError: LocalizedError, Equatable {
    case unsupportedSchema(Int)

    var errorDescription: String? {
        switch self {
        case .unsupportedSchema(let version):
            return "SpeakEasy completion subscriptions use an unsupported schema (\(version))."
        }
    }
}

struct CompletionSubscriptionStore: Sendable {
    let fileURL: URL

    init(fileURL: URL = Self.defaultFileURL()) {
        self.fileURL = fileURL
    }

    func load() throws -> CompletionSubscriptionSnapshot {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return .init() }
        let data = try Data(contentsOf: fileURL)
        let snapshot = try JSONDecoder.speakeasy.decode(CompletionSubscriptionSnapshot.self, from: data)
        guard snapshot.schemaVersion <= CompletionSubscriptionSnapshot.currentSchemaVersion else {
            throw CompletionSubscriptionStoreError.unsupportedSchema(snapshot.schemaVersion)
        }
        if let subscription = snapshot.subscription,
           subscription.schemaVersion > CompletionSubscription.currentSchemaVersion {
            throw CompletionSubscriptionStoreError.unsupportedSchema(subscription.schemaVersion)
        }
        return snapshot.normalized()
    }

    func save(_ snapshot: CompletionSubscriptionSnapshot) throws {
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        var data = try JSONEncoder.speakeasy.encode(snapshot.normalized())
        data.append(0x0A)
        try data.write(to: fileURL, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
    }

    static func defaultFileURL(fileManager: FileManager = .default) -> URL {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support")
        return base
            .appendingPathComponent("SpeakEasy", isDirectory: true)
            .appendingPathComponent("completion-subscriptions.json", isDirectory: false)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

private extension JSONEncoder {
    static var speakeasy: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return encoder
    }
}

private extension JSONDecoder {
    static var speakeasy: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
