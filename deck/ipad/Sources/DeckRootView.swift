import SwiftUI
import HudsonUIWeb

/// The whole app: the deck web surface, discovered on the LAN and hosted
/// full-screen. The page itself owns the WebSocket to the Mac runtime.
struct DeckRootView: View {
    @StateObject private var discovery = DeckDiscovery()
    @State private var webState = HudWebViewState()

    var body: some View {
        Group {
            if let url = discovery.deckURL {
                HudWebView(
                    .url(url),
                    state: $webState,
                    configuration: HudWebViewConfiguration(
                        allowsBackForwardNavigationGestures: false,
                        isInspectable: true
                    )
                )
                .id(url) // rebuild when the discovered endpoint changes
                .ignoresSafeArea()
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
