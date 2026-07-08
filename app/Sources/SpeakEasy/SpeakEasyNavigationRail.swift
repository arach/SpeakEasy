import SwiftUI
import HudsonUI
import HudsonShell

/// SpeakEasy navigation rail with brand mark in the sidebar header.
struct SpeakEasyNavigationRail<Footer: View>: View {
    @Binding var selection: String
    let items: [HudRailItem]
    @Binding var isExpanded: Bool
    let footer: Footer

    @Environment(\.hudTheme) private var theme
    @Environment(\.hudsonAppManifest) private var manifest
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        selection: Binding<String>,
        items: [HudRailItem],
        isExpanded: Binding<Bool>,
        @ViewBuilder footer: () -> Footer
    ) {
        self._selection = selection
        self.items = items
        self._isExpanded = isExpanded
        self.footer = footer()
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            HudDivider(color: theme.hairline.standard)

            if isExpanded {
                ScrollView {
                    VStack(spacing: HudSpacing.xs) {
                        ForEach(items) { item in
                            SpeakEasyRailLabelButton(
                                item: item,
                                isSelected: selection == item.id,
                                accent: manifest.accent
                            ) {
                                selection = item.id
                            }
                        }
                    }
                    .padding(.horizontal, HudSpacing.md)
                    .padding(.vertical, HudSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
                .scrollContentBackground(.hidden)
            } else {
                VStack(spacing: HudSpacing.xs) {
                    ForEach(items) { item in
                        SpeakEasyRailIconButton(
                            item: item,
                            isSelected: selection == item.id,
                            accent: manifest.accent
                        ) {
                            selection = item.id
                        }
                    }
                }
                .padding(.horizontal, HudSpacing.sm)
                .padding(.vertical, HudSpacing.md)

                Spacer(minLength: 0)
            }

            if isExpanded && Footer.self != EmptyView.self {
                HudDivider(color: theme.hairline.subtle)
                footer
                    .padding(HudSpacing.xl)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(width: isExpanded ? 220 : 64)
        .frame(maxHeight: .infinity)
        .background(theme.palette.chrome)
    }

    private var header: some View {
        Group {
            if isExpanded {
                HStack(spacing: HudSpacing.md) {
                    brandToggleButton
                    Text(manifest.name)
                        .font(HudFont.ui(HudTextSize.sm, weight: .semibold))
                        .foregroundStyle(theme.palette.ink)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, HudSpacing.lg)
            } else {
                brandToggleButton
                    .frame(maxWidth: .infinity, alignment: .center)
                    .frame(height: HudIconSize.xLarge)
            }
        }
        .frame(height: HudSidebarLayout.headerHeight)
        .padding(.bottom, HudSidebarLayout.headerBottomPadding)
        .frame(maxWidth: .infinity, alignment: isExpanded ? .leading : .center)
    }

    private var brandToggleButton: some View {
        Button(action: toggleExpanded) {
            SpeakEasyBrandMark(size: HudIconSize.large)
                .frame(width: HudIconSize.xLarge, height: HudIconSize.xLarge)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isExpanded ? "Collapse sidebar" : "Expand sidebar")
        .accessibilityAddTraits(.isButton)
    }

    private func toggleExpanded() {
        if reduceMotion {
            isExpanded.toggle()
        } else {
            withAnimation(HudMotion.chromeResize) {
                isExpanded.toggle()
            }
        }
    }
}

extension SpeakEasyNavigationRail where Footer == EmptyView {
    init(
        selection: Binding<String>,
        items: [HudRailItem],
        isExpanded: Binding<Bool>
    ) {
        self.init(selection: selection, items: items, isExpanded: isExpanded, footer: { EmptyView() })
    }
}

// MARK: - Rows

private struct SpeakEasyRailLabelButton: View {
    let item: HudRailItem
    let isSelected: Bool
    let accent: Color
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: item.icon)
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(isSelected ? accent : theme.palette.muted)
                    .frame(width: HudIconSize.small, height: HudIconSize.small)

                Text(item.label)
                    .font(HudFont.ui(HudTextSize.sm, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? theme.palette.ink : theme.palette.muted)
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(height: HudLayout.buttonHeight)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(background)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(border, lineWidth: isFocused ? theme.focus.ringWidth : 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .focusable(true)
        .focused($isFocused)
        .onHover { isHovering = $0 }
        .accessibilityLabel(item.label)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var background: Color {
        if isSelected { return HudSurface.tintGhost(accent) }
        if isHovering { return HudSurface.hover }
        return .clear
    }

    private var border: Color {
        if isFocused { return theme.focus.ring }
        if isSelected { return HudSurface.tintBorder(accent) }
        if isHovering { return theme.hairline.subtle }
        return .clear
    }
}

private struct SpeakEasyRailIconButton: View {
    let item: HudRailItem
    let isSelected: Bool
    let accent: Color
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme
    @FocusState private var isFocused: Bool
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            Image(systemName: item.icon)
                .font(HudFont.ui(HudTextSize.md, weight: .medium))
                .foregroundStyle(isSelected ? accent : theme.palette.muted)
                .frame(maxWidth: .infinity, alignment: .center)
                .frame(height: HudIconSize.xLarge)
                .background(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .fill(background)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: theme.radius.standard)
                        .stroke(border, lineWidth: isFocused ? theme.focus.ringWidth : 1)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .focusable(true)
        .focused($isFocused)
        .onHover { isHovering = $0 }
        .accessibilityLabel(item.label)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var background: Color {
        if isSelected { return HudSurface.tintGhost(accent) }
        if isHovering { return HudSurface.hover }
        return .clear
    }

    private var border: Color {
        if isFocused { return theme.focus.ring }
        if isSelected { return HudSurface.tintBorder(accent) }
        if isHovering { return theme.hairline.subtle }
        return .clear
    }
}