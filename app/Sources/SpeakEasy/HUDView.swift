import SwiftUI
import Foundation

// MARK: - HUD Message Model

struct HUDMessage: Codable {
    let text: String?          // nil for level-only updates
    let provider: String?
    let cached: Bool?
    let timestamp: TimeInterval?
    let audioLevel: Float?     // 0.0 to 1.0, for waveform amplitude

    var isLevelUpdate: Bool {
        text == nil && audioLevel != nil
    }
}

// MARK: - HUD Window Manager (Singleton)

class HUDWindowManager: ObservableObject {
    static let shared = HUDWindowManager()

    @Published var currentMessage: HUDMessage?
    @Published var isVisible = false
    @Published var audioLevel: Float = 0.0  // Current audio level for waveform

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
                self?.handleMessage(message)
            }
        }
    }

    func stop() {
        // Don't actually stop - keep pipe reader running as singleton
        hideTimer?.invalidate()
        hideTimer = nil
    }

    private func handleMessage(_ message: HUDMessage) {
        if message.isLevelUpdate {
            // Just update audio level, don't reset timer
            audioLevel = message.audioLevel ?? 0.0
        } else {
            // New text message
            showMessage(message)
        }
    }

    private func showMessage(_ message: HUDMessage) {
        currentMessage = message
        audioLevel = message.audioLevel ?? 0.0

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
        audioLevel = 0.0
    }

    func dismiss() {
        hideTimer?.invalidate()
        hideTimer = nil
        hideMessage()
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
                HUDContent(message: message, theme: theme, audioLevel: manager.audioLevel)
                    .opacity(opacity)
                    .position(getPosition(in: geometry.size))
                    .transition(.asymmetric(
                        insertion: .move(edge: entryEdge).combined(with: .opacity),
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

    private var entryEdge: Edge {
        switch position {
        case .topLeft, .topRight:
            return .top
        case .bottomLeft, .bottomRight:
            return .bottom
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
    let audioLevel: Float
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
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 0) {
                // Text section at top
                HUDTextSection(
                    text: message.text ?? "",
                    cached: message.cached ?? false,
                    fontSize: fontSize,
                    fontDesign: fontDesign
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Waveform at bottom
                HUDWaveformSection(
                    barCount: config.hudWaveformBarCount,
                    amplitudeMultiplier: config.hudWaveformAmplitude,
                    color: waveformColor,
                    audioLevel: audioLevel
                )
                .frame(height: 35)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }

            // Dismiss button
            Button(action: {
                HUDWindowManager.shared.dismiss()
            }) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white.opacity(0.4))
                    .frame(width: 20, height: 20)
                    .background(Color.white.opacity(0.1))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(8)
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

// MARK: - Text Section (with word-by-word animation)

struct HUDTextSection: View {
    let text: String
    let cached: Bool
    let fontSize: CGFloat
    let fontDesign: Font.Design

    @State private var visibleWordCount: Int = 0
    @State private var animationTimer: Timer?

    private var words: [String] {
        text.split(separator: " ").map(String.init)
    }

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

            // Animated word-by-word text
            FlowingText(
                words: words,
                visibleCount: visibleWordCount,
                fontSize: fontSize,
                fontDesign: fontDesign
            )
            .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            startWordAnimation()
        }
        .onDisappear {
            animationTimer?.invalidate()
        }
    }

    private func startWordAnimation() {
        visibleWordCount = 0
        // Show words at roughly speech pace (150-200 WPM = ~3-4 words/sec)
        let interval = 0.25 // 4 words per second
        animationTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            withAnimation(.easeOut(duration: 0.15)) {
                if visibleWordCount < words.count {
                    visibleWordCount += 1
                } else {
                    animationTimer?.invalidate()
                }
            }
        }
    }
}

struct FlowingText: View {
    let words: [String]
    let visibleCount: Int
    let fontSize: CGFloat
    let fontDesign: Font.Design

    var body: some View {
        // Use Text concatenation for proper line wrapping
        words.enumerated().reduce(Text("")) { result, item in
            let (index, word) = item
            let separator = index == 0 ? "" : " "
            let wordText = Text(separator + word)
                .font(.system(size: fontSize, weight: index == visibleCount - 1 ? .medium : .light, design: fontDesign))
                .foregroundColor(index < visibleCount ? .white.opacity(index == visibleCount - 1 ? 0.95 : 0.7) : .clear)
            return result + wordText
        }
        .multilineTextAlignment(.center)
        .lineLimit(3)
    }
}

// MARK: - Waveform Section (Audio-reactive)

struct HUDWaveformSection: View {
    let barCount: Int
    let amplitudeMultiplier: Double
    let color: Color
    let audioLevel: Float  // 0.0 to 1.0 from audio input

    private var effectiveBarCount: Int {
        max(10, min(60, barCount))
    }

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 3) {
                ForEach(0..<effectiveBarCount, id: \.self) { i in
                    WaveformBar(
                        index: i,
                        totalBars: effectiveBarCount,
                        width: barWidth(in: geometry.size),
                        amplitudeMultiplier: amplitudeMultiplier,
                        color: color,
                        audioLevel: audioLevel
                    )
                }
            }
            .frame(maxHeight: .infinity)
        }
    }

    private func barWidth(in size: CGSize) -> CGFloat {
        let gap: CGFloat = 3
        let totalGaps = CGFloat(effectiveBarCount - 1) * gap
        return (size.width - totalGaps) / CGFloat(effectiveBarCount)
    }
}

// Individual bar - height driven by audio level
struct WaveformBar: View {
    let index: Int
    let totalBars: Int
    let width: CGFloat
    let amplitudeMultiplier: Double
    let color: Color
    let audioLevel: Float

    // Pre-computed constants for this bar
    private let baseHeight: CGFloat
    private let maxBoost: CGFloat
    private let phaseOffset: Double

    init(index: Int, totalBars: Int, width: CGFloat, amplitudeMultiplier: Double, color: Color, audioLevel: Float) {
        self.index = index
        self.totalBars = totalBars
        self.width = width
        self.amplitudeMultiplier = amplitudeMultiplier
        self.color = color
        self.audioLevel = audioLevel

        // Golden ratio for varied distribution
        let seed = Double(index) * 1.618033988749
        let seedFrac = seed.truncatingRemainder(dividingBy: 1.0)

        // Base height when no audio (small idle state)
        self.baseHeight = (3 + seedFrac * 3) * amplitudeMultiplier

        // Max additional height when audio is loud
        self.maxBoost = (15 + seedFrac * 10) * amplitudeMultiplier

        // Phase offset for wave effect across bars
        self.phaseOffset = Double(index) / Double(max(1, totalBars))
    }

    private var height: CGFloat {
        // Audio level drives amplitude, with slight per-bar variation
        let levelVariation = sin(phaseOffset * .pi * 2) * 0.15 + 1.0
        let effectiveLevel = CGFloat(audioLevel) * levelVariation
        return baseHeight + (maxBoost * effectiveLevel)
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(color.opacity(0.8))
            .frame(width: width, height: height)
            .animation(.easeOut(duration: 0.05), value: audioLevel)
    }
}
