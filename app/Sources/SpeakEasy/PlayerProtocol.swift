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
        playbackRate: Float? = nil
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
    }
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
