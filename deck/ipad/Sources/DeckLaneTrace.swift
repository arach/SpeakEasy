import SwiftUI

/// Formatting the narration figures share with the transport bar.
enum DeckNarrationText {
    static func timecode(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let whole = Int(seconds.rounded(.down))
        return String(format: "%d:%02d", whole / 60, whole % 60)
    }

    /// Cheap sentence split. Not linguistics — narration is prose written by a
    /// model, and terminal punctuation is all the structure it reliably has.
    static func sentences(of text: String) -> [String] {
        var result: [String] = []
        var current = ""
        for character in text {
            current.append(character)
            if character == "." || character == "!" || character == "?" || character == "\n" {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.count > 1 { result.append(trimmed) }
                current = ""
            }
        }
        let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { result.append(trimmed) }
        return result.isEmpty ? [text] : result
    }

    /// The words most likely being heard right now.
    ///
    /// HONEST LIMIT: nothing in this system has word-level timing. The runtime
    /// knows a message's duration, the device knows its position, and that is
    /// the whole of it. So this is an estimate — assume speech is spread evenly
    /// across the text, find the character the playhead lands on, show the
    /// sentence containing it.
    ///
    /// It is deliberately quantised to a *sentence*. A character window built
    /// from the same estimate is wrong by a word or two constantly and looks
    /// broken; a sentence window is wrong by a whole sentence occasionally and
    /// merely looks early or late, which a reader forgives. The leading "≈"
    /// says so on the surface, not just here.
    static func sentence(at progress: Double, in text: String?) -> String? {
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return nil }
        let sentences = sentences(of: text)
        guard !sentences.isEmpty else { return nil }
        let total = sentences.reduce(0) { $0 + $1.count }
        guard total > 0 else { return nil }

        let target = Double(total) * progress
        var seen = 0
        for sentence in sentences {
            seen += sentence.count
            if Double(seen) > target { return sentence }
        }
        return sentences.last
    }
}

/// The live capture figure: what the microphone is hearing, on a clock.
///
/// # Why this is a clock and not an observer
///
/// This used to advance inside `.onChange(of: inputLevel)` — one bar appended
/// per *change* in the level. That is not a recorder, it is a change log, and
/// the difference is the whole bug: silence produces no change, so the window
/// stopped scrolling whenever nobody was talking and then lurched forward when
/// they did. Silence was never drawn as silence; it was drawn as the graph
/// freezing. A waveform that only moves while you speak reads as a component
/// that keeps failing and recovering, which is exactly what it looked like.
///
/// A meter is a fixed-cadence instrument. Tape moves whether or not there is
/// anything on it. So this samples the *current* level 30 times a second and
/// appends it no matter what it is — a silent second is sixty pixels of drawn
/// silence scrolling left, which is information, where a frozen graph is not.
///
/// # Why it is a separate view
///
/// Two things fall out of that which are worth more than the indirection:
/// the clock exists only while this view does, so nothing ticks at 30 Hz while
/// the microphone is shut; and the buffer dies with it, so a new utterance
/// starts on clean tape instead of inheriting the tail of the last one.
///
/// There is no `.animation` on the bars, deliberately. Animating an array whose
/// elements all shift left one place does not animate a scroll — it animates
/// every bar independently morphing into its neighbour's height, which is the
/// wobble that made this look like a blob rather than a trace. At 30 Hz each
/// frame is already a genuinely new sample and needs no tweening.
private struct DeckCaptureBars: View {
    /// Dense enough to fill the bay edge-to-edge; 36 Hz so silence still
    /// scrolls smoothly instead of stepping.
    /// Dense enough for a wide bay without reading as sparse posts.
    private static let sampleCount = 96
    private static let hz = 36.0

    /// The smoothed input level, sampled — not observed.
    let level: Double
    /// Design harness: a fixed window, so the state can be judged as a still
    /// instead of as a flat line with nothing feeding it.
    var frozen: [Double]?

    @State private var history = [Double](repeating: 0, count: sampleCount)
    /// Held in `@State` so it is created once per view identity. A publisher
    /// rebuilt on every level change would resubscribe dozens of times a second.
    @State private var clock = Timer
        .publish(every: 1.0 / hz, on: .main, in: .common)
        .autoconnect()
    /// Light smoothing so a single spiky sample never makes the tape jump.
    @State private var smooth: Double = 0

    var body: some View {
        let levels = frozen ?? history
        GeometryReader { size in
            let mid = size.size.height / 2
            let slot = size.size.width / CGFloat(levels.count)
            HStack(alignment: .center, spacing: 1) {
                ForEach(Array(levels.enumerated()), id: \.offset) { index, value in
                    // Soft window so the bay ends do not look clipped hard.
                    let edge = sin((Double(index) + 0.5) / Double(levels.count) * .pi)
                    let shaped = value * (0.55 + 0.45 * edge)
                    let heard = shaped > 0.02
                    // Thin rectangles, not pills — density with a meter-bar read.
                    RoundedRectangle(cornerRadius: 1, style: .continuous)
                        .fill(DeckPalette.accent.opacity(heard ? 0.92 : 0.14))
                        .frame(width: max(1, min(2, slot * 0.85)),
                               height: heard ? max(2, shaped * mid * 1.85) : 2)
                        .frame(width: max(1, slot - 1), alignment: .center)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onReceive(clock) { _ in
            guard frozen == nil else { return }
            // Attack faster than release — speech pops, silence decays clean.
            let target = max(0, min(1, level))
            let rate = target > smooth ? 0.55 : 0.22
            smooth += (target - smooth) * rate
            history.removeFirst()
            history.append(smooth)
        }
    }
}

/// The lane's radio: envelope, playhead, scrubber, and caption.
///
/// Predestined height. The transport bar below is the console; this bay is the
/// radio that sits on it. Scrubber and caption do not open when narration starts
/// — they are always there, lit when there is something to hear and quiet when
/// there is not. Growing this band would shove the exchange well, and a radio
/// that resizes when it turns on is the loudest possible way to say something
/// quiet.
///
/// The envelope and the scrubber share one column and therefore one width, so
/// the playhead sits exactly over the handle. Keep them stacked.
struct DeckLaneTrace: View {
    let phase: DeckCapturePhase
    let inputLevel: Double
    /// Mac-side deck phase (submitting / running / …). Drives activity figures
    /// when capture is idle but work is still happening off-device.
    var deckPhase: String = "idle"
    var undelivered: Int = 0
    var heldAudio: Int = 0
    let playback: DeckPlaybackState
    /// Live narration level and envelope, republished at 20 Hz. Observed here
    /// and nowhere else, so it invalidates only this band.
    @ObservedObject var meter: DeckPlaybackMeter
    /// Where the thumb is during a scrub. Owned by the surface so the transport
    /// bar's clock can read the *target* while this band is being dragged —
    /// seek commits on release, so the player is asked to move once rather than
    /// sixty times a second.
    @Binding var scrubTarget: Double?
    let onSeek: (Double) -> Void

    /// Design harness only: a fixed capture window, so the LISTENING state can
    /// be evaluated as a still instead of as a flat line nothing is feeding.
    var demoHistory: [Double]?
    /// When true, skip outer plate chrome — parent `DeckPlayerConsole` owns it.
    var embedded: Bool = false
    /// Height of the radio unit (one pad row when fused). Standalone keeps the
    /// legacy fixed bay so surfaces without the player still layout cleanly.
    var unitHeight: CGFloat? = nil

    /// Exterior height of the radio bay when drawn standalone (not fused).
    static let bayHeight: CGFloat = 118

    // The capture buffer lives in `DeckCaptureBars`, not here. It has to be
    // owned by something whose lifetime matches the microphone's, or the next
    // utterance starts on the tail of the last one.

    /// Radio figure genres — lane-console study. Every genre paints the full
    /// width of the slot. Capture outranks playback outranks activity outranks rest.
    enum Figure: Equatable {
        case idle
        case live          // microphone — scrolling capture tape
        case narration     // loudspeaker — envelope + playhead
        case activity      // work with no audio level (sweep / pulse / dashes)
    }

    enum ActivityKind: Equatable {
        case sweep   // transcribing, arming, model, mac busy
        case pulse   // submitting-style full-field breath
        case dashes  // queue / held / undelivered
    }

    var activityKind: ActivityKind {
        switch phase {
        case .held, .delivering:
            return .dashes
        case .arming, .transcribing, .preparing:
            return .sweep
        case .recording, .idle:
            break
        }
        if undelivered > 0 || heldAudio > 0 { return .dashes }
        let p = deckPhase.lowercased()
        if p == "submitting" || p.contains("submit") { return .pulse }
        return .sweep
    }

    /// Capture outranks playback; activity covers the rest of the lifecycle.
    var figure: Figure {
        if phase == .recording { return .live }
        if playback.isPlaying { return .narration }
        switch phase {
        case .arming, .transcribing, .preparing, .held, .delivering:
            return .activity
        case .recording, .idle:
            break
        }
        let p = deckPhase.lowercased()
        if p != "idle" && !p.isEmpty { return .activity }
        if undelivered > 0 || heldAudio > 0 { return .activity }
        return .idle
    }

    // MARK: - Clock
    //
    // The meter is sampled 10x more often than the snapshot, so when it is
    // describing the message the deck says is playing, it is the better clock.
    // A scrub in progress outranks both: the thumb is the intent.

    private var trustsMeter: Bool { playback.id != nil && meter.id == playback.id }

    /// Seeking is a *device* capability, not a deck one. It works because this
    /// iPad owns the player; when the Mac is the one making the sound there is
    /// nothing here to move, so the scrubber loses its handle and its gesture
    /// and becomes an honest progress bar.
    private var canSeek: Bool { trustsMeter && figure == .narration }

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

    /// Accent while the loudspeaker is moving, ink while it is held. The band
    /// must not borrow the capture tint and start claiming the narration is the
    /// thing that is queued.
    private var narrationTint: Color {
        playback.paused ? DeckPalette.ink3 : DeckPalette.accent
    }

    /// Operational status only — never a product name for this face.
    private var label: String {
        switch figure {
        case .live: "CAPTURE"
        case .narration: playback.paused ? "NARRATION · HELD" : "NARRATION"
        case .activity: "ACTIVITY"
        case .idle: embedded ? "RADIO" : ""
        }
    }

    private var labelTint: Color {
        switch figure {
        case .live: DeckPalette.accent
        case .narration: narrationTint
        case .activity: DeckPalette.amber
        case .idle: DeckPalette.ink4
        }
    }

    private var figureTint: Color {
        switch figure {
        case .live: DeckPalette.accent
        case .narration: narrationTint
        case .activity: DeckPalette.amber
        case .idle: DeckPalette.ink4
        }
    }

    // MARK: - Body

    private var resolvedHeight: CGFloat { unitHeight ?? Self.bayHeight }

    var body: some View {
        // Embedded (2U player): meter glass + one scrub rail + quiet caption.
        // One seek head only (on the scrub). No TRACE chrome, no AT REST plaque.
        // Standalone keeps the denser header for surfaces without a transport.
        Group {
            if embedded {
                embeddedBody
            } else {
                standaloneBody
            }
        }
        .frame(height: resolvedHeight)
    }

    /// Upper unit of the fused player — one head when playing; at rest it must
    /// still look like a finished instrument, not a vacant slot.
    private var embeddedBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Meter glass — material first, then figure.
            ZStack {
                // Depth: soft top catch inside the well, hard rim outside.
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                DeckPalette.page,
                                DeckPalette.trace,
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .strokeBorder(DeckPalette.line, lineWidth: 1)
                // Inner highlight — glass edge catching light.
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .strokeBorder(DeckPalette.ink2.opacity(0.06), lineWidth: 1)
                    .padding(1)

                Group {
                    switch figure {
                    case .narration:
                        if trustsMeter || playback.duration > 0 {
                            GeometryReader { envelope($0.size, showPlayhead: false) }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                        } else {
                            MeterRestFigure()
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                        }
                    case .live:
                        DeckCaptureBars(level: inputLevel, frozen: demoHistory)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                    case .activity:
                        DeckActivityField(kind: activityKind, tint: figureTint)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                    case .idle:
                        MeterRestFigure()
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                    }
                }

                if figure == .narration, duration > 0 {
                    Text(DeckNarrationText.timecode(duration))
                        .deckMono(6, weight: .medium)
                        .monospacedDigit()
                        .foregroundStyle(DeckPalette.ink4.opacity(0.85))
                        .padding(.trailing, 7)
                        .padding(.top, 5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .allowsHitTesting(false)
                }
            }
            .frame(height: 32)
            .frame(maxWidth: .infinity)

            // Seek rail — full presence only when narrating; at rest a soft track.
            scrubber(handle: figure == .narration)
                .frame(height: 8)
                .opacity(figure == .narration ? 1 : (figure == .activity ? 0.35 : 0.4))

            // Caption only when there is a sentence; otherwise keep the slot
            // empty so rest stays quiet.
            // Caption slot always reserved (lane-console: never reflows the bay)
            Group {
                if figure == .narration, let line = narrationCaption {
                    Text("≈ \(line)")
                        .deckMono(7)
                        .foregroundStyle(DeckPalette.ink3)
                        .lineLimit(1)
                } else if figure == .live {
                    Text("● LISTENING")
                        .deckMono(7, weight: .semibold)
                        .foregroundStyle(DeckPalette.accent.opacity(0.85))
                        .lineLimit(1)
                } else if figure == .activity {
                    Text("· WORKING")
                        .deckMono(7, weight: .semibold)
                        .foregroundStyle(DeckPalette.amber.opacity(0.9))
                        .lineLimit(1)
                } else {
                    Text("· AT REST")
                        .deckMono(7)
                        .foregroundStyle(DeckPalette.ink4.opacity(0.55))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 10)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var standaloneBody: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                if !label.isEmpty {
                    Text(label)
                        .deckMono(6, weight: .semibold)
                        .tracking(1.1)
                        .foregroundStyle(labelTint)
                }
                Spacer(minLength: 0)
                Text(figure == .narration
                     ? DeckNarrationText.timecode(duration)
                     : "—:—")
                    .deckMono(6.5, weight: .medium)
                    .foregroundStyle(figure == .narration ? DeckPalette.ink4 : DeckPalette.ink4.opacity(0.45))
                    .monospacedDigit()
            }

            Group {
                switch figure {
                case .narration:
                    if trustsMeter || playback.duration > 0 {
                        GeometryReader { envelope($0.size, showPlayhead: true) }
                    } else {
                        LaneIdleReadout(label: "—")
                    }
                case .live:
                    DeckCaptureBars(level: inputLevel, frozen: demoHistory)
                case .activity:
                    DeckActivityField(kind: activityKind, tint: figureTint)
                case .idle:
                    LaneIdleReadout(label: "—")
                }
            }
            .frame(height: 32)
            .frame(maxWidth: .infinity)

            scrubber(handle: figure == .narration)
                .frame(height: 16)
                .opacity(figure == .narration ? 1 : 0.35)

            if figure == .narration {
                HStack(alignment: .top, spacing: 6) {
                    Text(scrubTarget == nil ? "≈" : "→")
                        .deckMono(8.5, weight: .semibold)
                        .foregroundStyle(DeckPalette.ink4)
                    Text(narrationCaption ?? "—")
                        .deckMono(8.5)
                        .foregroundStyle(DeckPalette.ink3)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(DeckPalette.trace)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(DeckPalette.line, lineWidth: 1)
        }
    }

    private var narrationCaption: String? {
        DeckNarrationText.sentence(at: progress, in: playback.text)
    }

    /// Waveform only. When `showPlayhead` is false the scrub rail owns the head
    /// so we never draw two cursors for one playhead.
    private func envelope(_ size: CGSize, showPlayhead: Bool) -> some View {
        let mid = size.height / 2
        let buckets = meter.buckets
        let slot = size.width / CGFloat(max(1, buckets.count))
        let head = CGFloat(progress) * size.width
        return ZStack(alignment: .leading) {
            HStack(alignment: .center, spacing: 1) {
                ForEach(0..<buckets.count, id: \.self) { index in
                    let level = buckets[index]
                    let heard = level > 0.02
                    // Played span lights up; unplayed stays a soft silhouette.
                    let played = Double(index) / Double(max(1, buckets.count)) <= progress
                    RoundedRectangle(cornerRadius: 1, style: .continuous)
                        .fill(narrationTint.opacity(
                            heard ? (played ? 0.92 : 0.22) : (played ? 0.35 : 0.14)
                        ))
                        .frame(width: max(1, min(2, slot * 0.85)),
                               height: heard ? max(2.5, level * mid * 1.75) : 2)
                        .frame(width: max(1, slot - 1), alignment: .center)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if showPlayhead {
                Rectangle()
                    .fill(scrubTarget == nil ? narrationTint : DeckPalette.ink)
                    .frame(width: 1.5)
                    .offset(x: min(size.width - 1.5, max(0, head)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .gesture(seekGesture(width: size.width), isEnabled: canSeek)
    }

    private func seekGesture(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard duration > 0 else { return }
                let fraction = Double(value.location.x / max(width, 1))
                scrubTarget = min(duration, max(0, fraction * duration))
            }
            .onEnded { _ in
                guard let target = scrubTarget else { return }
                scrubTarget = nil
                onSeek(target)
            }
    }

    /// The one seek head. Thin rail; small square handle only while narrating.
    private func scrubber(handle: Bool) -> some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let bar: CGFloat = handle ? 2 : 1.5
            let headW: CGFloat = 7
            let head = max(0, min(width - headW, CGFloat(progress) * width - headW / 2))
            ZStack(alignment: .leading) {
                // Soft track with end ticks so rest still reads as a scale.
                HStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 0.5)
                        .fill(DeckPalette.ink4.opacity(handle ? 0.35 : 0.22))
                        .frame(width: 1, height: handle ? 6 : 4)
                    RoundedRectangle(cornerRadius: 1)
                        .fill(DeckPalette.line)
                        .frame(maxWidth: .infinity)
                        .frame(height: bar)
                    RoundedRectangle(cornerRadius: 0.5)
                        .fill(DeckPalette.ink4.opacity(handle ? 0.35 : 0.22))
                        .frame(width: 1, height: handle ? 6 : 4)
                }
                if handle {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(narrationTint)
                        .frame(width: max(2, CGFloat(progress) * width), height: bar)
                        .padding(.horizontal, 1)
                }
                if handle, canSeek {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(scrubTarget == nil ? DeckPalette.ink2 : DeckPalette.ink)
                        .overlay {
                            RoundedRectangle(cornerRadius: 1)
                                .strokeBorder(DeckPalette.page, lineWidth: 1)
                        }
                        .frame(width: headW, height: headW)
                        .offset(x: head)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(seekGesture(width: width), isEnabled: canSeek)
        }
        .accessibilityLabel("Narration position")
        .accessibilityValue("\(DeckNarrationText.timecode(position)) of \(DeckNarrationText.timecode(duration))")
    }

}

// MARK: - At-rest meter

/// The resting figure in the glass — a soft ghost envelope that reads as a
/// finished instrument waiting, not as an empty or broken graph.
///
/// Shape is deterministic (no random): one gentle phrase across the bay with
/// quiet shoulders. Amplitude stays low so it never competes with live capture
/// or narration when those arrive.
struct MeterRestFigure: View {
    /// Bars across the glass — dense enough to feel continuous on a wide bay.
    private let count = 72

    var body: some View {
        GeometryReader { geo in
            let mid = geo.size.height / 2
            let slot = geo.size.width / CGFloat(count)
            HStack(alignment: .center, spacing: 0) {
                ForEach(0..<count, id: \.self) { i in
                    let t = Double(i) / Double(max(1, count - 1))
                    let amp = Self.amplitude(at: t)
                    let h = max(1.5, amp * mid * 1.35)
                    RoundedRectangle(cornerRadius: 0.75, style: .continuous)
                        .fill(DeckPalette.ink3.opacity(0.14 + amp * 0.22))
                        .frame(width: max(1, min(1.75, slot * 0.7)), height: h)
                        .frame(width: max(1, slot), alignment: .center)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityHidden(true)
    }

    /// Soft speech-shaped silhouette: rise, two quiet phrases, fall.
    /// Always the same — rest should not shimmer or invent activity.
    private static func amplitude(at t: Double) -> Double {
        let shoulder = sin(t * .pi)                          // 0 at edges, 1 mid
        let phrase = 0.55
            + 0.28 * sin(t * .pi * 2.15)
            + 0.12 * sin(t * .pi * 5.4)
        return max(0.08, min(1, shoulder * phrase * 0.55))
    }
}

// MARK: - Activity field (lane-console: working genres)

/// Full-width working figure — sweep / pulse / dashes.
/// Matches `ActivityField` in the lane-console study: the whole slot is the
/// figure, never a lodger. Animates on a TimelineView clock so work reads as
/// motion even with no audio level to report.
private struct DeckActivityField: View {
    let kind: DeckLaneTrace.ActivityKind
    let tint: Color

    private let bars = 80

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            // ~1.05s cycle, same family as the transport work track.
            let phase = (t.truncatingRemainder(dividingBy: 1.05)) / 1.05
            GeometryReader { geo in
                let mid = geo.size.height / 2
                let slot = geo.size.width / CGFloat(bars)
                HStack(alignment: .center, spacing: 1) {
                    ForEach(0..<bars, id: \.self) { i in
                        let amp = amplitude(index: i, phase: phase)
                        let heard = amp > 0.06
                        RoundedRectangle(cornerRadius: 1, style: .continuous)
                            .fill(tint.opacity(heard ? (0.25 + amp * 0.7) : 0.14))
                            .frame(
                                width: max(1, min(2, slot * 0.85)),
                                height: max(2, amp * mid * 1.85)
                            )
                            .frame(width: max(1, slot - 1), alignment: .center)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .accessibilityHidden(true)
    }

    private func amplitude(index: Int, phase: Double) -> Double {
        let t = Double(index) / Double(max(1, bars - 1))
        switch kind {
        case .sweep:
            // Lobe travels edge to edge (circular so the loop is seamless).
            let d = min(abs(t - phase), 1 - abs(t - phase))
            return max(0.08, 1 - d * 2.4)
        case .pulse:
            let amp = 0.35 + abs(sin(phase * .pi * 2)) * 0.55
            let hump = sin(t * .pi)
            return max(0.08, hump * amp)
        case .dashes:
            // Moving dashed density — a queue being worked, not stuck.
            let wave = abs(sin((t + phase) * .pi * 6))
            let gate = wave > 0.45 ? 1.0 : 0.12
            return max(0.08, gate * (0.35 + wave * 0.55))
        }
    }
}
