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
    case openai
    case elevenlabs
    case system
    case cache
    case hud
    case history

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .openai: return "OpenAI"
        case .elevenlabs: return "ElevenLabs"
        case .system: return "System"
        case .cache: return "Cache"
        case .hud: return "HUD"
        case .history: return "History"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .openai: return "brain.head.profile"
        case .elevenlabs: return "waveform"
        case .system: return "desktopcomputer"
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
        case .openai: return "API key, voice, and playground"
        case .elevenlabs: return "Voices, models, and preview"
        case .system: return "macOS built-in speech voices"
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

    @State private var section: SpeakEasySection = .dashboard
    @State private var railExpanded = true
    @State private var inspectorCollapsed = true

    private var manifest: HudAppManifest {
        HudAppManifest(
            name: "SpeakEasy",
            version: Self.appVersion ?? "0.0.0",
            tint: .violet,
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
            SpeakEasyNavigationRail(
                selection: Binding(
                    get: { section.rawValue },
                    set: { next in
                        if let value = SpeakEasySection(rawValue: next) {
                            section = value
                        }
                    }
                ),
                items: SpeakEasySection.allCases.map(\.navItem),
                isExpanded: $railExpanded
            ) {
                railFooter
            }
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
                        .frame(maxWidth: HudLayout.readableWidth + HudSpacing.xxl * 2, alignment: .topLeading)
                        .frame(maxWidth: .infinity, alignment: .top)
                }
            }
        } statusBar: {
            statusBar
        }
        .hudsonAppManifest(manifest)
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
    private var sectionContent: some View {
        switch section {
        case .dashboard:
            DashboardView(selectedSection: $section)
        case .openai:
            OpenAIPlaygroundView()
        case .elevenlabs:
            ElevenLabsPlaygroundView()
        case .system:
            SystemSettingsView()
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

            HudButton("Save", icon: "checkmark.circle.fill", style: .primary(.violet)) {
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