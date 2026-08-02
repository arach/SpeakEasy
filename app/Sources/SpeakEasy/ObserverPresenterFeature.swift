import Foundation

enum ObserverPresenterFeature {
    static let environmentKey = "SPEAKEASY_OBSERVER_PRESENTER"

    /// Default-off release flag. An explicit environment value wins so a bad
    /// presenter can be disabled without editing or migrating persisted state.
    static func isEnabled(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        configured: Bool?
    ) -> Bool {
        if let value = environment[environmentKey]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() {
            if ["1", "true", "yes", "on"].contains(value) { return true }
            if ["0", "false", "no", "off"].contains(value) { return false }
        }
        return configured ?? false
    }
}
