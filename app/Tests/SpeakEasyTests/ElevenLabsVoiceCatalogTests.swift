import XCTest
@testable import SpeakEasy

final class ElevenLabsVoiceCatalogTests: XCTestCase {
    func testCuratedCatalogContainsSixUniqueVoices() {
        let voices = ElevenLabsVoiceCatalog.curated

        XCTAssertEqual(voices.count, 6)
        XCTAssertEqual(Set(voices.map(\.voice_id)).count, 6)
        XCTAssertEqual(Set(voices.map(\.name)).count, 6)
    }

    func testMergedCatalogKeepsTheFirstLabelForDuplicateVoiceIDs() {
        let saved = ElevenLabsVoice(voice_id: "voice-1", name: "My Narrator")
        let account = ElevenLabsVoice(voice_id: "voice-1", name: "Provider Label")
        let second = ElevenLabsVoice(voice_id: "voice-2", name: "Second Voice")

        let merged = ElevenLabsVoiceCatalog.merged([saved], [account, second])

        XCTAssertEqual(merged.map(\.voice_id), ["voice-1", "voice-2"])
        XCTAssertEqual(merged[0].name, "My Narrator")
    }

    func testSavedVoicesRoundTripThroughGlobalConfig() throws {
        let json = """
        {
          "providers": {
            "elevenlabs": {
              "voiceId": "voice-1",
              "savedVoices": [
                {
                  "voice_id": "voice-1",
                  "name": "My Narrator",
                  "description": "Warm and direct"
                }
              ]
            }
          }
        }
        """

        let decoded = try JSONDecoder().decode(GlobalConfig.self, from: Data(json.utf8))
        let voice = try XCTUnwrap(decoded.providers?.elevenlabs?.savedVoices?.first)
        XCTAssertEqual(voice.voice_id, "voice-1")
        XCTAssertEqual(voice.name, "My Narrator")

        let encoded = try JSONEncoder().encode(decoded)
        let roundTripped = try JSONDecoder().decode(GlobalConfig.self, from: encoded)
        XCTAssertEqual(roundTripped.providers?.elevenlabs?.savedVoices, [voice])
    }
}
