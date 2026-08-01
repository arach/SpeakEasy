import Foundation
import Combine

/// Finds the SpeakEasy deck on the local network.
///
/// `speakeasy deck` advertises `_http._tcp` with a name like
/// "SpeakEasy Deck (air)" — browse, resolve the first match, and hand the
/// URL to the web surface. No QR, no typing.
final class DeckDiscovery: NSObject, ObservableObject, NetServiceBrowserDelegate, NetServiceDelegate {
    @Published var deckURL: URL?
    @Published var searching = true

    private let browser = NetServiceBrowser()
    private var candidates: [NetService] = []

    override init() {
        super.init()
        browser.delegate = self
        browser.searchForServices(ofType: "_http._tcp.", inDomain: "local.")
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        guard service.name.hasPrefix("SpeakEasy Deck") else { return }
        candidates.append(service)
        service.delegate = self
        service.resolve(withTimeout: 5)
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        guard deckURL == nil, let host = sender.hostName, sender.port > 0 else { return }
        // mDNS host names come back with a trailing dot; URL() dislikes it
        let cleanHost = host.hasSuffix(".") ? String(host.dropLast()) : host
        deckURL = URL(string: "http://\(cleanHost):\(sender.port)")
        searching = false
        browser.stop()
        candidates.forEach { $0.stop() }
    }

    func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        candidates.removeAll { $0 == sender }
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
        searching = false
    }
}
