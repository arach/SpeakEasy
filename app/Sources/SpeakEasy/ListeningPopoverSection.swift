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

            Text("Voice stays routed to this task—even when you change apps or Codex windows.")
                .font(.system(size: 9))
                .foregroundStyle(theme.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

            laneStrip(currentTask: lock)

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

    private func laneStrip(currentTask: ListeningTaskLock) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("VOICE LANES")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundColor(theme.textTertiary)
                Spacer()
                Text("⌘⌥1–9 selects + listens")
                    .font(.system(size: 8, design: .rounded))
                    .foregroundColor(theme.textTertiary)
            }

            HStack(spacing: 5) {
                ForEach(ListeningSessionController.laneRange, id: \.self) { number in
                    let assignment = listening.lane(number)
                    let isCurrent = assignment?.task.id == currentTask.id
                    Button {
                        if assignment == nil {
                            listening.assignLockedTask(toLane: number)
                        } else {
                            listening.activateLane(number)
                        }
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Text("\(number)")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                            Circle()
                                .fill(listening.laneShortcutAvailable(number) ? Color.green : Color.orange)
                                .frame(width: 4, height: 4)
                                .padding(3)
                                .accessibilityHidden(true)
                        }
                        .frame(width: 25, height: 25)
                        .foregroundStyle(
                            isCurrent ? Color.black.opacity(0.78) : (assignment == nil ? theme.textSecondary : accent)
                        )
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(isCurrent ? accent : (assignment == nil ? theme.text.opacity(0.035) : accent.opacity(0.14)))
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(
                                    listening.activeLaneNumber == number ? accent : theme.text.opacity(0.08),
                                    lineWidth: listening.activeLaneNumber == number ? 1.5 : 0.75
                                )
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isBusy)
                    .help(laneHelp(number: number, assignment: assignment, currentTask: currentTask))
                    .contextMenu {
                        Button("Assign current task") { listening.assignLockedTask(toLane: number) }
                        if assignment != nil {
                            Button("Clear lane") { listening.removeLane(number) }
                        }
                    }
                    .accessibilityLabel(laneHelp(number: number, assignment: assignment, currentTask: currentTask))
                }
            }

            if let active = listening.activeLaneNumber, let assignment = listening.lane(active) {
                Text("Lane \(active): \(assignment.task.title)")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(theme.textTertiary)
                    .lineLimit(1)
            } else {
                Text("Tap an empty lane to assign this exact task.")
                    .font(.system(size: 9))
                    .foregroundColor(theme.textTertiary)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Exact task voice lanes")
    }

    private func laneHelp(
        number: Int,
        assignment: VoiceLane?,
        currentTask: ListeningTaskLock
    ) -> String {
        let shortcut = GlobalListeningShortcut.title(forLane: number)
        let availability = listening.laneShortcutAvailable(number) ? "shortcut active" : "shortcut unavailable"
        guard let assignment else {
            return "Lane \(number), unassigned. Tap to assign \(currentTask.title). \(shortcut), \(availability)."
        }
        return "Lane \(number), \(assignment.task.title). \(shortcut), \(availability)."
    }

    private var taskPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Choose a task. SpeakEasy opens it in Codex and verifies the exact lock before listening.")
                .font(.system(size: 9))
                .foregroundStyle(theme.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

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
        case .validatingLock, .cueing, .warmingUp, .transcribing, .submitting, .preparingSpeech, .speaking: true
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
