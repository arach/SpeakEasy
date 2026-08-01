import SwiftUI
import AppKit

/// The Deck tab: understand the deck (live status from the runtime's own
/// snapshot) and configure the bridge (start/stop, pairing, port) in one place.
struct DeckSettingsView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @StateObject private var bridge = DeckBridgeController()
    @State private var portText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            statusSection
            bridgeSection
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
                            Text("\(String(thread.snippet.prefix(60))) · \(thread.project) · \(thread.alias)")
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
                    if let deviceURL = bridge.deviceURLString, let url = URL(string: deviceURL) {
                        Button("Open Deck") { NSWorkspace.shared.open(url) }
                            .buttonStyle(.glassCompat)
                        Button("Copy iPad URL") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(deviceURL, forType: .string)
                        }
                        .buttonStyle(.glassCompat)
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

                HStack {
                    Text("Port")
                        .font(.subheadline)
                        .foregroundColor(theme.text)
                    TextField("auto", text: $portText)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 90)
                        .onSubmit { commitPort() }
                        .onChange(of: portText) { commitPort() }
                    Text("empty = auto (80 when free, else 43211+)")
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
