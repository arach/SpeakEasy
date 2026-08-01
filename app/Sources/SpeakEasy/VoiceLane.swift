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
    var label: String?
    let task: ListeningTaskLock
    var voiceOverride: LaneVoiceOverride?
    var narrationCue: String?
    var playbackRate: Float?

    init(
        number: Int,
        label: String? = nil,
        task: ListeningTaskLock,
        voiceOverride: LaneVoiceOverride? = nil,
        narrationCue: String? = nil,
        playbackRate: Float? = nil
    ) {
        self.number = number
        self.label = Self.normalizedLabel(label)
        self.task = task
        self.voiceOverride = voiceOverride
        self.narrationCue = Self.normalizedNarrationCue(narrationCue)
        self.playbackRate = Self.normalizedPlaybackRate(playbackRate)
    }

    var id: Int { number }
    var shortcutTitle: String { GlobalListeningShortcut.title(forLane: number) }
    var effectivePlaybackRate: Float { Self.normalizedPlaybackRate(playbackRate) ?? 1 }

    var spokenTitle: String {
        let words = (label ?? task.title)
            .split(whereSeparator: \Character.isWhitespace)
            .prefix(7)
            .joined(separator: " ")
        return words.isEmpty ? "Task \(number)" : words
    }

    static func normalizedLabel(_ label: String?) -> String? {
        guard let label else { return nil }
        let normalized = label.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : String(normalized.prefix(80))
    }

    static func normalizedNarrationCue(_ cue: String?) -> String? {
        guard let cue else { return nil }
        let normalized = cue.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : String(normalized.prefix(240))
    }

    static func normalizedPlaybackRate(_ rate: Float?) -> Float? {
        guard let rate, rate.isFinite else { return nil }
        return min(max(rate, 0.5), 2)
    }
}
