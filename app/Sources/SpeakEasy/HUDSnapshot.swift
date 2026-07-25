#if DEBUG
import AppKit
import SwiftUI

@MainActor
enum HUDSnapshot {
    static func renderIfRequested() -> Bool {
        guard let argumentIndex = CommandLine.arguments.firstIndex(of: "--snapshot-hud"),
              CommandLine.arguments.indices.contains(argumentIndex + 1) else {
            return false
        }

        let outputPath = CommandLine.arguments[argumentIndex + 1]
        let requestedState = CommandLine.arguments.firstIndex(of: "--snapshot-hud-state")
            .flatMap { CommandLine.arguments.indices.contains($0 + 1) ? CommandLine.arguments[$0 + 1] : nil }
            .flatMap(ListeningPhase.init(rawValue:))
        let message = HUDMessage(
            text: "The permanent player now keeps every spoken word in view, follows the live narration, and can take you straight back to the Codex task that created it.",
            provider: "elevenlabs",
            cached: false,
            timestamp: Date().timeIntervalSince1970,
            audioLevel: 0.46,
            sourceThreadId: "019f9573-3e55-7701-8968-09c12d4fafe5"
        )
        let presentation = requestedState.map {
            HUDConversationPresentation(
                phase: $0,
                taskTitle: "Prototype SpeakEasy listening mode",
                taskID: "019f99a4-7867-7c23-ac29-0c0eca7da603",
                transcript: "Can you make the voice loop feel more alive?",
                error: $0 == .failed ? "Codex Desktop is unavailable." : nil,
                inputDeviceName: "MacBook Air Microphone"
            )
        }
        let content: AnyView
        if let presentation, presentation.phase == .speaking {
            content = AnyView(HUDContent(
                message: message,
                theme: .dark,
                audioLevel: 0.46,
                playbackProgress: 0.78,
                conversation: presentation
            ))
        } else if let presentation {
            content = AnyView(ConversationHUDContent(presentation: presentation))
        } else {
            content = AnyView(HUDContent(
                message: message,
                theme: .dark,
                audioLevel: 0.46,
                playbackProgress: 0.78
            ))
        }
        let rootView = content
            .environment(\.theme, .dark)
            .preferredColorScheme(.dark)
            .padding(12)

        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = NSRect(x: 0, y: 0, width: 504, height: 204)
        hostingView.layoutSubtreeIfNeeded()

        guard let representation = hostingView.bitmapImageRepForCachingDisplay(in: hostingView.bounds) else {
            NSLog("SpeakEasy: could not allocate HUD snapshot")
            NSApp.terminate(nil)
            return true
        }

        hostingView.cacheDisplay(in: hostingView.bounds, to: representation)
        guard let png = representation.representation(using: .png, properties: [:]) else {
            NSLog("SpeakEasy: could not encode HUD snapshot")
            NSApp.terminate(nil)
            return true
        }

        do {
            try png.write(to: URL(fileURLWithPath: outputPath), options: .atomic)
        } catch {
            NSLog("SpeakEasy: could not write HUD snapshot: %@", error.localizedDescription)
        }
        NSApp.terminate(nil)
        return true
    }
}
#endif
