#!/usr/bin/env swift

import AppKit
import Foundation

private let navy = NSColor(calibratedRed: 0.075, green: 0.11, blue: 0.18, alpha: 1)
private let mint = NSColor(calibratedRed: 0.20, green: 0.83, blue: 0.64, alpha: 1)
private let ice = NSColor(calibratedRed: 0.93, green: 0.98, blue: 0.98, alpha: 1)

private func drawMark(in bounds: NSRect) {
    let scale = bounds.width / 18
    func point(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
        NSPoint(x: bounds.minX + x * scale, y: bounds.minY + y * scale)
    }

    ice.setStroke()
    let glass = NSBezierPath()
    glass.move(to: point(3.1, 14.4))
    glass.line(to: point(14.9, 14.4))
    glass.line(to: point(13.6, 3.2))
    glass.curve(
        to: point(12.7, 2.4),
        controlPoint1: point(13.5, 2.7),
        controlPoint2: point(13.2, 2.4)
    )
    glass.line(to: point(5.3, 2.4))
    glass.curve(
        to: point(4.4, 3.2),
        controlPoint1: point(4.8, 2.4),
        controlPoint2: point(4.5, 2.7)
    )
    glass.close()
    glass.lineWidth = 1.15 * scale
    glass.lineJoinStyle = .round
    glass.stroke()

    let rim = NSBezierPath()
    rim.move(to: point(3.2, 14.4))
    rim.line(to: point(14.8, 14.4))
    rim.lineWidth = 1.35 * scale
    rim.lineCapStyle = .round
    rim.stroke()

    let base = NSBezierPath()
    base.move(to: point(5.0, 3.0))
    base.line(to: point(13.0, 3.0))
    base.lineWidth = 1.45 * scale
    base.lineCapStyle = .round
    base.stroke()

    mint.setStroke()
    let waveform = NSBezierPath()
    [
        point(5.2, 8.6), point(6.3, 8.6), point(7.2, 10.5),
        point(8.1, 6.3), point(9.1, 11.5), point(10.1, 7.0),
        point(11.0, 9.8), point(11.8, 8.6), point(12.8, 8.6),
    ].enumerated().forEach { index, value in
        index == 0 ? waveform.move(to: value) : waveform.line(to: value)
    }
    waveform.lineWidth = 0.95 * scale
    waveform.lineCapStyle = .round
    waveform.lineJoinStyle = .round
    waveform.stroke()
}

private func makeArtwork(size: CGFloat, inset: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()

    NSGraphicsContext.current?.imageInterpolation = .high
    let canvas = NSRect(x: 0, y: 0, width: size, height: size)
    navy.setFill()
    NSBezierPath(
        roundedRect: canvas.insetBy(dx: size * 0.035, dy: size * 0.035),
        xRadius: size * 0.22,
        yRadius: size * 0.22
    ).fill()

    drawMark(in: canvas.insetBy(dx: size * inset, dy: size * inset))
    image.unlockFocus()
    return image
}

private func writePNG(_ image: NSImage, to url: URL) throws {
    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let data = bitmap.representation(using: .png, properties: [:]) else {
        throw CocoaError(.fileWriteUnknown)
    }
    try data.write(to: url, options: .atomic)
}

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: generate-artwork.swift <assets-directory>\n", stderr)
    exit(64)
}

let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
try writePNG(makeArtwork(size: 512, inset: 0.23), to: output.appendingPathComponent("icon.png"))
try writePNG(makeArtwork(size: 1024, inset: 0.20), to: output.appendingPathComponent("logo.png"))
print("Wrote SpeakEasy plugin artwork to \(output.path)")
