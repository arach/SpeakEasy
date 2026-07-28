import Foundation

struct PairingLink: Equatable {
    let url: URL
    let expiresAt: Date

    init(url: URL, now: Date = Date()) throws {
        guard let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
              url.host != nil,
              let fragment = url.fragment
        else { throw PairingLinkError.invalidURL }

        var fragmentComponents = URLComponents()
        fragmentComponents.percentEncodedQuery = fragment
        let values = Dictionary(
            (fragmentComponents.queryItems ?? []).compactMap { item in
                item.value.map { (item.name, $0) }
            },
            uniquingKeysWith: { first, _ in first }
        )
        guard values["v"] == "1",
              values["room"]?.isEmpty == false,
              values["tid"]?.isEmpty == false,
              values["ct"]?.isEmpty == false,
              values["k"]?.isEmpty == false,
              let expiryMilliseconds = values["exp"].flatMap(Int64.init)
        else { throw PairingLinkError.invalidPayload }

        let expiresAt = Date(timeIntervalSince1970: Double(expiryMilliseconds) / 1_000)
        guard expiresAt > now else { throw PairingLinkError.expired }
        self.url = url
        self.expiresAt = expiresAt
    }

    init(scannedValue: String, now: Date = Date()) throws {
        guard let url = URL(string: scannedValue.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            throw PairingLinkError.invalidURL
        }
        try self.init(url: url, now: now)
    }
}

enum PairingLinkError: LocalizedError {
    case invalidURL
    case invalidPayload
    case expired

    var errorDescription: String? {
        switch self {
        case .invalidURL: "That code is not a SpeakEasy Pad address."
        case .invalidPayload: "That SpeakEasy connection code is incomplete."
        case .expired: "That SpeakEasy connection code has expired. Scan the current code on your Mac."
        }
    }
}
