#if DEBUG
import AppKit
import SwiftUI

/// Design-iteration harness for the menu-bar pop-up.
///
/// Usage:
///   SpeakEasy --snapshot-player <out.png>                     (locked + idle)
///   SpeakEasy --snapshot-player <dir> --snapshot-states all   (every state)
///   SpeakEasy --snapshot-player <out.png> --snapshot-states locked:playing
///
/// A state is `<listening fixture>:<playback fixture>`; the playback half may be
/// omitted. `all` renders the matrix the redesign brief calls out — empty, idle,
/// playing, queued, listening, locked, and error.
@MainActor
enum PlayerPopoverSnapshot {
    private static let matrix: [(
        name: String,
        listening: ListeningSessionController.SnapshotFixture,
        playback: PlaybackEngine.SnapshotFixture
    )] = [
        ("unlocked-idle", .unlocked, .idle),
        ("unlocked-error", .error, .idle),
        ("locked-idle", .locked, .idle),
        ("locked-playing", .locked, .playing),
        ("locked-queued", .locked, .queued),
        ("recording-idle", .recording, .idle),
        ("locked-failed", .locked, .failed)
    ]

    static func renderIfRequested() -> Bool {
        guard let argumentIndex = CommandLine.arguments.firstIndex(of: "--snapshot-player"),
              CommandLine.arguments.indices.contains(argumentIndex + 1) else {
            return false
        }

        let outputPath = CommandLine.arguments[argumentIndex + 1]

        switch value(forFlag: "--snapshot-states") {
        case "all":
            for entry in matrix {
                render(
                    listening: entry.listening,
                    playback: entry.playback,
                    to: (outputPath as NSString).appendingPathComponent("\(entry.name).png")
                )
            }
        case .some(let raw):
            let parts = raw.split(separator: ":", maxSplits: 1).map(String.init)
            let listening = ListeningSessionController.SnapshotFixture(rawValue: parts.first ?? "") ?? .locked
            let playback = PlaybackEngine.SnapshotFixture(rawValue: parts.count > 1 ? parts[1] : "") ?? .idle
            render(listening: listening, playback: playback, to: outputPath)
        case .none:
            render(listening: .locked, playback: .idle, to: outputPath)
        }

        NSApp.terminate(nil)
        return true
    }

    private static func value(forFlag flag: String) -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: flag),
              CommandLine.arguments.indices.contains(index + 1) else {
            return nil
        }
        return CommandLine.arguments[index + 1]
    }

    private static func render(
        listening: ListeningSessionController.SnapshotFixture,
        playback: PlaybackEngine.SnapshotFixture,
        to outputPath: String
    ) {
        ListeningSessionController.shared.installLaneSnapshotFixture(listening)
        PlaybackEngine.shared.installSnapshotFixture(playback)

        let rootView = PlayerPopoverView()
            .environment(\.theme, .dark)
            .preferredColorScheme(.dark)
        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = NSRect(x: 0, y: 0, width: PopoverMetrics.width, height: 520)
        hostingView.layoutSubtreeIfNeeded()

        let fittingHeight = max(360, hostingView.fittingSize.height)
        hostingView.frame = NSRect(x: 0, y: 0, width: PopoverMetrics.width, height: fittingHeight)
        hostingView.layoutSubtreeIfNeeded()

        guard let representation = hostingView.bitmapImageRepForCachingDisplay(in: hostingView.bounds) else {
            NSLog("SpeakEasy: could not allocate player snapshot")
            return
        }

        hostingView.cacheDisplay(in: hostingView.bounds, to: representation)
        guard let png = representation.representation(using: .png, properties: [:]) else {
            NSLog("SpeakEasy: could not encode player snapshot")
            return
        }

        do {
            let url = URL(fileURLWithPath: outputPath)
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try png.write(to: url, options: .atomic)
        } catch {
            NSLog("SpeakEasy: could not write player snapshot: %@", error.localizedDescription)
        }
    }
}
#endif
