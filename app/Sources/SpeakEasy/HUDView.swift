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
        let hudSize = CGSize(width: 400, height: 100)

        switch position {
        case .topLeft:
            return CGPoint(x: hudSize.width / 2 + padding, y: hudSize.height / 2 + padding)
        case .topRight:
            return CGPoint(x: size.width - hudSize.width / 2 - padding, y: hudSize.height / 2 + padding)
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

    var body: some View {
        HStack(spacing: 12) {
            // Provider icon
            Image(systemName: providerIcon)
                .font(.system(size: 24))
                .foregroundColor(theme.text.opacity(0.9))
                .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(providerDisplayName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(theme.text.opacity(0.7))

                    if message.cached {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 10))
                            .foregroundColor(theme.text.opacity(0.6))
                    }
                }

                Text(message.text)
                    .font(.system(size: 14))
                    .foregroundColor(theme.text)
                    .lineLimit(2)
                    .truncationMode(.tail)
            }

            Spacer()
        }
        .padding(16)
        .frame(width: 400)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(theme.background.opacity(0.95))
                .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(theme.border, lineWidth: 1)
                )
        )
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
