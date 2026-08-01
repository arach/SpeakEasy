import Foundation

enum SpeechProviderID: String, CaseIterable, Codable, Identifiable, Sendable {
    case openai
    case elevenlabs
    case groq
    case gemini
    case system

    var id: String { rawValue }
}

struct SpeechProviderDescriptor: Identifiable, Equatable, Sendable {
    let id: SpeechProviderID
    let name: String
    let summary: String
    let icon: String
    let apiKeyURL: URL?
    let apiKeyPlaceholder: String?

    var requiresAPIKey: Bool { apiKeyURL != nil }
}

enum SpeechProviderCatalog {
    static let all: [SpeechProviderDescriptor] = [
        SpeechProviderDescriptor(
            id: .openai,
            name: "OpenAI",
            summary: "Steerable speech",
            icon: "brain.head.profile",
            apiKeyURL: URL(string: "https://platform.openai.com/api-keys"),
            apiKeyPlaceholder: "sk-…"
        ),
        SpeechProviderDescriptor(
            id: .elevenlabs,
            name: "ElevenLabs",
            summary: "Natural and custom voices",
            icon: "waveform",
            apiKeyURL: URL(string: "https://elevenlabs.io/app/settings/api-keys"),
            apiKeyPlaceholder: "ElevenLabs API key"
        ),
        SpeechProviderDescriptor(
            id: .groq,
            name: "Groq",
            summary: "Low-latency speech",
            icon: "bolt.fill",
            apiKeyURL: URL(string: "https://console.groq.com/keys"),
            apiKeyPlaceholder: "gsk_…"
        ),
        SpeechProviderDescriptor(
            id: .gemini,
            name: "Gemini",
            summary: "Google speech voices",
            icon: "sparkles",
            apiKeyURL: URL(string: "https://aistudio.google.com/app/apikey"),
            apiKeyPlaceholder: "Gemini API key"
        ),
        SpeechProviderDescriptor(
            id: .system,
            name: "macOS System",
            summary: "On-device voices",
            icon: "desktopcomputer",
            apiKeyURL: nil,
            apiKeyPlaceholder: nil
        ),
    ]

    static func descriptor(for id: SpeechProviderID) -> SpeechProviderDescriptor {
        all.first { $0.id == id }!
    }
}
