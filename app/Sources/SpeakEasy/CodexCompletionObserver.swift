import Foundation

struct CodexCompletionProvenance: Codable, Equatable, Sendable {
    let owner: String
    let hostID: String
    let protocolVersion: Int
    let rolloutPath: String
    let rolloutIdentity: String
}

struct CodexCompletionEvent: Codable, Equatable, Sendable {
    let taskID: String
    let turnID: String
    let response: String
    let completedAt: Date
    let cursorOffset: Int64
    let provenance: CodexCompletionProvenance
}

enum CodexCompletionBridgeMessage: Equatable, Sendable {
    case baseline(taskID: String, cursorOffset: Int64, rolloutIdentity: String)
    case cursor(taskID: String, turnID: String, cursorOffset: Int64)
    case completion(CodexCompletionEvent)
}

enum CodexCompletionBridgeError: LocalizedError, Equatable {
    case malformedResponse
    case bridgeFailed(String)
    case taskMismatch
    case invalidCursor
    case invalidProvenance
    case emptyResponse
    case observerAlreadyRunning
    case runtimeUnavailable
    case bridgeUnavailable

    var errorDescription: String? {
        switch self {
        case .malformedResponse:
            return "Codex Desktop returned an unreadable completion event."
        case .bridgeFailed(let message):
            return message
        case .taskMismatch:
            return "Codex Desktop returned a completion for a different task."
        case .invalidCursor:
            return "Codex Desktop returned an invalid completion cursor."
        case .invalidProvenance:
            return "SpeakEasy could not prove that the completion came from Codex Desktop."
        case .emptyResponse:
            return "Codex completed without a final assistant response."
        case .observerAlreadyRunning:
            return "SpeakEasy is already watching this completion subscription."
        case .runtimeUnavailable:
            return "SpeakEasy needs Bun or Node.js to watch Codex Desktop completions."
        case .bridgeUnavailable:
            return "The SpeakEasy Codex Desktop bridge is missing. Reinstall the app."
        }
    }
}

/// The parser is intentionally independent from Process and Desktop IPC so a
/// malformed, cross-task, or non-Desktop event can be tested without starting
/// Codex. It accepts only the structured bridge contract.
enum CodexCompletionBridgeLineParser {
    private struct Envelope: Decodable {
        let ok: Bool?
        let type: String?
        let taskID: String?
        let turnID: String?
        let response: String?
        let completedAt: String?
        let cursor: Int64?
        let rolloutIdentity: String?
        let error: String?
        let provenance: CodexCompletionProvenance?
    }

    private static func parseTimestamp(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    static func parse(_ line: String, expectedTaskID: String) throws -> CodexCompletionBridgeMessage {
        guard let data = line.data(using: .utf8),
              let envelope = try? JSONDecoder().decode(Envelope.self, from: data)
        else { throw CodexCompletionBridgeError.malformedResponse }

        if envelope.ok == false {
            throw CodexCompletionBridgeError.bridgeFailed(envelope.error ?? "Codex Desktop completion bridge failed.")
        }
        guard let type = envelope.type else { throw CodexCompletionBridgeError.malformedResponse }
        guard envelope.taskID == expectedTaskID else { throw CodexCompletionBridgeError.taskMismatch }
        guard let cursor = envelope.cursor, cursor >= 0 else {
            throw CodexCompletionBridgeError.invalidCursor
        }

        switch type {
        case "baseline":
            guard let rolloutIdentity = envelope.rolloutIdentity, !rolloutIdentity.isEmpty else {
                throw CodexCompletionBridgeError.invalidProvenance
            }
            return .baseline(taskID: expectedTaskID, cursorOffset: cursor, rolloutIdentity: rolloutIdentity)
        case "cursor":
            guard let turnID = envelope.turnID, !turnID.isEmpty else {
                throw CodexCompletionBridgeError.malformedResponse
            }
            return .cursor(taskID: expectedTaskID, turnID: turnID, cursorOffset: cursor)
        case "completion":
            guard let turnID = envelope.turnID, !turnID.isEmpty,
                  let response = envelope.response?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !response.isEmpty,
                  let completedAtValue = envelope.completedAt,
                  let completedAt = parseTimestamp(completedAtValue),
                  let provenance = envelope.provenance,
                  provenance.owner == "codex-desktop",
                  provenance.hostID == "local",
                  provenance.protocolVersion == 11,
                  provenance.rolloutPath.isEmpty == false,
                  provenance.rolloutIdentity.isEmpty == false
            else {
                if envelope.response?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
                    throw CodexCompletionBridgeError.emptyResponse
                }
                throw CodexCompletionBridgeError.invalidProvenance
            }
            return .completion(CodexCompletionEvent(
                taskID: expectedTaskID,
                turnID: turnID,
                response: response,
                completedAt: completedAt,
                cursorOffset: cursor,
                provenance: provenance
            ))
        default:
            throw CodexCompletionBridgeError.malformedResponse
        }
    }
}

enum CodexCompletionObserverState: String, Sendable {
    case subscribed
    case watching
    case unavailable
    case failed
}

/// Owns a separate long-lived bridge process. It deliberately does not share
/// CodexThreadRouter.activeProcess: a background follower and an interactive
/// voice submission may coexist without cancelling one another.
@MainActor
final class CodexCompletionObserver {
    private var process: Process?
    private var outputPipe: Pipe?
    private var standardErrorPipe: Pipe?
    private var outputBuffer = Data()
    private var stopping = false
    private var taskID: String?
    private var onState: ((CodexCompletionObserverState, String?) -> Void)?
    private var onMessage: ((CodexCompletionBridgeMessage) -> Void)?

    var isRunning: Bool { process != nil }

    func start(
        taskID: String,
        cursorOffset: Int64?,
        rolloutIdentity: String?,
        onState: @escaping (CodexCompletionObserverState, String?) -> Void,
        onMessage: @escaping (CodexCompletionBridgeMessage) -> Void
    ) throws {
        guard process == nil else { throw CodexCompletionBridgeError.observerAlreadyRunning }
        guard let runtime = CodexThreadRouter.resolveJavaScriptRuntime() else {
            throw CodexCompletionBridgeError.runtimeUnavailable
        }
        guard let bridge = CodexThreadRouter.resolveBridgeScript() else {
            throw CodexCompletionBridgeError.bridgeUnavailable
        }

        let process = Process()
        let output = Pipe()
        let standardError = Pipe()
        process.executableURL = runtime
        process.arguments = [bridge.path, "observe", taskID]
            + (cursorOffset.map { [String($0)] } ?? [])
            + (rolloutIdentity.map { [$0] } ?? [])
        process.standardOutput = output
        process.standardError = standardError
        self.process = process
        self.outputPipe = output
        self.standardErrorPipe = standardError
        self.outputBuffer = Data()
        self.stopping = false
        self.taskID = taskID
        self.onState = onState
        self.onMessage = onMessage

        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            Task { @MainActor [weak self] in
                self?.consume(data)
            }
        }
        process.terminationHandler = { [weak self] process in
            Task { @MainActor [weak self] in
                self?.terminated(status: process.terminationStatus)
            }
        }

        do {
            try process.run()
            onState(.watching, nil)
        } catch {
            stop()
            throw CodexCompletionBridgeError.bridgeFailed(error.localizedDescription)
        }
    }

    func stop() {
        stopping = true
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        process?.terminationHandler = nil
        process?.terminate()
        process = nil
        outputPipe = nil
        standardErrorPipe = nil
        outputBuffer.removeAll(keepingCapacity: false)
        taskID = nil
    }

    private func consume(_ data: Data) {
        guard process != nil, let taskID else { return }
        outputBuffer.append(data)
        while let newline = outputBuffer.firstIndex(of: 0x0A) {
            let lineData = outputBuffer.prefix(upTo: newline)
            outputBuffer.removeSubrange(...newline)
            guard let line = String(data: lineData, encoding: .utf8), !line.isEmpty else {
                fail(CodexCompletionBridgeError.malformedResponse.localizedDescription)
                return
            }
            do {
                let message = try CodexCompletionBridgeLineParser.parse(line, expectedTaskID: taskID)
                onMessage?(message)
            } catch {
                fail(error.localizedDescription)
                return
            }
        }
    }

    private func terminated(status: Int32) {
        guard process != nil else { return }
        let wasStopping = stopping
        process = nil
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        outputPipe = nil
        standardErrorPipe = nil
        if !wasStopping {
            onState?(status == 0 ? .unavailable : .failed, "Codex Desktop completion observer exited (\(status)).")
        }
    }

    private func fail(_ message: String) {
        onState?(.failed, message)
        stop()
    }
}
