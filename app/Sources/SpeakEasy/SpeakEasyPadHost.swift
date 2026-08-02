import AppKit
import CryptoKit
import Darwin
import Foundation
import Network
import dnssd

enum SpeakEasyPadHostError: LocalizedError {
    case failedToBind(String)
    case noReachableAddress
    case invalidWebSocketRequest
    case frameTooLarge

    var errorDescription: String? {
        switch self {
        case .failedToBind(let detail): "The SpeakEasy Pad host could not start: \(detail)"
        case .noReachableAddress: "The Mac does not currently have a reachable LAN address."
        case .invalidWebSocketRequest: "The Pad sent an invalid WebSocket request."
        case .frameTooLarge: "The Pad sent a frame larger than 64 KiB."
        }
    }
}

/// The first working transport for the same-LAN pilot.
///
/// `pad.speakeasy.local` is published through multicast DNS and the server uses
/// unprivileged port 8255 (TALK). This is intentionally plain HTTP/WebSocket:
/// iPad Safari does not treat arbitrary `.local` HTTP origins as secure
/// contexts, so WebCrypto is unavailable. The QR URL is a revocable day-pass
/// that can be opened by more than one browser, and an active LAN attacker can
/// observe it. The
/// HTTPS/WSS rendezvous in the architecture proposal is the production path.
@MainActor
final class SpeakEasyPadLANRuntime {
    static let preferredPort: UInt16 = 8255

    private let authority: SpeakEasyPadSessionAuthority
    private let coordinator: SpeakEasyPadRemoteCoordinator
    private var host: SpeakEasyPadHTTPWebSocketHost?
    private var publish: SpeakEasyPadRuntimeAdapter.Publish?
    private var currentInvitation: SpeakEasyPadBootstrapInvitation?
    private var devices: [UUID: SpeakEasyPadDevice] = [:]

    init(
        authority providedAuthority: SpeakEasyPadSessionAuthority? = nil,
        coordinator: SpeakEasyPadRemoteCoordinator? = nil
    ) {
        self.authority = providedAuthority ?? SpeakEasyPadSessionAuthority()
        self.coordinator = coordinator ?? Self.makeLiveCoordinator()
    }

    func makeAdapter() -> SpeakEasyPadRuntimeAdapter {
        SpeakEasyPadRuntimeAdapter(
            start: { [weak self] publish in
                guard let self else { return }
                self.publish = publish
                try await self.start()
            },
            stop: { [weak self] in self?.stop() },
            beginPairing: { [weak self] in
                guard let self else { throw SpeakEasyPadHostError.failedToBind("runtime released") }
                return try await self.beginPairing()
            },
            endSession: { [weak self] in
                guard let self else { return }
                self.endSession()
            },
            revokeSession: { [weak self] sessionID in
                guard let self else { return }
                try self.revokeSession(sessionID)
            }
        )
    }

    func start() async throws {
        if let host {
            publishReady(host: host)
            return
        }
        let staticRoot = Self.staticRoot()
        let next = SpeakEasyPadHTTPWebSocketHost(
            preferredPort: Self.preferredPort,
            staticRoot: staticRoot,
            coordinator: coordinator,
            authority: authority
        )
        next.onLeaseAccepted = { [weak self] lease, ipAddress, macAddress in
            guard let self else { return }
            self.devices[lease.id] = SpeakEasyPadDevice(
                id: lease.id,
                name: lease.deviceName,
                ipAddress: ipAddress,
                macAddress: macAddress,
                isConnected: true,
                expiresAt: lease.expiresAt
            )
            self.publishStatus(host: next)
        }
        next.onLeaseDisconnected = { [weak self] sessionID in
            guard let self, var device = self.devices[sessionID] else { return }
            device.isConnected = false
            self.devices[sessionID] = device
            self.publishStatus(host: next)
        }
        try await next.start()
        host = next
        publishReady(host: next)
    }

    func stop() {
        host?.stop()
        host = nil
        publish = nil
    }

    func beginPairing() async throws -> SpeakEasyPadPairing {
        if host == nil {
            // `start()` intentionally assigns `host` only after NWListener is
            // ready. A failed launch therefore remains retryable from the
            // user's next Connect iPad action.
            try await start()
        }
        guard let host else { throw SpeakEasyPadHostError.failedToBind("host is not running") }
        let invitation: SpeakEasyPadBootstrapInvitation
        if let currentInvitation, currentInvitation.expiresAt > Date() {
            invitation = currentInvitation
        } else {
            invitation = try authority.issueInvitation(accessURL: host.accessURL)
            currentInvitation = invitation
        }
        return SpeakEasyPadPairing(
            accessURL: host.accessURL,
            pairingURL: invitation.url,
            expiresAt: invitation.expiresAt
        )
    }

    func endSession() {
        authority.revokeAll()
        currentInvitation = nil
        devices.removeAll()
        host?.disconnectAuthenticatedClients()
        if let host { publishReady(host: host) }
    }

    func revokeSession(_ sessionID: UUID) throws {
        try authority.revoke(sessionID: sessionID)
        coordinator.forgetSession(sessionID)
        devices[sessionID] = nil
        host?.disconnectAuthenticatedClient(sessionID: sessionID)
        if let host { publishStatus(host: host) }
    }

    private func publishReady(host: SpeakEasyPadHTTPWebSocketHost) {
        publishStatus(host: host)
    }

    private func publishStatus(host: SpeakEasyPadHTTPWebSocketHost) {
        let now = Date()
        devices = devices.filter { $0.value.expiresAt > now }
        let listed = devices.values.sorted {
            if $0.isConnected != $1.isConnected { return $0.isConnected }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
        let connected = listed.filter(\.isConnected)
        let suffix = host.usesCanonicalAlias
            ? "Open pad.speakeasy.local on the same Wi-Fi network."
            : "Open \(host.accessURL.absoluteString) on the same Wi-Fi network."
        let status: String
        if listed.isEmpty {
            status = "Ready to connect an iPad. \(suffix)"
        } else {
            status = "\(listed.count) authorized browser\(listed.count == 1 ? "" : "s") · \(connected.count) online."
        }
        let invitation = currentInvitation.flatMap { $0.expiresAt > now ? $0 : nil }
        publish?(SpeakEasyPadSnapshot(
            state: connected.isEmpty ? .ready : .connected,
            statusMessage: status,
            accessURL: host.accessURL,
            pairingURL: invitation?.url,
            pairingExpiresAt: invitation?.expiresAt,
            sessionExpiresAt: listed.map(\.expiresAt).max(),
            connectedDeviceName: connected.count == 1 ? connected.first?.name : nil,
            devices: listed
        ))
    }

    private static func staticRoot() -> URL? {
        if let override = ProcessInfo.processInfo.environment["SPEAKEASY_PAD_WEB_ROOT"] {
            return URL(fileURLWithPath: override, isDirectory: true)
        }
        return SpeakEasyResources.resourceURL?.appendingPathComponent("Pad", isDirectory: true)
    }

    private static func makeLiveCoordinator() -> SpeakEasyPadRemoteCoordinator {
        let listening = ListeningSessionController.shared
        let playback = PlaybackEngine.shared
        return SpeakEasyPadRemoteCoordinator(
            snapshotProvider: {
                .captureLive(listening: listening, playback: playback)
            },
            actionHandler: { command in
                switch command {
                case .systemHello, .stateSnapshot:
                    break
                case .ping:
                    NSSound.beep()
                case .activateLane(let number, let beginListening):
                    guard listening.lane(number) != nil else {
                        throw SpeakEasyPadCommandError(
                            code: "lane_unassigned",
                            message: "Lane \(number) is not assigned on this Mac.",
                            retryable: false
                        )
                    }
                    let blockedPhases: [ListeningPhase] = [
                        .validatingLock, .cueing, .warmingUp, .transcribing,
                        .submitting, .preparingSpeech,
                    ]
                    guard !blockedPhases.contains(listening.phase), listening.phase != .recording else {
                        throw SpeakEasyPadCommandError(
                            code: "listening_busy",
                            message: "Finish or cancel the current voice turn before switching lanes.",
                            retryable: true
                        )
                    }
                    listening.activateLane(number, beginListening: beginListening)
                case .toggleListening:
                    guard listening.phase.acceptsHotkey else {
                        throw SpeakEasyPadCommandError(
                            code: "listening_busy",
                            message: "Listening cannot toggle while SpeakEasy is \(listening.phase.label.lowercased()).",
                            retryable: true
                        )
                    }
                    listening.toggleListening()
                case .cancelListening:
                    guard listening.phase == .recording || listening.phase == .warmingUp else {
                        throw SpeakEasyPadCommandError(
                            code: "nothing_to_cancel",
                            message: "SpeakEasy is not currently recording.",
                            retryable: false
                        )
                    }
                    listening.cancelRecording()
                case .announceLane:
                    guard listening.activeLaneNumber != nil else {
                        throw SpeakEasyPadCommandError(
                            code: "no_active_lane",
                            message: "Choose a lane before asking SpeakEasy to announce it.",
                            retryable: false
                        )
                    }
                    listening.confirmActiveLane()
                case .togglePlayback:
                    let state = playback.snapshot()
                    guard state.currentItem != nil || !state.queue.isEmpty else {
                        throw SpeakEasyPadCommandError(
                            code: "nothing_to_play",
                            message: "There is no narration ready to play.",
                            retryable: false
                        )
                    }
                    try playback.togglePlayback()
                case .stopPlayback:
                    playback.stop()
                case .replayPlayback:
                    guard playback.snapshot().currentItem != nil else {
                        throw SpeakEasyPadCommandError(
                            code: "nothing_to_replay",
                            message: "There is no current narration to replay.",
                            retryable: false
                        )
                    }
                    playback.seek(to: 0)
                    try playback.resume()
                case .revealTaskOnMac:
                    guard let url = CodexTaskLink.url(threadId: listening.lockedTask?.id) else {
                        throw SpeakEasyPadCommandError(
                            code: "no_active_task",
                            message: "Choose a lane before revealing its task.",
                            retryable: false
                        )
                    }
                    NSWorkspace.shared.open(url)
                }
            }
        )
    }
}

/// One call from AppDelegate installs the concrete host behind the shell seam.
@MainActor
enum SpeakEasyPadHostBootstrap {
    private static var runtime: SpeakEasyPadLANRuntime?

    static func install() {
        guard runtime == nil else { return }
        let next = SpeakEasyPadLANRuntime()
        runtime = next
        SpeakEasyPadIntegration.shared.install(adapter: next.makeAdapter())
    }
}

@MainActor
private final class SpeakEasyPadHTTPWebSocketHost {
    typealias LeaseHandler = @MainActor (SpeakEasyPadLease, String?, String?) -> Void
    typealias DisconnectHandler = @MainActor (UUID) -> Void

    private let preferredPort: UInt16
    private let staticRoot: URL?
    private let coordinator: SpeakEasyPadRemoteCoordinator
    private let authority: SpeakEasyPadSessionAuthority
    private let queue = DispatchQueue(label: "app.speakeasy.pad.lan", qos: .userInitiated)
    private var listener: NWListener?
    private var alias: SpeakEasyPadMDNSAlias?
    private var clients: [ObjectIdentifier: SpeakEasyPadWebSocketClient] = [:]
    private var stateTimer: Timer?
    private var lastObservedSnapshot: SpeakEasyPadRemoteSnapshot?

    private(set) var port: UInt16
    private(set) var accessURL: URL
    private(set) var usesCanonicalAlias = false
    var onLeaseAccepted: LeaseHandler?
    var onLeaseDisconnected: DisconnectHandler?

    init(
        preferredPort: UInt16,
        staticRoot: URL?,
        coordinator: SpeakEasyPadRemoteCoordinator,
        authority: SpeakEasyPadSessionAuthority
    ) {
        self.preferredPort = preferredPort
        self.port = preferredPort
        self.staticRoot = staticRoot
        self.coordinator = coordinator
        self.authority = authority
        self.accessURL = URL(string: "http://pad.speakeasy.local:\(preferredPort)/")!
    }

    func start() async throws {
        do {
            try await startListener(port: NWEndpoint.Port(rawValue: preferredPort)!)
        } catch {
            try await startListener(port: .any)
        }
        guard let listenerPort = listener?.port?.rawValue else {
            throw SpeakEasyPadHostError.failedToBind("listener did not publish a port")
        }
        port = listenerPort

        if let address = Self.preferredIPv4Address() {
            let registrar = SpeakEasyPadMDNSAlias(address: address)
            if registrar.start() {
                alias = registrar
                usesCanonicalAlias = true
                accessURL = URL(string: "http://pad.speakeasy.local:\(port)/")!
            } else {
                accessURL = URL(string: "http://\(address):\(port)/")!
            }
        } else {
            let host = ProcessInfo.processInfo.hostName
            guard let fallback = URL(string: "http://\(host):\(port)/") else {
                throw SpeakEasyPadHostError.noReachableAddress
            }
            accessURL = fallback
        }
        lastObservedSnapshot = coordinator.currentSnapshot()
        stateTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.publishStateChangeIfNeeded() }
        }
    }

    func stop() {
        for client in clients.values { client.close(code: 1001) }
        clients.removeAll()
        listener?.cancel()
        listener = nil
        alias?.stop()
        alias = nil
        stateTimer?.invalidate()
        stateTimer = nil
        lastObservedSnapshot = nil
    }

    func disconnectAuthenticatedClients() {
        for client in clients.values where client.sessionID != nil {
            client.close(code: 4001)
        }
    }

    func disconnectAuthenticatedClient(sessionID: UUID) {
        for client in clients.values where client.sessionID == sessionID {
            client.close(code: 4001)
        }
    }

    private func startListener(port: NWEndpoint.Port) async throws {
        let next = try NWListener(using: .tcp, on: port)
        next.service = NWListener.Service(
            name: "SpeakEasy Pad",
            type: "_http._tcp",
            domain: "local.",
            txtRecord: NWTXTRecord(["path": "/", "protocol": "lan-prototype-v1"])
        )
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let gate = SpeakEasyPadContinuationGate()
            next.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    guard gate.claim() else { return }
                    continuation.resume()
                case .failed(let error):
                    guard gate.claim() else { return }
                    next.cancel()
                    continuation.resume(throwing: SpeakEasyPadHostError.failedToBind(error.localizedDescription))
                default:
                    break
                }
            }
            next.newConnectionHandler = { [weak self] connection in
                Task { @MainActor in self?.accept(connection) }
            }
            next.start(queue: queue)
        }
        listener = next
    }

    private func accept(_ connection: NWConnection) {
        let client = SpeakEasyPadWebSocketClient(connection: connection, queue: queue)
        let id = ObjectIdentifier(client)
        clients[id] = client
        client.onHTTPRequest = { [weak self, weak client] request in
            Task { @MainActor in
                guard let self, let client else { return }
                self.handle(request, client: client)
            }
        }
        client.onText = { [weak self, weak client] data in
            Task { @MainActor in
                guard let self, let client else { return }
                self.handleMessage(data, client: client)
            }
        }
        client.onClose = { [weak self, weak client] in
            Task { @MainActor in
                guard let self, let client else { return }
                self.clients[ObjectIdentifier(client)] = nil
                if let sessionID = client.sessionID,
                   !self.clients.values.contains(where: { $0.sessionID == sessionID }) {
                    self.onLeaseDisconnected?(sessionID)
                }
            }
        }
        client.start()
    }

    private func handle(_ request: SpeakEasyPadHTTPRequest, client: SpeakEasyPadWebSocketClient) {
        if request.path == "/pad", request.isWebSocketUpgrade {
            client.acceptWebSocket(key: request.webSocketKey)
            return
        }
        if request.path == "/health" {
            let body = Data(#"{"ok":true,"service":"speakeasy-pad","protocolVersion":1,"security":"lan-prototype-v1"}"#.utf8)
            client.sendHTTP(status: "200 OK", contentType: "application/json", body: body)
            return
        }
        if let asset = staticAsset(path: request.path) {
            client.sendHTTP(status: "200 OK", contentType: asset.contentType, body: asset.data)
            return
        }
        let body = Data(Self.missingClientHTML.utf8)
        client.sendHTTP(status: "200 OK", contentType: "text/html; charset=utf-8", body: body)
    }

    private func handleMessage(_ data: Data, client: SpeakEasyPadWebSocketClient) {
        if client.sessionID == nil {
            handleAuthentication(data, client: client)
            return
        }
        guard let sessionID = client.sessionID else { return }
        do {
            _ = try authority.authorize(sessionID: sessionID)
            let request = try JSONDecoder().decode(SpeakEasyPadCommandRequest.self, from: data)
            guard request.sessionId == sessionID else { throw SpeakEasyPadSecurityError.unknownSession }
            let response = coordinator.handle(request)
            lastObservedSnapshot = response.snapshot
            NSLog(
                "%@",
                "SpeakEasy Pad command: \(request.method) sequence=\(request.sequence) acknowledged=\(response.ok ? "yes" : "no")"
            )
            client.sendJSON(response)
        } catch {
            client.sendServerError(code: "invalid_request", message: error.localizedDescription)
        }
    }

    private func publishStateChangeIfNeeded() {
        var authorizedClients: [SpeakEasyPadWebSocketClient] = []
        for client in clients.values {
            guard let sessionID = client.sessionID else { continue }
            do {
                _ = try authority.authorize(sessionID: sessionID)
                authorizedClients.append(client)
            } catch {
                // Expiry and revocation are Mac-authoritative even for an
                // already-open socket. Check on every timer tick, including
                // ticks where no state event needs to be sent.
                client.close(code: 4001)
            }
        }

        let observed = coordinator.currentSnapshot()
        if let previous = lastObservedSnapshot, observed.hasSameBroadcastState(as: previous) { return }
        let changed: SpeakEasyPadRemoteSnapshot
        if let previous = lastObservedSnapshot,
           observed.hasSameConflictState(as: previous) {
            // Progress-only telemetry keeps the current conflict revision.
            changed = observed
        } else {
            changed = coordinator.stateDidChange()
        }
        lastObservedSnapshot = changed
        let event = SpeakEasyPadStateChanged(snapshot: changed)
        for client in authorizedClients { client.sendJSON(event) }
    }

    private func handleAuthentication(_ data: Data, client: SpeakEasyPadWebSocketClient) {
        do {
            let type = try JSONDecoder().decode(SpeakEasyPadMessageType.self, from: data).type
            switch type {
            case "bootstrap.redeem":
                let request = try JSONDecoder().decode(SpeakEasyPadPrototypeRedeem.self, from: data)
                guard request.protocolVersion == speakEasyPadProtocolVersion,
                      let secret = Data.speakEasyPadBase64URLDecoded(request.secret), secret.count == 32
                else { throw SpeakEasyPadSecurityError.invalidInvitation }
                let result = try authority.redeemLANPrototype(
                    tokenID: request.tokenId,
                    room: request.room,
                    secret: secret,
                    deviceName: request.deviceName
                )
                client.sessionID = result.lease.id
                client.sendJSON(SpeakEasyPadSessionAccepted(
                    sessionId: result.lease.id,
                    expiresAtMilliseconds: Int64(result.lease.expiresAt.timeIntervalSince1970 * 1_000),
                    reconnectSecret: result.reconnectSecret.speakEasyPadBase64URL,
                    snapshot: coordinator.currentSnapshot()
                ))
                onLeaseAccepted?(
                    result.lease,
                    client.ipAddress,
                    Self.macAddress(for: client.ipAddress)
                )
            case "session.resume":
                let request = try JSONDecoder().decode(SpeakEasyPadPrototypeResume.self, from: data)
                guard request.protocolVersion == speakEasyPadProtocolVersion,
                      let secret = Data.speakEasyPadBase64URLDecoded(request.reconnectSecret), secret.count == 32
                else { throw SpeakEasyPadSecurityError.invalidProof }
                let lease = try authority.resumeLANPrototype(
                    sessionID: request.sessionId,
                    reconnectSecret: secret
                )
                client.sessionID = lease.id
                client.sendJSON(SpeakEasyPadSessionAccepted(
                    sessionId: lease.id,
                    expiresAtMilliseconds: Int64(lease.expiresAt.timeIntervalSince1970 * 1_000),
                    reconnectSecret: request.reconnectSecret,
                    snapshot: coordinator.currentSnapshot()
                ))
                onLeaseAccepted?(
                    lease,
                    client.ipAddress,
                    Self.macAddress(for: client.ipAddress)
                )
            default:
                throw SpeakEasyPadSecurityError.invalidInvitation
            }
        } catch {
            client.sendServerError(code: "authentication_failed", message: error.localizedDescription)
            client.close(code: 4003)
        }
    }

    private func staticAsset(path: String) -> (data: Data, contentType: String)? {
        guard let root = staticRoot,
              FileManager.default.fileExists(atPath: root.path)
        else { return nil }
        let requested = path == "/" ? "index.html" : String(path.drop(while: { $0 == "/" }))
        let candidate = root.appendingPathComponent(requested).standardizedFileURL
        let rootPath = root.standardizedFileURL.path + "/"
        guard candidate.path.hasPrefix(rootPath),
              let data = try? Data(contentsOf: candidate), data.count <= 5 * 1_024 * 1_024
        else { return nil }
        return (data, Self.contentType(for: candidate.pathExtension))
    }

    private static func contentType(for extensionName: String) -> String {
        switch extensionName.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "json", "webmanifest": "application/json"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "woff2": "font/woff2"
        default: "application/octet-stream"
        }
    }

    /// ARP is inherently best-effort: it works for a recently seen IPv4 peer
    /// on the same LAN, while IPv6 and routed peers may not expose a MAC.
    private static func macAddress(for ipAddress: String?) -> String? {
        guard let ipAddress, ipAddress.contains("."), !ipAddress.contains(" ") else { return nil }
        let process = Process()
        let output = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/arp")
        process.arguments = ["-n", ipAddress]
        process.standardOutput = output
        process.standardError = Pipe()
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return nil
        }
        guard process.terminationStatus == 0,
              let text = String(data: output.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8),
              let range = text.range(
                of: #"(?i)\bat ([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5})\b"#,
                options: .regularExpression
              )
        else { return nil }
        return String(text[range].dropFirst(3)).uppercased()
    }

    private static func preferredIPv4Address() -> String? {
        var pointer: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&pointer) == 0, let first = pointer else { return nil }
        defer { freeifaddrs(pointer) }
        var candidates: [(priority: Int, address: String)] = []
        for item in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let interface = item.pointee
            guard let address = interface.ifa_addr,
                  address.pointee.sa_family == UInt8(AF_INET),
                  (interface.ifa_flags & UInt32(IFF_UP)) != 0,
                  (interface.ifa_flags & UInt32(IFF_LOOPBACK)) == 0
            else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(
                address,
                socklen_t(address.pointee.sa_len),
                &host,
                socklen_t(host.count),
                nil,
                0,
                NI_NUMERICHOST
            ) == 0 else { continue }
            let name = String(cString: interface.ifa_name)
            let priority = name.hasPrefix("en") ? 0 : 1
            candidates.append((priority, String(cString: host)))
        }
        return candidates.sorted { $0.priority < $1.priority }.first?.address
    }

    private static let missingClientHTML = #"""
    <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:16px system-ui;background:#0b0d0d;color:#eef2ee;display:grid;place-items:center;min-height:90vh}main{max-width:34rem;padding:2rem}code{color:#7cf5b4}</style>
    <main><h1>SpeakEasy Pad host is ready.</h1><p>The Pad web bundle is not installed in this build.</p><p>Set <code>SPEAKEASY_PAD_WEB_ROOT</code> to the built client directory for development.</p><p>This same-LAN pilot uses plaintext HTTP. Use only on a trusted network.</p></main>
    """#
}

private final class SpeakEasyPadContinuationGate: @unchecked Sendable {
    private let lock = NSLock()
    private var claimed = false

    func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !claimed else { return false }
        claimed = true
        return true
    }
}

private struct SpeakEasyPadMessageType: Decodable { let type: String }

private struct SpeakEasyPadPrototypeRedeem: Decodable {
    let type: String
    let protocolVersion: Int
    let tokenId: UUID
    let room: String
    let secret: String
    let deviceName: String?
}

private struct SpeakEasyPadPrototypeResume: Decodable {
    let type: String
    let protocolVersion: Int
    let sessionId: UUID
    let reconnectSecret: String
    let deviceName: String?
}

private struct SpeakEasyPadSessionAccepted: Encodable {
    let type = "session.accepted"
    let protocolVersion = speakEasyPadProtocolVersion
    let security = "lan-prototype-v1"
    let sessionId: UUID
    let expiresAtMilliseconds: Int64
    let reconnectSecret: String
    let snapshot: SpeakEasyPadRemoteSnapshot
}

private struct SpeakEasyPadStateChanged: Encodable {
    let type = "state.changed"
    let protocolVersion = speakEasyPadProtocolVersion
    let snapshot: SpeakEasyPadRemoteSnapshot
}

private struct SpeakEasyPadServerError: Encodable {
    let type = "error"
    let protocolVersion = speakEasyPadProtocolVersion
    let code: String
    let message: String
}

private struct SpeakEasyPadHTTPRequest {
    let path: String
    let headers: [String: String]

    var isWebSocketUpgrade: Bool {
        headers["upgrade"]?.lowercased() == "websocket"
            && headers["connection"]?.lowercased().contains("upgrade") == true
            && webSocketKey != nil
    }
    var webSocketKey: String? { headers["sec-websocket-key"] }
}

private final class SpeakEasyPadWebSocketClient {
    private let connection: NWConnection
    private let queue: DispatchQueue
    private var buffer = Data()
    private var upgraded = false
    private var didClose = false
    var sessionID: UUID?
    var onHTTPRequest: ((SpeakEasyPadHTTPRequest) -> Void)?
    var onText: ((Data) -> Void)?
    var onClose: (() -> Void)?

    var ipAddress: String? {
        guard case .hostPort(let host, _) = connection.endpoint else { return nil }
        let value = String(describing: host)
        if value.hasPrefix("::ffff:") { return String(value.dropFirst(7)) }
        return value
    }

    init(connection: NWConnection, queue: DispatchQueue) {
        self.connection = connection
        self.queue = queue
    }

    func start() {
        connection.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            if case .failed = state { self.finish() }
            if case .cancelled = state { self.finish() }
        }
        connection.start(queue: queue)
        receive()
    }

    func acceptWebSocket(key: String?) {
        guard let key else { close(code: 1002); return }
        let magic = Data((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").utf8)
        let accept = Data(Insecure.SHA1.hash(data: magic)).base64EncodedString()
        let response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: \(accept)\r\n\r\n"
        upgraded = true
        send(Data(response.utf8))
        parseFrames()
    }

    func sendHTTP(status: String, contentType: String, body: Data) {
        let header = "HTTP/1.1 \(status)\r\nContent-Type: \(contentType)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n"
        connection.send(content: Data(header.utf8) + body, completion: .contentProcessed { [weak self] _ in
            self?.connection.cancel()
        })
    }

    func sendJSON<T: Encodable>(_ value: T) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        sendFrame(opcode: 0x1, payload: data)
    }

    func sendServerError(code: String, message: String) {
        sendJSON(SpeakEasyPadServerError(code: code, message: message))
    }

    func close(code: UInt16) {
        guard !didClose else { return }
        var code = code.bigEndian
        let payload = withUnsafeBytes(of: &code) { Data($0) }
        if upgraded { sendFrame(opcode: 0x8, payload: payload) }
        connection.cancel()
        finish()
    }

    private func receive() {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, complete, error in
            guard let self else { return }
            if let data { self.buffer.append(data) }
            if self.upgraded { self.parseFrames() } else { self.parseHTTP() }
            if complete || error != nil { self.finish(); return }
            self.receive()
        }
    }

    private func parseHTTP() {
        guard buffer.count <= 16_384 else { close(code: 1009); return }
        let delimiter = Data("\r\n\r\n".utf8)
        guard let range = buffer.range(of: delimiter),
              let text = String(data: buffer[..<range.lowerBound], encoding: .utf8)
        else { return }
        buffer.removeSubrange(..<range.upperBound)
        let lines = text.components(separatedBy: "\r\n")
        guard let requestLine = lines.first else { close(code: 1002); return }
        let fields = requestLine.split(separator: " ")
        guard fields.count == 3, fields[0] == "GET" else { close(code: 1002); return }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            headers[key] = value
        }
        let path = String(fields[1]).split(separator: "?", maxSplits: 1).first.map(String.init) ?? "/"
        onHTTPRequest?(SpeakEasyPadHTTPRequest(path: path, headers: headers))
    }

    private func parseFrames() {
        while true {
            guard buffer.count >= 2 else { return }
            let first = buffer[buffer.startIndex]
            let second = buffer[buffer.index(after: buffer.startIndex)]
            let fin = first & 0x80 != 0
            let opcode = first & 0x0F
            let masked = second & 0x80 != 0
            var length = Int(second & 0x7F)
            var headerLength = 2
            if length == 126 {
                guard buffer.count >= 4 else { return }
                length = Int(buffer[2]) << 8 | Int(buffer[3])
                headerLength = 4
            } else if length == 127 {
                guard buffer.count >= 10 else { return }
                var value: UInt64 = 0
                for byte in buffer[2..<10] { value = (value << 8) | UInt64(byte) }
                guard value <= 65_536 else { close(code: 1009); return }
                length = Int(value)
                headerLength = 10
            }
            guard fin, masked, length <= 65_536 else { close(code: 1002); return }
            guard buffer.count >= headerLength + 4 + length else { return }
            let mask = Array(buffer[headerLength..<(headerLength + 4)])
            let payloadStart = headerLength + 4
            var payload = Data(buffer[payloadStart..<(payloadStart + length)])
            for index in payload.indices { payload[index] ^= mask[(index - payload.startIndex) % 4] }
            buffer.removeSubrange(..<(payloadStart + length))
            switch opcode {
            case 0x1: onText?(payload)
            case 0x8: close(code: 1000); return
            case 0x9: sendFrame(opcode: 0xA, payload: payload)
            case 0xA: break
            default: close(code: 1003); return
            }
        }
    }

    private func sendFrame(opcode: UInt8, payload: Data) {
        guard payload.count <= 65_536 else { close(code: 1009); return }
        var frame = Data([0x80 | opcode])
        if payload.count < 126 {
            frame.append(UInt8(payload.count))
        } else if payload.count <= Int(UInt16.max) {
            frame.append(126)
            var length = UInt16(payload.count).bigEndian
            frame.append(withUnsafeBytes(of: &length) { Data($0) })
        } else {
            frame.append(127)
            var length = UInt64(payload.count).bigEndian
            frame.append(withUnsafeBytes(of: &length) { Data($0) })
        }
        frame.append(payload)
        send(frame)
    }

    private func send(_ data: Data) {
        connection.send(content: data, completion: .contentProcessed { [weak self] error in
            if error != nil { self?.finish() }
        })
    }

    private func finish() {
        guard !didClose else { return }
        didClose = true
        onClose?()
    }
}

private final class SpeakEasyPadMDNSAlias {
    private let address: String
    private let queue = DispatchQueue(label: "app.speakeasy.pad.mdns")
    private var serviceRef: DNSServiceRef?
    private var recordRef: DNSRecordRef?

    init(address: String) { self.address = address }

    func start() -> Bool {
        var service: DNSServiceRef?
        guard DNSServiceCreateConnection(&service) == kDNSServiceErr_NoError,
              let service
        else { return false }
        guard DNSServiceSetDispatchQueue(service, queue) == kDNSServiceErr_NoError else {
            DNSServiceRefDeallocate(service)
            return false
        }
        var ipv4 = in_addr()
        guard inet_pton(AF_INET, address, &ipv4) == 1 else {
            DNSServiceRefDeallocate(service)
            return false
        }
        var record: DNSRecordRef?
        let status = withUnsafePointer(to: &ipv4.s_addr) { pointer in
            DNSServiceRegisterRecord(
                service,
                &record,
                DNSServiceFlags(kDNSServiceFlagsUnique),
                0,
                "pad.speakeasy.local.",
                UInt16(kDNSServiceType_A),
                UInt16(kDNSServiceClass_IN),
                UInt16(MemoryLayout<in_addr_t>.size),
                pointer,
                120,
                { _, _, _, _, _ in },
                nil
            )
        }
        guard status == kDNSServiceErr_NoError else {
            DNSServiceRefDeallocate(service)
            return false
        }
        serviceRef = service
        recordRef = record
        return true
    }

    func stop() {
        guard let serviceRef else { return }
        queue.sync { DNSServiceRefDeallocate(serviceRef) }
        self.serviceRef = nil
        recordRef = nil
    }
}
