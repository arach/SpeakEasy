import SwiftUI

struct ListeningPopoverSection: View {
    @ObservedObject private var listening = ListeningSessionController.shared
    @Environment(\.theme) private var theme

    private let accent = Color(red: 0.36, green: 0.87, blue: 0.66)

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Conversation", systemImage: listening.phase == .recording ? "mic.fill" : "mic")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(listening.phase == .recording ? .red : theme.text)
                Spacer()
                Text(listening.phase.label)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundColor(stateColor)
            }

            if let lock = listening.lockedTask {
                lockedTask(lock)
            } else {
                taskPicker
            }

            if let error = listening.lastError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.orange)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Listening error: \(error)")
            } else if !listening.lastTranscript.isEmpty {
                Text("“\(listening.lastTranscript)”")
                    .font(.system(size: 10))
                    .foregroundColor(theme.textTertiary)
                    .lineLimit(2)
                    .accessibilityLabel("Last transcript: \(listening.lastTranscript)")
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(theme.text.opacity(0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(listening.phase == .recording ? Color.red.opacity(0.55) : theme.text.opacity(0.09), lineWidth: 1)
                )
        )
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
    }

    private func lockedTask(_ lock: ListeningTaskLock) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 10))
                    .foregroundColor(accent)
                Text(lock.title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(theme.textSecondary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Button("Unlock") { listening.unlock() }
                    .buttonStyle(.plain)
                    .font(.system(size: 10))
                    .foregroundColor(theme.textTertiary)
                    .disabled(isBusy)
            }

            Button(action: listening.toggleListening) {
                HStack(spacing: 7) {
                    Image(systemName: listening.phase == .recording ? "stop.fill" : "mic.fill")
                    Text(buttonLabel)
                    Spacer()
                    Text(ListeningSessionController.shortcutTitle)
                        .font(.system(size: 10, design: .rounded))
                        .opacity(0.75)
                }
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(listening.phase == .recording ? .white : .black.opacity(0.78))
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(listening.phase == .recording ? Color.red : accent)
                )
            }
            .buttonStyle(.plain)
            .disabled(!listening.phase.acceptsHotkey)
            .opacity(listening.phase.acceptsHotkey ? 1 : 0.55)
            .accessibilityLabel(buttonLabel)
            .accessibilityHint("Global shortcut \(ListeningSessionController.shortcutTitle)")

            HStack(spacing: 5) {
                Circle()
                    .fill(listening.shortcutAvailable ? Color.green : Color.orange)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
                Text(listening.shortcutAvailable ? "Global shortcut active" : "Shortcut unavailable")
                if let device = listening.inputDeviceName, listening.phase == .recording {
                    Text("· \(device)")
                }
            }
            .font(.system(size: 9))
            .foregroundColor(theme.textTertiary)
            .accessibilityElement(children: .combine)
        }
    }

    private var taskPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Codex task", selection: $listening.selectedTaskID) {
                if listening.tasks.isEmpty {
                    Text("No recent tasks found").tag("")
                }
                ForEach(listening.tasks) { task in
                    Text(task.title).tag(task.id)
                }
            }
            .labelsHidden()
            .frame(maxWidth: .infinity)

            HStack {
                Button("Refresh") { listening.refreshTasks() }
                    .buttonStyle(.plain)
                    .font(.system(size: 10))
                    .foregroundColor(theme.textTertiary)
                Spacer()
                Button("Lock task") { listening.lockSelectedTask() }
                    .disabled(listening.selectedTaskID.isEmpty)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Choose a Codex task to lock for voice conversation")
    }

    private var isBusy: Bool {
        switch listening.phase {
        case .validatingLock, .warmingUp, .transcribing, .submitting, .preparingSpeech, .speaking: true
        default: false
        }
    }

    private var buttonLabel: String {
        switch listening.phase {
        case .recording: "Stop and send"
        case .ready, .failed: "Start listening"
        case .speaking: "Interrupt and listen"
        default: listening.phase.label
        }
    }

    private var stateColor: Color {
        switch listening.phase {
        case .recording: .red
        case .failed: .orange
        case .unlocked: theme.textTertiary
        default: accent
        }
    }
}
