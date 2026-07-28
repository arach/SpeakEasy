#if DEBUG
import AppKit
import SwiftUI

@MainActor
enum PlayerPopoverSnapshot {
    static func renderIfRequested() -> Bool {
        guard let argumentIndex = CommandLine.arguments.firstIndex(of: "--snapshot-player"),
              CommandLine.arguments.indices.contains(argumentIndex + 1) else {
            return false
        }

        let outputPath = CommandLine.arguments[argumentIndex + 1]
        if CommandLine.arguments.contains("--snapshot-player-failure") {
            seedPlaybackFailure()
        }
        let rootView = PlayerPopoverView()
            .environment(\.theme, .dark)
            .preferredColorScheme(.dark)
        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = NSRect(x: 0, y: 0, width: 320, height: 520)
        hostingView.layoutSubtreeIfNeeded()

        let fittingHeight = max(420, hostingView.fittingSize.height)
        hostingView.frame = NSRect(x: 0, y: 0, width: 320, height: fittingHeight)
        hostingView.layoutSubtreeIfNeeded()

        guard let representation = hostingView.bitmapImageRepForCachingDisplay(in: hostingView.bounds) else {
            NSLog("SpeakEasy: could not allocate player snapshot")
            NSApp.terminate(nil)
            return true
        }

        hostingView.cacheDisplay(in: hostingView.bounds, to: representation)
        guard let png = representation.representation(using: .png, properties: [:]) else {
            NSLog("SpeakEasy: could not encode player snapshot")
            NSApp.terminate(nil)
            return true
        }

        do {
            try png.write(to: URL(fileURLWithPath: outputPath), options: .atomic)
        } catch {
            NSLog("SpeakEasy: could not write player snapshot: %@", error.localizedDescription)
        }
        NSApp.terminate(nil)
        return true
    }

    private static func seedPlaybackFailure() {
        let item = PlaybackItem(
            id: UUID(),
            audioPath: "/tmp/speakeasy-snapshot-missing-audio",
            title: "Narration",
            text: "Snapshot failure state",
            provider: "system",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            synthesisRateWPM: nil,
            sourceThreadId: nil
        )
        let request = PlayerCommandRequest(
            protocolVersion: playerProtocolVersion,
            requestId: UUID(),
            command: .enqueue,
            arguments: PlayerCommandArguments(
                item: item,
                priority: .normal,
                interrupt: false,
                autoplay: true,
                positionSeconds: nil,
                volume: nil,
                playbackRate: nil,
                itemId: nil
            )
        )
        _ = PlaybackEngine.shared.handle(request)
    }
}
#endif
