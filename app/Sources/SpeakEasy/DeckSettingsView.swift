import SwiftUI
import AppKit

/// The Deck tab: understand the deck (live status from the runtime's own
/// snapshot) and configure the bridge (start/stop, pairing, port) in one place.
struct DeckSettingsView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @StateObject private var bridge = DeckBridgeController.shared
    @State private var portText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if !bridge.onboardingComplete {
                setupSection
            } else {
                statusSection
                if bridge.running, let deviceURL = bridge.deviceURLString, let url = URL(string: deviceURL) {
                    deviceSection(url: url)
                }
                bridgeSection
            }
            Spacer()
        }
        .onAppear {
            portText = config.deckPort.map(String.init) ?? ""
            // bridge edits must be on disk before any CLI start reads them
            bridge.onBeforeStart = { config.saveConfig() }
            bridge.beginUpdates()
            // the assign menus read the mapper catalog — load it once on appear
            bridge.refreshCatalog()
        }
        .onDisappear { bridge.endUpdates() }
    }

    // MARK: - Understand

    private var setupSection: some View {
        GlassSection(title: "Get Started", icon: "checklist", color: .clear) {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Three checks, then talk to Codex")
                        .font(.headline)
                        .foregroundColor(theme.text)
                    Text("The app carries the runtime. There are no server packages, URLs, or Caddy steps to configure.")
                        .font(.caption)
                        .foregroundColor(theme.textSecondary)
                }

                setupRow(
                    number: 1,
                    title: "SpeakEasy runtime",
                    detail: bridge.includesRuntime ? "Included in this app" : "Build or install the release app",
                    ready: bridge.includesRuntime
                )

                setupRow(
                    number: 2,
                    title: "Codex",
                    detail: codexReadinessDetail,
                    ready: bridge.codexPath != nil,
                    buttonTitle: bridge.readinessChecked && bridge.codexPath == nil ? "Check Again" : nil,
                    action: bridge.checkReadiness
                )

                setupRow(
                    number: 3,
                    title: "Deck bridge",
                    detail: deckReadinessDetail,
                    ready: bridge.running && bridge.snapshot != nil && !bridge.unreachable,
                    buttonTitle: bridge.running ? nil : "Start Deck",
                    action: bridge.start,
                    buttonDisabled: bridge.codexPath == nil || bridge.actionInFlight
                )

                if let error = bridge.actionError {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.orange)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                        Button("Open log") { bridge.openLog() }
                            .buttonStyle(.glassCompat)
                    }
                }
            }
        }
    }

    private var codexReadinessDetail: String {
        if let path = bridge.codexPath {
            return "Found \(URL(fileURLWithPath: path).lastPathComponent)"
        }
        return bridge.readinessChecked
            ? "Open the Codex desktop app or add codex to your login shell"
            : "Checking your login shell…"
    }

    private var deckReadinessDetail: String {
        if bridge.running && bridge.snapshot != nil && !bridge.unreachable { return "Ready for browser and iPad" }
        if bridge.running { return "Starting the live data plane…" }
        return "Starts locally and publishes the device link"
    }

    private func setupRow(
        number: Int,
        title: String,
        detail: String,
        ready: Bool,
        buttonTitle: String? = nil,
        action: (() -> Void)? = nil,
        buttonDisabled: Bool = false
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: ready ? "checkmark.circle.fill" : "\(number).circle")
                .foregroundColor(ready ? .green : theme.textTertiary)
                .font(.system(size: 17, weight: .medium))
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(theme.text)
                Text(detail)
                    .font(.caption)
                    .foregroundColor(theme.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            if let buttonTitle, let action {
                Button(buttonTitle, action: action)
                    .buttonStyle(.glassProminentCompat)
                    .disabled(buttonDisabled)
            }
        }
        .padding(.vertical, 2)
    }

    private var statusSection: some View {
        GlassSection(title: "Status", icon: "dot.radiowaves.left.and.right", color: .clear) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(bridge.running ? Color.green : theme.textTertiary)
                        .frame(width: 8, height: 8)
                    if bridge.running, let discovery = bridge.discovery {
                        // String(port) — a raw Int interpolation gets locale grouping ("43,211")
                        Text("Running on \(discovery.host) · port \(String(discovery.port))")
                            .font(.subheadline)
                            .foregroundColor(theme.text)
                    } else {
                        Text("Stopped")
                            .font(.subheadline)
                            .foregroundColor(theme.textSecondary)
                    }
                    Spacer()
                    if let snapshot = bridge.snapshot {
                        Text("\(snapshot.clients) device\(snapshot.clients == 1 ? "" : "s") connected")
                            .font(.caption)
                            .foregroundColor(theme.textSecondary)
                    }
                }

                if bridge.running && bridge.unreachable {
                    Text("Process is alive but the runtime isn't answering — check ~/.config/speakeasy/deck.log")
                        .font(.caption)
                        .foregroundColor(.orange)
                }

                if let snapshot = bridge.snapshot {
                    laneRows(snapshot)
                    if !snapshot.trace.isEmpty {
                        traceRows(snapshot)
                    }
                } else if !bridge.running {
                    Text("Start the deck to see lanes, threads, and live activity here.")
                        .font(.caption)
                        .foregroundColor(theme.textSecondary)
                }
            }
        }
    }

    private func laneRows(_ snapshot: DeckBridgeController.Snapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("LANES")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(theme.textTertiary)
            ForEach(Array(snapshot.lanes.enumerated()), id: \.element.num) { index, lane in
                HStack(spacing: 10) {
                    Circle()
                        .fill(laneColor(lane.state))
                        .frame(width: 6, height: 6)
                    Text(lane.name)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(theme.textSecondary)
                        .frame(width: 76, alignment: .leading)
                    Text(lane.title)
                        .font(.caption)
                        .foregroundColor(theme.text)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    if let alias = lane.sessionAlias {
                        Text(alias.uppercased())
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(theme.textTertiary)
                    }
                    // the overview lane is deck-owned — only worker lanes are mappable
                    if index < 9 {
                        laneMenu(lane: lane, index: index, catalog: snapshot.catalog ?? [])
                    }
                }
            }
            HStack(spacing: 8) {
                Text(snapshot.confirm)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(theme.textSecondary)
                Spacer()
            }
            .padding(.top, 2)
        }
    }

    /// Per-lane mapper: fresh session or any recent codex thread — the same
    /// lane.assign intent the deck's own picker sends.
    private func laneMenu(
        lane: DeckBridgeController.Lane,
        index: Int,
        catalog: [DeckBridgeController.CatalogThread]
    ) -> some View {
        Menu {
            Button("Fresh session") { bridge.assign(lane: index, threadId: nil) }
            if catalog.isEmpty {
                Button("Load recent threads…") { bridge.refreshCatalog() }
            } else {
                Divider()
                ForEach(catalog, id: \.id) { thread in
                    Button {
                        bridge.assign(lane: index, threadId: thread.id)
                    } label: {
                        HStack {
                            Text("\(String(thread.snippet.prefix(60))) · \(thread.projectLabel) · \(thread.alias)")
                            if lane.threadId == thread.id {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.system(size: 13))
                .foregroundColor(theme.textTertiary)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
    }

    private func traceRows(_ snapshot: DeckBridgeController.Snapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("TRACE")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(theme.textTertiary)
            ForEach(snapshot.trace.prefix(5), id: \.at) { entry in
                HStack(spacing: 8) {
                    Text(entry.at)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(theme.textTertiary)
                    Text(entry.kind)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundColor(theme.textSecondary)
                    Text(entry.detail)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(theme.textTertiary)
                        .lineLimit(1)
                    Spacer()
                }
            }
        }
    }

    private func laneColor(_ state: String) -> Color {
        switch state {
        case "speaking": return .green
        case "working": return .orange
        case "empty": return theme.textTertiary.opacity(0.4)
        default: return theme.textTertiary
        }
    }

    // MARK: - Configure the bridge

    private func deviceSection(url: URL) -> some View {
        GlassSection(title: "Devices", icon: "ipad.and.iphone", color: .clear) {
            HStack(alignment: .center, spacing: 20) {
                SpeakEasyPadQRCodeView(url: url)
                    .frame(width: 132, height: 132)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Open this deck from another device")
                        .font(.headline)
                        .foregroundColor(theme.text)
                    Text("Scan with the iPad camera, or copy the link to any laptop on the same Wi-Fi. Add it to the Home Screen for an app-like deck.")
                        .font(.caption)
                        .foregroundColor(theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let host = bridge.discovery?.host {
                        Text("This Mac appears as SpeakEasy Deck (\(host)).")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(theme.textTertiary)
                    }

                    HStack(spacing: 10) {
                        Button("Open Deck") { NSWorkspace.shared.open(url) }
                            .buttonStyle(.glassCompat)
                        Button("Copy link") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(url.absoluteString, forType: .string)
                        }
                        .buttonStyle(.glassCompat)
                    }

                    if let trustURL = bridge.iPadTrustURL {
                        VStack(alignment: .leading, spacing: 7) {
                            Text("FIRST IPAD CONNECTION")
                                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                .foregroundColor(theme.textTertiary)
                            Text("Open the one-time trust link on the iPad, install the profile, then enable Caddy Local Authority in Settings → General → About → Certificate Trust Settings.")
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                            Button("Copy iPad trust link") {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(trustURL.absoluteString, forType: .string)
                            }
                            .buttonStyle(.glassCompat)
                        }
                        .padding(.top, 4)
                    }
                }
            }
        }
    }

    private var bridgeSection: some View {
        GlassSection(title: "Bridge", icon: "point.3.connected.trianglepath.dotted", color: .clear) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    if bridge.running {
                        Button("Stop") { bridge.stop() }
                            .buttonStyle(.glassCompat)
                            .disabled(bridge.actionInFlight)
                        Button("Restart") { bridge.restart() }
                            .buttonStyle(.glassCompat)
                            .disabled(bridge.actionInFlight)
                    } else {
                        Button("Start Deck") { bridge.start() }
                            .buttonStyle(.glassProminentCompat)
                            .disabled(bridge.actionInFlight)
                    }
                    Spacer()
                    if bridge.includesRuntime {
                        Label("Runtime included", systemImage: "checkmark.seal")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }

                if let error = bridge.actionError {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.orange)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Toggle("Require pairing token", isOn: Binding(
                    get: { config.deckPair },
                    set: { config.deckPair = $0 }
                ))
                .toggleStyle(.switch)
                Text("When on, devices need the token URL (Copy iPad URL) to reach the bridge.")
                .font(.caption)
                .foregroundColor(theme.textSecondary)

                Toggle("Start the deck with SpeakEasy", isOn: Binding(
                    get: { config.deckAutoStart },
                    set: {
                        config.deckAutoStart = $0
                        config.saveConfig()
                        if $0 { bridge.startIfNeeded() }
                    }
                ))
                .toggleStyle(.switch)
                Text("Keeps the bridge ready whenever the menu-bar app is running.")
                    .font(.caption)
                    .foregroundColor(theme.textSecondary)

                HStack {
                    Text("Port")
                        .font(.subheadline)
                        .foregroundColor(theme.text)
                    TextField("auto", text: $portText)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 90)
                        .onSubmit { commitPort() }
                        .onChange(of: portText) { commitPort() }
                    Text("empty = 43211+ (port 80 only when permitted)")
                        .font(.caption)
                        .foregroundColor(theme.textSecondary)
                }

                if bridge.running {
                    Text("Bridge changes apply on the next deck start — use Restart.")
                        .font(.caption)
                        .foregroundColor(theme.textTertiary)
                }
            }
        }
    }

    private func commitPort() {
        let trimmed = portText.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            if config.deckPort != nil { config.deckPort = nil }
            return
        }
        guard let value = Int(trimmed), value >= 1024, value <= 65535 else { return }
        if config.deckPort != value { config.deckPort = value }
    }
}
