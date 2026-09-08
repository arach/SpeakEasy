import SwiftUI

/// The hybrid deck: native controls on the left, WebKit lane presentation on
/// the right, both synchronized through the Mac runtime.
struct DeckRootView: View {
    @StateObject private var discovery = DeckDiscovery()
    @StateObject private var connection = DeckConnection()
    @StateObject private var voice = DeckVoice()
    @StateObject private var laneViewer = DeckLaneViewerController()
    @AppStorage(DeckThemeSelection.defaultsKey) private var selectedThemeRaw = DeckThemeID.flight.rawValue

    var body: some View {
        Group {
            if let deck = discovery.selectedDeck {
                ZStack(alignment: .bottomTrailing) {
                    NativeDeckView(
                        connection: connection,
                        voice: voice,
                        laneViewer: laneViewer,
                        selectedDeck: deck,
                        onFindDecks: { discovery.refresh() }
                    )
                        .onAppear {
                            voice.attach(to: connection)
                            connection.connect(to: deck.url)
                            laneViewer.deckURL = deck.url
                        }
                        .onChange(of: deck.url) { _, newValue in
                            connection.connect(to: newValue)
                            laneViewer.deckURL = newValue
                        }

                    if discovery.decks.count > 1 {
                        machineMenu(selected: deck)
                            .padding(.bottom, 20)
                            .padding(.trailing, 20)
                    }
                }
            } else {
                VStack(spacing: 16) {
                    VStack(spacing: 9) {
                        SpeakEasyMark(size: 48)
                        Text("DECK")
                            .font(.system(size: 14, weight: .semibold, design: .monospaced))
                            .tracking(3.2)
                        Text("OPENSCOUT")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .tracking(2.2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.bottom, 14)

                    ProgressView()
                        .controlSize(.large)
                    Text(discovery.searching ? "Finding your Mac…" : "Deck is offline")
                        .font(.system(.headline, design: .monospaced))
                    Text(discovery.searching
                         ? "Start Deck on your Mac with `speakeasy deck` — it shows up here on its own."
                         : "Start Deck with `speakeasy deck` on a Mac connected to this Wi-Fi network.")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
            }
        }
        .onDisappear { connection.disconnect() }
    }

    private func machineMenu(selected: DiscoveredDeck) -> some View {
        Menu {
            ForEach(discovery.decks) { deck in
                Button {
                    discovery.select(deck)
                } label: {
                    Label(deck.displayName, systemImage: deck.id == selected.id ? "checkmark" : "desktopcomputer")
                }
            }
            Divider()
            Button("Find Macs again", systemImage: "arrow.clockwise") {
                discovery.refresh()
            }
        } label: {
            Label(selected.displayName, systemImage: "rectangle.connected.to.line.below")
                .font(.system(.caption, design: .monospaced, weight: .semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .foregroundStyle(DeckPalette.accent)
                .background(DeckPalette.accentDark.opacity(0.94), in: Capsule())
                .overlay { Capsule().stroke(DeckPalette.accentEdge, lineWidth: 1) }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Current Deck Mac: \(selected.displayName)")
    }
}
