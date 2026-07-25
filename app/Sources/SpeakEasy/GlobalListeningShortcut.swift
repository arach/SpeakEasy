import Carbon.HIToolbox
import Foundation

private let speakEasyHotKeySignature: OSType = 0x53_50_4B_59 // SPKY

enum ListeningShortcutAction: Equatable, Sendable {
    case toggleCurrentLane
    case selectLane(Int)
}

@MainActor
final class GlobalListeningShortcut {
    static let title = "⌃⌥Space"
    static let laneRange = 1...9

    private static let currentLaneID: UInt32 = 1
    private static let firstLaneID: UInt32 = 101

    private var hotKeys: [UInt32: EventHotKeyRef] = [:]
    private var actions: [UInt32: ListeningShortcutAction] = [:]
    private var eventHandler: EventHandlerRef?
    private let action: @MainActor @Sendable (ListeningShortcutAction) -> Void

    init(action: @escaping @MainActor @Sendable (ListeningShortcutAction) -> Void) {
        self.action = action

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, event, userData in
                guard let event, let userData else { return OSStatus(eventNotHandledErr) }
                var identifier = EventHotKeyID()
                let status = GetEventParameter(
                    event,
                    EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID),
                    nil,
                    MemoryLayout<EventHotKeyID>.size,
                    nil,
                    &identifier
                )
                guard status == noErr, identifier.signature == speakEasyHotKeySignature else { return status }
                let shortcut = Unmanaged<GlobalListeningShortcut>
                    .fromOpaque(userData)
                    .takeUnretainedValue()
                let id = identifier.id
                Task { @MainActor in shortcut.handle(id: id) }
                return noErr
            },
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            &eventHandler
        )
    }

    deinit {
        for reference in hotKeys.values { UnregisterEventHotKey(reference) }
        if let eventHandler { RemoveEventHandler(eventHandler) }
    }

    @discardableResult
    func registerCurrentLane() -> Bool {
        register(
            id: Self.currentLaneID,
            keyCode: UInt32(kVK_Space),
            modifiers: UInt32(controlKey | optionKey),
            action: .toggleCurrentLane
        )
    }

    func registerLanes() -> [Int: Bool] {
        Dictionary(uniqueKeysWithValues: Self.laneRange.map { lane in
            let available = register(
                id: Self.id(forLane: lane),
                keyCode: Self.keyCode(forLane: lane),
                modifiers: UInt32(cmdKey | optionKey),
                action: .selectLane(lane)
            )
            return (lane, available)
        })
    }

    func unregisterAll() {
        for reference in hotKeys.values { UnregisterEventHotKey(reference) }
        hotKeys.removeAll()
        actions.removeAll()
    }

    /// Exercises a registered action without synthetic keystrokes or macOS
    /// Accessibility permission. Used only by signed launch validation.
    func triggerForTesting() {
        guard ProcessInfo.processInfo.environment["SPEAKEASY_TRIGGER_HOTKEY_ON_LAUNCH"] == "1" else {
            return
        }
        action(.toggleCurrentLane)
    }

    func triggerLaneForTesting(_ lane: Int) {
        guard ProcessInfo.processInfo.environment["SPEAKEASY_TRIGGER_LANE_ON_LAUNCH"] == String(lane),
              Self.laneRange.contains(lane)
        else { return }
        action(.selectLane(lane))
    }

    nonisolated static func title(forLane lane: Int) -> String { "⌘⌥\(lane)" }

    static func keyCode(forLane lane: Int) -> UInt32 {
        let codes = [
            UInt32(kVK_ANSI_1), UInt32(kVK_ANSI_2), UInt32(kVK_ANSI_3),
            UInt32(kVK_ANSI_4), UInt32(kVK_ANSI_5), UInt32(kVK_ANSI_6),
            UInt32(kVK_ANSI_7), UInt32(kVK_ANSI_8), UInt32(kVK_ANSI_9),
        ]
        guard Self.laneRange.contains(lane) else { return UInt32(kVK_ANSI_1) }
        return codes[lane - 1]
    }

    private static func id(forLane lane: Int) -> UInt32 {
        firstLaneID + UInt32(lane - 1)
    }

    @discardableResult
    private func register(
        id: UInt32,
        keyCode: UInt32,
        modifiers: UInt32,
        action: ListeningShortcutAction
    ) -> Bool {
        if let existing = hotKeys.removeValue(forKey: id) {
            UnregisterEventHotKey(existing)
        }
        actions.removeValue(forKey: id)

        var reference: EventHotKeyRef?
        let identifier = EventHotKeyID(signature: speakEasyHotKeySignature, id: id)
        let status = RegisterEventHotKey(
            keyCode,
            modifiers,
            identifier,
            GetApplicationEventTarget(),
            0,
            &reference
        )
        guard status == noErr, let reference else { return false }
        hotKeys[id] = reference
        actions[id] = action
        return true
    }

    private func handle(id: UInt32) {
        guard let shortcutAction = actions[id] else { return }
        action(shortcutAction)
    }
}
