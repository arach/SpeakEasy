import Foundation

struct SpeechNarrationConfiguration: Equatable, Sendable {
    let provider: String
    let voice: String
    let model: String?
    let apiKey: String
    let instructions: String?
    let rate: Int

    func applying(lane: VoiceLane?) -> SpeechNarrationConfiguration {
        guard let lane else { return self }
        let effectiveVoice = lane.voiceOverride?.provider == provider
            ? lane.voiceOverride?.voiceID ?? voice
            : voice
        let laneCue = VoiceLane.normalizedNarrationCue(lane.narrationCue)
        let effectiveInstructions = [instructions?.nilIfEmpty, laneCue]
            .compactMap { $0 }
            .joined(separator: "\n\n")
            .nilIfEmpty
        return SpeechNarrationConfiguration(
            provider: provider,
            voice: effectiveVoice,
            model: model,
            apiKey: apiKey,
            instructions: effectiveInstructions,
            rate: rate
        )
    }

    static func configured(from config: ConfigManager, provider: String? = nil) -> Self {
        switch (provider ?? config.defaultProvider).lowercased() {
        case "openai":
            return Self(
                provider: "openai", voice: config.openaiVoice, model: config.openaiModel,
                apiKey: config.openaiApiKey, instructions: config.openaiInstructions, rate: config.defaultRate
            )
        case "elevenlabs":
            return Self(
                provider: "elevenlabs", voice: config.elevenlabsVoiceId, model: config.elevenlabsModelId,
                apiKey: config.elevenlabsApiKey, instructions: nil, rate: config.defaultRate
            )
        case "groq":
            return Self(
                provider: "groq", voice: config.groqVoice, model: config.groqModel,
                apiKey: config.groqApiKey, instructions: nil, rate: config.defaultRate
            )
        case "gemini":
            return Self(
                provider: "gemini", voice: config.geminiVoice, model: config.geminiModel,
                apiKey: config.geminiApiKey, instructions: nil, rate: config.defaultRate
            )
        case "system":
            return Self(
                provider: "system", voice: config.systemVoice, model: nil,
                apiKey: "", instructions: nil, rate: config.defaultRate
            )
        default:
            return Self(
                provider: config.defaultProvider, voice: "", model: nil,
                apiKey: "", instructions: nil, rate: config.defaultRate
            )
        }
    }
}

enum ConfiguredResponseNarratorError: LocalizedError {
    case missingAPIKey(String)
    case unsupportedProvider(String)
    case invalidResponse(String)
    case generationFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey(let provider):
            return "\(provider.capitalized) narration needs an API key in SpeakEasy settings."
        case .unsupportedProvider(let provider):
            return "SpeakEasy listening cannot yet narrate with \(provider)."
        case .invalidResponse(let provider):
            return "\(provider.capitalized) returned unreadable audio."
        case .generationFailed(let detail):
            return detail
        }
    }
}

/// Renders with the provider explicitly configured in SpeakEasy. Provider
/// failures are surfaced to the user and never silently downgraded to `say`.
actor ConfiguredResponseNarrator {
    func render(text: String, configuration: SpeechNarrationConfiguration) async throws -> URL {
        let spokenText = Self.flatten(text)
        switch configuration.provider {
        case "system":
            return try renderSystem(text: spokenText, configuration: configuration)
        case "openai":
            return try await renderOpenAI(text: spokenText, configuration: configuration)
        case "elevenlabs":
            return try await renderElevenLabs(text: spokenText, configuration: configuration)
        case "groq":
            return try await renderGroq(text: spokenText, configuration: configuration)
        case "gemini":
            return try await renderGemini(text: spokenText, configuration: configuration)
        default:
            throw ConfiguredResponseNarratorError.unsupportedProvider(configuration.provider)
        }
    }

    private func renderSystem(
        text: String,
        configuration: SpeechNarrationConfiguration
    ) throws -> URL {
        let url = temporaryURL(extension: "aiff")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
        process.arguments = [
            "-v", configuration.voice,
            "-r", String(max(80, min(configuration.rate, 300))),
            "-o", url.path,
            text,
        ]
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            try? FileManager.default.removeItem(at: url)
            throw ConfiguredResponseNarratorError.generationFailed(
                "macOS speech generation failed with status \(process.terminationStatus)."
            )
        }
        return try secure(url)
    }

    private func renderOpenAI(
        text: String,
        configuration: SpeechNarrationConfiguration
    ) async throws -> URL {
        try requireAPIKey(configuration)
        var body: [String: Any] = [
            "model": configuration.model?.nilIfEmpty ?? "tts-1",
            "voice": configuration.voice,
            "input": text,
            "speed": max(0.25, min(Double(configuration.rate) / 200, 4)),
        ]
        if let instructions = configuration.instructions?.nilIfEmpty {
            body["instructions"] = instructions
        }
        let request = try jsonRequest(
            url: URL(string: "https://api.openai.com/v1/audio/speech")!,
            headers: ["Authorization": "Bearer \(configuration.apiKey)"],
            body: body
        )
        return try await downloadAudio(request, provider: "openai", extension: "mp3")
    }

    private func renderElevenLabs(
        text: String,
        configuration: SpeechNarrationConfiguration
    ) async throws -> URL {
        try requireAPIKey(configuration)
        guard let encodedVoice = configuration.voice.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) else { throw ConfiguredResponseNarratorError.invalidResponse("elevenlabs") }
        let request = try jsonRequest(
            url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(encodedVoice)")!,
            headers: [
                "Accept": "audio/mpeg",
                "xi-api-key": configuration.apiKey,
            ],
            body: [
                "text": text,
                "model_id": configuration.model?.nilIfEmpty ?? "eleven_multilingual_v2",
                "voice_settings": ["stability": 0.5, "similarity_boost": 0.5],
            ]
        )
        return try await downloadAudio(request, provider: "elevenlabs", extension: "mp3")
    }

    private func renderGroq(
        text: String,
        configuration: SpeechNarrationConfiguration
    ) async throws -> URL {
        try requireAPIKey(configuration)
        let request = try jsonRequest(
            url: URL(string: "https://api.groq.com/openai/v1/audio/speech")!,
            headers: ["Authorization": "Bearer \(configuration.apiKey)"],
            body: [
                "model": configuration.model?.nilIfEmpty ?? "canopylabs/orpheus-v1-english",
                "voice": configuration.voice,
                "input": text,
                "response_format": "mp3",
            ]
        )
        return try await downloadAudio(request, provider: "groq", extension: "mp3")
    }

    private func renderGemini(
        text: String,
        configuration: SpeechNarrationConfiguration
    ) async throws -> URL {
        try requireAPIKey(configuration)
        let model = configuration.model?.nilIfEmpty ?? "gemini-2.5-flash-preview-tts"
        guard let encodedModel = model.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let encodedKey = configuration.apiKey.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(encodedModel):generateContent?key=\(encodedKey)")
        else { throw ConfiguredResponseNarratorError.invalidResponse("gemini") }
        let request = try jsonRequest(
            url: url,
            headers: [:],
            body: [
                "contents": [["parts": [["text": text]]]],
                "generationConfig": [
                    "responseModalities": ["AUDIO"],
                    "speechConfig": [
                        "voiceConfig": ["prebuiltVoiceConfig": ["voiceName": configuration.voice]],
                    ],
                ],
            ]
        )
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: data, provider: "gemini")
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let candidates = object["candidates"] as? [[String: Any]],
              let content = candidates.first?["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]],
              let inlineData = parts.first?["inlineData"] as? [String: Any],
              let mimeType = inlineData["mimeType"] as? String,
              let encodedAudio = inlineData["data"] as? String,
              let audio = Data(base64Encoded: encodedAudio)
        else { throw ConfiguredResponseNarratorError.invalidResponse("gemini") }
        let outputURL = temporaryURL(extension: "wav")
        let output = mimeType.localizedCaseInsensitiveContains("wav")
            ? audio
            : try Self.pcmWAV(audio: audio, mimeType: mimeType)
        try output.write(to: outputURL, options: .atomic)
        return try secure(outputURL)
    }

    private func downloadAudio(
        _ request: URLRequest,
        provider: String,
        extension fileExtension: String
    ) async throws -> URL {
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: data, provider: provider)
        guard !data.isEmpty else { throw ConfiguredResponseNarratorError.invalidResponse(provider) }
        let url = temporaryURL(extension: fileExtension)
        try data.write(to: url, options: .atomic)
        return try secure(url)
    }

    private func jsonRequest(
        url: URL,
        headers: [String: String],
        body: [String: Any]
    ) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    private func validate(_ response: URLResponse, data: Data, provider: String) throws {
        guard let response = response as? HTTPURLResponse else {
            throw ConfiguredResponseNarratorError.invalidResponse(provider)
        }
        guard (200..<300).contains(response.statusCode) else {
            let detail = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { ($0["error"] as? [String: Any])?["message"] as? String }
            throw ConfiguredResponseNarratorError.generationFailed(
                detail?.nilIfEmpty ?? "\(provider.capitalized) narration failed with status \(response.statusCode)."
            )
        }
    }

    private func requireAPIKey(_ configuration: SpeechNarrationConfiguration) throws {
        guard !configuration.apiKey.isEmpty else {
            throw ConfiguredResponseNarratorError.missingAPIKey(configuration.provider)
        }
    }

    private func temporaryURL(extension fileExtension: String) -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-response-\(UUID().uuidString)")
            .appendingPathExtension(fileExtension)
    }

    private func secure(_ url: URL) throws -> URL {
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        return url
    }

    static func flatten(_ text: String) -> String {
        text
            .replacingOccurrences(of: "```", with: "")
            .replacingOccurrences(of: "`", with: "")
            .replacingOccurrences(of: "**", with: "")
            .replacingOccurrences(of: "__", with: "")
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "\n- ", with: ". ")
            .replacingOccurrences(of: "\n", with: " ")
            .split(whereSeparator: \Character.isWhitespace)
            .joined(separator: " ")
    }

    /// Gemini currently returns headerless mono PCM (`audio/L16`) for its
    /// speech modality. AVFoundation needs a WAV container to play it.
    static func pcmWAV(audio: Data, mimeType: String) throws -> Data {
        guard mimeType.localizedCaseInsensitiveContains("audio/l16"), !audio.isEmpty else {
            throw ConfiguredResponseNarratorError.invalidResponse("gemini")
        }
        let parameters = Dictionary(uniqueKeysWithValues: mimeType
            .split(separator: ";")
            .dropFirst()
            .compactMap { component -> (String, String)? in
                let pair = component.split(separator: "=", maxSplits: 1).map(String.init)
                guard pair.count == 2 else { return nil }
                return (pair[0].trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), pair[1])
            })
        let sampleRate = UInt32(parameters["rate"] ?? "24000") ?? 24_000
        let bitsPerSample = UInt16(parameters["bits"] ?? "16") ?? 16
        let channelCount: UInt16 = 1
        let byteRate = sampleRate * UInt32(channelCount) * UInt32(bitsPerSample) / 8
        let blockAlign = channelCount * bitsPerSample / 8

        var wav = Data("RIFF".utf8)
        wav.appendLittleEndian(UInt32(36 + audio.count))
        wav.append(Data("WAVEfmt ".utf8))
        wav.appendLittleEndian(UInt32(16))
        wav.appendLittleEndian(UInt16(1))
        wav.appendLittleEndian(channelCount)
        wav.appendLittleEndian(sampleRate)
        wav.appendLittleEndian(byteRate)
        wav.appendLittleEndian(blockAlign)
        wav.appendLittleEndian(bitsPerSample)
        wav.append(Data("data".utf8))
        wav.appendLittleEndian(UInt32(audio.count))
        wav.append(audio)
        return wav
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

private extension Data {
    mutating func appendLittleEndian(_ value: UInt16) {
        append(UInt8(value & 0xff))
        append(UInt8((value >> 8) & 0xff))
    }

    mutating func appendLittleEndian(_ value: UInt32) {
        append(UInt8(value & 0xff))
        append(UInt8((value >> 8) & 0xff))
        append(UInt8((value >> 16) & 0xff))
        append(UInt8((value >> 24) & 0xff))
    }
}
