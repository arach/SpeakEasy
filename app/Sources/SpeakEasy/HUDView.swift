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

    /// Restrained phase accents keep state distinct against the near-black shell.
    var accent: Color {
        switch phase {
        case .recording: Color(red: 0.46, green: 0.78, blue: 0.64)       // jade
        case .cueing: Color(red: 0.88, green: 0.70, blue: 0.42)           // warm gold
        case .warmingUp, .transcribing: Color(red: 0.62, green: 0.70, blue: 0.88) // periwinkle
        case .submitting: Color(red: 0.52, green: 0.70, blue: 0.84)       // steel sky
        case .preparingSpeech, .speaking: Color(red: 0.70, green: 0.62, blue: 0.86) // soft lavender
        case .failed: Color(red: 0.90, green: 0.56, blue: 0.48)           // muted coral
        default: Color(red: 0.52, green: 0.74, blue: 0.64)                // sage
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
        // Header already shows the exact task; body explains the status check.
        case .cueing: return "Status check · microphone is off"
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
        .frame(width: HUDLayout.width, height: HUDLayout.height, alignment: .top)
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

/// Shared geometry for the floating conversation and playback HUD.
enum HUDLayout {
    static let width: CGFloat = 404
    static let height: CGFloat = 132
    static let conversationHeight: CGFloat = 116
    static let screenInset: CGFloat = 12
    static let cornerRadius: CGFloat = 14
    static let contentPadding: CGFloat = 12
    static let sectionSpacing: CGFloat = 12
    static let headerRowHeight: CGFloat = 20
    static let headerGap: CGFloat = 8
    static let iconSize: CGFloat = 32
    static let iconSymbolSize: CGFloat = 13
    static let iconTextGap: CGFloat = 12
    static let titleSize: CGFloat = 14
    static let detailSize: CGFloat = 11
    static let headerStatusSize: CGFloat = 9
    static let headerMetaSize: CGFloat = 9
    static let energyHeight: CGFloat = 16
    static let energyBarCount = 44
    static let energyBarSpacing: CGFloat = 3
    static let dismissSize: CGFloat = 20
    static let dismissPadding: CGFloat = 12
}

/// Shared phase-surface treatment so conversation phases and speaking stay one family.
enum HUDPhaseChrome {
    static let fillOpacity: Double = 0.9
    static let glowOpacity: Double = 0.09
    static let borderOpacity: Double = 0.20
    static let shadowOpacity: Double = 0.07
    static let shadowRadius: CGFloat = 14
    static let shadowY: CGFloat = 7
    static let glowEndRadius: CGFloat = 260
    static let statusDotShadowOpacity: Double = 0.42
    static let statusDotShadowRadius: CGFloat = 2.5
    static let iconFillOpacity: Double = 0.10
    static let iconStrokeOpacity: Double = 0.26
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
        // Locked narration shares the same phase system as the conversation HUD.
        if let conversation {
            return conversation.accent
        }
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
                        .padding(.horizontal, HUDLayout.contentPadding)
                        .padding(.top, 10)
                }

                // Text section at top
                HUDTextSection(
                    text: message.text ?? "",
                    cached: message.cached ?? false,
                    fontSize: min(fontSize, 13),
                    fontDesign: fontDesign,
                    playbackProgress: playbackProgress
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                HStack(spacing: 10) {
                    HUDWaveformSection(
                        barCount: config.hudWaveformBarCount,
                        amplitudeMultiplier: config.hudWaveformAmplitude,
                        color: waveformColor,
                        audioLevel: audioLevel
                    )
                    .frame(height: 22)

                    if let url = CodexTaskLink.url(threadId: message.sourceThreadId) {
                        Button {
                            NSWorkspace.shared.open(url)
                        } label: {
                            Label("Back to Codex", systemImage: "arrow.turn.up.left")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.white.opacity(0.82))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(Color.white.opacity(0.1), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .help("Open the Codex task that created this narration")
                    }
                }
                .padding(.horizontal, HUDLayout.contentPadding)
                .padding(.bottom, 10)
            }

            HUDDismissButton()
        }
        .frame(width: HUDLayout.width, height: HUDLayout.height)
        .background(hudSurfaceBackground)
    }

    @ViewBuilder
    private var hudSurfaceBackground: some View {
        if let conversation {
            phaseSurface(accent: conversation.accent)
        } else {
            RoundedRectangle(cornerRadius: HUDLayout.cornerRadius, style: .continuous)
                .fill(Color.black.opacity(0.85))
                .overlay {
                    RoundedRectangle(cornerRadius: HUDLayout.cornerRadius, style: .continuous)
                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                }
        }
    }
}

struct HUDDismissButton: View {
    var body: some View {
        Button { HUDWindowManager.shared.dismiss() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.white.opacity(0.50))
                .frame(width: HUDLayout.dismissSize, height: HUDLayout.dismissSize)
                .background(.white.opacity(0.10), in: Circle())
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .padding(HUDLayout.dismissPadding)
        .help("Dismiss")
        .accessibilityLabel("Dismiss SpeakEasy HUD")
    }
}

/// Shared surface: near-black fill, soft phase glow, thin accent border, quiet shadow.
@ViewBuilder
func phaseSurface(accent: Color) -> some View {
    RoundedRectangle(cornerRadius: HUDLayout.cornerRadius, style: .continuous)
        .fill(Color.black.opacity(HUDPhaseChrome.fillOpacity))
        .overlay {
            RadialGradient(
                colors: [accent.opacity(HUDPhaseChrome.glowOpacity), .clear],
                center: .topLeading,
                startRadius: 0,
                endRadius: HUDPhaseChrome.glowEndRadius
            )
            .clipShape(RoundedRectangle(cornerRadius: HUDLayout.cornerRadius, style: .continuous))
        }
        .overlay {
            RoundedRectangle(cornerRadius: HUDLayout.cornerRadius, style: .continuous)
                .stroke(accent.opacity(HUDPhaseChrome.borderOpacity), lineWidth: 0.75)
        }
        .shadow(
            color: accent.opacity(HUDPhaseChrome.shadowOpacity),
            radius: HUDPhaseChrome.shadowRadius,
            y: HUDPhaseChrome.shadowY
        )
}

// MARK: - Thread-locked conversation HUD

struct ConversationHUDContent: View {
    let presentation: HUDConversationPresentation
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : 1.0 / 24.0)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: HUDLayout.sectionSpacing) {
                    HUDTaskLockHeader(presentation: presentation)

                    HStack(spacing: HUDLayout.iconTextGap) {
                        ZStack {
                            Circle()
                                .fill(presentation.accent.opacity(HUDPhaseChrome.iconFillOpacity))
                                .frame(width: HUDLayout.iconSize, height: HUDLayout.iconSize)
                            Circle()
                                .stroke(presentation.accent.opacity(HUDPhaseChrome.iconStrokeOpacity), lineWidth: 1)
                                .frame(width: HUDLayout.iconSize, height: HUDLayout.iconSize)
                                .scaleEffect(pulseScale(time))
                                .opacity(pulseOpacity(time))
                            Image(systemName: presentation.symbol)
                                .font(.system(size: HUDLayout.iconSymbolSize, weight: .semibold))
                                .foregroundStyle(presentation.accent)
                                .symbolRenderingMode(.hierarchical)
                        }
                        .accessibilityHidden(true)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(presentation.title)
                                .font(.system(size: HUDLayout.titleSize, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text(presentation.detail)
                                .font(.system(size: HUDLayout.detailSize, weight: .medium, design: .rounded))
                                .foregroundStyle(.white.opacity(0.62))
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 4)
                    }

                    ConversationEnergyField(
                        phase: presentation.phase,
                        accent: presentation.accent,
                        time: reduceMotion ? 0 : time
                    )
                    .frame(height: HUDLayout.energyHeight)
                }
                .padding(HUDLayout.contentPadding)

                HUDDismissButton()
            }
            .frame(width: HUDLayout.width, height: HUDLayout.conversationHeight)
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
        return 1 + CGFloat((sin(time * 4.2) + 1) * 0.04)
    }

    private func pulseOpacity(_ time: TimeInterval) -> Double {
        guard isEnergetic, !reduceMotion else { return 1 }
        return 0.4 + (sin(time * 4.2) + 1) * 0.16
    }

    private var conversationBackground: some View {
        phaseSurface(accent: presentation.accent)
    }
}

struct HUDTaskLockHeader: View {
    let presentation: HUDConversationPresentation

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(presentation.accent)
                .frame(width: 5, height: 5)
                .shadow(
                    color: presentation.accent.opacity(HUDPhaseChrome.statusDotShadowOpacity),
                    radius: HUDPhaseChrome.statusDotShadowRadius
                )
                .accessibilityHidden(true)
            Text(statusLabel)
                .font(.system(size: HUDLayout.headerStatusSize, weight: .bold, design: .monospaced))
                .foregroundStyle(presentation.accent)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .layoutPriority(3)
            Spacer(minLength: 6)
            Image(systemName: "lock.fill")
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(.white.opacity(0.55))
            Text(presentation.taskTitle)
                .lineLimit(1)
                .truncationMode(.tail)
                .layoutPriority(0)
            Text(String(presentation.taskID.prefix(8)))
                .font(.system(size: HUDLayout.headerMetaSize, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.44))
                .lineLimit(1)
                .fixedSize()
                .layoutPriority(2)
        }
        .font(.system(size: HUDLayout.headerMetaSize, weight: .semibold, design: .rounded))
        .foregroundStyle(.white.opacity(0.66))
        .frame(height: HUDLayout.headerRowHeight)
        .padding(.trailing, HUDLayout.dismissSize + HUDLayout.headerGap)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(presentation.phase.label). Locked to \(presentation.taskTitle)")
    }

    private var statusLabel: String {
        // Prefer short phase chips so the locked task title keeps horizontal room.
        let status: String
        switch presentation.phase {
        case .recording: status = "LIVE"
        case .cueing: status = "CONFIRMING"
        case .submitting: status = "SUBMITTING"
        case .preparingSpeech: status = "PREPARING"
        case .failed: status = "ATTENTION"
        default: status = presentation.phase.label.uppercased()
        }
        guard let lane = presentation.laneNumber else { return status }
        return "LANE \(lane) · \(status)"
    }
}

struct ConversationEnergyField: View {
    let phase: ListeningPhase
    let accent: Color
    let time: TimeInterval

    private let count = HUDLayout.energyBarCount

    var body: some View {
        GeometryReader { geometry in
            HStack(alignment: .center, spacing: HUDLayout.energyBarSpacing) {
                ForEach(0..<count, id: \.self) { index in
                    Capsule()
                        .fill(accent.opacity(opacity(for: index)))
                        .frame(
                            width: max(1.5, (geometry.size.width - CGFloat(count - 1) * HUDLayout.energyBarSpacing) / CGFloat(count)),
                            height: height(for: index)
                        )
                }
            }
            .frame(maxHeight: .infinity)
        }
        .accessibilityHidden(true)
    }

    private func height(for index: Int) -> CGFloat {
        guard phase != .ready && phase != .failed else { return index.isMultiple(of: 5) ? 3 : 1.5 }
        let phaseOffset = Double(index) * 0.52
        let primary = (sin(time * 5.2 + phaseOffset) + 1) * 0.5
        let secondary = (sin(time * 2.3 - phaseOffset * 0.7) + 1) * 0.5
        // Fit energetic bars inside the compact energy strip.
        return 3 + CGFloat(primary * 8 + secondary * 3)
    }

    private func opacity(for index: Int) -> Double {
        guard phase != .ready && phase != .failed else { return 0.30 }
        return 0.28 + (sin(time * 2.1 + Double(index) * 0.31) + 1) * 0.18
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
