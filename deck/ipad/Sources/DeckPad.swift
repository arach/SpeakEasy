import Foundation
import SwiftUI

// A programmable 4x4 key bank. Every cell is a binding the operator can
// reassign, so the shipped arrangement is a default rather than a law. The
// layout persists per device; the Mac runtime is unaware of it, because a pad
// binding is a local input mapping, not deck state.

// MARK: - Bindings

/// Where a command lands. `.all` fans out across every assigned lane, which the
/// runtime cannot take at once -- `busy` in deck-runtime.ts is global, one
/// response for the whole deck -- so the pad serializes it.
enum DeckPadTarget: Codable, Hashable {
    case active
    case lane(Int)
    case all

    var label: String {
        switch self {
        case .active: "active lane"
        case .lane(let index): "lane \(index + 1)"
        case .all: "all assigned lanes"
        }
    }
}


enum DeckPadBinding: Codable, Hashable, Identifiable {
    case empty
    case lane(Int)
    case holdToSpeak
    case stop
    case replay
    case speed
    case autoplay
    case laneSetup
    case activity
    /// The deck-owned 10th lane. Removing the footer strip took away its only
    /// entry point on Micro Deck, so it has to be bindable.
    case overview
    /// A canned command. Pressing it delivers `text` to a lane exactly as a
    /// spoken utterance would -- the runtime's `capture.end` accepts a text
    /// form that needs no recording state (deck-runtime.ts:1117), so the pad
    /// can drive a thread without going through the microphone.
    ///
    /// `.active` keeps a key reusable across threads instead of pinning it to
    /// one; `.all` fans out; `interrupt` stops whatever is playing first.
    case phrase(label: String, text: String, target: DeckPadTarget, interrupt: Bool)
    /// Ask the deck-owned overview officer for a cross-lane read. This is the
    /// one question the operator cannot ask any single lane, because no lane
    /// can see the others.
    case digest
    /// Advance to the next assigned lane, wrapping. Navigation by position in
    /// the working set rather than by lane number, so it stays useful when the
    /// pad shows fewer lanes than exist.
    case nextLane
    /// Cancel the turn in flight without sending anything. The terminal reflex.
    case escape
    /// Put the lane's last reply on the clipboard.
    case copyReply
    /// Send whatever is on the clipboard to the lane. Pairs with copying an
    /// error, a URL, or a diff on the iPad and handing it straight to a thread.
    case pasteToLane

    var id: String {
        switch self {
        case .empty: "empty"
        case .lane(let index): "lane.\(index)"
        case .holdToSpeak: "hold"
        case .stop: "stop"
        case .replay: "replay"
        case .speed: "speed"
        case .autoplay: "autoplay"
        case .laneSetup: "lanes"
        case .activity: "activity"
        case .overview: "overview"
        case .digest: "digest"
        case .nextLane: "next"
        case .escape: "escape"
        case .copyReply: "copy"
        case .pasteToLane: "paste"
        case .phrase(let label, let text, let target, let interrupt):
            "phrase.\(label).\(text.hashValue).\(target).\(interrupt)"
        }
    }

    /// Short face label. Lane keys carry their number; actions carry a word,
    /// because a glyph alone is unreadable at this key size on a plate.
    var label: String {
        switch self {
        case .empty: ""
        case .lane(let index): "\(index + 1)"
        case .holdToSpeak: "HOLD TO SPEAK"
        case .stop: "STOP"
        case .replay: "REPLAY"
        case .speed: "SPEED"
        case .autoplay: "AUTO"
        case .laneSetup: "LANES"
        case .activity: "ACTIVITY"
        case .overview: "OVERVIEW"
        case .digest: "DIGEST"
        case .nextLane: "NEXT"
        case .escape: "ESC"
        case .copyReply: "COPY"
        case .pasteToLane: "PASTE"
        case .phrase(let label, _, _, _): label.uppercased()
        }
    }

    /// Secondary face line — fills the key body so the face is not empty plate.
    /// Lane keys override this with the live lane name at draw time.
    var caption: String {
        switch self {
        case .empty: ""
        case .lane: "LANE"
        case .holdToSpeak: "PTT"
        case .stop: "AUDIO"
        case .replay: "LAST"
        case .speed: "RATE"
        case .autoplay: "PLAY"
        case .laneSetup: "BIND"
        case .activity: "LOG"
        case .overview: "ALL"
        case .digest: "SCAN"
        case .nextLane: "SKIP"
        case .escape: "CANCEL"
        case .copyReply: "CLIP"
        case .pasteToLane: "SEND"
        case .phrase(_, _, let target, let interrupt):
            // What the key does, not where it points.
            //
            // Every phrase targets the active lane, so captioning them all
            // "ACTIVE LANE" put the same four rows of identical grey type under
            // five different commands — the caption line stopped distinguishing
            // anything and started reading as chrome. Only a target that is
            // *not* the obvious one is worth naming.
            switch target {
            case .active: interrupt ? "CUT IN" : "SAY"
            case .lane, .all: target.label.uppercased()
            }
        }
    }

    /// Compact SF Symbol that rides under the label when the face has room.
    /// Empty and phrase keys stay type-only.
    var glyph: String? {
        switch self {
        case .empty, .lane: nil
        // A phrase key without a glyph was the only bare face on the plate,
        // which read as unfinished next to fifteen glyphed keys.
        case .phrase: "text.bubble.fill"
        case .holdToSpeak: "mic.fill"
        case .stop: "stop.fill"
        case .replay: "gobackward"
        case .speed: "gauge.with.dots.needle.33percent"
        case .autoplay: "arrow.triangle.2.circlepath"
        case .laneSetup: "square.grid.3x3.fill"
        case .activity: "waveform.path.ecg"
        case .overview: "rectangle.3.group"
        case .digest: "list.bullet.rectangle"
        case .nextLane: "forward.end.fill"
        case .escape: "xmark"
        case .copyReply: "doc.on.doc"
        case .pasteToLane: "doc.on.clipboard"
        }
    }

    /// Name shown in the rebinding sheet.
    var title: String {
        switch self {
        case .empty: "Empty"
        case .lane(let index): "Lane \(index + 1)"
        case .holdToSpeak: "Hold to Speak"
        case .stop: "Stop"
        case .replay: "Replay"
        case .speed: "Cycle speed"
        case .autoplay: "Toggle autoplay"
        case .laneSetup: "Lane setup"
        case .activity: "Activity"
        case .overview: "Overview lane"
        case .digest: "Digest — ask the overview officer"
        case .nextLane: "Next lane"
        case .escape: "Escape — cancel the turn in flight"
        case .copyReply: "Copy last reply"
        case .pasteToLane: "Paste clipboard to lane"
        case .phrase(let label, _, let target, let interrupt):
            "\(label) → \(target.label)\(interrupt ? " (interrupt)" : "")"
        }
    }

    var isLane: Bool { if case .lane = self { return true }; return false }

    var isPhrase: Bool { if case .phrase = self { return true }; return false }

    /// Starter commands. These exist so the capability is visible on a fresh
    /// pad rather than hidden behind an empty editor -- they are meant to be
    /// replaced, not kept.
    /// The five things worth a key.
    ///
    /// A canned turn is the pad's one capability the transport bar cannot
    /// reach: it delivers a whole instruction without dictating it. So the
    /// slots freed by cutting SWEEP, DIGEST, OVERVIEW, NEXT and SPEED go to
    /// more of these rather than to more built-in commands.
    ///
    /// All five are aimed at the *active* lane. Fan-out was the old SWEEP, and
    /// it fires one turn per assigned lane — worth having as a choice in the
    /// editor, not worth a key when most lanes answer with an error.
    static let starterPhrases: [DeckPadBinding] = [
        .phrase(label: "Status", text: "One line: what are you doing right now, and are you blocked?",
                target: .active, interrupt: false),
        .phrase(label: "Cut", text: "Stop that approach. Wait for my next instruction.",
                target: .active, interrupt: true),
        .phrase(label: "Go", text: "Keep going. Don't ask for confirmation, just proceed.",
                target: .active, interrupt: false),
        .phrase(label: "Tests", text: "Run the tests and report only what fails.",
                target: .active, interrupt: false),
        .phrase(label: "Diff", text: "Summarise what you have changed so far, in five lines or fewer.",
                target: .active, interrupt: false),
        .phrase(label: "Sweep", text: "One line: what are you doing right now, and are you blocked?",
                target: .all, interrupt: false),
    ]

    /// Hold to Speak is momentary: it acts on press and release rather than on
    /// tap, so the pad has to route it differently from every other binding.
    var isMomentary: Bool { self == .holdToSpeak }

    /// Everything an operator can drop onto a key.
    static func choices(laneCount: Int) -> [DeckPadBinding] {
        (0..<laneCount).map { DeckPadBinding.lane($0) }
            + [.holdToSpeak, .stop, .replay, .speed, .autoplay, .laneSetup, .activity, .overview, .digest, .nextLane, .escape, .copyReply, .pasteToLane, .empty]
            + starterPhrases
    }
}

// MARK: - Layout

/// One cell of the bank. `span` lets a binding claim horizontal neighbours so a
/// pad can carry a wide Hold to Speak bar without leaving the grid.
struct DeckPadCell: Codable, Hashable {
    var binding: DeckPadBinding
    var span: Int = 1
}

struct DeckPadLayout: Codable, Hashable {
    static let columns = 4
    static let rows = 4
    /// v2: the factory arrangement changed from nine lane keys to commands, so
    /// existing installs need to re-seed rather than keep the duplicated pad.
    /// v5: SWEEP / DIGEST / OVERVIEW / NEXT / SPEED came off the factory pad,
    /// so existing installs re-seed rather than keep keys that were cut.
    static let defaultsKey = "speakeasy.deck.pad.v5"

    var cells: [DeckPadCell]

    /// Commands on top, a few lanes for quick jumps, transport down the right,
    /// and a wide Hold to Speak across the final row.
    ///
    /// No lane keys at all. The picker sits directly above the pad and already
    /// selects lanes; every lane key here was a second way to do the same
    /// thing. The pad carries only what the picker cannot express -- fan-out,
    /// clipboard, transport, and the deck-wide read.
    /// Rows by kind, so the hand learns regions rather than sixteen positions.
    ///
    /// Row 1 and 2 are things to *say* — canned turns, plus the clipboard pair
    /// that gets text in and out. Row 3 is the transport. Row 4 is the mouth.
    ///
    /// ESC sits top-right, alone at the end of the phrase rows: it is the only
    /// destructive key on the pad and the only one you reach for without
    /// looking, so it gets a corner and nothing next to it that it could be
    /// confused with. REPLAY sits directly above HOLD TO SPEAK — say it, hear
    /// it back, one thumb, no travel.
    ///
    /// Cut from the factory pad: SWEEP (fires one turn per lane, most of which
    /// error), DIGEST and OVERVIEW (the deck-wide read, never legible because
    /// its answer landed in a lane the UI could not draw), NEXT (position-based
    /// navigation the picker already does better) and SPEED (a player setting
    /// that already lives in the transport bar).
    static var factory: DeckPadLayout {
        let p = DeckPadBinding.starterPhrases
        return DeckPadLayout(cells: [
            .init(binding: p[0]), .init(binding: p[2]), .init(binding: p[3]), .init(binding: .escape),
            .init(binding: p[1]), .init(binding: p[4]), .init(binding: .copyReply), .init(binding: .pasteToLane),
            .init(binding: .replay), .init(binding: .stop), .init(binding: .autoplay), .init(binding: .activity),
            .init(binding: .holdToSpeak, span: 3), .init(binding: .laneSetup),
        ])
    }

    /// Rows, honouring spans. A row stops once its four columns are consumed,
    /// so a malformed persisted layout degrades instead of throwing.
    var laidOutRows: [[DeckPadCell]] {
        var rows: [[DeckPadCell]] = []
        var row: [DeckPadCell] = []
        var used = 0
        for cell in cells {
            let span = min(max(1, cell.span), Self.columns)
            if used + span > Self.columns {
                rows.append(row)
                row = []
                used = 0
            }
            row.append(DeckPadCell(binding: cell.binding, span: span))
            used += span
            if used == Self.columns {
                rows.append(row)
                row = []
                used = 0
            }
        }
        if !row.isEmpty { rows.append(row) }
        return Array(rows.prefix(Self.rows))
    }

    /// Index into `cells` for the cell at a given row/position, so the editor
    /// can write back through the same flat array it renders from.
    func flatIndex(row: Int, position: Int) -> Int? {
        var seen = 0
        for (rowIndex, cells) in laidOutRows.enumerated() {
            if rowIndex == row {
                return position < cells.count ? seen + position : nil
            }
            seen += cells.count
        }
        return nil
    }
}

// MARK: - Placement

/// Which side of the surface the hand works on. Handedness is personal enough
/// that neither side is a sensible default for everyone, so it is stored rather
/// than assumed.
enum DeckPadSide: String, Codable, CaseIterable, Identifiable {
    case left
    case right

    var id: String { rawValue }
    var name: String { self == .left ? "Left" : "Right" }
}

/// Whether the lane picker sits above or below the key bank. Below puts the
/// picker within the same thumb arc as the pad; above keeps the pad hard
/// against the bottom bezel.
enum DeckPadPickerEdge: String, Codable, CaseIterable, Identifiable {
    case top
    case bottom

    var id: String { rawValue }
    var name: String { self == .top ? "Above pad" : "Below pad" }
}

/// Defaults describe a bottom-left quadrant: the hand column takes half the
/// width, and the pad takes the bottom half of that column. On a landscape iPad
/// that puts a 4x4 bank at roughly 565x325 pt -- keys near 135x78 pt, chunky
/// enough to hit without looking and still inside one thumb arc.
///
/// v2: v1 shipped a 0.44 column with a fixed 200 pt pad, which read as a wide
/// strip rather than a quadrant. Bumping the key so existing installs pick up
/// the corrected proportions instead of keeping the stale persisted values.
struct DeckPadPlacement: Codable, Hashable {
    static let defaultsKey = "speakeasy.deck.pad.placement.v2"

    var side: DeckPadSide = .left
    var pickerEdge: DeckPadPickerEdge = .top
    /// Fraction of the surface width given to the hand column.
    var columnFraction: Double = 0.5
    /// Fraction of the hand column's height given to the key bank.
    var padFraction: Double = 0.5

    static let factory = DeckPadPlacement()
}

// MARK: - Serialized dispatch

/// One queued command waiting for the deck to free up.
struct DeckPadPending: Identifiable, Hashable {
    let id = UUID()
    let lane: Int
    let text: String
}

// MARK: - Persistence

@MainActor
final class DeckPadStore: ObservableObject {
    @Published var layout: DeckPadLayout {
        didSet { persist() }
    }

    @Published var placement: DeckPadPlacement {
        didSet { persistPlacement() }
    }

    init() {
        let data = UserDefaults.standard.data(forKey: DeckPadLayout.defaultsKey)
        if let data, let decoded = try? JSONDecoder().decode(DeckPadLayout.self, from: data) {
            layout = decoded
        } else {
            layout = .factory
        }

        let placementData = UserDefaults.standard.data(forKey: DeckPadPlacement.defaultsKey)
        if let placementData,
           let decoded = try? JSONDecoder().decode(DeckPadPlacement.self, from: placementData) {
            placement = decoded
        } else {
            placement = .factory
        }
    }

    private func persistPlacement() {
        guard let data = try? JSONEncoder().encode(placement) else { return }
        UserDefaults.standard.set(data, forKey: DeckPadPlacement.defaultsKey)
    }

    func rebind(row: Int, position: Int, to binding: DeckPadBinding) {
        guard let index = layout.flatIndex(row: row, position: position),
              layout.cells.indices.contains(index) else { return }
        layout.cells[index].binding = binding
    }

    /// Commands waiting on the deck. A fan-out cannot be fired at once because
    /// `busy` in the runtime is global, so the pad holds the remainder and
    /// releases them one at a time as the deck returns to idle.
    @Published private(set) var queue: [DeckPadPending] = []

    func enqueue(_ items: [DeckPadPending]) {
        queue.append(contentsOf: items)
    }

    func takeNext() -> DeckPadPending? {
        queue.isEmpty ? nil : queue.removeFirst()
    }

    func clearQueue() { queue.removeAll() }

    func resetToFactory() {
        layout = .factory
        placement = .factory
        clearQueue()
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(layout) else { return }
        UserDefaults.standard.set(data, forKey: DeckPadLayout.defaultsKey)
    }
}
