#!/usr/bin/env swift
import AppKit
import Foundation

// Create a simple speaker icon
func createIcon(size: Int) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()

    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let scale = CGFloat(size) / 512.0

    // Background - solid navy blue (matching SpeakEasy branding)
    let bgPath = NSBezierPath(roundedRect: rect.insetBy(dx: 20 * scale, dy: 20 * scale), xRadius: 90 * scale, yRadius: 90 * scale)

    // Navy blue color from branding
    let navyBlue = NSColor(calibratedRed: 0.12, green: 0.16, blue: 0.23, alpha: 1.0)
    navyBlue.setFill()
    bgPath.fill()

    // Pixel-art style speaker icon (inspired by SpeakEasy branding)
    let centerX = CGFloat(size) / 2
    let centerY = CGFloat(size) / 2
    let pixelSize = 20 * scale

    // Light cream/beige color for contrast (like the branding background)
    let lightColor = NSColor(calibratedRed: 0.95, green: 0.95, blue: 0.93, alpha: 1.0)
    lightColor.setFill()

    // Draw pixelated speaker using rectangles
    // Speaker base (left side)
    let speakerPixels: [(x: Int, y: Int)] = [
        (-4, -2), (-4, -1), (-4, 0), (-4, 1), (-4, 2),  // Left column
        (-3, -2), (-3, -1), (-3, 0), (-3, 1), (-3, 2),  // Second column
        (-2, -3), (-2, 3),                               // Top and bottom extensions
        (-1, -4), (-1, 4),                               // Cone top/bottom
        (0, -4), (0, 4),                                 // Cone continues
        (1, -4), (1, 4)                                  // Cone end
    ]

    for pixel in speakerPixels {
        let pixelRect = NSRect(
            x: centerX + CGFloat(pixel.x) * pixelSize,
            y: centerY + CGFloat(pixel.y) * pixelSize,
            width: pixelSize,
            height: pixelSize
        )
        NSBezierPath(rect: pixelRect).fill()
    }

    // Sound waves (pixelated arcs)
    let wavePixels: [(x: Int, y: Int)] = [
        // First wave
        (3, -2), (4, -1), (4, 0), (4, 1), (3, 2),
        // Second wave
        (5, -3), (6, -2), (6, -1), (6, 0), (6, 1), (6, 2), (5, 3),
        // Third wave
        (7, -3), (8, -2), (8, -1), (8, 0), (8, 1), (8, 2), (7, 3)
    ]

    for pixel in wavePixels {
        let pixelRect = NSRect(
            x: centerX + CGFloat(pixel.x) * pixelSize,
            y: centerY + CGFloat(pixel.y) * pixelSize,
            width: pixelSize,
            height: pixelSize
        )
        NSBezierPath(rect: pixelRect).fill()
    }

    image.unlockFocus()
    return image
}

func saveIconSet(to directory: URL) {
    let sizes = [16, 32, 64, 128, 256, 512, 1024]

    // Create iconset directory
    let iconsetDir = directory.appendingPathComponent("AppIcon.iconset")
    try? FileManager.default.createDirectory(at: iconsetDir, withIntermediateDirectories: true)

    for size in sizes {
        let icon = createIcon(size: size)

        // Save 1x
        if let tiffData = icon.tiffRepresentation,
           let bitmap = NSBitmapImageRep(data: tiffData),
           let pngData = bitmap.representation(using: .png, properties: [:]) {
            let filename = size == 1024 ? "icon_512x512@2x.png" : "icon_\(size)x\(size).png"
            try? pngData.write(to: iconsetDir.appendingPathComponent(filename))
        }

        // Save 2x (for sizes up to 512)
        if size <= 512 {
            let icon2x = createIcon(size: size * 2)
            if let tiffData = icon2x.tiffRepresentation,
               let bitmap = NSBitmapImageRep(data: tiffData),
               let pngData = bitmap.representation(using: .png, properties: [:]) {
                let filename = "icon_\(size)x\(size)@2x.png"
                try? pngData.write(to: iconsetDir.appendingPathComponent(filename))
            }
        }
    }

    // Convert to icns using iconutil
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
    process.arguments = ["-c", "icns", iconsetDir.path, "-o", directory.appendingPathComponent("AppIcon.icns").path]
    try? process.run()
    process.waitUntilExit()

    // Clean up iconset
    try? FileManager.default.removeItem(at: iconsetDir)

    print("Icon created at: \(directory.appendingPathComponent("AppIcon.icns").path)")
}

// Main
let outputDir = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
saveIconSet(to: outputDir)
