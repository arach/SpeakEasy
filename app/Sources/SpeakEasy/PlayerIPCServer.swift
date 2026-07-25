import Darwin
import Foundation

final class PlayerIPCServer {
    static let shared = PlayerIPCServer()

    private let acceptQueue = DispatchQueue(label: "com.speakeasy.player.ipc", qos: .userInitiated)
    private let clientQueue = DispatchQueue(label: "com.speakeasy.player.ipc.clients", qos: .userInitiated, attributes: .concurrent)
    private var serverFileDescriptor: Int32 = -1
    private var isRunning = false
    private let stateLock = NSLock()

    private init() {}

    func start() throws {
        stateLock.lock()
        defer { stateLock.unlock() }
        guard !isRunning else { return }

        try removeStaleSocketIfOwned()

        let descriptor = socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else {
            throw PlayerIPCError.systemCall("socket", errno)
        }

        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        let pathBytes = Array(playerSocketPath.utf8)
        guard pathBytes.count < MemoryLayout.size(ofValue: address.sun_path) else {
            Darwin.close(descriptor)
            throw PlayerIPCError.socketPathTooLong
        }
        withUnsafeMutableBytes(of: &address.sun_path) { destination in
            destination.initializeMemory(as: UInt8.self, repeating: 0)
            destination.copyBytes(from: pathBytes)
        }

        let bindResult = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard bindResult == 0 else {
            let code = errno
            Darwin.close(descriptor)
            throw PlayerIPCError.systemCall("bind", code)
        }

        guard chmod(playerSocketPath, S_IRUSR | S_IWUSR) == 0 else {
            let code = errno
            Darwin.close(descriptor)
            unlink(playerSocketPath)
            throw PlayerIPCError.systemCall("chmod", code)
        }

        guard listen(descriptor, 16) == 0 else {
            let code = errno
            Darwin.close(descriptor)
            unlink(playerSocketPath)
            throw PlayerIPCError.systemCall("listen", code)
        }

        serverFileDescriptor = descriptor
        isRunning = true
        acceptQueue.async { [weak self] in
            self?.acceptLoop()
        }
    }

    func stop() {
        stateLock.lock()
        guard isRunning else {
            stateLock.unlock()
            return
        }
        let descriptor = serverFileDescriptor
        serverFileDescriptor = -1
        isRunning = false
        stateLock.unlock()

        if descriptor >= 0 {
            shutdown(descriptor, SHUT_RDWR)
            Darwin.close(descriptor)
        }
        unlink(playerSocketPath)
    }

    private func acceptLoop() {
        while runningDescriptor() >= 0 {
            let client = accept(runningDescriptor(), nil, nil)
            if client < 0 {
                if errno == EINTR { continue }
                if runningDescriptor() < 0 { return }
                continue
            }
            var noSigPipe: Int32 = 1
            _ = setsockopt(
                client,
                SOL_SOCKET,
                SO_NOSIGPIPE,
                &noSigPipe,
                socklen_t(MemoryLayout<Int32>.size)
            )
            clientQueue.async { [weak self] in
                self?.handleClient(client)
            }
        }
    }

    private func handleClient(_ descriptor: Int32) {
        guard let requestData = readRequest(from: descriptor) else {
            Darwin.close(descriptor)
            return
        }

        let request: PlayerCommandRequest
        do {
            request = try JSONDecoder().decode(PlayerCommandRequest.self, from: requestData)
        } catch {
            NSLog("SpeakEasy: rejected player IPC request: %@", error.localizedDescription)
            Darwin.close(descriptor)
            return
        }

        DispatchQueue.main.async {
            let response = PlaybackEngine.shared.handle(request)
            self.write(response, to: descriptor)
            Darwin.close(descriptor)
        }
    }

    private func readRequest(from descriptor: Int32) -> Data? {
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4_096)

        while data.count <= 64 * 1_024 {
            let count = recv(descriptor, &buffer, buffer.count, 0)
            guard count > 0 else { return nil }
            data.append(buffer, count: count)
            if data.contains(0x0A) {
                return data.prefix { $0 != 0x0A }
            }
        }
        return nil
    }

    private func write(_ response: PlayerCommandResponse, to descriptor: Int32) {
        guard var data = try? JSONEncoder().encode(response) else { return }
        data.append(0x0A)

        data.withUnsafeBytes { bytes in
            guard let baseAddress = bytes.baseAddress else { return }
            var sent = 0
            while sent < bytes.count {
                let count = Darwin.write(descriptor, baseAddress.advanced(by: sent), bytes.count - sent)
                if count <= 0 { return }
                sent += count
            }
        }
    }

    private func runningDescriptor() -> Int32 {
        stateLock.lock()
        defer { stateLock.unlock() }
        return isRunning ? serverFileDescriptor : -1
    }

    private func removeStaleSocketIfOwned() throws {
        var info = stat()
        guard lstat(playerSocketPath, &info) == 0 else {
            if errno == ENOENT { return }
            throw PlayerIPCError.systemCall("lstat", errno)
        }
        guard info.st_uid == getuid(), info.st_mode & S_IFMT == S_IFSOCK else {
            throw PlayerIPCError.refusingToReplaceSocket
        }
        guard !existingSocketIsActive() else {
            throw PlayerIPCError.alreadyRunning
        }
        guard unlink(playerSocketPath) == 0 else {
            throw PlayerIPCError.systemCall("unlink", errno)
        }
    }

    private func existingSocketIsActive() -> Bool {
        let descriptor = socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return true }
        defer { Darwin.close(descriptor) }

        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        let pathBytes = Array(playerSocketPath.utf8)
        guard pathBytes.count < MemoryLayout.size(ofValue: address.sun_path) else { return true }
        withUnsafeMutableBytes(of: &address.sun_path) { destination in
            destination.initializeMemory(as: UInt8.self, repeating: 0)
            destination.copyBytes(from: pathBytes)
        }

        let result = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(descriptor, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        return result == 0
    }
}

enum PlayerIPCError: LocalizedError {
    case socketPathTooLong
    case refusingToReplaceSocket
    case alreadyRunning
    case systemCall(String, Int32)

    var errorDescription: String? {
        switch self {
        case .socketPathTooLong:
            return "Player socket path is too long"
        case .refusingToReplaceSocket:
            return "Refusing to replace a player socket not owned by this user"
        case .alreadyRunning:
            return "Another SpeakEasy player is already running"
        case .systemCall(let name, let code):
            return "\(name) failed: \(String(cString: strerror(code)))"
        }
    }
}
