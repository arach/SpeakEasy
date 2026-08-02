import Foundation

/// SwiftPM's generated accessor for an executable looks beside the executable
/// bundle and then falls back to an absolute `.build` path. SpeakEasy wraps the
/// executable in a hand-built macOS app, where resources correctly live in
/// `Contents/Resources`. Resolve that release location first so a clean Mac
/// never depends on the developer checkout embedded at compile time.
enum SpeakEasyResources {
    private static let bundleName = "SpeakEasy_SpeakEasy"

    static var bundle: Bundle? {
        if let resourceURL = Bundle.main.resourceURL,
           let packaged = Bundle(
                url: resourceURL.appendingPathComponent("\(bundleName).bundle", isDirectory: true)
           ) {
            return packaged
        }
        return Bundle.module
    }

    static func url(forResource name: String, withExtension extensionName: String?) -> URL? {
        bundle?.url(forResource: name, withExtension: extensionName)
    }

    static var resourceURL: URL? { bundle?.resourceURL }
}
