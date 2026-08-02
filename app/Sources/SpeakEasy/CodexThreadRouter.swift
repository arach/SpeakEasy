import Foundation

struct CodexTaskSummary: Identifiable, Codable, Equatable, Sendable {
    let id: String
    let title: String
    let preview: String
    let cwd: String
    let updatedAt: Date

    func matchesSearch(_ query: String) -> Bool {
        let terms = query
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .split(whereSeparator: \Character.isWhitespace)
            .map(String.init)
        guard !terms.isEmpty else { return true }

        let haystack = [title, preview, cwd, id]
            .joined(separator: "\n")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        return terms.allSatisfy(haystack.contains)
    }

    var projectName: String {
        URL(fileURLWithPath: cwd).lastPathComponent
    }
}

enum CodexTurnDelivery: String, Codable, Equatable, Sendable {
    case startedTurn = "started-turn"
    case steeredActiveTurn = "steered-active-turn"

    var label: String {
        switch self {
        case .startedTurn: "Started a new turn in the exact task"
        case .steeredActiveTurn: "Steered the active turn in the exact task"
        }
    }
}

struct CodexTurnResult: Equatable, Sendable {
    let response: String
    let delivery: CodexTurnDelivery
}

enum CodexThreadRouterError: LocalizedError {
    case runtimeUnavailable
    case bridgeUnavailable
    case malformedResponse
    case requestFailed(String)
    case turnAlreadyActive

    var errorDescription: String? {
        switch self {
        case .runtimeUnavailable:
            return "SpeakEasy needs Bun or Node.js to connect to Codex Desktop."
        case .bridgeUnavailable:
            return "The SpeakEasy Codex Desktop bridge is missing. Reinstall the app."
        case .malformedResponse:
            return "Codex Desktop returned an unreadable bridge response."
        case .requestFailed(let message):
            return message
        case .turnAlreadyActive:
            return "SpeakEasy is already waiting for this task."
        }
    }
}

/// A fail-closed conduit into the task owned by Codex Desktop.
///
/// This process never launches `codex app-server`. The bundled runtime joins
/// Desktop's user-private follower IPC, asks the window that owns the exact
/// task to start the turn, and observes that task's own rollout for completion.
actor CodexThreadRouter {
    private struct BridgeEnvelope: Decodable {
        let ok: Bool
        let tasks: [TaskPayload]?
        let task: TaskPayload?
        let response: String?
        let delivery: String?
        let error: String?
        let code: String?
    }

    private struct TaskPayload: Decodable {
        let id: String
        let title: String
        let preview: String?
        let cwd: String
        let updatedAt: Double?
    }

    private var activeProcess: Process?

    func listRecentTasks(limit: Int = 16) async throws -> [CodexTaskSummary] {
        let envelope = try await invoke(arguments: ["list", String(max(1, min(limit, 100)))])
        guard envelope.ok, let tasks = envelope.tasks else {
            throw bridgeError(envelope)
        }
        return tasks.map(Self.summary)
    }

    func validateTask(_ threadID: String) async throws -> CodexTaskSummary {
        let envelope = try await invoke(arguments: ["validate", threadID])
        guard envelope.ok, let task = envelope.task, task.id == threadID else {
            throw bridgeError(envelope)
        }
        return Self.summary(task)
    }

    func submit(_ text: String, to threadID: String) async throws -> CodexTurnResult {
        guard activeProcess == nil else { throw CodexThreadRouterError.turnAlreadyActive }
        let envelope = try await invoke(
            arguments: ["submit", threadID],
            standardInput: text.data(using: .utf8)
        )
        guard envelope.ok,
              let response = envelope.response?.trimmingCharacters(in: .whitespacesAndNewlines),
              !response.isEmpty,
              let deliveryValue = envelope.delivery,
              let delivery = CodexTurnDelivery(rawValue: deliveryValue)
        else { throw bridgeError(envelope) }
        return CodexTurnResult(response: response, delivery: delivery)
    }

    func shutdown() {
        activeProcess?.terminate()
        activeProcess = nil
    }

    private func invoke(arguments: [String], standardInput: Data? = nil) async throws -> BridgeEnvelope {
        guard let runtime = Self.resolveJavaScriptRuntime() else {
            throw CodexThreadRouterError.runtimeUnavailable
        }
        guard let bridge = Self.resolveBridgeScript() else {
            throw CodexThreadRouterError.bridgeUnavailable
        }

        let process = Process()
        let output = Pipe()
        let error = Pipe()
        let input = Pipe()
        process.executableURL = runtime
        process.arguments = [bridge.path] + arguments
        process.standardOutput = output
        process.standardError = error
        process.standardInput = input
        activeProcess = process

        do {
            try process.run()
            if let standardInput {
                try input.fileHandleForWriting.write(contentsOf: standardInput)
            }
            try input.fileHandleForWriting.close()
        } catch {
            activeProcess = nil
            throw CodexThreadRouterError.requestFailed(error.localizedDescription)
        }

        await withCheckedContinuation { continuation in
            process.terminationHandler = { _ in continuation.resume() }
        }
        activeProcess = nil

        let outputData = try output.fileHandleForReading.readToEnd() ?? Data()
        let errorData = try error.fileHandleForReading.readToEnd() ?? Data()
        guard let envelope = try? JSONDecoder().decode(BridgeEnvelope.self, from: outputData) else {
            let detail = String(data: errorData, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            throw CodexThreadRouterError.requestFailed(
                detail?.isEmpty == false ? detail! : "Codex Desktop bridge exited unexpectedly."
            )
        }
        return envelope
    }

    private func bridgeError(_ envelope: BridgeEnvelope) -> Error {
        CodexThreadRouterError.requestFailed(
            envelope.error ?? "Codex Desktop bridge failed (\(envelope.code ?? "unknown"))."
        )
    }

    private static func summary(_ payload: TaskPayload) -> CodexTaskSummary {
        CodexTaskSummary(
            id: payload.id,
            title: payload.title.trimmingCharacters(in: .whitespacesAndNewlines),
            preview: payload.preview?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            cwd: payload.cwd,
            updatedAt: Date(timeIntervalSince1970: payload.updatedAt ?? 0)
        )
    }

    /// Shared by the interactive conduit and the independent completion
    /// observer. Keeping resolution here avoids the observer inventing a
    /// second runtime or bridge path.
    static func resolveBridgeScript() -> URL? {
        let environment = ProcessInfo.processInfo.environment
        if let override = environment["SPEAKEASY_CODEX_BRIDGE_PATH"],
           FileManager.default.isReadableFile(atPath: override) {
            return URL(fileURLWithPath: override)
        }
        return Bundle.module.url(forResource: "codex-desktop-bridge", withExtension: "cjs")
    }

    static func resolveJavaScriptRuntime() -> URL? {
        let environment = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            environment["SPEAKEASY_JS_RUNTIME"],
            "\(home)/.bun/bin/bun",
            "/opt/homebrew/bin/bun",
            "/usr/local/bin/bun",
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
        ].compactMap { $0 }
        if let path = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) {
            return URL(fileURLWithPath: path)
        }

        let shell = Process()
        let pipe = Pipe()
        shell.executableURL = URL(fileURLWithPath: "/bin/zsh")
        shell.arguments = ["-lc", "command -v bun || command -v node"]
        shell.standardOutput = pipe
        shell.standardError = FileHandle.nullDevice
        guard (try? shell.run()) != nil else { return nil }
        shell.waitUntilExit()
        guard shell.terminationStatus == 0 else { return nil }
        let data = (try? pipe.fileHandleForReading.readToEnd()) ?? nil
        guard let data,
              let value = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty,
              FileManager.default.isExecutableFile(atPath: value)
        else { return nil }
        return URL(fileURLWithPath: value)
    }
}
