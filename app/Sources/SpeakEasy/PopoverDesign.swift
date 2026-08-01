import SwiftUI

// MARK: - Accent

enum SpeakEasyAccent {
    /// Mint controller accent from the generated SpeakEasy concept.
    /// Reserved for active / selected / ready / progress states.
    static let mint = Color(red: 0.36, green: 0.87, blue: 0.66)
}

// MARK: - Metrics

/// One place for the menu-bar pop-up's spatial rhythm. The pop-up is a compact
/// native surface, so the ramp is deliberately short.
enum PopoverMetrics {
    static let width: CGFloat = 320
    /// Outer horizontal inset for every zone.
    static let gutter: CGFloat = 14
    /// Inner padding for the raised playback well.
    static let wellPadding: CGFloat = 12
    static let wellRadius: CGFloat = 14
    static let controlRadius: CGFloat = 8
    static let chipRadius: CGFloat = 6
    /// Vertical breathing room between rows inside a zone.
    static let rowGap: CGFloat = 10
    /// Vertical padding applied to a flat (non-well) zone.
    static let zonePadding: CGFloat = 12
}

// MARK: - Type ramp

/// Five sizes, floor of 10pt. The previous surface used ten sizes down to 7pt,
/// which is below what reads comfortably in a menu-bar pop-up.
enum PopoverType {
    static let title = Font.system(size: 13, weight: .semibold)
    static let itemTitle = Font.system(size: 13, weight: .semibold)
    static let strong = Font.system(size: 12, weight: .semibold)
    static let body = Font.system(size: 12)
    static let rowLabel = Font.system(size: 12, weight: .medium)
    static let secondary = Font.system(size: 11)
    static let secondaryStrong = Font.system(size: 11, weight: .medium)
    static let caption = Font.system(size: 10, weight: .medium)
    static let sectionLabel = Font.system(size: 10, weight: .semibold)
    static let mono = Font.system(size: 10, weight: .medium, design: .monospaced)
}

// MARK: - Tonal surfaces

/// Grouping comes from tone + spacing, not from repeated outlines. Only the
/// playback well is raised; everything else sits flat on the pop-up background
/// and is separated by hairlines.
extension Theme {
    /// Raised surface for the playback zone.
    var wellFill: Color { text.opacity(0.05) }
    /// Controls sitting inside a zone (chips, secondary transport, fields).
    var insetFill: Color { text.opacity(0.085) }
    var insetFillHover: Color { text.opacity(0.13) }
    /// Disabled / recessed control fill.
    var insetFillMuted: Color { text.opacity(0.04) }
    /// Slider and progress track.
    var trackFill: Color { text.opacity(0.14) }
    /// The single divider tone used across the pop-up.
    var hairline: Color { text.opacity(0.07) }
}

// MARK: - Divider

struct PopoverHairline: View {
    @Environment(\.theme) private var theme

    var inset: CGFloat = 0

    var body: some View {
        Rectangle()
            .fill(theme.hairline)
            .frame(height: 1)
            .padding(.horizontal, inset)
            .accessibilityHidden(true)
    }
}

// MARK: - Callout

/// Compact recovery instruction. A leading rule plus tinted text keeps the
/// message parseable without out-shouting playback the way a filled banner did.
struct PopoverCallout: View {
    @Environment(\.theme) private var theme

    let message: String
    var tone: Color = .orange
    var symbol: String = "exclamationmark.triangle.fill"
    var accessibilityPrefix: String?

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Rectangle()
                .fill(tone.opacity(0.75))
                .frame(width: 2)
                .clipShape(Capsule())
                .accessibilityHidden(true)

            Image(systemName: symbol)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(tone)
                .padding(.top, 1)
                .accessibilityHidden(true)

            Text(message)
                .font(PopoverType.secondary)
                .foregroundColor(theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityPrefix.map { "\($0): \(message)" } ?? message)
    }
}

// MARK: - Section label

struct PopoverSectionLabel: View {
    @Environment(\.theme) private var theme

    let text: String

    var body: some View {
        Text(text)
            .font(PopoverType.sectionLabel)
            .foregroundColor(theme.textSecondary)
            .textCase(.uppercase)
            .tracking(0.6)
    }
}

// MARK: - Buttons

/// Neutral raised control. Deliberately not tinted — green is reserved for
/// state, so actions read as chrome and the play button stays the only focal
/// fill in the pop-up.
struct PopoverActionButtonStyle: ButtonStyle {
    @Environment(\.theme) private var theme
    @Environment(\.isEnabled) private var isEnabled

    var prominent = false
    var fullWidth = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PopoverType.secondaryStrong)
            .foregroundColor(isEnabled ? theme.text.opacity(prominent ? 0.95 : 0.85) : theme.textTertiary)
            .padding(.horizontal, 12)
            .frame(height: 28)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous)
                    .fill(fill(pressed: configuration.isPressed))
            )
            .contentShape(RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous))
            .opacity(isEnabled ? 1 : 0.6)
    }

    private func fill(pressed: Bool) -> Color {
        guard isEnabled else { return theme.insetFillMuted }
        if pressed { return theme.insetFillHover }
        return prominent ? theme.text.opacity(0.12) : theme.insetFill
    }
}

/// Low-emphasis text action (Refresh, Unlock, Clear, Settings, Quit).
struct PopoverTextButtonStyle: ButtonStyle {
    @Environment(\.theme) private var theme
    @Environment(\.isEnabled) private var isEnabled

    var emphasis: Emphasis = .secondary

    enum Emphasis {
        case secondary
        case tertiary
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PopoverType.secondaryStrong)
            .foregroundColor(color(pressed: configuration.isPressed))
            .padding(.horizontal, 8)
            .frame(height: 26)
            .background(
                RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                    .fill(configuration.isPressed ? theme.insetFill : Color.clear)
            )
            .contentShape(RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous))
            .opacity(isEnabled ? 1 : 0.5)
    }

    private func color(pressed: Bool) -> Color {
        guard isEnabled else { return theme.textTertiary }
        if pressed { return theme.text }
        return emphasis == .secondary ? theme.textSecondary : theme.textTertiary
    }
}

extension ButtonStyle where Self == PopoverActionButtonStyle {
    static var popoverAction: PopoverActionButtonStyle { PopoverActionButtonStyle() }
    static var popoverActionProminent: PopoverActionButtonStyle {
        PopoverActionButtonStyle(prominent: true, fullWidth: true)
    }
}

extension ButtonStyle where Self == PopoverTextButtonStyle {
    static var popoverText: PopoverTextButtonStyle { PopoverTextButtonStyle() }
    static var popoverTextTertiary: PopoverTextButtonStyle {
        PopoverTextButtonStyle(emphasis: .tertiary)
    }
}

// MARK: - Menu chip

/// A menu that actually looks like the rest of the pop-up.
///
/// `.menuStyle(.borderlessButton)` hoists its own leading indicator and discards
/// the custom label's layout — `.menuIndicator(.hidden)` does not suppress it —
/// so the chip is drawn independently and the menu is laid over it purely for
/// hit-testing. The menu keeps the accessibility identity; the chip is decor.
struct PopoverMenuChip<Content: View>: View {
    @Environment(\.theme) private var theme
    @Environment(\.isEnabled) private var isEnabled

    let title: String
    var isPlaceholder = false
    var fullWidth = false
    var height: CGFloat = 22
    var fill: Color?
    var titleColor: Color?
    let accessibilityLabelText: String
    var accessibilityValueText: String?
    var helpText: String?
    @ViewBuilder let menuContent: Content

    var body: some View {
        ZStack {
            HStack(spacing: 6) {
                Text(title)
                    .font(PopoverType.secondaryStrong)
                    .foregroundColor(resolvedTitleColor)
                    .lineLimit(1)
                    .truncationMode(.tail)

                if fullWidth {
                    Spacer(minLength: 4)
                }

                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(theme.textTertiary)
            }
            .padding(.horizontal, 9)
            .frame(height: height)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                    .fill(fill ?? theme.insetFill)
            )
            .opacity(isEnabled ? 1 : 0.5)
            .accessibilityHidden(true)

            Menu {
                menuContent
            } label: {
                Color.clear.contentShape(Rectangle())
            }
            .menuStyle(.borderlessButton)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Not `.opacity(0)`: a fully transparent view stops hit-testing.
            .opacity(0.011)
            .accessibilityLabel(accessibilityLabelText)
            .accessibilityValue(accessibilityValueText ?? title)
        }
        .frame(height: height)
        .frame(maxWidth: fullWidth ? .infinity : nil)
        .fixedSize(horizontal: !fullWidth, vertical: false)
        .help(helpText ?? accessibilityLabelText)
    }

    private var resolvedTitleColor: Color {
        if let titleColor { return titleColor }
        return isPlaceholder ? theme.textTertiary : theme.text.opacity(0.9)
    }
}

// MARK: - Scrub / level bar

/// Slim track used for both playback position and volume.
///
/// Replaces two differently-sized native `Slider`s whose oversized knobs read as
/// unfinished chrome against the dark surface. Keyboard seeking (arrow keys once
/// focused) and a VoiceOver adjustable action are both wired up, so this is a
/// net gain over the stock control it replaces.
struct PopoverScrubBar: View {
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    let value: Double
    /// Always positive; the bar maps `0...span`.
    let span: Double
    let enabled: Bool
    var accent: Color = SpeakEasyAccent.mint
    var trackHeight: CGFloat = 4
    /// Keyboard / VoiceOver increment in the value's own units.
    var step: Double = 5

    let accessibilityLabelText: String
    let accessibilityValueText: String

    /// Continuous updates while dragging.
    let onScrub: (Double) -> Void
    /// Fired when the interaction ends (or on a keyboard/VoiceOver step).
    let onCommit: (Double) -> Void

    private var fraction: Double {
        guard span > 0, value.isFinite else { return 0 }
        return min(max(value / span, 0), 1)
    }

    private var knobDiameter: CGFloat { trackHeight * 2.75 }

    private var showsKnob: Bool { enabled && (isHovering || isFocused || fraction > 0) }

    var body: some View {
        GeometryReader { proxy in
            let width = max(proxy.size.width, 1)
            let filled = width * fraction

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(theme.trackFill)
                    .frame(height: trackHeight)

                Capsule()
                    .fill(enabled ? accent : theme.text.opacity(0.22))
                    .frame(width: filled, height: trackHeight)

                if showsKnob {
                    Circle()
                        .fill(Color.white)
                        .frame(width: knobDiameter, height: knobDiameter)
                        .shadow(color: .black.opacity(0.35), radius: 1.5, y: 0.5)
                        .offset(x: min(max(filled - knobDiameter / 2, 0), width - knobDiameter))
                        .transition(.opacity)
                }
            }
            .frame(height: max(knobDiameter, trackHeight))
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: showsKnob)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { gesture in
                        guard enabled else { return }
                        onScrub(position(for: gesture.location.x, width: width))
                    }
                    .onEnded { gesture in
                        guard enabled else { return }
                        onCommit(position(for: gesture.location.x, width: width))
                    }
            )
        }
        .frame(height: max(knobDiameter, trackHeight))
        .onHover { isHovering = $0 }
        .focusable(enabled)
        .focusEffectDisabled()
        .focused($isFocused)
        .overlay(
            Capsule()
                .stroke(accent.opacity(isFocused ? 0.9 : 0), lineWidth: 1.5)
                .padding(.vertical, -2)
                .padding(.horizontal, -3)
                .accessibilityHidden(true)
        )
        .onKeyPress(.leftArrow) { nudge(-step) }
        .onKeyPress(.rightArrow) { nudge(step) }
        .onKeyPress(.downArrow) { nudge(-step) }
        .onKeyPress(.upArrow) { nudge(step) }
        .accessibilityElement()
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityValue(accessibilityValueText)
        .accessibilityHint(enabled ? "Use the arrow keys to adjust" : "Unavailable")
        .accessibilityAddTraits(.isButton)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: _ = nudge(step)
            case .decrement: _ = nudge(-step)
            @unknown default: break
            }
        }
    }

    private func position(for x: CGFloat, width: CGFloat) -> Double {
        let clamped = min(max(Double(x / width), 0), 1)
        return clamped * span
    }

    @discardableResult
    private func nudge(_ delta: Double) -> KeyPress.Result {
        guard enabled else { return .ignored }
        onCommit(min(max(value + delta, 0), span))
        return .handled
    }
}

// MARK: - Formatting

/// Pure helpers, split out so they can be exercised without instantiating the view.
enum PopoverFormat {
    static func time(_ time: TimeInterval) -> String {
        guard time.isFinite, time >= 0 else { return "0:00" }
        let total = Int(time.rounded(.down))
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    static func spokenTime(_ time: TimeInterval) -> String {
        guard time.isFinite, time >= 0 else { return "0 seconds" }
        let total = Int(time.rounded(.down))
        let minutes = total / 60
        let seconds = total % 60
        if minutes == 0 {
            return "\(seconds) seconds"
        }
        return "\(minutes) minutes \(seconds) seconds"
    }

    static func speed(_ rate: Float) -> String {
        if abs(rate - rate.rounded()) < 0.001 {
            return String(format: "%.0f×", rate)
        }
        return String(format: "%.2g×", rate)
    }

    static func percent(_ value: Float) -> String {
        "\(Int((value * 100).rounded()))%"
    }

    static func volumeSymbol(for volume: Float) -> String {
        if volume <= 0.001 { return "speaker.slash.fill" }
        if volume < 0.34 { return "speaker.wave.1.fill" }
        if volume < 0.67 { return "speaker.wave.2.fill" }
        return "speaker.wave.3.fill"
    }
}
