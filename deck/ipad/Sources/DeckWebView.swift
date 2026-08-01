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
        capture.onTranscript = { [weak self] text, isFinal, failure in
            self?.pushTranscript(text, isFinal: isFinal, failure: failure)
        }
        capture.onFallback = { [weak self] url, reason in
            self?.transcribeLocally(url, reason: reason)
        }
    }

    deinit {
        capture.abort()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "speakeasyDeck")
    }

    private func loadIfNeeded() {
        guard let url = deckURL else { return }
        capture.abort()
        // the deck page ships with the server build — never let a stale
        // WKWebView cache hold an old copy
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
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
    private func pushTranscript(_ text: String, isFinal: Bool, failure: String?) {
        let jsFailure = failure.map(Self.jsString) ?? "null"
        let js = "window.speakeasyDeck && window.speakeasyDeck.nativeTranscript(\(Self.jsString(text)), \(isFinal ? "true" : "false"), \(jsFailure));"
        DispatchQueue.main.async { [weak self] in
            self?.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private struct TranscriptionResult: Decodable {
        let ok: Bool
        let text: String?
        let error: String?
    }

    private func transcribeLocally(_ fileURL: URL, reason: String) {
        guard let endpoint = transcriptionEndpoint() else {
            try? FileManager.default.removeItem(at: fileURL)
            pushTranscript("", isFinal: true, failure: "LOCAL TRANSCRIBER UNAVAILABLE")
            return
        }

        // Keep the pending hold visibly alive while the Mac loads/runs the
        // local model. The final callback settles the same native capture.
        pushTranscript("", isFinal: false, failure: reason)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 185
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("audio/wav", forHTTPHeaderField: "Content-Type")

        URLSession.shared.uploadTask(with: request, fromFile: fileURL) { [weak self] data, response, error in
            defer { try? FileManager.default.removeItem(at: fileURL) }
            guard let self else { return }
            if let error {
                self.pushTranscript("", isFinal: true, failure: error.localizedDescription.uppercased())
                return
            }
            guard let http = response as? HTTPURLResponse,
                  let data,
                  let result = try? JSONDecoder().decode(TranscriptionResult.self, from: data),
                  (200..<300).contains(http.statusCode),
                  result.ok,
                  let text = result.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty else {
                let message = data.flatMap { try? JSONDecoder().decode(TranscriptionResult.self, from: $0).error }
                self.pushTranscript("", isFinal: true, failure: message?.uppercased() ?? "LOCAL TRANSCRIPTION FAILED")
                return
            }
            self.pushTranscript(text, isFinal: true, failure: nil)
        }.resume()
    }

    private func transcriptionEndpoint() -> URL? {
        guard let deckURL, var components = URLComponents(url: deckURL, resolvingAgainstBaseURL: false) else {
            return nil
        }
        let token = components.fragment.flatMap { fragment in
            URLComponents(string: "https://local.invalid/?\(fragment)")?
                .queryItems?
                .first(where: { $0.name == "k" })?
                .value
        }
        components.path = "/api/transcribe"
        components.query = nil
        components.fragment = nil
        if let token, !token.isEmpty {
            components.queryItems = [URLQueryItem(name: "k", value: token)]
        }
        return components.url
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
