#!/usr/bin/env swift
import AppKit
import CoreGraphics
import CoreText
import Foundation

// SpeakEasy app mark — the single source of truth for every shipped target.
//
// The four release contracts are intentionally stable:
//   swift speakeasy-icon.swift ipad    <AppIcon.appiconset dir>
//   swift speakeasy-icon.swift macos   <dir containing AppIcon.icns>
//   swift speakeasy-icon.swift landing <icon.png path>
//   swift speakeasy-icon.swift master  <dir>
//
// `studies` is a design-review target. It renders every explored direction at
// 1024 plus honest, actual-pixel legibility sheets at 152/120/80/58/40 px.
//   swift speakeasy-icon.swift studies <dir>

// MARK: - Colour

struct RGB {
    let r: CGFloat
    let g: CGFloat
    let b: CGFloat
    let a: CGFloat

    init(_ hex: Int, alpha: CGFloat = 1) {
        r = CGFloat((hex >> 16) & 0xff) / 255
        g = CGFloat((hex >> 8) & 0xff) / 255
        b = CGFloat(hex & 0xff) / 255
        a = alpha
    }

    var cg: CGColor { CGColor(srgbRed: r, green: g, blue: b, alpha: a) }
}

let paper = RGB(0xF3F0E9)
let paperInk = RGB(0x24232A)

// MARK: - Geometry

func rounded(_ rect: CGRect, _ radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

/// A closer approximation of the system icon mask than a rounded rectangle.
/// It is used only by the review sheets; iOS applies its own mask in shipping.
func superellipse(_ rect: CGRect, exponent n: CGFloat = 5.0) -> CGPath {
    let path = CGMutablePath()
    let steps = 160
    let a = rect.width / 2
    let b = rect.height / 2
    let cx = rect.midX
    let cy = rect.midY

    for index in 0...steps {
        let angle = CGFloat(index) / CGFloat(steps) * .pi * 2
        let cosine = cos(angle)
        let sine = sin(angle)
        let x = cx + a * (cosine < 0 ? -1 : 1) * pow(abs(cosine), 2 / n)
        let y = cy + b * (sine < 0 ? -1 : 1) * pow(abs(sine), 2 / n)
        if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
        else { path.addLine(to: CGPoint(x: x, y: y)) }
    }
    path.closeSubpath()
    return path
}

func fill(_ context: CGContext, _ path: CGPath, _ colour: RGB) {
    context.addPath(path)
    context.setFillColor(colour.cg)
    context.fillPath()
}

func stroke(_ context: CGContext, _ path: CGPath, _ colour: RGB, width: CGFloat,
            cap: CGLineCap = .round, join: CGLineJoin = .round) {
    context.addPath(path)
    context.setStrokeColor(colour.cg)
    context.setLineWidth(width)
    context.setLineCap(cap)
    context.setLineJoin(join)
    context.strokePath()
}

func drawBackground(_ context: CGContext, size s: CGFloat, base: RGB, bloom: RGB? = nil) {
    context.setFillColor(base.cg)
    context.fill(CGRect(x: 0, y: 0, width: s, height: s))
    guard let bloom else { return }

    let clear = RGB((Int(bloom.r * 255) << 16) | (Int(bloom.g * 255) << 8) | Int(bloom.b * 255), alpha: 0)
    if let gradient = CGGradient(
        colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: [bloom.cg, clear.cg] as CFArray,
        locations: [0, 1]
    ) {
        context.drawRadialGradient(
            gradient,
            startCenter: CGPoint(x: s * 0.30, y: s * 0.80),
            startRadius: 0,
            endCenter: CGPoint(x: s * 0.42, y: s * 0.66),
            endRadius: s * 0.88,
            options: [.drawsAfterEndLocation]
        )
    }
}

func drawCapsule(_ context: CGContext, center: CGPoint, size: CGSize, angle: CGFloat, colour: RGB) {
    context.saveGState()
    context.translateBy(x: center.x, y: center.y)
    context.rotate(by: angle)
    let rect = CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height)
    fill(context, rounded(rect, size.width / 2), colour)
    context.restoreGState()
}

// MARK: - Directions

enum Direction: String, CaseIterable {
    case dial
    case duplex
    case key
    case matrix
    case prompt
    case mouthKeyhole
    case pixelSpeaker

    var number: Int {
        switch self {
        case .dial: return 1
        case .duplex: return 2
        case .key: return 3
        case .matrix: return 4
        case .prompt: return 5
        case .mouthKeyhole: return 6
        case .pixelSpeaker: return 7
        }
    }

    var slug: String {
        switch self {
        case .dial: return "nine-dial"
        case .duplex: return "duplex-s"
        case .key: return "voice-key"
        case .matrix: return "deck-matrix"
        case .prompt: return "prompt-mouth"
        case .mouthKeyhole: return "mouth-keyhole"
        case .pixelSpeaker: return "pixel-speaker"
        }
    }

    var title: String {
        switch self {
        case .dial: return "NINE DIAL"
        case .duplex: return "DUPLEX S"
        case .key: return "VOICE KEY"
        case .matrix: return "DECK MATRIX"
        case .prompt: return "PROMPT MOUTH"
        case .mouthKeyhole: return "MOUTH KEYHOLE"
        case .pixelSpeaker: return "PIXEL SPEAKER"
        }
    }
}

/// Recommended direction. Shipped targets call only this value.
let winner: Direction = .pixelSpeaker

/// Nine tangential lane detents around one held-to-talk control. The segmented
/// selector reads as hardware rather than a waveform, microphone, or sunburst.
func drawNineDial(_ context: CGContext, _ s: CGFloat) {
    let ink = RGB(0x141225)
    let paper = RGB(0xFFF0D3)
    let signal = RGB(0xFF6047)
    let live = RGB(0x68E6C1)
    drawBackground(context, size: s, base: ink, bloom: RGB(0x322751, alpha: 0.56))

    let center = CGPoint(x: s * 0.50, y: s * 0.50)
    let radius = s * 0.355
    for index in 0..<9 {
        let angle = CGFloat(index) * (.pi * 2 / 9) + .pi / 18
        let p = CGPoint(x: center.x + cos(angle) * radius,
                        y: center.y + sin(angle) * radius)
        drawCapsule(
            context,
            center: p,
            size: CGSize(width: s * 0.092, height: s * 0.202),
            angle: angle,
            colour: index == 1 ? live : paper
        )
    }

    // A hard-edged control reads better than a glowing record light at 40 px.
    let outer = CGRect(x: s * 0.302, y: s * 0.302, width: s * 0.396, height: s * 0.396)
    fill(context, CGPath(ellipseIn: outer, transform: nil), paper)
    let button = CGRect(x: s * 0.342, y: s * 0.342, width: s * 0.316, height: s * 0.316)
    fill(context, CGPath(ellipseIn: button, transform: nil), signal)
    let witness = CGRect(x: s * 0.462, y: s * 0.462, width: s * 0.076, height: s * 0.076)
    fill(context, CGPath(ellipseIn: witness, transform: nil), ink)
}

/// Two independent speech paths interlock as an S: utterance out, reply back.
func drawDuplexS(_ context: CGContext, _ s: CGFloat) {
    let claret = RGB(0x3C1025)
    let coral = RGB(0xFF6C55)
    let cream = RGB(0xFFE9C4)
    let mint = RGB(0x76E6C3)
    drawBackground(context, size: s, base: claret, bloom: RGB(0x712243, alpha: 0.50))

    let upper = CGMutablePath()
    upper.move(to: CGPoint(x: s * 0.245, y: s * 0.695))
    upper.addCurve(to: CGPoint(x: s * 0.535, y: s * 0.500),
                   control1: CGPoint(x: s * 0.325, y: s * 0.870),
                   control2: CGPoint(x: s * 0.785, y: s * 0.815))
    stroke(context, upper, cream, width: s * 0.122)

    let lower = CGMutablePath()
    lower.move(to: CGPoint(x: s * 0.755, y: s * 0.305))
    lower.addCurve(to: CGPoint(x: s * 0.465, y: s * 0.500),
                   control1: CGPoint(x: s * 0.675, y: s * 0.130),
                   control2: CGPoint(x: s * 0.215, y: s * 0.185))
    stroke(context, lower, coral, width: s * 0.122)

    // Terminal dots make the two directions explicit without arrowheads.
    fill(context, CGPath(ellipseIn: CGRect(x: s * 0.179, y: s * 0.629, width: s * 0.132, height: s * 0.132), transform: nil), mint)
    fill(context, CGPath(ellipseIn: CGRect(x: s * 0.689, y: s * 0.239, width: s * 0.132, height: s * 0.132), transform: nil), cream)
}

/// A literal access key whose bow is also a listening aperture. It uses the
/// speakeasy meaning without drawing another door or conventional microphone.
func drawVoiceKey(_ context: CGContext, _ s: CGFloat) {
    let cobalt = RGB(0x2446C8)
    let cobaltBloom = RGB(0x5975FF, alpha: 0.46)
    let cream = RGB(0xFFF2D8)
    let coral = RGB(0xFF674D)
    drawBackground(context, size: s, base: cobalt, bloom: cobaltBloom)

    let ring = CGPath(ellipseIn: CGRect(x: s * 0.185, y: s * 0.455, width: s * 0.385, height: s * 0.385), transform: nil)
    stroke(context, ring, cream, width: s * 0.105)

    let shaft = CGMutablePath()
    shaft.move(to: CGPoint(x: s * 0.485, y: s * 0.515))
    shaft.addLine(to: CGPoint(x: s * 0.792, y: s * 0.208))
    stroke(context, shaft, cream, width: s * 0.112)

    let firstTooth = CGMutablePath()
    firstTooth.move(to: CGPoint(x: s * 0.660, y: s * 0.340))
    firstTooth.addLine(to: CGPoint(x: s * 0.770, y: s * 0.340))
    let secondTooth = CGMutablePath()
    secondTooth.move(to: CGPoint(x: s * 0.724, y: s * 0.276))
    secondTooth.addLine(to: CGPoint(x: s * 0.815, y: s * 0.276))
    stroke(context, firstTooth, cream, width: s * 0.100)
    stroke(context, secondTooth, cream, width: s * 0.100)

    fill(context, CGPath(ellipseIn: CGRect(x: s * 0.323, y: s * 0.593, width: s * 0.110, height: s * 0.110), transform: nil), coral)
}

/// The Deck reduced to its irreducible architecture: nine tactile lane keys,
/// with the centre lane actively held. Deliberately orthogonal and icon-like.
func drawDeckMatrix(_ context: CGContext, _ s: CGFloat) {
    let signal = RGB(0xF05E45)
    let signalBloom = RGB(0xFF9B68, alpha: 0.32)
    let ink = RGB(0x16182B)
    let cream = RGB(0xFFF0D2)
    drawBackground(context, size: s, base: signal, bloom: signalBloom)

    let cell = s * 0.178
    let gap = s * 0.058
    let total = cell * 3 + gap * 2
    let origin = (s - total) / 2
    for row in 0..<3 {
        for column in 0..<3 {
            let rect = CGRect(x: origin + CGFloat(column) * (cell + gap),
                              y: origin + CGFloat(row) * (cell + gap),
                              width: cell, height: cell)
            let active = row == 1 && column == 1
            fill(context, rounded(rect, s * 0.044), active ? cream : ink)
            if active {
                let lamp = CGRect(x: rect.midX - s * 0.045, y: rect.midY - s * 0.045,
                                  width: s * 0.090, height: s * 0.090)
                fill(context, CGPath(ellipseIn: lamp, transform: nil), signal)
            }
        }
    }
}

/// A spoken wedge becomes a terminal prompt. This is the most developer-first
/// route: terse, typographic and strong at small sizes, but less human.
func drawPromptMouth(_ context: CGContext, _ s: CGFloat) {
    let violet = RGB(0x432A89)
    let violetBloom = RGB(0x7657D9, alpha: 0.44)
    let mint = RGB(0x82F0C7)
    let cream = RGB(0xFFF0D2)
    drawBackground(context, size: s, base: violet, bloom: violetBloom)

    let chevron = CGMutablePath()
    chevron.move(to: CGPoint(x: s * 0.245, y: s * 0.710))
    chevron.addLine(to: CGPoint(x: s * 0.500, y: s * 0.500))
    chevron.addLine(to: CGPoint(x: s * 0.245, y: s * 0.290))
    stroke(context, chevron, mint, width: s * 0.122)

    let cursor = CGRect(x: s * 0.515, y: s * 0.275, width: s * 0.270, height: s * 0.118)
    fill(context, rounded(cursor, s * 0.059), cream)

    // A small dispatch dot turns the prompt from static syntax into a send state.
    fill(context, CGPath(ellipseIn: CGRect(x: s * 0.655, y: s * 0.585, width: s * 0.118, height: s * 0.118), transform: nil), cream)
}

func almond(_ rect: CGRect) -> CGPath {
    let path = CGMutablePath()
    path.move(to: CGPoint(x: rect.minX, y: rect.midY))
    path.addCurve(
        to: CGPoint(x: rect.maxX, y: rect.midY),
        control1: CGPoint(x: rect.minX + rect.width * 0.28, y: rect.maxY),
        control2: CGPoint(x: rect.minX + rect.width * 0.72, y: rect.maxY)
    )
    path.addCurve(
        to: CGPoint(x: rect.minX, y: rect.midY),
        control1: CGPoint(x: rect.minX + rect.width * 0.72, y: rect.minY),
        control2: CGPoint(x: rect.minX + rect.width * 0.28, y: rect.minY)
    )
    path.closeSubpath()
    return path
}

func lips(_ rect: CGRect) -> CGPath {
    let path = CGMutablePath()
    let notch = rect.midY + rect.height * 0.12
    path.move(to: CGPoint(x: rect.minX, y: rect.midY))
    path.addCurve(
        to: CGPoint(x: rect.midX, y: notch),
        control1: CGPoint(x: rect.minX + rect.width * 0.20, y: rect.maxY),
        control2: CGPoint(x: rect.minX + rect.width * 0.38, y: rect.maxY)
    )
    path.addCurve(
        to: CGPoint(x: rect.maxX, y: rect.midY),
        control1: CGPoint(x: rect.minX + rect.width * 0.62, y: rect.maxY),
        control2: CGPoint(x: rect.minX + rect.width * 0.80, y: rect.maxY)
    )
    path.addCurve(
        to: CGPoint(x: rect.minX, y: rect.midY),
        control1: CGPoint(x: rect.minX + rect.width * 0.78, y: rect.minY),
        control2: CGPoint(x: rect.minX + rect.width * 0.22, y: rect.minY)
    )
    path.closeSubpath()
    return path
}

/// A mouth is the only opening in a keyhole: "speak easy" and "speakeasy" in
/// one compact silhouette. This direction came from the generated concept
/// exploration, then was rebuilt here from circles and Bézier geometry.
func drawMouthKeyhole(_ context: CGContext, _ s: CGFloat) {
    let oxblood = RGB(0x2B0E1C)
    let oxbloodBloom = RGB(0x70243C, alpha: 0.58)
    let brass = RGB(0xF8D58A)
    let coral = RGB(0xFF624B)
    let ink = RGB(0x160912)
    drawBackground(context, size: s, base: oxblood, bloom: oxbloodBloom)

    // One continuous outline, not a circle stacked on a trapezoid: it keeps the
    // keyhole reading and avoids the anthropomorphic "head and body" seam.
    let center = CGPoint(x: s * 0.500, y: s * 0.640)
    let radius = s * 0.242
    let startAngle = -CGFloat.pi * 0.36
    let endAngle = CGFloat.pi * 1.36
    let keyhole = CGMutablePath()
    keyhole.move(to: CGPoint(x: center.x + cos(startAngle) * radius,
                             y: center.y + sin(startAngle) * radius))
    keyhole.addArc(center: center, radius: radius,
                   startAngle: startAngle, endAngle: endAngle, clockwise: false)
    keyhole.addLine(to: CGPoint(x: s * 0.326, y: s * 0.158))
    keyhole.addQuadCurve(to: CGPoint(x: s * 0.375, y: s * 0.120),
                         control: CGPoint(x: s * 0.344, y: s * 0.120))
    keyhole.addLine(to: CGPoint(x: s * 0.625, y: s * 0.120))
    keyhole.addQuadCurve(to: CGPoint(x: s * 0.674, y: s * 0.158),
                         control: CGPoint(x: s * 0.656, y: s * 0.120))
    keyhole.closeSubpath()
    fill(context, keyhole, ink)
    stroke(context, keyhole, brass, width: s * 0.046, join: .round)

    // The coral lip survives as a roughly 11 × 5 px shape at the brief's
    // limiting size; its dark centre stays open rather than collapsing shut.
    fill(context, lips(CGRect(x: s * 0.345, y: s * 0.595,
                              width: s * 0.310, height: s * 0.126)), coral)
    fill(context, almond(CGRect(x: s * 0.405, y: s * 0.630,
                                width: s * 0.190, height: s * 0.056)), ink)
}

/// The original macOS mark: a pixel-art speaker emitting three arcs, restored
/// from `app/Scripts/generate_icon.swift` as it stood before the round-2
/// keyhole. Two corrections were applied while porting it here:
///
///   1. The art is centred on its own bounding box. The original anchored the
///      grid origin at the canvas centre, but the map spans x = -4...9, so the
///      mark sat roughly a tenth of the canvas right of true centre and the
///      outer wave crowded the plate edge.
///   2. The cone tapers. The original drew only the top and bottom edge pixels
///      of the flare, leaving a hollow that reads as a bracket. Filling that
///      outline as-drawn produces a solid blob, because the outline was closer
///      to a rounded box than to a cone, so the body now steps 3-3-5-7-9-9
///      cells tall and reads unambiguously as a speaker facing right.
func drawPixelSpeaker(_ context: CGContext, _ s: CGFloat) {
    let navy = RGB(0x1F293B)
    let cream = RGB(0xF2F2ED)
    drawBackground(context, size: s, base: navy, bloom: RGB(0x33445F, alpha: 0.45))

    // Stem, then a tapering cone flaring right. Column -> half-height.
    let column: [(x: Int, half: Int)] = [
        (-4, 1), (-3, 1), (-2, 2), (-1, 3), (0, 4), (1, 4),
    ]
    var pixels: [(x: Int, y: Int)] = []
    for entry in column {
        for y in -entry.half...entry.half { pixels.append((entry.x, y)) }
    }

    // Three emitted arcs, verbatim from the original map.
    pixels += [
        (3, -2), (4, -1), (4, 0), (4, 1), (3, 2),
        (5, -3), (6, -2), (6, -1), (6, 0), (6, 1), (6, 2), (5, 3),
        (7, -3), (8, -2), (8, -1), (8, 0), (8, 1), (8, 2), (7, 3),
    ]

    // 23 cells across the canvas puts the 13-cell mark at ~57% width.
    let unit = s / 23
    let originX = s / 2 - 2.5 * unit   // map spans x = -4...9  -> centre 2.5
    let originY = s / 2 - 0.5 * unit   // map spans y = -4...5  -> centre 0.5

    // One path, one fill: adjacent cells merge instead of leaving antialiased
    // hairline seams where their edges meet.
    let grid = CGMutablePath()
    for pixel in pixels {
        grid.addRect(CGRect(x: originX + CGFloat(pixel.x) * unit,
                            y: originY + CGFloat(pixel.y) * unit,
                            width: unit, height: unit))
    }
    fill(context, grid, cream)
}

func drawDirection(_ direction: Direction, in context: CGContext, size: CGFloat) {
    switch direction {
    case .dial: drawNineDial(context, size)
    case .duplex: drawDuplexS(context, size)
    case .key: drawVoiceKey(context, size)
    case .matrix: drawDeckMatrix(context, size)
    case .prompt: drawPromptMouth(context, size)
    case .mouthKeyhole: drawMouthKeyhole(context, size)
    case .pixelSpeaker: drawPixelSpeaker(context, size)
    }
}

// MARK: - Rendering

enum Shape {
    /// iOS and web: fill the square. The system applies its own mask.
    case fullBleed
    /// macOS: transparent canvas plus Apple's 824/1024 content box and
    /// 185.4/1024 corner radius. macOS does not mask app icons for us.
    case macOSGrid
}

func makeContext(width: Int, height: Int) -> CGContext {
    let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)
    context.interpolationQuality = .high
    return context
}

func render(direction: Direction, size: Int, shape: Shape = .fullBleed) -> CGImage {
    let s = CGFloat(size)
    let context = makeContext(width: size, height: size)

    switch shape {
    case .fullBleed:
        drawDirection(direction, in: context, size: s)
    case .macOSGrid:
        let content = s * (824.0 / 1024.0)
        let origin = (s - content) / 2
        let rect = CGRect(x: origin, y: origin, width: content, height: content)
        context.saveGState()
        context.addPath(rounded(rect, s * (185.4 / 1024.0)))
        context.clip()
        context.translateBy(x: origin, y: origin)
        drawDirection(direction, in: context, size: content)
        context.restoreGState()
    }
    return context.makeImage()!
}

func drawText(_ text: String, at point: CGPoint, size: CGFloat, colour: RGB,
              weight: NSFont.Weight = .regular) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    let fontName = weight.rawValue >= NSFont.Weight.semibold.rawValue
        ? "SFMono-Semibold" as CFString
        : "SFMono-Regular" as CFString
    let font = CTFontCreateWithName(fontName, size, nil)
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): colour.cg,
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
    context.textPosition = point
    CTLineDraw(line, context)
}

func renderLegibilitySheet(_ direction: Direction) -> CGImage {
    let width = 1240
    let height = 360
    let context = makeContext(width: width, height: height)
    context.setFillColor(paper.cg)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = nsContext
    drawText("0\(direction.number)  \(direction.title)", at: CGPoint(x: 54, y: 302),
             size: 24, colour: paperInk, weight: .semibold)
    drawText("ACTUAL PIXELS · SYSTEM MASK", at: CGPoint(x: 54, y: 270),
             size: 12, colour: RGB(0x6D6A70))
    NSGraphicsContext.restoreGraphicsState()

    let sizes = [152, 120, 80, 58, 40]
    let centers: [CGFloat] = [160, 406, 635, 835, 1015]
    let baseY: CGFloat = 54
    for (index, px) in sizes.enumerated() {
        let x = centers[index] - CGFloat(px) / 2
        let rect = CGRect(x: x, y: baseY, width: CGFloat(px), height: CGFloat(px))
        context.saveGState()
        context.setShadow(offset: CGSize(width: 0, height: -3), blur: 8,
                          color: RGB(0x141225, alpha: 0.18).cg)
        context.addPath(superellipse(rect))
        context.clip()
        context.draw(render(direction: direction, size: px), in: rect)
        context.restoreGState()

        let labelX = centers[index] - 22
        let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = nsContext
        drawText("\(px)", at: CGPoint(x: labelX, y: 22), size: 13, colour: RGB(0x6D6A70))
        NSGraphicsContext.restoreGraphicsState()
    }
    return context.makeImage()!
}

func renderContactSheet() -> CGImage {
    let width = 2100
    let height = 500
    let context = makeContext(width: width, height: height)
    context.setFillColor(paper.cg)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    for (index, direction) in Direction.allCases.enumerated() {
        let iconSize = 250
        let centerX = 190 + CGFloat(index) * 340
        let rect = CGRect(x: centerX - CGFloat(iconSize) / 2, y: 150,
                          width: CGFloat(iconSize), height: CGFloat(iconSize))
        context.saveGState()
        context.addPath(superellipse(rect))
        context.clip()
        context.draw(render(direction: direction, size: iconSize), in: rect)
        context.restoreGState()

        let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = nsContext
        drawText("0\(direction.number)", at: CGPoint(x: centerX - 122, y: 100),
                 size: 13, colour: RGB(0x767278))
        drawText(direction.title, at: CGPoint(x: centerX - 122, y: 66),
                 size: 18, colour: paperInk, weight: .semibold)
        if direction == winner {
            drawText("RECOMMENDED", at: CGPoint(x: centerX - 122, y: 38),
                     size: 11, colour: RGB(0xD84B36), weight: .semibold)
        }
        NSGraphicsContext.restoreGraphicsState()
    }
    return context.makeImage()!
}

func writePNG(_ image: CGImage, to path: String) {
    let url = URL(fileURLWithPath: path)
    try! FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                             withIntermediateDirectories: true)
    let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
    try! data.write(to: url)
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

// MARK: - Targets

let args = CommandLine.arguments
guard args.count >= 3 else {
    fail("usage: speakeasy-icon.swift <ipad|macos|landing|master|studies> <out>")
}
let target = args[1]
let out = args[2]

switch target {
case "ipad":
    // Filenames intentionally match AppIcon.appiconset/Contents.json.
    let sizes: [String: Int] = [
        "Icon-App-20x20@1x.png": 20, "Icon-App-20x20@2x.png": 40, "Icon-App-20x20@3x.png": 60,
        "Icon-App-29x29@1x.png": 29, "Icon-App-29x29@2x.png": 58, "Icon-App-29x29@3x.png": 87,
        "Icon-App-40x40@1x.png": 40, "Icon-App-40x40@2x.png": 80, "Icon-App-40x40@3x.png": 120,
        "Icon-App-60x60@2x.png": 120, "Icon-App-60x60@3x.png": 180,
        "Icon-App-76x76@1x.png": 76, "Icon-App-76x76@2x.png": 152,
        "Icon-App-83.5x83.5@2x.png": 167,
        "Icon-App-1024x1024@1x.png": 1024,
    ]
    for (name, px) in sizes.sorted(by: { $0.key < $1.key }) {
        writePNG(render(direction: winner, size: px), to: "\(out)/\(name)")
    }
    print("iPad: wrote \(sizes.count) icons to \(out)")

case "macos":
    let iconset = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("SpeakEasy-\(UUID().uuidString).iconset")
    try! FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
    for base in [16, 32, 128, 256, 512] {
        writePNG(render(direction: winner, size: base, shape: .macOSGrid),
                 to: iconset.appendingPathComponent("icon_\(base)x\(base).png").path)
        writePNG(render(direction: winner, size: base * 2, shape: .macOSGrid),
                 to: iconset.appendingPathComponent("icon_\(base)x\(base)@2x.png").path)
    }
    let destination = URL(fileURLWithPath: out)
    try! FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
    let icns = destination.appendingPathComponent("AppIcon.icns")
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
    process.arguments = ["-c", "icns", iconset.path, "-o", icns.path]
    try! process.run()
    process.waitUntilExit()
    try? FileManager.default.removeItem(at: iconset)
    guard process.terminationStatus == 0 else { fail("iconutil failed (\(process.terminationStatus))") }
    print("macOS: wrote \(icns.path)")

case "landing":
    writePNG(render(direction: winner, size: 512), to: out)
    print("landing: wrote \(out)")

case "master":
    writePNG(render(direction: winner, size: 1024), to: "\(out)/speakeasy-mark-1024.png")
    print("master: wrote \(out)/speakeasy-mark-1024.png")

case "studies":
    for direction in Direction.allCases {
        let prefix = String(format: "%02d-%@", direction.number, direction.slug)
        writePNG(render(direction: direction, size: 1024), to: "\(out)/\(prefix)-1024.png")
        writePNG(renderLegibilitySheet(direction), to: "\(out)/\(prefix)-legibility.png")
    }
    writePNG(renderContactSheet(), to: "\(out)/contact-sheet.png")
    print("studies: wrote \(Direction.allCases.count) directions and legibility sheets to \(out)")

default:
    fail("unknown target: \(target)")
}
