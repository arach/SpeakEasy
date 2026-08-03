import Foundation

enum DeckSurfaceID: String, CaseIterable, Identifiable {
    case console
    case cluster
    case flightDeck = "deck"
    case checklist
    case pfd
    case micro

    var id: String { rawValue }

    var name: String {
        switch self {
        case .console: "Console"
        case .cluster: "Cluster"
        case .flightDeck: "Flight Deck"
        case .checklist: "Checklist"
        case .pfd: "Glass PFD"
        case .micro: "Micro Deck"
        }
    }

    var detail: String {
        switch self {
        case .console: "Lane bank and active mission"
        case .cluster: "One focal instrument"
        case .flightDeck: "Six model / effort channels"
        case .checklist: "Dense operations ledger"
        case .pfd: "Live field with bezel keys"
        case .micro: "Tactile nine-key hardware"
        }
    }
}

enum DeckSurfaceSelection {
    static let defaultsKey = "speakeasy.deck.surface.v1"

    static var current: DeckSurfaceID {
        DeckSurfaceID(rawValue: UserDefaults.standard.string(forKey: defaultsKey) ?? "") ?? .micro
    }
}
