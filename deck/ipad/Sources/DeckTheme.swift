import SwiftUI

enum DeckThemeID: String, CaseIterable, Identifiable {
    case flight
    case obsidian
    case ceramic
    case porcelain
    case amber

    var id: String { rawValue }

    var name: String {
        switch self {
        case .flight: "Flight"
        case .obsidian: "Obsidian"
        case .ceramic: "Ceramic"
        case .porcelain: "Porcelain"
        case .amber: "Amber"
        }
    }

    var detail: String {
        switch self {
        case .flight: "Void graphite, mint signal"
        case .obsidian: "Technical black, cool blue"
        case .ceramic: "Warm daylight console"
        case .porcelain: "Quiet white, tailored graphite"
        case .amber: "Low-light studio deck"
        }
    }

    var webTheme: String {
        switch self {
        case .flight: "flight"
        case .obsidian: "obsidian"
        case .ceramic: "paper"
        case .porcelain: "porcelain"
        case .amber: "ember"
        }
    }

    var colorScheme: ColorScheme {
        self == .ceramic || self == .porcelain ? .light : .dark
    }

    var palette: DeckThemePalette {
        switch self {
        case .flight:
            // Void graphite chassis + mint lamp. Tuned against the player-face
            // study: cooler neutrals, slightly softer mint so it doesn't neon.
            DeckThemePalette(
                page: 0x07090C, panel: 0x10161B, panelHead: 0x141A20, cell: 0x1A222A,
                trace: 0x06080A, line: 0x2A333C, lineSoft: 0x1A2229,
                ink: 0xF1F4F6, ink2: 0xA8B2BB, ink3: 0x6A7580, ink4: 0x4A5460,
                accent: 0x5EE9C2, accentDim: 0x3AB894, accentDark: 0x0A1F1A, accentEdge: 0x1C4F42,
                amber: 0xE0A83F, plate: 0x0A0E12, plateTop: 0x141A20, plateBottom: 0x0A0E12,
                pad: 0x1A222A, padBottom: 0x0F1419, empty: 0x06080A,
                micTop: 0x14A07A, micBottom: 0x0A6B50
            )
        case .obsidian:
            DeckThemePalette(
                page: 0x030405, panel: 0x090B0D, panelHead: 0x0D1013, cell: 0x11151A,
                trace: 0x07090B, line: 0x252C33, lineSoft: 0x181E24,
                ink: 0xF1F4F6, ink2: 0xB6C0C9, ink3: 0x77838E, ink4: 0x4D5862,
                accent: 0x79B8FF, accentDim: 0x4B82B8, accentDark: 0x091A2A, accentEdge: 0x244968,
                amber: 0xE8B85D, plate: 0x07090B, plateTop: 0x11151A, plateBottom: 0x06080A,
                pad: 0x14191F, padBottom: 0x0D1116, empty: 0x080B0E,
                micTop: 0x256FA8, micBottom: 0x184A72
            )
        case .ceramic:
            DeckThemePalette(
                page: 0xE4DDD0, panel: 0xF5F1EA, panelHead: 0xFAF6EE, cell: 0xFFFDF8,
                trace: 0xF4EEE2, line: 0xD9CFB9, lineSoft: 0xE2DAC7,
                ink: 0x1A1612, ink2: 0x3B342B, ink3: 0x6B6356, ink4: 0x968B79,
                accent: 0xB5421C, accentDim: 0xC9764F, accentDark: 0xF7E9D6, accentEdge: 0xE8D2B1,
                amber: 0xB57B1B, plate: 0xEFEEE9, plateTop: 0xFAF9F5, plateBottom: 0xE8E7E2,
                pad: 0xFFFDF8, padBottom: 0xEFEEE9, empty: 0xE7E6E1,
                micTop: 0xB5421C, micBottom: 0x8F3A1C
            )
        case .porcelain:
            DeckThemePalette(
                page: 0xEEECE7, panel: 0xFCFBF8, panelHead: 0xF6F3ED, cell: 0xFFFFFF,
                trace: 0xF3F0E9, line: 0xD5D0C7, lineSoft: 0xE3DED5,
                ink: 0x1E2328, ink2: 0x4D555D, ink3: 0x747C83, ink4: 0xA0A5A8,
                accent: 0x245A74, accentDim: 0x5A8396, accentDark: 0xE4EEF2, accentEdge: 0xB8CFD8,
                amber: 0x9B6B22, plate: 0xF2F3F3, plateTop: 0xFFFFFF, plateBottom: 0xE6E8E8,
                pad: 0xFBFCFC, padBottom: 0xEDEFEF, empty: 0xE5E7E7,
                micTop: 0x2F6D85, micBottom: 0x204D60
            )
        case .amber:
            DeckThemePalette(
                page: 0x171209, panel: 0x211A12, panelHead: 0x282017, cell: 0x2B2218,
                trace: 0x1E1710, line: 0x3D3122, lineSoft: 0x332A1E,
                ink: 0xF3EAD9, ink2: 0xD9C9B0, ink3: 0xA1937A, ink4: 0x776C5B,
                accent: 0xE0673A, accentDim: 0xB25A3A, accentDark: 0x35220F, accentEdge: 0x54331F,
                amber: 0xE0A83F, plate: 0x1E1710, plateTop: 0x2E2417, plateBottom: 0x251C12,
                pad: 0x2B2218, padBottom: 0x21180F, empty: 0x1E1710,
                micTop: 0xC2521F, micBottom: 0x93391A
            )
        }
    }
}

enum DeckThemeSelection {
    static let defaultsKey = "speakeasy.deck.theme.v1"

    static var current: DeckThemeID {
        DeckThemeID(rawValue: UserDefaults.standard.string(forKey: defaultsKey) ?? "") ?? .flight
    }
}

struct DeckThemePalette {
    let page: Color
    let panel: Color
    let panelHead: Color
    let cell: Color
    let trace: Color
    let line: Color
    let lineSoft: Color
    let ink: Color
    let ink2: Color
    let ink3: Color
    let ink4: Color
    let accent: Color
    let accentDim: Color
    let accentDark: Color
    let accentEdge: Color
    let amber: Color
    let plate: Color
    let plateTop: Color
    let plateBottom: Color
    let pad: Color
    let padBottom: Color
    let empty: Color
    let micTop: Color
    let micBottom: Color

    init(
        page: UInt32, panel: UInt32, panelHead: UInt32, cell: UInt32,
        trace: UInt32, line: UInt32, lineSoft: UInt32,
        ink: UInt32, ink2: UInt32, ink3: UInt32, ink4: UInt32,
        accent: UInt32, accentDim: UInt32, accentDark: UInt32, accentEdge: UInt32,
        amber: UInt32, plate: UInt32, plateTop: UInt32, plateBottom: UInt32,
        pad: UInt32, padBottom: UInt32, empty: UInt32, micTop: UInt32, micBottom: UInt32
    ) {
        self.page = Color(deckHex: page)
        self.panel = Color(deckHex: panel)
        self.panelHead = Color(deckHex: panelHead)
        self.cell = Color(deckHex: cell)
        self.trace = Color(deckHex: trace)
        self.line = Color(deckHex: line)
        self.lineSoft = Color(deckHex: lineSoft)
        self.ink = Color(deckHex: ink)
        self.ink2 = Color(deckHex: ink2)
        self.ink3 = Color(deckHex: ink3)
        self.ink4 = Color(deckHex: ink4)
        self.accent = Color(deckHex: accent)
        self.accentDim = Color(deckHex: accentDim)
        self.accentDark = Color(deckHex: accentDark)
        self.accentEdge = Color(deckHex: accentEdge)
        self.amber = Color(deckHex: amber)
        self.plate = Color(deckHex: plate)
        self.plateTop = Color(deckHex: plateTop)
        self.plateBottom = Color(deckHex: plateBottom)
        self.pad = Color(deckHex: pad)
        self.padBottom = Color(deckHex: padBottom)
        self.empty = Color(deckHex: empty)
        self.micTop = Color(deckHex: micTop)
        self.micBottom = Color(deckHex: micBottom)
    }
}

private extension Color {
    init(deckHex value: UInt32) {
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

/// Compatibility facade used by the tactile controls. `@AppStorage` at the
/// shell level invalidates SwiftUI when this selection changes.
enum DeckPalette {
    private static var value: DeckThemePalette { DeckThemeSelection.current.palette }
    static var page: Color { value.page }
    static var panel: Color { value.panel }
    static var panelHead: Color { value.panelHead }
    static var cell: Color { value.cell }
    static var trace: Color { value.trace }
    static var line: Color { value.line }
    static var lineSoft: Color { value.lineSoft }
    static var ink: Color { value.ink }
    static var ink2: Color { value.ink2 }
    static var ink3: Color { value.ink3 }
    static var ink4: Color { value.ink4 }
    static var accent: Color { value.accent }
    static var accentDim: Color { value.accentDim }
    static var accentDark: Color { value.accentDark }
    static var accentEdge: Color { value.accentEdge }
    static var amber: Color { value.amber }
    static var plate: Color { value.plate }
    static var plateTop: Color { value.plateTop }
    static var plateBottom: Color { value.plateBottom }
    static var pad: Color { value.pad }
    static var padBottom: Color { value.padBottom }
    static var empty: Color { value.empty }
    static var micTop: Color { value.micTop }
    static var micBottom: Color { value.micBottom }
}
