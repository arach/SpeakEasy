import SwiftUI

private struct DeckSessionGroup: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let harnessKey: String
    let harnessLabel: String
    let threads: [DeckThreadInfo]
}

/// Unified session browser — multiplexers, workspaces, and individual threads
/// in one surface. Replaces the old split between lane setup (Codex-only flat
/// list) and Explore (Herdr read-only).
struct DeckSessionBrowserView: View {
    @ObservedObject var connection: DeckConnection
    @Binding var laneIndex: Int
    var dismissAfterAssign = false
    var onDismiss: (() -> Void)?

    @State private var query = ""
    @State private var harnessFilter: String? = nil

    private static let preferredHarnessOrder = ["codex", "claude", "grok", "kimi", "cursor", "opencode", "pi"]
    @State private var selectedThreadID: String?
    @State private var expandedGroups: Set<String> = []
    @State private var collapsedGroups: Set<String> = []

    private var lanes: [DeckLaneInfo] {
        Array((connection.snapshot?.lanes ?? []).prefix(9))
    }

    private var currentLane: DeckLaneInfo? {
        lanes.indices.contains(laneIndex) ? lanes[laneIndex] : nil
    }

    private var catalog: [DeckThreadInfo] {
        connection.snapshot?.catalog ?? []
    }

    private var boundCount: Int {
        lanes.filter(\.isAssigned).count
    }

    private var availableHarnesses: [String] {
        let keys = Set(catalog.map(\.harnessKey))
        let preferred = Self.preferredHarnessOrder.filter { keys.contains($0) }
        let rest = keys.subtracting(Set(preferred)).sorted()
        return preferred + rest
    }

    private var scopedCatalog: [DeckThreadInfo] {
        guard let harnessFilter else { return catalog }
        return catalog.filter { $0.harnessKey == harnessFilter }
    }

    private var filteredCatalog: [DeckThreadInfo] {
        let terms = query.lowercased().split(whereSeparator: \.isWhitespace)
        guard !terms.isEmpty else { return scopedCatalog }
        return scopedCatalog.filter { thread in
            let haystack = "\(thread.channelContext) \(thread.harnessLabel) \(thread.harnessKey) \(thread.agentName ?? "") \(thread.displayProject) \(thread.snippet) \(thread.preview ?? "") \(thread.cwd) \(thread.id) \(thread.agentStatus ?? "")".lowercased()
            return terms.allSatisfy { haystack.contains($0) }
        }
    }

    private var groups: [DeckSessionGroup] {
        var order: [String] = []
        var buckets: [String: [DeckThreadInfo]] = [:]
        for thread in filteredCatalog {
            let key = thread.channelContext
            if buckets[key] == nil { order.append(key) }
            buckets[key, default: []].append(thread)
        }
        return order.map { key in
            let threads = sortedThreads(buckets[key] ?? [])
            let first = threads[0]
            let title = first.herdrSession ?? first.displayProject
            let subtitle = first.herdrSession != nil ? (first.hostName ?? "Mac") + " · " + first.harnessLabel : first.cwd
            return DeckSessionGroup(
                id: key,
                title: title,
                subtitle: subtitle,
                harnessKey: first.harnessKey,
                harnessLabel: first.harnessLabel,
                threads: threads
            )
        }
    }

    private var selectedThread: DeckThreadInfo? {
        guard let selectedThreadID else { return nil }
        return filteredCatalog.first { $0.id == selectedThreadID }
    }

    private var recentProjects: [(name: String, cwd: String)] {
        var seen = Set<String>()
        var out: [(name: String, cwd: String)] = []
        for thread in sortedThreads(catalog.filter { $0.harnessKey == "codex" }) {
            guard !thread.cwd.isEmpty, seen.insert(thread.cwd).inserted else { continue }
            out.append((thread.displayProject, thread.cwd))
            if out.count == 6 { break }
        }
        return out
    }

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                padPicker
                Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
                controls
                Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)

                if geometry.size.width >= 760 {
                    HStack(spacing: 0) {
                        sessionList
                        Rectangle().fill(DeckPalette.lineSoft).frame(width: 1)
                        sessionPreview
                            .frame(width: min(300, geometry.size.width * 0.36))
                    }
                } else {
                    sessionList
                    if selectedThread != nil {
                        Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
                        sessionPreview
                    }
                }
            }
        }
        .onAppear { syncSelection() }
        .onChange(of: filteredCatalog.map(\.id)) { _, _ in syncSelection() }
        .onChange(of: laneIndex) { _, _ in
            if let current = currentLane?.threadId {
                selectedThreadID = current
            }
        }
    }

    private var padPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("ASSIGN TO PAD")
                    .deckMono(8, weight: .semibold)
                    .tracking(1.2)
                    .foregroundStyle(DeckPalette.ink4)
                Spacer()
                Text("\(boundCount) / 9 bound")
                    .deckMono(8)
                    .foregroundStyle(DeckPalette.ink3)
            }
            HStack {
                Text("PAD \(String(format: "%02d", laneIndex + 1))")
                    .deckMono(8.5, weight: .semibold)
                    .tracking(1.1)
                    .foregroundStyle(DeckPalette.accent)
                Text(currentLane?.title ?? "Unassigned")
                    .deckMono(9)
                    .foregroundStyle(DeckPalette.ink2)
                    .lineLimit(1)
                Spacer()
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(Array(lanes.enumerated()), id: \.offset) { index, lane in
                        Button { laneIndex = index } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(String(format: "%02d", index + 1))
                                    .deckMono(12, weight: .semibold)
                                Text(laneBadge(lane))
                                    .deckMono(7, weight: .semibold)
                                    .foregroundStyle(laneBadgeColor(lane))
                            }
                            .frame(minWidth: 54, minHeight: 52, alignment: .leading)
                            .padding(.horizontal, 10)
                            .background(laneIndex == index ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                            .overlay { RoundedRectangle(cornerRadius: 8).stroke(laneIndex == index ? DeckPalette.accent : DeckPalette.line) }
                        }
                        .buttonStyle(DeckPressButtonStyle())
                    }
                }
                .padding(.horizontal, 1)
            }
        }
        .padding(14)
        .background(DeckPalette.panelHead)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Search sessions, agents, projects or workspaces", text: $query)
                .textFieldStyle(.plain)
                .deckMono(11)
                .padding(.horizontal, 12)
                .frame(height: 40)
                .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line) }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    Button { harnessFilter = nil } label: {
                        harnessChip("ALL", selected: harnessFilter == nil)
                    }
                    .buttonStyle(DeckPressButtonStyle())
                    ForEach(availableHarnesses, id: \.self) { harness in
                        Button { harnessFilter = harness } label: {
                            harnessChip(DeckThreadInfo.harnessDisplayLabel(harness), selected: harnessFilter == harness)
                        }
                        .buttonStyle(DeckPressButtonStyle())
                    }
                }
            }

            HStack(spacing: 6) {
                Spacer()
                Text(query.isEmpty ? "\(filteredCatalog.count) sessions" : "\(filteredCatalog.count) match")
                    .deckMono(8)
                    .foregroundStyle(DeckPalette.ink4)
                Button { connection.refreshCatalog() } label: {
                    Image(systemName: "arrow.clockwise")
                        .deckMono(11)
                        .foregroundStyle(DeckPalette.ink2)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(DeckPressButtonStyle())
                .accessibilityLabel("Refresh sessions")
            }

            HStack(spacing: 8) {
                Button { startNewThread() } label: {
                    Label("NEW THREAD", systemImage: "plus")
                        .deckMono(9, weight: .semibold)
                        .tracking(0.8)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(DeckPalette.micTop.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.accentEdge) }
                }
                .buttonStyle(DeckPressButtonStyle())

                Button { assign(nil) } label: {
                    Text("CLEAR PAD")
                        .deckMono(9, weight: .semibold)
                        .tracking(0.8)
                        .frame(minWidth: 88, minHeight: 36)
                        .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line, style: StrokeStyle(lineWidth: 1, dash: [4])) }
                }
                .buttonStyle(DeckPressButtonStyle())
            }

            if !recentProjects.isEmpty && (harnessFilter == nil || harnessFilter == "codex") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(recentProjects, id: \.cwd) { project in
                            Button {
                                connection.newThread(laneIndex, cwd: project.cwd)
                                onDismiss?()
                            } label: {
                                Text(project.name.uppercased())
                                    .deckMono(8, weight: .semibold)
                                    .padding(.horizontal, 10)
                                    .frame(height: 26)
                                    .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 7))
                                    .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.line) }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                        }
                    }
                }
            }
        }
        .padding(14)
    }

    private var sessionList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                if groups.isEmpty {
                    Text(query.isEmpty ? (connection.snapshot?.catalogError ?? "No sessions on this Mac. Open Codex, Claude, Grok, or other agents, then refresh.") : "No matching sessions")
                        .deckMono(9)
                        .foregroundStyle(DeckPalette.ink3)
                        .padding(.vertical, 24)
                        .frame(maxWidth: .infinity)
                }

                ForEach(groups) { group in
                    groupSection(group)
                }
            }
            .padding(14)
        }
    }

    private func groupSection(_ group: DeckSessionGroup) -> some View {
        let collapsed = collapsedGroups.contains(group.id)
        let visible = visibleThreads(in: group)

        return VStack(alignment: .leading, spacing: 8) {
            Button {
                toggleGroupCollapse(group.id)
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: collapsed ? "chevron.right" : "chevron.down")
                        .deckMono(8, weight: .semibold)
                        .foregroundStyle(DeckPalette.ink3)
                    Text(group.harnessLabel)
                        .deckMono(7.5, weight: .semibold)
                        .tracking(1)
                        .foregroundStyle(group.harnessKey == "codex" ? DeckPalette.accent : DeckPalette.micTop)
                    Text(group.title)
                        .deckMono(11, weight: .semibold)
                        .foregroundStyle(DeckPalette.ink)
                    Spacer()
                    Text("\(group.threads.count)")
                        .deckMono(8)
                        .foregroundStyle(DeckPalette.ink4)
                }
            }
            .buttonStyle(.plain)

            if !collapsed {
                Text(group.subtitle)
                    .deckMono(8)
                    .foregroundStyle(DeckPalette.ink3)
                    .lineLimit(1)
                    .truncationMode(.middle)

                ForEach(visible.threads) { thread in
                    sessionRow(thread)
                }

                if visible.hidden > 0 {
                    Button {
                        expandedGroups.insert(group.id)
                    } label: {
                        Text("SHOW \(visible.hidden) MORE IN \(group.title.uppercased())")
                            .deckMono(8, weight: .semibold)
                            .tracking(0.6)
                            .foregroundStyle(DeckPalette.accent)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(DeckPressButtonStyle())
                }
            }
        }
    }

    @ViewBuilder
    private var sessionPreview: some View {
        if let thread = selectedThread {
            let bound = boundLane(for: thread.id)
            let blocked = thread.originator == "herdr" && thread.agentStatus == "unlinked"
            let onCurrentPad = bound == laneIndex

            VStack(alignment: .leading, spacing: 14) {
                Text("PREVIEW")
                    .deckMono(8, weight: .semibold)
                    .tracking(1.2)
                    .foregroundStyle(DeckPalette.ink4)

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Text(thread.harnessLabel)
                            .deckMono(7.5, weight: .semibold)
                            .foregroundStyle(thread.harnessKey == "codex" ? DeckPalette.accent : DeckPalette.micTop)
                        if thread.isPinned == true {
                            Text("PINNED")
                                .deckMono(7, weight: .semibold)
                                .foregroundStyle(DeckPalette.amber)
                        }
                        Spacer()
                        Text(thread.alias)
                            .deckMono(7.5)
                            .foregroundStyle(DeckPalette.ink3)
                    }
                    Text(thread.snippet)
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundStyle(DeckPalette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if let preview = thread.preview, !preview.isEmpty {
                        Text(preview)
                            .deckMono(8.5)
                            .foregroundStyle(DeckPalette.ink2)
                    }
                    previewFact("Workspace", thread.cwd)
                    if thread.originator == "herdr", let agent = thread.agentName {
                        previewFact("Agent", "\(agent) · \(thread.agentStatus ?? "unknown")")
                    } else {
                        previewFact("Updated", relativeAge(thread.at))
                    }
                    if let bound {
                        previewFact("Bound", "Pad \(bound + 1)")
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 9))
                .overlay { RoundedRectangle(cornerRadius: 9).stroke(DeckPalette.line) }

                if blocked {
                    Text("Enable Herdr session integration before connecting voice.")
                        .deckMono(8)
                        .foregroundStyle(DeckPalette.ink3)
                } else {
                    VStack(spacing: 8) {
                        if onCurrentPad {
                            Text("Already on pad \(laneIndex + 1)")
                                .deckMono(8)
                                .foregroundStyle(DeckPalette.accent)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Button {
                                connection.selectLane(laneIndex)
                                onDismiss?()
                            } label: {
                                Text("SWITCH TO THIS PAD")
                                    .deckMono(9, weight: .semibold)
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                    .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 8))
                                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.accentEdge) }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                        } else if let bound {
                            Button {
                                connection.selectLane(bound)
                                onDismiss?()
                            } label: {
                                Text("GO TO PAD \(bound + 1)")
                                    .deckMono(9, weight: .semibold)
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                    .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line) }
                            }
                            .buttonStyle(DeckPressButtonStyle())

                            Button {
                                assign(thread.id)
                            } label: {
                                Text("MOVE TO PAD \(laneIndex + 1)")
                                    .deckMono(9, weight: .semibold)
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                    .background(DeckPalette.micTop.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.accentEdge) }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                        } else {
                            Button {
                                assign(thread.id)
                            } label: {
                                Text("ASSIGN TO PAD \(laneIndex + 1)")
                                    .deckMono(9, weight: .semibold)
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                    .background(DeckPalette.micTop.opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
                                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.accentEdge) }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                        }
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(14)
            .background(DeckPalette.panelHead)
        } else {
            VStack(spacing: 10) {
                Spacer()
                Text("Select a session")
                    .deckMono(10, weight: .semibold)
                    .foregroundStyle(DeckPalette.ink3)
                Text("Tap a Codex task or agent session to preview it, then assign or jump to its pad.")
                    .deckMono(8.5)
                    .foregroundStyle(DeckPalette.ink4)
                    .multilineTextAlignment(.center)
                Spacer()
            }
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(DeckPalette.panelHead)
        }
    }

    private func previewFact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .deckMono(7, weight: .semibold)
                .foregroundStyle(DeckPalette.ink4)
            Text(value)
                .deckMono(8.5)
                .foregroundStyle(DeckPalette.ink2)
                .lineLimit(2)
                .truncationMode(.middle)
        }
    }

    private func sessionRow(_ thread: DeckThreadInfo) -> some View {
        let selected = selectedThreadID == thread.id
        let bound = boundLane(for: thread.id)
        let blocked = thread.originator == "herdr" && thread.agentStatus == "unlinked"

        return Button {
            selectedThreadID = thread.id
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Circle()
                    .fill(statusColor(thread))
                    .frame(width: 6, height: 6)
                    .padding(.top, 5)
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        if thread.isPinned == true {
                            Text("PIN")
                                .deckMono(7, weight: .semibold)
                                .foregroundStyle(DeckPalette.amber)
                        }
                        if thread.originator == "herdr", let agent = thread.agentName {
                            Text("\(agent.uppercased()) · \(thread.agentStatus ?? "unknown")")
                                .deckMono(8, weight: .semibold)
                                .foregroundStyle(DeckPalette.ink2)
                        } else {
                            Text(relativeAge(thread.at))
                                .deckMono(7.5)
                                .foregroundStyle(DeckPalette.ink3)
                        }
                    }
                    Text(thread.snippet)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(blocked ? DeckPalette.ink4 : DeckPalette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if blocked {
                        Text("Session integration required")
                            .deckMono(8)
                            .foregroundStyle(DeckPalette.ink3)
                    } else if let bound {
                        Text(bound == laneIndex ? "Current on this pad" : "Pad \(bound + 1) · preview to move or jump")
                            .deckMono(7.5)
                            .foregroundStyle(DeckPalette.accent)
                    }
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "chevron.right")
                        .deckMono(10, weight: .semibold)
                        .foregroundStyle(DeckPalette.accent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(selected ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 9))
            .overlay { RoundedRectangle(cornerRadius: 9).stroke(selected ? DeckPalette.accentEdge : DeckPalette.line) }
            .opacity(blocked ? 0.72 : 1)
        }
        .buttonStyle(DeckPressButtonStyle())
    }

    private func sortedThreads(_ threads: [DeckThreadInfo]) -> [DeckThreadInfo] {
        threads.sorted { lhs, rhs in
            let lp = lhs.isPinned == true
            let rp = rhs.isPinned == true
            if lp != rp { return lp }
            return lhs.at > rhs.at
        }
    }

    private func visibleThreads(in group: DeckSessionGroup) -> (threads: [DeckThreadInfo], hidden: Int) {
        let sorted = group.threads
        if !query.isEmpty || expandedGroups.contains(group.id) || sorted.count <= 5 {
            return (sorted, 0)
        }
        return (Array(sorted.prefix(5)), max(0, sorted.count - 5))
    }

    private func toggleGroupCollapse(_ id: String) {
        if collapsedGroups.contains(id) {
            collapsedGroups.remove(id)
        } else {
            collapsedGroups.insert(id)
        }
    }

    private func syncSelection() {
        if let selectedThreadID,
           filteredCatalog.contains(where: { $0.id == selectedThreadID }) {
            return
        }
        if let current = currentLane?.threadId,
           filteredCatalog.contains(where: { $0.id == current }) {
            selectedThreadID = current
            return
        }
        selectedThreadID = filteredCatalog.first?.id
    }

    private func relativeAge(_ timestamp: Double) -> String {
        let seconds = max(0, Date().timeIntervalSince1970 - timestamp)
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86400 { return "\(Int(seconds / 3600))h ago" }
        return "\(Int(seconds / 86400))d ago"
    }

    private func harnessChip(_ label: String, selected: Bool) -> some View {
        Text(label)
            .deckMono(8.5, weight: .semibold)
            .tracking(0.8)
            .foregroundStyle(selected ? DeckPalette.ink : DeckPalette.ink3)
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(selected ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 7))
            .overlay { RoundedRectangle(cornerRadius: 7).stroke(selected ? DeckPalette.accentEdge : DeckPalette.line) }
    }

    private func laneBadge(_ lane: DeckLaneInfo) -> String {
        if lane.origin == "deck" { return "DECK" }
        if let threadID = lane.threadId, let thread = catalog.first(where: { $0.id == threadID }) {
            return thread.harnessLabel
        }
        if lane.origin == "herdr" { return "AGENT" }
        return lane.threadId == nil ? "FRESH" : "CODEX"
    }

    private func laneBadgeColor(_ lane: DeckLaneInfo) -> Color {
        if lane.origin == "deck" { return DeckPalette.micTop }
        if let threadID = lane.threadId, let thread = catalog.first(where: { $0.id == threadID }) {
            return thread.harnessKey == "codex" ? DeckPalette.accent : DeckPalette.micTop
        }
        return lane.threadId == nil ? DeckPalette.ink3 : DeckPalette.accent
    }

    private func statusColor(_ thread: DeckThreadInfo) -> Color {
        if thread.originator == "herdr" {
            switch thread.agentStatus {
            case "working": return DeckPalette.accent
            case "blocked", "unlinked": return DeckPalette.ink4
            default: return DeckPalette.ink3
            }
        }
        return DeckPalette.accent.opacity(0.85)
    }

    private func boundLane(for threadID: String) -> Int? {
        connection.snapshot?.lanes.prefix(9).firstIndex(where: { $0.threadId == threadID })
    }

    private func assign(_ threadID: String?) {
        connection.assignLane(laneIndex, threadID: threadID)
        if dismissAfterAssign { onDismiss?() }
    }

    private func startNewThread() {
        connection.newThread(laneIndex)
        onDismiss?()
    }
}
