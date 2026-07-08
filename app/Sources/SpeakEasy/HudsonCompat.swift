import SwiftUI
import HudsonUI
import HudsonShell

// MARK: - Theme (HudsonKit token shim)

/// Bridges legacy `theme.*` references to HudsonKit palette tokens.
struct Theme {
    var background: Color { HudPalette.bg }
    var surface: Color { HudPalette.surface }
    var surfaceHover: Color { HudSurface.hover }
    var border: Color { HudPalette.border }
    var text: Color { HudPalette.ink }
    var textSecondary: Color { HudPalette.muted }
    var textTertiary: Color { HudPalette.dim }

    static let dark = Theme()
    static let light = Theme()
}

struct ThemeKey: EnvironmentKey {
    static let defaultValue: Theme = .dark
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

// MARK: - Surface helpers

enum GlassIntensity {
    case subtle, regular, prominent
}

extension View {
    @ViewBuilder
    func glassBackground(cornerRadius: CGFloat = 12, intensity: GlassIntensity = .regular) -> some View {
        self.background(
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(HudPalette.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(HudPalette.border, lineWidth: 0.5)
                )
        )
    }

    @ViewBuilder
    func glassCapsule(intensity: GlassIntensity = .regular) -> some View {
        self.background(
            Capsule()
                .fill(HudPalette.surface)
                .overlay(
                    Capsule()
                        .stroke(HudPalette.border, lineWidth: 0.5)
                )
        )
    }

    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Button styles

struct FlatButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(HudFont.ui(13, weight: .medium))
            .foregroundStyle(HudPalette.muted)
            .padding(.horizontal, HudSpacing.lg)
            .padding(.vertical, HudSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(HudPalette.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: HudRadius.standard)
                            .stroke(HudPalette.border, lineWidth: 0.5)
                    )
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct FlatProminentButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(HudFont.ui(13, weight: .semibold))
            .foregroundStyle(HudPalette.ink)
            .padding(.horizontal, HudSpacing.xl)
            .padding(.vertical, HudSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: HudRadius.standard)
                    .fill(HudSurface.hover)
                    .overlay(
                        RoundedRectangle(cornerRadius: HudRadius.standard)
                            .stroke(HudPalette.border, lineWidth: 0.5)
                    )
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == FlatButtonStyle {
    static var flat: FlatButtonStyle { FlatButtonStyle() }
    static var glassCompat: FlatButtonStyle { FlatButtonStyle() }
}

extension ButtonStyle where Self == FlatProminentButtonStyle {
    static var flatProminent: FlatProminentButtonStyle { FlatProminentButtonStyle() }
    static var glassProminentCompat: FlatProminentButtonStyle { FlatProminentButtonStyle() }
}

// MARK: - Section card

struct GlassSection<Content: View>: View {
    let title: String
    let icon: String
    let color: Color
    @ViewBuilder let content: Content

    var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.md) {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(color)
                    HudSectionLabel(title)
                }
                content
            }
        }
    }
}