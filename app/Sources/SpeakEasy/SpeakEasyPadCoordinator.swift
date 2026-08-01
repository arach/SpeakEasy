import Foundation

@MainActor
final class SpeakEasyPadRemoteCoordinator {
    typealias SnapshotProvider = @MainActor () -> SpeakEasyPadRemoteSnapshot
    typealias ActionHandler = @MainActor (SpeakEasyPadValidatedCommand) throws -> Void

    private struct CommandKey: Hashable {
        let sessionID: UUID
        let requestID: UUID
    }

    private struct CachedResponse {
        let response: SpeakEasyPadCommandResponse
        let storedAt: Date
    }

    private let snapshotProvider: SnapshotProvider
    private let actionHandler: ActionHandler
    private let cacheLifetime: TimeInterval
    private let cacheCapacity: Int
    private var revision: UInt64
    private var responses: [CommandKey: CachedResponse] = [:]
    private var responseOrder: [CommandKey] = []
    private var lastSequenceBySession: [UUID: UInt64] = [:]

    init(
        initialRevision: UInt64 = 1,
        cacheLifetime: TimeInterval = 10 * 60,
        cacheCapacity: Int = 512,
        snapshotProvider: @escaping SnapshotProvider,
        actionHandler: @escaping ActionHandler
    ) {
        self.revision = max(initialRevision, 1)
        self.cacheLifetime = max(cacheLifetime, 1)
        self.cacheCapacity = max(cacheCapacity, 1)
        self.snapshotProvider = snapshotProvider
        self.actionHandler = actionHandler
    }

    func currentSnapshot() -> SpeakEasyPadRemoteSnapshot {
        snapshotProvider().withRevision(revision)
    }

    /// Advances the Mac-owned revision for a local state change and returns the
    /// complete replacement snapshot to broadcast. Reconnects likewise begin
    /// with this full snapshot; deltas are deliberately deferred beyond MVP.
    @discardableResult
    func stateDidChange() -> SpeakEasyPadRemoteSnapshot {
        revision &+= 1
        return currentSnapshot()
    }

    func handle(
        _ request: SpeakEasyPadCommandRequest,
        now: Date = Date()
    ) -> SpeakEasyPadCommandResponse {
        removeExpiredResponses(now: now)
        let key = CommandKey(sessionID: request.sessionId, requestID: request.requestId)
        if let cached = responses[key] {
            return cached.response
        }

        let command: SpeakEasyPadValidatedCommand
        do {
            command = try SpeakEasyPadProtocolValidator.validate(
                request,
                currentRevision: revision,
                now: now
            )
            if let previous = lastSequenceBySession[request.sessionId], request.sequence <= previous {
                throw SpeakEasyPadCommandError(
                    code: "non_monotonic_sequence",
                    message: "This session has already accepted sequence \(previous) or later.",
                    retryable: false
                )
            }
        } catch let error as SpeakEasyPadCommandError {
            return cache(
                SpeakEasyPadCommandResponse(
                    protocolVersion: speakEasyPadProtocolVersion,
                    requestId: request.requestId,
                    ok: false,
                    stateRevision: revision,
                    snapshot: currentSnapshot(),
                    error: error
                ),
                for: key,
                now: now
            )
        } catch {
            return cache(
                failureResponse(to: request, code: "invalid_command", message: error.localizedDescription),
                for: key,
                now: now
            )
        }

        do {
            switch command {
            case .systemHello, .stateSnapshot:
                break
            case .ping:
                try actionHandler(command)
            default:
                try actionHandler(command)
                revision &+= 1
            }
            lastSequenceBySession[request.sessionId] = request.sequence
            return cache(
                SpeakEasyPadCommandResponse(
                    protocolVersion: speakEasyPadProtocolVersion,
                    requestId: request.requestId,
                    ok: true,
                    stateRevision: revision,
                    snapshot: currentSnapshot(),
                    error: nil
                ),
                for: key,
                now: now
            )
        } catch let error as SpeakEasyPadCommandError {
            return cache(
                SpeakEasyPadCommandResponse(
                    protocolVersion: speakEasyPadProtocolVersion,
                    requestId: request.requestId,
                    ok: false,
                    stateRevision: revision,
                    snapshot: currentSnapshot(),
                    error: error
                ),
                for: key,
                now: now
            )
        } catch {
            return cache(
                failureResponse(to: request, code: "command_failed", message: error.localizedDescription),
                for: key,
                now: now
            )
        }
    }

    func forgetSession(_ sessionID: UUID) {
        lastSequenceBySession[sessionID] = nil
        let doomed = responses.keys.filter { $0.sessionID == sessionID }
        for key in doomed { responses[key] = nil }
        responseOrder.removeAll { $0.sessionID == sessionID }
    }

    private func failureResponse(
        to request: SpeakEasyPadCommandRequest,
        code: String,
        message: String
    ) -> SpeakEasyPadCommandResponse {
        SpeakEasyPadCommandResponse(
            protocolVersion: speakEasyPadProtocolVersion,
            requestId: request.requestId,
            ok: false,
            stateRevision: revision,
            snapshot: currentSnapshot(),
            error: SpeakEasyPadCommandError(code: code, message: message, retryable: false)
        )
    }

    @discardableResult
    private func cache(
        _ response: SpeakEasyPadCommandResponse,
        for key: CommandKey,
        now: Date
    ) -> SpeakEasyPadCommandResponse {
        responses[key] = CachedResponse(response: response, storedAt: now)
        responseOrder.removeAll { $0 == key }
        responseOrder.append(key)
        while responseOrder.count > cacheCapacity {
            responses[responseOrder.removeFirst()] = nil
        }
        return response
    }

    private func removeExpiredResponses(now: Date) {
        let cutoff = now.addingTimeInterval(-cacheLifetime)
        responseOrder.removeAll { key in
            guard let cached = responses[key] else { return true }
            if cached.storedAt < cutoff {
                responses[key] = nil
                return true
            }
            return false
        }
    }
}

@MainActor
extension SpeakEasyPadRemoteSnapshot {
    static func captureLive(
        listening providedListening: ListeningSessionController? = nil,
        playback providedPlayback: PlaybackEngine? = nil,
        now: Date = Date()
    ) -> Self {
        let listening = providedListening ?? .shared
        let playback = providedPlayback ?? .shared
        let activeLane = listening.activeLaneNumber
        let lanes = SpeakEasyPadProtocolValidator.laneRange.map { number in
            if let lane = listening.lane(number) {
                return SpeakEasyPadLaneSnapshot(
                    number: lane.number,
                    label: lane.label ?? lane.spokenTitle,
                    taskTitle: lane.task.title,
                    isActive: lane.number == activeLane,
                    canActivate: listening.phase != .recording || lane.number == activeLane
                )
            }
            return SpeakEasyPadLaneSnapshot(
                number: number,
                label: "Lane \(number)",
                taskTitle: "",
                isActive: false,
                canActivate: false
            )
        }
        let player = playback.snapshot()
        return Self(
            revision: 0,
            generatedAtMilliseconds: Int64(now.timeIntervalSince1970 * 1_000),
            phase: listening.phase.rawValue,
            phaseLabel: listening.phase.label,
            activeLane: activeLane,
            activeTaskTitle: listening.lockedTask?.title,
            inputDeviceName: listening.inputDeviceName,
            lastError: listening.lastError,
            lanes: lanes,
            playback: SpeakEasyPadPlaybackSnapshot(
                state: player.state.rawValue,
                title: player.currentItem?.title,
                elapsedSeconds: player.currentTime,
                durationSeconds: player.duration,
                queueCount: player.queue.count,
                volume: player.volume,
                playbackRate: player.playbackRate,
                autoplayEnabled: player.autoplayEnabled,
                audioLevel: player.audioLevel
            ),
            capabilities: SpeakEasyPadMethod.allCases.map(\.rawValue)
        )
    }
}
