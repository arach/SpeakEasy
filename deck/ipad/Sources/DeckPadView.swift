import SwiftUI

/// The programmable key bank. Tap fires the binding; press and hold on a key
/// opens the rebinding sheet, which is the only affordance that has to be
/// discoverable without stealing the tap.
struct DeckPadView: View {
    @ObservedObject var connection: DeckConnection
    @ObservedObject var voice: DeckVoice
    @ObservedObject var store: DeckPadStore
    let snapshot: DeckSnapshot
    var compact = false
    let showLaneSetup: () -> Void
    var showActivity: (() -> Void)?

    @State private var editing: DeckPadSlot?

    private var spacing: CGFloat { compact ? 5 : 7 }

    var body: some View {
        GeometryReader { geometry in
            let rows = store.layout.laidOutRows
            let rowHeight = (geometry.size.height - spacing * CGFloat(max(0, rows.count - 1)))
                / CGFloat(max(1, rows.count))
            VStack(spacing: spacing) {
                ForEach(Array(rows.enumerated()), id: \.offset) { rowIndex, cells in
                    HStack(spacing: spacing) {
                        ForEach(Array(cells.enumerated()), id: \.offset) { position, cell in
                            key(cell, row: rowIndex, position: position, total: geometry.size.width)
                                .frame(height: rowHeight)
                        }
                    }
                }
            }
        }
        .onChange(of: snapshot.phase) { _, _ in drainIfIdle() }
        .overlay(alignment: .topTrailing) {
            if !store.queue.isEmpty {
                Text("\(store.queue.count) QUEUED")
                    .deckMono(7, weight: .semibold)
                    .tracking(0.8)
                    .foregroundStyle(DeckPalette.amber)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(DeckPalette.plate, in: Capsule())
                    .padding(4)
            }
        }
        .sheet(item: $editing) { slot in
            DeckPadBindingSheet(
                slot: slot,
                current: currentBinding(slot),
                laneCount: min(9, snapshot.lanes.count),
                placement: $store.placement
            ) { binding in
                store.rebind(row: slot.row, position: slot.position, to: binding)
                editing = nil
            } onReset: {
                store.resetToFactory()
                editing = nil
            }
        }
    }

    private func currentBinding(_ slot: DeckPadSlot) -> DeckPadBinding {
        guard let index = store.layout.flatIndex(row: slot.row, position: slot.position),
              store.layout.cells.indices.contains(index) else { return .empty }
        return store.layout.cells[index].binding
    }

    @ViewBuilder
    private func key(_ cell: DeckPadCell, row: Int, position: Int, total: CGFloat) -> some View {
        let width = cellWidth(span: cell.span, total: total)
        Group {
            if cell.binding.isMomentary {
                // Reuse the shipping momentary control rather than re-deriving
                // press/release/cancel handling for the pad.
                HoldToSpeakButton(
                    phase: voice.phase,
                    lane: snapshot.lane,
                    compact: compact,
                    onPress: voice.pttBegan,
                    onRelease: voice.pttEnded,
                    onCancel: voice.pttCancelled
                )
            } else {
                DeckPadKey(
                    binding: cell.binding,
                    lane: laneInfo(cell.binding),
                    selected: isSelected(cell.binding),
                    compact: compact,
                    action: { fire(cell.binding) }
                )
            }
        }
        .frame(width: width)
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: 0.45) {
            editing = DeckPadSlot(row: row, position: position)
        }
    }

    private func cellWidth(span: Int, total: CGFloat) -> CGFloat {
        let columns = CGFloat(DeckPadLayout.columns)
        let unit = (total - spacing * (columns - 1)) / columns
        return unit * CGFloat(span) + spacing * CGFloat(span - 1)
    }

    private func laneInfo(_ binding: DeckPadBinding) -> DeckLaneInfo? {
        guard case .lane(let index) = binding, snapshot.lanes.indices.contains(index) else { return nil }
        return snapshot.lanes[index]
    }

    private func isSelected(_ binding: DeckPadBinding) -> Bool {
        if case .lane(let index) = binding { return snapshot.lane == index }
        return false
    }

    private func fire(_ binding: DeckPadBinding) {
        switch binding {
        case .empty, .holdToSpeak: break
        case .lane(let index): connection.selectLane(index)
        case .stop:
            voice.stopCapture()
            connection.stop()
        case .replay: connection.replay()
        case .speed: connection.cycleSpeed()
        case .autoplay: connection.toggleAutoplay()
        case .laneSetup: showLaneSetup()
        case .activity: showActivity?()
        case .overview: connection.selectLane(9)
        case .digest:
            connection.selectLane(9)
            send("Give me a one-line read on every assigned lane: what it is doing and whether it is blocked.", to: 9)
        case .nextLane:
            advanceLane()
        case .escape:
            // One key, one promise: take back whatever is in flight.
            //
            // Which intent that is depends only on how far the words have got.
            // While the microphone is open, the thing to withdraw is the
            // recording. Once it has been sent, it is the turn — and ESC used
            // to send `capture.cancel` in both cases, so pressing it during a
            // request got "not recording" back and did nothing at all. The key
            // was only ever honest for about two seconds of its life.
            if voice.phase.isBusy {
                voice.stopCapture()
                connection.sendIntent("capture.cancel", ["reason": "ESCAPED FROM PAD"])
            } else {
                connection.abortTurn()
            }
        case .copyReply:
            if let reply = snapshot.lastAgentMessage(in: snapshot.lane)?.text {
                UIPasteboard.general.string = reply
            }
        case .pasteToLane:
            if let clip = UIPasteboard.general.string, !clip.isEmpty {
                send(clip, to: snapshot.lane)
            }
        case .phrase(_, let text, let target, let interrupt):
            if interrupt {
                voice.stopCapture()
                connection.stop()
            }
            dispatch(text, to: target)
        }
    }

    /// Move to the next assigned lane, wrapping. Falls back to plain lane
    /// cycling when nothing is bound yet, so the key is never inert.
    private func advanceLane() {
        let assigned = snapshot.lanes.prefix(9).enumerated()
            .filter { $0.element.isAssigned }
            .map(\.offset)
        guard !assigned.isEmpty else { return }
        let next = assigned.first(where: { $0 > snapshot.lane }) ?? assigned[0]
        connection.selectLane(next)
    }

    /// Fan-out is queued rather than fired, because the runtime accepts one
    /// response for the whole deck. The first goes now; the rest drain as the
    /// deck returns to idle.
    private func dispatch(_ text: String, to target: DeckPadTarget) {
        switch target {
        case .active: send(text, to: snapshot.lane)
        case .lane(let index): send(text, to: index)
        case .all:
            let lanes = snapshot.lanes.prefix(9).enumerated()
                .filter { $0.element.isAssigned }
                .map(\.offset)
            guard let first = lanes.first else { return }
            send(text, to: first)
            store.enqueue(lanes.dropFirst().map { DeckPadPending(lane: $0, text: text) })
        }
    }

    /// Release one queued command whenever the deck reports idle.
    private func drainIfIdle() {
        guard snapshot.phase.lowercased() == "idle", !store.queue.isEmpty else { return }
        guard let next = store.takeNext() else { return }
        send(next.text, to: next.lane)
    }

    /// Deliver a canned command the same way a spoken utterance arrives. The
    /// runtime dedupes on `utteranceId`, so a fresh id per press is what keeps
    /// a double-tap from being silently swallowed as a repeat.
    private func send(_ text: String, to lane: Int?) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        connection.sendIntent("capture.end", [
            "text": String(trimmed.prefix(500)),   // runtime caps text at 500
            "utteranceId": "pad-\(UUID().uuidString.prefix(18))",
            "lane": lane ?? snapshot.lane,
        ])
    }
}

struct DeckPadSlot: Identifiable, Hashable {
    let row: Int
    let position: Int
    var id: String { "\(row).\(position)" }
}

// MARK: - Key face

/// One programmable keycap. Reads as a raised plastic/metal face on the plate:
/// top-lit gradient, bevel catch-light, base inner shadow, and a press that
/// actually sinks. The face is composed — primary label, secondary caption,
/// optional glyph, status pip — so it is never a dark void with a corner tag.
struct DeckPadKey: View {
    let binding: DeckPadBinding
    let lane: DeckLaneInfo?
    let selected: Bool
    var compact = false
    let action: () -> Void

    private var radius: CGFloat { compact ? 6 : 8 }

    var body: some View {
        Button(action: action) {
            face
                .padding(.horizontal, compact ? 5 : 7)
                .padding(.vertical, compact ? 5 : 6)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background { DeckKeycapMaterial(radius: radius, selected: selected, live: isLive, empty: isEmptyFace) }
        }
        .buttonStyle(DeckKeycapButtonStyle())
        .disabled(binding == .empty)
        .accessibilityLabel(binding.title)
    }

    @ViewBuilder
    private var face: some View {
        if binding.isLane {
            laneFace
        } else if binding == .empty {
            emptyFace
        } else {
            actionFace
        }
    }

    /// Number dominates the centre; name and state pip own the edges so the
    /// key still reads from across the desk.
    private var laneFace: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Spacer(minLength: 0)
                Circle()
                    .fill(stateColour)
                    .frame(width: compact ? 5 : 6, height: compact ? 5 : 6)
                    .shadow(color: isLive ? stateColour.opacity(0.85) : .clear, radius: 3)
            }
            Spacer(minLength: 2)
            Text(binding.label)
                .font(.system(size: compact ? 20 : 24, weight: .semibold, design: .monospaced))
                .foregroundStyle(faceColour)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Spacer(minLength: 2)
            Text(laneCaption)
                .deckMono(compact ? 6 : 7, weight: .semibold)
                .tracking(0.8)
                .foregroundStyle(selected ? DeckPalette.accentDim : DeckPalette.ink3)
                .lineLimit(1)
                .minimumScaleFactor(0.55)
                .frame(maxWidth: .infinity)
        }
    }

    /// Command keys: glyph + word centred, caption under, status pip only when
    /// the binding is the selected lane jump (not used for actions).
    private var actionFace: some View {
        VStack(spacing: compact ? 3 : 4) {
            Spacer(minLength: 0)
            if let glyph = binding.glyph {
                Image(systemName: glyph)
                    .font(.system(size: compact ? 11 : 13, weight: .semibold))
                    .foregroundStyle(faceColour.opacity(0.92))
                    .symbolRenderingMode(.hierarchical)
            }
            Text(binding.label)
                .deckMono(compact ? 8 : 9.5, weight: .semibold)
                .tracking(0.7)
                .foregroundStyle(faceColour)
                .lineLimit(2)
                .minimumScaleFactor(0.65)
                .multilineTextAlignment(.center)
            Text(binding.caption)
                .deckMono(compact ? 5.5 : 6.5, weight: .medium)
                .tracking(0.9)
                .foregroundStyle(selected ? DeckPalette.accentDim : DeckPalette.ink4)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyFace: some View {
        VStack(spacing: 4) {
            Spacer(minLength: 0)
            RoundedRectangle(cornerRadius: 1)
                .fill(DeckPalette.ink4.opacity(0.55))
                .frame(width: compact ? 14 : 18, height: 1.5)
            Text("·")
                .deckMono(compact ? 10 : 12, weight: .medium)
                .foregroundStyle(DeckPalette.ink4.opacity(0.5))
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var laneCaption: String {
        if let lane, lane.isAssigned {
            return lane.name.uppercased()
        }
        return isUnassigned ? "EMPTY" : binding.caption
    }

    private var isEmptyFace: Bool { binding == .empty || isUnassigned }
    private var isUnassigned: Bool { binding.isLane && !(lane?.isAssigned ?? false) }
    private var isLive: Bool { lane?.state == .working || lane?.state == .speaking }

    private var faceColour: Color {
        if binding == .empty || isUnassigned { return DeckPalette.ink4 }
        return selected ? DeckPalette.accent : DeckPalette.ink
    }

    private var stateColour: Color {
        switch lane?.state {
        case .working: DeckPalette.amber
        case .speaking: DeckPalette.accent
        case .idle where lane?.isAssigned == true: DeckPalette.ink3
        default: DeckPalette.ink4
        }
    }
}

// MARK: - Press

/// A pressed cap has to tell the material it is down, because the interesting
/// part of a key press happens *in* the material — the bevel highlight dies,
/// the light rakes the other way, the contact shadow closes up. A `ButtonStyle`
/// can only transform and tint what it is handed, so the press state travels
/// down through the environment instead.
private struct DeckKeyPressedKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var deckKeyPressed: Bool {
        get { self[DeckKeyPressedKey.self] }
        set { self[DeckKeyPressedKey.self] = newValue }
    }
}

/// Shared press timing for every control on the deck.
///
/// Real keys are not symmetric: the finger drives the cap down fast and hard,
/// and the dome pushes it back with its own spring. Easing both directions on
/// the same curve is what makes a software press read as a toggle rather than
/// as travel — so down is a short strike and the return is a lightly damped
/// spring that settles a hair past rest.
enum DeckPressMotion {
    static let down = Animation.easeOut(duration: 0.045)
    static let up = Animation.spring(response: 0.24, dampingFraction: 0.74)

    static func curve(pressed: Bool) -> Animation { pressed ? down : up }
}

/// Raised keycap chassis: face gradient, top bevel, base inner shade, edge.
/// Selected keys light the well; empty keys sink into the plate.
struct DeckKeycapMaterial: View {
    var radius: CGFloat = 8
    var selected = false
    var live = false
    var empty = false

    @Environment(\.deckKeyPressed) private var pressed

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        ZStack {
            shape.fill(
                LinearGradient(
                    colors: faceColors,
                    startPoint: .top,
                    endPoint: .bottom
                )
            )

            // Down inside the well, the plate lip shades the top of the face.
            // Directional, and only across the upper half — the defect this
            // replaces was a flat 18% black over the whole cap, which killed
            // the material outright and left a cold grey slab that read as
            // "disabled" rather than "pressed".
            if pressed && !empty {
                shape.fill(
                    LinearGradient(
                        colors: [Color.black.opacity(0.12), .clear],
                        startPoint: .top,
                        endPoint: UnitPoint(x: 0.5, y: 0.46)
                    )
                )
            }

            // Bevel catch-light — top edge picks up the panel lamp. It is the
            // first thing to go when the cap drops: the lamp no longer clears
            // the plate lip, so there is nothing for the bevel to catch.
            shape
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            selected ? DeckPalette.accent.opacity(0.55) : DeckPalette.ink2.opacity(empty ? 0.08 : 0.22),
                            DeckPalette.lineSoft.opacity(0.05),
                            .clear,
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1.2
                )
                .blendMode(.plusLighter)
                .opacity(pressed ? 0 : (empty ? 0.4 : 1))

            // Inner shade. At rest the face rolls off into the plate at its
            // base; pressed, it flips to the top edge — a hard 1pt stroke, the
            // lip of the well drawn on the cap that has dropped behind it.
            shape
                .strokeBorder(
                    LinearGradient(
                        colors: pressed
                            ? [Color.black.opacity(0.38), Color.black.opacity(0.10), .clear]
                            : [.clear, .clear, Color.black.opacity(empty ? 0.08 : 0.16)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: pressed ? 1.6 : 1
                )

            // Outer chassis rim. Never softens — the cap is still a hard object
            // whether it is up or down, and this 1px edge is what says so.
            shape
                .strokeBorder(
                    selected ? DeckPalette.accentEdge : (empty ? DeckPalette.lineSoft : DeckPalette.line),
                    lineWidth: selected ? 1.25 : 1
                )

            // Live work: thin amber/accent rim glow without flooding the face.
            if live && !selected {
                shape
                    .strokeBorder(DeckPalette.amber.opacity(0.45), lineWidth: 1)
            }
        }
        // A contact shadow, not a bloom. Sixteen keys each carrying a 1.5pt
        // blur of 32% black is thirty-two soft grey marks on the plate; against
        // a light ground that is what "everything looks slightly out of focus"
        // actually is. The rim stroke above defines the key — the shadow only
        // has to say it is sitting on the plate rather than printed on it.
        //
        // Pressed, the gap it describes is gone: the cap is seated, so the
        // shadow closes to nothing rather than merely getting darker.
        .shadow(
            color: Color.black.opacity(pressed ? 0 : (empty ? 0.06 : 0.16)),
            radius: pressed || empty ? 0 : 0.5,
            y: pressed || empty ? 0 : 1
        )
        .shadow(color: selected ? DeckPalette.accent.opacity(0.12) : .clear, radius: 4, y: 0)
    }

    private var faceColors: [Color] {
        let resting: [Color]
        if empty {
            resting = [DeckPalette.empty, DeckPalette.page]
        } else if selected {
            resting = [
                DeckPalette.accentDark.opacity(0.98),
                DeckPalette.accentDark,
                DeckPalette.padBottom,
            ]
        } else {
            resting = [
                DeckPalette.pad,
                DeckPalette.pad.opacity(0.92),
                DeckPalette.padBottom,
            ]
        }
        // Pressed, the face is below the lamp line, so the gradient inverts:
        // the base is now the lit end. Same tokens in both states — the press
        // changes where the light falls, it does not introduce a colour.
        return pressed ? resting.reversed() : resting
    }
}

/// Physical key travel: the cap seats into the plate and the material (via
/// `deckKeyPressed`) drops its bevel highlight, flips its shading and closes
/// its contact shadow. This style owns only the motion.
struct DeckKeycapButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .environment(\.deckKeyPressed, configuration.isPressed)
            // Travel, not squash. 3.5% on a 110pt cap is 4pt of edge movement,
            // which reads as the key rubber-banding; 1.5% plus a 1pt drop is a
            // cap seating in its well.
            .scaleEffect(configuration.isPressed ? 0.985 : 1, anchor: .center)
            .offset(y: configuration.isPressed ? 1 : 0)
            .animation(DeckPressMotion.curve(pressed: configuration.isPressed), value: configuration.isPressed)
    }
}

// MARK: - Rebinding

struct DeckPadBindingSheet: View {
    @Environment(\.dismiss) private var dismiss
    let slot: DeckPadSlot
    let current: DeckPadBinding
    let laneCount: Int
    @Binding var placement: DeckPadPlacement
    let onPick: (DeckPadBinding) -> Void
    let onReset: () -> Void

    @State private var draftLabel = ""
    @State private var draftText = ""
    @State private var draftScope = 0        // 0 active, 1 pinned lane, 2 all
    @State private var draftLane = 0
    @State private var draftInterrupt = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Label (e.g. Continue)", text: $draftLabel)
                    TextField("Command sent to the lane", text: $draftText, axis: .vertical)
                        .lineLimit(2...5)
                    Picker("Send to", selection: $draftScope) {
                        Text("Active lane").tag(0)
                        Text("A specific lane").tag(1)
                        Text("All assigned lanes").tag(2)
                    }
                    if draftScope == 1 {
                        Picker("Lane", selection: $draftLane) {
                            ForEach(0..<max(1, laneCount), id: \.self) { Text("Lane \($0 + 1)").tag($0) }
                        }
                    }
                    Toggle("Interrupt what is playing first", isOn: $draftInterrupt)
                    Button("Assign command to this key") {
                        let target: DeckPadTarget = draftScope == 2 ? .all
                            : draftScope == 1 ? .lane(draftLane) : .active
                        onPick(.phrase(
                            label: draftLabel.trimmingCharacters(in: .whitespacesAndNewlines),
                            text: draftText,
                            target: target,
                            interrupt: draftInterrupt
                        ))
                    }
                    .disabled(draftLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              || draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                } header: {
                    Text("Command")
                } footer: {
                    Text("Sends text as if you had spoken it. Fan-out is delivered one lane at a time — the deck only takes one response at a time. 500 characters max.")
                }

                Section("Starter commands") {
                    ForEach(DeckPadBinding.choices(laneCount: laneCount).filter(\.isPhrase)) { binding in
                        row(binding)
                    }
                }
                Section("Lanes") {
                    ForEach(DeckPadBinding.choices(laneCount: laneCount).filter(\.isLane)) { binding in
                        row(binding)
                    }
                }
                Section("Controls") {
                    ForEach(DeckPadBinding.choices(laneCount: laneCount).filter { !$0.isLane && !$0.isPhrase && $0 != .empty }) { binding in
                        row(binding)
                    }
                }
                Section {
                    row(.empty)
                }
                Section("Layout") {
                    Picker("Hand column", selection: $placement.side) {
                        ForEach(DeckPadSide.allCases) { side in
                            Text(side.name).tag(side)
                        }
                    }
                    Picker("Lane picker", selection: $placement.pickerEdge) {
                        ForEach(DeckPadPickerEdge.allCases) { edge in
                            Text(edge.name).tag(edge)
                        }
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Column width  \(Int(placement.columnFraction * 100))%")
                            .deckMono(9, weight: .medium)
                            .foregroundStyle(DeckPalette.ink3)
                        Slider(value: $placement.columnFraction, in: 0.3...0.7)
                            .tint(DeckPalette.accent)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Pad height  \(Int(placement.padFraction * 100))%")
                            .deckMono(9, weight: .medium)
                            .foregroundStyle(DeckPalette.ink3)
                        Slider(value: $placement.padFraction, in: 0.3...0.7)
                            .tint(DeckPalette.accent)
                    }
                }
                Section {
                    Button("Reset pad to default", role: .destructive, action: onReset)
                }
            }
            .navigationTitle("Key \(slot.row + 1)·\(slot.position + 1)")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                // Seed the editor from the key being edited, so adjusting an
                // existing command is a tweak rather than a retype.
                if case .phrase(let label, let text, let target, let interrupt) = current {
                    draftLabel = label
                    draftText = text
                    draftInterrupt = interrupt
                    switch target {
                    case .active: draftScope = 0
                    case .lane(let index): draftScope = 1; draftLane = index
                    case .all: draftScope = 2
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func row(_ binding: DeckPadBinding) -> some View {
        Button { onPick(binding) } label: {
            HStack {
                Text(binding.title)
                Spacer()
                if binding == current {
                    Image(systemName: "checkmark").foregroundStyle(DeckPalette.accent)
                }
            }
        }
        .foregroundStyle(DeckPalette.ink)
    }
}
