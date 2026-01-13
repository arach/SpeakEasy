import SwiftUI
import Foundation

struct HistoryEntry: Identifiable, Codable {
    let id: String
    let text: String
    let provider: String
    let timestamp: TimeInterval
    let cached: Bool
}

class HistoryService: ObservableObject {
    static let shared = HistoryService()

    @Published var entries: [HistoryEntry] = []
    @Published var isLoading = false

    private let historyDir: URL

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        historyDir = home.appendingPathComponent(".config/speakeasy/history")
    }

    func refresh() {
        isLoading = true

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            var allEntries: [HistoryEntry] = []

            do {
                let fileManager = FileManager.default
                guard fileManager.fileExists(atPath: historyDir.path) else {
                    DispatchQueue.main.async {
                        self.entries = []
                        self.isLoading = false
                    }
                    return
                }

                let files = try fileManager.contentsOfDirectory(at: historyDir, includingPropertiesForKeys: nil)
                    .filter { $0.lastPathComponent.hasPrefix("history-") && $0.pathExtension == "json" }
                    .sorted { $0.lastPathComponent > $1.lastPathComponent }

                for file in files {
                    do {
                        let data = try Data(contentsOf: file)
                        let entries = try JSONDecoder().decode([HistoryEntry].self, from: data)
                        allEntries.append(contentsOf: entries)
                    } catch {
                        // Skip corrupted files
                    }
                }
            } catch {
                // Directory doesn't exist or other error
            }

            // Sort by timestamp descending
            allEntries.sort { $0.timestamp > $1.timestamp }

            DispatchQueue.main.async {
                self.entries = allEntries
                self.isLoading = false
            }
        }
    }

    func clear() {
        let fileManager = FileManager.default

        do {
            guard fileManager.fileExists(atPath: historyDir.path) else { return }

            let files = try fileManager.contentsOfDirectory(at: historyDir, includingPropertiesForKeys: nil)
                .filter { $0.lastPathComponent.hasPrefix("history-") && $0.pathExtension == "json" }

            for file in files {
                try fileManager.removeItem(at: file)
            }

            entries = []
        } catch {
            // Ignore errors
        }
    }
}

struct HistoryView: View {
    @EnvironmentObject var config: ConfigManager
    @Environment(\.theme) var theme
    @StateObject private var historyService = HistoryService.shared
    @State private var showClearConfirmation = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            GlassSection(title: "Notification History", icon: "clock.arrow.circlepath", color: .blue) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Total Notifications")
                                .font(.caption)
                                .foregroundColor(theme.textSecondary)
                            Text("\(historyService.entries.count)")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(theme.text)
                        }
                        .padding(12)
                        .glassBackground(cornerRadius: 10, intensity: .subtle)

                        Spacer()

                        if let latest = historyService.entries.first {
                            VStack(alignment: .trailing) {
                                Text("Latest")
                                    .font(.caption)
                                    .foregroundColor(theme.textSecondary)
                                Text(formatRelativeTime(latest.timestamp))
                                    .font(.title2)
                                    .fontWeight(.semibold)
                                    .foregroundColor(theme.text)
                            }
                            .padding(12)
                            .glassBackground(cornerRadius: 10, intensity: .subtle)
                        }
                    }

                    HStack {
                        Button(action: { historyService.refresh() }) {
                            Label("Refresh", systemImage: "arrow.clockwise")
                                .foregroundColor(theme.text.opacity(0.9))
                        }
                        .buttonStyle(.flat)

                        Spacer()

                        Button(action: { showClearConfirmation = true }) {
                            Label("Clear All", systemImage: "trash")
                                .foregroundColor(theme.text.opacity(0.9))
                        }
                        .buttonStyle(.flat)
                        .disabled(historyService.entries.isEmpty)
                    }
                }
            }

            // History List
            GlassSection(title: "Recent Notifications", icon: "list.bullet", color: .blue) {
                if historyService.isLoading {
                    HStack {
                        Spacer()
                        ProgressIndicator()
                        Text("Loading...")
                            .foregroundColor(theme.textSecondary)
                        Spacer()
                    }
                    .padding(.vertical, 20)
                } else if historyService.entries.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "text.bubble")
                            .font(.system(size: 32))
                            .foregroundColor(theme.textTertiary)
                        Text("No notifications yet")
                            .foregroundColor(theme.textSecondary)
                        Text("Spoken notifications will appear here")
                            .font(.caption)
                            .foregroundColor(theme.textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 30)
                } else {
                    VStack(spacing: 8) {
                        ForEach(historyService.entries.prefix(50)) { entry in
                            HistoryEntryRow(entry: entry)
                        }

                        if historyService.entries.count > 50 {
                            Text("Showing 50 of \(historyService.entries.count) notifications")
                                .font(.caption)
                                .foregroundColor(theme.textTertiary)
                                .padding(.top, 8)
                        }
                    }
                }
            }
        }
        .onAppear {
            historyService.refresh()
        }
        .alert("Clear History", isPresented: $showClearConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Clear All", role: .destructive) {
                historyService.clear()
            }
        } message: {
            Text("This will delete all notification history. This action cannot be undone.")
        }
    }

    private func formatRelativeTime(_ timestamp: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else {
            let days = Int(interval / 86400)
            return "\(days)d ago"
        }
    }
}

struct HistoryEntryRow: View {
    @Environment(\.theme) var theme
    let entry: HistoryEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.text)
                    .font(.subheadline)
                    .foregroundColor(theme.text)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    // Provider badge
                    Text(entry.provider.capitalized)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(theme.textSecondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(theme.surface)
                        )

                    // Cached badge
                    if entry.cached {
                        Text("CACHED")
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(theme.textTertiary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .stroke(theme.border, lineWidth: 0.5)
                            )
                    }

                    Spacer()

                    // Timestamp
                    Text(formatTime(entry.timestamp))
                        .font(.caption)
                        .foregroundColor(theme.textTertiary)
                }
            }
        }
        .padding(12)
        .glassBackground(cornerRadius: 10, intensity: .subtle)
    }

    private func formatTime(_ timestamp: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let formatter = DateFormatter()

        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
        } else if calendar.isDateInYesterday(date) {
            formatter.dateFormat = "'Yesterday' h:mm a"
        } else {
            formatter.dateFormat = "MMM d, h:mm a"
        }

        return formatter.string(from: date)
    }
}

struct ProgressIndicator: View {
    @State private var isAnimating = false

    var body: some View {
        Circle()
            .trim(from: 0, to: 0.7)
            .stroke(Color.primary.opacity(0.3), lineWidth: 2)
            .frame(width: 16, height: 16)
            .rotationEffect(Angle(degrees: isAnimating ? 360 : 0))
            .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: isAnimating)
            .onAppear {
                isAnimating = true
            }
    }
}
