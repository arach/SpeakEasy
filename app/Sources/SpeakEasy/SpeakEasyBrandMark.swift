import SwiftUI
import AppKit
import HudsonUI

/// SpeakEasy app mark for the navigation rail header.
struct SpeakEasyBrandMark: View {
    var size: CGFloat = HudIconSize.large

    var body: some View {
        Group {
            if let image = Self.bundleIcon {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .antialiased(true)
            } else {
                SpeakEasyBrandMarkGlyph()
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .accessibilityLabel("SpeakEasy")
    }

    private static var bundleIcon: NSImage? {
        if let icon = NSApplication.shared.applicationIconImage, icon.size.width > 1 {
            return icon
        }
        if let url = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let image = NSImage(contentsOf: url),
           image.size.width > 1 {
            return image
        }
        return nil
    }
}

/// Vector fallback matching `Scripts/generate_icon.swift` when no bundle icon is loaded.
private struct SpeakEasyBrandMarkGlyph: View {
    private let navy = Color(red: 0.12, green: 0.16, blue: 0.23)
    private let cream = Color(red: 0.95, green: 0.95, blue: 0.93)

    private let speakerPixels: [SIMD2<Int>] = [
        SIMD2(-4, -2), SIMD2(-4, -1), SIMD2(-4, 0), SIMD2(-4, 1), SIMD2(-4, 2),
        SIMD2(-3, -2), SIMD2(-3, -1), SIMD2(-3, 0), SIMD2(-3, 1), SIMD2(-3, 2),
        SIMD2(-2, -3), SIMD2(-2, 3),
        SIMD2(-1, -4), SIMD2(-1, 4),
        SIMD2(0, -4), SIMD2(0, 4),
        SIMD2(1, -4), SIMD2(1, 4),
    ]

    private let wavePixels: [SIMD2<Int>] = [
        SIMD2(3, -2), SIMD2(4, -1), SIMD2(4, 0), SIMD2(4, 1), SIMD2(3, 2),
        SIMD2(5, -3), SIMD2(6, -2), SIMD2(6, -1), SIMD2(6, 0), SIMD2(6, 1), SIMD2(6, 2), SIMD2(5, 3),
        SIMD2(7, -3), SIMD2(8, -2), SIMD2(8, -1), SIMD2(8, 0), SIMD2(8, 1), SIMD2(8, 2), SIMD2(7, 3),
    ]

    var body: some View {
        GeometryReader { geometry in
            let scale = min(geometry.size.width, geometry.size.height) / 512.0
            let pixel = 20 * scale
            let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)

            ZStack {
                RoundedRectangle(cornerRadius: 90 * scale, style: .continuous)
                    .fill(navy)
                    .padding(20 * scale)

                Canvas { context, _ in
                    for offset in speakerPixels + wavePixels {
                        let rect = CGRect(
                            x: center.x + CGFloat(offset.x) * pixel,
                            y: center.y + CGFloat(offset.y) * pixel,
                            width: pixel,
                            height: pixel
                        )
                        context.fill(Path(rect), with: .color(cream))
                    }
                }
            }
        }
    }
}