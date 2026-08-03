import Foundation

enum CompletionPresentationSource: String, Codable, Equatable, Sendable {
    case luna
    case deterministic
}

struct CompletionPresentationRequest: Codable, Equatable, Sendable {
    let taskID: String
    let turnID: String
    let taskTitle: String
    let projectPath: String
    let response: String
}

struct CompletionPresentationResult: Equatable, Sendable {
    let spokenText: String
    let source: CompletionPresentationSource
    let model: String?
    let fallbackReason: String?
}

protocol CompletionPresenting: Sendable {
    func present(_ request: CompletionPresentationRequest) async -> CompletionPresentationResult
}

enum CompletionSpeechProjector {
    /// The deterministic fallback reads the real response rather than a summary,
    /// so clipping it is silent loss. The bound exists only because this text is
    /// still rendered in a single provider request, and OpenAI's speech endpoint
    /// accepts 4096 characters; keep margin under that until this path chunks.
    private static let maximumCharacters = 3_500

    /// A model-independent safety net. It removes material that is actively
    /// hostile to speech, but never invents a summary of the canonical answer.
    static func project(_ response: String) -> String {
        var text = response
        text = replacing(pattern: "(?s)```.*?```", in: text, with: " ")
        text = replacing(pattern: "!\\[([^]]*)\\]\\([^)]*\\)", in: text, with: "$1")
        text = replacing(pattern: "\\[([^]]+)\\]\\([^)]*\\)", in: text, with: "$1")
        text = replacing(pattern: "(?m)^\\s{0,3}#{1,6}\\s*", in: text, with: "")
        text = replacing(pattern: "(?m)^\\s*(?:[-*+] |\\d+[.)]\\s+)", in: text, with: ". ")
        for marker in ["`", "**", "__", "~~", "> "] {
            text = text.replacingOccurrences(of: marker, with: "")
        }
        text = text
            .split(whereSeparator: \Character.isWhitespace)
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else {
            return "Codex completed the task. The full response is available in Codex."
        }
        guard text.count > maximumCharacters else { return text }

        let prefix = String(text.prefix(maximumCharacters))
        let sentenceBoundary = prefix.lastIndex(where: { ".!?".contains($0) })
        let wordBoundary = prefix.lastIndex(of: " ")
        let boundary = sentenceBoundary ?? wordBoundary ?? prefix.endIndex
        let clipped = prefix[..<boundary].trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(clipped). The full response is available in Codex."
    }

    private static func replacing(pattern: String, in text: String, with replacement: String) -> String {
        guard let expression = try? NSRegularExpression(pattern: pattern) else { return text }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return expression.stringByReplacingMatches(in: text, range: range, withTemplate: replacement)
    }
}

enum CodexLunaCompletionPresenterError: LocalizedError {
    case runtimeUnavailable
    case bridgeUnavailable
    case codexUnavailable
    case processFailed(String)
    case invalidResponse
    case provenanceMismatch

    var errorDescription: String? {
        switch self {
        case .runtimeUnavailable:
            "SpeakEasy needs Bun or Node.js for Luna presentation."
        case .bridgeUnavailable:
            "The SpeakEasy Luna presenter bridge is missing. Reinstall the app."
        case .codexUnavailable:
            "Codex is unavailable for Luna presentation."
        case .processFailed(let detail):
            detail
        case .invalidResponse:
            "Luna returned an unreadable spoken presentation."
        case .provenanceMismatch:
            "Luna presentation did not preserve the exact source task and turn."
        }
    }
}

/// Presentation is deliberately isolated from the Desktop-owned observer. The
/// bridge starts a second app-server process and an ephemeral Luna thread, then
/// returns spoken text only. Any failure becomes deterministic projection.
actor CodexLunaCompletionPresenter: CompletionPresenting {
    static let model = "gpt-5.6-luna"

    private struct BridgeEnvelope: Decodable {
        let ok: Bool
        let spokenText: String?
        let model: String?
        let ephemeral: Bool?
        let sourceTaskID: String?
        let sourceTurnID: String?
        let error: String?
    }

    func present(_ request: CompletionPresentationRequest) async -> CompletionPresentationResult {
        do {
            let envelope = try await invoke(request)
            guard envelope.ok,
                  envelope.ephemeral == true,
                  envelope.model == Self.model,
                  envelope.sourceTaskID == request.taskID,
                  envelope.sourceTurnID == request.turnID,
                  let spokenText = envelope.spokenText?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                  !spokenText.isEmpty,
                  spokenText.count <= 900
            else { throw CodexLunaCompletionPresenterError.provenanceMismatch }
            return CompletionPresentationResult(
                spokenText: spokenText,
                source: .luna,
                model: Self.model,
                fallbackReason: nil
            )
        } catch {
            return CompletionPresentationResult(
                spokenText: CompletionSpeechProjector.project(request.response),
                source: .deterministic,
                model: nil,
                fallbackReason: error.localizedDescription
            )
        }
    }

    private func invoke(_ request: CompletionPresentationRequest) async throws -> BridgeEnvelope {
        guard let runtime = CodexThreadRouter.resolveJavaScriptRuntime() else {
            throw CodexLunaCompletionPresenterError.runtimeUnavailable
        }
        guard let bridge = Self.resolveBridgeScript() else {
            throw CodexLunaCompletionPresenterError.bridgeUnavailable
        }
        guard let codex = Self.resolveCodexExecutable() else {
            throw CodexLunaCompletionPresenterError.codexUnavailable
        }

        let standardInput = try JSONEncoder().encode(request)
        let process = Process()
        let input = Pipe()
        let output = Pipe()
        let standardError = Pipe()
        process.executableURL = runtime
        process.arguments = [bridge.path, codex.path]
        process.standardInput = input
        process.standardOutput = output
        process.standardError = standardError

        return try await withCheckedThrowingContinuation { continuation in
            process.terminationHandler = { process in
                let data = (try? output.fileHandleForReading.readToEnd()) ?? nil
                let errorData = (try? standardError.fileHandleForReading.readToEnd()) ?? nil
                guard process.terminationStatus == 0,
                      let data,
                      let envelope = try? JSONDecoder().decode(BridgeEnvelope.self, from: data)
                else {
                    let bridgeEnvelope = data.flatMap { try? JSONDecoder().decode(BridgeEnvelope.self, from: $0) }
                    let standardErrorText = errorData
                        .flatMap { String(data: $0, encoding: .utf8) }?
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    let detail = bridgeEnvelope?.error
                        ?? standardErrorText?.nilIfEmpty
                        ?? "Luna presenter exited unexpectedly."
                    continuation.resume(throwing: CodexLunaCompletionPresenterError.processFailed(detail))
                    return
                }
                continuation.resume(returning: envelope)
            }
            do {
                try process.run()
                try input.fileHandleForWriting.write(contentsOf: standardInput)
                try input.fileHandleForWriting.close()
            } catch {
                process.terminationHandler = nil
                if process.isRunning { process.terminate() }
                continuation.resume(throwing: CodexLunaCompletionPresenterError.processFailed(error.localizedDescription))
            }
        }
    }

    private static func resolveBridgeScript() -> URL? {
        if let override = ProcessInfo.processInfo.environment["SPEAKEASY_LUNA_PRESENTER_PATH"],
           FileManager.default.isReadableFile(atPath: override) {
            return URL(fileURLWithPath: override)
        }
        return SpeakEasyResources.url(forResource: "codex-luna-presenter", withExtension: "cjs")
    }

    private static func resolveCodexExecutable() -> URL? {
        let environment = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            environment["SPEAKEASY_CODEX_BIN"],
            environment["CODEX_BIN"],
            "/Applications/ChatGPT.app/Contents/Resources/codex",
            "/Applications/Codex.app/Contents/Resources/codex",
            "\(home)/.local/bin/codex",
            "/opt/homebrew/bin/codex",
            "/usr/local/bin/codex",
        ].compactMap { $0 }
        if let path = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) {
            return URL(fileURLWithPath: path)
        }

        let shell = Process()
        let output = Pipe()
        shell.executableURL = URL(fileURLWithPath: "/bin/zsh")
        shell.arguments = ["-lic", "command -v codex"]
        shell.standardOutput = output
        shell.standardError = FileHandle.nullDevice
        guard (try? shell.run()) != nil else { return nil }
        shell.waitUntilExit()
        guard shell.terminationStatus == 0,
              let data = try? output.fileHandleForReading.readToEnd(),
              let path = String(data: data, encoding: .utf8)?
                .split(separator: "\n")
                .map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })
                .first(where: { FileManager.default.isExecutableFile(atPath: $0) })
        else { return nil }
        return URL(fileURLWithPath: path)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
