import SwiftUI
import WebKit
import Security
import OSLog

/// Presentation-only WebKit surface for the right side of the hybrid deck.
///
/// The page keeps a read/write runtime socket so its player and trace controls
/// remain useful. `nativeAudio=1` prevents it from creating a second audio
/// engine; DeckConnection owns capture and playback for the whole iPad shell.
final class DeckLaneViewerController: NSObject, ObservableObject, WKNavigationDelegate {
    let webView: WKWebView
    private let logger = Logger(subsystem: "dev.arach.speakeasy.deck", category: "lane-viewer")

    var deckURL: URL? {
        didSet { loadLaneViewer() }
    }

    var theme: DeckThemeID = .flight {
        didSet {
            guard oldValue != theme else { return }
            applyTheme()
        }
    }

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        webView.navigationDelegate = self
        webView.isInspectable = true
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = .clear
        }
    }

    private func loadLaneViewer() {
        guard let source = deckURL,
              let url = Self.laneViewerURL(from: source, theme: theme) else { return }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func applyTheme() {
        guard webView.url != nil else { return }
        webView.evaluateJavaScript("window.speakeasyDeck?.setTheme('\(theme.webTheme)')") { [logger] _, error in
            if let error {
                logger.error("Lane viewer theme update failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private static func laneViewerURL(from source: URL, theme: DeckThemeID) -> URL? {
        guard var components = URLComponents(url: source, resolvingAgainstBaseURL: false) else {
            return nil
        }
        var items = components.queryItems ?? []
        let ownedNames = Set(["surface", "nativeAudio", "theme", "trace"])
        items.removeAll { ownedNames.contains($0.name) }
        items.append(contentsOf: [
            URLQueryItem(name: "surface", value: "console"),
            URLQueryItem(name: "nativeAudio", value: "1"),
            URLQueryItem(name: "theme", value: theme.webTheme),
            URLQueryItem(name: "trace", value: "1"),
        ])
        components.queryItems = items
        return components.url
    }

    /// Trust the paired Mac's private CA only for this view and exact host.
    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              let pairedHost = deckURL?.host,
              challenge.protectionSpace.host.caseInsensitiveCompare(pairedHost) == .orderedSame,
              let anchor = DeckProvisioning.trustAnchor else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        SecTrustSetAnchorCertificates(trust, [anchor] as CFArray)
        SecTrustSetAnchorCertificatesOnly(trust, true)
        var error: CFError?
        guard SecTrustEvaluateWithError(trust, &error) else {
            logger.error("Rejected paired Deck certificate: \(error?.localizedDescription ?? "unknown trust error", privacy: .public)")
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        logger.error("Lane viewer navigation failed: \(error.localizedDescription, privacy: .public)")
    }
}

struct DeckLaneWebView: UIViewRepresentable {
    let controller: DeckLaneViewerController

    func makeUIView(context: Context) -> WKWebView {
        controller.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
