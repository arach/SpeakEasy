import Foundation

struct VoiceLane: Codable, Equatable, Identifiable, Sendable {
    let number: Int
    let task: ListeningTaskLock

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
