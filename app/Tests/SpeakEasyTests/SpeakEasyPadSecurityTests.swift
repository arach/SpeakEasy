import XCTest
@testable import SpeakEasy

final class SpeakEasyPadSecurityTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private let accessURL = URL(string: "http://pad.speakeasy.local:8255/")!

    @MainActor
    func testInvitationRoundTripsAndCarries256BitSecretInFragment() throws {
        let authority = SpeakEasyPadSessionAuthority()
        let invitation = try authority.issueInvitation(accessURL: accessURL, now: now)
        let parsed = try SpeakEasyPadBootstrapLink.parse(invitation.url)

        XCTAssertEqual(parsed.version, 1)
        XCTAssertEqual(parsed.tokenID, invitation.id)
        XCTAssertEqual(parsed.room, invitation.room)
        XCTAssertEqual(parsed.secret.count, 32)
        XCTAssertEqual(parsed.secret, invitation.secret)
        XCTAssertEqual(invitation.url.host, "pad.speakeasy.local")
        XCTAssertNil(URLComponents(url: invitation.url, resolvingAgainstBaseURL: false)?.query)
        XCTAssertEqual(invitation.expiresAt.timeIntervalSince(invitation.issuedAt), 24 * 60 * 60, accuracy: 0.001)
    }

    @MainActor
    func testDayPassCreatesIndependentRevocableBrowserSessions() throws {
        let authority = SpeakEasyPadSessionAuthority()
        let invitation = try authority.issueInvitation(accessURL: accessURL, now: now)
        let link = try SpeakEasyPadBootstrapLink.parse(invitation.url)
        let nonce = Data(repeating: 0x42, count: 32)
        let hello = try SpeakEasyPadSessionAuthority.makeHello(
            from: link,
            deviceName: "Arach’s iPad",
            clientNonce: nonce
        )

        let redemption = try authority.redeem(hello, now: now.addingTimeInterval(1))

        XCTAssertEqual(redemption.lease.deviceName, "Arach’s iPad")
        XCTAssertEqual(redemption.sessionMasterKey.count, 32)
        XCTAssertEqual(redemption.reconnectSecret.count, 32)
        XCTAssertEqual(redemption.lease.expiresAt, invitation.expiresAt)
        let second = try authority.redeem(hello, now: now.addingTimeInterval(2))
        XCTAssertNotEqual(second.lease.id, redemption.lease.id)
        XCTAssertEqual(second.lease.expiresAt, redemption.lease.expiresAt)
        XCTAssertNoThrow(try authority.authorize(sessionID: redemption.lease.id, at: now.addingTimeInterval(3)))
        XCTAssertNoThrow(try authority.authorize(sessionID: second.lease.id, at: now.addingTimeInterval(3)))

        try authority.revoke(sessionID: redemption.lease.id, at: now.addingTimeInterval(4))
        XCTAssertThrowsError(try authority.authorize(sessionID: redemption.lease.id, at: now.addingTimeInterval(5)))
        XCTAssertNoThrow(try authority.authorize(sessionID: second.lease.id, at: now.addingTimeInterval(5)))
    }

    @MainActor
    func testExpiredInvitationAndRevokedLeaseAreRejected() throws {
        let authority = SpeakEasyPadSessionAuthority()
        let invitation = try authority.issueInvitation(
            accessURL: accessURL,
            now: now,
            bootstrapLifetime: 30
        )
        let link = try SpeakEasyPadBootstrapLink.parse(invitation.url)
        let hello = try SpeakEasyPadSessionAuthority.makeHello(from: link)

        XCTAssertThrowsError(try authority.redeem(hello, now: now.addingTimeInterval(31))) { error in
            XCTAssertEqual(error as? SpeakEasyPadSecurityError, .invitationExpired)
        }

        let second = try authority.issueInvitation(accessURL: accessURL, now: now)
        let secondHello = try SpeakEasyPadSessionAuthority.makeHello(
            from: SpeakEasyPadBootstrapLink.parse(second.url)
        )
        let redemption = try authority.redeem(secondHello, now: now.addingTimeInterval(1))
        XCTAssertNoThrow(try authority.authorize(
            sessionID: redemption.lease.id,
            at: now.addingTimeInterval(2)
        ))
        authority.revokeAll(at: now.addingTimeInterval(3))
        XCTAssertThrowsError(try authority.authorize(
            sessionID: redemption.lease.id,
            at: now.addingTimeInterval(4)
        )) { error in
            XCTAssertEqual(error as? SpeakEasyPadSecurityError, .sessionRevoked)
        }
        XCTAssertThrowsError(try authority.redeem(secondHello, now: now.addingTimeInterval(4))) { error in
            XCTAssertEqual(error as? SpeakEasyPadSecurityError, .invalidInvitation)
        }
    }

    func testDirectionalEncryptionRoundTripsAndRejectsReplay() throws {
        let master = Data(repeating: 0xA5, count: 32)
        let host = SpeakEasyPadSecureChannel(masterKey: master, roleIsHost: true)
        let pad = SpeakEasyPadSecureChannel(masterKey: master, roleIsHost: false)
        let payload = Data(#"{"method":"state.snapshot"}"#.utf8)

        let frame = try host.seal(payload)

        XCTAssertEqual(try pad.open(frame), payload)
        XCTAssertThrowsError(try pad.open(frame)) { error in
            XCTAssertEqual(error as? SpeakEasyPadSecurityError, .replayedFrame)
        }
        let reply = try pad.seal(Data("ack".utf8))
        XCTAssertEqual(try host.open(reply), Data("ack".utf8))
    }

    @MainActor
    func testLANPrototypeReconnectSecretIsBoundToLease() throws {
        let authority = SpeakEasyPadSessionAuthority()
        let invitation = try authority.issueInvitation(accessURL: accessURL, now: now)
        let redemption = try authority.redeemLANPrototype(
            tokenID: invitation.id,
            room: invitation.room,
            secret: invitation.secret,
            deviceName: "iPad",
            now: now.addingTimeInterval(1)
        )

        XCTAssertEqual(
            try authority.resumeLANPrototype(
                sessionID: redemption.lease.id,
                reconnectSecret: redemption.reconnectSecret,
                at: now.addingTimeInterval(2)
            ),
            redemption.lease
        )
        XCTAssertThrowsError(try authority.resumeLANPrototype(
            sessionID: redemption.lease.id,
            reconnectSecret: Data(repeating: 0, count: 32),
            at: now.addingTimeInterval(2)
        )) { error in
            XCTAssertEqual(error as? SpeakEasyPadSecurityError, .invalidProof)
        }
    }
}
