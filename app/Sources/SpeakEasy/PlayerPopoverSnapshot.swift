#if DEBUG
import AppKit
import SwiftUI

@MainActor
enum PlayerPopoverSnapshot {
    static func renderIfRequested() -> Bool {
        if let argumentIndex = CommandLine.arguments.firstIndex(of: "--snapshot-lane-browser"),
           CommandLine.arguments.indices.contains(argumentIndex + 1) {
            let outputPath = CommandLine.arguments[argumentIndex + 1]
            ListeningSessionController.shared.installLaneSnapshotFixture()
            let rootView = ListeningPopoverSection.laneBrowserSnapshot(lane: 6)
                .environment(\.theme, .dark)
                .preferredColorScheme(.dark)
            writeSnapshot(rootView, size: NSSize(width: 300, height: 350), to: outputPath)
            return true
        }

        guard let argumentIndex = CommandLine.arguments.firstIndex(of: "--snapshot-player"),
              CommandLine.arguments.indices.contains(argumentIndex + 1) else {
            return false
        }

        let outputPath = CommandLine.arguments[argumentIndex + 1]
        ListeningSessionController.shared.installLaneSnapshotFixture()
        let rootView = PlayerPopoverView()
            .environment(\.theme, .dark)
            .preferredColorScheme(.dark)
        writeFittingSnapshot(rootView, width: 320, minimumHeight: 420, to: outputPath)
        return true
    }

    private static func writeFittingSnapshot<Content: View>(
        _ rootView: Content,
        width: CGFloat,
        minimumHeight: CGFloat,
        to outputPath: String
    ) {
        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = NSRect(x: 0, y: 0, width: width, height: minimumHeight)
        hostingView.layoutSubtreeIfNeeded()
        writeSnapshot(
            rootView,
            size: NSSize(width: width, height: max(minimumHeight, hostingView.fittingSize.height)),
            to: outputPath
        )
    }

    private static func writeSnapshot<Content: View>(
        _ rootView: Content,
        size: NSSize,
        to outputPath: String
    ) {
        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = NSRect(origin: .zero, size: size)
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
            try png.write(to: URL(fileURLWithPath: outputPath), options: .atomic)
        } catch {
            NSLog("SpeakEasy: could not write player snapshot: %@", error.localizedDescription)
        }
        NSApp.terminate(nil)
    }
}
#endif
