import Foundation
import AppKit

/// Live view of the deck's bridge for the Deck settings tab.
///
/// The app never embeds the deck — it observes and steers it. Status comes
/// from the runtime's own discovery file (`~/.config/speakeasy/deck-listener.json`,
/// written by `speakeasy deck`) and the data plane's `/api/snapshot`. Start and
/// stop manage the CLI process the discovery file points at.
final class DeckBridgeController: ObservableObject {
    static let shared = DeckBridgeController()

    struct Discovery: Codable {
        let pid: Int
        let port: Int
        let dataPort: Int
        let host: String
        let token: String?
        /// The runtime's canonical device URL (https/vanity aware, `#k=` when paired).
        let url: String?
    }

    struct Lane: Codable {
        let num: String
        let name: String
        let title: String
        let state: String
        let threadId: String?
        let sessionAlias: String?
    }

    struct TraceEntry: Codable {
        let at: String
        let kind: String
        let detail: String
    }

    /// A resumable codex thread from the runtime's mapper catalog.
    struct CatalogThread: Codable {
        let id: String
        let cwd: String
        let snippet: String
        let preview: String?
        let project: String?
        let isPinned: Bool?
        let at: Double

        var alias: String {
            String(id.replacingOccurrences(of: "-", with: "").suffix(8))
        }
        var projectLabel: String {
            if let project, !project.isEmpty { return project }
            return URL(fileURLWithPath: cwd).lastPathComponent
        }
    }

    struct Snapshot: Codable {
        let host: String
        let clients: Int
        let phase: String
        let confirm: String
        let lanes: [Lane]
        let trace: [TraceEntry]
        let catalog: [CatalogThread]?
    }

    @Published private(set) var discovery: Discovery?
    @Published private(set) var snapshot: Snapshot?
    @Published private(set) var pidAlive = false
    @Published private(set) var unreachable = false
    @Published private(set) var actionInFlight = false
    @Published private(set) var actionError: String?

    /// True when the discovery pid is alive — the snapshot may still be loading.
    var running: Bool { pidAlive }

    /// Release builds carry the complete deck runtime inside the app bundle.
    /// Development builds can still fall back to SPEAKEASY_CLI or PATH.
    var includesRuntime: Bool { bundledCLI != nil }

    /// Called synchronously before any start/restart, so unsaved bridge
    /// edits (pairing, port) are on disk before the CLI reads them.
    var onBeforeStart: (() -> Void)?

    private let fm = FileManager.default
    private var timer: Timer?
    private var pollInFlight = false

    private var configDir: URL {
        fm.homeDirectoryForCurrentUser.appendingPathComponent(".config/speakeasy")
    }
    private var discoveryFile: URL {
        configDir.appendingPathComponent("deck-listener.json")
    }
    private var logFile: URL {
        configDir.appendingPathComponent("deck.log")
    }
    private var bundledCLI: String? {
        let path = Bundle.main.bundleURL
            .appendingPathComponent("Contents/Helpers/speakeasy-runtime")
            .path
        return fm.isExecutableFile(atPath: path) ? path : nil
    }
    private var bundledDeckRoot: String? {
        guard let path = Bundle.main.resourceURL?
            .appendingPathComponent("Deck", isDirectory: true)
            .path,
              fm.fileExists(atPath: path) else { return nil }
        return path
    }

    // MARK: - Polling

    /// The Deck tab calls this on appear; polling stops on disappear so a
    /// hidden settings window never holds a timer or a socket.
    func beginUpdates() {
        poll()
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            self?.poll()
        }
    }

    func endUpdates() {
        timer?.invalidate()
        timer = nil
    }

    /// App-launch path for the persisted "start automatically" preference.
    /// A live discovery pid wins, so relaunching the menu-bar app can never
    /// start a second bridge beside an existing one.
    func startIfNeeded() {
        if let discovery = readDiscovery(), kill(Int32(discovery.pid), 0) == 0 {
            poll()
            return
        }
        start()
    }

    private func poll() {
        guard !pollInFlight else { return }
        pollInFlight = true
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self else { return }
            let discovery = self.readDiscovery()
            let alive = discovery.map { kill(Int32($0.pid), 0) == 0 } ?? false
            var snapshot: Snapshot? = nil
            var unreachable = false
            if alive, let discovery {
                snapshot = self.fetchSnapshot(discovery)
                unreachable = snapshot == nil
            }
            DispatchQueue.main.async {
                self.discovery = discovery
                self.pidAlive = alive
                self.snapshot = snapshot
                self.unreachable = unreachable
                self.pollInFlight = false
            }
        }
    }

    private func readDiscovery() -> Discovery? {
        guard let data = try? Data(contentsOf: discoveryFile) else { return nil }
        return try? JSONDecoder().decode(Discovery.self, from: data)
    }

    /// Lock-guarded result box: a fetch that outlives its timeout is cancelled
    /// and its late completion can no longer write.
    private final class SnapshotBox {
        private let lock = NSLock()
        private(set) var value: Snapshot?
        var cancelled = false
        func store(_ snapshot: Snapshot?) {
            lock.lock()
            if !cancelled { value = snapshot }
            lock.unlock()
        }
        func cancel() {
            lock.lock()
            cancelled = true
            lock.unlock()
        }
        func read() -> Snapshot? {
            lock.lock()
            defer { lock.unlock() }
            return value
        }
    }

    private func fetchSnapshot(_ discovery: Discovery) -> Snapshot? {
        var urlString = "http://127.0.0.1:\(discovery.dataPort)/api/snapshot"
        // server-side auth is the query form; the fragment form is for pages
        if let token = discovery.token, !token.isEmpty {
            urlString += "?k=\(token)"
        }
        guard let url = URL(string: urlString) else { return nil }
        let box = SnapshotBox()
        let sem = DispatchSemaphore(value: 0)
        let task = URLSession.shared.dataTask(with: url) { data, response, _ in
            defer { sem.signal() }
            guard let data,
                  let http = response as? HTTPURLResponse,
                  http.statusCode == 200 else { return }
            box.store(try? JSONDecoder().decode(Snapshot.self, from: data))
        }
        task.resume()
        if sem.wait(timeout: .now() + 2) == .timedOut {
            box.cancel()
            task.cancel()
        }
        return box.read()
    }

    // MARK: - URL

    /// Where a person opens the deck. The runtime's canonical URL wins
    /// (https/vanity aware); older discovery files fall back to http host:port.
    var deckURL: URL? {
        guard let discovery else { return nil }
        if let url = discovery.url, let parsed = URL(string: url) { return parsed }
        let base = discovery.port == 80
            ? "http://\(discovery.host)"
            : "http://\(discovery.host):\(discovery.port)"
        return URL(string: base)
    }

    /// The iPad URL, including the pairing fragment when the bridge requires
    /// one. Copied, never displayed. Paired pages take the token as `#k=` —
    /// the query form is only for server-to-runtime calls.
    var deviceURLString: String? {
        guard let url = deckURL else { return nil }
        if discovery?.url != nil { return url.absoluteString } // canonical URL already carries #k=
        if let token = discovery?.token, !token.isEmpty {
            return "\(url.absoluteString)#k=\(token)"
        }
        return url.absoluteString
    }

    // MARK: - Lane management (HTTP intent channel)

    private struct IntentReply: Codable {
        let ok: Bool
        let error: String?
    }

    /// Refresh the mapper catalog, then repoll so the assign menus fill.
    func refreshCatalog() {
        postIntent(["name": "catalog.refresh"])
    }

    /// Bind a worker lane (0-8) to a thread, or to a fresh session when nil.
    /// The overview lane is deck-owned and never assignable.
    func assign(lane: Int, threadId: String?) {
        guard (0..<9).contains(lane) else { return }
        postIntent(["name": "lane.assign", "index": lane, "threadId": threadId ?? NSNull()])
    }

    // Management mutations go through one serial queue, and each one awaits
    // its response before the next dequeues: rapid menu picks can't arrive —
    // or clear errors — out of order. A timed-out request is cancelled and
    // recorded as a failure, never mistaken for a success.
    private let intentQueue = DispatchQueue(label: "speakeasy.deck.intents")

    /// Lock-guarded slot for the response error — the timeout path and a late
    /// completion can race, so every write goes through the lock.
    private final class IntentErrorBox {
        private let lock = NSLock()
        private var value: String?
        func store(_ error: String) {
            lock.lock()
            value = error
            lock.unlock()
        }
        func read() -> String? {
            lock.lock()
            defer { lock.unlock() }
            return value
        }
    }

    private func postIntent(_ body: [String: Any]) {
        intentQueue.async { [weak self] in
            guard let self, let discovery = self.readDiscovery() else { return }
            var urlString = "http://127.0.0.1:\(discovery.dataPort)/api/intent"
            if let token = discovery.token, !token.isEmpty {
                urlString += "?k=\(token)"
            }
            guard let url = URL(string: urlString),
                  let payload = try? JSONSerialization.data(withJSONObject: body) else { return }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 10
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = payload
            let sem = DispatchSemaphore(value: 0)
            let box = IntentErrorBox()
            let task = URLSession.shared.dataTask(with: request) { data, response, taskError in
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if status == 200, let data, let reply = try? JSONDecoder().decode(IntentReply.self, from: data) {
                    if !reply.ok { box.store(reply.error ?? "The deck rejected that.") }
                } else if taskError != nil {
                    box.store("The deck didn't answer.")
                } else {
                    // a non-200 or non-decodable response is never a success
                    box.store(status == 0 ? "The deck didn't answer." : "The deck answered with status \(status).")
                }
                sem.signal()
            }
            task.resume()
            if sem.wait(timeout: .now() + 10) == .timedOut {
                task.cancel()
                box.store("The deck didn't answer in time.")
            }
            let error = box.read()
            DispatchQueue.main.async {
                // success clears an earlier failure — stale errors are lies
                self.actionError = error
                self.poll()
            }
        }
    }

    // MARK: - Start / stop (serialized)

    private var resolvedCLI: String?
    private var resolvedCodex: String?
    private var resolvedLoginPath: String?

    private func loginShellPath() -> String? {
        if let resolvedLoginPath { return resolvedLoginPath }
        let pipe = Pipe()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lic", "print -r -- $PATH"]
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return nil }
        process.waitUntilExit()
        let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        guard let candidate = output
            .split(separator: "\n")
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .last(where: { $0.contains(":") && !$0.contains(" ") }) else { return nil }
        resolvedLoginPath = candidate
        return candidate
    }

    /// Resolve Codex through the user's login shell once. GUI apps inherit a
    /// minimal PATH, while fnm/nvm/Homebrew are usually initialized by shell
    /// startup; passing CODEX_BIN gives the bundled runtime the exact result.
    private func resolveCodexCLI() -> String? {
        if let resolvedCodex { return resolvedCodex }
        for key in ["SPEAKEASY_CODEX_BIN", "CODEX_BIN"] {
            if let candidate = ProcessInfo.processInfo.environment[key],
               fm.isExecutableFile(atPath: candidate) {
                resolvedCodex = candidate
                return candidate
            }
        }
        for candidate in [
            "/Applications/ChatGPT.app/Contents/Resources/codex",
            "/Applications/Codex.app/Contents/Resources/codex"
        ] where fm.isExecutableFile(atPath: candidate) {
            resolvedCodex = candidate
            return candidate
        }
        let pipe = Pipe()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lic", "command -v codex"]
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return nil }
        process.waitUntilExit()
        let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        guard let candidate = output
            .split(separator: "\n")
            .map({ $0.trimmingCharacters(in: .whitespaces) })
            .first(where: { fm.isExecutableFile(atPath: $0) }) else { return nil }
        resolvedCodex = candidate
        return candidate
    }

    /// Resolve the deck runtime once and cache it. A released app is
    /// self-contained; SPEAKEASY_CLI and PATH remain development fallbacks.
    private func resolveCLI() -> String? {
        if let resolvedCLI { return resolvedCLI }
        if let override = ProcessInfo.processInfo.environment["SPEAKEASY_CLI"],
           fm.isExecutableFile(atPath: override) {
            resolvedCLI = override
            return override
        }
        if let bundledCLI {
            resolvedCLI = bundledCLI
            return bundledCLI
        }
        let pipe = Pipe()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lic", "command -v speakeasy"]
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return nil }
        process.waitUntilExit()
        let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        let path = output
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { fm.isExecutableFile(atPath: $0) }
        guard let path else { return nil }
        resolvedCLI = path
        return path
    }

    func start() {
        guard !actionInFlight, !pidAlive else { return }
        actionInFlight = true
        actionError = nil
        onBeforeStart?()
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            guard let cli = self.resolveCLI() else {
                DispatchQueue.main.async {
                    self.actionError = "This development build doesn't include the deck runtime, and no speakeasy CLI was found on your PATH."
                    self.actionInFlight = false
                }
                return
            }
            guard let codex = self.resolveCodexCLI() else {
                DispatchQueue.main.async {
                    self.actionError = "Codex CLI wasn't found. Make `codex` available in your login shell, then try Start again."
                    self.actionInFlight = false
                }
                return
            }
            // Spawn the resolved binary directly — no login shell, so no job
            // control and the deck survives this app quitting (reparented to
            // launchd). The CLI's own bin dir leads PATH so a `#!/usr/bin/env
            // node` shebang (fnm/nvm shims) finds its node.
            do {
                try self.fm.createDirectory(at: self.configDir, withIntermediateDirectories: true)
                if !self.fm.fileExists(atPath: self.logFile.path) {
                    self.fm.createFile(atPath: self.logFile.path, contents: nil)
                }
                let logHandle = try FileHandle(forWritingTo: self.logFile)
                logHandle.seekToEndOfFile()
                let process = Process()
                process.executableURL = URL(fileURLWithPath: cli)
                process.arguments = ["deck"]
                var environment = ProcessInfo.processInfo.environment
                let cliDir = URL(fileURLWithPath: cli).deletingLastPathComponent().path
                let loginPath = self.loginShellPath() ?? ""
                environment["PATH"] = "\(cliDir):\(loginPath):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
                environment["CODEX_BIN"] = codex
                if cli == self.bundledCLI, let deckRoot = self.bundledDeckRoot {
                    environment["SPEAKEASY_DECK_ROOT"] = deckRoot
                }
                process.environment = environment
                process.standardOutput = logHandle
                process.standardError = logHandle
                try process.run()
                self.watchStartup(process)
            } catch {
                DispatchQueue.main.async {
                    self.actionError = "Couldn't start the deck: \(error.localizedDescription)"
                    self.actionInFlight = false
                }
            }
        }
    }

    /// Hold the action until the deck's own discovery file proves the spawned
    /// pid (or the process dies, or ~12s pass). Clearing any earlier would
    /// re-enable Start while pidAlive is still false — a second tap spawning
    /// a second deck is exactly the race this prevents. A spawn that never
    /// proves itself is terminated again — never left as an undiscoverable orphan.
    private func watchStartup(_ process: Process) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self else { return }
            var confirmed = false
            for _ in 0..<24 {
                if !process.isRunning { break }
                if let discovery = self.readDiscovery(), discovery.pid == process.processIdentifier {
                    confirmed = true
                    break
                }
                Thread.sleep(forTimeInterval: 0.5)
            }
            if !confirmed && process.isRunning {
                process.terminate()
                process.waitUntilExit()
            }
            DispatchQueue.main.async {
                if confirmed {
                    // publish the proven state BEFORE unlocking Start — clearing
                    // the flag while pidAlive is still stale re-opens the race
                    self.discovery = self.readDiscovery()
                    self.pidAlive = true
                    self.unreachable = false
                    self.actionInFlight = false
                } else {
                    self.actionInFlight = false
                    self.actionError = "The deck didn't come up — it was stopped again. Check ~/.config/speakeasy/deck.log"
                }
                self.poll()
            }
        }
    }

    /// Stop the deck from the discovery pid. Completion reports whether the
    /// pid actually exited (the restart path waits on this, never on a guess).
    private func stopInternal(completion: @escaping (Bool) -> Void) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self, let discovery = self.readDiscovery() else {
                completion(false)
                return
            }
            // The pid in a stale file can belong to anyone by now — only signal
            // a process that still looks like the deck CLI.
            let process = Process()
            let pipe = Pipe()
            process.executableURL = URL(fileURLWithPath: "/bin/ps")
            process.arguments = ["-p", String(discovery.pid), "-o", "command="]
            process.standardOutput = pipe
            process.standardError = FileHandle.nullDevice
            guard (try? process.run()) != nil else {
                completion(false)
                return
            }
            process.waitUntilExit()
            let command = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            guard command.contains("speakeasy") else {
                completion(false)
                return
            }
            kill(Int32(discovery.pid), SIGTERM)
            // wait for actual exit, up to 4s
            var exited = false
            for _ in 0..<40 {
                if kill(Int32(discovery.pid), 0) != 0 { exited = true; break }
                Thread.sleep(forTimeInterval: 0.1)
            }
            completion(exited)
        }
    }

    func stop() {
        guard !actionInFlight else { return }
        actionInFlight = true
        actionError = nil
        stopInternal { [weak self] _ in
            DispatchQueue.main.async {
                self?.actionInFlight = false
                self?.poll()
            }
        }
    }

    func restart() {
        guard !actionInFlight else { return }
        actionInFlight = true
        actionError = nil
        stopInternal { [weak self] exited in
            DispatchQueue.main.async {
                guard let self else { return }
                self.actionInFlight = false
                if exited {
                    self.start()
                } else {
                    self.actionError = "The deck didn't stop cleanly — leaving it alone."
                    self.poll()
                }
            }
        }
    }
}
