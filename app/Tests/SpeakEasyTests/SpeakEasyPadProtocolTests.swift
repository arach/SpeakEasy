import XCTest
@testable import SpeakEasy

final class SpeakEasyPadProtocolTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testCommandDecodesFromBrowserWireShape() throws {
        let sessionID = UUID(uuidString: "00000000-0000-4000-8000-000000000001")!
        let requestID = UUID(uuidString: "00000000-0000-4000-8000-000000000002")!
        let json = #"{"protocolVersion":1,"requestId":"\#(requestID.uuidString)","sessionId":"\#(sessionID.uuidString)","sequence":7,"sentAtMilliseconds":1800000000000,"expectedRevision":4,"method":"lane.activateAndListen","arguments":{"lane":3}}"#

        let request = try JSONDecoder().decode(SpeakEasyPadCommandRequest.self, from: Data(json.utf8))
        let command = try SpeakEasyPadProtocolValidator.validate(
            request,
            currentRevision: 4,
            now: now
        )

        XCTAssertEqual(command, .activateLane(number: 3, beginListening: true))
        XCTAssertEqual(request.sessionId, sessionID)
        XCTAssertEqual(request.requestId, requestID)
    }

    func testUnknownMethodAndStaleRevisionHaveStableErrors() throws {
        let unknown = request(method: "shell.execute", expectedRevision: 5)
        XCTAssertThrowsError(try SpeakEasyPadProtocolValidator.validate(
            unknown,
            currentRevision: 5,
            now: now
        )) { error in
            XCTAssertEqual((error as? SpeakEasyPadCommandError)?.code, "unknown_method")
        }

        let stale = request(method: SpeakEasyPadMethod.listeningToggle.rawValue, expectedRevision: 4)
        XCTAssertThrowsError(try SpeakEasyPadProtocolValidator.validate(
            stale,
            currentRevision: 5,
            now: now
        )) { error in
            let commandError = error as? SpeakEasyPadCommandError
            XCTAssertEqual(commandError?.code, "stale_state")
            XCTAssertEqual(commandError?.retryable, true)
        }
    }

    @MainActor
    func testCoordinatorExecutesDuplicateRequestExactlyOnce() {
        var invocationCount = 0
        let coordinator = SpeakEasyPadRemoteCoordinator(
            initialRevision: 10,
            snapshotProvider: { Self.snapshot() },
            actionHandler: { _ in invocationCount += 1 }
        )
        let command = request(
            method: SpeakEasyPadMethod.laneActivate.rawValue,
            expectedRevision: 10,
            arguments: SpeakEasyPadCommandArguments(lane: 2)
        )

        let first = coordinator.handle(command, now: now)
        let duplicate = coordinator.handle(command, now: now.addingTimeInterval(2))

        XCTAssertTrue(first.ok)
        XCTAssertEqual(first.stateRevision, 11)
        XCTAssertEqual(duplicate, first)
        XCTAssertEqual(invocationCount, 1)
    }

    @MainActor
    func testCoordinatorRejectsOutOfOrderSequenceWithoutMutation() {
        var invocationCount = 0
        let sessionID = UUID()
        let coordinator = SpeakEasyPadRemoteCoordinator(
            snapshotProvider: { Self.snapshot() },
            actionHandler: { _ in invocationCount += 1 }
        )
        let accepted = request(
            sessionID: sessionID,
            sequence: 2,
            method: SpeakEasyPadMethod.listeningToggle.rawValue
        )
        let older = request(
            sessionID: sessionID,
            sequence: 1,
            method: SpeakEasyPadMethod.listeningCancel.rawValue
        )

        XCTAssertTrue(coordinator.handle(accepted, now: now).ok)
        let rejection = coordinator.handle(older, now: now)

        XCTAssertFalse(rejection.ok)
        XCTAssertEqual(rejection.error?.code, "non_monotonic_sequence")
        XCTAssertEqual(invocationCount, 1)
    }

    @MainActor
    func testPingCallsTheActionHandlerWithoutChangingRevision() {
        var invocationCount = 0
        let coordinator = SpeakEasyPadRemoteCoordinator(
            initialRevision: 8,
            snapshotProvider: { Self.snapshot() },
            actionHandler: { _ in invocationCount += 1 }
        )

        let response = coordinator.handle(
            request(method: SpeakEasyPadMethod.systemPing.rawValue, expectedRevision: 1),
            now: now
        )

        XCTAssertTrue(response.ok)
        XCTAssertEqual(response.stateRevision, 8)
        XCTAssertEqual(invocationCount, 1)
    }

    @MainActor
    func testLiveProjectionAlwaysContainsNineSafeLaneSlots() {
        let snapshot = SpeakEasyPadRemoteSnapshot.captureLive()

        XCTAssertEqual(snapshot.lanes.map(\.number), Array(1...9))
        XCTAssertEqual(snapshot.lanes.count, 9)
        XCTAssertTrue(snapshot.lanes.filter { $0.taskTitle.isEmpty }.allSatisfy { !$0.canActivate })
    }

    func testPlaybackProgressBroadcastDoesNotChangeConflictFingerprint() {
        let first = Self.snapshot(elapsedSeconds: 12)
        let progress = Self.snapshot(elapsedSeconds: 13)

        XCTAssertTrue(first.hasSameConflictState(as: progress))
        XCTAssertFalse(first.hasSameBroadcastState(as: progress))
    }

    func testAudioLevelBroadcastDoesNotChangeConflictFingerprint() {
        let quiet = Self.snapshot(audioLevel: 0.1)
        let speaking = Self.snapshot(audioLevel: 0.7)

        XCTAssertTrue(quiet.hasSameConflictState(as: speaking))
        XCTAssertFalse(quiet.hasSameBroadcastState(as: speaking))
    }

    private func request(
        sessionID: UUID = UUID(),
        requestID: UUID = UUID(),
        sequence: UInt64 = 1,
        method: String,
        expectedRevision: UInt64? = nil,
        arguments: SpeakEasyPadCommandArguments? = nil
    ) -> SpeakEasyPadCommandRequest {
        SpeakEasyPadCommandRequest(
            requestId: requestID,
            sessionId: sessionID,
            sequence: sequence,
            sentAtMilliseconds: Int64(now.timeIntervalSince1970 * 1_000),
            expectedRevision: expectedRevision,
            method: method,
            arguments: arguments
        )
    }

    private static func snapshot(
        elapsedSeconds: Double = 0,
        audioLevel: Float = 0
    ) -> SpeakEasyPadRemoteSnapshot {
        SpeakEasyPadRemoteSnapshot(
            revision: 0,
            generatedAtMilliseconds: 1_800_000_000_000,
            phase: "ready",
            phaseLabel: "Ready",
            activeLane: 2,
            activeTaskTitle: "Build the Pad",
            inputDeviceName: "Studio Mic",
            lastError: nil,
            lanes: [
                SpeakEasyPadLaneSnapshot(
                    number: 2,
                    label: "Pad",
                    taskTitle: "Build the Pad",
                    isActive: true,
                    canActivate: true
                )
            ],
            playback: SpeakEasyPadPlaybackSnapshot(
                state: "idle",
                title: nil,
                elapsedSeconds: elapsedSeconds,
                durationSeconds: 0,
                queueCount: 0,
                volume: 0.8,
                playbackRate: 1,
                autoplayEnabled: true,
                audioLevel: audioLevel
            ),
            capabilities: SpeakEasyPadMethod.allCases.map(\.rawValue)
        )
    }
}
