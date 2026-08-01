import SwiftUI

/// The whole app: the deck web surface, discovered on the LAN and hosted
/// full-screen with the native speech bridge attached. The page itself owns
/// the WebSocket to the Mac runtime.
struct DeckRootView: View {
    @StateObject private var discovery = DeckDiscovery()
    @StateObject private var controller = DeckWebController()

    var body: some View {
        Group {
            if let deck = discovery.selectedDeck {
                ZStack(alignment: .topTrailing) {
                    DeckWebView(controller: controller)
                        .ignoresSafeArea()
                        .onAppear { controller.deckURL = deck.url }
                        .onChange(of: deck.url) { _, newValue in controller.deckURL = newValue }

                    if discovery.decks.count > 1 {
                        machineMenu(selected: deck)
                            .padding(.top, 12)
                            .padding(.trailing, 14)
                    }
                }
            } else {
                VStack(spacing: 16) {
                    ProgressView()
                        .controlSize(.large)
                    Text(discovery.searching ? "Finding your Mac…" : "No deck found")
                        .font(.system(.headline, design: .monospaced))
                    Text(discovery.searching
                         ? "Run `speakeasy deck` on your Mac — it shows up here on its own."
                         : "Start the deck on your Mac with `speakeasy deck`, on the same Wi-Fi.")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
            }
        }
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
                .background(.ultraThinMaterial, in: Capsule())
                .overlay { Capsule().stroke(.white.opacity(0.16), lineWidth: 1) }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Current SpeakEasy Mac: \(selected.displayName)")
    }
}
