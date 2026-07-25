import Carbon.HIToolbox
import Foundation

@MainActor
final class GlobalListeningShortcut {
    static let title = "⌃⌥Space"

    private var hotKey: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private let action: @MainActor @Sendable () -> Void

    init(action: @escaping @MainActor @Sendable () -> Void) {
        self.action = action

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, _, userData in
                guard let userData else { return noErr }
                let shortcut = Unmanaged<GlobalListeningShortcut>
                    .fromOpaque(userData)
                    .takeUnretainedValue()
                Task { @MainActor in shortcut.action() }
                return noErr
            },
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            &eventHandler
        )
    }

    deinit {
        if let hotKey { UnregisterEventHotKey(hotKey) }
        if let eventHandler { RemoveEventHandler(eventHandler) }
    }

    @discardableResult
    func register() -> Bool {
        unregister()
        var reference: EventHotKeyRef?
        let identifier = EventHotKeyID(signature: 0x53_50_4B_59, id: 1) // SPKY
        let status = RegisterEventHotKey(
            UInt32(kVK_Space),
            UInt32(controlKey | optionKey),
            identifier,
            GetApplicationEventTarget(),
            0,
            &reference
        )
        guard status == noErr else { return false }
        hotKey = reference
        return true
    }

    func unregister() {
        if let hotKey {
            UnregisterEventHotKey(hotKey)
            self.hotKey = nil
        }
    }

    /// Exercises the registered hotkey action without requiring test runners
    /// to obtain macOS Accessibility permission for synthetic keystrokes.
    func triggerForTesting() {
        guard ProcessInfo.processInfo.environment["SPEAKEASY_TRIGGER_HOTKEY_ON_LAUNCH"] == "1" else {
            return
        }
        action()
    }
}
