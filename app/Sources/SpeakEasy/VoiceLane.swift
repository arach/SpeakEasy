import Foundation

struct LaneVoiceOverride: Codable, Equatable, Sendable {
    let provider: String
    let voiceID: String

    init?(provider: String, voiceID: String) {
        let normalizedProvider = provider.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedVoiceID = voiceID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedProvider.isEmpty, !normalizedVoiceID.isEmpty else { return nil }
        self.provider = normalizedProvider
        self.voiceID = normalizedVoiceID
    }
}

struct VoiceLane: Codable, Equatable, Identifiable, Sendable {
    let number: Int
    let task: ListeningTaskLock
    var voiceOverride: LaneVoiceOverride?

    init(
        number: Int,
        task: ListeningTaskLock,
        voiceOverride: LaneVoiceOverride? = nil
    ) {
        self.number = number
        self.task = task
        self.voiceOverride = voiceOverride
    }

    var id: Int { number }
    var shortcutTitle: String { GlobalListeningShortcut.title(forLane: number) }

    var spokenTitle: String {
        let words = task.title
            .split(whereSeparator: \Character.isWhitespace)
            .prefix(7)
            .joined(separator: " ")
        return words.isEmpty ? "Task \(number)" : words
    }
}
