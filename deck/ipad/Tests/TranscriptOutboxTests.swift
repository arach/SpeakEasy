import Foundation

// Run with the production outbox source using the command in README.md.
@main
struct TranscriptOutboxTests {
    static func main() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let outbox = DeckTranscriptOutbox(directory: directory)
        let original = DeckTranscriptOutbox.Target(host: "mac-a", origin: "herdr", threadId: "conversation-a", sessionAlias: "pane-a")
        let entry = outbox.enqueue(text: "preserve every word", lane: 6, target: original)!
        precondition(outbox.first == entry, "persist capture destination")
        precondition(entry.matches(original), "same destination survives reconnect")
        precondition(!entry.matches(.init(host: "mac-b", origin: original.origin, threadId: original.threadId, sessionAlias: original.sessionAlias)), "another host cannot receive held speech")
        precondition(!entry.matches(.init(host: original.host, origin: original.origin, threadId: "conversation-b", sessionAlias: original.sessionAlias)), "reused pane cannot receive held speech")
        let legacy = try JSONDecoder().decode(DeckTranscriptOutbox.Entry.self, from: Data(#"{"id":"legacy","text":"held","capturedAt":0,"lane":6}"#.utf8))
        precondition(!legacy.matches(original), "legacy speech must be reviewed")
        outbox.retire(entry.id)
        precondition(outbox.first == nil)
        print("Transcript outbox destination checks passed")
    }
}
