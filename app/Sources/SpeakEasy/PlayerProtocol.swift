import Foundation

let playerProtocolVersion = 1
let playerSocketPath = "/tmp/speakeasy-player.sock"

enum PlaybackState: String, Codable {
    case idle
    case loading
    case playing
    case paused
    case failed
}

enum QueuePriority: String, Codable {
    case high
    case normal
    case low
}

enum PlaybackChannel: String, Codable {
    case interactive
    case completions
}

enum PlayerCommand: String, Codable {
    case enqueue
    case pause
    case resume
    case togglePlayback
    case stop
    case skip
    case seek
    case setVolume
    case setPlaybackRate
    case removeQueueItem
    case clearQueue
    case status
}

struct PlaybackItem: Codable, Identifiable, Equatable {
    let id: UUID
    let audioPath: String
    let title: String
    let text: String?
    let provider: String?
    let createdAt: String
    let synthesisRateWPM: Int?
    let sourceThreadId: String?
    let cleanupAfterPlayback: Bool?
    let playbackRate: Float?
    /// Optional keeps older CLI/Deck playback items wire-compatible. A nil
    /// channel is treated as interactive playback.
    let channel: PlaybackChannel?
    let completionActivityID: UUID?

    init(
        id: UUID,
        audioPath: String,
        title: String,
        text: String?,
        provider: String?,
        createdAt: String,
        synthesisRateWPM: Int?,
        sourceThreadId: String?,
        cleanupAfterPlayback: Bool? = nil,
        playbackRate: Float? = nil,
        channel: PlaybackChannel? = nil,
        completionActivityID: UUID? = nil
    ) {
        self.id = id
        self.audioPath = audioPath
        self.title = title
        self.text = text
        self.provider = provider
        self.createdAt = createdAt
        self.synthesisRateWPM = synthesisRateWPM
        self.sourceThreadId = sourceThreadId
        self.cleanupAfterPlayback = cleanupAfterPlayback
        self.playbackRate = playbackRate
        self.channel = channel
        self.completionActivityID = completionActivityID
    }

    var effectiveChannel: PlaybackChannel { channel ?? .interactive }
}

struct PlayerCommandArguments: Codable {
    let item: PlaybackItem?
    let priority: QueuePriority?
    let interrupt: Bool?
    let autoplay: Bool?
    let positionSeconds: TimeInterval?
    let volume: Float?
    let playbackRate: Float?
    let itemId: UUID?
}

struct PlayerCommandRequest: Codable {
    let protocolVersion: Int
    let requestId: UUID
    let command: PlayerCommand
    let arguments: PlayerCommandArguments?
}

/// The player socket also carries small local services owned by the native
/// app. A string discriminator lets older playback clients keep using their
/// existing request shape while the Deck asks Parakeet to transcribe a file.
struct IPCCommandEnvelope: Codable {
    let command: String
}

struct TranscriptionCommandRequest: Codable {
    let protocolVersion: Int
    let requestId: UUID
    let command: String
    let audioPath: String
}

struct TranscriptionCommandResponse: Codable {
    let protocolVersion: Int
    let requestId: UUID
    let ok: Bool
    let text: String?
    let engine: String
    let error: String?
}

struct PlayerSnapshot: Codable {
    let state: PlaybackState
    let currentItem: PlaybackItem?
    let queue: [PlaybackItem]
    let currentTime: TimeInterval
    let duration: TimeInterval
    let volume: Float
    let playbackRate: Float
    let autoplayEnabled: Bool
    let audioLevel: Float
}

struct PlayerCommandResponse: Codable {
    let protocolVersion: Int
    let requestId: UUID
    let ok: Bool
    let snapshot: PlayerSnapshot
    let error: String?
}
