import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI
import HudsonUI

/// Settings navigation requests originate outside SwiftUI (for example, the
/// menu-bar menu) and are consumed by the existing settings window.
extension Notification.Name {
    static let speakEasySettingsSectionRequested = Notification.Name(
        "SpeakEasySettingsSectionRequested"
    )
}

enum SpeakEasyPadServiceState: Equatable {
    case stopped
    case starting
    case ready
    case pairing
    case connected
    case unavailable
    case failed
}

struct SpeakEasyPadDevice: Identifiable, Equatable {
    let id: UUID
    var name: String
    var ipAddress: String?
    var macAddress: String?
    var isConnected: Bool
    var expiresAt: Date
}

struct SpeakEasyPadSnapshot: Equatable {
    var state: SpeakEasyPadServiceState
    var statusMessage: String
    var accessURL: URL?
    var pairingURL: URL?
    var pairingExpiresAt: Date?
    var sessionExpiresAt: Date?
    var connectedDeviceName: String?
    var devices: [SpeakEasyPadDevice] = []

    static let stopped = SpeakEasyPadSnapshot(
        state: .stopped,
        statusMessage: "Pad service is stopped."
    )

    static let starting = SpeakEasyPadSnapshot(
        state: .starting,
        statusMessage: "Starting the Pad service…"
    )
}

struct SpeakEasyPadPairing: Equatable {
    var accessURL: URL
    var pairingURL: URL
    var expiresAt: Date
}

/// A narrow bridge between the native shell and the concrete Pad host. The
/// host can land independently, then install an adapter during app startup.
/// Keeping the shell on snapshots also prevents transport details from leaking
/// into navigation and menu-bar code.
struct SpeakEasyPadRuntimeAdapter {
    typealias Publish = @MainActor (SpeakEasyPadSnapshot) -> Void

    var start: @MainActor (_ publish: @escaping Publish) async throws -> Void
    var stop: @MainActor () -> Void
    var beginPairing: @MainActor () async throws -> SpeakEasyPadPairing
    var endSession: @MainActor () async throws -> Void
    var revokeSession: @MainActor (_ sessionID: UUID) async throws -> Void
}

@MainActor
final class SpeakEasyPadIntegration: ObservableObject {
    static let shared = SpeakEasyPadIntegration()
    /// Local, no-install pilot endpoint. `.local` cannot receive a public TLS
    /// certificate and port 8255 (TALK) avoids privileged port binding while
    /// remaining easy to remember.
    static let defaultAccessURL = URL(string: "http://pad.speakeasy.local:8255")!

    @Published private(set) var snapshot = SpeakEasyPadSnapshot.stopped
    @Published private(set) var isPerformingAction = false

    private var adapter: SpeakEasyPadRuntimeAdapter?
    private var hasStarted = false

    private init() {}

    /// Installs the product runtime without making the native shell depend on
    /// its concrete server, relay, or pairing types.
    func install(adapter: SpeakEasyPadRuntimeAdapter) {
        self.adapter = adapter
        if hasStarted {
            Task { await startAdapter() }
        }
    }

    func start() {
        guard !hasStarted else { return }
        hasStarted = true
        Task { await startAdapter() }
    }

    func stop() {
        guard hasStarted else { return }
        hasStarted = false
        adapter?.stop()
        snapshot = .stopped
        isPerformingAction = false
    }

    func beginPairing() async {
        guard let adapter, !isPerformingAction else { return }
        isPerformingAction = true
        snapshot.state = .pairing
        snapshot.statusMessage = "Preparing a Pad pass for this app session…"

        do {
            let pairing = try await adapter.beginPairing()
            snapshot.state = .pairing
            snapshot.statusMessage = "Scan this code with the iPad camera."
            snapshot.accessURL = pairing.accessURL
            snapshot.pairingURL = pairing.pairingURL
            snapshot.pairingExpiresAt = pairing.expiresAt
        } catch {
            publishFailure("Couldn’t prepare iPad pairing: \(error.localizedDescription)")
        }
        isPerformingAction = false
    }

    func endSession() async {
        guard let adapter, !isPerformingAction else { return }
        isPerformingAction = true
        do {
            try await adapter.endSession()
            snapshot = SpeakEasyPadSnapshot(
                state: .ready,
                statusMessage: "Ready to connect an iPad.",
                accessURL: snapshot.accessURL ?? Self.defaultAccessURL
            )
        } catch {
            publishFailure("Couldn’t end the Pad session: \(error.localizedDescription)")
        }
        isPerformingAction = false
    }

    func revokeDevice(_ id: UUID) async {
        guard let adapter, !isPerformingAction else { return }
        isPerformingAction = true
        do {
            try await adapter.revokeSession(id)
        } catch {
            publishFailure("Couldn’t revoke the Pad: \(error.localizedDescription)")
        }
        isPerformingAction = false
    }

    func openPad() {
        NSWorkspace.shared.open(snapshot.accessURL ?? Self.defaultAccessURL)
    }

    var menuTitle: String {
        switch snapshot.state {
        case .connected:
            return snapshot.connectedDeviceName.map { "iPad Connected — \($0)" }
                ?? "iPad Connected"
        case .pairing:
            return "Show iPad Pairing Code…"
        default:
            if let expiry = snapshot.sessionExpiresAt, expiry > Date() {
                return snapshot.connectedDeviceName.map { "iPad Pass Active — \($0)" }
                    ?? "iPad Pass Active"
            }
            return "Connect iPad…"
        }
    }

    private func startAdapter() async {
        guard hasStarted else { return }
        guard let adapter else {
            snapshot = SpeakEasyPadSnapshot(
                state: .unavailable,
                statusMessage: "The Pad host is not available in this build yet.",
                accessURL: Self.defaultAccessURL
            )
            return
        }

        snapshot = .starting
        do {
            try await adapter.start { [weak self] next in
                guard let self, self.hasStarted else { return }
                self.snapshot = next
            }
            if snapshot.state == .starting {
                snapshot = SpeakEasyPadSnapshot(
                    state: .ready,
                    statusMessage: "Ready to connect an iPad.",
                    accessURL: Self.defaultAccessURL
                )
            }
        } catch {
            publishFailure("Pad service failed to start: \(error.localizedDescription)")
        }
    }

    private func publishFailure(_ message: String) {
        snapshot.state = .failed
        snapshot.statusMessage = message
    }
}

struct SpeakEasyPadSettingsView: View {
    @ObservedObject private var integration = SpeakEasyPadIntegration.shared
    @Environment(\.hudTheme) private var hudTheme

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xxl) {
            connectionCard

            if let pairingURL = integration.snapshot.pairingURL {
                pairingCard(url: pairingURL)
            } else {
                gettingStartedCard
            }

            if !integration.snapshot.devices.isEmpty {
                devicesCard
            }

            privacyCard
        }
        .frame(maxWidth: 760, alignment: .topLeading)
    }

    private var connectionCard: some View {
        HudCard {
            HStack(alignment: .center, spacing: HudSpacing.xl) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(HudPalette.statusOk.opacity(0.12))
                    Image(systemName: "ipad.and.iphone")
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle(HudPalette.statusOk)
                }
                .frame(width: 54, height: 54)

                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    HStack(spacing: HudSpacing.sm) {
                        Text(connectionTitle)
                            .font(HudFont.ui(15, weight: .semibold))
                            .foregroundStyle(hudTheme.palette.ink)
                        HudBadge(
                            stateLabel,
                            tint: stateColor,
                            dot: integration.snapshot.state == .connected
                        )
                    }
                    Text(integration.snapshot.statusMessage)
                        .font(HudFont.ui(11))
                        .foregroundStyle(hudTheme.palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: HudSpacing.xl)

                if hasLiveLease {
                    HudButton("End session", icon: "xmark", style: .ghost) {
                        Task { await integration.endSession() }
                    }
                    .disabled(integration.isPerformingAction)
                } else {
                    HudButton("Connect iPad", icon: "qrcode", style: .primary(.green)) {
                        Task { await integration.beginPairing() }
                    }
                    .disabled(!canBeginPairing || integration.isPerformingAction)
                }
            }
        }
    }

    private func pairingCard(url: URL) -> some View {
        HudCard {
            HStack(alignment: .center, spacing: HudSpacing.xxl) {
                SpeakEasyPadQRCodeView(url: url)
                    .frame(width: 220, height: 220)

                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    HudSectionLabel("PAIR WITH IPAD", tint: HudPalette.statusOk)
                    Text("Scan with the iPad camera")
                        .font(HudFont.ui(18, weight: .semibold))
                        .foregroundStyle(hudTheme.palette.ink)
                    Text("This day-pass link can open in Safari or another browser until it expires. Each browser appears below and can be revoked separately.")
                        .font(HudFont.ui(12))
                        .foregroundStyle(hudTheme.palette.muted)
                        .fixedSize(horizontal: false, vertical: true)

                    if let expiry = integration.snapshot.pairingExpiresAt {
                        pairingCountdown(expiresAt: expiry)
                    }

                    HStack(spacing: HudSpacing.md) {
                        HudButton("Open Pad", icon: "safari", style: .ghost) {
                            integration.openPad()
                        }
                        Button("Copy link") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(url.absoluteString, forType: .string)
                        }
                        .buttonStyle(.plain)
                        .font(HudFont.ui(11, weight: .medium))
                        .foregroundStyle(HudPalette.statusOk)
                    }
                }
            }
        }
    }

    private var gettingStartedCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("GETTING STARTED")

                instructionRow(
                    number: "01",
                    title: "Prepare a Pad pass",
                    detail: "Choose Connect iPad. Access lasts up to one day, or until SpeakEasy restarts."
                )
                HudDivider()
                instructionRow(
                    number: "02",
                    title: "Scan from the iPad",
                    detail: "Use Camera, then add pad.speakeasy.local to the Home Screen if you like."
                )
                HudDivider()
                instructionRow(
                    number: "03",
                    title: "Control your lanes",
                    detail: "SpeakEasy on this Mac stays authoritative for tasks, listening, and playback."
                )
            }
        }
    }

    private var privacyCard: some View {
        HudCard {
            HStack(alignment: .top, spacing: HudSpacing.md) {
                Image(systemName: "lock.shield")
                    .foregroundStyle(HudPalette.statusOk)
                VStack(alignment: .leading, spacing: HudSpacing.xs) {
                    Text("Local pilot · up to one day")
                        .font(HudFont.ui(12, weight: .semibold))
                        .foregroundStyle(hudTheme.palette.ink)
                    Text("The day-pass and every authorized browser can be revoked from this Mac. All access ends when SpeakEasy restarts.")
                        .font(HudFont.ui(11))
                        .foregroundStyle(hudTheme.palette.muted)
                }
            }
        }
    }

    private var devicesCard: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudSectionLabel("AUTHORIZED DEVICES")

                ForEach(Array(integration.snapshot.devices.enumerated()), id: \.element.id) { index, device in
                    if index > 0 { HudDivider() }
                    HStack(spacing: HudSpacing.md) {
                        Image(systemName: device.isConnected ? "ipad.gen2" : "ipad")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(device.isConnected ? HudPalette.statusOk : hudTheme.palette.muted)
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: HudSpacing.sm) {
                                Text(device.name)
                                    .font(HudFont.ui(12, weight: .semibold))
                                    .foregroundStyle(hudTheme.palette.ink)
                                Text(device.isConnected ? "ONLINE" : "OFFLINE")
                                    .font(HudFont.mono(9, weight: .bold))
                                    .foregroundStyle(device.isConnected ? HudPalette.statusOk : hudTheme.palette.muted)
                            }
                            Text(deviceAddress(device))
                                .font(HudFont.mono(10))
                                .foregroundStyle(hudTheme.palette.muted)
                        }

                        Spacer()

                        Button("Revoke") {
                            Task { await integration.revokeDevice(device.id) }
                        }
                        .buttonStyle(.plain)
                        .font(HudFont.ui(11, weight: .medium))
                        .foregroundStyle(HudPalette.statusWarn)
                        .disabled(integration.isPerformingAction)
                    }
                }
            }
        }
    }

    private func deviceAddress(_ device: SpeakEasyPadDevice) -> String {
        let ip = device.ipAddress ?? "IP unavailable"
        let mac = device.macAddress.map { "MAC \($0)" } ?? "MAC unavailable"
        return "\(ip)  ·  \(mac)"
    }

    private func instructionRow(number: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: HudSpacing.lg) {
            Text(number)
                .font(HudFont.mono(11, weight: .bold))
                .foregroundStyle(HudPalette.statusOk)
                .frame(width: 24, alignment: .leading)
            VStack(alignment: .leading, spacing: HudSpacing.xs) {
                Text(title)
                    .font(HudFont.ui(12, weight: .semibold))
                    .foregroundStyle(hudTheme.palette.ink)
                Text(detail)
                    .font(HudFont.ui(11))
                    .foregroundStyle(hudTheme.palette.muted)
            }
        }
    }

    private func pairingCountdown(expiresAt: Date) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let seconds = max(0, Int(expiresAt.timeIntervalSince(context.date)))
            HStack(spacing: HudSpacing.sm) {
                Image(systemName: seconds == 0 ? "clock.badge.exclamationmark" : "timer")
                Text(seconds == 0 ? "Pairing code expired" : "Expires in \(format(seconds: seconds))")
            }
            .font(HudFont.mono(11, weight: .semibold))
            .foregroundStyle(seconds == 0 ? HudPalette.statusWarn : HudPalette.statusOk)
        }
    }

    private var connectionTitle: String {
        integration.snapshot.connectedDeviceName ?? "SpeakEasy Pad"
    }

    private var stateLabel: String {
        switch integration.snapshot.state {
        case .stopped: return "STOPPED"
        case .starting: return "STARTING"
        case .ready: return "READY"
        case .pairing: return "PAIRING"
        case .connected: return "CONNECTED"
        case .unavailable: return "UNAVAILABLE"
        case .failed: return "ERROR"
        }
    }

    private var stateColor: Color {
        switch integration.snapshot.state {
        case .ready, .pairing, .connected: return HudPalette.statusOk
        case .starting: return HudPalette.statusInfo
        case .failed: return HudPalette.statusWarn
        case .stopped, .unavailable: return HudPalette.muted
        }
    }

    private var canBeginPairing: Bool {
        guard !hasLiveLease else { return false }
        switch integration.snapshot.state {
        case .ready, .pairing, .failed: return true
        case .stopped, .starting, .connected, .unavailable: return false
        }
    }

    private var hasLiveLease: Bool {
        guard let expiry = integration.snapshot.sessionExpiresAt else { return false }
        return expiry > Date()
    }

    private func format(seconds: Int) -> String {
        if seconds >= 60 * 60 {
            return String(format: "%dh %02dm", seconds / 3600, (seconds % 3600) / 60)
        }
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

struct SpeakEasyPadQRCodeView: View {
    let url: URL

    @ViewBuilder
    var body: some View {
        if let image = Self.makeImage(for: url) {
            SwiftUI.Image(nsImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .padding(12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.black.opacity(0.08), lineWidth: 1)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("SpeakEasy pairing QR code")
                .accessibilityValue(url.absoluteString)
        } else {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(HudPalette.surface)
                .overlay {
                    SwiftUI.Image(systemName: "qrcode")
                        .font(.system(size: 48))
                        .foregroundStyle(HudPalette.muted)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("SpeakEasy pairing QR code unavailable")
        }
    }

    private static func makeImage(for url: URL) -> NSImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(url.absoluteString.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }

        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        let context = CIContext(options: [.useSoftwareRenderer: false])
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    }
}
