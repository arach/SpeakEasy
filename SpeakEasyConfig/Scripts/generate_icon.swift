#!/usr/bin/env swift
import AppKit
import Foundation

// Create a simple speaker icon
func createIcon(size: Int) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()

    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let scale = CGFloat(size) / 512.0

    // Background - rounded square with gradient
    let bgPath = NSBezierPath(roundedRect: rect.insetBy(dx: 20 * scale, dy: 20 * scale), xRadius: 90 * scale, yRadius: 90 * scale)

    // Gradient background
    let gradient = NSGradient(colors: [
        NSColor(calibratedRed: 0.2, green: 0.5, blue: 0.9, alpha: 1.0),
        NSColor(calibratedRed: 0.4, green: 0.3, blue: 0.8, alpha: 1.0)
    ])!
    gradient.draw(in: bgPath, angle: -45)

    // Add glass highlight
    let highlightPath = NSBezierPath(roundedRect: rect.insetBy(dx: 25 * scale, dy: 25 * scale), xRadius: 85 * scale, yRadius: 85 * scale)
    let highlightGradient = NSGradient(colors: [
        NSColor.white.withAlphaComponent(0.3),
        NSColor.white.withAlphaComponent(0.0)
    ])!
    highlightGradient.draw(in: highlightPath, angle: 90)

    // Speaker icon
    NSColor.white.setFill()

    let centerX = CGFloat(size) / 2
    let centerY = CGFloat(size) / 2

    // Speaker body (trapezoid-ish)
    let speakerPath = NSBezierPath()
    speakerPath.move(to: NSPoint(x: centerX - 80 * scale, y: centerY - 50 * scale))
    speakerPath.line(to: NSPoint(x: centerX - 80 * scale, y: centerY + 50 * scale))
    speakerPath.line(to: NSPoint(x: centerX - 30 * scale, y: centerY + 50 * scale))
    speakerPath.line(to: NSPoint(x: centerX + 30 * scale, y: centerY + 100 * scale))
    speakerPath.line(to: NSPoint(x: centerX + 30 * scale, y: centerY - 100 * scale))
    speakerPath.line(to: NSPoint(x: centerX - 30 * scale, y: centerY - 50 * scale))
    speakerPath.close()
    speakerPath.fill()

    // Sound waves
    NSColor.white.setStroke()

    for i in 1...3 {
        let waveRadius = CGFloat(50 + i * 35) * scale
        let wavePath = NSBezierPath()
        wavePath.appendArc(
            withCenter: NSPoint(x: centerX + 40 * scale, y: centerY),
            radius: waveRadius,
            startAngle: -45,
            endAngle: 45,
            clockwise: false
        )
        wavePath.lineWidth = 20 * scale
        wavePath.lineCapStyle = .round
        wavePath.stroke()
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
