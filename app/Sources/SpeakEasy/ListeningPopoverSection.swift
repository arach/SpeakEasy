import SwiftUI

struct ListeningPopoverSection: View {
    private enum TaskBrowserPurpose: Equatable {
        case lock
        case lane(Int)
    }

    @ObservedObject private var listening = ListeningSessionController.shared
    @ObservedObject private var config = ConfigManager.shared
    @Environment(\.theme) private var theme
    @State private var laneVoiceDraft = ""
    @State private var laneCueDraft = ""
    @State private var taskSearch = ""
    @State private var taskBrowserPurpose: TaskBrowserPurpose?

    private let accent = Color(red: 0.36, green: 0.87, blue: 0.66)

    init(snapshotLaneBrowserNumber: Int? = nil) {
        _taskBrowserPurpose = State(
            initialValue: snapshotLaneBrowserNumber.map(TaskBrowserPurpose.lane)
        )
    }

    #if DEBUG
    static func laneBrowserSnapshot(lane number: Int) -> some View {
        ListeningPopoverSection(snapshotLaneBrowserNumber: number).taskBrowser
    }
    #endif

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
                VStack(alignment: .leading, spacing: 3) {
                    Text("“\(listening.lastTranscript)”")
                        .font(.system(size: 10))
                        .foregroundColor(theme.textTertiary)
                        .lineLimit(2)
                        .accessibilityLabel("Last transcript: \(listening.lastTranscript)")
                    if let delivery = listening.lastDelivery {
                        Label(delivery.label, systemImage: delivery == .steeredActiveTurn ? "arrow.triangle.turn.up.right.diamond.fill" : "plus.bubble.fill")
                            .font(.system(size: 8, weight: .medium))
                            .foregroundColor(accent.opacity(0.82))
                            .accessibilityLabel(delivery.label)
                    }
                }
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
        .popover(isPresented: taskBrowserPresented, arrowEdge: .trailing) {
            taskBrowser
        }
    }

    private func lockedTask(_ lock: ListeningTaskLock) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Button {
                    presentTaskBrowser(.lock)
                } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 10))
                            .foregroundColor(accent)
                        Text(lock.title)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(theme.textSecondary)
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 7, weight: .semibold))
                            .foregroundColor(theme.textTertiary)
                    }
                    .padding(.horizontal, 8)
                    .frame(height: 26)
                    .background(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(accent.opacity(0.10))
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .stroke(accent.opacity(0.24), lineWidth: 0.75)
                    }
                }
                .buttonStyle(.plain)
                .disabled(isBusy)
                .help("Search recent Codex tasks and change the conversation lock")
                .accessibilityLabel("Locked to \(lock.title). Choose another task")
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

            captureComposer

            HStack(spacing: 5) {
                Circle()
                    .fill(listening.shortcutAvailable ? Color.green : Color.orange)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
                Text(listening.shortcutAvailable ? "Global shortcut active" : "Shortcut unavailable")
                Text("· \(ListeningSessionController.shortcutTitle)")
                if let device = listening.inputDeviceName, listening.phase == .recording {
                    Text("· \(device)")
                }
            }
            .font(.system(size: 9))
            .foregroundColor(theme.textTertiary)
            .accessibilityElement(children: .combine)
        }
        .onAppear { listening.refreshInputDevices() }
    }

    private var captureComposer: some View {
        HStack(spacing: 0) {
            Button(action: listening.toggleListening) {
                HStack(spacing: 7) {
                    Image(systemName: listening.phase == .recording ? "stop.fill" : "mic.fill")
                    Text(buttonLabel)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                }
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(listening.phase == .recording ? .white : .black.opacity(0.78))
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(listening.phase == .recording ? Color.red : accent)
            }
            .buttonStyle(.plain)
            .disabled(!listening.phase.acceptsHotkey)
            .opacity(listening.phase.acceptsHotkey ? 1 : 0.55)
            .accessibilityLabel(buttonLabel)
            .accessibilityHint("Global shortcut \(ListeningSessionController.shortcutTitle)")

            Rectangle()
                .fill(theme.text.opacity(0.12))
                .frame(width: 0.5)

            microphoneMenu
                .frame(width: 126)
        }
        .frame(height: 34)
        .background(theme.text.opacity(0.045))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(theme.text.opacity(0.10), lineWidth: 0.75)
        }
    }

    private var microphoneMenu: some View {
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
            HStack(spacing: 6) {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 7, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)

                Text(listening.phase == .recording
                    ? (listening.inputDeviceName ?? listening.selectedInputDeviceShortLabel)
                    : listening.selectedInputDeviceShortLabel)
                    .font(.system(size: 9.5, weight: .medium))
                    .foregroundColor(listening.selectedInputIsAvailable ? theme.textSecondary : .orange)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(listening.selectedInputIsAvailable ? Color.clear : Color.orange.opacity(0.10))
            .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .disabled(isBusy || listening.phase == .recording)
        .help(listening.selectedInputDeviceLabel)
        .accessibilityLabel("Microphone: \(listening.selectedInputDeviceLabel)")
        .accessibilityHint("Choose a fixed microphone or follow the system default")
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
                Circle()
                    .fill(listening.confirmationShortcutAvailable ? Color.green : Color.orange)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
                Text("⌘⌥X says the active lane on demand")
                    .font(.system(size: 8, design: .rounded))
                    .foregroundColor(theme.textTertiary)
                Spacer()
                Button {
                    listening.confirmActiveLane()
                } label: {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 8, weight: .semibold))
                }
                .buttonStyle(.plain)
                .foregroundColor(accent)
                .disabled(isBusy || listening.activeLaneNumber == nil)
                .help("Play the active lane cue")
                .accessibilityLabel("Play active lane cue")
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(
                listening.confirmationShortcutAvailable
                    ? "Command Option X announces the active lane"
                    : "Command Option X confirmation shortcut unavailable"
            )

            HStack(spacing: 5) {
                ForEach(ListeningSessionController.laneRange, id: \.self) { number in
                    let assignment = listening.lane(number)
                    let isCurrent = assignment?.task.id == currentTask.id
                    Button {
                        if assignment == nil {
                            presentTaskBrowser(.lane(number))
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
                        Button(assignment == nil ? "Choose another task…" : "Remap lane…") {
                            presentTaskBrowser(.lane(number))
                        }
                        if assignment != nil {
                            Button("Clear lane") { listening.removeLane(number) }
                        }
                    }
                    .accessibilityLabel(laneHelp(number: number, assignment: assignment, currentTask: currentTask))
                }
            }

            if let active = listening.activeLaneNumber, let assignment = listening.lane(active) {
                HStack(spacing: 5) {
                    Text("Lane \(active): \(assignment.task.title)")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(theme.textTertiary)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Button("Remap") { presentTaskBrowser(.lane(active)) }
                        .buttonStyle(.plain)
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(accent)
                        .disabled(isBusy)
                }
                laneVoiceEditor(for: assignment)
                laneNarrationCueEditor(for: assignment)
            } else {
                Text("Choose an empty lane, then search for the task you want.")
                    .font(.system(size: 9))
                    .foregroundColor(theme.textTertiary)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Exact task voice lanes")
        .onAppear(perform: synchronizeVoiceDraft)
        .onChange(of: listening.activeLaneNumber) { synchronizeVoiceDraft() }
        .onChange(of: config.defaultProvider) { synchronizeVoiceDraft() }
    }

    private func laneVoiceEditor(for assignment: VoiceLane) -> some View {
        HStack(spacing: 5) {
            Text(config.defaultProvider.uppercased())
                .font(.system(size: 7, weight: .bold, design: .monospaced))
                .foregroundColor(theme.textTertiary)

            TextField("Inherit \(globalVoiceID)", text: $laneVoiceDraft)
                .textFieldStyle(.plain)
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(theme.textSecondary)
                .padding(.horizontal, 6)
                .frame(height: 22)
                .background(
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(theme.text.opacity(0.045))
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .stroke(theme.text.opacity(0.09), lineWidth: 0.75)
                }
                .onSubmit { saveVoiceDraft(for: assignment.number) }
                .accessibilityLabel("Voice ID for lane \(assignment.number)")
                .accessibilityHint("Leave empty to inherit \(globalVoiceID) from the global \(config.defaultProvider) provider")

            Button {
                saveVoiceDraft(for: assignment.number)
            } label: {
                Image(systemName: "checkmark")
                    .font(.system(size: 8, weight: .bold))
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(.plain)
            .foregroundColor(accent)
            .disabled(isBusy)
            .help("Save voice for lane \(assignment.number)")
            .accessibilityLabel("Save lane voice")

            if assignment.voiceOverride != nil {
                Button {
                    laneVoiceDraft = ""
                    listening.setVoiceOverride(
                        provider: config.defaultProvider,
                        voiceID: "",
                        forLane: assignment.number
                    )
                } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 8, weight: .semibold))
                        .frame(width: 20, height: 20)
                }
                .buttonStyle(.plain)
                .foregroundColor(theme.textTertiary)
                .disabled(isBusy)
                .help("Inherit the global \(config.defaultProvider) voice")
                .accessibilityLabel("Reset lane voice to the global provider default")
            }
        }
    }

    private func laneNarrationCueEditor(for assignment: VoiceLane) -> some View {
        HStack(spacing: 5) {
            Text("CUE")
                .font(.system(size: 7, weight: .bold, design: .monospaced))
                .foregroundColor(theme.textTertiary)
                .frame(width: 31, alignment: .leading)

            TextField(
                providerSupportsNarrationCue ? "Warm, concise, energized…" : "OpenAI voices only",
                text: $laneCueDraft
            )
            .textFieldStyle(.plain)
            .font(.system(size: 9))
            .foregroundColor(theme.textSecondary)
            .padding(.horizontal, 6)
            .frame(height: 22)
            .background(
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(theme.text.opacity(0.045))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .stroke(theme.text.opacity(0.09), lineWidth: 0.75)
            }
            .disabled(!providerSupportsNarrationCue || isBusy)
            .onSubmit { saveNarrationCue(for: assignment.number) }
            .accessibilityLabel("Narration cue for lane \(assignment.number)")
            .accessibilityHint("A short speaking-style instruction for OpenAI narration")

            Button {
                saveNarrationCue(for: assignment.number)
            } label: {
                Image(systemName: "checkmark")
                    .font(.system(size: 8, weight: .bold))
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(.plain)
            .foregroundColor(accent)
            .disabled(!providerSupportsNarrationCue || isBusy)
            .help("Save narration cue for lane \(assignment.number)")
            .accessibilityLabel("Save lane narration cue")

            if assignment.narrationCue != nil {
                Button {
                    laneCueDraft = ""
                    listening.setNarrationCue("", forLane: assignment.number)
                } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 8, weight: .semibold))
                        .frame(width: 20, height: 20)
                }
                .buttonStyle(.plain)
                .foregroundColor(theme.textTertiary)
                .disabled(isBusy)
                .help("Clear the lane narration cue")
                .accessibilityLabel("Clear lane narration cue")
            }
        }
    }

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
            return "Lane \(number), unassigned. Tap to choose a task. \(shortcut), \(availability)."
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

            Button {
                presentTaskBrowser(.lock)
            } label: {
                Label("Search recent tasks", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity)
            }
            .disabled(listening.tasks.isEmpty)

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

    private var taskBrowserPresented: Binding<Bool> {
        Binding(
            get: { taskBrowserPurpose != nil },
            set: { isPresented in
                if !isPresented {
                    taskBrowserPurpose = nil
                    taskSearch = ""
                }
            }
        )
    }

    private var filteredTasks: [CodexTaskSummary] {
        listening.tasks.filter { $0.matchesSearch(taskSearch) }
    }

    private var taskBrowser: some View {
        VStack(alignment: .leading, spacing: 11) {
            taskBrowserHeader

            taskBrowserSearchField

            taskBrowserSectionHeader

            if filteredTasks.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: taskSearch.isEmpty ? "clock" : "magnifyingglass")
                        .font(.system(size: 18))
                        .foregroundColor(theme.textTertiary)
                    Text(taskSearch.isEmpty ? "No recent tasks found" : "No matching tasks")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(theme.textSecondary)
                    if !taskSearch.isEmpty {
                        Button("Clear search") { taskSearch = "" }
                            .buttonStyle(.plain)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(accent)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 3) {
                        ForEach(filteredTasks) { task in
                            taskBrowserRow(task)
                        }
                    }
                    .padding(.top, 1)
                }
            }
        }
        .padding(12)
        .frame(width: 300, height: 350)
        .background(theme.background)
        .onAppear { listening.refreshTasks() }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard !Task.isCancelled else { return }
                listening.refreshTasks()
            }
        }
    }

    private var taskBrowserHeader: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(taskBrowserTitle)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(theme.text)
                    if case .lane(let number) = taskBrowserPurpose {
                        Text("\(number)")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(accent)
                            .frame(minWidth: 14, minHeight: 14)
                            .padding(.horizontal, 4)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(accent.opacity(0.16))
                            )
                            .overlay {
                                Capsule(style: .continuous)
                                    .stroke(accent.opacity(0.32), lineWidth: 0.75)
                            }
                            .accessibilityHidden(true)
                    }
                }
                Text(taskBrowserSubtitle)
                    .font(.system(size: 9.5))
                    .foregroundColor(theme.textTertiary)
                    .lineSpacing(1)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 6)
            Button {
                listening.refreshTasks()
            } label: {
                Group {
                    if listening.isRefreshingTasks {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10, weight: .semibold))
                    }
                }
                .frame(width: 24, height: 24)
                .foregroundColor(theme.textSecondary)
                .background(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(theme.text.opacity(0.05))
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(theme.text.opacity(0.08), lineWidth: 0.75)
                }
            }
            .buttonStyle(.plain)
            .disabled(listening.isRefreshingTasks)
            .help("Refresh recent tasks")
            .accessibilityLabel("Refresh recent tasks")
        }
    }

    private var taskBrowserSearchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(theme.textTertiary)
            TextField("Title, project, or task ID", text: $taskSearch)
                .textFieldStyle(.plain)
                .font(.system(size: 11))
                .foregroundColor(theme.text)
            if !taskSearch.isEmpty {
                Button {
                    taskSearch = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundColor(theme.textTertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 30)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(theme.text.opacity(0.06))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(theme.text.opacity(0.10), lineWidth: 0.75)
        }
    }

    private var taskBrowserSectionHeader: some View {
        HStack(spacing: 6) {
            Text("RECENT")
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .tracking(0.6)
                .foregroundColor(theme.textTertiary)
            Rectangle()
                .fill(theme.text.opacity(0.07))
                .frame(height: 0.75)
                .frame(maxWidth: .infinity)
            Text("\(filteredTasks.count)")
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundColor(theme.textTertiary)
                .padding(.horizontal, 5)
                .frame(minWidth: 16, minHeight: 14)
                .background(
                    Capsule(style: .continuous)
                        .fill(theme.text.opacity(0.06))
                )
        }
    }

    private func taskBrowserRow(_ task: CodexTaskSummary) -> some View {
        let selected = taskIsSelected(task)
        let laneAssignmentNumber = listening.lanes.first(where: { $0.task.id == task.id })?.number
        let isLocked = listening.lockedTask?.id == task.id
        let isMappingLane: Bool
        if case .lane = taskBrowserPurpose { isMappingLane = true } else { isMappingLane = false }

        let leadingBarColor: Color = {
            if selected { return accent }
            if isLocked && isMappingLane { return accent.opacity(0.55) }
            if laneAssignmentNumber != nil { return accent.opacity(0.28) }
            return theme.text.opacity(0.10)
        }()

        return Button {
            chooseTask(task)
        } label: {
            HStack(alignment: .center, spacing: 9) {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(leadingBarColor)
                    .frame(width: 2.5, height: 30)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(task.title.isEmpty ? "Untitled task" : task.title)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(theme.text)
                            .lineLimit(1)
                            .truncationMode(.tail)
                        if isLocked && isMappingLane {
                            Image(systemName: "lock.fill")
                                .font(.system(size: 7, weight: .semibold))
                                .foregroundColor(accent.opacity(0.85))
                                .accessibilityHidden(true)
                        }
                        Spacer(minLength: 4)
                        Text(task.activityLabel())
                            .font(.system(size: 8.5, weight: .medium, design: .monospaced))
                            .foregroundColor(theme.textTertiary)
                            .lineLimit(1)
                            .frame(minWidth: 22, alignment: .trailing)
                    }
                    HStack(spacing: 5) {
                        if let assignedLane = laneAssignmentNumber {
                            Text("LANE \(assignedLane)")
                                .font(.system(size: 7.5, weight: .bold, design: .monospaced))
                                .tracking(0.4)
                                .foregroundColor(accent)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(accent.opacity(0.13))
                                )
                                .accessibilityHidden(true)
                        }
                        Text(task.projectName.isEmpty ? task.cwd : task.projectName)
                            .foregroundColor(theme.textSecondary.opacity(0.72))
                        if !task.preview.isEmpty {
                            Circle()
                                .fill(theme.text.opacity(0.22))
                                .frame(width: 2, height: 2)
                            Text(task.preview)
                                .foregroundColor(theme.textTertiary)
                        }
                    }
                    .font(.system(size: 9))
                    .lineLimit(1)
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(accent)
                }
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(selected ? accent.opacity(0.09) : Color.clear)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(selected ? accent.opacity(0.24) : Color.clear, lineWidth: 0.75)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(taskRowAccessibilityLabel(task))
    }

    private var taskBrowserTitle: String {
        switch taskBrowserPurpose {
        case .lane: "Map lane"
        default: "Choose conversation task"
        }
    }

    private var taskBrowserSubtitle: String {
        switch taskBrowserPurpose {
        case .lane: "Pick an exact Codex task. Your current lock stays put."
        default: "Search recent tasks, then move the voice lock."
        }
    }

    private func presentTaskBrowser(_ purpose: TaskBrowserPurpose) {
        guard !isBusy else { return }
        taskSearch = ""
        taskBrowserPurpose = purpose
        listening.refreshTasks()
    }

    private func chooseTask(_ task: CodexTaskSummary) {
        let purpose = taskBrowserPurpose
        taskBrowserPurpose = nil
        taskSearch = ""
        switch purpose {
        case .lane(let number):
            listening.assign(task, toLane: number)
        case .lock:
            listening.lock(task)
        case nil:
            break
        }
    }

    private func taskIsSelected(_ task: CodexTaskSummary) -> Bool {
        switch taskBrowserPurpose {
        case .lane(let number): listening.lane(number)?.task.id == task.id
        default: listening.lockedTask?.id == task.id || listening.selectedTaskID == task.id
        }
    }

    private func taskRowAccessibilityLabel(_ task: CodexTaskSummary) -> String {
        let project = task.projectName.isEmpty ? task.cwd : task.projectName
        return "\(task.title), project \(project)\(taskIsSelected(task) ? ", selected" : "")"
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
