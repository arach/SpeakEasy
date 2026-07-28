import XCTest
@testable import SpeakEasy

final class SpeechProviderCatalogTests: XCTestCase {
    func testCatalogHasOneDescriptorForEveryProvider() {
        XCTAssertEqual(Set(SpeechProviderCatalog.all.map(\.id)), Set(SpeechProviderID.allCases))
        XCTAssertEqual(Set(SpeechProviderCatalog.all.map(\.id)).count, SpeechProviderCatalog.all.count)
    }

    func testOnlySystemProviderOmitsCredentialSetup() {
        let withoutCredentials = SpeechProviderCatalog.all.filter { !$0.requiresAPIKey }
        XCTAssertEqual(withoutCredentials.map(\.id), [.system])
    }

    func testGeminiVoiceRoundTripsThroughConfig() throws {
        var config = GlobalConfig()
        config.providers = GlobalConfig.Providers(
            openai: nil,
            elevenlabs: nil,
            system: nil,
            groq: nil,
            gemini: GlobalConfig.GeminiConfig(
                enabled: nil,
                voice: "Kore",
                model: nil,
                apiKey: nil
            )
        )

        let encoded = try JSONEncoder().encode(config)
        let decoded = try JSONDecoder().decode(GlobalConfig.self, from: encoded)

        XCTAssertEqual(decoded.providers?.gemini?.voice, "Kore")
    }
}
