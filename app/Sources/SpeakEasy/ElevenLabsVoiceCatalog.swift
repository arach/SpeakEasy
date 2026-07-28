import Foundation

struct ElevenLabsVoice: Identifiable, Codable, Hashable, Sendable {
    let voice_id: String
    let name: String
    let category: String?
    let description: String?

    var id: String { voice_id }

    init(voice_id: String, name: String, category: String? = nil, description: String? = nil) {
        self.voice_id = voice_id
        self.name = name
        self.category = category
        self.description = description
    }

    private enum CodingKeys: String, CodingKey {
        case voice_id, name, category, description
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        voice_id = try container.decode(String.self, forKey: .voice_id)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        description = try container.decodeIfPresent(String.self, forKey: .description)
    }
}

struct ElevenLabsVoicesResponse: Codable, Sendable {
    let voices: [ElevenLabsVoice]
}

enum ElevenLabsVoiceCatalog {
    /// Current default voices observed in ElevenLabs My Voices; no Community Library add step required.
    static let curated: [ElevenLabsVoice] = [
        ElevenLabsVoice(
            voice_id: "EXAVITQu4vr4xnSDxMaL",
            name: "Sarah",
            category: "entertainment",
            description: "Mature, reassuring, and confident"
        ),
        ElevenLabsVoice(
            voice_id: "CwhRBWXzGAHq8TQ4Fs17",
            name: "Roger",
            category: "conversational",
            description: "Laid-back, casual, and resonant"
        ),
        ElevenLabsVoice(
            voice_id: "FGY2WhTYpPnrIDTdsKH5",
            name: "Laura",
            category: "conversational",
            description: "Bright, enthusiastic, and quirky"
        ),
        ElevenLabsVoice(
            voice_id: "SAz9YHcvj6GT2YYXdXww",
            name: "River",
            category: "educational",
            description: "Relaxed, neutral, and informative"
        ),
        ElevenLabsVoice(
            voice_id: "Xb7hH8MSUJpSbSDYk0k2",
            name: "Alice",
            category: "educational",
            description: "Clear and engaging"
        ),
        ElevenLabsVoice(
            voice_id: "cjVigY5qzO86Huf0OWal",
            name: "Eric",
            category: "conversational",
            description: "Smooth and trustworthy"
        ),
    ]

    /// Earlier arrays win so a user-supplied label is never replaced by a generic one.
    static func merged(_ groups: [ElevenLabsVoice]...) -> [ElevenLabsVoice] {
        var seen = Set<String>()
        return groups.flatMap { $0 }.filter { seen.insert($0.voice_id).inserted }
    }
}
