import SwiftUI
import HudsonUI
import HudsonShell

#if os(macOS)
private struct SpeakEasyToolbarBackgroundVisibility: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 15.0, *) {
            content.toolbarBackgroundVisibility(.visible, for: .windowToolbar)
        } else {
            content
        }
    }
}
#endif

enum SpeakEasySection: String, CaseIterable, Identifiable {
    case dashboard
    case providers
    case pad
    case deck
    case cache
    case hud
    case history

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .providers: return "Providers"
        case .pad: return "Pad"
        case .deck: return "Deck"
        case .cache: return "Cache"
        case .hud: return "HUD"
        case .history: return "History"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .providers: return "waveform.badge.plus"
        case .pad: return "ipad.and.iphone"
        case .deck: return "rectangle.3.group"
        case .cache: return "externaldrive"
        case .hud: return "square.stack.3d.up"
        case .history: return "clock.arrow.circlepath"
        }
    }

    var navItem: HudRailItem {
        HudRailItem(id: rawValue, label: title, icon: icon)
    }

    var subtitle: String {
        switch self {
        case .dashboard: return "Providers, defaults, and quick settings"
        case .providers: return "Credentials, voices, models, and previews"
        case .pad: return "Local iPad lane controls"
        case .deck: return "Bridge status and lane activity"
        case .cache: return "TTL, size limits, and cleanup"
        case .hud: return "Floating notification overlay"
        case .history: return "Recent spoken notifications"
        }
    }
}

struct ShellRootView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.hudTheme) private var hudTheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject private var padIntegration = SpeakEasyPadIntegration.shared

    @State private var section: SpeakEasySection = .dashboard
    @State private var selectedProvider: SpeechProviderID = .openai
    @State private var railExpanded = true
    @AppStorage("settingsSidebarLabelWidth") private var sidebarLabelWidth = 156.0
    @State private var inspectorCollapsed = true

    init(initialSection: SpeakEasySection = .dashboard) {
        let arguments = ProcessInfo.processInfo.arguments
        var requestedSection = initialSection
        if arguments.contains("--pad-settings") {
            requestedSection = .pad
        } else if arguments.contains("--deck-settings") {
            requestedSection = .deck
        } else if arguments.contains("--provider-settings") {
            requestedSection = .providers
        }
        _section = State(initialValue: requestedSection)
        if let value = arguments
            .first(where: { $0.hasPrefix("--provider=") })?
            .dropFirst("--provider=".count),
           let provider = SpeechProviderID(rawValue: String(value)) {
            _selectedProvider = State(initialValue: provider)
        }
    }

    private var manifest: HudAppManifest {
        HudAppManifest(
            name: "SpeakEasy",
            version: Self.appVersion ?? "0.0.0",
            tint: .green,
            targetLabel: "Companion"
        )
    }

    private var effectiveScheme: ColorScheme {
        switch config.appearanceMode {
        case .system: return systemColorScheme
        case .light: return .light
        case .dark: return .dark
        }
    }

    var body: some View {
        HudAppShell {
            HudNavigationSidebar(
                selection: Binding(
                    get: { Optional(section) },
                    set: { next in
                        if let next {
                            section = next
                        }
                    }
                ),
                entries: sidebarEntries,
                isCompact: !railExpanded,
                accent: manifest.accent,
                onHeaderTap: toggleRail,
                railHeader: {
                    SpeakEasyBrandMark(size: HudIconSize.large)
                },
                labelHeader: {
                    Text(manifest.name)
                        .font(HudFont.ui(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(hudTheme.palette.ink)
                        .lineLimit(1)
                },
                footer: {
                    sidebarFooter
                }
            )
            .resizable(
                isCompact: Binding(
                    get: { !railExpanded },
                    set: { railExpanded = !$0 }
                ),
                labelWidth: Binding(
                    get: { CGFloat(sidebarLabelWidth) },
                    set: { sidebarLabelWidth = Double($0) }
                ),
                minLabelWidth: 120,
                maxLabelWidth: 280,
                collapseLabelWidth: 44
            )
        } trailing: {
            HudInspector(isCollapsed: $inspectorCollapsed) {
                HStack {
                    HudSectionLabel("Status")
                    Spacer()
                    if config.isSaved {
                        HudBadge("SAVED", tint: HudPalette.statusOk, dot: true)
                    } else {
                        HudBadge("UNSAVED", tint: HudPalette.statusWarn, dot: true)
                    }
                }
            } content: {
                inspectorContent
            }
        } content: {
            VStack(spacing: 0) {
                sectionHeader
                HudDivider()
                ScrollView {
                    sectionContent
                        .environment(\.theme, Theme())
                        .padding(HudSpacing.xxl)
                        .frame(
                            maxWidth: section == .providers
                                ? 1180
                                : HudLayout.readableWidth + HudSpacing.xxl * 2,
                            alignment: .topLeading
                        )
                        .frame(
                            maxWidth: .infinity,
                            alignment: section == .providers ? .topLeading : .top
                        )
                }
            }
        } statusBar: {
            statusBar
        }
        .hudsonAppManifest(manifest)
        .tint(manifest.accent)
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button(action: toggleRail) {
                    Image(systemName: railExpanded ? "sidebar.left" : "line.3.horizontal")
                }
                .help(railExpanded ? "Collapse sidebar" : "Expand sidebar")
            }
        }
        .toolbarBackground(hudTheme.palette.chrome, for: .windowToolbar)
        .toolbarColorScheme(effectiveScheme, for: .windowToolbar)
        .modifier(SpeakEasyToolbarBackgroundVisibility())
        .background(HudWindowChrome(
            colorScheme: effectiveScheme,
            titleVisibility: .hidden,
            titlebarAppearsTransparent: true,
            usesFullSizeContentView: false,
            isMovableByWindowBackground: false,
            hidesToolbar: false
        ))
        .preferredColorScheme(config.appearanceMode == .system ? nil :
                              config.appearanceMode == .dark ? .dark : .light)
        .overlay(alignment: .bottom) {
            if config.showSaveConfirmation {
                SaveConfirmationToast()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, HudLayout.statusBarHeight + HudSpacing.xl)
            }
        }
        .animation(.spring(duration: 0.35), value: config.showSaveConfirmation)
        .onReceive(NotificationCenter.default.publisher(for: .speakEasySettingsSectionRequested)) { note in
            guard let rawValue = note.object as? String,
                  let requestedSection = SpeakEasySection(rawValue: rawValue) else { return }
            section = requestedSection
        }
        .frame(minWidth: 720, minHeight: 640)
    }

    private var sectionHeader: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(section.title)
                .font(HudFont.mono(16, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
            Text(section.subtitle)
                .font(HudFont.ui(11))
                .foregroundStyle(HudPalette.dim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, HudSpacing.xxl)
        .padding(.vertical, HudSpacing.xl)
    }

    private var railFooter: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("CLI")
            HudBadge("~/.config/speakeasy", tint: HudPalette.muted)
        }
    }

    @ViewBuilder
    private var sidebarFooter: some View {
        if railExpanded {
            railFooter
                .padding(.horizontal, HudSpacing.xl)
                .padding(.vertical, HudSpacing.md)
        } else {
            Image(systemName: "terminal")
                .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                .foregroundStyle(hudTheme.palette.muted)
                .frame(width: HudSidebarLayout.railWidth, height: HudIconSize.xLarge)
        }
    }

    private var sidebarEntries: [HudSidebarEntry<SpeakEasySection>] {
        SpeakEasySection.allCases.map { section in
            .item(HudSidebarItem(
                id: section,
                title: section.title,
                icon: section.icon,
                selectedIcon: section.icon,
                tooltipLabel: section.title
            ))
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .dashboard:
            DashboardView(selectedSection: $section, selectedProvider: $selectedProvider)
        case .providers:
            ProviderSettingsView(selection: $selectedProvider)
        case .pad:
            SpeakEasyPadSettingsView()
        case .deck:
            DeckSettingsView()
        case .cache:
            CacheManagementView()
        case .hud:
            HUDSettingsView()
        case .history:
            HistoryView()
        }
    }

    private var inspectorContent: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    HudSectionLabel("Snapshot", tint: HudPalette.muted)
                    HudKVRow("Section", value: section.title)
                    HudKVRow("HUD", value: config.hudEnabled ? "Enabled" : "Disabled",
                             valueColor: config.hudEnabled ? HudPalette.statusOk : HudPalette.muted)
                    HudKVRow("Provider", value: config.defaultProvider.capitalized)
                    HudKVRow(
                        "Pad",
                        value: padStatusLabel,
                        valueColor: padIntegration.snapshot.state == .connected
                            ? HudPalette.statusOk
                            : HudPalette.muted
                    )
                    HudKVRow("Cache", value: config.cacheEnabled ? "On" : "Off",
                             valueColor: config.cacheEnabled ? HudPalette.statusOk : HudPalette.muted)
                }
            }

            if let error = config.lastError {
                HudCard {
                    VStack(alignment: .leading, spacing: HudSpacing.sm) {
                        HudSectionLabel("Error", tint: HudPalette.statusWarn)
                        Text(error)
                            .font(HudFont.ui(11))
                            .foregroundStyle(HudPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    private var statusBar: some View {
        HStack(spacing: HudSpacing.xl) {
            HudStatusDot(color: config.isSaved ? HudPalette.statusOk : HudPalette.statusWarn)
            Text("SPEAKEASY")
                .font(HudFont.mono(10, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(HudPalette.muted)

            Text("·")
                .font(HudFont.mono(10))
                .foregroundStyle(HudPalette.dim)

            Text(config.isSaved ? "all changes saved" : "unsaved changes")
                .font(HudFont.mono(10))
                .foregroundStyle(config.isSaved ? HudPalette.muted : HudPalette.statusWarn)

            Spacer()

            if let error = config.lastError {
                Text(error)
                    .font(HudFont.ui(10))
                    .foregroundStyle(HudPalette.statusWarn)
                    .lineLimit(1)
                    .frame(maxWidth: 240, alignment: .trailing)
            }

            HudButton("Reload", icon: "arrow.clockwise", style: .ghost) {
                config.loadConfig()
            }

            HudButton("Save", icon: "checkmark.circle.fill", style: .primary(.green)) {
                config.saveConfig()
            }
            .disabled(config.isSaved)

            HudBadge(section.title.uppercased(), tint: manifest.accent)
        }
        .padding(.horizontal, HudSpacing.xxl)
        .frame(height: HudLayout.statusBarHeight)
    }

    private static var appVersion: String? {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
    }

    private var padStatusLabel: String {
        switch padIntegration.snapshot.state {
        case .stopped: return "Stopped"
        case .starting: return "Starting"
        case .ready: return "Ready"
        case .pairing: return "Pairing"
        case .connected: return "Connected"
        case .unavailable: return "Unavailable"
        case .failed: return "Error"
        }
    }

    private func toggleRail() {
        if reduceMotion {
            railExpanded.toggle()
        } else {
            withAnimation(HudMotion.chromeResize) {
                railExpanded.toggle()
            }
        }
    }
}
