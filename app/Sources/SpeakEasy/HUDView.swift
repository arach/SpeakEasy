import SwiftUI
import Foundation

// MARK: - HUD Message Model

struct HUDMessage: Codable {
    let text: String
    let provider: String
    let cached: Bool
    let timestamp: TimeInterval
}

// MARK: - HUD Window Manager (Singleton)

class HUDWindowManager: ObservableObject {
    static let shared = HUDWindowManager()

    @Published var currentMessage: HUDMessage?
    @Published var isVisible = false

    private var hideTimer: Timer?
    private var hudDuration: TimeInterval = 3.0
    private var isStarted = false

    private init() {}

    func start() {
        guard !isStarted else { return }
        isStarted = true

        // Start the singleton pipe reader
        PipeReaderService.shared.start { [weak self] message in
            DispatchQueue.main.async {
                self?.showMessage(message)
            }
        }
    }

    func stop() {
        // Don't actually stop - keep pipe reader running as singleton
        hideTimer?.invalidate()
        hideTimer = nil
    }

    private func showMessage(_ message: HUDMessage) {
        currentMessage = message
        withAnimation(.easeOut(duration: 0.3)) {
            isVisible = true
        }

        // Schedule hide
        hideTimer?.invalidate()
        hideTimer = Timer.scheduledTimer(withTimeInterval: hudDuration, repeats: false) { [weak self] _ in
            self?.hideMessage()
        }
    }

    private func hideMessage() {
        withAnimation(.easeIn(duration: 0.3)) {
            isVisible = false
        }
    }
}

// MARK: - Pipe Reader Service (Singleton)

class PipeReaderService {
    static let shared = PipeReaderService()

    private let pipePath = "/tmp/speakeasy-hud.fifo"
    private var isRunning = false
    private let readQueue = DispatchQueue(label: "com.speakeasy.hud.pipe", qos: .userInitiated)
    private var onMessage: ((HUDMessage) -> Void)?
    private let lock = NSLock()

    private init() {}

    func start(onMessage: @escaping (HUDMessage) -> Void) {
        lock.lock()
        defer { lock.unlock() }

        self.onMessage = onMessage

        guard !isRunning else { return }
        isRunning = true

        // Create the named pipe if it doesn't exist
        createPipe()

        // Start reading in background
        readQueue.async { [weak self] in
            self?.readLoop()
        }
    }

    func stop() {
        lock.lock()
        defer { lock.unlock() }
        isRunning = false
    }

    private func createPipe() {
        let fileManager = FileManager.default

        // Only create if doesn't exist (don't remove - might have writer waiting)
        if !fileManager.fileExists(atPath: pipePath) {
            let result = mkfifo(pipePath, 0o666)
            if result != 0 && errno != EEXIST {
                print("Failed to create FIFO: \(String(cString: strerror(errno)))")
            }
        }
    }

    private func readLoop() {
        while isRunning {
            // Open pipe - this blocks until a writer connects
            guard let fileHandle = FileHandle(forReadingAtPath: pipePath) else {
                // Pipe doesn't exist, wait and retry
                Thread.sleep(forTimeInterval: 0.5)
                createPipe()
                continue
            }

            // Read until pipe closes or we're stopped
            var shouldReopen = false
            while isRunning && !shouldReopen {
                autoreleasepool {
                    do {
                        // Use the Swift-throwing API instead of availableData
                        // which throws ObjC exceptions that Swift can't catch
                        guard let data = try fileHandle.read(upToCount: 4096) else {
                            // EOF or error
                            shouldReopen = true
                            return
                        }

                        if data.isEmpty {
                            // Pipe was closed by writer, break to reopen
                            shouldReopen = true
                            return
                        }

                        guard let jsonString = String(data: data, encoding: .utf8) else {
                            return
                        }

                        // Split by newlines in case multiple messages arrived
                        let lines = jsonString.components(separatedBy: "\n").filter { !$0.isEmpty }

                        for line in lines {
                            if let jsonData = line.data(using: .utf8),
                               let message = try? JSONDecoder().decode(HUDMessage.self, from: jsonData) {
                                onMessage?(message)
                            }
                        }
                    } catch {
                        // FileHandle became invalid or other read error
                        // Close and reopen the pipe
                        shouldReopen = true
                    }
                }
            }

            // Safely close the file handle
            do {
                try fileHandle.close()
            } catch {
                // Ignore close errors
            }
        }
    }
}

// MARK: - HUD View

struct HUDOverlayView: View {
    @ObservedObject private var manager = HUDWindowManager.shared
    @Environment(\.theme) var theme
    let position: HUDPosition
    let opacity: Double

    var body: some View {
        GeometryReader { geometry in
            if manager.isVisible, let message = manager.currentMessage {
                HUDContent(message: message, theme: theme)
                    .opacity(opacity)
                    .position(getPosition(in: geometry.size))
                    .transition(.asymmetric(
                        insertion: .scale.combined(with: .opacity),
                        removal: .opacity
                    ))
            }
        }
        .ignoresSafeArea()
        .onAppear {
            manager.start()
        }
        .onDisappear {
            // Don't stop - singleton keeps running
        }
    }

    private func getPosition(in size: CGSize) -> CGPoint {
        let padding: CGFloat = 20
        let menuBarHeight: CGFloat = 28 // Account for macOS menu bar at top
        let hudWidth: CGFloat = 450
        let hudHeight: CGFloat = 120

        switch position {
        case .topLeft:
            return CGPoint(x: hudWidth / 2 + padding, y: hudHeight / 2 + padding + menuBarHeight)
        case .topRight:
            return CGPoint(x: size.width - hudWidth / 2 - padding, y: hudHeight / 2 + padding + menuBarHeight)
        case .bottomLeft:
            return CGPoint(x: hudWidth / 2 + padding, y: size.height - hudHeight / 2 - padding)
        case .bottomRight:
            return CGPoint(x: size.width - hudWidth / 2 - padding, y: size.height - hudHeight / 2 - padding)
        }
    }
}

enum HUDPosition: String, CaseIterable {
    case topLeft = "top-left"
    case topRight = "top-right"
    case bottomLeft = "bottom-left"
    case bottomRight = "bottom-right"
}

// MARK: - Combined Style HUD Content (matches preview)

struct HUDContent: View {
    let message: HUDMessage
    let theme: Theme
    @ObservedObject private var config = ConfigManager.shared

    private var waveformColor: Color {
        switch config.hudWaveformColor.lowercased() {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        case "orange": return .orange
        case "cyan": return .cyan
        case "pink": return .pink
        default:
            // Check for hex color
            if config.hudWaveformColor.hasPrefix("#") {
                return Color(hex: config.hudWaveformColor) ?? .white
            }
            return .white
        }
    }

    private var fontSize: CGFloat {
        switch config.hudTextSize {
        case "xs": return 10
        case "sm": return 12
        case "md": return 14
        case "lg": return 16
        case "xl": return 18
        default: return 14
        }
    }

    private var fontDesign: Font.Design {
        switch config.hudTextFont {
        case "mono": return .monospaced
        case "serif": return .serif
        case "rounded": return .rounded
        default: return .default
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Text section at top
            HUDTextSection(
                text: message.text,
                cached: message.cached,
                fontSize: fontSize,
                fontDesign: fontDesign
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Waveform at bottom
            HUDWaveformSection(
                barCount: config.hudWaveformBarCount,
                amplitudeMultiplier: config.hudWaveformAmplitude,
                color: waveformColor
            )
            .frame(height: 35)
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .frame(width: 450, height: 120)
        .background(
            ZStack {
                // Super dark black background
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.black.opacity(0.85))

                // Subtle border for definition
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
            }
        )
    }
}

// MARK: - Text Section

struct HUDTextSection: View {
    let text: String
    let cached: Bool
    let fontSize: CGFloat
    let fontDesign: Font.Design

    var body: some View {
        VStack(spacing: 4) {
            // Cached indicator if applicable
            if cached {
                HStack(spacing: 3) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 8))
                    Text("CACHED")
                        .font(.system(size: 7, weight: .bold, design: .monospaced))
                }
                .foregroundColor(Color.cyan)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.cyan.opacity(0.2))
                .cornerRadius(4)
            }

            // Main text
            Text(text)
                .font(.system(size: fontSize, weight: .light, design: fontDesign))
                .foregroundColor(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Waveform Section (TimelineView for smooth animation)

struct HUDWaveformSection: View {
    let barCount: Int
    let amplitudeMultiplier: Double
    let color: Color

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.016)) { timeline in
            Canvas { context, size in
                let currentTime = timeline.date.timeIntervalSinceReferenceDate
                let centerY = size.height / 2

                let effectiveBarCount = max(10, min(60, barCount))
                let gap: CGFloat = 3
                let totalGaps = CGFloat(effectiveBarCount - 1) * gap
                let barWidth = (size.width - totalGaps) / CGFloat(effectiveBarCount)

                for i in 0..<effectiveBarCount {
                    let x = CGFloat(i) * (barWidth + gap)

                    // Golden ratio seeding for unique per-bar character
                    let seed = Double(i) * 1.618033988749
                    let seedFrac = seed.truncatingRemainder(dividingBy: 1.0)

                    // Each bar has its own dance
                    let primarySpeed = 4.0 + seedFrac * 2.5
                    let primaryPhase = seed * 0.7
                    let primary = sin(currentTime * primarySpeed + primaryPhase)

                    let secondarySpeed = 7.0 + (1.0 - seedFrac) * 3.0
                    let secondary = sin(currentTime * secondarySpeed + seed * 1.3) * 0.3

                    let combined = primary + secondary
                    let normalized = (combined / 1.3 + 1) / 2

                    // Base height + animation
                    let minHeight: CGFloat = 3
                    let baseRange: CGFloat = 8 * amplitudeMultiplier
                    let baseHeight = minHeight + (normalized * baseRange)

                    // Add simulated "audio" variation
                    let audioBoost: CGFloat = 12 * amplitudeMultiplier
                    let audioVariation = sin(currentTime * 3.0 + Double(i) * 0.3) * 0.5 + 0.5
                    let totalHeight = baseHeight + (audioVariation * audioBoost)

                    let rect = CGRect(
                        x: x,
                        y: centerY - totalHeight / 2,
                        width: barWidth,
                        height: totalHeight
                    )

                    let path = RoundedRectangle(cornerRadius: barWidth / 2)
                        .path(in: rect)

                    context.fill(path, with: .color(color.opacity(0.8)))
                }
            }
        }
    }
}
