import AppKit
import Combine
import SwiftUI

/// Permanent menu-bar shell: status item, player popover, settings window,
/// and player IPC lifecycle. Popover content is `PlayerPopoverView` (shared engine).
@MainActor
final class MenuBarController: NSObject, NSPopoverDelegate {
    static let shared = MenuBarController()

    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var settingsWindow: NSWindow?
    private var eventMonitor: Any?
    private var stateObservation: AnyCancellable?

    private override init() {
        super.init()
    }

    // MARK: - Lifecycle

    func start() {
        NSApp.setActivationPolicy(.accessory)
        installStatusItem()
        installPopover()
        observeActivityState()
        startIPCServer()
        ListeningSessionController.shared.start()
        CompletionSubscriptionController.shared.start()
        SpeakEasyPadIntegration.shared.start()
    }

    func stop() {
        closePopover()
        removeEventMonitor()
        SpeakEasyPadIntegration.shared.stop()
        CompletionSubscriptionController.shared.stop()
        ListeningSessionController.shared.stop()
        PlayerIPCServer.shared.stop()

        if let statusItem {
            NSStatusBar.system.removeStatusItem(statusItem)
        }
        statusItem = nil
        popover = nil
        stateObservation = nil

        settingsWindow?.close()
        settingsWindow = nil
    }

    // MARK: - Status item

    private func installStatusItem() {
        guard statusItem == nil else { return }

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.image = SpeakeasyIcon.tumbler(filled: true)
            button.imageScaling = .scaleProportionallyDown
            button.toolTip = "SpeakEasy"
            button.target = self
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
        statusItem = item
    }

    private func observeActivityState() {
        stateObservation = Publishers.CombineLatest(
            PlaybackEngine.shared.$state,
            ListeningSessionController.shared.$phase
        )
            .receive(on: RunLoop.main)
            .sink { [weak self] playback, listening in
                self?.updateStatusIcon(playback: playback, listening: listening)
            }
    }

    private func updateStatusIcon(playback: PlaybackState, listening: ListeningPhase) {
        let description: String
        let image: NSImage
        if listening == .recording {
            description = "SpeakEasy is listening"
            image = NSImage(
                systemSymbolName: "mic.fill",
                accessibilityDescription: description
            ) ?? SpeakeasyIcon.tumbler(filled: true)
            statusItem?.button?.contentTintColor = .systemRed
        } else if [.validatingLock, .cueing, .warmingUp, .transcribing, .submitting, .preparingSpeech].contains(listening) {
            description = listening.label
            image = NSImage(
                systemSymbolName: "waveform",
                accessibilityDescription: description
            ) ?? SpeakeasyIcon.tumbler(filled: false)
            statusItem?.button?.contentTintColor = nil
        } else {
            statusItem?.button?.contentTintColor = nil
            switch playback {
        case .playing:
            description = "SpeakEasy is playing"
            image = SpeakeasyIcon.tumbler(filled: true)
        case .paused:
            description = "SpeakEasy is paused"
            image = SpeakeasyIcon.tumbler(filled: false)
        case .failed:
            description = "SpeakEasy playback failed"
            image = NSImage(
                systemSymbolName: "exclamationmark.circle",
                accessibilityDescription: description
            ) ?? SpeakeasyIcon.tumbler(filled: false)
        case .loading:
            description = "SpeakEasy is loading audio"
            image = SpeakeasyIcon.tumbler(filled: false)
        case .idle:
            description = "SpeakEasy"
            image = SpeakeasyIcon.tumbler(filled: false)
            }
        }
        image.isTemplate = true
        statusItem?.button?.image = image
        statusItem?.button?.toolTip = description
    }

    @objc private func statusItemClicked(_ sender: Any?) {
        guard let event = NSApp.currentEvent else {
            togglePopover()
            return
        }

        switch event.type {
        case .rightMouseUp:
            showStatusMenu()
        default:
            togglePopover()
        }
    }

    private func showStatusMenu() {
        guard let button = statusItem?.button else { return }

        let menu = NSMenu()
        menu.addItem(NSMenuItem(
            title: SpeakEasyPadIntegration.shared.menuTitle,
            action: #selector(openPadSettingsAction),
            keyEquivalent: ""
        ))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(
            title: "Settings…",
            action: #selector(openSettingsAction),
            keyEquivalent: ","
        ))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(
            title: "Quit SpeakEasy",
            action: #selector(quitAction),
            keyEquivalent: "q"
        ))
        for item in menu.items {
            item.target = self
        }

        // Temporarily attach menu so the status item presents it correctly.
        statusItem?.menu = menu
        button.performClick(nil)
        statusItem?.menu = nil
    }

    @objc private func openSettingsAction() {
        openSettings()
    }

    @objc private func openPadSettingsAction() {
        openSettings(initialSection: .pad)
    }

    @objc private func quitAction() {
        NSApp.terminate(nil)
    }

    // MARK: - Popover

    private func installPopover() {
        guard popover == nil else { return }

        let popover = NSPopover()
        popover.behavior = .transient
        popover.animates = true
        popover.delegate = self
        popover.contentSize = NSSize(width: 320, height: 640)
        popover.contentViewController = NSHostingController(rootView: makePopoverRoot())
        self.popover = popover
    }

    func togglePopover() {
        guard let popover, let button = statusItem?.button else { return }

        if popover.isShown {
            closePopover()
        } else {
            showPopover(relativeTo: button)
        }
    }

    private func showPopover(relativeTo button: NSView) {
        guard let popover else { return }
        // Refresh hosting content so SwiftUI observes current theme + engine state.
        popover.contentViewController = NSHostingController(rootView: makePopoverRoot())
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        installEventMonitor()
    }

    private func makePopoverRoot() -> some View {
        let appearance = ConfigManager.shared.appearanceMode
        let colorScheme: ColorScheme? = {
            switch appearance {
            case .system: return nil
            case .light: return .light
            case .dark: return .dark
            }
        }()
        let resolvedScheme = colorScheme
            ?? (NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? .dark : .light)
        let theme: Theme = resolvedScheme == .dark ? .dark : .light

        return PlayerPopoverView(
            onOpenSettings: { [weak self] in self?.openSettings() },
            onQuit: { NSApp.terminate(nil) }
        )
            .environment(\.theme, theme)
            .preferredColorScheme(colorScheme)
    }

    private func closePopover() {
        popover?.performClose(nil)
        removeEventMonitor()
    }

    private func installEventMonitor() {
        removeEventMonitor()
        eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            Task { @MainActor in
                self?.closePopover()
            }
        }
    }

    private func removeEventMonitor() {
        if let eventMonitor {
            NSEvent.removeMonitor(eventMonitor)
        }
        eventMonitor = nil
    }

    // MARK: - NSPopoverDelegate

    func popoverDidClose(_ notification: Notification) {
        removeEventMonitor()
    }

    // MARK: - Settings window (secondary surface)

    /// Opens the existing settings UI as a secondary window without relying on
    /// a launch-time `WindowGroup`. Safe to call repeatedly.
    func openSettings(initialSection: SpeakEasySection = .dashboard) {
        closePopover()

        if let settingsWindow, settingsWindow.isVisible {
            NotificationCenter.default.post(
                name: .speakEasySettingsSectionRequested,
                object: initialSection.rawValue
            )
            settingsWindow.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let rootView = ShellRootView(initialSection: initialSection)
            .environmentObject(ConfigManager.shared)

        let hosting = NSHostingController(rootView: rootView)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 920, height: 720),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "SpeakEasy"
        window.contentViewController = hosting
        window.setContentSize(NSSize(width: 920, height: 720))
        window.minSize = NSSize(width: 720, height: 640)
        window.center()
        window.isReleasedWhenClosed = false
        window.delegate = self

        settingsWindow = window
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - IPC

    private func startIPCServer() {
        do {
            try PlayerIPCServer.shared.start()
        } catch PlayerIPCError.alreadyRunning {
            NSLog("SpeakEasy: another player instance is already running")
            NSApp.terminate(nil)
        } catch {
            NSLog("SpeakEasy: failed to start player IPC server: %@", error.localizedDescription)
        }
    }
}

// MARK: - Settings window close tracking

extension MenuBarController: NSWindowDelegate {
    nonisolated func windowWillClose(_ notification: Notification) {
        Task { @MainActor in
            guard let window = notification.object as? NSWindow,
                  window === self.settingsWindow else { return }
            self.settingsWindow = nil
        }
    }
}
