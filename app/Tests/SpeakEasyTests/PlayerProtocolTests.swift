import XCTest
@testable import SpeakEasy

final class PlayerProtocolTests: XCTestCase {
    func testStatusRequestDecodesFromTypeScriptWireShape() throws {
        let json = #"{"protocolVersion":1,"requestId":"5f2ea40a-7471-4cd8-9ead-6549396fc564","command":"status"}"#
        let request = try JSONDecoder().decode(PlayerCommandRequest.self, from: Data(json.utf8))

        XCTAssertEqual(request.protocolVersion, playerProtocolVersion)
        XCTAssertEqual(request.command, .status)
        XCTAssertNil(request.arguments)
    }

    func testEnqueueItemRoundTripsWithoutDateDecoderCoupling() throws {
        let item = PlaybackItem(
            id: UUID(),
            audioPath: "/tmp/narration.mp3",
            title: "Narration",
            text: "Hello",
            provider: "elevenlabs",
            createdAt: "2026-07-24T19:45:00.123Z",
            synthesisRateWPM: 160,
            sourceThreadId: "019f9573-3e55-7701-8968-09c12d4fafe5"
        )
        let request = PlayerCommandRequest(
            protocolVersion: playerProtocolVersion,
            requestId: UUID(),
            command: .enqueue,
            arguments: PlayerCommandArguments(
                item: item,
                priority: .high,
                interrupt: true,
                autoplay: true,
                positionSeconds: nil,
                volume: nil,
                playbackRate: nil,
                itemId: nil
            )
        )

        let decoded = try JSONDecoder().decode(
            PlayerCommandRequest.self,
            from: JSONEncoder().encode(request)
        )

        XCTAssertEqual(decoded.arguments?.item, item)
        XCTAssertEqual(decoded.arguments?.priority, .high)
        XCTAssertEqual(decoded.arguments?.interrupt, true)
        XCTAssertEqual(decoded.arguments?.item?.sourceThreadId, item.sourceThreadId)
    }

    func testCodexTaskLinkRejectsUnsafeThreadIdentifiers() {
        XCTAssertEqual(
            CodexTaskLink.url(threadId: "019f9573-3e55-7701-8968-09c12d4fafe5")?.absoluteString,
            "codex://threads/019f9573-3e55-7701-8968-09c12d4fafe5"
        )
        XCTAssertNil(CodexTaskLink.url(threadId: "../../settings"))
        XCTAssertNil(CodexTaskLink.url(threadId: "thread id"))
        XCTAssertNil(CodexTaskLink.url(threadId: ""))
    }

    @MainActor
    func testPlayerSettingsClampToSupportedRanges() {
        let engine = PlaybackEngine.shared

        engine.setVolume(2)
        engine.setPlaybackRate(4)
        XCTAssertEqual(engine.volume, 1)
        XCTAssertEqual(engine.playbackRate, 2)

        engine.setVolume(-1)
        engine.setPlaybackRate(0.1)
        XCTAssertEqual(engine.volume, 0)
        XCTAssertEqual(engine.playbackRate, 0.5)

        engine.setVolume(0.8)
        engine.setPlaybackRate(1)
    }
}
