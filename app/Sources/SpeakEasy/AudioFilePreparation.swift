import Foundation

struct PreparedAudioFile {
    let url: URL
    let isTemporary: Bool

    func cleanup() {
        guard isTemporary else { return }
        try? FileManager.default.removeItem(at: url)
    }
}

enum AudioContainerFormat: String {
    case aiff
    case wav
    case mp3
    case m4a
    case caf
    case flac
    case ogg

    var preferredExtension: String { rawValue }

    var compatibleExtensions: Set<String> {
        switch self {
        case .aiff: return ["aif", "aifc", "aiff"]
        case .wav: return ["wav", "wave"]
        case .mp3: return ["mp3"]
        case .m4a: return ["aac", "m4a", "mp4"]
        case .caf: return ["caf"]
        case .flac: return ["flac"]
        case .ogg: return ["oga", "ogg"]
        }
    }

    static func detect(in data: Data) -> AudioContainerFormat? {
        let bytes = [UInt8](data.prefix(16))
        func ascii(_ range: Range<Int>) -> String? {
            guard bytes.count >= range.upperBound else { return nil }
            return String(bytes: bytes[range], encoding: .ascii)
        }

        if ascii(0..<4) == "FORM" { return .aiff }
        if ascii(0..<4) == "RIFF", ascii(8..<12) == "WAVE" { return .wav }
        if ascii(0..<4) == "caff" { return .caf }
        if ascii(0..<4) == "fLaC" { return .flac }
        if ascii(0..<4) == "OggS" { return .ogg }
        if ascii(0..<3) == "ID3" { return .mp3 }
        if bytes.count >= 2, bytes[0] == 0xff, bytes[1] & 0xe0 == 0xe0 { return .mp3 }
        if ascii(4..<8) == "ftyp" { return .m4a }
        return nil
    }
}

enum AudioFilePreparer {
    static func prepare(path: String) throws -> PreparedAudioFile {
        let sourceURL = URL(fileURLWithPath: path)
        let handle = try FileHandle(forReadingFrom: sourceURL)
        defer { try? handle.close() }

        let header = try handle.read(upToCount: 16) ?? Data()
        guard let format = AudioContainerFormat.detect(in: header) else {
            throw AudioFilePreparationError.unsupportedContainer
        }

        let suppliedExtension = sourceURL.pathExtension.lowercased()
        guard !suppliedExtension.isEmpty,
              !format.compatibleExtensions.contains(suppliedExtension) else {
            return PreparedAudioFile(url: sourceURL, isTemporary: false)
        }

        let normalizedURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-player-\(UUID().uuidString)")
            .appendingPathExtension(format.preferredExtension)

        do {
            try FileManager.default.linkItem(at: sourceURL, to: normalizedURL)
        } catch {
            try FileManager.default.copyItem(at: sourceURL, to: normalizedURL)
        }
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: normalizedURL.path
        )
        return PreparedAudioFile(url: normalizedURL, isTemporary: true)
    }
}

enum AudioFilePreparationError: LocalizedError {
    case unsupportedContainer

    var errorDescription: String? {
        "unsupported_audio_container"
    }
}
