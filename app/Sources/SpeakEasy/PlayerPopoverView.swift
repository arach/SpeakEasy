import SwiftUI

/// Compact menu-bar player popover. Observes `PlaybackEngine.shared` and only
/// surfaces transport actions that the engine already implements.
///
/// Layout is three zones with three different treatments, so the pop-up reads as
/// a player rather than a stack of equally weighted cards:
///
///   1. conversation / task state — flat on the pop-up background
///   2. playback — a single raised well holding now-playing, timeline,
///      transport, and the output controls
///   3. queue + utility — flat, separated by hairlines
struct PlayerPopoverView: View {
    @ObservedObject private var engine = PlaybackEngine.shared
    @ObservedObject private var listening = ListeningSessionController.shared
    @Environment(\.theme) private var theme

    let onOpenSettings: () -> Void
    let onQuit: () -> Void

    @State private var isScrubbing = false
    @State private var scrubTime: TimeInterval = 0

    private let speedOptions: [Float] = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]

    private var accent: Color { SpeakEasyAccent.mint }

    init(
        onOpenSettings: @escaping () -> Void = {},
        onQuit: @escaping () -> Void = {}
    ) {
        self.onOpenSettings = onOpenSettings
        self.onQuit = onQuit
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            PopoverHairline()
            ListeningPopoverSection()
            playbackWell
            PopoverHairline()
            queueSection
            PopoverHairline()
            footer
        }
        .frame(width: PopoverMetrics.width)
        .background(theme.background)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 8) {
            Image(nsImage: SpeakeasyIcon.tumbler(filled: true))
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 15, height: 15)
                .foregroundColor(accent)
                .accessibilityHidden(true)

            Text("SpeakEasy")
                .font(PopoverType.title)
                .foregroundColor(theme.text)

            Spacer()

            stateBadge
        }
        .padding(.horizontal, PopoverMetrics.gutter)
        .padding(.top, 13)
        .padding(.bottom, 11)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("SpeakEasy player, \(stateAccessibilityLabel)")
    }

    /// Playback state only. The listening phase has its own readout in the
    /// conversation zone, so the two never describe the same thing.
    private var stateBadge: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(stateColor)
                .frame(width: 5, height: 5)
                .accessibilityHidden(true)

            Text(stateLabel)
                .font(PopoverType.caption)
                .foregroundColor(stateColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule().fill(engine.state == .idle ? Color.clear : stateColor.opacity(0.13))
        )
        .accessibilityLabel("Playback state: \(stateLabel)")
    }

    // MARK: - Playback well

    /// The one raised surface in the pop-up: now playing, timeline, transport,
    /// and output controls read as a single instrument.
    private var playbackWell: some View {
        VStack(alignment: .leading, spacing: 0) {
            nowPlayingRow
                .padding(.bottom, 12)

            timelineRow
                .padding(.bottom, 10)

            transportRow
                .padding(.bottom, 4)

            PopoverHairline()
                .padding(.bottom, 10)

            outputControls

            if let error = engine.lastError, engine.state == .failed {
                PopoverCallout(message: error, accessibilityPrefix: "Playback error")
                    .padding(.top, 10)
            }
        }
        .padding(PopoverMetrics.wellPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: PopoverMetrics.wellRadius, style: .continuous)
                .fill(theme.wellFill)
        )
        .padding(.horizontal, PopoverMetrics.gutter)
        .padding(.vertical, PopoverMetrics.zonePadding)
    }

    // MARK: - Now playing

    private var nowPlayingRow: some View {
        HStack(alignment: .center, spacing: 11) {
            artworkTile

            VStack(alignment: .leading, spacing: 2) {
                Text(primaryTitle)
                    .font(PopoverType.itemTitle)
                    .foregroundColor(engine.currentItem == nil ? theme.textSecondary : theme.text)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Text(primarySubtitle)
                    .font(PopoverType.secondary)
                    .foregroundColor(theme.textTertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(nowPlayingAccessibilityLabel)
    }

    private var artworkTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(engine.currentItem == nil ? theme.insetFillMuted : accent.opacity(0.16))
                .frame(width: 36, height: 36)

            Image(systemName: artworkSymbol)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(engine.currentItem == nil ? theme.textTertiary : accent)
        }
        .accessibilityHidden(true)
    }

    // MARK: - Timeline

    private var timelineRow: some View {
        VStack(spacing: 5) {
            PopoverScrubBar(
                value: displayedTime,
                span: max(engine.duration, 0.001),
                enabled: canScrub,
                accent: accent,
                trackHeight: 4,
                step: 5,
                accessibilityLabelText: "Playback position",
                accessibilityValueText: timeAccessibilityValue,
                onScrub: { newValue in
                    isScrubbing = true
                    scrubTime = newValue
                },
                onCommit: { newValue in
                    scrubTime = newValue
                    engine.seek(to: newValue)
                    isScrubbing = false
                }
            )

            HStack {
                Text(PopoverFormat.time(displayedTime))
                    .font(PopoverType.mono)
                    .foregroundColor(theme.textTertiary)
                    .accessibilityHidden(true)

                Spacer()

                Text(PopoverFormat.time(engine.duration))
                    .font(PopoverType.mono)
                    .foregroundColor(theme.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .opacity(canScrub ? 1 : 0.55)
    }

    // MARK: - Transport

    /// Three balanced zones. Stop is a distinct utility on the leading edge and
    /// an equal-width trailing spacer keeps play/pause on the exact centre axis.
    private var transportRow: some View {
        HStack(spacing: 0) {
            transportButton(
                systemName: "stop.fill",
                label: "Stop",
                enabled: canStop,
                action: { engine.stop() }
            )
            .frame(width: 36)

            Spacer(minLength: 4)

            HStack(spacing: 14) {
                transportButton(
                    systemName: "backward.end.fill",
                    label: "Restart",
                    enabled: canRestart,
                    action: { engine.seek(to: 0) }
                )

                transportButton(
                    systemName: playPauseSymbol,
                    label: playPauseLabel,
                    enabled: canTogglePlayback,
                    prominent: true,
                    action: togglePlayback
                )

                transportButton(
                    systemName: "forward.end.fill",
                    label: "Skip",
                    enabled: canSkip,
                    action: skip
                )
            }

            Spacer(minLength: 4)

            // Balances the leading Stop slot so Play stays centred.
            Color.clear
                .frame(width: 36, height: 32)
                .accessibilityHidden(true)
        }
    }

    private func transportButton(
        systemName: String,
        label: String,
        enabled: Bool,
        prominent: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        let side: CGFloat = prominent ? 46 : 32
        let iconSize: CGFloat = prominent ? 17 : 12

        return Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundColor(
                    prominent
                        ? Color.black.opacity(enabled ? 0.88 : 0.45)
                        : (enabled ? theme.text.opacity(0.85) : theme.textTertiary)
                )
                .frame(width: side, height: side)
                .background(
                    Circle().fill(
                        prominent
                            ? (enabled ? accent : accent.opacity(0.35))
                            : (enabled ? theme.insetFill : theme.insetFillMuted)
                    )
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.75)
        .accessibilityLabel(label)
        .help(label)
    }

    // MARK: - Output controls

    /// Two rows instead of three, and no icon column for speed/autoplay — the
    /// point is to stay reachable without turning into a settings form.
    private var outputControls: some View {
        VStack(spacing: 12) {
            volumeRow
            speedAndAutoplayRow
        }
    }

    private var volumeRow: some View {
        HStack(spacing: 10) {
            Image(systemName: PopoverFormat.volumeSymbol(for: engine.volume))
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(theme.textSecondary)
                .frame(width: 15, alignment: .leading)
                .accessibilityHidden(true)

            PopoverScrubBar(
                value: Double(engine.volume),
                span: 1,
                enabled: true,
                // Neutral, not mint. Volume is a level, not an active state —
                // a full-width green bar was pulling focus off play/pause.
                accent: theme.text.opacity(0.45),
                trackHeight: 3,
                step: 0.05,
                accessibilityLabelText: "Volume",
                accessibilityValueText: "\(Int((engine.volume * 100).rounded())) percent",
                onScrub: { engine.setVolume(Float($0)) },
                onCommit: { engine.setVolume(Float($0)) }
            )

            Text(PopoverFormat.percent(engine.volume))
                .font(PopoverType.mono)
                .foregroundColor(theme.textSecondary)
                .frame(width: 34, alignment: .trailing)
                .accessibilityHidden(true)
        }
    }

    private var speedAndAutoplayRow: some View {
        HStack(spacing: 8) {
            Text(speedLane.map { "Speed · L\($0.number)" } ?? "Speed")
                .font(PopoverType.rowLabel)
                .foregroundColor(theme.textSecondary)

            speedMenu

            Spacer(minLength: 8)

            Text("Autoplay")
                .font(PopoverType.rowLabel)
                .foregroundColor(theme.textSecondary)

            Toggle("", isOn: autoplayBinding)
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.mini)
                .tint(accent)
                .accessibilityLabel("Autoplay next")
                .accessibilityValue(engine.autoplayEnabled ? "On" : "Off")
                .accessibilityHint("When on, play the next queued item automatically")
        }
    }

    private var speedMenu: some View {
        Picker("Playback speed", selection: speedBinding) {
            ForEach(speedOptions, id: \.self) { rate in
                Text(PopoverFormat.speed(rate)).tag(rate)
            }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .controlSize(.small)
        .environment(\.colorScheme, .dark)
        .tint(theme.text)
        .fixedSize()
        .disabled(speedLane == nil)
        .accessibilityValue(speedLane.map {
            "Lane \($0.number), \(PopoverFormat.speed($0.effectivePlaybackRate))"
        } ?? "No assigned lane")
        .help(speedLane.map { "Playback speed for Lane \($0.number)" } ?? "Assign a lane to set its speed")
    }

    // MARK: - Queue

    private var queueSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                PopoverSectionLabel(text: "Up next")

                Text("\(engine.queue.count)")
                    .font(PopoverType.mono)
                    .foregroundColor(engine.queue.isEmpty ? theme.textTertiary : theme.text)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(theme.insetFill))
                    .accessibilityLabel("\(engine.queue.count) items in queue")

                Spacer()

                if !engine.queue.isEmpty {
                    Button("Clear") { engine.clearQueue() }
                        .buttonStyle(.popoverText)
                        .accessibilityLabel("Clear queue")
                        .help("Clear queue")
                }
            }

            if engine.queue.isEmpty {
                Text(emptyQueueMessage)
                    .font(PopoverType.secondary)
                    .foregroundColor(theme.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 2)
                    .accessibilityLabel(emptyQueueMessage)
            } else {
                ScrollView {
                    LazyVStack(spacing: 3) {
                        ForEach(Array(engine.queue.enumerated()), id: \.element.id) { index, item in
                            queueRow(item, index: index)
                        }
                    }
                }
                .frame(maxHeight: 132)
            }
        }
        .padding(.horizontal, PopoverMetrics.gutter)
        .padding(.vertical, PopoverMetrics.zonePadding)
    }

    private func queueRow(_ item: PlaybackItem, index: Int) -> some View {
        HStack(spacing: 9) {
            Text("\(index + 1)")
                .font(PopoverType.mono)
                .foregroundColor(theme.textTertiary)
                .frame(width: 14, alignment: .trailing)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(PopoverType.secondaryStrong)
                    .foregroundColor(theme.text)
                    .lineLimit(1)

                if let provider = item.provider, !provider.isEmpty {
                    Text(provider.capitalized)
                        .font(PopoverType.caption)
                        .foregroundColor(theme.textTertiary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 4)

            Button {
                engine.removeQueueItem(id: item.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(theme.textTertiary)
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(item.title) from queue")
            .help("Remove from queue")
        }
        .padding(.leading, 6)
        .padding(.trailing, 2)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                .fill(theme.wellFill)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(queueItemAccessibilityLabel(item, index: index))
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 0) {
            Button(action: onOpenSettings) {
                Label("Settings", systemImage: "gearshape")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.popoverText)
            .accessibilityHint("Open SpeakEasy settings")

            Spacer()

            Button(action: onQuit) {
                Label("Quit", systemImage: "power")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.popoverTextTertiary)
            .accessibilityLabel("Quit SpeakEasy")
        }
        .padding(.horizontal, PopoverMetrics.gutter - 8)
        .padding(.vertical, 9)
    }

    // MARK: - Actions

    private func togglePlayback() {
        do {
            try engine.togglePlayback()
        } catch {
            // Engine records lastError / failed state for surfaceable failures.
        }
    }

    private func skip() {
        do {
            try engine.skip()
        } catch {
            // Engine records lastError / failed state for surfaceable failures.
        }
    }

    // MARK: - Bindings

    private var autoplayBinding: Binding<Bool> {
        Binding(
            get: { engine.autoplayEnabled },
            set: { engine.autoplayEnabled = $0 }
        )
    }

    // MARK: - Derived state

    private var canScrub: Bool {
        engine.currentItem != nil && engine.duration > 0
    }

    private var canTogglePlayback: Bool {
        switch engine.state {
        case .playing, .paused, .loading:
            return true
        case .idle, .failed:
            return !engine.queue.isEmpty || engine.currentItem != nil
        }
    }

    private var canStop: Bool {
        engine.currentItem != nil || engine.state == .playing || engine.state == .paused || engine.state == .loading
    }

    private var canRestart: Bool {
        engine.currentItem != nil && engine.duration > 0
    }

    private var canSkip: Bool {
        engine.currentItem != nil || !engine.queue.isEmpty
    }

    private var playPauseSymbol: String {
        engine.state == .playing ? "pause.fill" : "play.fill"
    }

    private var playPauseLabel: String {
        engine.state == .playing ? "Pause" : "Play"
    }

    private var displayedTime: TimeInterval {
        isScrubbing ? scrubTime : engine.currentTime
    }

    private var activeLane: VoiceLane? {
        listening.activeLaneNumber.flatMap(listening.lane(_:))
    }

    /// Playback speed belongs to a lane, but changing it should not require the
    /// microphone session to be active. Prefer the selected lane, then the lane
    /// for the locked task, and finally the first assigned lane.
    private var speedLane: VoiceLane? {
        if let activeLane { return activeLane }
        if let lockedTask = listening.lockedTask,
           let matchingLane = listening.lanes.first(where: { $0.task.id == lockedTask.id }) {
            return matchingLane
        }
        return listening.lanes.first
    }

    private var speedBinding: Binding<Float> {
        Binding(
            get: { speedLane?.effectivePlaybackRate ?? 1 },
            set: { rate in
                guard let laneNumber = speedLane?.number else { return }
                listening.setPlaybackRate(rate, forLane: laneNumber)
            }
        )
    }

    private var stateLabel: String {
        switch engine.state {
        case .idle: return "Idle"
        case .loading: return "Loading"
        case .playing: return "Playing"
        case .paused: return "Paused"
        case .failed: return "Failed"
        }
    }

    private var stateColor: Color {
        switch engine.state {
        case .idle: return theme.textTertiary
        case .loading: return .orange
        case .playing: return SpeakEasyAccent.mint
        case .paused: return theme.textSecondary
        case .failed: return .orange
        }
    }

    private var stateAccessibilityLabel: String {
        stateLabel.lowercased()
    }

    // MARK: - Now-playing copy

    private var primaryTitle: String {
        if let item = engine.currentItem {
            return item.title
        }
        if !engine.queue.isEmpty {
            return "Ready to play"
        }
        switch engine.state {
        case .failed: return "Playback failed"
        case .loading: return "Loading…"
        default: return "Nothing playing"
        }
    }

    private var primarySubtitle: String {
        if let item = engine.currentItem {
            if let provider = item.provider, !provider.isEmpty {
                return provider.capitalized
            }
            if let text = item.text, !text.isEmpty {
                return text
            }
            return "Speech"
        }
        if !engine.queue.isEmpty {
            let count = engine.queue.count
            return count == 1
                ? "1 item waiting — press play to start"
                : "\(count) items waiting — press play to start"
        }
        switch engine.state {
        // The raw engine error is carried by the callout below the controls, so
        // the subtitle stays a short, un-truncated summary.
        case .failed: return "Try enqueueing audio again"
        default: return "Enqueue speech from the CLI or skills"
        }
    }

    private var artworkSymbol: String {
        if engine.currentItem != nil {
            return engine.state == .playing ? "waveform" : "doc.text.fill"
        }
        if !engine.queue.isEmpty { return "play.fill" }
        if engine.state == .failed { return "exclamationmark.triangle" }
        return "text.bubble"
    }

    private var nowPlayingAccessibilityLabel: String {
        engine.currentItem == nil
            ? "\(primaryTitle). \(primarySubtitle)"
            : "Now playing: \(primaryTitle), \(primarySubtitle)"
    }

    private var emptyQueueMessage: String {
        engine.currentItem != nil ? "No more items after this one" : "Queue is empty"
    }

    private var timeAccessibilityValue: String {
        "\(PopoverFormat.spokenTime(displayedTime)) of \(PopoverFormat.spokenTime(engine.duration))"
    }

    private func queueItemAccessibilityLabel(_ item: PlaybackItem, index: Int) -> String {
        var parts = ["Queue item \(index + 1): \(item.title)"]
        if let provider = item.provider, !provider.isEmpty {
            parts.append("provider \(provider)")
        }
        return parts.joined(separator: ", ")
    }
}

#if DEBUG
struct PlayerPopoverView_Previews: PreviewProvider {
    static var previews: some View {
        PlayerPopoverView()
            .environment(\.theme, .dark)
    }
}
#endif
