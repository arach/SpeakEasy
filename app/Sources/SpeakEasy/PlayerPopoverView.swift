import SwiftUI

/// Compact menu-bar player popover. Observes `PlaybackEngine.shared` and only
/// surfaces transport actions that the engine already implements.
struct PlayerPopoverView: View {
    @ObservedObject private var engine = PlaybackEngine.shared
    @Environment(\.theme) private var theme

    let onOpenSettings: () -> Void
    let onQuit: () -> Void

    @State private var isScrubbing = false
    @State private var scrubTime: TimeInterval = 0

    private let popoverWidth: CGFloat = 320
    private let outerInset: CGFloat = 14
    private let trailingControlWidth: CGFloat = 64
    private let speedOptions: [Float] = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]

    /// Controller accent from the generated SpeakEasy concept (mint).
    private var accent: Color {
        Color(red: 0.36, green: 0.87, blue: 0.66)
    }

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
            nowPlayingSection
            scrubberSection
            transportSection
            controlsSection
            queueSection
            footer
        }
        .frame(width: popoverWidth)
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
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(theme.text)

            Spacer()

            stateBadge
        }
        .padding(.horizontal, outerInset)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("SpeakEasy player, \(stateAccessibilityLabel)")
    }

    private var stateBadge: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(stateColor)
                .frame(width: 6, height: 6)
                .accessibilityHidden(true)

            Text(stateLabel)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(stateColor)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(stateColor.opacity(0.14))
        )
        .accessibilityLabel("Playback state: \(stateLabel)")
    }

    // MARK: - Now Playing

    private var nowPlayingSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let item = engine.currentItem {
                activeNowPlaying(item)
            } else {
                idleNowPlaying
            }

            if let error = engine.lastError, engine.state == .failed {
                errorBanner(error)
            }
        }
        .padding(.horizontal, outerInset)
        .padding(.bottom, 10)
    }

    private func activeNowPlaying(_ item: PlaybackItem) -> some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(theme.text.opacity(0.06))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(theme.text.opacity(0.10), lineWidth: 0.5)
                    )
                    .frame(width: 44, height: 44)
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(theme.textTertiary)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(theme.text)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityLabel("Now playing: \(item.title)")

                if let provider = item.provider, !provider.isEmpty {
                    Text(provider.capitalized)
                        .font(.system(size: 12))
                        .foregroundColor(theme.textSecondary)
                        .lineLimit(1)
                        .accessibilityLabel("Provider: \(provider)")
                } else if let text = item.text, !text.isEmpty {
                    Text(text)
                        .font(.system(size: 12))
                        .foregroundColor(theme.textTertiary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .accessibilityLabel("Spoken text: \(text)")
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(theme.text.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(theme.text.opacity(0.10), lineWidth: 0.5)
                )
        )
    }

    private var idleNowPlaying: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(theme.text.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(theme.text.opacity(0.08), lineWidth: 0.5)
                    )
                    .frame(width: 44, height: 44)
                Image(systemName: idleIcon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(theme.textTertiary)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(idleTitle)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(theme.textSecondary)
                Text(idleSubtitle)
                    .font(.system(size: 11))
                    .foregroundColor(theme.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(theme.text.opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(theme.text.opacity(0.08), lineWidth: 0.5)
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(idleTitle). \(idleSubtitle)")
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 11))
                .foregroundColor(.orange)
            Text(message)
                .font(.system(size: 11))
                .foregroundColor(theme.textSecondary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.orange.opacity(0.12))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.orange.opacity(0.25), lineWidth: 0.5)
                )
        )
        .accessibilityLabel("Playback error: \(message)")
    }

    // MARK: - Scrubber

    private var scrubberSection: some View {
        VStack(spacing: 4) {
            Slider(
                value: scrubBinding,
                in: 0...max(engine.duration, 0.001),
                onEditingChanged: handleScrubEditing
            )
            .disabled(!canScrub)
            .controlSize(.small)
            .tint(accent)
            .accessibilityLabel("Playback position")
            .accessibilityValue(timeAccessibilityValue)
            .accessibilityHint(canScrub ? "Drag to seek" : "Seek unavailable")

            HStack {
                Text(formatTime(displayedTime))
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(theme.textTertiary)
                    .accessibilityLabel("Elapsed \(formatTimeSpoken(displayedTime))")

                Spacer()

                Text(formatTime(engine.duration))
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(theme.textTertiary)
                    .accessibilityLabel("Duration \(formatTimeSpoken(engine.duration))")
            }
        }
        .padding(.horizontal, outerInset)
        .padding(.bottom, 6)
        .opacity(canScrub || engine.currentItem != nil ? 1 : 0.5)
    }

    // MARK: - Transport

    private var transportSection: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)

            HStack(spacing: 10) {
                transportButton(
                    systemName: "stop.fill",
                    label: "Stop",
                    enabled: canStop,
                    action: { engine.stop() }
                )
                .frame(width: 44)

                transportButton(
                    systemName: "backward.end.fill",
                    label: "Restart",
                    enabled: canRestart,
                    action: { engine.seek(to: 0) }
                )
                .frame(width: 44)

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
                .frame(width: 44)

                // Balance the second leading action so Play stays on the center axis.
                Color.clear
                    .frame(width: 44, height: 34)
                    .accessibilityHidden(true)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, outerInset)
        .padding(.top, 4)
        .padding(.bottom, 12)
    }

    private func transportButton(
        systemName: String,
        label: String,
        enabled: Bool,
        prominent: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        let side: CGFloat = prominent ? 52 : 34
        let iconSize: CGFloat = prominent ? 18 : 12
        let iconColor: Color = {
            if prominent {
                return enabled ? Color.black.opacity(0.85) : Color.black.opacity(0.45)
            }
            return enabled ? theme.text.opacity(0.9) : theme.textTertiary
        }()
        let fillColor: Color = {
            if prominent {
                return enabled ? accent : accent.opacity(0.45)
            }
            return enabled ? theme.text.opacity(0.10) : theme.text.opacity(0.04)
        }()
        let strokeColor: Color = {
            if prominent { return Color.clear }
            return enabled ? theme.text.opacity(0.16) : theme.text.opacity(0.08)
        }()

        return Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundColor(iconColor)
                .frame(width: side, height: side)
                .contentShape(Circle())
                .background(
                    Circle()
                        .fill(fillColor)
                        .overlay(
                            Circle()
                                .stroke(strokeColor, lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled || prominent ? 1 : 0.55)
        .accessibilityLabel(label)
        .help(label)
    }

    // MARK: - Controls (volume / speed / autoplay)

    private var controlsSection: some View {
        VStack(spacing: 10) {
            volumeRow
            speedRow
            autoplayRow
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(theme.text.opacity(0.045))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(theme.text.opacity(0.08), lineWidth: 0.5)
                )
        )
        .padding(.horizontal, outerInset)
        .padding(.bottom, 10)
    }

    private var volumeRow: some View {
        HStack(spacing: 10) {
            Image(systemName: volumeIcon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(theme.textSecondary)
                .frame(width: 16)
                .accessibilityHidden(true)

            Slider(
                value: volumeBinding,
                in: 0...1
            )
            .controlSize(.small)
            .tint(accent)
            .accessibilityLabel("Volume")
            .accessibilityValue("\(Int((engine.volume * 100).rounded())) percent")

            Text("\(Int((engine.volume * 100).rounded()))%")
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundColor(theme.textSecondary)
                .frame(width: trailingControlWidth, alignment: .trailing)
                .accessibilityHidden(true)
        }
    }

    private var speedRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "gauge")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(theme.textSecondary)
                .frame(width: 16)
                .accessibilityHidden(true)

            Text("Playback speed")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(theme.textSecondary)

            Spacer()

            Menu {
                ForEach(speedOptions, id: \.self) { rate in
                    Button {
                        engine.setPlaybackRate(rate)
                    } label: {
                        if abs(rate - engine.playbackRate) < 0.001 {
                            Label(speedLabel(rate), systemImage: "checkmark")
                        } else {
                            Text(speedLabel(rate))
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(speedLabel(engine.playbackRate))
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 8, weight: .semibold))
                }
                // Plain style + theme primary: borderless Menu otherwise draws black NSButton text.
                .foregroundStyle(theme.text.opacity(0.88))
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(theme.text.opacity(0.08))
                )
                .contentShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .menuStyle(.borderlessButton)
            .buttonStyle(.plain)
            .tint(theme.text.opacity(0.88))
            .frame(width: trailingControlWidth, alignment: .trailing)
            .accessibilityLabel("Playback speed")
            .accessibilityValue(speedLabel(engine.playbackRate))
        }
    }

    private var autoplayRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(theme.textSecondary)
                .frame(width: 16)
                .accessibilityHidden(true)

            Text("Autoplay next")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(theme.textSecondary)

            Spacer()

            Toggle("", isOn: autoplayBinding)
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
                .tint(accent)
                .frame(width: trailingControlWidth, alignment: .trailing)
                .accessibilityLabel("Autoplay next")
                .accessibilityValue(engine.autoplayEnabled ? "On" : "Off")
                .accessibilityHint("When on, play the next queued item automatically")
        }
    }

    // MARK: - Queue

    private var queueSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Up Next")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(theme.textSecondary)
                    .textCase(.uppercase)
                    .tracking(0.4)

                Text("\(engine.queue.count)")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(theme.textTertiary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Capsule().fill(theme.surface))
                    .accessibilityLabel("\(engine.queue.count) items in queue")

                Spacer()

                if !engine.queue.isEmpty {
                    Button("Clear") {
                        engine.clearQueue()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(theme.textSecondary)
                    .accessibilityLabel("Clear queue")
                    .help("Clear queue")
                }
            }

            if engine.queue.isEmpty {
                Text(emptyQueueMessage)
                    .font(.system(size: 11))
                    .foregroundColor(theme.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
                    .accessibilityLabel(emptyQueueMessage)
            } else {
                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(Array(engine.queue.enumerated()), id: \.element.id) { index, item in
                            queueRow(item, index: index)
                        }
                    }
                }
                .frame(maxHeight: 140)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(theme.text.opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(theme.text.opacity(0.08), lineWidth: 0.5)
                )
        )
        .padding(.horizontal, outerInset)
        .padding(.bottom, 10)
    }

    private func queueRow(_ item: PlaybackItem, index: Int) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "list.bullet.rectangle")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(theme.textTertiary)
                .frame(width: 16)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(theme.text)
                    .lineLimit(1)

                if let provider = item.provider, !provider.isEmpty {
                    Text(provider.capitalized)
                        .font(.system(size: 10))
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
                    .frame(width: 20, height: 20)
                    .background(Circle().fill(theme.surface))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(item.title) from queue")
            .help("Remove from queue")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(theme.surface.opacity(0.7))
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(queueItemAccessibilityLabel(item, index: index))
    }

    private var footer: some View {
        HStack {
            Button(action: onOpenSettings) {
                Label("Settings", systemImage: "gearshape")
            }
            .buttonStyle(.plain)
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(theme.textSecondary)
            .accessibilityHint("Open SpeakEasy settings")

            Spacer()

            Button(action: onQuit) {
                Label("Quit", systemImage: "power")
            }
            .buttonStyle(.plain)
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(theme.textTertiary)
            .accessibilityLabel("Quit SpeakEasy")
        }
        .padding(.horizontal, outerInset)
        .padding(.top, 4)
        .padding(.bottom, 14)
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

    private func handleScrubEditing(_ editing: Bool) {
        if editing {
            isScrubbing = true
            scrubTime = engine.currentTime
        } else {
            engine.seek(to: scrubTime)
            isScrubbing = false
        }
    }

    // MARK: - Bindings

    private var scrubBinding: Binding<Double> {
        Binding(
            get: { isScrubbing ? scrubTime : engine.currentTime },
            set: { scrubTime = $0 }
        )
    }

    private var volumeBinding: Binding<Double> {
        Binding(
            get: { Double(engine.volume) },
            set: { engine.setVolume(Float($0)) }
        )
    }

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

    private var volumeIcon: String {
        if engine.volume <= 0.001 {
            return "speaker.slash.fill"
        }
        if engine.volume < 0.34 {
            return "speaker.wave.1.fill"
        }
        if engine.volume < 0.67 {
            return "speaker.wave.2.fill"
        }
        return "speaker.wave.3.fill"
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
        case .playing: return accent
        case .paused: return theme.textSecondary
        case .failed: return .orange
        }
    }

    private var stateAccessibilityLabel: String {
        stateLabel.lowercased()
    }

    private var idleTitle: String {
        if !engine.queue.isEmpty {
            return "Ready to play"
        }
        switch engine.state {
        case .failed:
            return "Playback failed"
        case .loading:
            return "Loading…"
        default:
            return "Nothing playing"
        }
    }

    private var idleSubtitle: String {
        if !engine.queue.isEmpty {
            let count = engine.queue.count
            return count == 1
                ? "1 item waiting — press Play to start"
                : "\(count) items waiting — press Play to start"
        }
        switch engine.state {
        case .failed:
            return engine.lastError ?? "Try enqueueing audio again"
        default:
            return "Enqueue speech from the CLI or skills"
        }
    }

    private var idleIcon: String {
        if !engine.queue.isEmpty {
            return "play.circle"
        }
        if engine.state == .failed {
            return "exclamationmark.triangle"
        }
        return "text.bubble"
    }

    private var emptyQueueMessage: String {
        if engine.currentItem != nil {
            return "No more items after this one"
        }
        return "Queue is empty"
    }

    private var timeAccessibilityValue: String {
        "\(formatTimeSpoken(displayedTime)) of \(formatTimeSpoken(engine.duration))"
    }

    // MARK: - Formatting

    private func formatTime(_ time: TimeInterval) -> String {
        guard time.isFinite, time >= 0 else { return "0:00" }
        let total = Int(time.rounded(.down))
        let minutes = total / 60
        let seconds = total % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    private func formatTimeSpoken(_ time: TimeInterval) -> String {
        guard time.isFinite, time >= 0 else { return "0 seconds" }
        let total = Int(time.rounded(.down))
        let minutes = total / 60
        let seconds = total % 60
        if minutes == 0 {
            return "\(seconds) seconds"
        }
        return "\(minutes) minutes \(seconds) seconds"
    }

    private func speedLabel(_ rate: Float) -> String {
        if abs(rate - rate.rounded()) < 0.001 {
            return String(format: "%.0f×", rate)
        }
        return String(format: "%.2g×", rate)
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
