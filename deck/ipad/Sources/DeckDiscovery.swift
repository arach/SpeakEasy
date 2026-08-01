import Foundation
import Combine

struct DiscoveredDeck: Identifiable, Hashable {
    let id: String
    let serviceName: String
    let url: URL

    var displayName: String {
        let cleaned = serviceName
            .replacingOccurrences(of: "SpeakEasy Deck", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "()"))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? (url.host ?? "Mac") : cleaned
    }
}

/// Finds every SpeakEasy deck on the local network and remembers the last Mac.
///
/// Each installed Mac advertises its own `_http._tcp` service. Keeping the
/// browser alive turns adding a second machine into discovery, not setup: it
/// appears in the machine menu and can be selected without typing a URL.
final class DeckDiscovery: NSObject, ObservableObject, NetServiceBrowserDelegate, NetServiceDelegate {
    @Published private(set) var decks: [DiscoveredDeck] = []
    @Published private(set) var selectedDeck: DiscoveredDeck?
    @Published private(set) var searching = true

    private let browser = NetServiceBrowser()
    private var services: [String: NetService] = [:]
    private let selectedDeckDefaultsKey = "speakeasy.deck.selected-service.v1"

    override init() {
        super.init()
        browser.delegate = self
        startSearch()
    }

    var deckURL: URL? { selectedDeck?.url }

    func select(_ deck: DiscoveredDeck) {
        selectedDeck = deck
        UserDefaults.standard.set(deck.id, forKey: selectedDeckDefaultsKey)
    }

    func refresh() {
        browser.stop()
        services.values.forEach { $0.stop() }
        services.removeAll()
        searching = true
        startSearch()
    }

    private func startSearch() {
        browser.searchForServices(ofType: "_http._tcp.", inDomain: "local.")
    }

    private func serviceID(_ service: NetService) -> String {
        "\(service.domain)|\(service.type)|\(service.name)"
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        guard service.name.hasPrefix("SpeakEasy Deck") else { return }
        let id = serviceID(service)
        guard services[id] == nil else { return }
        services[id] = service
        service.delegate = self
        service.resolve(withTimeout: 5)
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
        let id = serviceID(service)
        services[id] = nil
        decks.removeAll { $0.id == id }
        if selectedDeck?.id == id {
            if let fallback = decks.first {
                select(fallback)
            } else {
                selectedDeck = nil
            }
        }
        searching = decks.isEmpty
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        guard let host = sender.hostName, sender.port > 0 else { return }
        let cleanHost = host.hasSuffix(".") ? String(host.dropLast()) : host
        guard let url = URL(string: "http://\(cleanHost):\(sender.port)") else { return }

        let deck = DiscoveredDeck(id: serviceID(sender), serviceName: sender.name, url: url)
        decks.removeAll { $0.id == deck.id }
        decks.append(deck)
        decks.sort { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
        searching = false

        let remembered = UserDefaults.standard.string(forKey: selectedDeckDefaultsKey)
        if remembered == deck.id {
            // Services resolve independently. A different Mac may have become
            // the temporary selection before the remembered one arrived.
            select(deck)
        } else if selectedDeck == nil {
            select(deck)
        } else if selectedDeck?.id == deck.id {
            selectedDeck = deck
        }
    }

    func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        services[serviceID(sender)] = nil
        searching = decks.isEmpty
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
        searching = false
    }
}
