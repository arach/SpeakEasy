import SwiftUI

/// Conversation / task-lock zone of the menu-bar pop-up.
///
/// Sits flat on the pop-up background rather than in its own card: the playback
/// well is the only raised surface, so this zone can carry the task state
/// without competing with the player for weight.
struct ListeningPopoverSection: View {
    private enum TaskBrowserPurpose: Equatable {
        case lock
        case lane(Int)
    }

    @ObservedObject private var listening = ListeningSessionController.shared
    @ObservedObject private var completions = CompletionSubscriptionController.shared
    @ObservedObject private var config = ConfigManager.shared
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var laneVoiceDraft = ""
    @State private var laneCueDraft = ""
    @State private var showsLaneDetail = false
    @State private var taskSearch = ""
    @State private var taskBrowserPurpose: TaskBrowserPurpose?

    private var accent: Color { SpeakEasyAccent.mint }

    private var isRecording: Bool { listening.phase == .recording }

    var body: some View {
        VStack(alignment: .leading, spacing: PopoverMetrics.rowGap) {
            zoneHeader

            if taskBrowserPurpose != nil {
                taskBrowser
            } else if let lock = listening.lockedTask {
                lockedTask(lock)
            } else {
                taskPicker
            }

            if let error = listening.lastError {
                PopoverCallout(message: error, accessibilityPrefix: "Listening error")
            } else if !listening.lastTranscript.isEmpty {
                lastTranscript
            }
        }
        .padding(.horizontal, PopoverMetrics.gutter)
        .padding(.vertical, PopoverMetrics.zonePadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Full-bleed tint rather than a red outline: the zone changes state,
        // it does not become another card.
        .background(isRecording ? Color.red.opacity(0.07) : Color.clear)
    }

    private var zoneHeader: some View {
        HStack(spacing: 7) {
            Image(systemName: isRecording ? "mic.fill" : "mic")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(isRecording ? .red : theme.textSecondary)
                .accessibilityHidden(true)

            Text("Conversation")
                .font(PopoverType.strong)
                .foregroundColor(theme.text)

            Spacer()

            HStack(spacing: 5) {
                Circle()
                    .fill(stateColor)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
                Text(listening.phase.label)
                    .font(PopoverType.caption)
                    .foregroundColor(stateColor)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Listening state: \(listening.phase.label)")
        }
    }

    private var lastTranscript: some View {
        HStack(alignment: .top, spacing: 6) {
            if let delivery = listening.lastDelivery {
                Image(
                    systemName: delivery == .steeredActiveTurn
                        ? "arrow.triangle.turn.up.right.diamond.fill"
                        : "plus.bubble.fill"
                )
                .font(.system(size: 10))
                .foregroundColor(theme.textTertiary)
                .padding(.top, 1)
                .accessibilityHidden(true)
                .help(delivery.label)
            }

            Text("“\(listening.lastTranscript)”")
                .font(PopoverType.secondary)
                .foregroundColor(theme.textTertiary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            listening.lastDelivery.map { "Last transcript: \(listening.lastTranscript). \($0.label)" }
                ?? "Last transcript: \(listening.lastTranscript)"
        )
    }

    // MARK: - Unlocked

    private var taskPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Pick a Codex task. SpeakEasy opens it and verifies the exact lock before listening.")
                .font(PopoverType.secondary)
                .foregroundStyle(theme.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

            taskSearchField
            taskResults(maxHeight: 116) { task in
                listening.selectedTaskID = task.id
            }

            HStack(spacing: 8) {
                Button("Lock task") { listening.lockSelectedTask() }
                    .buttonStyle(.popoverActionProminent)
                    .disabled(listening.selectedTaskID.isEmpty)
                    .accessibilityHint("Route voice input to the selected Codex task")

                Button {
                    listening.refreshTasks()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .semibold))
                        .frame(width: 30, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundColor(theme.textSecondary)
                .background(
                    RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous)
                        .fill(theme.insetFill)
                )
                .help("Refresh recent Codex tasks")
                .accessibilityLabel("Refresh tasks")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Choose a Codex task to lock for voice conversation")
    }

    private var selectedTaskTitle: String {
        if let match = listening.tasks.first(where: { $0.id == listening.selectedTaskID }) {
            return match.title
        }
        return listening.tasks.isEmpty ? "No recent tasks found" : "Choose a task"
    }

    // MARK: - Locked

    private func lockedTask(_ lock: ListeningTaskLock) -> some View {
        VStack(alignment: .leading, spacing: PopoverMetrics.rowGap) {
            HStack(spacing: 7) {
                Button {
                    showTaskBrowser(.lock)
                } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(accent)
                            .accessibilityHidden(true)
                        Text(lock.title)
                            .font(PopoverType.secondaryStrong)
                            .foregroundColor(theme.text)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(theme.textTertiary)
                    }
                    .padding(.horizontal, 8)
                    .frame(height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous)
                            .fill(accent.opacity(0.12))
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(isBusy)
                .help("Search recent Codex tasks and change the conversation lock")
                .accessibilityLabel("Locked to \(lock.title). Choose another task")

                Spacer(minLength: 4)

                Button("Unlock") { listening.unlock() }
                    .buttonStyle(.popoverTextTertiary)
                    .disabled(isBusy)
                    .accessibilityHint("Stop routing voice to this task")
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Locked task: \(lock.title)")

            Text("Voice stays routed here across apps and windows.")
                .font(PopoverType.secondary)
                .foregroundStyle(theme.textTertiary)
                .fixedSize(horizontal: false, vertical: true)

            completionControls(for: lock)

            captureComposer

            laneStrip(currentTask: lock)

            shortcutStatus
        }
        .onAppear { listening.refreshInputDevices() }
    }

    private func completionControls(for lock: ListeningTaskLock) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: Binding(
                get: { completions.isSubscribed(to: lock.id) && completions.subscription?.isEnabled == true },
                set: { enabled in
                    if enabled {
                        completions.subscribe(to: lock)
                    } else if completions.isSubscribed(to: lock.id) {
                        completions.setEnabled(false)
                    }
                }
            )) {
                HStack(spacing: 6) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 10, weight: .semibold))
                    Text("Announce completions")
                        .font(PopoverType.secondaryStrong)
                }
            }
            .toggleStyle(.switch)
            .tint(accent)
            .accessibilityHint("Watch only this exact Codex task for future completed turns")

            if completions.isSubscribed(to: lock.id), completions.subscription?.isEnabled == true {
                HStack(spacing: 7) {
                    Text("Channel: Completions")
                        .font(PopoverType.caption)
                        .foregroundColor(theme.textSecondary)
                    Text(completions.state.label)
                        .font(PopoverType.caption)
                        .foregroundColor(completionStateColor)
                    if completions.queueCount > 0 {
                        Text("· (completions.queueCount) queued")
                            .font(PopoverType.caption)
                            .foregroundColor(theme.textTertiary)
                    }
                    Spacer(minLength: 0)
                    Button {
                        completions.setMuted(!completions.channel.isMuted)
                    } label: {
                        Image(systemName: completions.channel.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(completions.channel.isMuted ? .orange : theme.textSecondary)
                    .help(completions.channel.isMuted ? "Unmute completion announcements" : "Mute completion announcements")
                    .accessibilityLabel(completions.channel.isMuted ? "Unmute Completions channel" : "Mute Completions channel")
                    Button("Remove") { completions.unsubscribe() }
                        .buttonStyle(.popoverTextTertiary)
                        .help("Remove the exact-task completion subscription")
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Completions channel, (completions.state.label)")

                if let activity = completions.mostRecentActivity, activity.taskID == lock.id {
                    HStack(spacing: 6) {
                        Image(systemName: activity.state == .failed ? "exclamationmark.triangle" : "checkmark.circle")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundColor(activity.state == .failed ? .orange : theme.textTertiary)
                        Text("Turn (activity.turnID.prefix(8)) · (activity.state.rawValue)")
                            .font(PopoverType.caption)
                            .foregroundColor(theme.textTertiary)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        if activity.state != .announced && activity.state != .dismissed {
                            Button("Replay") { completions.replay(activity.id) }
                                .buttonStyle(.popoverTextTertiary)
                        }
                        Button("Dismiss") { completions.dismiss(activity.id) }
                            .buttonStyle(.popoverTextTertiary)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var completionStateColor: Color {
        switch completions.state {
        case .failed, .unavailable: .orange
        case .muted: .orange
        case .watching: accent
        default: theme.textTertiary
        }
    }

    /// Ready reads as a tinted, not filled, control. A second solid mint slab
    /// here competed head-on with the play button for the pop-up's one focal
    /// treatment; the fill is spent on recording, which is genuinely live.
    private var captureComposer: some View {
        HStack(spacing: 0) {
            Button(action: listening.toggleListening) {
                HStack(spacing: 7) {
                    Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 11, weight: .semibold))
                    Text(buttonLabel)
                        .font(PopoverType.secondaryStrong)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                }
                .foregroundColor(isRecording ? .white : accent)
                .padding(.horizontal, 11)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(isRecording ? Color.red : accent.opacity(0.16))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!listening.phase.acceptsHotkey)
            .opacity(listening.phase.acceptsHotkey ? 1 : 0.55)
            .accessibilityLabel(buttonLabel)
            .accessibilityHint("Global shortcut \(ListeningSessionController.shortcutTitle)")

            Rectangle()
                .fill(theme.background.opacity(0.5))
                .frame(width: 1)
                .accessibilityHidden(true)

            microphoneMenu
                .frame(width: 118)
        }
        .frame(height: 32)
        .background(theme.background)
        .clipShape(RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous))
    }

    /// Same drawn-chip / overlaid-menu split as `PopoverMenuChip`, but square so
    /// it can sit flush inside the segmented composer.
    private var microphoneMenu: some View {
        ZStack {
            HStack(spacing: 5) {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(theme.textTertiary)

                Text(isRecording
                    ? (listening.inputDeviceName ?? listening.selectedInputDeviceShortLabel)
                    : listening.selectedInputDeviceShortLabel)
                    .font(PopoverType.caption)
                    .foregroundColor(listening.selectedInputIsAvailable ? theme.textSecondary : .orange)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Opaque neutral base so the device name stays legible when the zone
            // behind it is tinted red during recording.
            .background(listening.selectedInputIsAvailable ? theme.insetFill : Color.orange.opacity(0.18))
            .accessibilityHidden(true)

            microphoneMenuButton
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .opacity(0.011)
        }
        .disabled(isBusy || isRecording)
        .help(listening.selectedInputDeviceLabel)
    }

    private var microphoneMenuButton: some View {
        Menu {
            Button {
                listening.selectSystemDefaultInput()
            } label: {
                HStack {
                    Text("System Default")
                    if listening.inputPreference == nil {
                        Spacer()
                        Image(systemName: "checkmark")
                    }
                }
            }

            if !listening.inputDevices.isEmpty {
                Divider()
            }

            ForEach(listening.inputDevices) { device in
                Button {
                    listening.selectInputDevice(device)
                } label: {
                    HStack {
                        Text(device.isSystemDefault ? "\(device.name) · default" : device.name)
                        if listening.inputPreference?.id == device.id {
                            Spacer()
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }

            if let preference = listening.inputPreference,
               !preference.isAvailable(in: listening.inputDevices) {
                Divider()
                Label("\(preference.name) unavailable", systemImage: "exclamationmark.triangle")
            }

            Divider()
            Button {
                listening.refreshInputDevices()
            } label: {
                Label("Refresh Inputs", systemImage: "arrow.clockwise")
            }
        } label: {
            Color.clear.contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .accessibilityLabel("Microphone: \(listening.selectedInputDeviceLabel)")
        .accessibilityHint("Choose a fixed microphone or follow the system default")
    }

    private var shortcutStatus: some View {
        HStack(spacing: 10) {
            shortcutPip(
                available: listening.shortcutAvailable,
                text: primaryListeningShortcutLabel,
                accessibility: listening.shortcutAvailable
                    ? "Listening shortcut \(primaryListeningShortcutLabel) is active"
                    : "Listening shortcut \(primaryListeningShortcutLabel) is unavailable"
            )

            shortcutPip(
                available: listening.confirmationShortcutAvailable,
                text: "⌘⌥X lane cue",
                accessibility: listening.confirmationShortcutAvailable
                    ? "Command Option X announces the active lane"
                    : "Command Option X confirmation shortcut unavailable"
            )

            Spacer(minLength: 0)
        }
    }

    private var primaryListeningShortcutLabel: String {
        guard let lane = listening.activeLaneNumber else {
            return "\(ListeningSessionController.shortcutTitle) listen"
        }
        let shortcut = GlobalListeningShortcut.title(forLane: lane)
        switch listening.phase {
        case .warmingUp, .recording:
            return "\(shortcut) stop + send"
        case .speaking:
            return "\(shortcut) interrupt"
        default:
            return "\(shortcut) listen"
        }
    }

    private func shortcutPip(available: Bool, text: String, accessibility: String) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(available ? accent : Color.orange)
                .frame(width: 5, height: 5)
                .accessibilityHidden(true)
            Text(text)
                .font(PopoverType.caption)
                .foregroundColor(theme.textTertiary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibility)
    }

    // MARK: - Lanes

    private func laneStrip(currentTask: ListeningTaskLock) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                PopoverSectionLabel(text: "Lanes")
                Spacer()
                Text("⌘⌥1–9")
                    .font(PopoverType.mono)
                    .foregroundColor(theme.textTertiary)
                    .accessibilityHidden(true)

                Button {
                    listening.confirmActiveLane()
                } label: {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 9, weight: .semibold))
                        .frame(width: 20, height: 18)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundColor(theme.textSecondary)
                .disabled(isBusy || listening.activeLaneNumber == nil)
                .help("Play the active lane cue (⌘⌥X)")
                .accessibilityLabel("Play active lane cue")
            }

                HStack(spacing: 4) {
                ForEach(ListeningSessionController.laneRange, id: \.self) { number in
                    laneChip(number: number, currentTask: currentTask)
                }
            }

            if let active = listening.activeLaneNumber, let assignment = listening.lane(active) {
                HStack(spacing: 6) {
                    Text("Lane \(active) · \(assignment.task.title)")
                        .font(PopoverType.caption)
                        .foregroundColor(theme.textSecondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 4)
                    Button("Remap") { showTaskBrowser(.lane(active)) }
                        .buttonStyle(.popoverTextTertiary)
                        .disabled(isBusy)
                }

                laneDetailDisclosure(for: assignment)
            } else {
                Text("Choose an empty lane, then search for its task.")
                    .font(PopoverType.caption)
                    .foregroundColor(theme.textTertiary)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Exact task voice lanes")
        .onAppear(perform: synchronizeVoiceDraft)
        .onChange(of: listening.activeLaneNumber) { synchronizeVoiceDraft() }
        .onChange(of: config.defaultProvider) { synchronizeVoiceDraft() }
    }

    private func laneChip(number: Int, currentTask: ListeningTaskLock) -> some View {
        let assignment = listening.lane(number)
        let isCurrent = assignment?.task.id == currentTask.id
        let isActive = listening.activeLaneNumber == number
        let shortcutOK = listening.laneShortcutAvailable(number)

        return Button {
            if assignment == nil {
                showTaskBrowser(.lane(number))
            } else {
                listening.activateLane(number)
            }
        } label: {
            Text("\(number)")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .frame(height: 26)
                .frame(maxWidth: .infinity)
                .foregroundStyle(laneForeground(isCurrent: isCurrent, assigned: assignment != nil))
                .background(
                    RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                        .fill(laneFill(isCurrent: isCurrent, assigned: assignment != nil))
                )
                .overlay(alignment: .topTrailing) {
                    // Only unavailable shortcuts get a marker — decorating the
                    // healthy case put nine dots of noise on the strip.
                    if !shortcutOK {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 4, height: 4)
                            .padding(3)
                            .accessibilityHidden(true)
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                        .stroke(isActive && !isCurrent ? accent : Color.clear, lineWidth: 1)
                )
            .contentShape(RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
        .help(laneHelp(number: number, assignment: assignment, currentTask: currentTask))
        .contextMenu {
            Button("Assign current task") { listening.assignLockedTask(toLane: number) }
            Button(assignment == nil ? "Choose another task…" : "Remap lane…") {
                showTaskBrowser(.lane(number))
            }
            if assignment != nil {
                Button("Clear lane") { listening.removeLane(number) }
            }
        }
        .accessibilityLabel(laneHelp(number: number, assignment: assignment, currentTask: currentTask))
    }

    private func laneForeground(isCurrent: Bool, assigned: Bool) -> Color {
        if isCurrent { return .black.opacity(0.82) }
        if assigned { return accent }
        return theme.textSecondary
    }

    private func laneFill(isCurrent: Bool, assigned: Bool) -> Color {
        if isCurrent { return accent }
        if assigned { return accent.opacity(0.16) }
        return theme.insetFillMuted
    }

    // MARK: - Task browser

    private var filteredTasks: [CodexTaskSummary] {
        listening.tasks.filter { $0.matchesSearch(taskSearch) }
    }

    private var taskBrowser: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Button {
                    taskBrowserPurpose = nil
                    taskSearch = ""
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 10, weight: .bold))
                        .frame(width: 22, height: 22)
                }
                .buttonStyle(.plain)
                .foregroundColor(theme.textSecondary)
                .accessibilityLabel("Back to conversation")

                VStack(alignment: .leading, spacing: 1) {
                    Text(taskBrowserTitle)
                        .font(PopoverType.strong)
                        .foregroundColor(theme.text)
                    Text(taskBrowserSubtitle)
                        .font(PopoverType.caption)
                        .foregroundColor(theme.textTertiary)
                }
                Spacer()
                refreshTasksButton
            }

            taskSearchField
            taskResults(maxHeight: 184, action: chooseTask)
        }
    }

    private var taskSearchField: some View {
        HStack(spacing: 7) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(theme.textTertiary)
            TextField("Title, project, or task ID", text: $taskSearch)
                .textFieldStyle(.plain)
                .font(PopoverType.secondary)
                .foregroundColor(theme.text)
            if !taskSearch.isEmpty {
                Button {
                    taskSearch = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 10))
                }
                .buttonStyle(.plain)
                .foregroundColor(theme.textTertiary)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 9)
        .frame(height: 30)
        .background(
            RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous)
                .fill(theme.insetFill)
        )
    }

    private func taskResults(
        maxHeight: CGFloat,
        action: @escaping (CodexTaskSummary) -> Void
    ) -> some View {
        Group {
            if filteredTasks.isEmpty {
                HStack(spacing: 7) {
                    Image(systemName: taskSearch.isEmpty ? "clock" : "magnifyingglass")
                    Text(taskSearch.isEmpty ? "No recent tasks found" : "No matching tasks")
                }
                .font(PopoverType.secondary)
                .foregroundColor(theme.textTertiary)
                .frame(maxWidth: .infinity, minHeight: 48)
            } else {
                ScrollView {
                    LazyVStack(spacing: 3) {
                        ForEach(filteredTasks) { task in
                            taskRow(task, action: action)
                        }
                    }
                }
                .frame(maxHeight: maxHeight)
            }
        }
    }

    private func taskRow(
        _ task: CodexTaskSummary,
        action: @escaping (CodexTaskSummary) -> Void
    ) -> some View {
        let selected = taskIsSelected(task)
        return Button {
            action(task)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: selected ? "checkmark.circle.fill" : "bubble.left.and.text.bubble.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(selected ? accent : theme.textTertiary)
                    .frame(width: 18)
                VStack(alignment: .leading, spacing: 1) {
                    Text(task.title.isEmpty ? "Untitled task" : task.title)
                        .font(PopoverType.secondaryStrong)
                        .foregroundColor(theme.text)
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Text(task.projectName.isEmpty ? task.cwd : task.projectName)
                        if !task.preview.isEmpty {
                            Text("·")
                            Text(task.preview)
                        }
                    }
                    .font(PopoverType.caption)
                    .foregroundColor(theme.textTertiary)
                    .lineLimit(1)
                }
                Spacer(minLength: 0)
                if completions.isSubscribed(to: task.id) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(accent)
                        .accessibilityLabel("Completion announcements subscribed")
                }
            }
            .padding(.horizontal, 7)
            .frame(height: 42)
            .background(
                RoundedRectangle(cornerRadius: PopoverMetrics.controlRadius, style: .continuous)
                    .fill(selected ? accent.opacity(0.10) : theme.insetFillMuted)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(task.title), project \(task.projectName)\(selected ? ", selected" : "")")
    }

    private var refreshTasksButton: some View {
        Button {
            listening.refreshTasks()
        } label: {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 10, weight: .semibold))
                .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
        .foregroundColor(theme.textSecondary)
        .help("Refresh recent tasks")
        .accessibilityLabel("Refresh recent tasks")
    }

    private var taskBrowserTitle: String {
        switch taskBrowserPurpose {
        case .lane(let number): "Map lane \(number)"
        default: "Choose conversation task"
        }
    }

    private var taskBrowserSubtitle: String {
        switch taskBrowserPurpose {
        case .lane: "The current lock stays put"
        default: "Move the exact voice lock"
        }
    }

    private func showTaskBrowser(_ purpose: TaskBrowserPurpose) {
        guard !isBusy else { return }
        taskSearch = ""
        taskBrowserPurpose = purpose
    }

    private func chooseTask(_ task: CodexTaskSummary) {
        let purpose = taskBrowserPurpose
        taskBrowserPurpose = nil
        taskSearch = ""
        switch purpose {
        case .lane(let number): listening.assign(task, toLane: number)
        case .lock: listening.lock(task)
        case nil: break
        }
    }

    private func taskIsSelected(_ task: CodexTaskSummary) -> Bool {
        switch taskBrowserPurpose {
        case .lane(let number): listening.lane(number)?.task.id == task.id
        default: listening.lockedTask?.id == task.id || listening.selectedTaskID == task.id
        }
    }

    /// Per-lane voice and narration cue are optional overrides, not required
    /// state, so they collapse by default. When an override exists the summary
    /// stays visible on the closed row.
    private func laneDetailDisclosure(for assignment: VoiceLane) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Button {
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.15)) {
                    showsLaneDetail.toggle()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8, weight: .bold))
                        .rotationEffect(.degrees(showsLaneDetail ? 90 : 0))
                        .foregroundColor(theme.textTertiary)

                    Text("Voice & cue")
                        .font(PopoverType.caption)
                        .foregroundColor(theme.textSecondary)

                    if let summary = overrideSummary(for: assignment) {
                        Text(summary)
                            .font(PopoverType.caption)
                            .foregroundColor(accent)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Voice and narration cue for lane \(assignment.number)")
            .accessibilityValue(overrideSummary(for: assignment) ?? "Inheriting global settings")
            .accessibilityHint(showsLaneDetail ? "Collapse" : "Expand")

            if showsLaneDetail {
                laneVoiceEditor(for: assignment)
                laneNarrationCueEditor(for: assignment)
            }
        }
    }

    private func overrideSummary(for assignment: VoiceLane) -> String? {
        var parts: [String] = []
        if assignment.voiceOverride != nil { parts.append("custom voice") }
        if assignment.narrationCue != nil { parts.append("custom cue") }
        return parts.isEmpty ? nil : "· \(parts.joined(separator: ", "))"
    }

    private func laneVoiceEditor(for assignment: VoiceLane) -> some View {
        HStack(spacing: 5) {
            Text(config.defaultProvider.uppercased())
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(theme.textTertiary)
                .frame(width: 62, alignment: .leading)

            TextField("Inherit \(globalVoiceID)", text: $laneVoiceDraft)
                .textFieldStyle(.plain)
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(theme.textSecondary)
                .padding(.horizontal, 7)
                .frame(height: 24)
                .background(
                    RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                        .fill(theme.insetFillMuted)
                )
                .onSubmit { saveVoiceDraft(for: assignment.number) }
                .accessibilityLabel("Voice ID for lane \(assignment.number)")
                .accessibilityHint("Leave empty to inherit \(globalVoiceID) from the global \(config.defaultProvider) provider")

            if config.defaultProvider == "elevenlabs" {
                Menu {
                    Button("Inherit global voice") {
                        laneVoiceDraft = ""
                        saveVoiceDraft(for: assignment.number)
                    }
                    Divider()
                    ForEach(availableElevenLabsVoices) { voice in
                        Button(voice.name) {
                            laneVoiceDraft = voice.voice_id
                            saveVoiceDraft(for: assignment.number)
                        }
                    }
                } label: {
                    Image(systemName: "person.wave.2")
                        .font(.system(size: 10, weight: .medium))
                        .frame(width: 20, height: 20)
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
                .help("Choose a saved ElevenLabs voice")
                .accessibilityLabel("Choose ElevenLabs voice for lane \(assignment.number)")
            }

            laneEditorAction(
                symbol: "checkmark",
                help: "Save voice for lane \(assignment.number)",
                label: "Save lane voice",
                enabled: !isBusy
            ) {
                saveVoiceDraft(for: assignment.number)
            }

            if assignment.voiceOverride != nil {
                laneEditorAction(
                    symbol: "arrow.uturn.backward",
                    help: "Inherit the global \(config.defaultProvider) voice",
                    label: "Reset lane voice to the global provider default",
                    enabled: !isBusy
                ) {
                    laneVoiceDraft = ""
                    listening.setVoiceOverride(
                        provider: config.defaultProvider,
                        voiceID: "",
                        forLane: assignment.number
                    )
                }
            }
        }
    }

    private func laneNarrationCueEditor(for assignment: VoiceLane) -> some View {
        HStack(spacing: 5) {
            Text("CUE")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(theme.textTertiary)
                .frame(width: 62, alignment: .leading)

            TextField(
                providerSupportsNarrationCue ? "Warm, concise, energized…" : "OpenAI voices only",
                text: $laneCueDraft
            )
            .textFieldStyle(.plain)
            .font(.system(size: 10))
            .foregroundColor(theme.textSecondary)
            .padding(.horizontal, 7)
            .frame(height: 24)
            .background(
                RoundedRectangle(cornerRadius: PopoverMetrics.chipRadius, style: .continuous)
                    .fill(theme.insetFillMuted)
            )
            .disabled(!providerSupportsNarrationCue || isBusy)
            .onSubmit { saveNarrationCue(for: assignment.number) }
            .accessibilityLabel("Narration cue for lane \(assignment.number)")
            .accessibilityHint("A short speaking-style instruction for OpenAI narration")

            laneEditorAction(
                symbol: "checkmark",
                help: "Save narration cue for lane \(assignment.number)",
                label: "Save lane narration cue",
                enabled: providerSupportsNarrationCue && !isBusy
            ) {
                saveNarrationCue(for: assignment.number)
            }

            if assignment.narrationCue != nil {
                laneEditorAction(
                    symbol: "arrow.uturn.backward",
                    help: "Clear the lane narration cue",
                    label: "Clear lane narration cue",
                    enabled: !isBusy
                ) {
                    laneCueDraft = ""
                    listening.setNarrationCue("", forLane: assignment.number)
                }
            }
        }
    }

    private func laneEditorAction(
        symbol: String,
        help: String,
        label: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 9, weight: .bold))
                .frame(width: 22, height: 22)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // Neutral, not mint: green stays reserved for state, so save/reset read
        // as chrome instead of competing with the play button.
        .foregroundColor(theme.textSecondary)
        .disabled(!enabled)
        .help(help)
        .accessibilityLabel(label)
    }

    // MARK: - Derived

    private var globalVoiceID: String {
        switch config.defaultProvider {
        case "openai": config.openaiVoice
        case "elevenlabs": config.elevenlabsVoiceId
        case "groq": config.groqVoice
        case "gemini": "Puck"
        case "system": config.systemVoice
        default: "provider default"
        }
    }

    private var providerSupportsNarrationCue: Bool {
        config.defaultProvider == "openai"
    }

    private var availableElevenLabsVoices: [ElevenLabsVoice] {
        ElevenLabsVoiceCatalog.merged(
            config.elevenlabsSavedVoices,
            ElevenLabsVoiceCatalog.curated
        )
    }

    private func synchronizeVoiceDraft() {
        guard let active = listening.activeLaneNumber,
              let assignment = listening.lane(active),
              assignment.voiceOverride?.provider == config.defaultProvider.lowercased()
        else {
            laneVoiceDraft = ""
            laneCueDraft = listening.activeLaneNumber
                .flatMap { listening.lane($0)?.narrationCue } ?? ""
            return
        }
        laneVoiceDraft = assignment.voiceOverride?.voiceID ?? ""
        laneCueDraft = assignment.narrationCue ?? ""
    }

    private func saveVoiceDraft(for laneNumber: Int) {
        listening.setVoiceOverride(
            provider: config.defaultProvider,
            voiceID: laneVoiceDraft,
            forLane: laneNumber
        )
        synchronizeVoiceDraft()
    }

    private func saveNarrationCue(for laneNumber: Int) {
        listening.setNarrationCue(laneCueDraft, forLane: laneNumber)
        synchronizeVoiceDraft()
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
