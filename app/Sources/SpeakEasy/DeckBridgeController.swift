import Foundation
import AppKit

/// Live view of the deck's bridge for the Deck settings tab.
///
/// The app never embeds the deck — it observes and steers it. Status comes
/// from the runtime's own discovery file (`~/.config/speakeasy/deck-listener.json`,
/// written by `speakeasy deck`) and the data plane's `/api/snapshot`. Start and
/// stop manage the CLI process the discovery file points at.
final class DeckBridgeController: ObservableObject {

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
        let sessionAlias: String?
    }

    struct TraceEntry: Codable {
        let at: String
        let kind: String
        let detail: String
    }

    struct Snapshot: Codable {
        let host: String
        let clients: Int
        let phase: String
        let confirm: String
        let lanes: [Lane]
        let trace: [TraceEntry]
    }

    @Published private(set) var discovery: Discovery?
    @Published private(set) var snapshot: Snapshot?
    @Published private(set) var pidAlive = false
    @Published private(set) var unreachable = false
    @Published private(set) var actionInFlight = false
    @Published private(set) var actionError: String?

    /// True when the discovery pid is alive — the snapshot may still be loading.
    var running: Bool { pidAlive }

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

    // MARK: - Start / stop (serialized)

    private var resolvedCLI: String?

    /// Resolve the speakeasy CLI once and cache it. GUI apps get a minimal
    /// PATH, so resolution goes through a login shell (fnm/nvm/homebrew all
    /// live there) — `command -v` prints just the path, and we take the first
    /// line that is actually executable in case the user's rc files chatter
    /// on stdout. SPEAKEASY_CLI overrides for development.
    private func resolveCLI() -> String? {
        if let resolvedCLI { return resolvedCLI }
        if let override = ProcessInfo.processInfo.environment["SPEAKEASY_CLI"],
           fm.isExecutableFile(atPath: override) {
            resolvedCLI = override
            return override
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
                    self.actionError = "Couldn't find the speakeasy CLI on your PATH (looked through a login shell). Install it with npm, or set SPEAKEASY_CLI."
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
                environment["PATH"] = "\(cliDir):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
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
