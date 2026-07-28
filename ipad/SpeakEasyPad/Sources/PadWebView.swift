import SwiftUI
import UIKit
import WebKit

struct PadWebView: UIViewRepresentable {
    let url: URL
    let reloadToken: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(allowedHost: url.host)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: "speakeasyNative")
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.SPEAKEASY_PAD_NATIVE={platform:'iPadOS',capabilities:['haptics.v1','camera.pairing.v1']};",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.bounces = false
        view.isOpaque = false
        view.backgroundColor = .clear
        view.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        context.coordinator.lastURL = url
        context.coordinator.lastReloadToken = reloadToken
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        if context.coordinator.lastURL != url {
            context.coordinator.allowedHost = url.host
            context.coordinator.lastURL = url
            context.coordinator.lastReloadToken = reloadToken
            view.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        } else if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            view.reloadFromOrigin()
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var allowedHost: String?
        var lastURL: URL?
        var lastReloadToken: UUID?

        init(allowedHost: String?) {
            self.allowedHost = allowedHost
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "speakeasyNative",
                  let body = message.body as? [String: Any],
                  let kind = body["kind"] as? String
            else { return }
            switch kind {
            case "acknowledged":
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "error":
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            case "selection":
                UISelectionFeedbackGenerator().selectionChanged()
            default:
                break
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard navigationAction.navigationType == .linkActivated,
                  let destination = navigationAction.request.url,
                  destination.host != allowedHost
            else {
                decisionHandler(.allow)
                return
            }
            UIApplication.shared.open(destination)
            decisionHandler(.cancel)
        }
    }
}
