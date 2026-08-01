import SwiftUI

/// The whole app: the deck web surface, discovered on the LAN and hosted
/// full-screen with the native speech bridge attached. The page itself owns
/// the WebSocket to the Mac runtime.
struct DeckRootView: View {
    @StateObject private var discovery = DeckDiscovery()
    @StateObject private var controller = DeckWebController()

    var body: some View {
        Group {
            if let url = discovery.deckURL {
                DeckWebView(controller: controller)
                    .ignoresSafeArea()
                    .onAppear { controller.deckURL = url }
                    .onChange(of: url) { _, newValue in controller.deckURL = newValue }
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
}
