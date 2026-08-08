import SwiftUI

/// What the deck is playing, flattened to the few facts the instrument needs.
///
/// A struct rather than eight more parameters, so a new fact about playback is
/// added in one place and the call site cannot silently pass them out of order.
struct DeckPlaybackState: Equatable {
    /// "lane:index" of the message being narrated, or nil when nothing is.
    var id: String?
    var paused: Bool = false
    var position: Double = 0
    var duration: Double = 0
    var speedIndex: Int = 0
    var autoplay: Bool = true
    /// The text of the message being narrated.
    var text: String?

    var isPlaying: Bool { id != nil }

    var lane: Int? {
        guard let id, let first = id.split(separator: ":").first else { return nil }
        return Int(first)
    }

    var message: Int? {
        let parts = id?.split(separator: ":").compactMap { Int($0) } ?? []
        return parts.count == 2 ? parts[1] : nil
    }
}

/// The last narrated reply in the active lane — the thing the PLAY key acts on
/// when nothing is currently playing.
///
/// This exists so the key is a *working* control at rest rather than a
/// decoration waiting for playback to start. `playback.replay` on the runtime
/// walks back to the last file-backed agent message in the selected lane, so
/// `playable` mirrors exactly the condition under which that intent succeeds:
/// a reply with an audio file behind it. When it is false the key is drawn
/// unlit and disabled, which is honest and still looks like a key.
struct DeckLastReply: Equatable {
    var duration: Double
    var playable: Bool
    /// What the reply actually said. Read in the lane's exchange panel, not
    /// here — the transport only needs to know there is something to play.
    var text: String?
}

/// The audio state of the deck, as one piece of hardware.
///
/// # Built out of objects, because it is mostly idle
///
/// This bar spends the overwhelming majority of its life with nothing playing.
/// So it is not designed around the waveform; it is designed around things that
/// look correct *unlit*. A key face with no light in it still reads as a key. A
/// dial at rest still reads as a dial. What it must never become is a graph that
/// has failed, which is what a bar built around a live figure looks like the
/// other 95% of the time.
///
/// Two depths carry the whole thing, and no colour is spent on either: the
/// chassis is a raised plate (`plateTop` → `plateBottom`) and the keys are
/// raised faces in the pad bank's own gradient (`pad` → `padBottom`). Every
/// theme in `DeckTheme` orders those the same way, light or dark, so the depth
/// survives a theme change that a tint would not.
///
/// # Colour is reserved for things that are happening
///
/// `accent` means live — a microphone that is open, a loudspeaker that is
/// moving. `amber` means working or backed up — a model downloading, audio
/// held, transcripts queued, the Mac busy. Everything else, including armed
/// settings like autoplay and speed, sits in the ink ladder. An instrument that
/// tints its at-rest chrome has spent its loudest signal on its least
/// interesting state, and then has nothing left to say when something actually
/// happens.
///
/// # It is a transport, not a display
///
/// This bar had a readout well and a pop-out tape well, and the audio in them
/// was being answered two boxes away from where the exchange it belonged to is
/// read. Both went up to `DeckLaneTrace`, in the lane's own detail panel: the
/// envelope, the playhead, the scrubber, and the sentence being heard.
///
/// What is left is the transport — the key, what the deck is doing, the clock,
/// and the three settings — and the *state* figures that are not audio: a
/// bounded fill for a model download, a sweep for unbounded work, drifting
/// dashes for a queue. Those are a 3 pt line under the state word, because
/// they qualify the word rather than compete with it.
///
/// # One height, on the pad's grid
///
/// Exactly one rack unit — one row of the key bank — in every state. It used to
/// take two while narrating, which meant the console changed height every time
/// the deck spoke and the panel above it shrank to pay for it. A console that
/// resizes when audio starts is the loudest possible way to say something
/// quiet.
struct DeckAudioInstrument: View {
    let phase: DeckCapturePhase
    let inputLevel: Double
    let deckPhase: String
    let undelivered: Int
    let heldAudio: Int
    let lane: Int
    let playback: DeckPlaybackState
    /// What the PLAY key does when nothing is playing.
    let lastReply: DeckLastReply?
    /// Live narration level and envelope. Observed here and nowhere else, so
    /// its 20 Hz republishing invalidates only this subtree.
    @ObservedObject var meter: DeckPlaybackMeter
    /// One pad row, so the panel can lay itself out on the same grid as the
    /// key bank instead of guessing at it.
    var rowUnit: CGFloat = 78
    @Binding var volume: Double
    /// Where the thumb is during a scrub, set by the lane trace that owns the
    /// timeline. Non-nil means the clock shows the *target*, not the playhead.
    var scrubTarget: Double?
    var onVolumeCommit: (Double) -> Void = { _ in }
    var onTogglePlayPause: () -> Void = {}
    var onPlayLast: () -> Void = {}
    var onCycleSpeed: () -> Void = {}
    var onToggleAutoplay: () -> Void = {}
    /// Local lifecycle walkthrough — no Codex. Nil hides the DEMO key.
    var demoRunning: Bool = false
    var onDemo: (() -> Void)? = nil
    /// When true, skip outer plate chrome — parent `DeckPlayerConsole` owns it.
    var embedded: Bool = false

    @State private var dragStart: Double?
    @State private var travel: Double = 0

    /// What the deck is doing. Derived once so the status word, the work line,
    /// and the tint can never disagree about it.
    enum Figure: Equatable {
        case rest            // nothing happening
        case live            // capture level
        case sweep           // on-device work with no level to show
        case narration       // the loudspeaker, drawn in the lane trace above
        case fill(Double)    // bounded progress
        case dashes          // backlog waiting on something
    }

    // MARK: - Geometry

    /// Inset so key faces sit inside the row without overflowing it.
    /// Embedded (2U player) uses a tighter pad so the transport face is as
    /// large as the pad keys beside it.
    private var pad: CGFloat {
        if embedded { return rowUnit < 58 ? 4 : 6 }
        return rowUnit < 58 ? 5 : 10
    }
    /// Key face fills the control row — same construction as a pad key: row
    /// height minus vertical inset, capped so it never exceeds the row.
    private var keySide: CGFloat {
        let available = max(24, rowUnit - pad * 2)
        return min(available, rowUnit - 2)
    }
    /// Wide enough for the longest state word beside its qualifier, so the
    /// clock and the cluster to the right never move when the word changes --
    /// controls that jitter while you speak are unusable. It is also the width
    /// the work line is drawn at: a figure that qualifies the word should be as
    /// wide as the word, not as wide as the bar.
    private let stateWidth: CGFloat = 170
    /// Speed + autoplay + volume (+ optional quiet DEMO), at natural widths.
    private var clusterWidth: CGFloat { onDemo == nil ? 168 : 200 }
    private let columnGap: CGFloat = 12

    private var isRecording: Bool { phase == .recording }

    /// Whether the timeline has anything to show.
    ///
    /// The timeline itself lives in the lane trace one panel up; this bar only
    /// asks so its clock knows whether it is reading a playhead or naming what
    /// PLAY would start. Note the gate is *microphone busy*, not *capture
    /// idle*: a transcript backlog does not stop narration on this device, so
    /// treating one as silence would misreport audio the operator can hear. An
    /// open microphone does stop it.
    static func showsTransport(phase: DeckCapturePhase, playback: DeckPlaybackState) -> Bool {
        playback.isPlaying && !phase.isBusy
    }

    private var showsTransport: Bool {
        Self.showsTransport(phase: phase, playback: playback)
    }

    // MARK: - Playback clock
    //
    // The meter is sampled 10x more often than the snapshot, so when it is
    // describing the message the deck says is playing, it is the better clock.
    // A scrub in progress outranks both: the thumb is the intent.

    private var trustsMeter: Bool { playback.id != nil && meter.id == playback.id }

    /// Seeking is a *device* capability, not a deck one. It works because this
    /// iPad owns the player; when the Mac is the one making the sound -- a CLI
    /// mirror, or a file this device has not finished downloading -- there is
    /// nothing here to move, and `playback.scrub` is rejected upstream because
    /// afplay cannot seek. So the scrubber loses its handle and its gesture and
    /// becomes an honest progress bar, and the clock says whose audio it is.
    /// Offering a handle that silently snaps back would be worse than not
    /// offering one.
    private var canSeek: Bool { trustsMeter }

    private var duration: Double {
        let metered = trustsMeter ? meter.duration : 0
        return metered > 0 ? metered : max(0, playback.duration)
    }

    private var position: Double {
        if let scrubTarget { return scrubTarget }
        return trustsMeter ? meter.position : playback.position
    }

    private var progress: Double {
        duration > 0 ? min(1, max(0, position / duration)) : 0
    }

    /// One state word, one qualifier, one tint, one figure — resolved together
    /// so the four can never disagree about what is happening.
    struct Readout: Equatable {
        let word: String
        let detail: String
        let tint: Color
        let figure: Figure
    }

    private var state: Readout {
        let laneLabel = "LANE \(String(format: "%02d", lane + 1))"
        switch phase {
        case .recording:
            return Readout(word: "LISTENING", detail: laneLabel, tint: DeckPalette.accent, figure: .live)
        case .arming:
            return Readout(word: "ARMING", detail: "MIC", tint: DeckPalette.amber, figure: .sweep)
        case .transcribing:
            return Readout(word: "TRANSCRIBING", detail: "ON DEVICE", tint: DeckPalette.amber, figure: .sweep)
        case .preparing(let value):
            return Readout(word: "MODEL", detail: "\(Int(value * 100))%", tint: DeckPalette.amber, figure: .fill(value))
        case .held(let count):
            return Readout(word: "HELD", detail: "\(count) AUDIO", tint: DeckPalette.amber, figure: .dashes)
        case .delivering(let count):
            return Readout(word: "SENDING", detail: "\(count) QUEUED", tint: DeckPalette.amber, figure: .dashes)
        case .idle:
            if playback.isPlaying {
                let speaking = "LANE \(String(format: "%02d", (playback.lane ?? lane) + 1))"
                // Paused keeps the figure and drops the tint: it is the same
                // state under a different condition, nothing is coming out of
                // the loudspeaker, and the key glyph says which one it is.
                return playback.paused
                    ? Readout(word: "PAUSED", detail: speaking, tint: DeckPalette.ink3, figure: .narration)
                    : Readout(word: "SPEAKING", detail: speaking, tint: DeckPalette.accent, figure: .narration)
            }
            if deckPhase.lowercased() != "idle" {
                return Readout(word: deckPhase.uppercased(), detail: "MAC", tint: DeckPalette.amber, figure: .sweep)
            }
            if undelivered > 0 {
                return Readout(word: "UNSENT", detail: "\(undelivered) WAITING", tint: DeckPalette.amber, figure: .dashes)
            }
            if heldAudio > 0 {
                return Readout(word: "HELD", detail: "\(heldAudio) AUDIO", tint: DeckPalette.amber, figure: .dashes)
            }
            return Readout(word: "READY", detail: laneLabel, tint: DeckPalette.ink2, figure: .rest)
        }
    }

    /// True only while something is genuinely moving. The chassis border is the
    /// one piece of colour outside the objects themselves, so it is spent on
    /// exactly that and nothing else.
    private var isLive: Bool {
        switch state.figure {
        case .live: return true
        case .narration: return !playback.paused
        default: return false
        }
    }

    /// One rack unit, in every state, forever.
    ///
    /// This bar used to grow a second unit to hold the timeline whenever a
    /// reply started, which meant the console changed height every time the
    /// deck spoke. The timeline moved up to the lane trace, next to the
    /// exchange it belongs to, and what is left here is a transport: the key,
    /// what it is doing, the clock, and the three settings. That is a console.
    var body: some View {
        HStack(alignment: .center, spacing: columnGap) {
            transportGutter
            Spacer(minLength: 8)
            clock
            controlCluster
        }
        .frame(height: keySide)
        .padding(.horizontal, 12)
        .padding(.vertical, pad)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            if !embedded {
                LinearGradient(colors: [DeckPalette.plateTop, DeckPalette.plateBottom],
                               startPoint: .top, endPoint: .bottom)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: embedded ? 0 : 9))
        .overlay {
            if !embedded {
                RoundedRectangle(cornerRadius: 9)
                    .strokeBorder(isLive ? state.tint.opacity(0.3) : DeckPalette.line, lineWidth: 1)
            }
        }
        .onAppear { animateTravel() }
        .onChange(of: state.figure) { _, _ in animateTravel() }
    }

    private func animateTravel() {
        travel = 0
        switch state.figure {
        case .sweep, .dashes:
            // Snappier cycle so work never feels sluggish or stuck.
            withAnimation(.linear(duration: 1.05).repeatForever(autoreverses: false)) { travel = 1 }
        default:
            break
        }
    }

    // MARK: - Left gutter: the key and what it is doing

    private var transportGutter: some View {
        HStack(spacing: 9) {
            playKey
            stateBlock
        }
        .frame(width: keySide + 9 + stateWidth, alignment: .leading)
    }

    private var isTransportLive: Bool { playback.isPlaying && !playback.paused }

    /// No replay while the microphone owns the audio path: capture silences
    /// device narration, so the key would ask for sound that is immediately
    /// muted. It goes unlit for the same reason the transport row does.
    private var canReplay: Bool { lastReply?.playable == true && !phase.isBusy }

    /// A real key, and it works at rest.
    ///
    /// Playing, it is play/pause for the current narration. Idle, it replays the
    /// last narrated reply in this lane — the runtime's own `playback.replay`,
    /// not a local approximation. With no such reply it goes unlit and
    /// disabled, which is the state a physical key would be in and is still a
    /// legible object.
    private var playKey: some View {
        // Primary face — glyph only. At rest the key stays present (ink2) so the
        // transport still looks finished even when there is nothing to play.
        Button(action: playback.isPlaying ? onTogglePlayPause : onPlayLast) {
            Image(systemName: isTransportLive ? "pause.fill" : "play.fill")
                .font(.system(size: keySide * 0.32, weight: .semibold))
                .foregroundStyle(playGlyphColour)
                .frame(width: keySide, height: keySide)
                .modifier(DeckKeyFace(
                    radius: keySide * 0.22,
                    live: isTransportLive,
                    enabled: playback.isPlaying || canReplay || true
                ))
        }
        .buttonStyle(DeckPressButtonStyle())
        .disabled(!playback.isPlaying && !canReplay)
        .opacity((playback.isPlaying || canReplay) ? 1 : 0.72)
        .accessibilityLabel(playback.isPlaying
                            ? (playback.paused ? "Resume narration" : "Pause narration")
                            : "Play last reply")
    }

    private var playGlyphColour: Color {
        if isTransportLive { return DeckPalette.accent }
        if playback.isPlaying { return DeckPalette.ink }     // paused: bright, not tinted
        if canReplay { return DeckPalette.accentDim }
        // Resting, unarmed — still legible as a key, never washed to ink4 void.
        return DeckPalette.ink3
    }

    /// At least as wide as the longest state word, so the clock and the cluster
    /// to its right never move when the word changes length -- controls that
    /// jitter while you speak are unusable. It may take more than that: with
    /// the readout well gone there is slack in this row, and the work line is
    /// more legible across it.
    private var stateBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                // Soft pip at rest; lit lamp only when something is moving.
                Circle()
                    .fill(state.figure == .rest ? DeckPalette.ink4.opacity(0.7) : state.tint)
                    .frame(width: 5, height: 5)
                    .shadow(color: isLive ? state.tint.opacity(0.75) : .clear, radius: 3)
                    .opacity(indicatorOpacity)
                Text(state.word)
                    .deckMono(10, weight: .semibold)
                    .tracking(1.05)
                    .foregroundStyle(state.figure == .rest ? DeckPalette.ink2 : state.tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(state.detail)
                    .deckMono(7, weight: .medium)
                    .tracking(0.85)
                    .foregroundStyle(DeckPalette.ink4)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            workLine
        }
        .frame(width: stateWidth, alignment: .leading)
    }

    /// What is left of the well, and all that was ever worth keeping from it.
    ///
    /// The well drew six figures; four of them said something the state word
    /// could not — that a bounded thing is *this* far along, that unbounded
    /// work is still moving, that a queue is being worked rather than stuck.
    /// Those survive as a 3 pt line under the word. The other two were audio,
    /// and audio is drawn in the lane trace now.
    @ViewBuilder
    private var workLine: some View {
        switch state.figure {
        case .fill(let value):
            GeometryReader { size in
                ZStack(alignment: .leading) {
                    Capsule().fill(DeckPalette.line).frame(height: 3)
                    Capsule()
                        .fill(state.tint)
                        .frame(width: max(3, size.size.width * min(1, max(0, value))), height: 3)
                }
                .frame(maxHeight: .infinity)
            }
            .frame(height: 3)
        case .sweep:
            // Full-width sheen — the track is the figure, not a 1/3-width chip
            // sliding through empty air. Soft lobe travels edge to edge.
            GeometryReader { size in
                let w = size.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(state.tint.opacity(0.16)).frame(height: 3)
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    state.tint.opacity(0),
                                    state.tint.opacity(0.85),
                                    state.tint,
                                    state.tint.opacity(0.85),
                                    state.tint.opacity(0),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        // Lobe is ~half the track so the motion reads across
                        // the whole geometry without looking like a thin slice.
                        .frame(width: max(24, w * 0.55), height: 3)
                        .offset(x: (w + w * 0.55) * travel - w * 0.55)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
            }
            .frame(height: 3)
        case .dashes:
            // Backlog across the full width. Density fills the track; a wave
            // of brightness walks the whole row so nothing is a corner orphan.
            GeometryReader { size in
                let count = max(12, Int(size.size.width / 7))
                let slot = size.size.width / CGFloat(count)
                HStack(spacing: 0) {
                    ForEach(0..<count, id: \.self) { index in
                        let t = Double(index) / Double(max(1, count - 1))
                        let d = abs(t - travel)
                        let wrapped = min(d, 1 - d)
                        let lobe = max(0, 1 - wrapped * 2.6)
                        Capsule()
                            .fill(state.tint.opacity(0.18 + lobe * 0.75))
                            .frame(width: max(2, slot - 3), height: 3)
                            .frame(width: slot)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(height: 3)
        case .narration:
            // Progress under the state word — the scrub rail is the seek head;
            // this is only a thin elapsed fill so READY/SPEAKING share one row
            // without inventing a second playhead.
            GeometryReader { size in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1).fill(DeckPalette.line).frame(height: 2)
                    RoundedRectangle(cornerRadius: 1)
                        .fill(state.tint.opacity(playback.paused ? 0.4 : 0.85))
                        .frame(width: max(2, size.size.width * progress), height: 2)
                }
                .frame(maxHeight: .infinity)
            }
            .frame(height: 2)
        case .rest, .live:
            // Empty — idle elegance. No hairline that reads as a failed figure.
            Color.clear.frame(height: 2)
        }
    }

    /// The lamp breathes with whichever level is real: the microphone while
    /// capturing, the loudspeaker while narrating. It is never animated from
    /// nothing.
    private var indicatorOpacity: Double {
        if isRecording { return 0.35 + inputLevel * 0.65 }
        if state.figure == .narration, !playback.paused { return 0.4 + meter.level * 0.6 }
        return 1
    }

    // MARK: - Controls
    //
    // Three, and every one of them sends an intent. Volume is continuous and
    // stays a dial; speed and autoplay are discrete and are drawn as the key
    // faces they are, so their position is readable without reading a word.
    // None of them is tinted: a speed detent and an autoplay rocker describe how
    // the deck is *set*, not what it is doing, and the accent has to stay worth
    // something.

    private var controlCluster: some View {
        HStack(spacing: 8) {
            if onDemo != nil {
                demoKey
            }
            speedControl
            autoplayControl
            volumeDial
        }
        .frame(width: clusterWidth, alignment: .trailing)
    }

    /// Lifecycle walkthrough — deliberately quieter than the dials. A wand
    /// glyph reads as "dev fixture" next to VOL/SPEED; a small unmarked face
    /// that lights amber only while running is enough for operators who know.
    private var demoKey: some View {
        Button(action: { onDemo?() }) {
            Image(systemName: demoRunning ? "stop.fill" : "circle.dotted")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(demoRunning ? DeckPalette.amber : DeckPalette.ink4)
                .frame(width: 32, height: keySide)
                .modifier(DeckKeyFace(radius: 6, live: demoRunning, enabled: true))
        }
        .buttonStyle(DeckPressButtonStyle())
        .opacity(demoRunning ? 1 : 0.55)
        .accessibilityLabel(demoRunning ? "Stop turn demo" : "Run turn lifecycle demo")
    }

    /// The runtime cycles `playback.speed` through its own order and owns the
    /// result, so this is one momentary key, not four selectable ones.
    ///
    /// NOT COPIED FROM THE DESIGN: the exploration drew the speed control as a
    /// keypad of four discrete key faces, one per detent. There is no set-speed
    /// intent — `playback.speed` only advances — so four faces that all did the
    /// same thing would be four lies about what a press does. This keeps the
    /// keypad's *read* (a lit position on a physical scale) with one key's
    /// honesty. The detents are drawn in speed order rather than cycle order:
    /// a scale that reads left to right must not put 0.75x to the right of 1.5x
    /// just because that is where the cycle wraps.
    private var speedControl: some View {
        Button(action: onCycleSpeed) {
            VStack(spacing: 4) {
                Text(DeckPlaybackSpeeds.label(at: playback.speedIndex))
                    .deckMono(9, weight: .semibold)
                    .foregroundStyle(DeckPalette.ink2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)

                HStack(alignment: .bottom, spacing: 3) {
                    ForEach(0..<DeckPlaybackSpeeds.ordered.count, id: \.self) { index in
                        let lit = index == DeckPlaybackSpeeds.detent(at: playback.speedIndex)
                        RoundedRectangle(cornerRadius: 1)
                            .fill(lit ? DeckPalette.ink2 : DeckPalette.ink4.opacity(0.5))
                            .frame(width: 5, height: lit ? 9 : 4)
                    }
                }
                .frame(height: 9, alignment: .bottom)

                Text("SPEED")
                    .deckMono(6, weight: .semibold)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.ink4)
            }
            .frame(width: 54, height: keySide)
            .modifier(DeckKeyFace(radius: 6))
        }
        .buttonStyle(DeckPressButtonStyle())
        .accessibilityLabel("Narration speed")
        .accessibilityValue(DeckPlaybackSpeeds.label(at: playback.speedIndex))
    }

    /// A rocker, not a lamp. Which end the lozenge sits at is the state; the
    /// word above only confirms it.
    private var autoplayControl: some View {
        Button(action: onToggleAutoplay) {
            VStack(spacing: 4) {
                Text(playback.autoplay ? "ON" : "OFF")
                    .deckMono(9, weight: .semibold)
                    .foregroundStyle(playback.autoplay ? DeckPalette.ink2 : DeckPalette.ink4)
                    .lineLimit(1)

                ZStack(alignment: playback.autoplay ? .trailing : .leading) {
                    Capsule()
                        .fill(DeckPalette.page)
                        .overlay { Capsule().strokeBorder(DeckPalette.lineSoft, lineWidth: 1) }
                        .frame(width: 26, height: 11)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(playback.autoplay ? DeckPalette.ink2 : DeckPalette.ink4)
                        .frame(width: 12, height: 7)
                        .padding(.horizontal, 2)
                }
                .frame(width: 26, height: 11)

                Text("AUTO")
                    .deckMono(6, weight: .semibold)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.ink4)
            }
            .frame(width: 46, height: keySide)
            .modifier(DeckKeyFace(radius: 6))
        }
        .buttonStyle(DeckPressButtonStyle())
        .accessibilityLabel("Autoplay narration")
        .accessibilityValue(playback.autoplay ? "On" : "Off")
    }

    /// Narration volume. Vertical drag, committed on release so the socket sees
    /// one intent per adjustment instead of one per frame. A dial rather than a
    /// key because the value is continuous, and it is the one control here whose
    /// position cannot be drawn as a detent.
    private var volumeDial: some View {
        // Hardware dial: sunk well, 270° track, lit arc for value. Continuous
        // vertical drag. Matches the play key's diameter so the cluster reads
        // as one instrument, not mixed chrome sizes.
        ZStack {
            Circle().fill(DeckPalette.page)
            Circle().strokeBorder(DeckPalette.line, lineWidth: 1)
            // Full track (quiet)
            Circle()
                .trim(from: 0.125, to: 0.875)
                .stroke(DeckPalette.lineSoft, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .padding(4)
            // Value arc
            Circle()
                .trim(from: 0.125, to: 0.125 + 0.75 * max(0.02, volume))
                .stroke(DeckPalette.ink3, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .padding(4)
            VStack(spacing: 0) {
                Text("\(Int(volume * 100))")
                    .deckMono(9, weight: .semibold)
                    .foregroundStyle(DeckPalette.ink2)
                Text("VOL")
                    .deckMono(5, weight: .semibold)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.ink4)
            }
        }
        .frame(width: keySide, height: keySide)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 1)
                .onChanged { value in
                    if dragStart == nil { dragStart = volume }
                    let base = dragStart ?? volume
                    volume = min(1, max(0, base - Double(value.translation.height) / 140))
                }
                .onEnded { _ in
                    dragStart = nil
                    onVolumeCommit(volume)
                }
        )
        .accessibilityLabel("Narration volume")
        .accessibilityValue("\(Int(volume * 100)) percent")
    }

    /// Playing, it is the playhead. At rest it names what PLAY would start,
    /// which is the only reason a stopped transport needs a clock at all — and
    /// it is the last thing the removed well was carrying that lived nowhere
    /// else. Blanking it while idle would leave the key with no idea of what it
    /// is aimed at.
    private var clock: some View {
        // One number, one quiet label. No "NOTHING TO PLAY" plaque — the meter
        // glass already says idle, and the state word says READY.
        VStack(alignment: .trailing, spacing: 2) {
            if showsTransport {
                Text(DeckNarrationText.timecode(position))
                    .deckMono(10, weight: .semibold)
                    .monospacedDigit()
                    .foregroundStyle(scrubTarget == nil ? DeckPalette.ink2 : DeckPalette.ink)
                    .lineLimit(1)
                Text(scrubTarget != nil ? "SEEK"
                     : canSeek ? "ELAPSED"
                     : "ON MAC")
                    .deckMono(6, weight: .medium)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.ink4)
                    .lineLimit(1)
            } else if let lastReply, lastReply.playable {
                Text(DeckNarrationText.timecode(lastReply.duration))
                    .deckMono(10, weight: .semibold)
                    .monospacedDigit()
                    .foregroundStyle(DeckPalette.ink2)
                    .lineLimit(1)
                Text("LENGTH")
                    .deckMono(6, weight: .medium)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.ink4)
                    .lineLimit(1)
            } else {
                Text("0:00")
                    .deckMono(10, weight: .semibold)
                    .monospacedDigit()
                    .foregroundStyle(DeckPalette.ink4)
                Text("LENGTH")
                    .deckMono(6, weight: .medium)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.ink4)
                    .lineLimit(1)
            }
        }
        .frame(width: embedded ? 48 : 96, alignment: .trailing)
    }
}

/// A raised key face, in the pad bank's own vocabulary.
///
/// The chassis is a plate and the well is a recess, so a key only has to be
/// lighter than the plate and gradient-lit from the top to read as sitting
/// proud of it. No shadow, no tint: every theme orders `pad` / `plate` / `page`
/// the same way, so this depth survives a theme switch that a colour would not.
private struct DeckKeyFace: ViewModifier {
    var radius: CGFloat = 7
    /// Only for a key that is doing something right now.
    var live: Bool = false
    var enabled: Bool = true

    func body(content: Content) -> some View {
        content
            .background(
                LinearGradient(
                    colors: live ? [DeckPalette.accentDark, DeckPalette.accentDark]
                        : enabled ? [DeckPalette.pad, DeckPalette.padBottom]
                        : [DeckPalette.padBottom, DeckPalette.padBottom],
                    startPoint: .top, endPoint: .bottom
                ),
                in: RoundedRectangle(cornerRadius: radius)
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .strokeBorder(live ? DeckPalette.accentEdge
                                  : enabled ? DeckPalette.line : DeckPalette.lineSoft,
                                  lineWidth: 1)
            )
    }
}

// MARK: - Design harness

/// Every state the instrument can be in, stacked. This exists to evaluate the
/// set as a set -- states designed one at a time drift apart, and the failure
/// shows up only when you see them together. Idle is first and appears twice,
/// because idle is what this bar mostly is.
struct DeckAudioInstrumentGallery: View {
    @State private var volume: Double = 0.8

    private struct Row: Identifiable {
        let id = UUID()
        let caption: String
        let phase: DeckCapturePhase
        var level: Double = 0
        var deckPhase: String = "idle"
        var playback = DeckPlaybackState()
        var lastReply: DeckLastReply? = DeckLastReply(duration: 36, playable: true)
        var undelivered: Int = 0
        var heldAudio: Int = 0
        var meter: DeckPlaybackMeter = .init()
    }

    /// A plausible two seconds of speech, so LISTENING demonstrates the figure
    /// it actually draws instead of a flat line the harness cannot animate.
    static let demoWave: [Double] = (0..<56).map { index in
        let t = Double(index) / 8
        return max(0, (sin(t) * 0.5 + sin(t * 2.3) * 0.3 + sin(t * 5.1) * 0.2)) * 0.9
    }

    /// An envelope shaped like speech: phrases with gaps between them, not a
    /// sine wave. Only the heard portion is filled, matching what the real
    /// meter would have accumulated by that position.
    static func demoEnvelope(playedTo fraction: Double) -> [Double] {
        let count = DeckPlaybackMeter.bucketCount
        return (0..<count).map { index in
            guard Double(index) / Double(count) < fraction else { return 0 }
            let t = Double(index)
            // Phrases with breaths between them, which is what speech looks
            // like on a meter -- a smooth hump would flatter the figure and
            // teach me nothing about how it reads.
            let phrase = 0.28 + 0.72 * pow(max(0, sin(t / 6.4 + 0.5)), 0.55)
            let detail = 0.55 + 0.45 * abs(sin(t * 1.15))
            return max(0, min(1, phrase * detail * 1.2))
        }
    }

    private static let narrationText = """
    I finished the bounded task tail work and pushed it to the branch. \
    The Deck now hydrates its lanes straight from Codex task tails, so a \
    restarted runtime no longer loses the last exchange. There is one \
    remaining question about how far back to read before it starts costing \
    real time on a long session. I would like your call on that before I \
    make it configurable.
    """

    private static let midMeter = DeckPlaybackMeter(
        preview: "4:12",
        buckets: demoEnvelope(playedTo: 0.42),
        position: 15.8,
        duration: 37.5
    )

    private static let pausedMeter = DeckPlaybackMeter(
        preview: "4:12",
        buckets: demoEnvelope(playedTo: 0.74),
        position: 27.6,
        duration: 37.5
    )

    private static let openingMeter = DeckPlaybackMeter(
        preview: "4:12",
        buckets: demoEnvelope(playedTo: 0.06),
        position: 2.1,
        duration: 37.5
    )

    private static func playing(position: Double, paused: Bool = false) -> DeckPlaybackState {
        DeckPlaybackState(
            id: "4:12",
            paused: paused,
            position: position,
            duration: 37.5,
            speedIndex: 1,
            autoplay: true,
            text: narrationText
        )
    }

    private var rows: [Row] {
        [
            Row(caption: "READY · a reply waiting to be replayed", phase: .idle),
            Row(caption: "READY · lane has never spoken", phase: .idle, lastReply: nil),
            Row(caption: "READY · autoplay off, 1.50×", phase: .idle,
                playback: DeckPlaybackState(speedIndex: 2, autoplay: false)),
            Row(caption: "LISTENING · live capture", phase: .recording, level: 0.72),
            Row(caption: "ARMING · mic warming", phase: .arming),
            Row(caption: "TRANSCRIBING · on device", phase: .transcribing),
            Row(caption: "MODEL · bounded download", phase: .preparing(0.38)),
            Row(caption: "SPEAKING · just started",
                phase: .idle,
                playback: Self.playing(position: 2.1),
                meter: Self.openingMeter),
            Row(caption: "SPEAKING · mid narration",
                phase: .idle,
                playback: Self.playing(position: 15.8),
                meter: Self.midMeter),
            Row(caption: "PAUSED · playhead held",
                phase: .idle,
                playback: Self.playing(position: 27.6, paused: true),
                meter: Self.pausedMeter),
            Row(caption: "MAC BUSY · deck working", phase: .idle, deckPhase: "submitting"),
            Row(caption: "SENDING · transcripts queued", phase: .delivering(3)),
            Row(caption: "HELD · audio awaiting model", phase: .held(2)),
            Row(caption: "UNSENT · mac unreachable", phase: .idle, undelivered: 4),
        ]
    }

    /// The harness stands in for one pad row. One, in every state -- if a row
    /// here is ever taller than its neighbours, the console has grown a second
    /// height again.
    private let rowUnit: CGFloat = 74
    @State private var scrubTarget: Double?

    /// Each state is shown as the pair it now is: the lane's trace above (where
    /// the audio is drawn) and the transport below (where it is controlled).
    /// They were split apart, so they have to be judged together or the split
    /// drifts.
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(rows) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.caption)
                            .deckMono(7, weight: .medium)
                            .tracking(1)
                            .foregroundStyle(DeckPalette.ink4)
                        DeckLaneTrace(
                            phase: row.phase,
                            inputLevel: row.level,
                            playback: row.playback,
                            meter: row.meter,
                            scrubTarget: $scrubTarget,
                            onSeek: { _ in },
                            demoHistory: row.phase == .recording ? Self.demoWave : nil
                        )
                        DeckAudioInstrument(
                            phase: row.phase,
                            inputLevel: row.level,
                            deckPhase: row.deckPhase,
                            undelivered: row.undelivered,
                            heldAudio: row.heldAudio,
                            lane: 4,
                            playback: row.playback,
                            lastReply: row.lastReply,
                            meter: row.meter,
                            rowUnit: rowUnit,
                            volume: $volume,
                            scrubTarget: scrubTarget
                        )
                        .frame(height: rowUnit)
                    }
                }
            }
        }
    }
}
