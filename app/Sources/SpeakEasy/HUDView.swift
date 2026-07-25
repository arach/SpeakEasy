import SwiftUI
import Foundation
import AppKit
import Combine

// MARK: - HUD Message Model

struct HUDMessage: Codable {
    let text: String?          // nil for level-only updates
    let provider: String?
    let cached: Bool?
    let timestamp: TimeInterval?
    let audioLevel: Float?     // 0.0 to 1.0, for waveform amplitude
    let sourceThreadId: String?

    var isLevelUpdate: Bool {
        text == nil && audioLevel != nil
    }
}

struct HUDConversationPresentation: Equatable {
    let phase: ListeningPhase
    let taskTitle: String
    let taskID: String
    let laneNumber: Int?
    let transcript: String
    let error: String?
    let inputDeviceName: String?

    var accent: Color {
        switch phase {
        case .recording: Color(red: 0.28, green: 0.94, blue: 0.68)
        case .cueing: Color(red: 1, green: 0.72, blue: 0.32)
        case .warmingUp, .transcribing: Color(red: 0.58, green: 0.72, blue: 1)
        case .submitting: Color(red: 0.37, green: 0.82, blue: 1)
        case .preparingSpeech, .speaking: Color(red: 0.76, green: 0.56, blue: 1)
        case .failed: Color(red: 1, green: 0.53, blue: 0.36)
        default: Color(red: 0.36, green: 0.87, blue: 0.66)
        }
    }

    var title: String {
        switch phase {
        case .validatingLock: "Locking onto task"
        case .cueing: laneNumber.map { "Lane \($0) confirmed" } ?? "Lane confirmed"
        case .ready: "Ready when you are"
        case .warmingUp: "Warming up Vox"
        case .recording: "Listening to you"
        case .transcribing: "Understanding that"
        case .submitting: "Talking to this task"
        case .preparingSpeech: "Preparing its voice"
        case .speaking: "Speaking back"
        case .failed: "Voice loop needs attention"
        case .unlocked: "Choose a task"
        }
    }

    var detail: String {
        if phase == .failed, let error, !error.isEmpty { return error }
        switch phase {
        case .validatingLock: return "Verifying the exact Codex task"
        case .cueing: return taskTitle
        case .ready:
            if let laneNumber { return "Press ⌘⌥\(laneNumber) for this lane or ⌃⌥Space" }
            return "Press ⌃⌥Space and speak"
        case .warmingUp: return "Opening the microphone before Vox warmup"
        case .recording:
            if let inputDeviceName { return "⌃⌥Space to send · \(inputDeviceName)" }
            return "⌃⌥Space to stop and send"
        case .transcribing: return "Turning this utterance into text"
        case .submitting:
            return transcript.isEmpty ? "Routing through Codex Desktop" : transcript
        case .preparingSpeech: return "Using your configured SpeakEasy voice"
        case .speaking: return "⌃⌥Space interrupts and listens again"
        case .failed: return "Open SpeakEasy for details"
        case .unlocked: return "Lock SpeakEasy before listening"
        }
    }

    var symbol: String {
        switch phase {
        case .validatingLock: "scope"
        case .cueing: "speaker.wave.2.fill"
        case .ready: "waveform.badge.mic"
        case .warmingUp: "brain.head.profile"
        case .recording: "mic.fill"
        case .transcribing: "text.bubble.fill"
        case .submitting: "arrow.up.forward"
        case .preparingSpeech: "sparkles"
        case .speaking: "speaker.wave.2.fill"
        case .failed: "exclamationmark.triangle.fill"
        case .unlocked: "lock.open.fill"
        }
    }
}

// MARK: - HUD Window Manager (Singleton)

@MainActor
class HUDWindowManager: ObservableObject {
    static let shared = HUDWindowManager()

    @Published var currentMessage: HUDMessage?
    @Published var isVisible = false
    @Published var audioLevel: Float = 0.0  // Current audio level for waveform
    @Published var playbackProgress: Double?
    @Published var conversation: HUDConversationPresentation?

    private var hideTimer: Timer?
    private var hudDuration: TimeInterval = 3.0
    private var isStarted = false
    private var visibilityHandler: ((Bool) -> Void)?
    private var listeningObservation: AnyCancellable?
    private var lastListeningPhase: ListeningPhase = .unlocked

    private init() {}

    func start(duration: TimeInterval? = nil) {
        if let duration {
            hudDuration = duration
        }
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
        listeningObservation = nil
    }

    func bindListening(_ controller: ListeningSessionController) {
        guard listeningObservation == nil else { return }
        listeningObservation = Publishers.CombineLatest(
            Publishers.CombineLatest4(
                controller.$phase,
                controller.$lockedTask,
                controller.$lastTranscript,
                controller.$lastError
            ),
            controller.$activeLaneNumber
        )
        .receive(on: RunLoop.main)
        .sink { [weak self, weak controller] values, laneNumber in
            let (phase, lock, transcript, error) = values
            self?.updateListening(
                phase: phase,
                lock: lock,
                laneNumber: laneNumber,
                transcript: transcript,
                error: error,
                inputDeviceName: controller?.inputDeviceName
            )
        }
    }

    func setVisibilityHandler(_ handler: @escaping (Bool) -> Void) {
        visibilityHandler = handler
    }

    func showPlayback(_ item: PlaybackItem) {
        hideTimer?.invalidate()
        hideTimer = nil
        playbackProgress = 0
        currentMessage = HUDMessage(
            text: item.text ?? item.title,
            provider: item.provider,
            cached: nil,
            timestamp: Date().timeIntervalSince1970,
            audioLevel: 0,
            sourceThreadId: item.sourceThreadId
        )
        audioLevel = 0
        showWindow()
    }

    func updatePlayback(audioLevel: Float, currentTime: TimeInterval, duration: TimeInterval) {
        self.audioLevel = audioLevel
        guard playbackProgress != nil, duration > 0 else { return }
        playbackProgress = min(max(currentTime / duration, 0), 1)
    }

    func playbackDidFinish() {
        guard playbackProgress != nil else { return }
        playbackProgress = 1
        audioLevel = 0
        scheduleHide()
    }

    private func updateListening(
        phase: ListeningPhase,
        lock: ListeningTaskLock?,
        laneNumber: Int?,
        transcript: String,
        error: String?,
        inputDeviceName: String?
    ) {
        defer { lastListeningPhase = phase }
        guard let lock, phase != .unlocked else {
            conversation = nil
            if playbackProgress == nil { hideMessage() }
            return
        }

        conversation = HUDConversationPresentation(
            phase: phase,
            taskTitle: lock.title,
            taskID: lock.id,
            laneNumber: laneNumber,
            transcript: transcript,
            error: error,
            inputDeviceName: inputDeviceName
        )

        hideTimer?.invalidate()
        hideTimer = nil
        showWindow()
        switch phase {
        case .ready:
            if lastListeningPhase != .ready { scheduleHide(after: 2.8) }
        case .failed:
            scheduleHide(after: 8)
        case .speaking:
            break // Playback completion owns dismissal.
        default:
            break // Keep active work visible until the phase changes.
        }
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
        playbackProgress = nil
        currentMessage = message
        audioLevel = message.audioLevel ?? 0.0
        showWindow()
        scheduleHide()
    }

    private func showWindow() {
        withAnimation(.easeOut(duration: 0.25)) {
            isVisible = true
        }
        visibilityHandler?(true)
    }

    private func scheduleHide(after duration: TimeInterval? = nil) {
        hideTimer?.invalidate()
        hideTimer = Timer.scheduledTimer(withTimeInterval: duration ?? hudDuration, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.hideMessage() }
        }
    }

    private func hideMessage() {
        withAnimation(.easeIn(duration: 0.3)) {
            isVisible = false
        }
        audioLevel = 0.0
        playbackProgress = nil
        visibilityHandler?(false)
    }

    func dismiss() {
        hideTimer?.invalidate()
        hideTimer = nil
        hideMessage()
    }
}

enum CodexTaskLink {
    static func url(threadId: String?) -> URL? {
        guard let threadId, !threadId.isEmpty else { return nil }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        guard threadId.unicodeScalars.allSatisfy(allowed.contains) else { return nil }
        return URL(string: "codex://threads/\(threadId)")
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
        Group {
            if manager.isVisible {
                Group {
                    if let message = manager.currentMessage,
                       manager.playbackProgress != nil {
                        HUDContent(
                            message: message,
                            theme: theme,
                            audioLevel: manager.audioLevel,
                            playbackProgress: manager.playbackProgress,
                            conversation: manager.conversation
                        )
                    } else if let conversation = manager.conversation {
                        ConversationHUDContent(presentation: conversation)
                    } else if let message = manager.currentMessage {
                        HUDContent(
                            message: message,
                            theme: theme,
                            audioLevel: manager.audioLevel,
                            playbackProgress: manager.playbackProgress
                        )
                    }
                }
                .opacity(opacity)
                .transition(.asymmetric(
                    insertion: .move(edge: entryEdge).combined(with: .opacity),
                    removal: .opacity
                ))
            }
        }
        .frame(width: 480, height: 180)
    }

    private var entryEdge: Edge {
        switch position {
        case .topLeft, .topRight:
            return .top
        case .bottomLeft, .bottomRight:
            return .bottom
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
    let playbackProgress: Double?
    var conversation: HUDConversationPresentation? = nil
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
                if let conversation {
                    HUDTaskLockHeader(presentation: conversation)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                }

                // Text section at top
                HUDTextSection(
                    text: message.text ?? "",
                    cached: message.cached ?? false,
                    fontSize: fontSize,
                    fontDesign: fontDesign,
                    playbackProgress: playbackProgress
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                HStack(spacing: 12) {
                    HUDWaveformSection(
                        barCount: config.hudWaveformBarCount,
                        amplitudeMultiplier: config.hudWaveformAmplitude,
                        color: waveformColor,
                        audioLevel: audioLevel
                    )
                    .frame(height: 30)

                    if let url = CodexTaskLink.url(threadId: message.sourceThreadId) {
                        Button {
                            NSWorkspace.shared.open(url)
                        } label: {
                            Label("Back to Codex", systemImage: "arrow.turn.up.left")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white.opacity(0.82))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(Color.white.opacity(0.1), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .help("Open the Codex task that created this narration")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 14)
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
        .frame(width: 480, height: 180)
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

// MARK: - Thread-locked conversation HUD

struct ConversationHUDContent: View {
    let presentation: HUDConversationPresentation
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : 1.0 / 24.0)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 16) {
                    HUDTaskLockHeader(presentation: presentation)

                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(presentation.accent.opacity(0.12))
                                .frame(width: 54, height: 54)
                            Circle()
                                .stroke(presentation.accent.opacity(0.34), lineWidth: 1)
                                .frame(width: 54, height: 54)
                                .scaleEffect(pulseScale(time))
                                .opacity(pulseOpacity(time))
                            Image(systemName: presentation.symbol)
                                .font(.system(size: 21, weight: .semibold))
                                .foregroundStyle(presentation.accent)
                        }

                        VStack(alignment: .leading, spacing: 5) {
                            Text(presentation.title)
                                .font(.system(size: 18, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                            Text(presentation.detail)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(.white.opacity(0.58))
                                .lineLimit(2)
                        }
                        Spacer(minLength: 8)
                    }

                    ConversationEnergyField(
                        phase: presentation.phase,
                        accent: presentation.accent,
                        time: reduceMotion ? 0 : time
                    )
                    .frame(height: 24)
                }
                .padding(16)

                Button { HUDWindowManager.shared.dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.42))
                        .frame(width: 22, height: 22)
                        .background(.white.opacity(0.08), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(9)
                .accessibilityLabel("Dismiss SpeakEasy conversation HUD")
            }
            .frame(width: 480, height: 180)
            .background(conversationBackground)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("SpeakEasy \(presentation.title). Locked to \(presentation.taskTitle). \(presentation.detail)")
        }
    }

    private var isEnergetic: Bool {
        [.cueing, .warmingUp, .recording, .transcribing, .submitting, .preparingSpeech, .speaking]
            .contains(presentation.phase)
    }

    private func pulseScale(_ time: TimeInterval) -> CGFloat {
        guard isEnergetic, !reduceMotion else { return 1 }
        return 1 + CGFloat((sin(time * 4.2) + 1) * 0.045)
    }

    private func pulseOpacity(_ time: TimeInterval) -> Double {
        guard isEnergetic, !reduceMotion else { return 1 }
        return 0.42 + (sin(time * 4.2) + 1) * 0.18
    }

    private var conversationBackground: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(Color.black.opacity(0.9))
            .overlay {
                RadialGradient(
                    colors: [presentation.accent.opacity(0.19), .clear],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: 360
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(presentation.accent.opacity(0.32), lineWidth: 0.75)
            }
            .shadow(color: presentation.accent.opacity(0.14), radius: 24, y: 10)
    }
}

struct HUDTaskLockHeader: View {
    let presentation: HUDConversationPresentation

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(presentation.accent)
                .frame(width: 6, height: 6)
                .shadow(color: presentation.accent.opacity(0.8), radius: 4)
                .accessibilityHidden(true)
            Text(statusLabel)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(presentation.accent)
            Spacer()
            Image(systemName: "lock.fill")
                .font(.system(size: 8, weight: .bold))
            Text(presentation.taskTitle)
                .lineLimit(1)
            Text(String(presentation.taskID.prefix(8)))
                .fontDesign(.monospaced)
                .foregroundStyle(.white.opacity(0.34))
        }
        .font(.system(size: 10, weight: .semibold, design: .rounded))
        .foregroundStyle(.white.opacity(0.68))
        .padding(.trailing, 28)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(presentation.phase.label). Locked to \(presentation.taskTitle)")
    }

    private var statusLabel: String {
        let status = presentation.phase == .recording ? "LIVE" : presentation.phase.label.uppercased()
        guard let lane = presentation.laneNumber else { return status }
        return "LANE \(lane) · \(status)"
    }
}

struct ConversationEnergyField: View {
    let phase: ListeningPhase
    let accent: Color
    let time: TimeInterval

    private let count = 34

    var body: some View {
        GeometryReader { geometry in
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<count, id: \.self) { index in
                    Capsule()
                        .fill(accent.opacity(opacity(for: index)))
                        .frame(
                            width: max(2, (geometry.size.width - CGFloat(count - 1) * 3) / CGFloat(count)),
                            height: height(for: index)
                        )
                }
            }
            .frame(maxHeight: .infinity)
        }
        .accessibilityHidden(true)
    }

    private func height(for index: Int) -> CGFloat {
        guard phase != .ready && phase != .failed else { return index.isMultiple(of: 5) ? 4 : 2 }
        let phaseOffset = Double(index) * 0.52
        let primary = (sin(time * 5.2 + phaseOffset) + 1) * 0.5
        let secondary = (sin(time * 2.3 - phaseOffset * 0.7) + 1) * 0.5
        return 3 + CGFloat(primary * 13 + secondary * 5)
    }

    private func opacity(for index: Int) -> Double {
        0.34 + (sin(time * 2.1 + Double(index) * 0.31) + 1) * 0.24
    }
}

// MARK: - Text Section (with word-by-word animation)

struct HUDTextSection: View {
    let text: String
    let cached: Bool
    let fontSize: CGFloat
    let fontDesign: Font.Design
    let playbackProgress: Double?

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
                visibleCount: progressWordCount,
                fontSize: fontSize,
                fontDesign: fontDesign
            )
            .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            updateAnimationMode()
        }
        .onChange(of: text) { _, _ in updateAnimationMode() }
        .onChange(of: playbackProgress) { _, _ in updateAnimationMode() }
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

    private var progressWordCount: Int {
        guard let playbackProgress, !words.isEmpty else { return visibleWordCount }
        return min(words.count, max(1, Int(ceil(playbackProgress * Double(words.count)))))
    }

    private func updateAnimationMode() {
        animationTimer?.invalidate()
        animationTimer = nil
        if playbackProgress == nil {
            startWordAnimation()
        }
    }
}

struct FlowingText: View {
    let words: [String]
    let visibleCount: Int
    let fontSize: CGFloat
    let fontDesign: Font.Design

    var body: some View {
        let end = min(words.count, max(visibleCount, 1))
        let start = max(0, end - 42)
        let visibleWords = Array(words[start..<end])

        visibleWords.enumerated().reduce(Text("")) { result, item in
            let (localIndex, word) = item
            let globalIndex = start + localIndex
            let separator = localIndex == 0 ? "" : " "
            let wordText = Text(separator + word)
                .font(.system(size: fontSize, weight: globalIndex == visibleCount - 1 ? .semibold : .regular, design: fontDesign))
                .foregroundColor(.white.opacity(globalIndex == visibleCount - 1 ? 1 : 0.62))
            return result + wordText
        }
        .multilineTextAlignment(.center)
        .lineLimit(5)
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
