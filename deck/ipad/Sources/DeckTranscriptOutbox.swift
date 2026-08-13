import Foundation
import OSLog

/// Durable, ordered queue of transcripts the Mac has not accepted yet.
///
/// Transcription happens on this device, so by the time a transcript exists the
/// user has already said the words — losing it because a socket blinked, a lane
/// was busy, or the app was backgrounded is never acceptable. An entry leaves
/// only after the Mac acknowledges it or the operator explicitly discards the
/// visible transcript.
///
/// One file per entry, named by capture time, so a plain lexicographic sort
/// replays utterances in the order they were spoken and no single index file
/// can corrupt the whole queue.
struct DeckTranscriptOutbox {
    struct Entry: Codable, Equatable, Identifiable {
        let id: String
        let text: String
        let capturedAt: Double
        /// The lane the operator was looking at when they spoke. Delivery can
        /// happen minutes later, so the target travels with the transcript
        /// rather than being inferred from wherever the Mac has landed since.
        let lane: Int
    }

    private let directory: URL
    private let log = Logger(subsystem: "dev.arach.speakeasy.deck", category: "transcript-outbox")

    init(directory: URL? = nil) {
        if let directory {
            self.directory = directory
            return
        }

        let root = (try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )) ?? FileManager.default.temporaryDirectory

        self.directory = root
            .appendingPathComponent("SpeakEasyDeck", isDirectory: true)
            .appendingPathComponent("Outbox", isDirectory: true)
    }

    @discardableResult
    func enqueue(text: String, lane: Int, capturedAt: Date = Date()) -> Entry? {
        let entry = Entry(
            id: UUID().uuidString,
            text: text,
            capturedAt: capturedAt.timeIntervalSince1970,
            lane: lane
        )

        do {
            try createDirectoryIfNeeded()
            let stamp = String(format: "%015.3f", entry.capturedAt)
            let url = directory
                .appendingPathComponent("\(stamp)-\(entry.id)")
                .appendingPathExtension("json")
            try JSONEncoder().encode(entry).write(to: url, options: .atomic)
            try? FileManager.default.setAttributes(
                [.posixPermissions: 0o600],
                ofItemAtPath: url.path
            )
            return entry
        } catch {
            log.error("Could not persist a transcript: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    /// Every undelivered transcript, oldest first.
    func entries() -> [Entry] {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return [] }

        return files
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .compactMap { url in
                guard let data = try? Data(contentsOf: url),
                      let entry = try? JSONDecoder().decode(Entry.self, from: data) else {
                    // Unreadable entries would otherwise wedge the queue head forever.
                    log.error("Discarding an unreadable outbox entry at \(url.lastPathComponent, privacy: .public)")
                    try? FileManager.default.removeItem(at: url)
                    return nil
                }
                return entry
            }
    }

    var first: Entry? { entries().first }

    /// Drop a transcript the Mac has confirmed. Anything else keeps it.
    func retire(_ id: String) {
        remove(id)
    }

    /// The only non-delivery removal path. Callers must put the transcript in
    /// front of the operator and ask before invoking it.
    func discard(_ id: String) {
        remove(id)
    }

    private func remove(_ id: String) {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return }

        for url in files where url.lastPathComponent.contains(id) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private func createDirectoryIfNeeded() throws {
        guard !FileManager.default.fileExists(atPath: directory.path) else { return }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
}
