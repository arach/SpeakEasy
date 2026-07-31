import SwiftUI
import WebKit

/// The deck's web surface with the native speech bridge attached.
///
/// HudWebView does not (yet) expose script message handlers, so this surface
/// follows the HudCanvasSurface handler convention directly: the page posts
/// capture phases to `speakeasyDeck`, the controller drives SpeechCapture,
/// and transcripts go back via `window.speakeasyDeck.nativeTranscript`.
final class DeckWebController: NSObject, ObservableObject, WKNavigationDelegate, WKScriptMessageHandler {
    let webView: WKWebView
    let capture = SpeechCapture()

    var deckURL: URL? {
        didSet { loadIfNeeded() }
    }

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.speakeasyNativeTranscription = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        configuration.userContentController.add(self, name: "speakeasyDeck")
        webView.navigationDelegate = self
        webView.isInspectable = true
        capture.onTranscript = { [weak self] text, isFinal in
            self?.pushTranscript(text, isFinal: isFinal)
        }
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "speakeasyDeck")
    }

    private func loadIfNeeded() {
        guard let url = deckURL else { return }
        webView.load(URLRequest(url: url))
    }

    // JS → native: capture phases from the page's host bridge
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "speakeasyDeck",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String, type == "capture",
              let phase = body["phase"] as? String else { return }
        switch phase {
        case "start": capture.start()
        case "end": capture.finish()
        case "cancel": capture.abort()
        default: break
        }
    }

    // native → JS: partial and final transcripts
    private func pushTranscript(_ text: String, isFinal: Bool) {
        let js = "window.speakeasyDeck && window.speakeasyDeck.nativeTranscript(\(Self.jsString(text)), \(isFinal ? "true" : "false"));"
        DispatchQueue.main.async { [weak self] in
            self?.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private static func jsString(_ string: String) -> String {
        var out = string.replacingOccurrences(of: "\\", with: "\\\\")
        out = out.replacingOccurrences(of: "'", with: "\\'")
        out = out.replacingOccurrences(of: "\n", with: "\\n")
        out = out.replacingOccurrences(of: "\r", with: "")
        return "'\(out)'"
    }
}

struct DeckWebView: UIViewRepresentable {
    let controller: DeckWebController

    func makeUIView(context: Context) -> WKWebView {
        controller.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
