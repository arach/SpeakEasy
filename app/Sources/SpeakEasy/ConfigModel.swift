import Foundation

struct GlobalConfig: Codable {
    var providers: Providers?
    var defaults: Defaults?
    var global: Global?
    var cache: Cache?
    var hud: HUD?

    struct Providers: Codable {
        var openai: OpenAIConfig?
        var elevenlabs: ElevenLabsConfig?
        var system: SystemConfig?
        var groq: GroqConfig?
        var gemini: GeminiConfig?
    }

    struct OpenAIConfig: Codable {
        var enabled: Bool?
        var voice: String?
        var model: String?
        var apiKey: String?
        var instructions: String?
    }

    struct ElevenLabsConfig: Codable {
        var enabled: Bool?
        var voiceId: String?
        var modelId: String?
        var apiKey: String?
    }

    struct SystemConfig: Codable {
        var enabled: Bool?
        var voice: String?
    }

    struct GroqConfig: Codable {
        var enabled: Bool?
        var voice: String?
        var model: String?
        var apiKey: String?
    }

    struct GeminiConfig: Codable {
        var enabled: Bool?
        var model: String?
        var apiKey: String?
    }

    struct Defaults: Codable {
        var provider: String?
        var fallbackOrder: [String]?
        var rate: Int?
        var volume: Double?
    }

    struct Global: Codable {
        var tempDir: String?
        var cleanup: Bool?
    }

    struct Cache: Codable {
        var enabled: Bool?
        var ttl: String?
        var maxSize: String?
        var dir: String?
    }

    struct HUD: Codable {
        var enabled: Bool?
        var position: String? // "top-left", "top-right", "bottom-left", "bottom-right"
        var duration: Int? // milliseconds to display after audio completes
        var opacity: Double? // 0.0 to 1.0
    }
}

enum AppearanceMode: String, CaseIterable {
    case system = "system"
    case light = "light"
    case dark = "dark"

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}

class ConfigManager: ObservableObject {
    static let shared = ConfigManager()

    private let configDir: URL
    private let configFile: URL

    @Published var config: GlobalConfig
    @Published var lastError: String?
    @Published var isSaved = true
    @Published var showSaveConfirmation = false
    @Published var saveTimestamp: Date?
    @Published var appearanceMode: AppearanceMode = .system {
        didSet {
            UserDefaults.standard.set(appearanceMode.rawValue, forKey: "appearanceMode")
        }
    }

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        configDir = home.appendingPathComponent(".config/speakeasy")
        configFile = configDir.appendingPathComponent("settings.json")
        config = GlobalConfig()

        // Load appearance mode from UserDefaults
        if let savedMode = UserDefaults.standard.string(forKey: "appearanceMode"),
           let mode = AppearanceMode(rawValue: savedMode) {
            appearanceMode = mode
        }

        loadConfig()
    }

    func loadConfig() {
        do {
            if FileManager.default.fileExists(atPath: configFile.path) {
                let data = try Data(contentsOf: configFile)
                let decoder = JSONDecoder()
                config = try decoder.decode(GlobalConfig.self, from: data)
                lastError = nil
            } else {
                config = GlobalConfig()
            }
            isSaved = true
        } catch {
            lastError = "Failed to load config: \(error.localizedDescription)"
            config = GlobalConfig()
        }
    }

    func saveConfig() {
        do {
            // Create directory if needed
            if !FileManager.default.fileExists(atPath: configDir.path) {
                try FileManager.default.createDirectory(at: configDir, withIntermediateDirectories: true)
            }

            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(config)
            try data.write(to: configFile)
            lastError = nil
            isSaved = true
            saveTimestamp = Date()
            showSaveConfirmation = true

            // Auto-hide confirmation after 2 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                self?.showSaveConfirmation = false
            }
        } catch {
            lastError = "Failed to save config: \(error.localizedDescription)"
        }
    }

    func markUnsaved() {
        isSaved = false
    }

    // Convenience accessors with defaults
    var defaultProvider: String {
        get { config.defaults?.provider ?? "system" }
        set {
            ensureDefaults()
            config.defaults?.provider = newValue
            markUnsaved()
        }
    }

    var defaultRate: Int {
        get { config.defaults?.rate ?? 180 }
        set {
            ensureDefaults()
            config.defaults?.rate = newValue
            markUnsaved()
        }
    }

    var defaultVolume: Double {
        get { config.defaults?.volume ?? 0.7 }
        set {
            ensureDefaults()
            config.defaults?.volume = newValue
            markUnsaved()
        }
    }

    // OpenAI
    var openaiApiKey: String {
        get { config.providers?.openai?.apiKey ?? "" }
        set {
            ensureProviders()
            ensureOpenAI()
            config.providers?.openai?.apiKey = newValue.isEmpty ? nil : newValue
            markUnsaved()
        }
    }

    var openaiVoice: String {
        get { config.providers?.openai?.voice ?? "nova" }
        set {
            ensureProviders()
            ensureOpenAI()
            config.providers?.openai?.voice = newValue
            markUnsaved()
        }
    }

    var openaiInstructions: String {
        get { config.providers?.openai?.instructions ?? "" }
        set {
            ensureProviders()
            ensureOpenAI()
            config.providers?.openai?.instructions = newValue.isEmpty ? nil : newValue
            markUnsaved()
        }
    }

    // ElevenLabs
    var elevenlabsApiKey: String {
        get { config.providers?.elevenlabs?.apiKey ?? "" }
        set {
            ensureProviders()
            ensureElevenLabs()
            config.providers?.elevenlabs?.apiKey = newValue.isEmpty ? nil : newValue
            markUnsaved()
        }
    }

    var elevenlabsVoiceId: String {
        get { config.providers?.elevenlabs?.voiceId ?? "EXAVITQu4vr4xnSDxMaL" }
        set {
            ensureProviders()
            ensureElevenLabs()
            config.providers?.elevenlabs?.voiceId = newValue
            markUnsaved()
        }
    }

    // Groq
    var groqApiKey: String {
        get { config.providers?.groq?.apiKey ?? "" }
        set {
            ensureProviders()
            ensureGroq()
            config.providers?.groq?.apiKey = newValue.isEmpty ? nil : newValue
            markUnsaved()
        }
    }

    // Gemini
    var geminiApiKey: String {
        get { config.providers?.gemini?.apiKey ?? "" }
        set {
            ensureProviders()
            ensureGemini()
            config.providers?.gemini?.apiKey = newValue.isEmpty ? nil : newValue
            markUnsaved()
        }
    }

    var geminiModel: String {
        get { config.providers?.gemini?.model ?? "gemini-2.5-flash-preview-tts" }
        set {
            ensureProviders()
            ensureGemini()
            config.providers?.gemini?.model = newValue
            markUnsaved()
        }
    }

    // System
    var systemVoice: String {
        get { config.providers?.system?.voice ?? "Samantha" }
        set {
            ensureProviders()
            ensureSystem()
            config.providers?.system?.voice = newValue
            markUnsaved()
        }
    }

    // Cache
    var cacheEnabled: Bool {
        get { config.cache?.enabled ?? true }
        set {
            ensureCache()
            config.cache?.enabled = newValue
            markUnsaved()
        }
    }

    var cacheTTL: String {
        get { config.cache?.ttl ?? "7d" }
        set {
            ensureCache()
            config.cache?.ttl = newValue
            markUnsaved()
        }
    }

    // HUD
    var hudEnabled: Bool {
        get { config.hud?.enabled ?? false }
        set {
            ensureHUD()
            config.hud?.enabled = newValue
            markUnsaved()
            NotificationCenter.default.post(name: NSNotification.Name("ConfigDidChange"), object: nil)
        }
    }

    var hudPosition: String {
        get { config.hud?.position ?? "top-right" }
        set {
            ensureHUD()
            config.hud?.position = newValue
            markUnsaved()
        }
    }

    var hudDuration: Int {
        get { config.hud?.duration ?? 3000 }
        set {
            ensureHUD()
            config.hud?.duration = newValue
            markUnsaved()
        }
    }

    var hudOpacity: Double {
        get { config.hud?.opacity ?? 0.95 }
        set {
            ensureHUD()
            config.hud?.opacity = newValue
            markUnsaved()
        }
    }

    // Helper methods to ensure nested structures exist
    private func ensureDefaults() {
        if config.defaults == nil {
            config.defaults = GlobalConfig.Defaults()
        }
    }

    private func ensureProviders() {
        if config.providers == nil {
            config.providers = GlobalConfig.Providers()
        }
    }

    private func ensureOpenAI() {
        if config.providers?.openai == nil {
            config.providers?.openai = GlobalConfig.OpenAIConfig()
        }
    }

    private func ensureElevenLabs() {
        if config.providers?.elevenlabs == nil {
            config.providers?.elevenlabs = GlobalConfig.ElevenLabsConfig()
        }
    }

    private func ensureGroq() {
        if config.providers?.groq == nil {
            config.providers?.groq = GlobalConfig.GroqConfig()
        }
    }

    private func ensureGemini() {
        if config.providers?.gemini == nil {
            config.providers?.gemini = GlobalConfig.GeminiConfig()
        }
    }

    private func ensureSystem() {
        if config.providers?.system == nil {
            config.providers?.system = GlobalConfig.SystemConfig()
        }
    }

    private func ensureCache() {
        if config.cache == nil {
            config.cache = GlobalConfig.Cache()
        }
    }

    private func ensureHUD() {
        if config.hud == nil {
            config.hud = GlobalConfig.HUD()
        }
    }
}
