import SwiftUI
import AppKit
import AVFoundation

// MARK: - Theme System

struct Theme {
    let background: Color
    let surface: Color
    let surfaceHover: Color
    let border: Color
    let text: Color
    let textSecondary: Color
    let textTertiary: Color

    static let dark = Theme(
        background: Color(red: 0, green: 0, blue: 0),  // Pure black
        surface: Color(red: 1, green: 1, blue: 1).opacity(0.06),
        surfaceHover: Color(red: 1, green: 1, blue: 1).opacity(0.1),
        border: Color(red: 1, green: 1, blue: 1).opacity(0.12),
        text: Color(red: 1, green: 1, blue: 1),  // Pure white
        textSecondary: Color(red: 1, green: 1, blue: 1).opacity(0.65),
        textTertiary: Color(red: 1, green: 1, blue: 1).opacity(0.4)
    )

    static let light = Theme(
        background: Color(red: 1, green: 1, blue: 1),  // Pure white
        surface: Color(red: 0, green: 0, blue: 0).opacity(0.04),
        surfaceHover: Color(red: 0, green: 0, blue: 0).opacity(0.06),
        border: Color(red: 0, green: 0, blue: 0).opacity(0.08),
        text: Color(red: 0, green: 0, blue: 0),  // Pure black
        textSecondary: Color(red: 0, green: 0, blue: 0).opacity(0.65),
        textTertiary: Color(red: 0, green: 0, blue: 0).opacity(0.4)
    )
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

// MARK: - Glass Effect Components

extension View {
    @ViewBuilder
    func glassBackground(cornerRadius: CGFloat = 12, intensity: GlassIntensity = .regular) -> some View {
        self.background(
            ZStack {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Color.primary.opacity(intensity.fillOpacity))
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.primary.opacity(intensity.borderOpacity), lineWidth: 0.5)
            }
        )
    }

    @ViewBuilder
    func glassCapsule(intensity: GlassIntensity = .regular) -> some View {
        self.background(
            ZStack {
                Capsule()
                    .fill(Color.primary.opacity(intensity.fillOpacity))
                Capsule()
                    .stroke(Color.primary.opacity(intensity.borderOpacity), lineWidth: 0.5)
            }
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

enum GlassIntensity {
    case subtle, regular, prominent

    var fillOpacity: Double {
        switch self {
        case .subtle: return 0.03
        case .regular: return 0.05
        case .prominent: return 0.08
        }
    }

    var borderOpacity: Double {
        switch self {
        case .subtle: return 0.08
        case .regular: return 0.12
        case .prominent: return 0.16
        }
    }
}

// MARK: - Button Styles

struct FlatButtonStyle: ButtonStyle {
    @Environment(\.theme) var theme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline)
            .fontWeight(.medium)
            .foregroundColor(theme.textSecondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(theme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(theme.border, lineWidth: 0.5)
                    )
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct FlatProminentButtonStyle: ButtonStyle {
    @Environment(\.theme) var theme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline)
            .fontWeight(.semibold)
            .foregroundColor(theme.text)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(theme.surfaceHover)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(theme.border, lineWidth: 0.5)
                    )
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == FlatButtonStyle {
    static var flat: FlatButtonStyle { FlatButtonStyle() }
}

extension ButtonStyle where Self == FlatProminentButtonStyle {
    static var flatProminent: FlatProminentButtonStyle { FlatProminentButtonStyle() }
}

// Legacy compatibility
extension ButtonStyle where Self == FlatButtonStyle {
    static var glassCompat: FlatButtonStyle { FlatButtonStyle() }
}

extension ButtonStyle where Self == FlatProminentButtonStyle {
    static var glassProminentCompat: FlatProminentButtonStyle { FlatProminentButtonStyle() }
}

// Custom window class to force solid colors
class SolidColorWindow: NSWindow {
    override init(contentRect: NSRect, styleMask: NSWindow.StyleMask, backing: NSWindow.BackingStoreType, defer flag: Bool) {
        super.init(contentRect: contentRect, styleMask: styleMask, backing: backing, defer: flag)

        self.isOpaque = true
        self.titlebarAppearsTransparent = false
        self.hasShadow = true
    }

    override var isOpaque: Bool {
        get { true }
        set { }
    }
}

@main
struct SpeakEasyApp: App {
    @StateObject private var configManager = ConfigManager.shared
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    var body: some Scene {
        WindowGroup {
            ThemedContentView()
                .environmentObject(configManager)
        }
        .defaultSize(width: 600, height: 720)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var timer: Timer?
    var hudWindow: NSWindow?
    private var hudWindowManager: HUDWindowManager?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Configure all windows immediately
        configureAllWindows()

        // Set up continuous monitoring to remove vibrancy
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.configureAllWindows()
        }

        // Check if HUD should be started
        checkAndStartHUD()

        // Observe config changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(configDidChange),
            name: NSNotification.Name("ConfigDidChange"),
            object: nil
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        timer?.invalidate()
        hudWindowManager?.stop()
    }

    @objc private func configDidChange() {
        checkAndStartHUD()
    }

    private func checkAndStartHUD() {
        let config = ConfigManager.shared

        if config.hudEnabled && hudWindow == nil {
            startHUD(position: config.hudPosition, opacity: config.hudOpacity, duration: TimeInterval(config.hudDuration) / 1000.0)
        } else if !config.hudEnabled && hudWindow != nil {
            stopHUD()
        }
    }

    private func startHUD(position: String, opacity: Double, duration: TimeInterval) {
        guard hudWindow == nil else { return }

        let hudPosition = HUDPosition(rawValue: position) ?? .topRight
        let manager = HUDWindowManager.shared
        manager.start()
        hudWindowManager = manager

        // Create a floating, transparent window
        let screen = NSScreen.main ?? NSScreen.screens.first!
        let window = NSWindow(
            contentRect: screen.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.isOpaque = false
        window.backgroundColor = .clear
        window.ignoresMouseEvents = true
        window.hasShadow = false

        let hostingView = NSHostingView(rootView:
            HUDOverlayView(position: hudPosition, opacity: opacity)
        )
        hostingView.frame = window.contentView!.bounds
        hostingView.autoresizingMask = [NSView.AutoresizingMask.width, NSView.AutoresizingMask.height]
        window.contentView = hostingView

        window.orderFrontRegardless()
        hudWindow = window
    }

    private func stopHUD() {
        hudWindowManager?.stop()
        hudWindowManager = nil
        hudWindow?.close()
        hudWindow = nil
    }

    private func configureAllWindows() {
        for window in NSApplication.shared.windows {
            window.isOpaque = true
            window.hasShadow = true
            window.titlebarAppearsTransparent = false

            // Continuously remove visual effect views
            if let contentView = window.contentView {
                removeVisualEffectViews(from: contentView)

                // Force solid background
                contentView.wantsLayer = true
                if let layer = contentView.layer {
                    layer.isOpaque = true
                }
            }
        }
    }

    private func removeVisualEffectViews(from view: NSView) {
        var toRemove: [NSView] = []

        for subview in view.subviews {
            if subview is NSVisualEffectView {
                toRemove.append(subview)
            } else {
                removeVisualEffectViews(from: subview)
            }
        }

        for subview in toRemove {
            subview.removeFromSuperview()
        }
    }
}

struct ThemedContentView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.colorScheme) var systemColorScheme

    var effectiveColorScheme: ColorScheme {
        switch config.appearanceMode {
        case .system: return systemColorScheme
        case .light: return .light
        case .dark: return .dark
        }
    }

    var theme: Theme {
        effectiveColorScheme == .dark ? .dark : .light
    }

    var body: some View {
        ContentView()
            .environment(\.theme, theme)
            .preferredColorScheme(config.appearanceMode == .system ? nil :
                                  config.appearanceMode == .dark ? .dark : .light)
            .background(SolidWindowBackground())
    }
}

// MARK: - Window Background

struct SolidWindowBackground: NSViewRepresentable {
    @Environment(\.colorScheme) var colorScheme

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        view.wantsLayer = true
        view.layer?.isOpaque = true

        let backgroundColor = context.environment.colorScheme == .dark ?
            NSColor(deviceRed: 0, green: 0, blue: 0, alpha: 1.0) :
            NSColor(deviceRed: 1, green: 1, blue: 1, alpha: 1.0)

        view.layer?.backgroundColor = backgroundColor.cgColor

        // Configure window aggressively
        DispatchQueue.main.async {
            guard let window = view.window else { return }

            // Force complete opacity
            window.isOpaque = true
            window.backgroundColor = backgroundColor
            window.titlebarAppearsTransparent = false
            window.styleMask.insert(.fullSizeContentView)

            // Disable all vibrancy and effects
            window.allowsToolTipsWhenApplicationIsInactive = false

            // Force content view to solid color
            if let contentView = window.contentView {
                contentView.wantsLayer = true
                contentView.layer?.isOpaque = true
                contentView.layer?.backgroundColor = backgroundColor.cgColor
                contentView.layerContentsRedrawPolicy = .onSetNeedsDisplay

                // Remove any visual effect views
                for subview in contentView.subviews {
                    if subview is NSVisualEffectView {
                        subview.removeFromSuperview()
                    }
                }
            }

            // Force the window appearance to not use vibrancy
            if context.environment.colorScheme == .dark {
                window.appearance = NSAppearance(named: .darkAqua)
            } else {
                window.appearance = NSAppearance(named: .aqua)
            }

            window.invalidateShadow()
            window.display()
        }

        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        let backgroundColor = context.environment.colorScheme == .dark ?
            NSColor(deviceRed: 0, green: 0, blue: 0, alpha: 1.0) :
            NSColor(deviceRed: 1, green: 1, blue: 1, alpha: 1.0)

        nsView.layer?.backgroundColor = backgroundColor.cgColor
        nsView.layer?.isOpaque = true

        DispatchQueue.main.async {
            guard let window = nsView.window else { return }
            window.backgroundColor = backgroundColor
            window.contentView?.layer?.backgroundColor = backgroundColor.cgColor
            window.contentView?.layer?.isOpaque = true

            // Update appearance
            if context.environment.colorScheme == .dark {
                window.appearance = NSAppearance(named: .darkAqua)
            } else {
                window.appearance = NSAppearance(named: .aqua)
            }

            window.display()
        }
    }
}

// MARK: - Background

struct MinimalBackground: View {
    @Environment(\.theme) var theme

    var body: some View {
        theme.background
            .ignoresSafeArea()
    }
}

// MARK: - Main Content View

struct ContentView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @State private var selectedTab = 0

    var body: some View {
        ZStack {
            // Explicit solid background
            Rectangle()
                .fill(theme.background)
                .ignoresSafeArea()

            // Main content
            VStack(spacing: 0) {
                // Header - clean and minimal
                HStack {
                    HStack(spacing: 10) {
                        Image(systemName: "speaker.wave.3.fill")
                            .font(.title2)
                            .foregroundColor(theme.textSecondary)
                        Text("SpeakEasy")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(theme.text)

                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .glassBackground(cornerRadius: 12, intensity: .subtle)

                    Spacer()

                    // Appearance mode picker
                    Picker("", selection: $config.appearanceMode) {
                        ForEach(AppearanceMode.allCases, id: \.self) { mode in
                            Text(mode.displayName).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 160)

                    if !config.isSaved {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(theme.text)
                                .frame(width: 5, height: 5)
                            Text("Unsaved")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(theme.textSecondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .glassCapsule(intensity: .regular)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)

                // Tab selector
                HStack(spacing: 4) {
                    ForEach(Array(["Dashboard", "OpenAI", "ElevenLabs", "System", "Cache", "HUD"].enumerated()), id: \.offset) { index, title in
                        Button(action: {
                            withAnimation(.spring(duration: 0.25, bounce: 0.2)) {
                                selectedTab = index
                            }
                        }) {
                            Text(title)
                                .font(.subheadline)
                                .fontWeight(selectedTab == index ? .semibold : .medium)
                                .foregroundColor(selectedTab == index ? theme.text : theme.textTertiary)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)
                        .background(
                            Group {
                                if selectedTab == index {
                                    Capsule()
                                        .fill(theme.surfaceHover)
                                        .overlay(
                                            Capsule()
                                                .stroke(theme.border, lineWidth: 0.5)
                                        )
                                }
                            }
                        )
                    }
                }
                .padding(6)
                .glassBackground(cornerRadius: 24, intensity: .prominent)
                .padding(.horizontal, 20)
                .padding(.bottom, 12)

                // Content
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        switch selectedTab {
                        case 0: DashboardView(selectedTab: $selectedTab)
                        case 1: OpenAIPlaygroundView()
                        case 2: ElevenLabsPlaygroundView()
                        case 3: SystemSettingsView()
                        case 4: CacheManagementView()
                        case 5: HUDSettingsView()
                        default: DashboardView(selectedTab: $selectedTab)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                }

                // Footer
                HStack {
                    if let error = config.lastError {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(theme.textSecondary)
                            Text(error)
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .glassBackground(cornerRadius: 8, intensity: .subtle)
                        .lineLimit(2)
                    }
                    Spacer()

                    // Build indicator
                    Text("Build: HUD-v2.0-\(Date().timeIntervalSince1970)")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(theme.textTertiary)
                        .padding(.horizontal, 8)

                    Button {
                        config.loadConfig()
                    } label: {
                        Label("Reload", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.flat)

                    Button {
                        config.saveConfig()
                    } label: {
                        Label("Save", systemImage: "checkmark.circle.fill")
                    }
                    .buttonStyle(.flatProminent)
                    .disabled(config.isSaved)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .background(
                    Rectangle()
                        .fill(Color.primary.opacity(0.04))
                        .overlay(
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color.primary.opacity(0.08), Color.clear],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                        )
                )
            }

            // Save confirmation toast
            if config.showSaveConfirmation {
                VStack {
                    Spacer()
                    SaveConfirmationToast()
                        .transition(.move(edge: .bottom).combined(with: .opacity).combined(with: .scale(scale: 0.9)))
                        .padding(.bottom, 90)
                }
                .animation(.spring(duration: 0.4, bounce: 0.3), value: config.showSaveConfirmation)
            }
        }
        .frame(minWidth: 580, minHeight: 660)
    }
}

// MARK: - Save Confirmation Toast

struct SaveConfirmationToast: View {
    @Environment(\.theme) var theme

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark")
                .font(.subheadline)
                .fontWeight(.semibold)
            Text("Saved")
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .foregroundColor(theme.text)
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .glassBackground(cornerRadius: 16, intensity: .prominent)
        .shadow(color: .black.opacity(0.2), radius: 16, y: 8)
    }
}

// MARK: - Dashboard View

struct DashboardView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @Binding var selectedTab: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Configured Providers Section
            Text("Configured Providers")
                .font(.headline)
                .foregroundColor(theme.text)

            VStack(spacing: 10) {
                ProviderCard(
                    name: "OpenAI",
                    icon: "brain.head.profile",
                    isConfigured: !config.openaiApiKey.isEmpty,
                    isDefault: config.defaultProvider == "openai",
                    detail: config.openaiApiKey.isEmpty ? "Not configured" : "Voice: \(config.openaiVoice.capitalized)",
                    accentColor: .green
                ) {
                    withAnimation(.spring(duration: 0.3)) {
                        selectedTab = 1
                    }
                }

                ProviderCard(
                    name: "ElevenLabs",
                    icon: "waveform",
                    isConfigured: !config.elevenlabsApiKey.isEmpty,
                    isDefault: config.defaultProvider == "elevenlabs",
                    detail: config.elevenlabsApiKey.isEmpty ? "Not configured" : "Voice ID: \(String(config.elevenlabsVoiceId.prefix(8)))...",
                    accentColor: .purple
                ) {
                    withAnimation(.spring(duration: 0.3)) {
                        selectedTab = 2
                    }
                }

                ProviderCard(
                    name: "System (macOS)",
                    icon: "desktopcomputer",
                    isConfigured: true,
                    isDefault: config.defaultProvider == "system",
                    detail: "Voice: \(config.systemVoice)",
                    accentColor: .blue
                ) {
                    withAnimation(.spring(duration: 0.3)) {
                        selectedTab = 3
                    }
                }

                if !config.groqApiKey.isEmpty {
                    ProviderCard(
                        name: "Groq",
                        icon: "bolt.fill",
                        isConfigured: true,
                        isDefault: config.defaultProvider == "groq",
                        detail: "Voice: Celeste-PlayAI",
                        accentColor: .orange
                    ) {}
                }

                if !config.geminiApiKey.isEmpty {
                    ProviderCard(
                        name: "Gemini",
                        icon: "sparkles",
                        isConfigured: true,
                        isDefault: config.defaultProvider == "gemini",
                        detail: "Model: \(config.geminiModel)",
                        accentColor: .cyan
                    ) {}
                }
            }

            // Quick Settings
            Text("Quick Settings")
                .font(.headline)
                .foregroundColor(theme.text)
                .padding(.top, 8)

            VStack(alignment: .leading, spacing: 16) {
                // Default Provider
                HStack {
                    Text("Default Provider")
                        .foregroundColor(theme.text)
                    Spacer()
                    Picker("", selection: Binding(
                        get: { config.defaultProvider },
                        set: { config.defaultProvider = $0 }
                    )) {
                        Text("System").tag("system")
                        if !config.openaiApiKey.isEmpty {
                            Text("OpenAI").tag("openai")
                        }
                        if !config.elevenlabsApiKey.isEmpty {
                            Text("ElevenLabs").tag("elevenlabs")
                        }
                        if !config.groqApiKey.isEmpty {
                            Text("Groq").tag("groq")
                        }
                        if !config.geminiApiKey.isEmpty {
                            Text("Gemini").tag("gemini")
                        }
                    }
                    .frame(width: 140)
                }

                Divider()

                // Volume
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Volume")
                            .foregroundColor(theme.text)
                        Spacer()
                        Text("\(Int(config.defaultVolume * 100))%")
                            .foregroundColor(theme.textTertiary)
                            .monospacedDigit()
                    }
                    Slider(value: Binding(
                        get: { config.defaultVolume },
                        set: { config.defaultVolume = $0 }
                    ), in: 0...1, step: 0.05)
                }

                // Rate
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Speech Rate")
                            .foregroundColor(theme.text)
                        Spacer()
                        Text("\(config.defaultRate) WPM")
                            .foregroundColor(theme.textTertiary)
                            .monospacedDigit()
                    }
                    Slider(value: Binding(
                        get: { Double(config.defaultRate) },
                        set: { config.defaultRate = Int($0) }
                    ), in: 80...300, step: 10)
                }
            }
            .padding(18)
            .glassBackground(cornerRadius: 20, intensity: .regular)

            Spacer()
        }
    }
}

struct ProviderCard: View {
    @Environment(\.theme) var theme
    let name: String
    let icon: String
    let isConfigured: Bool
    let isDefault: Bool
    let detail: String
    let accentColor: Color  // kept for API compatibility
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(theme.surface)
                        .frame(width: 44, height: 44)
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(isConfigured ? theme.text : theme.textTertiary)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(name)
                            .fontWeight(.semibold)
                            .foregroundColor(theme.text)
                        if isDefault {
                            Text("Default")
                                .font(.caption2)
                                .fontWeight(.medium)
                                .foregroundColor(theme.textSecondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(
                                    Capsule()
                                        .fill(theme.surface)
                                        .overlay(
                                            Capsule()
                                                .stroke(theme.border, lineWidth: 0.5)
                                        )
                                )
                        }
                    }
                    Text(detail)
                        .font(.caption)
                        .foregroundColor(theme.textTertiary)
                }

                Spacer()

                HStack(spacing: 8) {
                    if isConfigured {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(theme.textSecondary)
                    } else {
                        Image(systemName: "circle.dashed")
                            .foregroundColor(theme.textTertiary)
                    }

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(theme.textTertiary)
                }
            }
            .padding(16)
            .glassBackground(cornerRadius: 16, intensity: .regular)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - OpenAI Playground View

struct OpenAIPlaygroundView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @State private var showApiKey = false
    @State private var showApiKeySection = false
    @State private var testText = "Hello! This is a test of the OpenAI text-to-speech voice."
    @State private var selectedVoice = "nova"
    @State private var isTesting = false
    @State private var currentlyPlayingVoice: String?
    @State private var audioPlayer: AVAudioPlayer?
    @State private var previewError: String?

    let voices: [(id: String, name: String, description: String)] = [
        ("alloy", "Alloy", "Neutral and balanced"),
        ("echo", "Echo", "Warm and clear"),
        ("fable", "Fable", "Expressive and dynamic"),
        ("onyx", "Onyx", "Deep and authoritative"),
        ("nova", "Nova", "Friendly and upbeat"),
        ("shimmer", "Shimmer", "Soft and gentle")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Voice Picker
            GlassSection(title: "Voice Selection", icon: "person.wave.2.fill", color: .clear) {
                VStack(spacing: 8) {
                    ForEach(voices, id: \.id) { voice in
                        VoiceRow(
                            id: voice.id,
                            name: voice.name,
                            description: voice.description,
                            isSelected: config.openaiVoice == voice.id,
                            isPlaying: currentlyPlayingVoice == voice.id,
                            isDisabled: config.openaiApiKey.isEmpty
                        ) {
                            withAnimation(.spring(duration: 0.2)) {
                                config.openaiVoice = voice.id
                            }
                        } onPreview: {
                            previewVoice(voice.id)
                        }
                    }
                }
            }

            // Playground
            GlassSection(title: "Playground", icon: "play.circle.fill", color: .clear) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Test Text")
                        .font(.caption)
                        .foregroundColor(theme.textTertiary)
                    TextEditor(text: $testText)
                        .frame(height: 60)
                        .font(.system(.body))
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .glassBackground(cornerRadius: 8)

                    HStack {
                        Button(action: playTestText) {
                            HStack {
                                if isTesting {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                } else {
                                    Image(systemName: "play.fill")
                                }
                                Text("Play")
                            }
                        }
                        .buttonStyle(.flatProminent)
                        .disabled(config.openaiApiKey.isEmpty || isTesting || testText.isEmpty)

                        Spacer()

                        Text("Voice: \(config.openaiVoice.capitalized)")
                            .font(.caption)
                            .foregroundColor(theme.textTertiary)
                    }

                    if let error = previewError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(theme.textTertiary)
                    }
                }
            }

            // Instructions
            GlassSection(title: "Voice Instructions", icon: "text.quote", color: .clear) {
                VStack(alignment: .leading, spacing: 8) {
                    TextEditor(text: Binding(
                        get: { config.openaiInstructions },
                        set: { config.openaiInstructions = $0 }
                    ))
                    .frame(height: 60)
                    .font(.system(.body, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .glassBackground(cornerRadius: 8)
                    Text("Guide the voice style, accent, or emotional tone")
                        .font(.caption)
                        .foregroundColor(theme.textTertiary)
                }
            }

            // API Configuration (Collapsible)
            DisclosureGroup(
                isExpanded: $showApiKeySection,
                content: {
                    GlassSection(title: "API Key", icon: "key.fill", color: .clear) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        if showApiKey {
                            TextField("sk-...", text: Binding(
                                get: { config.openaiApiKey },
                                set: { config.openaiApiKey = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .font(.system(.body, design: .monospaced))
                        } else {
                            SecureField("sk-...", text: Binding(
                                get: { config.openaiApiKey },
                                set: { config.openaiApiKey = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                        }
                        Button(action: { showApiKey.toggle() }) {
                            Image(systemName: showApiKey ? "eye.slash" : "eye")
                        }
                        .buttonStyle(.glassCompat)
                    }
                    HStack {
                        Circle()
                            .fill(config.openaiApiKey.isEmpty ? theme.textTertiary : theme.text)
                            .frame(width: 5, height: 5)
                        Text(config.openaiApiKey.isEmpty ? "Not configured" : "Configured")
                            .font(.caption)
                            .foregroundColor(theme.textTertiary)
                        Spacer()
                        Link("Get API Key", destination: URL(string: "https://platform.openai.com/api-keys")!)
                            .font(.caption)
                    }
                }
            }
                },
                label: {
                    HStack {
                        Image(systemName: "key.fill")
                            .font(.system(size: 12))
                            .foregroundColor(theme.textTertiary)
                        Text("API Configuration")
                            .font(.subheadline)
                            .foregroundColor(theme.textSecondary)
                        Spacer()
                        if !config.openaiApiKey.isEmpty {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                        }
                    }
                    .padding(.vertical, 8)
                }
            )
            .padding(.horizontal, 4)

            Spacer()
        }
    }

    func previewVoice(_ voiceId: String) {
        currentlyPlayingVoice = voiceId
        previewError = nil
        Task {
            do {
                let audioData = try await generateOpenAISpeech(
                    text: "Hi, I'm \(voiceId). Nice to meet you!",
                    voice: voiceId
                )
                await playAudioData(audioData)
            } catch {
                await MainActor.run {
                    previewError = "Preview failed: \(error.localizedDescription)"
                }
            }
            await MainActor.run {
                currentlyPlayingVoice = nil
            }
        }
    }

    func playTestText() {
        isTesting = true
        previewError = nil
        Task {
            do {
                let audioData = try await generateOpenAISpeech(
                    text: testText,
                    voice: config.openaiVoice
                )
                await playAudioData(audioData)
            } catch {
                await MainActor.run {
                    previewError = "Playback failed: \(error.localizedDescription)"
                }
            }
            await MainActor.run {
                isTesting = false
            }
        }
    }

    func generateOpenAISpeech(text: String, voice: String) async throws -> Data {
        let url = URL(string: "https://api.openai.com/v1/audio/speech")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(config.openaiApiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "model": "tts-1",
            "input": text,
            "voice": voice,
            "response_format": "mp3"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "OpenAI", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(domain: "OpenAI", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "API error (\(httpResponse.statusCode)): \(errorMessage)"])
        }

        return data
    }

    @MainActor
    func playAudioData(_ data: Data) async {
        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.prepareToPlay()
            audioPlayer?.play()

            // Wait for playback to complete
            while audioPlayer?.isPlaying == true {
                try await Task.sleep(nanoseconds: 100_000_000) // 100ms
            }
        } catch {
            previewError = "Audio playback error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Glass Section Component

struct GlassSection<Content: View>: View {
    @Environment(\.theme) var theme
    let title: String
    let icon: String
    let color: Color  // kept for API compatibility
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(theme.surface)
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(theme.textSecondary)
                }
                Text(title)
                    .font(.headline)
                    .foregroundColor(theme.text)
            }
            content
        }
        .padding(18)
        .glassBackground(cornerRadius: 20, intensity: .regular)
    }
}

struct VoiceRow: View {
    @Environment(\.theme) var theme
    let id: String
    let name: String
    let description: String
    let isSelected: Bool
    let isPlaying: Bool
    let isDisabled: Bool
    let onSelect: () -> Void
    let onPreview: () -> Void

    var body: some View {
        HStack {
            Button(action: onSelect) {
                HStack(spacing: 10) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .foregroundColor(isSelected ? theme.text : theme.textTertiary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .fontWeight(isSelected ? .semibold : .regular)
                            .foregroundColor(theme.text)
                        Text(description)
                            .font(.caption)
                            .foregroundColor(theme.textTertiary)
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer()

            Button(action: onPreview) {
                if isPlaying {
                    ProgressView()
                        .scaleEffect(0.6)
                } else {
                    Image(systemName: "play.circle.fill")
                        .foregroundColor(theme.textSecondary)
                }
            }
            .buttonStyle(.flat)
            .disabled(isDisabled || isPlaying)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .glassBackground(cornerRadius: 12, intensity: isSelected ? .regular : .subtle)
    }
}

// MARK: - ElevenLabs Playground View

struct ElevenLabsPlaygroundView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @State private var showApiKey = false
    @State private var testText = "Hello! This is a test of the ElevenLabs text-to-speech voice."
    @State private var isTesting = false
    @State private var voices: [ElevenLabsVoice] = []
    @State private var isLoadingVoices = false
    @State private var voicesError: String?
    @State private var currentlyPlayingVoice: String?
    @State private var audioPlayer: AVAudioPlayer?

    struct ElevenLabsVoice: Identifiable, Codable, Hashable {
        let voice_id: String
        let name: String
        let category: String?
        let description: String?
        var id: String { voice_id }

        init(voice_id: String, name: String, category: String? = nil, description: String? = nil) {
            self.voice_id = voice_id
            self.name = name
            self.category = category
            self.description = description
        }

        enum CodingKeys: String, CodingKey {
            case voice_id, name, category, description
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            voice_id = try container.decode(String.self, forKey: .voice_id)
            name = try container.decode(String.self, forKey: .name)
            category = try container.decodeIfPresent(String.self, forKey: .category)
            description = try container.decodeIfPresent(String.self, forKey: .description)
        }
    }

    struct VoicesResponse: Codable {
        let voices: [ElevenLabsVoice]
    }

    // Default ElevenLabs voices that are always available
    static let defaultVoices: [ElevenLabsVoice] = [
        ElevenLabsVoice(voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "premade", description: "Calm, young American female"),
        ElevenLabsVoice(voice_id: "29vD33N1CtxCmqQRPOHJ", name: "Drew", category: "premade", description: "Well-rounded American male"),
        ElevenLabsVoice(voice_id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", category: "premade", description: "War veteran, middle-aged American male"),
        ElevenLabsVoice(voice_id: "5Q0t7uMcjvnagumLfvZi", name: "Paul", category: "premade", description: "News reporter, middle-aged American male"),
        ElevenLabsVoice(voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "premade", description: "Strong, young American female"),
        ElevenLabsVoice(voice_id: "CYw3kZ02Hs0563khs1Fj", name: "Dave", category: "premade", description: "Conversational British-Essex male"),
        ElevenLabsVoice(voice_id: "D38z5RcWu1voky8WS1ja", name: "Fin", category: "premade", description: "Sailor, older Irish male"),
        ElevenLabsVoice(voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", category: "premade", description: "Soft, young American female"),
        ElevenLabsVoice(voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "premade", description: "Well-rounded, young American male"),
        ElevenLabsVoice(voice_id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas", category: "premade", description: "Calm, young American male"),
        ElevenLabsVoice(voice_id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", category: "premade", description: "Casual Australian male"),
        ElevenLabsVoice(voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George", category: "premade", description: "Warm British male"),
        ElevenLabsVoice(voice_id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily", category: "premade", description: "Calm American female"),
        ElevenLabsVoice(voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", category: "premade", description: "Emotional, young American female"),
        ElevenLabsVoice(voice_id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", category: "premade", description: "Hoarse, middle-aged American male"),
        ElevenLabsVoice(voice_id: "ODq5zmih8GrVes37Dizd", name: "Patrick", category: "premade", description: "Shouty, middle-aged American male"),
        ElevenLabsVoice(voice_id: "SOYHLrjzK2X1ezoPC6cr", name: "Harry", category: "premade", description: "Anxious, young American male"),
        ElevenLabsVoice(voice_id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", category: "premade", description: "Articulate, young American male"),
        ElevenLabsVoice(voice_id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", category: "premade", description: "Pleasant British female"),
        ElevenLabsVoice(voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "premade", description: "Deep, young American male"),
        ElevenLabsVoice(voice_id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "premade", description: "Crisp, middle-aged American male"),
        ElevenLabsVoice(voice_id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", category: "premade", description: "Seductive Swedish female"),
        ElevenLabsVoice(voice_id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", category: "premade", description: "Warm, young American female"),
        ElevenLabsVoice(voice_id: "Yko7PKHZNXotIFUBG7I9", name: "Matthew", category: "premade", description: "Audiobook, middle-aged British male"),
        ElevenLabsVoice(voice_id: "ZQe5CZNOzWyzPSCn5a3c", name: "James", category: "premade", description: "Calm Australian male"),
        ElevenLabsVoice(voice_id: "Zlb1dXrM653N07WRdFW3", name: "Joseph", category: "premade", description: "Articulate British male"),
        ElevenLabsVoice(voice_id: "bVMeCyTHy58xNoL34h3p", name: "Jeremy", category: "premade", description: "Irish male"),
        ElevenLabsVoice(voice_id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", category: "premade", description: "Expressive American female"),
        ElevenLabsVoice(voice_id: "cjVigY5qzO86Huf0OWal", name: "Eric", category: "premade", description: "Friendly American male"),
        ElevenLabsVoice(voice_id: "flq6f7yk4E4fJM5XTYuZ", name: "Michael", category: "premade", description: "Old American male"),
        ElevenLabsVoice(voice_id: "g5CIjZEefAph4nQFvHAz", name: "Ethan", category: "premade", description: "Young American male"),
        ElevenLabsVoice(voice_id: "iP95p4xoKVk53GoZ742B", name: "Chris", category: "premade", description: "Casual American male"),
        ElevenLabsVoice(voice_id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi", category: "premade", description: "Childlish American female"),
        ElevenLabsVoice(voice_id: "jsCqWAovK2LkecY7zXl4", name: "Freya", category: "premade", description: "Overhyped American female"),
        ElevenLabsVoice(voice_id: "nPczCjzI2devNBz1zQrb", name: "Brian", category: "premade", description: "Deep narrator, American male"),
        ElevenLabsVoice(voice_id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace", category: "premade", description: "Southern American female"),
        ElevenLabsVoice(voice_id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", category: "premade", description: "Deep authoritative British male"),
        ElevenLabsVoice(voice_id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", category: "premade", description: "Warm British female"),
        ElevenLabsVoice(voice_id: "pMsXgVXv3BLzUgSXRplE", name: "Serena", category: "premade", description: "Pleasant American female"),
        ElevenLabsVoice(voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "premade", description: "Deep narrator, American male"),
        ElevenLabsVoice(voice_id: "piTKgcLEGmPE4e6mEKli", name: "Nicole", category: "premade", description: "Soft American female"),
        ElevenLabsVoice(voice_id: "pqHfZKP75CvOlQylNhV4", name: "Bill", category: "premade", description: "Trustworthy American male"),
        ElevenLabsVoice(voice_id: "t0jbNlBVZ17f02VDIeMI", name: "Jessie", category: "premade", description: "Raspy American male"),
        ElevenLabsVoice(voice_id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "premade", description: "Raspy American male"),
        ElevenLabsVoice(voice_id: "z9fAnlkpzviPz146aGWa", name: "Glinda", category: "premade", description: "Witch-like American female"),
        ElevenLabsVoice(voice_id: "zrHiDhphv9ZnVXBqCLjz", name: "Mimi", category: "premade", description: "Childish Swedish female")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // API Key Section
            GlassSection(title: "API Key", icon: "key.fill", color: .purple) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        if showApiKey {
                            TextField("API Key", text: Binding(
                                get: { config.elevenlabsApiKey },
                                set: { config.elevenlabsApiKey = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .font(.system(.body, design: .monospaced))
                        } else {
                            SecureField("API Key", text: Binding(
                                get: { config.elevenlabsApiKey },
                                set: { config.elevenlabsApiKey = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                        }
                        Button(action: { showApiKey.toggle() }) {
                            Image(systemName: showApiKey ? "eye.slash" : "eye")
                        }
                        .buttonStyle(.glassCompat)
                    }
                    HStack {
                        Circle()
                            .fill(theme.text.opacity(config.elevenlabsApiKey.isEmpty ? 0.3 : 0.8))
                            .frame(width: 6, height: 6)
                        Text(config.elevenlabsApiKey.isEmpty ? "Not configured" : "Configured")
                            .font(.caption)
                            .foregroundColor(theme.textSecondary)
                        Spacer()
                        Link("Get API Key", destination: URL(string: "https://elevenlabs.io/app/settings/api-keys")!)
                            .font(.caption)
                    }
                }
            }

            // Voice Selection
            GlassSection(title: "Voice Selection", icon: "waveform", color: .purple) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        TextField("Voice ID", text: Binding(
                            get: { config.elevenlabsVoiceId },
                            set: { config.elevenlabsVoiceId = $0 }
                        ))
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.body, design: .monospaced))

                        Button(action: loadVoices) {
                            if isLoadingVoices {
                                ProgressView()
                                    .scaleEffect(0.7)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                        }
                        .buttonStyle(.glassCompat)
                        .disabled(config.elevenlabsApiKey.isEmpty || isLoadingVoices)
                    }

                    // Show current voice name if found
                    if let currentVoice = allVoices.first(where: { $0.voice_id == config.elevenlabsVoiceId }) {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(theme.text.opacity(0.8))
                            Text("Selected: \(currentVoice.name)")
                                .font(.caption)
                                .foregroundColor(theme.text.opacity(0.8))
                            if let desc = currentVoice.description {
                                Text("• \(desc)")
                                    .font(.caption)
                                    .foregroundColor(theme.textTertiary)
                            }
                        }
                    }

                    // User's custom voices
                    if !voices.isEmpty {
                        Text("Your Voices")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(theme.textSecondary)
                            .padding(.top, 4)

                        ScrollView {
                            VStack(spacing: 6) {
                                ForEach(voices) { voice in
                                    ElevenLabsVoiceRow(
                                        voice: voice,
                                        isSelected: config.elevenlabsVoiceId == voice.voice_id,
                                        isPlaying: currentlyPlayingVoice == voice.voice_id,
                                        isDisabled: currentlyPlayingVoice != nil || config.elevenlabsApiKey.isEmpty
                                    ) {
                                        config.elevenlabsVoiceId = voice.voice_id
                                    } onPreview: {
                                        previewVoice(voice)
                                    }
                                }
                            }
                        }
                        .frame(maxHeight: 120)
                    }

                    // Default voices section
                    Text("Popular Voices (\(Self.defaultVoices.count) available)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(theme.textSecondary)
                        .padding(.top, 4)

                    ScrollView {
                        VStack(spacing: 6) {
                            ForEach(Self.defaultVoices) { voice in
                                ElevenLabsVoiceRow(
                                    voice: voice,
                                    isSelected: config.elevenlabsVoiceId == voice.voice_id,
                                    isPlaying: currentlyPlayingVoice == voice.voice_id,
                                    isDisabled: currentlyPlayingVoice != nil || config.elevenlabsApiKey.isEmpty
                                ) {
                                    config.elevenlabsVoiceId = voice.voice_id
                                } onPreview: {
                                    previewVoice(voice)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 200)

                    if let error = voicesError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(theme.textSecondary)
                    }

                    Link("Browse Voice Library", destination: URL(string: "https://elevenlabs.io/voice-library")!)
                        .font(.caption)
                }
            }

            // Playground
            GlassSection(title: "Playground", icon: "play.circle.fill", color: .purple) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Test Text")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextEditor(text: $testText)
                        .frame(height: 60)
                        .font(.system(.body))
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .glassBackground(cornerRadius: 8)

                    HStack {
                        Button(action: playTestText) {
                            HStack {
                                if isTesting {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                } else {
                                    Image(systemName: "play.fill")
                                }
                                Text("Play")
                            }
                        }
                        .buttonStyle(.glassProminentCompat)
                        .disabled(config.elevenlabsApiKey.isEmpty || isTesting || testText.isEmpty)

                        Spacer()
                    }
                }
            }

            Spacer()
        }
        .onAppear {
            if !config.elevenlabsApiKey.isEmpty && voices.isEmpty {
                loadVoices()
            }
        }
    }

    // Computed property to combine user voices and default voices
    var allVoices: [ElevenLabsVoice] {
        var combined = voices
        for defaultVoice in Self.defaultVoices {
            if !combined.contains(where: { $0.voice_id == defaultVoice.voice_id }) {
                combined.append(defaultVoice)
            }
        }
        return combined
    }

    struct ElevenLabsVoiceRow: View {
        @Environment(\.theme) var theme
        let voice: ElevenLabsVoice
        let isSelected: Bool
        let isPlaying: Bool
        let isDisabled: Bool
        let onSelect: () -> Void
        let onPreview: () -> Void

        var body: some View {
            HStack {
                Button(action: onSelect) {
                    HStack(spacing: 10) {
                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(isSelected ? theme.text : theme.textTertiary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(voice.name)
                                .fontWeight(isSelected ? .semibold : .regular)
                                .foregroundColor(theme.text)
                            if let description = voice.description {
                                Text(description)
                                    .font(.caption)
                                    .foregroundColor(theme.textTertiary)
                            }
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: onPreview) {
                    if isPlaying {
                        ProgressView()
                            .scaleEffect(0.6)
                    } else {
                        Image(systemName: "play.circle.fill")
                            .foregroundColor(theme.textSecondary)
                    }
                }
                .buttonStyle(.flat)
                .disabled(isDisabled)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .glassBackground(cornerRadius: 12, intensity: isSelected ? .regular : .subtle)
        }
    }

    func loadVoices() {
        isLoadingVoices = true
        voicesError = nil

        Task {
            do {
                var request = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/voices")!)
                request.setValue(config.elevenlabsApiKey, forHTTPHeaderField: "xi-api-key")

                let (data, response) = try await URLSession.shared.data(for: request)

                guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                    throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch voices"])
                }

                let decoded = try JSONDecoder().decode(VoicesResponse.self, from: data)
                await MainActor.run {
                    voices = decoded.voices
                    isLoadingVoices = false
                }
            } catch {
                await MainActor.run {
                    voicesError = "Failed to load voices: \(error.localizedDescription)"
                    isLoadingVoices = false
                }
            }
        }
    }

    func previewVoice(_ voice: ElevenLabsVoice) {
        currentlyPlayingVoice = voice.voice_id
        Task {
            do {
                let audioData = try await generateSpeech(
                    text: "Hello! I'm \(voice.name).",
                    voiceId: voice.voice_id
                )
                await playAudioData(audioData)
            } catch {
                await MainActor.run {
                    voicesError = "Preview failed: \(error.localizedDescription)"
                }
            }
            await MainActor.run {
                currentlyPlayingVoice = nil
            }
        }
    }

    func playTestText() {
        isTesting = true
        Task {
            do {
                let audioData = try await generateSpeech(
                    text: testText,
                    voiceId: config.elevenlabsVoiceId
                )
                await playAudioData(audioData)
            } catch {
                await MainActor.run {
                    voicesError = "Playback failed: \(error.localizedDescription)"
                }
            }
            await MainActor.run {
                isTesting = false
            }
        }
    }

    func generateSpeech(text: String, voiceId: String) async throws -> Data {
        let url = URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voiceId)")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(config.elevenlabsApiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("audio/mpeg", forHTTPHeaderField: "Accept")

        let body: [String: Any] = [
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": [
                "stability": 0.5,
                "similarity_boost": 0.75
            ]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "ElevenLabs", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        if httpResponse.statusCode != 200 {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(domain: "ElevenLabs", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "API error (\(httpResponse.statusCode)): \(errorMessage)"])
        }

        return data
    }

    @MainActor
    func playAudioData(_ data: Data) async {
        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.prepareToPlay()
            audioPlayer?.play()

            // Wait for playback to complete
            while audioPlayer?.isPlaying == true {
                try await Task.sleep(nanoseconds: 100_000_000) // 100ms
            }
        } catch {
            voicesError = "Audio playback error: \(error.localizedDescription)"
        }
    }
}

// MARK: - System Settings View

struct SystemSettingsView: View {
    @EnvironmentObject var config: ConfigManager
    @State private var availableVoices: [String] = []
    @State private var isTesting = false
    @State private var testText = "Hello! This is a test of the macOS system voice."

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            GlassSection(title: "Voice Selection", icon: "desktopcomputer", color: .blue) {
                VStack(alignment: .leading, spacing: 12) {
                    if availableVoices.isEmpty {
                        HStack {
                            TextField("Voice Name", text: Binding(
                                get: { config.systemVoice },
                                set: { config.systemVoice = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)

                            Button("Load Voices") {
                                loadVoices()
                            }
                            .buttonStyle(.glassCompat)
                        }
                    } else {
                        Picker("Voice", selection: Binding(
                            get: { config.systemVoice },
                            set: { config.systemVoice = $0 }
                        )) {
                            ForEach(availableVoices, id: \.self) { voice in
                                Text(voice).tag(voice)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    Text("Uses macOS 'say' command - always available, no API key needed")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            GlassSection(title: "Playground", icon: "play.circle.fill", color: .blue) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Test Text")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextEditor(text: $testText)
                        .frame(height: 60)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .glassBackground(cornerRadius: 8)

                    HStack {
                        Button(action: playTestText) {
                            HStack {
                                if isTesting {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                } else {
                                    Image(systemName: "play.fill")
                                }
                                Text("Play")
                            }
                        }
                        .buttonStyle(.glassProminentCompat)
                        .disabled(isTesting || testText.isEmpty)

                        Spacer()

                        Text("Voice: \(config.systemVoice)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()
        }
        .onAppear {
            loadVoices()
        }
    }

    func loadVoices() {
        Task {
            let process = Process()
            let pipe = Pipe()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
            process.arguments = ["-v", "?"]
            process.standardOutput = pipe
            try? process.run()
            process.waitUntilExit()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                let voices = output.components(separatedBy: "\n")
                    .compactMap { line -> String? in
                        let parts = line.components(separatedBy: " ")
                        return parts.first?.isEmpty == false ? parts.first : nil
                    }
                await MainActor.run {
                    availableVoices = voices
                }
            }
        }
    }

    func playTestText() {
        isTesting = true
        Task {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
            process.arguments = ["-v", config.systemVoice, testText]
            try? process.run()
            process.waitUntilExit()
            await MainActor.run {
                isTesting = false
            }
        }
    }
}

// MARK: - Cache Management View

struct CacheManagementView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @State private var cacheSize: String = "Calculating..."
    @State private var cacheFileCount: Int = 0
    @State private var isClearing = false

    let ttlOptions = ["1h", "1d", "7d", "30d", "90d"]
    let cacheDir = "/tmp/speakeasy-cache"

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Cache Stats
            GlassSection(title: "Cache Statistics", icon: "chart.bar.fill", color: .cyan) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Cache Size")
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                            Text(cacheSize)
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.text)
                        }
                        .padding(12)
                        .glassBackground(cornerRadius: 10, intensity: .subtle)

                        Spacer()

                        VStack(alignment: .trailing) {
                            Text("Cached Files")
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                            Text("\(cacheFileCount)")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.text)
                        }
                        .padding(12)
                        .glassBackground(cornerRadius: 10, intensity: .subtle)
                    }

                    HStack {
                        Button(action: refreshCacheStats) {
                            Label("Refresh", systemImage: "arrow.clockwise")
                                .foregroundColor(theme.text.opacity(0.9))
                        }
                        .buttonStyle(.glassCompat)

                        Spacer()

                        Button(action: openCacheFolder) {
                            Label("Open Folder", systemImage: "folder")
                                .foregroundColor(theme.text.opacity(0.9))
                        }
                        .buttonStyle(.glassCompat)
                    }
                }
            }

            // Cache Settings
            GlassSection(title: "Cache Settings", icon: "gearshape.fill", color: .cyan) {
                VStack(alignment: .leading, spacing: 16) {
                    Toggle("Enable Cache", isOn: Binding(
                        get: { config.cacheEnabled },
                        set: { config.cacheEnabled = $0 }
                    ))
                    .toggleStyle(.switch)

                    if config.cacheEnabled {
                        HStack {
                            Text("Cache Duration")
                            Spacer()
                            Picker("", selection: Binding(
                                get: { config.cacheTTL },
                                set: { config.cacheTTL = $0 }
                            )) {
                                ForEach(ttlOptions, id: \.self) { ttl in
                                    Text(formatTTL(ttl)).tag(ttl)
                                }
                            }
                            .frame(width: 120)
                        }
                    }

                    Text("Caching stores generated audio locally to reduce API calls and improve response time")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Clear Cache
            GlassSection(title: "Manage Cache", icon: "trash.fill", color: .red) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Clear all cached audio files to free up disk space")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Button(action: clearCache) {
                        HStack {
                            if isClearing {
                                ProgressView()
                                    .scaleEffect(0.7)
                            } else {
                                Image(systemName: "trash")
                            }
                            Text("Clear Cache")
                        }
                    }
                    .buttonStyle(.glassCompat)
                    .disabled(isClearing)
                }
            }

            Spacer()
        }
        .onAppear {
            refreshCacheStats()
        }
    }

    func refreshCacheStats() {
        Task {
            let fileManager = FileManager.default
            var totalSize: Int64 = 0
            var fileCount = 0

            if let enumerator = fileManager.enumerator(atPath: cacheDir) {
                while let file = enumerator.nextObject() as? String {
                    let filePath = (cacheDir as NSString).appendingPathComponent(file)
                    if let attributes = try? fileManager.attributesOfItem(atPath: filePath),
                       let size = attributes[.size] as? Int64 {
                        totalSize += size
                        fileCount += 1
                    }
                }
            }

            await MainActor.run {
                cacheFileCount = fileCount
                cacheSize = formatBytes(totalSize)
            }
        }
    }

    func clearCache() {
        isClearing = true
        Task {
            let fileManager = FileManager.default
            if fileManager.fileExists(atPath: cacheDir) {
                try? fileManager.removeItem(atPath: cacheDir)
                try? fileManager.createDirectory(atPath: cacheDir, withIntermediateDirectories: true)
            }
            await MainActor.run {
                isClearing = false
                refreshCacheStats()
            }
        }
    }

    func openCacheFolder() {
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: cacheDir)
    }

    func formatTTL(_ ttl: String) -> String {
        switch ttl {
        case "1h": return "1 Hour"
        case "1d": return "1 Day"
        case "7d": return "7 Days"
        case "30d": return "30 Days"
        case "90d": return "90 Days"
        default: return ttl
        }
    }

    func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - HUD Settings View

struct HUDSettingsView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            GlassSection(title: "HUD Settings", icon: "square.stack.3d.up.fill", color: .purple) {
                VStack(alignment: .leading, spacing: 16) {
                    // Enable/Disable HUD
                    Toggle(isOn: $config.hudEnabled) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Enable HUD")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Text("Show a floating notification when audio plays")
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                        }
                    }
                    .toggleStyle(.switch)

                    if config.hudEnabled {
                        Divider()
                            .background(theme.border)

                        // Position
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Position")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textSecondary)

                            Picker("Position", selection: $config.hudPosition) {
                                Text("Top Left").tag("top-left")
                                Text("Top Right").tag("top-right")
                                Text("Bottom Left").tag("bottom-left")
                                Text("Bottom Right").tag("bottom-right")
                            }
                            .pickerStyle(.segmented)
                        }

                        // Duration
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Display Duration")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textSecondary)

                            HStack {
                                Slider(value: Binding(
                                    get: { Double(config.hudDuration) },
                                    set: { config.hudDuration = Int($0) }
                                ), in: 1000...10000, step: 500)

                                Text("\(config.hudDuration / 1000)s")
                                    .font(.caption)
                                    .foregroundColor(theme.textSecondary)
                                    .frame(width: 40)
                            }
                        }

                        // Opacity
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Opacity")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textSecondary)

                            HStack {
                                Slider(value: $config.hudOpacity, in: 0.5...1.0, step: 0.05)

                                Text("\(Int(config.hudOpacity * 100))%")
                                    .font(.caption)
                                    .foregroundColor(theme.textSecondary)
                                    .frame(width: 40)
                            }
                        }

                        Divider()
                            .background(theme.border)

                        // Preview and Test buttons
                        HStack(spacing: 12) {
                            Button(action: openPreviewWindow) {
                                Label("Preview Styles", systemImage: "eye.circle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.glassCompat)

                            Button(action: testHUD) {
                                Label("Test HUD", systemImage: "play.circle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.glassCompat)
                        }
                    }
                }
            }

            // Appearance settings (only show when HUD is enabled)
            if config.hudEnabled {
                GlassSection(title: "Appearance", icon: "paintbrush.fill", color: .pink) {
                    VStack(alignment: .leading, spacing: 16) {
                        // Style selector
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Style")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textSecondary)

                            Picker("Style", selection: $config.hudStyle) {
                                Text("Combined").tag("combined")
                                Text("Waveform").tag("waveform")
                                Text("Spectrum").tag("spectrum")
                                Text("Particles").tag("particles")
                                Text("Text").tag("text")
                            }
                            .pickerStyle(.segmented)
                        }

                        Divider().background(theme.border)

                        // Waveform Settings
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Waveform")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textSecondary)

                            // Bar count
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("Bar Count")
                                        .font(.caption2)
                                        .foregroundColor(theme.textSecondary)
                                    Spacer()
                                    Text("\(config.hudWaveformBarCount)")
                                        .font(.caption2.monospacedDigit())
                                        .foregroundColor(theme.textSecondary)
                                }
                                Slider(value: Binding(
                                    get: { Double(config.hudWaveformBarCount) },
                                    set: { config.hudWaveformBarCount = Int($0) }
                                ), in: 20...60, step: 5)
                            }

                            // Amplitude
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text("Amplitude")
                                        .font(.caption2)
                                        .foregroundColor(theme.textSecondary)
                                    Spacer()
                                    Text(String(format: "%.1fx", config.hudWaveformAmplitude))
                                        .font(.caption2.monospacedDigit())
                                        .foregroundColor(theme.textSecondary)
                                }
                                Slider(value: $config.hudWaveformAmplitude, in: 0.5...2.0, step: 0.1)
                            }

                            // Color
                            HStack {
                                Text("Color")
                                    .font(.caption2)
                                    .foregroundColor(theme.textSecondary)
                                Spacer()
                                Picker("", selection: $config.hudWaveformColor) {
                                    Label("White", systemImage: "circle.fill").tag("white")
                                        .foregroundColor(.white)
                                    Label("Blue", systemImage: "circle.fill").tag("blue")
                                        .foregroundColor(.blue)
                                    Label("Purple", systemImage: "circle.fill").tag("purple")
                                        .foregroundColor(.purple)
                                    Label("Green", systemImage: "circle.fill").tag("green")
                                        .foregroundColor(.green)
                                    Label("Orange", systemImage: "circle.fill").tag("orange")
                                        .foregroundColor(.orange)
                                    Label("Cyan", systemImage: "circle.fill").tag("cyan")
                                        .foregroundColor(.cyan)
                                    Label("Pink", systemImage: "circle.fill").tag("pink")
                                        .foregroundColor(.pink)
                                }
                                .pickerStyle(.menu)
                                .frame(width: 120)
                            }
                        }

                        Divider().background(theme.border)

                        // Text Settings
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Text")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.textSecondary)

                            // Font
                            HStack {
                                Text("Font")
                                    .font(.caption2)
                                    .foregroundColor(theme.textSecondary)
                                Spacer()
                                Picker("", selection: $config.hudTextFont) {
                                    Text("System").tag("system")
                                    Text("Monospace").tag("mono")
                                    Text("Serif").tag("serif")
                                    Text("Rounded").tag("rounded")
                                }
                                .pickerStyle(.menu)
                                .frame(width: 120)
                            }

                            // Size
                            HStack {
                                Text("Size")
                                    .font(.caption2)
                                    .foregroundColor(theme.textSecondary)
                                Spacer()
                                Picker("", selection: $config.hudTextSize) {
                                    Text("Extra Small").tag("xs")
                                    Text("Small").tag("sm")
                                    Text("Medium").tag("md")
                                    Text("Large").tag("lg")
                                    Text("Extra Large").tag("xl")
                                }
                                .pickerStyle(.menu)
                                .frame(width: 120)
                            }
                        }
                    }
                }
            }

            // Info section
            GlassSection(title: "How It Works", icon: "info.circle.fill", color: .blue) {
                VStack(alignment: .leading, spacing: 12) {
                    InfoRow(
                        icon: "terminal",
                        title: "CLI Integration",
                        description: "When SpeakEasy CLI plays audio, it sends a notification to the HUD"
                    )

                    InfoRow(
                        icon: "pipe.and.drop.fill",
                        title: "Named Pipe",
                        description: "Uses a Unix named pipe at /tmp/speakeasy-hud.fifo for IPC"
                    )

                    InfoRow(
                        icon: "sparkles",
                        title: "Non-Blocking",
                        description: "CLI continues immediately if HUD isn't running - no delays"
                    )
                }
            }
        }
    }

    private func openPreviewWindow() {
        PreviewWindowManager.shared.showPreview()
    }

    private func testHUD() {
        // Write a test message to the pipe
        let testMessage = """
        {"text":"This is a test of the HUD overlay system!","provider":"system","cached":false,"timestamp":\(Date().timeIntervalSince1970)}
        """

        DispatchQueue.global(qos: .userInitiated).async {
            let pipePath = "/tmp/speakeasy-hud.fifo"

            // Try to write to pipe (non-blocking)
            guard let data = (testMessage + "\n").data(using: .utf8) else { return }

            if let fileHandle = FileHandle(forWritingAtPath: pipePath) {
                fileHandle.write(data)
                fileHandle.closeFile()
            }
        }
    }
}

struct InfoRow: View {
    @Environment(\.theme) var theme
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(theme.text.opacity(0.6))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(theme.text)

                Text(description)
                    .font(.caption)
                    .foregroundColor(theme.textSecondary)
            }
        }
    }
}

// MARK: - HUD Preview Window

import AVFoundation

enum HUDStyleType {
    case flowingText
    case stackedText
    case minimalWave
    case particleField
    case spectrum
    case combined
}

class AudioPreviewPlayer: ObservableObject {
    @Published var isPlaying = false
    @Published var currentTime: TimeInterval = 0
    @Published var duration: TimeInterval = 0
    @Published var audioLevel: Float = 0 // 0.0 to 1.0, smoothed

    private var audioPlayer: AVAudioPlayer?
    private var timer: Timer?
    private var rawAudioLevel: Float = 0
    private let smoothingFactor: Float = 0.3 // Higher = more smoothing

    let sampleText = "In SpeakEasy, Claude needs your permission to run bash commands. This allows the assistant to execute terminal operations, manage files, and interact with your development environment."

    var words: [String] {
        sampleText.components(separatedBy: " ")
    }

    var currentWordIndex: Int {
        guard duration > 0 else { return 0 }
        let progress = currentTime / duration
        return min(Int(Double(words.count) * progress), words.count - 1)
    }

    init() {
        setupAudio()
    }

    private func setupAudio() {
        // Try to load from Resources or use system voice fallback
        if let audioPath = Bundle.main.path(forResource: "hud-preview-sample", ofType: "aiff") {
            do {
                audioPlayer = try AVAudioPlayer(contentsOf: URL(fileURLWithPath: audioPath))
                audioPlayer?.prepareToPlay()
                audioPlayer?.isMeteringEnabled = true
                duration = audioPlayer?.duration ?? 0
            } catch {
                print("Failed to load audio: \(error)")
                generateAudioFallback()
            }
        } else {
            generateAudioFallback()
        }
    }

    private func generateAudioFallback() {
        // Use /tmp file we generated
        if let audioPlayer = try? AVAudioPlayer(contentsOf: URL(fileURLWithPath: "/tmp/hud-preview-sample.aiff")) {
            self.audioPlayer = audioPlayer
            audioPlayer.prepareToPlay()
            audioPlayer.isMeteringEnabled = true
            duration = audioPlayer.duration
        }
    }

    func play() {
        guard let player = audioPlayer else { return }
        player.play()
        isPlaying = true

        timer = Timer.scheduledTimer(withTimeInterval: 0.03, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.currentTime = player.currentTime

            // Update audio level with smoothing
            player.updateMeters()
            let averagePower = player.averagePower(forChannel: 0)
            // Convert from dB (-160 to 0) to 0.0-1.0
            let normalized = pow(10, averagePower / 20)
            self.rawAudioLevel = max(0, min(1, normalized))

            // Apply exponential smoothing
            self.audioLevel = self.audioLevel * (1 - self.smoothingFactor) + self.rawAudioLevel * self.smoothingFactor

            if !player.isPlaying {
                self.stop()
            }
        }
    }

    func pause() {
        audioPlayer?.pause()
        isPlaying = false
        timer?.invalidate()
    }

    func stop() {
        audioPlayer?.stop()
        audioPlayer?.currentTime = 0
        currentTime = 0
        audioLevel = 0
        rawAudioLevel = 0
        isPlaying = false
        timer?.invalidate()
    }

    func seek(to time: TimeInterval) {
        audioPlayer?.currentTime = time
        currentTime = time
    }
}

class HUDPreviewController: ObservableObject {
    let player: AudioPreviewPlayer
    @Published var selectedStyle: HUDStyleType = .combined
    @Published var showHUD = false

    private var hudWindow: NSWindow?

    init(player: AudioPreviewPlayer) {
        self.player = player
    }

    func toggleHUD() {
        if showHUD {
            hideHUD()
        } else {
            createHUD()
        }
    }

    private func createHUD() {
        guard let screen = NSScreen.main else { return }

        let window = NSWindow(
            contentRect: screen.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.isOpaque = false
        window.backgroundColor = .clear
        window.ignoresMouseEvents = true
        window.hasShadow = false
        window.animationBehavior = .none

        let hostingView = NSHostingView(rootView:
            LiveHUDView(player: player)
                .environmentObject(self)
        )
        window.contentView = hostingView
        window.orderFrontRegardless()

        hudWindow = window
        showHUD = true
    }

    func hideHUD() {
        hudWindow?.orderOut(nil)
        hudWindow = nil
        showHUD = false
    }

    func cleanup() {
        player.stop()
        hideHUD()
    }
}

// MARK: - Preview Window Manager (Singleton to prevent crash)

class PreviewWindowManager {
    static let shared = PreviewWindowManager()

    private var previewWindow: NSWindow?
    private var controller: HUDPreviewController?
    private var isClosing = false

    private init() {}

    func showPreview() {
        // Reuse existing window if available and not closing
        if let window = previewWindow, !isClosing {
            window.makeKeyAndOrderFront(nil)
            return
        }

        // Wait if currently closing
        if isClosing { return }

        let player = AudioPreviewPlayer()
        let ctrl = HUDPreviewController(player: player)
        self.controller = ctrl

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 200),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "HUD Preview"
        window.animationBehavior = .none  // Disable animations
        window.isReleasedWhenClosed = false  // Keep window alive
        window.contentView = NSHostingView(rootView:
            HUDPreviewControlPanel(controller: ctrl)
                .environmentObject(ConfigManager.shared)
        )
        window.center()
        window.makeKeyAndOrderFront(nil)

        // Watch for window close - use didEndSheet to ensure animations complete
        NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification,
            object: window,
            queue: .main
        ) { [weak self] notification in
            guard let self = self,
                  let closingWindow = notification.object as? NSWindow,
                  closingWindow === self.previewWindow else { return }
            self.handleWindowClose()
        }

        self.previewWindow = window
    }

    private func handleWindowClose() {
        guard !isClosing else { return }
        isClosing = true

        // Cleanup audio first
        controller?.cleanup()

        // Clear references after a delay to let animations complete
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self else { return }
            // Remove observer
            if let window = self.previewWindow {
                NotificationCenter.default.removeObserver(self, name: NSWindow.willCloseNotification, object: window)
            }
            self.controller = nil
            self.previewWindow = nil
            self.isClosing = false
        }
    }
}

struct HUDPreviewControlPanel: View {
    @ObservedObject var controller: HUDPreviewController
    @Environment(\.theme) var theme

    var body: some View {
        VStack(spacing: 16) {
            // Style Selector - horizontal tabs
            HStack(spacing: 0) {
                styleButton("Combined", style: .combined)
                styleButton("Wave", style: .minimalWave)
                styleButton("Spectrum", style: .spectrum)
                styleButton("Particles", style: .particleField)
                styleButton("Text", style: .flowingText)
                styleButton("Stacked", style: .stackedText)
            }
            .padding(4)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(theme.surface.opacity(0.5))
            )

            Divider().background(theme.border)

            // Audio Controls
            HStack(spacing: 16) {
                Button(action: togglePlayback) {
                    ZStack {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 44, height: 44)
                        Image(systemName: controller.player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 4) {
                    // Audio level bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(theme.surface)
                                .frame(height: 4)

                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.accentColor)
                                .frame(width: geometry.size.width * CGFloat(controller.player.audioLevel), height: 4)
                        }
                    }
                    .frame(height: 4)

                    // Time
                    HStack {
                        Text(formatTime(controller.player.currentTime))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(theme.text)
                        Text("/")
                            .font(.system(size: 11))
                            .foregroundColor(theme.textTertiary)
                        Text(formatTime(controller.player.duration))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(theme.textSecondary)
                    }
                }
            }

            Divider().background(theme.border)

            // HUD Toggle
            Button(action: { controller.toggleHUD() }) {
                HStack {
                    Image(systemName: controller.showHUD ? "eye.slash" : "eye")
                        .font(.system(size: 14))
                    Text(controller.showHUD ? "Hide HUD" : "Show HUD")
                        .font(.system(size: 13, weight: .medium))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(controller.showHUD ? Color.accentColor : theme.surface)
                )
                .foregroundColor(controller.showHUD ? .white : theme.text)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(width: 360, height: 200)
        .background(theme.background)
    }

    @ViewBuilder
    private func styleButton(_ name: String, style: HUDStyleType) -> some View {
        Button(action: { controller.selectedStyle = style }) {
            Text(name)
                .font(.system(size: 11, weight: controller.selectedStyle == style ? .semibold : .regular))
                .foregroundColor(controller.selectedStyle == style ? .white : theme.textSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(controller.selectedStyle == style ? Color.accentColor : Color.clear)
                )
        }
        .buttonStyle(.plain)
    }

    private func togglePlayback() {
        if controller.player.isPlaying {
            controller.player.pause()
        } else {
            controller.player.play()
        }
    }

    private func formatTime(_ time: TimeInterval) -> String {
        let minutes = Int(time) / 60
        let seconds = Int(time) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// Live HUD that appears as floating overlay
struct LiveHUDView: View {
    @ObservedObject var player: AudioPreviewPlayer
    @EnvironmentObject var controller: HUDPreviewController

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Group {
                    switch controller.selectedStyle {
                    case .flowingText:
                        FlowingTextHUDNew(
                            words: player.words,
                            currentIndex: player.currentWordIndex,
                            isPlaying: player.isPlaying,
                            audioLevel: player.audioLevel
                        )
                    case .stackedText:
                        StackedTextHUDNew(
                            words: player.words,
                            currentIndex: player.currentWordIndex,
                            isPlaying: player.isPlaying
                        )
                    case .minimalWave:
                        MinimalWaveHUDNew(
                            time: player.currentTime,
                            isPlaying: player.isPlaying,
                            audioLevel: player.audioLevel
                        )
                    case .particleField:
                        ParticleFieldHUDNew(
                            time: player.currentTime,
                            isPlaying: player.isPlaying,
                            audioLevel: player.audioLevel
                        )
                    case .spectrum:
                        SpectrumHUDNew(
                            time: player.currentTime,
                            isPlaying: player.isPlaying,
                            audioLevel: player.audioLevel
                        )
                    case .combined:
                        CombinedTextWaveHUD(
                            words: player.words,
                            currentIndex: player.currentWordIndex,
                            time: player.currentTime,
                            isPlaying: player.isPlaying,
                            audioLevel: player.audioLevel
                        )
                    }
                }
                .frame(width: 450, height: 120)
                .background(
                    ZStack {
                        // Super dark black background with thin transparency
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.black.opacity(0.85))
                        // Subtle border for definition
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                    }
                )
                .position(getHUDPosition(in: geometry.size))
            }
        }
        .ignoresSafeArea()
    }

    private func getHUDPosition(in size: CGSize) -> CGPoint {
        let padding: CGFloat = 20
        let menuBarHeight: CGFloat = 28
        let hudWidth: CGFloat = 450
        let hudHeight: CGFloat = 120

        // Top right by default
        return CGPoint(
            x: size.width - hudWidth / 2 - padding,
            y: hudHeight / 2 + padding + menuBarHeight
        )
    }
}

// MARK: - HUD Style Components

struct FlowingTextHUD: View {
    let words: [String]
    let currentIndex: Int
    let isPlaying: Bool

    var body: some View {
        ZStack {
            if currentIndex < words.count {
                VStack(spacing: 20) {
                    Text(words[currentIndex])
                        .font(.system(size: 60, weight: .thin, design: .rounded))
                        .foregroundColor(.white)
                        .transition(.asymmetric(
                            insertion: .scale.combined(with: .opacity),
                            removal: .opacity
                        ))
                        .id("word-\(currentIndex)")

                    HStack(spacing: 8) {
                        ForEach(max(0, currentIndex - 3)..<currentIndex, id: \.self) { index in
                            if index >= 0 && index < words.count {
                                Text(words[index])
                                    .font(.system(size: 16, weight: .light))
                                    .foregroundColor(.white.opacity(0.3 - Double(currentIndex - index) * 0.1))
                            }
                        }
                    }
                }
            }

            if !isPlaying && currentIndex == 0 {
                Text("Press play to start")
                    .font(.system(size: 24, weight: .thin))
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct MinimalWaveHUD: View {
    let phase: Double
    let isPlaying: Bool

    var body: some View {
        ZStack {
            MinimalWavePath(phase: phase, amplitude: isPlaying ? 1.0 : 0.2)
                .stroke(Color.white.opacity(0.9), lineWidth: 2)
                .frame(height: 100)

            if !isPlaying {
                Text("Press play to start")
                    .font(.system(size: 24, weight: .thin))
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct MinimalWavePath: Shape {
    var phase: Double
    var amplitude: Double

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(phase, amplitude) }
        set {
            phase = newValue.first
            amplitude = newValue.second
        }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let midHeight = height / 2
        let wavelength = width / 3
        let amp = height * 0.3 * amplitude

        path.move(to: CGPoint(x: 0, y: midHeight))

        for x in stride(from: 0, through: width, by: 2) {
            let relativeX = x / wavelength
            let normalizedPhase = phase / (.pi * 2)
            let sine = sin((relativeX + normalizedPhase) * .pi * 2)
            let y = midHeight + sine * amp
            path.addLine(to: CGPoint(x: x, y: y))
        }

        return path
    }
}

struct ParticleFieldHUD: View {
    let particlePhases: [Double]
    let isPlaying: Bool

    var body: some View {
        ZStack {
            ForEach(0..<50, id: \.self) { index in
                ParticleView(
                    index: index,
                    phase: particlePhases[index],
                    opacity: isPlaying ? 0.7 : 0.2
                )
            }

            if !isPlaying {
                Text("Press play to start")
                    .font(.system(size: 24, weight: .thin))
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ParticleView: View {
    let index: Int
    let phase: Double
    let opacity: Double

    var body: some View {
        Circle()
            .fill(Color.white.opacity(opacity * 0.6))
            .frame(width: CGFloat.random(in: 2...6), height: CGFloat.random(in: 2...6))
            .position(particlePosition)
            .blur(radius: 1)
    }

    private var particlePosition: CGPoint {
        let baseX = CGFloat(index % 10) * 90 + 40
        let baseY = CGFloat(index / 10) * 100 + 40

        let offsetX = sin(phase + Double(index) * 0.5) * 30
        let offsetY = cos(phase + Double(index) * 0.3) * 30

        return CGPoint(x: baseX + offsetX, y: baseY + offsetY)
    }
}

struct SpectrumHUD: View {
    let phase: Double
    let isPlaying: Bool

    var body: some View {
        ZStack {
            HStack(spacing: 4) {
                ForEach(0..<50, id: \.self) { index in
                    SpectrumBar(
                        index: index,
                        phase: phase,
                        multiplier: isPlaying ? 1.0 : 0.2
                    )
                }
            }
            .padding(.horizontal, 100)

            if !isPlaying {
                Text("Press play to start")
                    .font(.system(size: 24, weight: .thin))
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SpectrumBar: View {
    let index: Int
    let phase: Double
    let multiplier: Double

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Color.white.opacity(0.9))
            .frame(width: 8, height: barHeight)
    }

    private var barHeight: CGFloat {
        let normalizedIndex = Double(index) / 50.0
        let offset = normalizedIndex * .pi * 4
        let sine = sin(phase + offset)
        let normalized = (sine + 1) / 2
        return 20 + normalized * 200 * multiplier
    }
}

// MARK: - New Minimal HUD Styles (Audio-Reactive)

struct FlowingTextHUDNew: View {
    let words: [String]
    let currentIndex: Int
    let isPlaying: Bool
    let audioLevel: Float

    var body: some View {
        ZStack {
            if currentIndex < words.count && isPlaying {
                Text(words[currentIndex])
                    .font(.system(size: 42, weight: .ultraLight, design: .default))
                    .foregroundColor(.white.opacity(0.95))
                    .transition(.opacity)
                    .id("word-\(currentIndex)")
            } else if !isPlaying {
                Text("Show HUD Overlay to see visualization")
                    .font(.system(size: 16, weight: .ultraLight))
                    .foregroundColor(.white.opacity(0.4))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(.easeInOut(duration: 0.15), value: currentIndex)
    }
}

struct StackedTextHUDNew: View {
    let words: [String]
    let currentIndex: Int
    let isPlaying: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isPlaying {
                // Paragraph-style: words flow horizontally and wrap
                ParagraphFlowView(words: words, currentIndex: currentIndex)
            } else {
                Text("Show HUD Overlay to see visualization")
                    .font(.system(size: 14, weight: .ultraLight))
                    .foregroundColor(.white.opacity(0.4))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(16)
        .animation(.easeInOut(duration: 0.12), value: currentIndex)
    }
}

struct ParagraphFlowView: View {
    let words: [String]
    let currentIndex: Int

    // Show words from start up to current (building the paragraph)
    private var visibleWords: [(index: Int, word: String)] {
        guard currentIndex >= 0 else { return [] }
        let end = min(currentIndex + 1, words.count)
        return (0..<end).map { (index: $0, word: words[$0]) }
    }

    var body: some View {
        // Use a Text concatenation approach for natural wrapping
        visibleWords.reduce(Text("")) { result, item in
            let isCurrent = item.index == currentIndex
            let opacity = isCurrent ? 0.95 : max(0.3, 0.6 - Double(currentIndex - item.index) * 0.05)
            let weight: Font.Weight = isCurrent ? .medium : .light

            let wordText = Text(item.word)
                .font(.system(size: isCurrent ? 16 : 14, weight: weight))
                .foregroundColor(.white.opacity(opacity))

            let space = Text(" ")
                .font(.system(size: 14))
                .foregroundColor(.clear)

            return result + wordText + space
        }
        .lineSpacing(4)
        .multilineTextAlignment(.leading)
    }
}

struct MinimalWaveHUDNew: View {
    let time: TimeInterval
    let isPlaying: Bool
    let audioLevel: Float

    @State private var smoothedLevel: CGFloat = 0.2

    var body: some View {
        if isPlaying {
            TimelineView(.animation(minimumInterval: 0.016)) { timeline in
                Canvas { context, size in
                    let currentTime = timeline.date.timeIntervalSinceReferenceDate
                    let midY = size.height / 2

                    let targetLevel = CGFloat(audioLevel)
                    let level = max(0.2, smoothedLevel)

                    // Draw 3 layered waves
                    for waveIndex in 0..<3 {
                        let waveOffset = Double(waveIndex) * 0.3

                        var path = Path()
                        path.move(to: CGPoint(x: 0, y: midY))

                        let baseFrequency = 0.012
                        let baseSpeed = 1.5

                        // Amplitude expands with audio (baseline 15%, up to 40%)
                        let baseAmplitude = size.height * 0.12
                        let audioAmplitude = size.height * Double(level) * 0.28
                        let totalAmplitude = baseAmplitude + audioAmplitude

                        for x in stride(from: 0, through: size.width, by: 2) {
                            let phase = currentTime * baseSpeed + waveOffset

                            // Add subtle secondary wave for organic feel
                            let primary = sin((x * baseFrequency) + phase) * totalAmplitude
                            let secondary = sin((x * baseFrequency * 2.5) + phase * 1.3) * totalAmplitude * 0.15

                            let y = midY + primary + secondary
                            path.addLine(to: CGPoint(x: x, y: y))
                        }

                        let opacity = 0.4 - Double(waveIndex) * 0.1 + Double(level) * 0.4
                        context.stroke(path, with: .color(Color.white.opacity(opacity)), lineWidth: 1.5)
                    }

                    // Update smoothed level
                    DispatchQueue.main.async {
                        smoothedLevel = smoothedLevel * 0.85 + targetLevel * 0.15
                    }
                }
            }
        } else {
            ZStack {
                Text("Show HUD Overlay to see visualization")
                    .font(.system(size: 16, weight: .ultraLight))
                    .foregroundColor(.white.opacity(0.4))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct AudioReactiveSinePath: Shape {
    var time: TimeInterval
    var audioLevel: Float
    var offset: Double

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(time, Double(audioLevel)) }
        set {
            time = newValue.first
            audioLevel = Float(newValue.second)
        }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let midHeight = height / 2

        path.move(to: CGPoint(x: 0, y: midHeight))

        // Constant horizontal movement
        let baseFrequency = 0.015
        let baseSpeed = 1.5

        // Vertical amplitude expands with audio (baseline 15%, up to 40%)
        let baseAmplitude = height * 0.15
        let audioAmplitude = height * Double(audioLevel) * 0.25
        let totalAmplitude = baseAmplitude + audioAmplitude

        for x in stride(from: 0, through: width, by: 1) {
            let phase = time * baseSpeed + offset
            let y = midHeight + sin((x * baseFrequency) + phase) * totalAmplitude
            path.addLine(to: CGPoint(x: x, y: y))
        }

        return path
    }
}

struct SpectrumHUDNew: View {
    let time: TimeInterval
    let isPlaying: Bool
    let audioLevel: Float

    @State private var smoothedLevel: CGFloat = 0.2

    var body: some View {
        if isPlaying {
            TimelineView(.animation(minimumInterval: 0.016)) { timeline in
                Canvas { context, size in
                    let currentTime = timeline.date.timeIntervalSinceReferenceDate
                    let centerY = size.height / 2

                    let targetLevel = CGFloat(audioLevel)
                    let level = max(0.2, smoothedLevel)

                    let barCount = 40
                    let gap: CGFloat = 4
                    let totalGaps = CGFloat(barCount - 1) * gap
                    let barWidth = (size.width - totalGaps - 60) / CGFloat(barCount)

                    for i in 0..<barCount {
                        let x = 30 + CGFloat(i) * (barWidth + gap)

                        // Golden ratio seeding for unique per-bar character
                        let seed = Double(i) * 1.618033988749
                        let seedFrac = seed.truncatingRemainder(dividingBy: 1.0)

                        // Each bar has its own dance: multiple layered waves
                        // Primary rhythm - unique speed per bar
                        let primarySpeed = 4.0 + seedFrac * 3.0
                        let primaryPhase = seed * 0.7
                        let primary = sin(currentTime * primarySpeed + primaryPhase)

                        // Secondary rhythm - faster, subtle
                        let secondarySpeed = 7.0 + (1.0 - seedFrac) * 4.0
                        let secondaryPhase = seed * 1.3
                        let secondary = sin(currentTime * secondarySpeed + secondaryPhase) * 0.4

                        // Tertiary - very fast shimmer
                        let tertiarySpeed = 12.0 + seedFrac * 6.0
                        let tertiary = sin(currentTime * tertiarySpeed + seed * 2.1) * 0.2

                        // Combine waves
                        let combined = primary + secondary + tertiary
                        let normalized = (combined / 1.6 + 1) / 2 // Normalize to 0-1

                        // Baseline height that's always moving
                        let minHeight: CGFloat = 6
                        let baseRange: CGFloat = 20
                        let baseHeight = minHeight + (normalized * baseRange)

                        // Audio expands vertical amplitude per bar
                        let audioBoost = level * 45 * CGFloat(normalized)
                        let barHeight = baseHeight + audioBoost

                        let barRect = CGRect(
                            x: x,
                            y: centerY - barHeight / 2,
                            width: barWidth,
                            height: barHeight
                        )

                        // Opacity pulses per bar
                        let barOpacity = 0.5 + Double(level) * 0.35 + (normalized * 0.15)
                        context.fill(
                            RoundedRectangle(cornerRadius: 1.5).path(in: barRect),
                            with: .color(Color.white.opacity(barOpacity))
                        )
                    }

                    // Smooth audio level update
                    DispatchQueue.main.async {
                        smoothedLevel = smoothedLevel * 0.85 + targetLevel * 0.15
                    }
                }
            }
        } else {
            ZStack {
                Text("Show HUD Overlay to see visualization")
                    .font(.system(size: 16, weight: .ultraLight))
                    .foregroundColor(.white.opacity(0.4))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct ParticleFieldHUDNew: View {
    let time: TimeInterval
    let isPlaying: Bool
    let audioLevel: Float

    @State private var smoothedLevel: CGFloat = 0.2

    var body: some View {
        if isPlaying {
            TimelineView(.animation(minimumInterval: 0.016)) { timeline in
                Canvas { context, size in
                    let currentTime = timeline.date.timeIntervalSinceReferenceDate
                    let centerY = size.height / 2

                    // Smooth the audio level
                    let targetLevel = CGFloat(audioLevel)
                    let level = max(0.15, smoothedLevel)

                    let particleCount = 40

                    // CONSTANT horizontal speed - does NOT change with audio
                    let baseSpeed: CGFloat = 0.08
                    // CONSTANT wave speed - does NOT change with audio
                    let waveSpeed: CGFloat = 1.8
                    // Vertical amplitude EXPANDS with audio (the only audio-reactive parameter)
                    let baseAmplitude: CGFloat = 8
                    let audioAmplitude: CGFloat = level * 30  // expands up to 30px more
                    let totalAmplitude = baseAmplitude + audioAmplitude

                    for i in 0..<particleCount {
                        // Golden ratio seeding for each particle's unique journey
                        let seed = Double(i) * 1.618033988749
                        let seedFrac = seed.truncatingRemainder(dividingBy: 1.0)

                        // Horizontal flow - CONSTANT speed, unique per particle
                        let speedVar = CGFloat(seedFrac) * 0.04  // slight variation per particle
                        let speed = baseSpeed + speedVar  // but NO audio influence
                        let xProgress = (currentTime * Double(speed) + seed).truncatingRemainder(dividingBy: 1.0)
                        let x = CGFloat(xProgress) * size.width

                        // Each particle has its own sine wave journey
                        // Primary wave + secondary wave for organic feel
                        let primaryPhase = seed * 4
                        let secondaryPhase = seed * 7
                        let primaryWave = sin(currentTime * Double(waveSpeed) + primaryPhase)
                        let secondaryWave = sin(currentTime * Double(waveSpeed * 0.6) + secondaryPhase) * 0.3
                        let combinedWave = primaryWave + secondaryWave

                        // Vertical position: audio only affects AMPLITUDE, not speed
                        let y = centerY + CGFloat(combinedWave) * totalAmplitude

                        // Fixed particle size with seed variation
                        let particleSize: CGFloat = 2.5 + CGFloat(seedFrac) * 1.5

                        // Crisp white particles
                        let opacity = 0.7 + sin(seed * 3) * 0.25

                        let rect = CGRect(
                            x: x - particleSize / 2,
                            y: y - particleSize / 2,
                            width: particleSize,
                            height: particleSize
                        )
                        context.fill(Circle().path(in: rect), with: .color(Color.white.opacity(opacity)))
                    }

                    // Smooth level update
                    DispatchQueue.main.async {
                        smoothedLevel = smoothedLevel * 0.88 + targetLevel * 0.12
                    }
                }
            }
        } else {
            ZStack {
                Text("Show HUD Overlay to see visualization")
                    .font(.system(size: 16, weight: .light))
                    .foregroundColor(.white.opacity(0.5))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Combined Text + Waveform HUD

struct CombinedTextWaveHUD: View {
    let words: [String]
    let currentIndex: Int
    let time: TimeInterval
    let isPlaying: Bool
    let audioLevel: Float

    @State private var smoothedLevel: CGFloat = 0.2
    @ObservedObject private var config = ConfigManager.shared

    var body: some View {
        if isPlaying {
            VStack(spacing: 0) {
                // Text section at top (60% of height)
                CombinedTextSection(
                    words: words,
                    currentIndex: currentIndex,
                    font: config.hudTextFont,
                    size: config.hudTextSize
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Waveform at bottom (40% of height)
                CombinedWaveformSection(
                    audioLevel: audioLevel,
                    barCount: config.hudWaveformBarCount,
                    amplitudeMultiplier: config.hudWaveformAmplitude,
                    colorName: config.hudWaveformColor
                )
                .frame(height: 35)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
        } else {
            VStack(spacing: 8) {
                Text("Show HUD Overlay to see visualization")
                    .font(.system(size: 14, weight: .ultraLight))
                    .foregroundColor(.white.opacity(0.4))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct CombinedTextSection: View {
    let words: [String]
    let currentIndex: Int
    let font: String
    let size: String

    private var visibleWords: [(index: Int, word: String)] {
        guard currentIndex >= 0 else { return [] }
        let end = min(currentIndex + 1, words.count)
        return (0..<end).map { (index: $0, word: words[$0]) }
    }

    private var fontSize: CGFloat {
        switch size {
        case "xs": return 10
        case "sm": return 12
        case "md": return 14
        case "lg": return 16
        case "xl": return 18
        default: return 14
        }
    }

    private var fontDesign: Font.Design {
        switch font {
        case "mono": return .monospaced
        case "serif": return .serif
        case "rounded": return .rounded
        default: return .default
        }
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            visibleWords.reduce(Text("")) { result, item in
                let isCurrent = item.index == currentIndex
                let opacity = isCurrent ? 0.95 : max(0.3, 0.6 - Double(currentIndex - item.index) * 0.03)
                let weight: Font.Weight = isCurrent ? .medium : .light
                let currentSize = isCurrent ? fontSize + 2 : fontSize

                let wordText = Text(item.word)
                    .font(.system(size: currentSize, weight: weight, design: fontDesign))
                    .foregroundColor(.white.opacity(opacity))

                let space = Text(" ")
                    .font(.system(size: fontSize, design: fontDesign))
                    .foregroundColor(.clear)

                return result + wordText + space
            }
            .lineSpacing(3)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .animation(.easeInOut(duration: 0.1), value: currentIndex)
    }
}

struct CombinedWaveformSection: View {
    let audioLevel: Float
    let barCount: Int
    let amplitudeMultiplier: Double
    let colorName: String

    @State private var smoothedLevel: CGFloat = 0.2

    private var waveformColor: Color {
        switch colorName.lowercased() {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        case "orange": return .orange
        case "cyan": return .cyan
        case "pink": return .pink
        default:
            // Check for hex color
            if colorName.hasPrefix("#") {
                return Color(hex: colorName) ?? .white
            }
            return .white
        }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.016)) { timeline in
            Canvas { context, size in
                let currentTime = timeline.date.timeIntervalSinceReferenceDate
                let centerY = size.height / 2

                let targetLevel = CGFloat(audioLevel)
                let level = max(0.2, smoothedLevel)

                let effectiveBarCount = max(10, min(60, barCount))
                let gap: CGFloat = 3
                let totalGaps = CGFloat(effectiveBarCount - 1) * gap
                let barWidth = (size.width - totalGaps) / CGFloat(effectiveBarCount)

                for i in 0..<effectiveBarCount {
                    let x = CGFloat(i) * (barWidth + gap)

                    // Golden ratio seeding for unique per-bar character
                    let seed = Double(i) * 1.618033988749
                    let seedFrac = seed.truncatingRemainder(dividingBy: 1.0)

                    // Each bar has its own dance
                    let primarySpeed = 4.0 + seedFrac * 2.5
                    let primaryPhase = seed * 0.7
                    let primary = sin(currentTime * primarySpeed + primaryPhase)

                    let secondarySpeed = 7.0 + (1.0 - seedFrac) * 3.0
                    let secondary = sin(currentTime * secondarySpeed + seed * 1.3) * 0.3

                    let combined = primary + secondary
                    let normalized = (combined / 1.3 + 1) / 2

                    // Base height + audio-reactive expansion
                    let minHeight: CGFloat = 3
                    let baseRange: CGFloat = 8 * amplitudeMultiplier
                    let baseHeight = minHeight + (normalized * baseRange)
                    let audioBoost = level * 20 * CGFloat(normalized) * amplitudeMultiplier
                    let barHeight = baseHeight + audioBoost

                    let barRect = CGRect(
                        x: x,
                        y: centerY - barHeight / 2,
                        width: barWidth,
                        height: barHeight
                    )

                    let barOpacity = 0.5 + Double(level) * 0.35 + (normalized * 0.15)
                    context.fill(
                        RoundedRectangle(cornerRadius: 1).path(in: barRect),
                        with: .color(waveformColor.opacity(barOpacity))
                    )
                }

                DispatchQueue.main.async {
                    smoothedLevel = smoothedLevel * 0.85 + targetLevel * 0.15
                }
            }
        }
    }
}

// MARK: - Color Hex Extension

extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
