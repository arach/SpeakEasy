import Foundation
import Combine
import Security

/// Developer-installed builds can be provisioned with the exact paired Deck
/// URL and its private CA anchor at launch. The secret-bearing URL is copied
/// into this-device-only Keychain storage so tapping the app later reconnects
/// to the same Mac without a profile install or another Xcode launch.
enum DeckProvisioning {
    private static let service = "dev.arach.speakeasy.deck.provisioning"
    private static let urlAccount = "paired-url-v1"
    private static let rootAccount = "paired-root-der-v1"

    static func importLaunchEnvironment() {
        let environment = ProcessInfo.processInfo.environment
        guard let rawURL = environment["SPEAKEASY_DECK_URL"],
              let url = URL(string: rawURL),
              url.scheme == "https",
              url.host != nil,
              let root = environment["SPEAKEASY_DECK_ROOT_DER"],
              Data(base64Encoded: root) != nil else { return }
        save(rawURL, account: urlAccount)
        save(root, account: rootAccount)
    }

    static var pairedURL: URL? {
        guard let raw = load(account: urlAccount),
              let url = URL(string: raw),
              url.scheme == "https",
              url.host != nil else { return nil }
        return url
    }

    static var trustAnchor: SecCertificate? {
        guard let encoded = load(account: rootAccount),
              let data = Data(base64Encoded: encoded) else { return nil }
        return SecCertificateCreateWithData(nil, data as CFData)
    }

    private static func save(_ value: String, account: String) {
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(match as CFDictionary)
        var item = match
        item[kSecValueData as String] = Data(value.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    private static func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

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
        DeckProvisioning.importLaunchEnvironment()
        if let url = DeckProvisioning.pairedURL {
            let host = url.host ?? "Mac"
            let deck = DiscoveredDeck(
                id: "provisioned|\(host)",
                serviceName: "SpeakEasy Deck (\(host))",
                url: url
            )
            decks = [deck]
            selectedDeck = deck
            searching = false
        } else {
            startSearch()
        }
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
