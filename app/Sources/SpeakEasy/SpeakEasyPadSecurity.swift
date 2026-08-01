import CryptoKit
import Foundation
import Security

enum SpeakEasyPadSecurityError: LocalizedError, Equatable {
    case invalidInvitation
    case invitationExpired
    case invitationConsumed
    case invalidProof
    case invalidNonce
    case sessionExpired
    case sessionRevoked
    case unknownSession
    case replayedFrame
    case cryptographicFailure

    var errorDescription: String? {
        switch self {
        case .invalidInvitation: "This pairing invitation is not valid."
        case .invitationExpired: "This pairing invitation has expired."
        case .invitationConsumed: "This pairing invitation has already been used."
        case .invalidProof: "The iPad could not prove possession of the pairing secret."
        case .invalidNonce: "The secure-session nonce is invalid."
        case .sessionExpired: "This iPad session has expired."
        case .sessionRevoked: "This iPad session was ended on the Mac."
        case .unknownSession: "This iPad session is not known to the Mac."
        case .replayedFrame: "This encrypted frame was already received."
        case .cryptographicFailure: "The secure-session payload could not be authenticated."
        }
    }
}

struct SpeakEasyPadBootstrapInvitation: Equatable, Sendable {
    let id: UUID
    let room: String
    let issuedAt: Date
    let expiresAt: Date
    let clientTicket: String
    let secret: Data
    let url: URL
}

struct SpeakEasyPadBootstrapLink: Equatable, Sendable {
    let version: Int
    let room: String
    let tokenID: UUID
    let issuedAtMilliseconds: Int64
    let expiresAtMilliseconds: Int64
    let clientTicket: String
    let secret: Data

    static func parse(_ url: URL) throws -> Self {
        guard let fragment = url.fragment else { throw SpeakEasyPadSecurityError.invalidInvitation }
        var components = URLComponents()
        components.percentEncodedQuery = fragment
        let values = Dictionary(
            (components.queryItems ?? []).compactMap { item in
                item.value.map { (item.name, $0) }
            },
            uniquingKeysWith: { first, _ in first }
        )
        guard values["v"] == "1",
              let room = values["room"], !room.isEmpty,
              let tokenText = values["tid"], let tokenID = UUID(uuidString: tokenText),
              let issuedText = values["iat"], let issued = Int64(issuedText),
              let expiryText = values["exp"], let expiry = Int64(expiryText),
              expiry > issued,
              let ticket = values["ct"], !ticket.isEmpty,
              let secretText = values["k"],
              let secret = Data.speakEasyPadBase64URLDecoded(secretText),
              secret.count == 32
        else {
            throw SpeakEasyPadSecurityError.invalidInvitation
        }
        return Self(
            version: 1,
            room: room,
            tokenID: tokenID,
            issuedAtMilliseconds: issued,
            expiresAtMilliseconds: expiry,
            clientTicket: ticket,
            secret: secret
        )
    }
}

struct SpeakEasyPadBootstrapHello: Codable, Equatable, Sendable {
    let type: String
    let tokenId: UUID
    let room: String
    let clientNonce: String
    let proof: String
    let deviceName: String?

    init(
        tokenId: UUID,
        room: String,
        clientNonce: String,
        proof: String,
        deviceName: String? = nil
    ) {
        self.type = "bootstrap.hello"
        self.tokenId = tokenId
        self.room = room
        self.clientNonce = clientNonce
        self.proof = proof
        self.deviceName = deviceName
    }
}

struct SpeakEasyPadLease: Codable, Equatable, Sendable {
    let id: UUID
    let deviceName: String
    let issuedAt: Date
    let expiresAt: Date
    var revokedAt: Date?

    func isValid(at date: Date) -> Bool {
        revokedAt == nil && date >= issuedAt && date < expiresAt
    }
}

struct SpeakEasyPadBootstrapRedemption: Sendable {
    let lease: SpeakEasyPadLease
    let serverNonce: Data
    let serverProof: Data
    let sessionMasterKey: Data
    let reconnectSecret: Data
}

/// Mac-authoritative day-pass and lease state.
///
/// QR secrets never cross the socket. The Pad sends an HMAC proof made with
/// `SHA256(k)` and both sides derive a fresh session key from independent
/// nonces. This protects command contents from passive LAN capture, but local
/// HTTP still cannot authenticate the JavaScript origin: the hosted HTTPS/WSS
/// design remains the production destination.
@MainActor
final class SpeakEasyPadSessionAuthority {
    static let leaseLifetime: TimeInterval = 24 * 60 * 60
    static let bootstrapLifetime: TimeInterval = leaseLifetime

    private struct BootstrapRecord {
        let id: UUID
        let room: String
        let issuedAt: Date
        let expiresAt: Date
        let verifier: Data
    }

    private struct LeaseRecord {
        var lease: SpeakEasyPadLease
        let reconnectVerifier: Data
    }

    private var bootstraps: [UUID: BootstrapRecord] = [:]
    private var leases: [UUID: LeaseRecord] = [:]

    var activeLease: SpeakEasyPadLease? {
        activeLease(at: Date())
    }

    func issueInvitation(
        accessURL: URL,
        now: Date = Date(),
        bootstrapLifetime requestedLifetime: TimeInterval? = nil
    ) throws -> SpeakEasyPadBootstrapInvitation {
        prune(at: now)
        let id = UUID()
        let room = Self.randomData(count: 18).speakEasyPadBase64URL
        let ticket = Self.randomData(count: 24).speakEasyPadBase64URL
        let secret = Self.randomData(count: 32)
        let lifetime = requestedLifetime ?? Self.bootstrapLifetime
        let expiresAt = now.addingTimeInterval(min(max(lifetime, 30), Self.bootstrapLifetime))
        let issuedMillis = Self.milliseconds(now)
        let expiryMillis = Self.milliseconds(expiresAt)

        var query = URLComponents()
        query.queryItems = [
            URLQueryItem(name: "v", value: "1"),
            URLQueryItem(name: "room", value: room),
            URLQueryItem(name: "tid", value: id.uuidString.lowercased()),
            URLQueryItem(name: "iat", value: String(issuedMillis)),
            URLQueryItem(name: "exp", value: String(expiryMillis)),
            URLQueryItem(name: "ct", value: ticket),
            URLQueryItem(name: "k", value: secret.speakEasyPadBase64URL),
        ]
        guard let fragment = query.percentEncodedQuery,
              var link = URLComponents(url: accessURL, resolvingAgainstBaseURL: false)
        else {
            throw SpeakEasyPadSecurityError.invalidInvitation
        }
        link.fragment = fragment
        guard let url = link.url else { throw SpeakEasyPadSecurityError.invalidInvitation }

        bootstraps[id] = BootstrapRecord(
            id: id,
            room: room,
            issuedAt: now,
            expiresAt: expiresAt,
            verifier: Data(SHA256.hash(data: secret))
        )
        return SpeakEasyPadBootstrapInvitation(
            id: id,
            room: room,
            issuedAt: now,
            expiresAt: expiresAt,
            clientTicket: ticket,
            secret: secret,
            url: url
        )
    }

    static func makeHello(
        from link: SpeakEasyPadBootstrapLink,
        deviceName: String? = nil,
        clientNonce providedNonce: Data? = nil
    ) throws -> SpeakEasyPadBootstrapHello {
        let clientNonce = providedNonce ?? randomData(count: 32)
        guard clientNonce.count == 32 else { throw SpeakEasyPadSecurityError.invalidNonce }
        let verifier = Data(SHA256.hash(data: link.secret))
        let transcript = bootstrapTranscript(
            tokenID: link.tokenID,
            room: link.room,
            issuedAtMilliseconds: link.issuedAtMilliseconds,
            expiresAtMilliseconds: link.expiresAtMilliseconds,
            clientNonce: clientNonce
        )
        let proof = Data(HMAC<SHA256>.authenticationCode(
            for: transcript,
            using: SymmetricKey(data: verifier)
        ))
        return SpeakEasyPadBootstrapHello(
            tokenId: link.tokenID,
            room: link.room,
            clientNonce: clientNonce.speakEasyPadBase64URL,
            proof: proof.speakEasyPadBase64URL,
            deviceName: deviceName
        )
    }

    func redeem(
        _ hello: SpeakEasyPadBootstrapHello,
        now: Date = Date()
    ) throws -> SpeakEasyPadBootstrapRedemption {
        guard let record = bootstraps[hello.tokenId], record.room == hello.room else {
            throw SpeakEasyPadSecurityError.invalidInvitation
        }
        guard now >= record.issuedAt, now < record.expiresAt else {
            throw SpeakEasyPadSecurityError.invitationExpired
        }
        guard let nonce = Data.speakEasyPadBase64URLDecoded(hello.clientNonce), nonce.count == 32,
              let suppliedProof = Data.speakEasyPadBase64URLDecoded(hello.proof)
        else {
            throw SpeakEasyPadSecurityError.invalidNonce
        }
        let expectedProof = Data(HMAC<SHA256>.authenticationCode(
            for: Self.bootstrapTranscript(
                tokenID: record.id,
                room: record.room,
                issuedAtMilliseconds: Self.milliseconds(record.issuedAt),
                expiresAtMilliseconds: Self.milliseconds(record.expiresAt),
                clientNonce: nonce
            ),
            using: SymmetricKey(data: record.verifier)
        ))
        guard Self.constantTimeEqual(expectedProof, suppliedProof) else {
            throw SpeakEasyPadSecurityError.invalidProof
        }

        let serverNonce = Self.randomData(count: 32)
        let sessionID = UUID()
        // Every browser using this day-pass gets its own revocable session,
        // but no session can outlive the timestamp embedded in the QR URL.
        let expiresAt = min(record.expiresAt, now.addingTimeInterval(Self.leaseLifetime))
        let deviceName = Self.normalizedDeviceName(hello.deviceName)
        let reconnectSecret = Self.randomData(count: 32)
        let lease = SpeakEasyPadLease(
            id: sessionID,
            deviceName: deviceName,
            issuedAt: now,
            expiresAt: expiresAt,
            revokedAt: nil
        )
        leases[sessionID] = LeaseRecord(
            lease: lease,
            reconnectVerifier: Data(SHA256.hash(data: reconnectSecret))
        )

        let sessionMaster = Self.deriveSessionMaster(
            verifier: record.verifier,
            clientNonce: nonce,
            serverNonce: serverNonce
        )
        let serverTranscript = Data(
            "v=1&tid=\(record.id.uuidString.lowercased())&sid=\(sessionID.uuidString.lowercased())&exp=\(Self.milliseconds(expiresAt))&clientNonce=\(nonce.speakEasyPadBase64URL)&serverNonce=\(serverNonce.speakEasyPadBase64URL)".utf8
        )
        let serverProof = Data(HMAC<SHA256>.authenticationCode(
            for: serverTranscript,
            using: SymmetricKey(data: record.verifier)
        ))
        return SpeakEasyPadBootstrapRedemption(
            lease: lease,
            serverNonce: serverNonce,
            serverProof: serverProof,
            sessionMasterKey: sessionMaster,
            reconnectSecret: reconnectSecret
        )
    }

    /// Explicitly insecure compatibility path for the first `.local` Safari
    /// pilot. Plain HTTP is not a WebCrypto secure context, so this sends `k`
    /// over the LAN exactly once. Keep the `lan-prototype-v1` label visible in
    /// the client and remove this path when the HTTPS/WSS client ships.
    func redeemLANPrototype(
        tokenID: UUID,
        room: String,
        secret: Data,
        deviceName: String?,
        now: Date = Date()
    ) throws -> SpeakEasyPadBootstrapRedemption {
        guard let record = bootstraps[tokenID], record.room == room else {
            throw SpeakEasyPadSecurityError.invalidInvitation
        }
        let clientNonce = Self.randomData(count: 32)
        let link = SpeakEasyPadBootstrapLink(
            version: 1,
            room: room,
            tokenID: tokenID,
            issuedAtMilliseconds: Self.milliseconds(record.issuedAt),
            expiresAtMilliseconds: Self.milliseconds(record.expiresAt),
            clientTicket: "lan-prototype",
            secret: secret
        )
        let hello = try Self.makeHello(
            from: link,
            deviceName: deviceName,
            clientNonce: clientNonce
        )
        return try redeem(hello, now: now)
    }

    func resumeLANPrototype(
        sessionID: UUID,
        reconnectSecret: Data,
        at now: Date = Date()
    ) throws -> SpeakEasyPadLease {
        guard let record = leases[sessionID] else { throw SpeakEasyPadSecurityError.unknownSession }
        let supplied = Data(SHA256.hash(data: reconnectSecret))
        guard Self.constantTimeEqual(record.reconnectVerifier, supplied) else {
            throw SpeakEasyPadSecurityError.invalidProof
        }
        return try authorize(sessionID: sessionID, at: now)
    }

    func authorize(sessionID: UUID, at now: Date = Date()) throws -> SpeakEasyPadLease {
        guard let record = leases[sessionID] else { throw SpeakEasyPadSecurityError.unknownSession }
        if record.lease.revokedAt != nil { throw SpeakEasyPadSecurityError.sessionRevoked }
        guard record.lease.isValid(at: now) else { throw SpeakEasyPadSecurityError.sessionExpired }
        return record.lease
    }

    func revokeAll(at now: Date = Date()) {
        for id in leases.keys {
            leases[id]?.lease.revokedAt = now
        }
        bootstraps.removeAll()
    }

    func revoke(sessionID: UUID, at now: Date = Date()) throws {
        guard leases[sessionID] != nil else { throw SpeakEasyPadSecurityError.unknownSession }
        leases[sessionID]?.lease.revokedAt = now
    }

    func activeLeases(at now: Date = Date()) -> [SpeakEasyPadLease] {
        leases.values
            .map(\.lease)
            .filter { $0.isValid(at: now) }
            .sorted { $0.issuedAt > $1.issuedAt }
    }

    func activeLease(at now: Date) -> SpeakEasyPadLease? {
        leases.values
            .map(\.lease)
            .filter { $0.isValid(at: now) }
            .max { $0.issuedAt < $1.issuedAt }
    }

    private func prune(at now: Date) {
        bootstraps = bootstraps.filter { _, value in value.expiresAt > now }
        leases = leases.filter { _, value in
            value.lease.expiresAt > now.addingTimeInterval(-Self.leaseLifetime)
        }
    }

    private static func bootstrapTranscript(
        tokenID: UUID,
        room: String,
        issuedAtMilliseconds: Int64,
        expiresAtMilliseconds: Int64,
        clientNonce: Data
    ) -> Data {
        Data(
            "v=1&tid=\(tokenID.uuidString.lowercased())&room=\(room)&iat=\(issuedAtMilliseconds)&exp=\(expiresAtMilliseconds)&nonce=\(clientNonce.speakEasyPadBase64URL)".utf8
        )
    }

    private static func deriveSessionMaster(
        verifier: Data,
        clientNonce: Data,
        serverNonce: Data
    ) -> Data {
        let key = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: verifier),
            salt: clientNonce + serverNonce,
            info: Data("speakeasy-pad-lan-v1".utf8),
            outputByteCount: 32
        )
        return key.withUnsafeBytes { Data($0) }
    }

    private static func normalizedDeviceName(_ value: String?) -> String {
        let normalized = value?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\n", with: " ") ?? ""
        return normalized.isEmpty ? "iPad" : String(normalized.prefix(80))
    }

    private static func milliseconds(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1_000).rounded(.down))
    }

    fileprivate static func randomData(count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        let status = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        precondition(status == errSecSuccess, "Secure random generation failed")
        return Data(bytes)
    }

    private static func constantTimeEqual(_ lhs: Data, _ rhs: Data) -> Bool {
        guard lhs.count == rhs.count else { return false }
        var difference: UInt8 = 0
        for (left, right) in zip(lhs, rhs) { difference |= left ^ right }
        return difference == 0
    }
}

struct SpeakEasyPadEncryptedFrame: Codable, Equatable, Sendable {
    let counter: UInt64
    let ciphertext: String
    let tag: String
}

/// Directional AES-GCM state for one authenticated WebSocket. A new instance
/// is required after every reconnect; counters are never persisted or reused.
final class SpeakEasyPadSecureChannel {
    enum Direction: String {
        case hostToPad = "host-to-pad"
        case padToHost = "pad-to-host"
    }

    private let sendKey: SymmetricKey
    private let receiveKey: SymmetricKey
    private let sendPrefix: UInt32
    private let receivePrefix: UInt32
    private var sendCounter: UInt64 = 0
    private var lastReceivedCounter: UInt64 = 0

    init(masterKey: Data, roleIsHost: Bool) {
        let master = SymmetricKey(data: masterKey)
        let hostToPad = Self.directionKey(master: master, direction: .hostToPad)
        let padToHost = Self.directionKey(master: master, direction: .padToHost)
        sendKey = roleIsHost ? hostToPad : padToHost
        receiveKey = roleIsHost ? padToHost : hostToPad
        sendPrefix = roleIsHost ? 0x48545044 : 0x50544844 // HTPD / PTHD
        receivePrefix = roleIsHost ? 0x50544844 : 0x48545044
    }

    func seal(_ plaintext: Data) throws -> SpeakEasyPadEncryptedFrame {
        guard sendCounter < UInt64.max else { throw SpeakEasyPadSecurityError.cryptographicFailure }
        sendCounter += 1
        let nonce = try AES.GCM.Nonce(data: Self.nonce(prefix: sendPrefix, counter: sendCounter))
        let box = try AES.GCM.seal(plaintext, using: sendKey, nonce: nonce)
        return SpeakEasyPadEncryptedFrame(
            counter: sendCounter,
            ciphertext: box.ciphertext.speakEasyPadBase64URL,
            tag: box.tag.speakEasyPadBase64URL
        )
    }

    func open(_ frame: SpeakEasyPadEncryptedFrame) throws -> Data {
        guard frame.counter > lastReceivedCounter else { throw SpeakEasyPadSecurityError.replayedFrame }
        guard let ciphertext = Data.speakEasyPadBase64URLDecoded(frame.ciphertext),
              let tag = Data.speakEasyPadBase64URLDecoded(frame.tag), tag.count == 16
        else {
            throw SpeakEasyPadSecurityError.cryptographicFailure
        }
        do {
            let nonce = try AES.GCM.Nonce(data: Self.nonce(prefix: receivePrefix, counter: frame.counter))
            let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
            let plaintext = try AES.GCM.open(box, using: receiveKey)
            lastReceivedCounter = frame.counter
            return plaintext
        } catch let error as SpeakEasyPadSecurityError {
            throw error
        } catch {
            throw SpeakEasyPadSecurityError.cryptographicFailure
        }
    }

    private static func directionKey(master: SymmetricKey, direction: Direction) -> SymmetricKey {
        HKDF<SHA256>.deriveKey(
            inputKeyMaterial: master,
            salt: Data(),
            info: Data("speakeasy-pad-\(direction.rawValue)-v1".utf8),
            outputByteCount: 32
        )
    }

    private static func nonce(prefix: UInt32, counter: UInt64) -> Data {
        var prefix = prefix.bigEndian
        var counter = counter.bigEndian
        return withUnsafeBytes(of: &prefix) { prefixBytes in
            withUnsafeBytes(of: &counter) { counterBytes in
                Data(prefixBytes) + Data(counterBytes)
            }
        }
    }
}

extension Data {
    var speakEasyPadBase64URL: String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func speakEasyPadBase64URLDecoded(_ text: String) -> Data? {
        guard text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            return nil
        }
        let padding = String(repeating: "=", count: (4 - text.count % 4) % 4)
        let base64 = text
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/") + padding
        return Data(base64Encoded: base64)
    }
}
