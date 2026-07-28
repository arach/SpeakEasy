import Foundation

let speakEasyPadProtocolVersion = 1

enum SpeakEasyPadMethod: String, Codable, CaseIterable, Sendable {
    case systemHello = "system.hello"
    case systemPing = "system.ping"
    case stateSnapshot = "state.snapshot"
    case laneActivateAndListen = "lane.activateAndListen"
    case laneActivate = "lane.activate"
    case listeningToggle = "listening.toggle"
    case listeningCancel = "listening.cancel"
    case laneAnnounce = "lane.announce"
    case playbackToggle = "playback.toggle"
    case playbackStop = "playback.stop"
    case playbackReplay = "playback.replay"
    case taskRevealOnMac = "task.revealOnMac"

    var mutatesState: Bool {
        self != .systemHello && self != .systemPing && self != .stateSnapshot
    }
}

struct SpeakEasyPadLaneSnapshot: Codable, Equatable, Sendable {
    let number: Int
    let label: String
    let taskTitle: String
    let isActive: Bool
    let canActivate: Bool
}

struct SpeakEasyPadPlaybackSnapshot: Codable, Equatable, Sendable {
    let state: String
    let title: String?
    let elapsedSeconds: Double
    let durationSeconds: Double
    let queueCount: Int
}

/// The intentionally narrow projection that may leave the Mac.
///
/// It excludes Codex task IDs, working-directory paths, transcripts, provider
/// credentials, and audio paths. The Mac owns `revision` and clients must not
/// render speculative success before receiving an acknowledged revision.
struct SpeakEasyPadRemoteSnapshot: Codable, Equatable, Sendable {
    var revision: UInt64
    let generatedAtMilliseconds: Int64
    let phase: String
    let phaseLabel: String
    let activeLane: Int?
    let activeTaskTitle: String?
    let inputDeviceName: String?
    let lastError: String?
    let lanes: [SpeakEasyPadLaneSnapshot]
    let playback: SpeakEasyPadPlaybackSnapshot
    let capabilities: [String]

    func withRevision(_ revision: UInt64) -> Self {
        var copy = self
        copy.revision = revision
        return copy
    }

    /// State that participates in optimistic command concurrency. Playback
    /// progress is excluded so the scrubber can refresh without making a tap
    /// race a revision that changes four times per second.
    func hasSameConflictState(as other: Self) -> Bool {
        phase == other.phase
            && phaseLabel == other.phaseLabel
            && activeLane == other.activeLane
            && activeTaskTitle == other.activeTaskTitle
            && inputDeviceName == other.inputDeviceName
            && lastError == other.lastError
            && lanes == other.lanes
            // Elapsed playback time is telemetry, not command-authoritative
            // state. Ignoring it here prevents four revision bumps per second
            // from racing otherwise valid user commands.
            && playback.state == other.playback.state
            && playback.title == other.playback.title
            && playback.durationSeconds == other.playback.durationSeconds
            && playback.queueCount == other.playback.queueCount
            && capabilities == other.capabilities
    }

    /// Visible state, including progress telemetry, used to coalesce pushes.
    func hasSameBroadcastState(as other: Self) -> Bool {
        hasSameConflictState(as: other)
            && playback.elapsedSeconds == other.playback.elapsedSeconds
    }
}

struct SpeakEasyPadCommandArguments: Codable, Equatable, Sendable {
    let lane: Int?
    let clientName: String?
    let clientVersion: String?
    let supportedProtocolVersions: [Int]?

    init(
        lane: Int? = nil,
        clientName: String? = nil,
        clientVersion: String? = nil,
        supportedProtocolVersions: [Int]? = nil
    ) {
        self.lane = lane
        self.clientName = clientName
        self.clientVersion = clientVersion
        self.supportedProtocolVersions = supportedProtocolVersions
    }
}

struct SpeakEasyPadCommandRequest: Codable, Equatable, Sendable {
    let protocolVersion: Int
    let requestId: UUID
    let sessionId: UUID
    let sequence: UInt64
    let sentAtMilliseconds: Int64
    let expectedRevision: UInt64?
    let method: String
    let arguments: SpeakEasyPadCommandArguments?

    init(
        protocolVersion: Int = speakEasyPadProtocolVersion,
        requestId: UUID = UUID(),
        sessionId: UUID,
        sequence: UInt64,
        sentAtMilliseconds: Int64,
        expectedRevision: UInt64? = nil,
        method: String,
        arguments: SpeakEasyPadCommandArguments? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.requestId = requestId
        self.sessionId = sessionId
        self.sequence = sequence
        self.sentAtMilliseconds = sentAtMilliseconds
        self.expectedRevision = expectedRevision
        self.method = method
        self.arguments = arguments
    }
}

struct SpeakEasyPadCommandError: Codable, Error, Equatable, Sendable {
    let code: String
    let message: String
    let retryable: Bool
}

struct SpeakEasyPadCommandResponse: Codable, Equatable, Sendable {
    let protocolVersion: Int
    let requestId: UUID
    let ok: Bool
    let stateRevision: UInt64
    let snapshot: SpeakEasyPadRemoteSnapshot?
    let error: SpeakEasyPadCommandError?
}

enum SpeakEasyPadValidatedCommand: Equatable, Sendable {
    case systemHello(clientName: String?, clientVersion: String?)
    case ping
    case stateSnapshot
    case activateLane(number: Int, beginListening: Bool)
    case toggleListening
    case cancelListening
    case announceLane
    case togglePlayback
    case stopPlayback
    case replayPlayback
    case revealTaskOnMac
}

enum SpeakEasyPadProtocolValidator {
    static let laneRange = 1...9
    static let maximumClientTextLength = 120
    static let maximumRequestAge: TimeInterval = 5 * 60

    static func validate(
        _ request: SpeakEasyPadCommandRequest,
        currentRevision: UInt64,
        now: Date = Date()
    ) throws -> SpeakEasyPadValidatedCommand {
        guard request.protocolVersion == speakEasyPadProtocolVersion else {
            throw failure(
                "unsupported_protocol_version",
                "This Pad uses protocol version \(request.protocolVersion); SpeakEasy requires version \(speakEasyPadProtocolVersion)."
            )
        }
        guard request.sequence > 0 else {
            throw failure("invalid_sequence", "Command sequence numbers begin at 1.")
        }

        let sentAt = Date(timeIntervalSince1970: Double(request.sentAtMilliseconds) / 1_000)
        guard abs(now.timeIntervalSince(sentAt)) <= maximumRequestAge else {
            throw failure("stale_command", "The command timestamp is outside the five-minute acceptance window.", retryable: true)
        }

        guard let method = SpeakEasyPadMethod(rawValue: request.method) else {
            throw failure("unknown_method", "SpeakEasy does not support \(request.method).")
        }
        if method.mutatesState,
           let expectedRevision = request.expectedRevision,
           expectedRevision != currentRevision {
            throw failure(
                "stale_state",
                "The Pad acted on revision \(expectedRevision), but the Mac is at revision \(currentRevision).",
                retryable: true
            )
        }

        switch method {
        case .systemHello:
            let versions = request.arguments?.supportedProtocolVersions ?? []
            if !versions.isEmpty, !versions.contains(speakEasyPadProtocolVersion) {
                throw failure("no_common_protocol", "The Mac and Pad do not share a protocol version.")
            }
            try validateClientText(request.arguments?.clientName, field: "clientName")
            try validateClientText(request.arguments?.clientVersion, field: "clientVersion")
            return .systemHello(
                clientName: request.arguments?.clientName,
                clientVersion: request.arguments?.clientVersion
            )
        case .systemPing:
            return .ping
        case .stateSnapshot:
            return .stateSnapshot
        case .laneActivate, .laneActivateAndListen:
            guard let lane = request.arguments?.lane, laneRange.contains(lane) else {
                throw failure("invalid_lane", "Lane must be an integer from 1 through 9.")
            }
            return .activateLane(number: lane, beginListening: method == .laneActivateAndListen)
        case .listeningToggle:
            return .toggleListening
        case .listeningCancel:
            return .cancelListening
        case .laneAnnounce:
            return .announceLane
        case .playbackToggle:
            return .togglePlayback
        case .playbackStop:
            return .stopPlayback
        case .playbackReplay:
            return .replayPlayback
        case .taskRevealOnMac:
            return .revealTaskOnMac
        }
    }

    private static func validateClientText(_ value: String?, field: String) throws {
        guard let value else { return }
        guard !value.contains(where: \Character.isNewline), value.utf8.count <= maximumClientTextLength else {
            throw failure("invalid_\(field)", "\(field) is too long or contains a line break.")
        }
    }

    private static func failure(
        _ code: String,
        _ message: String,
        retryable: Bool = false
    ) -> SpeakEasyPadCommandError {
        SpeakEasyPadCommandError(code: code, message: message, retryable: retryable)
    }
}
