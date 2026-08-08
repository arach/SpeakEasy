import SwiftUI

/// Turn player — design components + refined motion.
///
/// **Chrome** (player-face study): circular transport ring · status · caption ·
/// figure · chips. Fixed 2U. Caption-first.
///
/// **Motion** (lane-console study): one full-width figure slot whose genre
/// switches by lifecycle — capture tape · work sweep/pulse/dashes · playback
/// envelope · rest baseline. The figure *is* the scrub surface (gesture + lit
/// span). Ring carries transport + progress arc — no second rail under the wave.
///
/// **Embedded** (Micro lane column): foot of the same surface as the lane
/// identity/exchange. Plate texture, top hairline only, no own rounded card.
/// Ring sits in the numeral gutter so TURN / caption share the identity text edge.
struct DeckPlayerConsole: View {
    let phase: DeckCapturePhase
    let inputLevel: Double
    let deckPhase: String
    let undelivered: Int
    let heldAudio: Int
    let lane: Int
    let playback: DeckPlaybackState
    let lastReply: DeckLastReply?
    @ObservedObject var meter: DeckPlaybackMeter
    var rowUnit: CGFloat = 78
    var rowGap: CGFloat = 7
    /// When true, this is the bottom band of the lane surface — plate fill,
    /// no outer rounded border, content aligns to the identity numeral gutter.
    var embedded: Bool = false
    @Binding var volume: Double
    @Binding var scrubTarget: Double?
    var onVolumeCommit: (Double) -> Void = { _ in }
    var onTogglePlayPause: () -> Void = {}
    var onPlayLast: () -> Void = {}
    var onCycleSpeed: () -> Void = {}
    var onToggleAutoplay: () -> Void = {}
    var onSeek: (Double) -> Void = { _ in }

    @State private var finishedLatch = false
    @State private var scrubDragging = false
    @State private var scrubDraft: Double = 0
    @State private var volDragging = false
    @State private var volDraft: Double = 0
    @State private var volAnchor: Double = 0

    static func height(rowUnit: CGFloat, rowGap: CGFloat) -> CGFloat {
        rowUnit * 2 + rowGap
    }

    private var faceHeight: CGFloat {
        Self.height(rowUnit: rowUnit, rowGap: rowGap)
    }

    // MARK: Face

    fileprivate enum Face: Equatable {
        case empty, working, ready, playing, paused, finished, failed
    }

    private var macBusy: Bool {
        let p = deckPhase.lowercased()
        return !p.isEmpty && p != "idle"
    }

    private var captureBusy: Bool {
        switch phase {
        case .arming, .recording, .transcribing, .preparing, .held, .delivering: true
        case .idle: false
        }
    }

    private var face: Face {
        if playback.isPlaying { return playback.paused ? .paused : .playing }
        if captureBusy || macBusy || undelivered > 0 || heldAudio > 0 { return .working }
        if let reply = lastReply {
            let hasText = !(reply.text ?? "").isEmpty
            if hasText && !reply.playable { return .failed }
            if finishedLatch && reply.playable { return .finished }
            if reply.playable || hasText { return .ready }
        }
        return .empty
    }

    private var figureGenre: TurnFigure.Genre {
        if phase == .recording { return .capture }
        if playback.isPlaying { return .playback }
        switch phase {
        case .held, .delivering: return .activity(.dashes)
        case .arming, .transcribing, .preparing: return .activity(.sweep)
        case .recording, .idle: break
        }
        if undelivered > 0 || heldAudio > 0 { return .activity(.dashes) }
        if macBusy {
            let p = deckPhase.lowercased()
            return p.contains("submit") ? .activity(.pulse) : .activity(.sweep)
        }
        return .rest
    }

    private var trustsMeter: Bool { playback.id != nil && meter.id == playback.id }

    private var duration: Double {
        let m = trustsMeter ? meter.duration : 0
        return m > 0 ? m : max(0, playback.duration, lastReply?.duration ?? 0)
    }

    private var position: Double {
        if scrubDragging { return scrubDraft * max(duration, 0.001) }
        if let scrubTarget { return scrubTarget }
        return trustsMeter ? meter.position : playback.position
    }

    private var progress: Double {
        if duration > 0 { return min(1, max(0, position / duration)) }
        if face == .finished { return 1 }
        return 0
    }

    private var caption: String {
        if let t = playback.text, !t.isEmpty { return t }
        if let t = lastReply?.text, !t.isEmpty { return t }
        return ""
    }

    private var turnLabel: String? {
        if let msg = playback.message { return "TURN \(msg + 1)" }
        if face == .empty { return nil }
        return "TURN \(max(1, lane + 1))"
    }

    private var statusWord: String {
        switch face {
        case .empty: return "NO AUDIO"
        case .working:
            switch phase {
            case .recording: return "LISTENING"
            case .transcribing: return "TRANSCRIBING"
            case .preparing: return "PREPARING"
            case .delivering: return "DELIVERING"
            case .held: return "HELD"
            case .arming: return "ARMING"
            case .idle:
                let p = deckPhase.uppercased()
                return (p.isEmpty || p == "IDLE") ? "WORKING" : p
            }
        case .ready: return "SUMMARY"
        case .playing: return "SPEAKING"
        case .paused: return "PAUSED"
        case .finished: return "PLAYED"
        case .failed: return "SYNTHESIS FAILED"
        }
    }

    private var statusTone: Color {
        switch face {
        case .empty: return DeckPalette.ink4
        case .working: return phase == .recording ? DeckPalette.accent : DeckPalette.amber
        case .ready, .playing: return DeckPalette.accent
        case .paused, .finished: return DeckPalette.ink3
        case .failed: return Self.coral
        }
    }

    private var meta: String? {
        switch face {
        case .empty: return String(format: "LANE %02d", lane + 1)
        case .working: return phase == .recording ? nil : DeckNarrationText.timecode(0)
        case .ready:
            if let d = lastReply?.duration, d > 0 { return DeckNarrationText.timecode(d) }
            return nil
        case .playing: return nil
        case .paused: return "\(DeckNarrationText.timecode(max(0, duration - position))) LEFT"
        case .finished:
            return duration > 0 ? DeckNarrationText.timecode(duration) : nil
        case .failed: return "READ ABOVE"
        }
    }

    /// Tape clock under the figure when there is something to play — not under
    /// the ring. `0:00` · current · total.
    private var showsTapeClock: Bool {
        switch face {
        case .ready, .playing, .paused, .finished:
            return duration > 0 || lastReply?.playable == true || playback.isPlaying
        case .empty, .working, .failed:
            return false
        }
    }

    private var tapeCurrent: String {
        switch face {
        case .ready: return "0:00"
        case .playing, .paused: return DeckNarrationText.timecode(position)
        case .finished: return DeckNarrationText.timecode(max(duration, position))
        default: return "0:00"
        }
    }

    private var tapeEnd: String {
        duration > 0 ? DeckNarrationText.timecode(duration) : "—:——"
    }

    private var showKnob: Bool { face == .ready || face == .playing || face == .paused }
    private var canTransport: Bool { playback.isPlaying || lastReply?.playable == true }
    private var isLiveBorder: Bool {
        phase == .recording || (playback.isPlaying && !playback.paused)
    }
    private var moduleDim: Double { face == .empty ? 0.45 : 1 }

    // MARK: Body

    /// Match ActiveLaneInstrument's ledger rail so TURN title / caption start
    /// on the same edge as project name and turn body (embedded Micro).
    private var gutterWidth: CGFloat { embedded ? 50 : 60 }
    /// Transport key — slightly proud of the gutter, still one horizontal band.
    private var ringSize: CGFloat { embedded ? 48 : 56 }
    private var columnGap: CGFloat { embedded ? 12 : 14 }
    private var edgePad: CGFloat { 14 }
    /// Head sits a bit lower so TURN / caption balance the plate (not roof-hug).
    private var topPad: CGFloat { embedded ? 10 : 12 }
    private var bottomPad: CGFloat { embedded ? 9 : 11 }
    /// Figure bay matches the play button — one horizontal instrument row.
    private var figureHeight: CGFloat { ringSize }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            headBlock

            // Free space sits mostly above the transport so ring + bay rest a
            // touch lower; chips stay on the floor with a short fixed gap.
            Spacer(minLength: 8)

            // Ring + figure: one horizontal band. Same height, same centre.
            transportBand

            Spacer(minLength: 4)
                .frame(maxHeight: 10)

            // Speed / vol / autoplay sit on the floor of the plate.
            chipsRow
                .frame(height: 22, alignment: .center)
        }
        .padding(.horizontal, edgePad)
        .padding(.top, topPad)
        .padding(.bottom, bottomPad)
        .frame(maxWidth: .infinity)
        .frame(height: faceHeight)
        .opacity(moduleDim)
        .background { chassisFill }
        .overlay { chassisStroke }
        .onChange(of: playback) { old, new in
            if new.isPlaying {
                finishedLatch = false
            } else if old.isPlaying, old.duration > 0, old.position >= old.duration * 0.92 {
                finishedLatch = true
            }
        }
        .onChange(of: lastReply?.text) { _, _ in finishedLatch = false }
    }

    /// Status + caption — indented so their left edge matches the figure
    /// (announcement aligns with the wave, not the ring).
    private var headBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            statusRow
                .frame(height: 12, alignment: .leading)
            captionBlock
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .frame(height: embedded ? 20 : 22, alignment: .topLeading)
                .padding(.top, 2)
        }
        .padding(.leading, gutterWidth + columnGap)
    }

    private var transportBand: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: columnGap) {
                transportButton
                    .frame(width: gutterWidth, height: figureHeight)

                figureBay
                    .frame(height: figureHeight)
                    .frame(maxWidth: .infinity)
            }

            // Tape clock under the bay only — start · playhead · end.
            // Never under the ring; the ring is transport, not a clock.
            if showsTapeClock {
                tapeClock
                    .padding(.leading, gutterWidth + columnGap)
            }
        }
    }

    /// Classic tape readout: origin left, now centre, length right.
    private var tapeClock: some View {
        ZStack {
            HStack(spacing: 0) {
                Text("0:00")
                    .foregroundStyle(DeckPalette.ink4)
                Spacer(minLength: 4)
                Text(tapeEnd)
                    .foregroundStyle(DeckPalette.ink4)
            }
            Text(tapeCurrent)
                .foregroundStyle(
                    face == .playing ? DeckPalette.ink2
                        : face == .paused ? DeckPalette.ink3
                        : DeckPalette.ink3
                )
        }
        .font(.system(size: 9, weight: .medium, design: .monospaced))
        .tracking(0.2)
        .lineLimit(1)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Playback time")
        .accessibilityValue("\(tapeCurrent) of \(tapeEnd)")
    }

    private var transportButton: some View {
        Button(action: ringAction) {
            TransportRing(
                face: face,
                genre: figureGenre,
                progress: progress,
                level: inputLevel,
                size: ringSize,
                accent: DeckPalette.accent,
                accentDim: DeckPalette.accentDim,
                amber: DeckPalette.amber,
                coral: Self.coral,
                line: DeckPalette.line,
                well: DeckPalette.trace,
                ink: DeckPalette.ink2,
                inkMuted: DeckPalette.ink4
            )
            .frame(width: ringSize, height: ringSize)
        }
        .buttonStyle(.plain)
        .disabled(!canTransport && face != .failed)
        .accessibilityLabel(ringA11y)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var chassisFill: some View {
        let plate = LinearGradient(
            colors: [DeckPalette.plateTop, DeckPalette.plate, DeckPalette.plateBottom],
            startPoint: .top,
            endPoint: .bottom
        )
        if embedded {
            // Foot of the lane surface — different texture, no own card.
            Rectangle().fill(plate)
        } else {
            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(plate)
        }
    }

    @ViewBuilder
    private var chassisStroke: some View {
        if embedded {
            // Hairline under exchange only — outer rim is the parent surface.
            VStack(spacing: 0) {
                Rectangle()
                    .fill(isLiveBorder ? DeckPalette.accent.opacity(0.38) : DeckPalette.lineSoft)
                    .frame(height: 1)
                Spacer(minLength: 0)
            }
        } else {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(
                    isLiveBorder ? DeckPalette.accent.opacity(0.38) : DeckPalette.line,
                    lineWidth: 1
                )
        }
    }

    private func ringAction() {
        switch face {
        case .playing, .paused: onTogglePlayPause()
        case .ready, .finished, .failed: onPlayLast()
        case .empty, .working: break
        }
    }

    private var ringA11y: String {
        switch face {
        case .playing: return "Pause"
        case .paused: return "Resume"
        case .ready: return "Play summary"
        case .finished: return "Replay"
        case .failed: return "Retry"
        case .working: return statusWord
        case .empty: return "No audio"
        }
    }

    private var restLabel: String {
        switch face {
        case .empty: return "NO AUDIO"
        case .ready: return "READY"
        case .finished: return "PLAYED"
        case .failed: return "NO WAVE"
        default: return "AT REST"
        }
    }

    private var figureBay: some View {
        let interactive = face == .playing || face == .paused || face == .ready || face == .finished
        return GeometryReader { geo in
            TurnFigure(
                genre: figureGenre,
                level: inputLevel,
                buckets: meter.buckets,
                progress: progress,
                paused: playback.paused,
                showKnob: showKnob && (face == .playing || face == .paused || face == .ready),
                restLabel: restLabel,
                restSilhouette: face == .ready || face == .finished,
                accent: DeckPalette.accent,
                amber: DeckPalette.amber,
                line: DeckPalette.line,
                lineSoft: DeckPalette.lineSoft,
                trace: DeckPalette.trace
            )
            .frame(width: geo.size.width, height: geo.size.height)
            .contentShape(Rectangle())
            .gesture(
                interactive
                    ? DragGesture(minimumDistance: 0)
                        .onChanged { v in
                            let next = min(1, max(0, Double(v.location.x / max(geo.size.width, 1))))
                            scrubDragging = true
                            scrubDraft = next
                            scrubTarget = next * max(duration, 0.001)
                        }
                        .onEnded { v in
                            let next = min(1, max(0, Double(v.location.x / max(geo.size.width, 1))))
                            onSeek(next * max(duration, 0.001))
                            scrubDragging = false
                            scrubTarget = nil
                        }
                    : nil
            )
        }
        .accessibilityLabel("Playback position")
        .accessibilityValue(DeckNarrationText.timecode(position))
    }

    private var statusRow: some View {
        HStack(spacing: 6) {
            if face == .empty {
                Text(meta ?? String(format: "LANE %02d", lane + 1))
                    .foregroundStyle(DeckPalette.ink4)
                Text("·").foregroundStyle(DeckPalette.ink4.opacity(0.65))
                Text(statusWord).foregroundStyle(DeckPalette.ink4)
            } else {
                if let turnLabel { Text(turnLabel).foregroundStyle(statusTone) }
                Text("·").foregroundStyle(DeckPalette.ink4.opacity(0.65))
                Text(statusWord).foregroundStyle(statusTone)
                if face == .playing {
                    // Live lamp after the word so TURN / caption share an edge.
                    Circle().fill(DeckPalette.accent).frame(width: 4, height: 4)
                }
                if let meta {
                    Text("·").foregroundStyle(DeckPalette.ink4.opacity(0.65))
                    Text(meta).foregroundStyle(DeckPalette.ink4)
                }
            }
        }
        .font(.system(size: embedded ? 9.5 : 10, weight: .semibold, design: .monospaced))
        .tracking(0.5)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }

    @ViewBuilder
    private var captionBlock: some View {
        if face == .empty {
            VStack(alignment: .leading, spacing: 5) {
                ghost(0.72)
                ghost(0.48)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        } else {
            Text(
                caption.isEmpty && face == .working
                    ? (phase == .recording ? "Listening…" : "Working…")
                    : caption
            )
            .font(.system(size: embedded ? 12 : 12.5, weight: .regular))
            .foregroundStyle(DeckPalette.ink)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func ghost(_ f: CGFloat) -> some View {
        GeometryReader { g in
            Rectangle().fill(DeckPalette.line).frame(width: g.size.width * f, height: 1)
        }
        .frame(height: 1)
    }

    // MARK: Chips

    private var chipsRow: some View {
        HStack(spacing: 6) {
            chip {
                Text(DeckPlaybackSpeeds.label(at: playback.speedIndex))
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(face == .empty ? DeckPalette.ink4 : DeckPalette.ink3)
            }
            .onTapGesture(perform: onCycleSpeed)

            chip {
                HStack(spacing: 6) {
                    Text("VOL")
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle((face == .empty ? DeckPalette.ink4 : DeckPalette.ink3).opacity(0.55))
                    GeometryReader { g in
                        let v = volDragging ? volDraft : volume
                        ZStack(alignment: .leading) {
                            Capsule().fill(DeckPalette.line)
                            Capsule()
                                .fill(face == .empty ? DeckPalette.ink4 : DeckPalette.ink3)
                                .frame(width: max(0, g.size.width * v))
                        }
                    }
                    .frame(width: 26, height: 2.5)
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { v in
                        if !volDragging { volDragging = true; volAnchor = volume }
                        volDraft = min(1, max(0, volAnchor + v.translation.width / 80))
                    }
                    .onEnded { _ in
                        volume = volDraft
                        onVolumeCommit(volDraft)
                        volDragging = false
                    }
            )

            Spacer(minLength: 4)
            autoChip
        }
    }

    private var autoChip: some View {
        let off = !playback.autoplay
        let next = face == .finished && playback.autoplay
        let label = next ? "NEXT TURN AUTOPLAYS" : (off ? "AUTOPLAY OFF" : "AUTOPLAY ON")
        let active = !off && face != .empty
        return Button(action: onToggleAutoplay) {
            HStack(spacing: 6) {
                Circle()
                    .fill(off || face == .empty ? DeckPalette.ink4 : DeckPalette.amber)
                    .frame(width: 4, height: 4)
                Text(label)
                    .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                    .tracking(0.5)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(active ? DeckPalette.amber.opacity(0.12) : DeckPalette.pad.opacity(0.55))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(active ? DeckPalette.amber.opacity(0.4) : DeckPalette.line, lineWidth: 1)
            }
            .foregroundStyle(off || face == .empty ? DeckPalette.ink4 : DeckPalette.amber)
        }
        .buttonStyle(.plain)
    }

    private func chip<Content: View>(@ViewBuilder _ c: () -> Content) -> some View {
        c()
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(DeckPalette.pad.opacity(0.55))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(DeckPalette.line, lineWidth: 1)
            }
    }

    private static let coral = Color(red: 0.88, green: 0.48, blue: 0.37)
}

// MARK: - Transport ring (light coherent motion — scrub owns the playhead)

private struct TransportRing: View {
    let face: DeckPlayerConsole.Face
    let genre: TurnFigure.Genre
    let progress: Double
    let level: Double
    var size: CGFloat = 52
    let accent: Color
    let accentDim: Color
    let amber: Color
    let coral: Color
    let line: Color
    let well: Color
    let ink: Color
    let inkMuted: Color

    private var stroke: CGFloat { size < 48 ? 2 : 2.25 }

    private var needsClock: Bool {
        face == .playing || face == .working
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !needsClock)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            // Slow breath while speaking; same ~1s family as activity bars when working.
            let breath = 0.5 + 0.5 * sin(t * .pi * 1.4)
            let phase = t.truncatingRemainder(dividingBy: 1.05) / 1.05
            ringCanvas(breath: breath, phase: phase)
        }
    }

    @ViewBuilder
    private func ringCanvas(breath: Double, phase: Double) -> some View {
        let r = (size - stroke) / 2 - 1
        ZStack {
            Circle().fill(well).frame(width: r * 2, height: r * 2)
            Circle()
                .stroke(face == .failed ? coral : line, lineWidth: stroke)
                .frame(width: r * 2, height: r * 2)

            arcLayer(r: r, breath: breath, phase: phase)

            glyph(breath: breath, phase: phase)
        }
        .frame(width: size, height: size)
    }

    @ViewBuilder
    private func arcLayer(r: CGFloat, breath: Double, phase: Double) -> some View {
        switch face {
        case .playing:
            // Progress arc (steady) + soft end-glow that breathes — "alive", not busy
            let p = max(0.02, min(1, progress))
            Circle()
                .trim(from: 0, to: CGFloat(p))
                .stroke(accent, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .frame(width: r * 2, height: r * 2)
                .rotationEffect(.degrees(-90))
                .opacity(0.88 + breath * 0.12)
            // Tiny bright tip at the progress end
            Circle()
                .trim(from: CGFloat(max(0, p - 0.02)), to: CGFloat(p))
                .stroke(accent.opacity(0.55 + breath * 0.35), style: StrokeStyle(lineWidth: stroke + 0.5, lineCap: .round))
                .frame(width: r * 2, height: r * 2)
                .rotationEffect(.degrees(-90))

        case .paused:
            let p = max(0.02, min(1, progress))
            Circle()
                .trim(from: 0, to: CGFloat(p))
                .stroke(accentDim, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .frame(width: r * 2, height: r * 2)
                .rotationEffect(.degrees(-90))

        case .finished:
            Circle()
                .trim(from: 0, to: 0.999)
                .stroke(accentDim, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .frame(width: r * 2, height: r * 2)
                .rotationEffect(.degrees(-90))
                .opacity(0.65)

        case .working:
            // Same vocabulary as the figure slot — sweep / pulse / capture
            switch genre {
            case .capture:
                let span = 0.18 + min(0.55, level * 0.55)
                Circle()
                    .trim(from: 0, to: CGFloat(span))
                    .stroke(accent.opacity(0.75 + level * 0.2), style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    .frame(width: r * 2, height: r * 2)
                    .rotationEffect(.degrees(-90 + phase * 40))
            case .activity(.sweep):
                Circle()
                    .trim(from: 0, to: 0.26)
                    .stroke(amber.opacity(0.85), style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    .frame(width: r * 2, height: r * 2)
                    .rotationEffect(.degrees(-90 + phase * 360))
            case .activity(.pulse):
                let span = 0.22 + abs(sin(phase * .pi * 2)) * 0.35
                Circle()
                    .trim(from: 0, to: CGFloat(span))
                    .stroke(amber.opacity(0.8), style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    .frame(width: r * 2, height: r * 2)
                    .rotationEffect(.degrees(-90))
            case .activity(.dashes):
                ForEach(0..<5, id: \.self) { i in
                    let start = (Double(i) / 5.0 + phase).truncatingRemainder(dividingBy: 1)
                    Circle()
                        .trim(from: CGFloat(start), to: CGFloat(min(1, start + 0.05)))
                        .stroke(amber.opacity(0.8), style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                        .frame(width: r * 2, height: r * 2)
                        .rotationEffect(.degrees(-90))
                }
            case .rest, .playback:
                Circle()
                    .trim(from: 0, to: 0.2)
                    .stroke(amber.opacity(0.7), style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    .frame(width: r * 2, height: r * 2)
                    .rotationEffect(.degrees(-90 + phase * 360))
            }

        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private func glyph(breath: Double, phase: Double) -> some View {
        if face == .playing {
            // Pause bars breathe slightly so the key feels live while speaking
            let barH = size * 0.20
            let barW = max(2.5, size * 0.06)
            HStack(spacing: max(2.5, size * 0.06)) {
                RoundedRectangle(cornerRadius: 0.6).fill(accent).frame(width: barW, height: barH)
                RoundedRectangle(cornerRadius: 0.6).fill(accent).frame(width: barW, height: barH)
            }
            .opacity(0.72 + breath * 0.28)
            .scaleEffect(0.96 + breath * 0.04)
        } else if face == .failed {
            Path { p in
                p.move(to: CGPoint(x: 4.5, y: 11.5))
                p.addLine(to: CGPoint(x: 11.5, y: 4.5))
            }
            .stroke(coral, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
            .frame(width: size * 0.32, height: size * 0.32)
        } else if face == .working {
            // Dots step with the work phase — same amber family as figure
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { i in
                    let lit = Int(phase * 3) % 3 == i
                    Circle()
                        .fill(genre == .capture ? accent : amber)
                        .frame(width: 3.5, height: 3.5)
                        .opacity(lit ? 0.95 : 0.28)
                }
            }
        } else {
            Image(systemName: "play.fill")
                .font(.system(size: size * 0.30, weight: .semibold))
                .foregroundStyle(
                    face == .ready || face == .paused ? accent
                        : face == .empty ? inkMuted : ink
                )
                .opacity(face == .empty ? 0.5 : 1)
                .offset(x: 1)
        }
    }
}

// MARK: - Turn figure (lane-console motion language)

/// Full-width figure slot. Genres match lane-console RadioFigure.
/// Height is locked to the transport ring so zero-state and live share geometry.
/// When `showKnob`, a thin playhead sits on the lit span — this bay is the scrub.
private struct TurnFigure: View {
    enum ActivityKind: Equatable { case sweep, pulse, dashes }
    enum Genre: Equatable {
        case rest, capture, activity(ActivityKind), playback
    }

    let genre: Genre
    let level: Double
    let buckets: [Double]
    let progress: Double
    let paused: Bool
    var showKnob: Bool = false
    var restLabel: String = "AT REST"
    /// Ready / finished: faint speech silhouette so the bay is a *place*, not a void.
    var restSilhouette: Bool = false
    let accent: Color
    let amber: Color
    let line: Color
    let lineSoft: Color
    let trace: Color

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(trace)
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(line, lineWidth: 1)

                Group {
                    switch genre {
                    case .capture:
                        CaptureTape(level: level, tint: accent)
                            .padding(.horizontal, 8).padding(.vertical, 5)
                    case .activity(let kind):
                        ActivityBars(kind: kind, tint: amber)
                            .padding(.horizontal, 8).padding(.vertical, 5)
                    case .playback:
                        PlaybackEnvelope(
                            buckets: buckets,
                            progress: progress,
                            tint: paused ? DeckPalette.ink3 : accent,
                            line: line
                        )
                        .padding(.horizontal, 8).padding(.vertical, 5)
                    case .rest:
                        RestPlaceholder(
                            label: restLabel,
                            showSilhouette: restSilhouette,
                            line: line,
                            lineSoft: lineSoft,
                            ink: DeckPalette.ink4
                        )
                        .padding(.horizontal, 10).padding(.vertical, 6)
                    }
                }
                .frame(width: w, height: h)

                if showKnob, genre == .playback || progress > 0 {
                    let x = max(3, min(w - 3, w * CGFloat(progress)))
                    Capsule()
                        .fill(paused ? DeckPalette.ink2 : accent)
                        .frame(width: 1.5, height: max(12, h - 10))
                        .position(x: x, y: h / 2)
                }
            }
            .frame(width: w, height: h)
        }
    }
}

/// Capture: scrolling tape. Samples on a clock so silence still moves
/// (lane-console CaptureWave / DeckCaptureBars).
private struct CaptureTape: View {
    let level: Double
    let tint: Color
    private static let n = 88
    private static let hz = 36.0

    @State private var history = [Double](repeating: 0, count: n)
    @State private var smooth = 0.0
    @State private var clock = Timer
        .publish(every: 1.0 / hz, on: .main, in: .common)
        .autoconnect()

    var body: some View {
        GeometryReader { geo in
            let mid = geo.size.height / 2
            let slot = geo.size.width / CGFloat(Self.n)
            HStack(alignment: .center, spacing: 1) {
                ForEach(Array(history.enumerated()), id: \.offset) { i, v in
                    let edge = sin((Double(i) + 0.5) / Double(Self.n) * .pi)
                    let shaped = v * (0.55 + 0.45 * edge)
                    let hot = shaped > 0.06
                    RoundedRectangle(cornerRadius: 1, style: .continuous)
                        .fill(tint.opacity(hot ? 0.92 : 0.14))
                        .frame(
                            width: max(1, min(2, slot * 0.85)),
                            height: hot ? max(2, shaped * mid * 1.9) : 2
                        )
                        .frame(width: max(1, slot - 1), alignment: .center)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onReceive(clock) { _ in
            let target = max(0, min(1, level))
            smooth += (target - smooth) * (target > smooth ? 0.55 : 0.22)
            history.removeFirst()
            history.append(smooth)
        }
    }
}

/// Working activity — sweep / pulse / dashes (lane-console ActivityField).
private struct ActivityBars: View {
    let kind: TurnFigure.ActivityKind
    let tint: Color
    private let n = 80

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { ctx in
            let phase = ctx.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: 1.05) / 1.05
            GeometryReader { geo in
                let mid = geo.size.height / 2
                let slot = geo.size.width / CGFloat(n)
                HStack(alignment: .center, spacing: 1) {
                    ForEach(0..<n, id: \.self) { i in
                        let amp = amplitude(i: i, phase: phase)
                        RoundedRectangle(cornerRadius: 1, style: .continuous)
                            .fill(tint.opacity(0.18 + amp * 0.78))
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
    }

    private func amplitude(i: Int, phase: Double) -> Double {
        let t = Double(i) / Double(max(1, n - 1))
        switch kind {
        case .sweep:
            let d = min(abs(t - phase), 1 - abs(t - phase))
            return max(0.08, 1 - d * 2.4)
        case .pulse:
            let amp = 0.35 + abs(sin(phase * .pi * 2)) * 0.55
            return max(0.08, sin(t * .pi) * amp)
        case .dashes:
            let wave = abs(sin((t + phase) * .pi * 6))
            return max(0.08, (wave > 0.45 ? 1.0 : 0.12) * (0.35 + wave * 0.55))
        }
    }
}

/// Playback: full speech silhouette + played span lit (lane-console PlaybackWave).
/// Meter buckets fill as heard; silhouette holds the unplayed shape so it never
/// reads as an empty graph. Parent TurnFigure owns the scrub knob.
private struct PlaybackEnvelope: View {
    let buckets: [Double]
    let progress: Double
    let tint: Color
    let line: Color

    private let n = 96

    var body: some View {
        GeometryReader { geo in
            let mid = geo.size.height / 2
            let slot = geo.size.width / CGFloat(n)
            let head = progress
            HStack(alignment: .center, spacing: 1) {
                ForEach(0..<n, id: \.self) { i in
                    let t = Double(i) / Double(max(1, n - 1))
                    let sil = PlaybackEnvelope.silhouette(t)
                    // Prefer live meter when that slice has been heard
                    let bi = Int(t * Double(max(0, buckets.count - 1)))
                    let met = buckets.indices.contains(bi) ? buckets[bi] : 0
                    let v = met > 0.02 ? met : sil
                    let played = t <= head
                    RoundedRectangle(cornerRadius: 1, style: .continuous)
                        .fill(played ? tint.opacity(met > 0.02 ? 0.95 : 0.55) : line.opacity(0.35))
                        .frame(
                            width: max(1, min(2, slot * 0.85)),
                            height: max(2, v * mid * 1.85)
                        )
                        .frame(width: max(1, slot - 1), alignment: .center)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// Deterministic speech-shaped envelope (studio speechEnvelope family).
    static func silhouette(_ t: Double) -> Double {
        let phrase = abs(sin(t * .pi * 3.2))
        let formant = abs(sin(t * 47)) * 0.35 + abs(sin(t * 19)) * 0.25
        let breath = phrase > 0.12 ? 1.0 : 0.08
        let attack = t < 0.04 ? t / 0.04 : t > 0.94 ? (1 - t) / 0.06 : 1
        return min(1, max(0.06, (phrase * 0.55 + formant) * breath * attack))
    }
}

/// Zero-state bay — study RestField + LaneIdleReadout.
/// Same height as the transport ring. Not a flat failed graph: a recessed
/// window with either a quiet speech ghost (ready) or a labelled baseline.
private struct RestPlaceholder: View {
    let label: String
    var showSilhouette: Bool = false
    let line: Color
    let lineSoft: Color
    let ink: Color

    private let n = 64

    var body: some View {
        GeometryReader { geo in
            let mid = geo.size.height / 2
            let slot = geo.size.width / CGFloat(n)
            ZStack {
                if showSilhouette {
                    // Faint speech-shaped ghost — legibly "audio lives here"
                    // without pretending something is playing.
                    HStack(alignment: .center, spacing: 1) {
                        ForEach(0..<n, id: \.self) { i in
                            let t = Double(i) / Double(max(1, n - 1))
                            let v = PlaybackEnvelope.silhouette(t)
                            RoundedRectangle(cornerRadius: 1, style: .continuous)
                                .fill(line.opacity(0.28 + v * 0.22))
                                .frame(
                                    width: max(1, min(2, slot * 0.85)),
                                    height: max(2, v * mid * 1.55)
                                )
                                .frame(width: max(1, slot - 1), alignment: .center)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    // Dormant baseline — full width, not a broken meter.
                    Capsule()
                        .fill(lineSoft)
                        .frame(height: 1)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 4)
                }

                Text(label)
                    .font(.system(size: 8, weight: .semibold, design: .monospaced))
                    .tracking(1.4)
                    .foregroundStyle(ink)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule(style: .continuous)
                            .fill(DeckPalette.trace.opacity(0.92))
                    )
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }
}
