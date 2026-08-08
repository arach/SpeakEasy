import Foundation

enum DeckLaneState: String, Decodable {
    case speaking
    case working
    case idle
    case empty
}

struct DeckMessage: Decodable {
    let role: String
    let text: String
    let dur: Double
    let mirrored: Bool?
    let file: String?
    let audioUrl: String?

    var hasAudio: Bool { file != nil && audioUrl != nil }
}

struct DeckTraceEntry: Decodable, Identifiable {
    let at: String
    let kind: String
    let detail: String

    var id: String { "\(at)|\(kind)|\(detail)" }
}

struct DeckThreadInfo: Decodable, Identifiable {
    let id: String
    let cwd: String
    let snippet: String
    let preview: String?
    let project: String?
    let at: Double
    let originator: String
    let isPinned: Bool?

    var displayProject: String {
        if let project, !project.isEmpty { return project }
        let component = URL(fileURLWithPath: cwd).lastPathComponent
        return component.isEmpty ? "Codex" : component
    }

    var alias: String {
        String(id.replacingOccurrences(of: "-", with: "").suffix(8)).uppercased()
    }
}

struct DeckLaneInfo: Decodable, Identifiable {
    let num: String
    let name: String
    let title: String
    let state: DeckLaneState
    let threadId: String?
    let sessionAlias: String?
    let project: String?
    let cwd: String?
    let branch: String?
    let updatedAt: Double?
    /// "codex" for a task started in Codex Desktop, "deck" for a thread this
    /// deck created itself. Absent while the lane is unassigned.
    let origin: String?

    var id: String { num }

    /// A deck-created thread has no codex thread id until its first turn
    /// answers, so ownership — not the id — is what makes a lane assigned.
    var isAssigned: Bool { state != .empty && (threadId != nil || origin == "deck") }

    /// True while this lane holds a fresh deck thread that has not spoken yet.
    var isNewDeckThread: Bool { origin == "deck" && threadId == nil }
}

struct DeckSnapshot: Decodable {
    let type: String
    let rev: Int
    let lane: Int
    let lanes: [DeckLaneInfo]
    let threads: [[DeckMessage]]
    let playing: String?
    let paused: Bool
    let pos: Double
    let speedIx: Int
    let vol: Double
    let autoplay: Bool
    let listening: Bool
    let phase: String
    let confirm: String
    let trace: [DeckTraceEntry]
    let host: String
    let catalog: [DeckThreadInfo]
    let catalogError: String?
    let clients: Int

    var activeLane: DeckLaneInfo? {
        lanes.indices.contains(lane) ? lanes[lane] : nil
    }

    var activeMessages: [DeckMessage] {
        threads.indices.contains(lane) ? threads[lane] : []
    }

    func lastAgentMessage(in laneIndex: Int) -> DeckMessage? {
        guard threads.indices.contains(laneIndex) else { return nil }
        return threads[laneIndex].last(where: { $0.role == "agent" })
    }

    func message(id: String) -> DeckMessage? {
        let parts = id.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2,
              threads.indices.contains(parts[0]),
              threads[parts[0]].indices.contains(parts[1]) else { return nil }
        return threads[parts[0]][parts[1]]
    }
}

/// The narration speed detents, mirroring `SPEEDS` in the Mac runtime.
///
/// `all` is the *cycle* order the runtime advances through on `playback.speed`;
/// `ordered` is the same set sorted by value, which is the only honest way to
/// draw it as a row of detents -- a scale that reads left to right must not put
/// 0.75x to the right of 1.5x just because that is where the cycle wraps.
enum DeckPlaybackSpeeds {
    static let all: [Double] = [1.0, 1.25, 1.5, 0.75]
    static let ordered: [Double] = all.sorted()

    static func value(at index: Int) -> Double {
        all.indices.contains(index) ? all[index] : 1
    }

    static func label(at index: Int) -> String {
        String(format: "%.2f×", value(at: index))
    }

    /// Position of the current detent on the ordered scale.
    static func detent(at index: Int) -> Int {
        ordered.firstIndex(of: value(at: index)) ?? 0
    }
}

struct DeckAck: Decodable {
    let type: String
    let id: Int?
    let ok: Bool
    let rev: Int
    let error: String?
}

extension URL {
    var deckCapabilityToken: String? {
        guard let fragment,
              let components = URLComponents(string: "https://local.invalid/?\(fragment)") else { return nil }
        return components.queryItems?.first(where: { $0.name == "k" })?.value
    }

    func deckEndpoint(path: String, webSocket: Bool = false) -> URL? {
        guard var components = URLComponents(url: self, resolvingAgainstBaseURL: false) else { return nil }
        if webSocket {
            components.scheme = components.scheme == "https" ? "wss" : "ws"
        }
        components.path = path.hasPrefix("/") ? path : "/\(path)"
        components.query = nil
        components.fragment = nil
        if let token = deckCapabilityToken, !token.isEmpty {
            components.queryItems = [URLQueryItem(name: "k", value: token)]
        }
        return components.url
    }
}
