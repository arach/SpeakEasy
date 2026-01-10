import SwiftUI
import Foundation

// MARK: - HUD Message Model

struct HUDMessage: Codable {
    let text: String
    let provider: String
    let cached: Bool
    let timestamp: TimeInterval
}

// MARK: - HUD Window Manager

class HUDWindowManager: ObservableObject {
    @Published var currentMessage: HUDMessage?
    @Published var isVisible = false

    private var pipeReader: PipeReader?
    private var hideTimer: Timer?
    private let hudDuration: TimeInterval

    init(duration: TimeInterval = 3.0) {
        self.hudDuration = duration
    }

    func start() {
        pipeReader = PipeReader { [weak self] message in
            DispatchQueue.main.async {
                self?.showMessage(message)
            }
        }
        pipeReader?.start()
    }

    func stop() {
        pipeReader?.stop()
        pipeReader = nil
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

// MARK: - Pipe Reader

class PipeReader {
    private let pipePath = "/tmp/speakeasy-hud.fifo"
    private var isRunning = false
    private var readQueue: DispatchQueue
    private let onMessage: (HUDMessage) -> Void

    init(onMessage: @escaping (HUDMessage) -> Void) {
        self.onMessage = onMessage
        self.readQueue = DispatchQueue(label: "com.speakeasy.hud.pipe", qos: .userInitiated)
    }

    func start() {
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
        isRunning = false
    }

    private func createPipe() {
        let fileManager = FileManager.default

        // Remove old pipe if exists
        if fileManager.fileExists(atPath: pipePath) {
            try? fileManager.removeItem(atPath: pipePath)
        }

        // Create new FIFO
        let result = mkfifo(pipePath, 0o666)
        if result != 0 && errno != EEXIST {
            print("Failed to create FIFO: \(String(cString: strerror(errno)))")
        }
    }

    private func readLoop() {
        guard let fileHandle = FileHandle(forReadingAtPath: pipePath) else {
            print("Failed to open pipe for reading")
            return
        }

        defer {
            fileHandle.closeFile()
        }

        while isRunning {
            autoreleasepool {
                let data = fileHandle.availableData

                if data.isEmpty {
                    // Pipe was closed, reopen it
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
                        onMessage(message)
                    }
                }
            }
        }
    }
}

// MARK: - HUD View

struct HUDOverlayView: View {
    @StateObject private var manager = HUDWindowManager()
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
            manager.stop()
        }
    }

    private func getPosition(in size: CGSize) -> CGPoint {
        let padding: CGFloat = 20
        let menuBarHeight: CGFloat = 28 // Account for macOS menu bar at top
        let hudSize = CGSize(width: 400, height: 100)

        switch position {
        case .topLeft:
            return CGPoint(x: hudSize.width / 2 + padding, y: hudSize.height / 2 + padding + menuBarHeight)
        case .topRight:
            return CGPoint(x: size.width - hudSize.width / 2 - padding, y: hudSize.height / 2 + padding + menuBarHeight)
        case .bottomLeft:
            return CGPoint(x: hudSize.width / 2 + padding, y: size.height - hudSize.height / 2 - padding)
        case .bottomRight:
            return CGPoint(x: size.width - hudSize.width / 2 - padding, y: size.height - hudSize.height / 2 - padding)
        }
    }
}

enum HUDPosition: String, CaseIterable {
    case topLeft = "top-left"
    case topRight = "top-right"
    case bottomLeft = "bottom-left"
    case bottomRight = "bottom-right"
}

struct HUDContent: View {
    let message: HUDMessage
    let theme: Theme
    @State private var wavePhase: Double = 0
    @State private var scanlineOffset: CGFloat = 0
    @ObservedObject private var config = ConfigManager.shared

    private var accentColor: Color {
        // Use configured waveform color, or fall back to provider color
        switch config.hudWaveformColor.lowercased() {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        case "orange": return .orange
        case "cyan": return .cyan
        case "pink": return .pink
        case "white": return providerColor // Use provider color when white
        default: return providerColor
        }
    }

    private var textFontDesign: Font.Design {
        switch config.hudTextFont {
        case "mono": return .monospaced
        case "serif": return .serif
        case "rounded": return .rounded
        default: return .default
        }
    }

    private var textFontSize: CGFloat {
        switch config.hudTextSize {
        case "xs": return 11
        case "sm": return 13
        case "md": return 15
        case "lg": return 17
        case "xl": return 19
        default: return 15
        }
    }

    var body: some View {
        ZStack {
            // Animated background waves
            WaveformBackground(phase: wavePhase, color: accentColor)
                .opacity(0.1)

            // Scanline effect
            ScanlineOverlay(offset: scanlineOffset)
                .opacity(0.05)

            // Main content
            HStack(spacing: 16) {
                // Provider icon with glow
                ZStack {
                    Circle()
                        .fill(providerColor.opacity(0.15))
                        .frame(width: 50, height: 50)
                        .blur(radius: 8)

                    Image(systemName: providerIcon)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(providerColor)
                        .shadow(color: providerColor.opacity(0.6), radius: 8)
                }

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text(providerDisplayName.uppercased())
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(providerColor)
                            .tracking(1.2)

                        if message.cached {
                            HStack(spacing: 3) {
                                Image(systemName: "bolt.fill")
                                    .font(.system(size: 8))
                                Text("CACHED")
                                    .font(.system(size: 7, weight: .bold, design: .monospaced))
                            }
                            .foregroundColor(Color.cyan)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.cyan.opacity(0.2))
                            .cornerRadius(3)
                        }
                    }

                    Text(message.text)
                        .font(.system(size: textFontSize, weight: .medium, design: textFontDesign))
                        .foregroundColor(.white.opacity(0.95))
                        .lineLimit(2)
                        .truncationMode(.tail)

                    // Audio wave indicator
                    AudioWaveIndicator(color: accentColor, phase: wavePhase, barCount: config.hudWaveformBarCount)
                        .frame(height: 18)
                }

                Spacer()
            }
            .padding(16)
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
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                wavePhase = .pi * 2
            }
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                scanlineOffset = 120
            }
        }
    }

    private var providerColor: Color {
        switch message.provider {
        case "system":
            return .blue
        case "openai":
            return .green
        case "elevenlabs":
            return .purple
        case "groq":
            return .orange
        case "gemini":
            return .cyan
        default:
            return .white
        }
    }

    private var providerIcon: String {
        switch message.provider {
        case "system":
            return "speaker.wave.2.fill"
        case "openai":
            return "waveform.circle.fill"
        case "elevenlabs":
            return "waveform.badge.mic"
        case "groq":
            return "bolt.circle.fill"
        case "gemini":
            return "sparkles"
        default:
            return "speaker.fill"
        }
    }

    private var providerDisplayName: String {
        switch message.provider {
        case "system":
            return "System Voice"
        case "openai":
            return "OpenAI"
        case "elevenlabs":
            return "ElevenLabs"
        case "groq":
            return "Groq"
        case "gemini":
            return "Gemini"
        default:
            return message.provider.capitalized
        }
    }
}

// MARK: - Animation Components

struct WaveformBackground: View {
    let phase: Double
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(0..<3, id: \.self) { index in
                    WavePath(phase: phase, offset: Double(index) * 0.5)
                        .stroke(
                            color.opacity(0.3 - Double(index) * 0.1),
                            lineWidth: 2
                        )
                }
            }
        }
    }
}

struct WavePath: Shape {
    var phase: Double
    let offset: Double

    var animatableData: Double {
        get { phase }
        set { phase = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let midHeight = height / 2
        let wavelength = width / 4
        let amplitude = height / 8

        path.move(to: CGPoint(x: 0, y: midHeight))

        for x in stride(from: 0, through: width, by: 1) {
            let relativeX = x / wavelength
            let normalizedPhase = (phase + offset) / (.pi * 2)
            let sine = sin((relativeX + normalizedPhase) * .pi * 2)
            let y = midHeight + sine * amplitude
            path.addLine(to: CGPoint(x: x, y: y))
        }

        return path
    }
}

struct ScanlineOverlay: View {
    let offset: CGFloat

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 4) {
                ForEach(0..<Int(geometry.size.height / 4), id: \.self) { _ in
                    Rectangle()
                        .fill(Color.white.opacity(0.05))
                        .frame(height: 1)
                }
            }
            .offset(y: offset.truncatingRemainder(dividingBy: geometry.size.height))
        }
    }
}

struct AudioWaveIndicator: View {
    let color: Color
    let phase: Double
    var barCount: Int = 20

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<barCount, id: \.self) { index in
                RoundedRectangle(cornerRadius: 1)
                    .fill(color.opacity(0.7))
                    .frame(width: 3, height: barHeight(for: index))
            }
        }
    }

    private func barHeight(for index: Int) -> CGFloat {
        let normalizedIndex = Double(index) / Double(barCount)
        let offset = normalizedIndex * .pi * 2
        let sine = sin(phase + offset)
        let normalized = (sine + 1) / 2 // 0 to 1
        return 3 + normalized * 12
    }
}
