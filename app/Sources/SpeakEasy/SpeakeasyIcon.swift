import AppKit

/// A compact rocks-glass mark designed for the 16–18 pt macOS menu bar.
enum SpeakeasyIcon {
    static func tumbler(filled: Bool) -> NSImage {
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { _ in
            NSColor.black.setStroke()
            NSColor.black.setFill()

            // A slightly tapered lowball glass with a deliberately heavy base.
            let glass = NSBezierPath()
            glass.move(to: NSPoint(x: 3.1, y: 14.4))
            glass.line(to: NSPoint(x: 14.9, y: 14.4))
            glass.line(to: NSPoint(x: 13.6, y: 3.2))
            glass.curve(
                to: NSPoint(x: 12.7, y: 2.4),
                controlPoint1: NSPoint(x: 13.5, y: 2.7),
                controlPoint2: NSPoint(x: 13.2, y: 2.4)
            )
            glass.line(to: NSPoint(x: 5.3, y: 2.4))
            glass.curve(
                to: NSPoint(x: 4.4, y: 3.2),
                controlPoint1: NSPoint(x: 4.8, y: 2.4),
                controlPoint2: NSPoint(x: 4.5, y: 2.7)
            )
            glass.close()
            glass.lineWidth = 1.3
            glass.lineJoinStyle = .round

            glass.stroke()

            let rim = NSBezierPath()
            rim.move(to: NSPoint(x: 3.2, y: 14.4))
            rim.line(to: NSPoint(x: 14.8, y: 14.4))
            rim.lineWidth = 1.5
            rim.lineCapStyle = .round
            rim.stroke()

            let base = NSBezierPath()
            base.move(to: NSPoint(x: 5.0, y: 3.0))
            base.line(to: NSPoint(x: 13.0, y: 3.0))
            base.lineWidth = 1.6
            base.lineCapStyle = .round
            base.stroke()

            // The waveform is the brand detail: speech mixed inside the tumbler.
            let waveform = NSBezierPath()
            waveform.move(to: NSPoint(x: 5.2, y: 8.6))
            waveform.line(to: NSPoint(x: 6.3, y: 8.6))
            waveform.line(to: NSPoint(x: 7.2, y: 10.5))
            waveform.line(to: NSPoint(x: 8.1, y: 6.3))
            waveform.line(to: NSPoint(x: 9.1, y: 11.5))
            waveform.line(to: NSPoint(x: 10.1, y: 7.0))
            waveform.line(to: NSPoint(x: 11.0, y: 9.8))
            waveform.line(to: NSPoint(x: 11.8, y: 8.6))
            waveform.line(to: NSPoint(x: 12.8, y: 8.6))
            waveform.lineWidth = filled ? 1.05 : 0.8
            waveform.lineCapStyle = .round
            waveform.lineJoinStyle = .round
            waveform.stroke()

            return true
        }
        image.isTemplate = true
        return image
    }
}
