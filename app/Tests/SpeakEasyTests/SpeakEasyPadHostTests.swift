import Foundation
import XCTest
@testable import SpeakEasy

final class SpeakEasyPadHostTests: XCTestCase {
    @MainActor
    func testLANHostServesHealthThenAuthenticatesWebSocketAndHandlesCommand() async throws {
        let authority = SpeakEasyPadSessionAuthority()
        let coordinator = SpeakEasyPadRemoteCoordinator(
            snapshotProvider: { Self.snapshot() },
            actionHandler: { _ in }
        )
        let runtime = SpeakEasyPadLANRuntime(authority: authority, coordinator: coordinator)
        defer { runtime.stop() }

        // Pairing is also the retry path when lifecycle startup did not leave
        // a live listener.
        let pairing = try await runtime.beginPairing()
        let port = try XCTUnwrap(pairing.accessURL.port)

        let healthURL = try XCTUnwrap(URL(string: "http://127.0.0.1:\(port)/health"))
        var healthRequest = URLRequest(url: healthURL)
        healthRequest.timeoutInterval = 3
        let (healthData, healthResponse) = try await URLSession.shared.data(for: healthRequest)
        XCTAssertEqual((healthResponse as? HTTPURLResponse)?.statusCode, 200)
        XCTAssertTrue(String(decoding: healthData, as: UTF8.self).contains("lan-prototype-v1"))

        let bootstrap = try SpeakEasyPadBootstrapLink.parse(pairing.pairingURL)
        let webSocketURL = try XCTUnwrap(URL(string: "ws://127.0.0.1:\(port)/pad"))
        let socket = URLSession.shared.webSocketTask(with: webSocketURL)
        socket.resume()
        defer { socket.cancel(with: .normalClosure, reason: nil) }

        let redeem: [String: Any] = [
            "type": "bootstrap.redeem",
            "protocolVersion": speakEasyPadProtocolVersion,
            "tokenId": bootstrap.tokenID.uuidString.lowercased(),
            "room": bootstrap.room,
            "secret": bootstrap.secret.speakEasyPadBase64URL,
            "deviceName": "Unit Test iPad",
        ]
        let redeemData = try JSONSerialization.data(withJSONObject: redeem, options: [.sortedKeys])
        try await socket.send(.string(String(decoding: redeemData, as: UTF8.self)))

        let acceptedData = try await Self.data(from: socket.receive())
        let accepted = try JSONDecoder().decode(TestSessionAccepted.self, from: acceptedData)
        XCTAssertEqual(accepted.type, "session.accepted")
        XCTAssertEqual(accepted.security, "lan-prototype-v1")
        XCTAssertEqual(accepted.snapshot.revision, 1)
        XCTAssertEqual(accepted.snapshot.lanes.count, 1)

        let command = SpeakEasyPadCommandRequest(
            sessionId: accepted.sessionId,
            sequence: 1,
            sentAtMilliseconds: Int64(Date().timeIntervalSince1970 * 1_000),
            expectedRevision: accepted.snapshot.revision,
            method: SpeakEasyPadMethod.stateSnapshot.rawValue
        )
        let commandData = try JSONEncoder().encode(command)
        try await socket.send(.string(String(decoding: commandData, as: UTF8.self)))
        let responseData = try await Self.data(from: socket.receive())
        let response = try JSONDecoder().decode(SpeakEasyPadCommandResponse.self, from: responseData)

        XCTAssertTrue(response.ok)
        XCTAssertEqual(response.requestId, command.requestId)
        XCTAssertEqual(response.snapshot?.activeLane, 1)
    }

    private static func data(from message: URLSessionWebSocketTask.Message) throws -> Data {
        switch message {
        case .data(let data): return data
        case .string(let text): return Data(text.utf8)
        @unknown default: throw SpeakEasyPadHostError.invalidWebSocketRequest
        }
    }

    private static func snapshot() -> SpeakEasyPadRemoteSnapshot {
        SpeakEasyPadRemoteSnapshot(
            revision: 0,
            generatedAtMilliseconds: Int64(Date().timeIntervalSince1970 * 1_000),
            phase: "ready",
            phaseLabel: "Ready",
            activeLane: 1,
            activeTaskTitle: "Test the Pad host",
            inputDeviceName: "Test Mic",
            lastError: nil,
            lanes: [
                SpeakEasyPadLaneSnapshot(
                    number: 1,
                    label: "Host",
                    taskTitle: "Test the Pad host",
                    isActive: true,
                    canActivate: true
                )
            ],
            playback: SpeakEasyPadPlaybackSnapshot(
                state: "idle",
                title: nil,
                elapsedSeconds: 0,
                durationSeconds: 0,
                queueCount: 0,
                volume: 0.8,
                playbackRate: 1,
                autoplayEnabled: true,
                audioLevel: 0
            ),
            capabilities: SpeakEasyPadMethod.allCases.map(\.rawValue)
        )
    }
}

private struct TestSessionAccepted: Decodable {
    let type: String
    let protocolVersion: Int
    let security: String
    let sessionId: UUID
    let expiresAtMilliseconds: Int64
    let reconnectSecret: String
    let snapshot: SpeakEasyPadRemoteSnapshot
}
