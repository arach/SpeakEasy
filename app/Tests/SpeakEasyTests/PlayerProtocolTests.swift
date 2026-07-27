import XCTest
import VoxCore
@testable import SpeakEasy

final class PlayerProtocolTests: XCTestCase {
    func testCodexTaskSearchMatchesMultipleTermsAcrossTaskMetadata() {
        let task = CodexTaskSummary(
            id: "019fa197-2f03-7b50-973e-064e01f167e8",
            title: "Delightful lane mapping",
            preview: "Add a searchable lock picker",
            cwd: "/Users/arach/dev/SpeakEasy",
            updatedAt: Date(timeIntervalSince1970: 1_785_000_000)
        )

        XCTAssertTrue(task.matchesSearch("lane SpeakEasy"))
        XCTAssertTrue(task.matchesSearch("SEARCHABLE lock"))
        XCTAssertTrue(task.matchesSearch("019fa197"))
        XCTAssertFalse(task.matchesSearch("lane calendar"))
        XCTAssertEqual(task.projectName, "SpeakEasy")
    }

    func testCodexTaskSearchTreatsBlankAndDiacriticQueriesNaturally() {
        let task = CodexTaskSummary(
            id: "task-1",
            title: "Résumé narration",
            preview: "",
            cwd: "/tmp/VoiceLab",
            updatedAt: .distantPast
        )

        XCTAssertTrue(task.matchesSearch(""))
        XCTAssertTrue(task.matchesSearch("   "))
        XCTAssertTrue(task.matchesSearch("resume"))
    }

    func testCodexTaskActivityUsesCompactRecentLabels() {
        let now = Date(timeIntervalSince1970: 1_785_000_000)
        func task(secondsAgo: TimeInterval) -> CodexTaskSummary {
            CodexTaskSummary(
                id: UUID().uuidString,
                title: "Conversation",
                preview: "",
                cwd: "/tmp/SpeakEasy",
                updatedAt: now.addingTimeInterval(-secondsAgo)
            )
        }

        XCTAssertEqual(task(secondsAgo: 12).activityLabel(relativeTo: now), "now")
        XCTAssertEqual(task(secondsAgo: 90).activityLabel(relativeTo: now), "1m")
        XCTAssertEqual(task(secondsAgo: 7_200).activityLabel(relativeTo: now), "2h")
        XCTAssertEqual(task(secondsAgo: 691_200).activityLabel(relativeTo: now), "1w")
    }

    func testStatusRequestDecodesFromTypeScriptWireShape() throws {
        let json = #"{"protocolVersion":1,"requestId":"5f2ea40a-7471-4cd8-9ead-6549396fc564","command":"status"}"#
        let request = try JSONDecoder().decode(PlayerCommandRequest.self, from: Data(json.utf8))

        XCTAssertEqual(request.protocolVersion, playerProtocolVersion)
        XCTAssertEqual(request.command, .status)
        XCTAssertNil(request.arguments)
    }

    func testEnqueueItemRoundTripsWithoutDateDecoderCoupling() throws {
        let item = PlaybackItem(
            id: UUID(),
            audioPath: "/tmp/narration.mp3",
            title: "Narration",
            text: "Hello",
            provider: "elevenlabs",
            createdAt: "2026-07-24T19:45:00.123Z",
            synthesisRateWPM: 160,
            sourceThreadId: "019f9573-3e55-7701-8968-09c12d4fafe5"
        )
        let request = PlayerCommandRequest(
            protocolVersion: playerProtocolVersion,
            requestId: UUID(),
            command: .enqueue,
            arguments: PlayerCommandArguments(
                item: item,
                priority: .high,
                interrupt: true,
                autoplay: true,
                positionSeconds: nil,
                volume: nil,
                playbackRate: nil,
                itemId: nil
            )
        )

        let decoded = try JSONDecoder().decode(
            PlayerCommandRequest.self,
            from: JSONEncoder().encode(request)
        )

        XCTAssertEqual(decoded.arguments?.item, item)
        XCTAssertEqual(decoded.arguments?.priority, .high)
        XCTAssertEqual(decoded.arguments?.interrupt, true)
        XCTAssertEqual(decoded.arguments?.item?.sourceThreadId, item.sourceThreadId)
        XCTAssertNil(decoded.arguments?.item?.cleanupAfterPlayback)
    }

    func testTemporaryNarrationCanRequestCleanupWithoutBreakingOlderWireItems() throws {
        let legacyJSON = #"{"id":"daffdeaf-0000-4000-8000-000000000001","audioPath":"/tmp/legacy.aiff","title":"Legacy","createdAt":"2026-07-25T00:00:00Z"}"#
        let legacy = try JSONDecoder().decode(PlaybackItem.self, from: Data(legacyJSON.utf8))
        XCTAssertNil(legacy.cleanupAfterPlayback)

        let temporary = PlaybackItem(
            id: UUID(),
            audioPath: "/tmp/temporary.aiff",
            title: "Voice response",
            text: "Done",
            provider: "system",
            createdAt: "2026-07-25T00:00:00Z",
            synthesisRateWPM: 180,
            sourceThreadId: "019f9573-3e55-7701-8968-09c12d4fafe5",
            cleanupAfterPlayback: true
        )
        XCTAssertTrue(try XCTUnwrap(
            try JSONSerialization.jsonObject(with: JSONEncoder().encode(temporary)) as? [String: Any]
        )["cleanupAfterPlayback"] as? Bool ?? false)
    }

    func testNarrationFlattenRemovesCommonMarkdown() {
        XCTAssertEqual(
            ConfiguredResponseNarrator.flatten("## Result\n- **Passed** with `voice`"),
            "Result. Passed with voice"
        )
    }

    func testGeminiPCMIsWrappedInAPlayableWAVContainer() throws {
        let pcm = Data([0, 1, 2, 3])
        let wav = try ConfiguredResponseNarrator.pcmWAV(
            audio: pcm,
            mimeType: "audio/L16;codec=pcm;rate=24000"
        )

        XCTAssertEqual(String(data: wav.prefix(4), encoding: .ascii), "RIFF")
        XCTAssertEqual(String(data: wav[8..<12], encoding: .ascii), "WAVE")
        XCTAssertEqual(String(data: wav[36..<40], encoding: .ascii), "data")
        XCTAssertEqual(wav.count, 44 + pcm.count)
        XCTAssertEqual(wav.suffix(pcm.count), pcm)
    }

    func testConversationHUDNamesTheLockAndExplainsTheHotkey() {
        let presentation = HUDConversationPresentation(
            phase: .recording,
            taskTitle: "Prototype SpeakEasy listening mode",
            taskID: "019f99a4-7867-7c23-ac29-0c0eca7da603",
            laneNumber: 2,
            transcript: "",
            error: nil,
            inputDeviceName: "MacBook Air Microphone"
        )

        XCTAssertEqual(presentation.title, "Listening to you")
        XCTAssertTrue(presentation.detail.contains("⌃⌥Space to send"))
        XCTAssertTrue(presentation.detail.contains("MacBook Air Microphone"))
        XCTAssertEqual(presentation.taskTitle, "Prototype SpeakEasy listening mode")
        XCTAssertEqual(presentation.laneNumber, 2)
    }

    func testCueingHUDKeepsTaskInHeaderAndExplainsMicOffInBody() {
        XCTAssertEqual(ListeningPhase.cueing.label, "Confirming")

        let presentation = HUDConversationPresentation(
            phase: .cueing,
            taskTitle: "Prototype SpeakEasy listening mode",
            taskID: "019f99a4-7867-7c23-ac29-0c0eca7da603",
            laneNumber: 2,
            transcript: "",
            error: nil,
            inputDeviceName: nil
        )

        XCTAssertEqual(presentation.title, "Lane 2 confirmed")
        XCTAssertEqual(presentation.detail, "Status check · microphone is off")
        XCTAssertFalse(presentation.detail.contains(presentation.taskTitle))
        XCTAssertEqual(presentation.taskTitle, "Prototype SpeakEasy listening mode")
    }

    func testCompactConversationHUDLayoutKeepsReadableHierarchy() {
        XCTAssertEqual(HUDLayout.width, 404)
        XCTAssertEqual(HUDLayout.height, 132)
        XCTAssertEqual(HUDLayout.conversationHeight, 116)
        XCTAssertEqual(HUDLayout.screenInset, HUDLayout.contentPadding)
        XCTAssertEqual(HUDLayout.sectionSpacing, HUDLayout.contentPadding)
        XCTAssertEqual(HUDLayout.headerRowHeight, HUDLayout.dismissSize)
        XCTAssertEqual(HUDLayout.dismissPadding, HUDLayout.contentPadding)
        XCTAssertLessThan(HUDLayout.width, 480)
        XCTAssertLessThan(HUDLayout.height, 180)
        XCTAssertGreaterThanOrEqual(HUDLayout.titleSize, 13)
        XCTAssertGreaterThanOrEqual(HUDLayout.detailSize, 10)
        XCTAssertGreaterThanOrEqual(HUDLayout.iconSize, 30)
        XCTAssertGreaterThanOrEqual(HUDLayout.energyHeight, 12)
        XCTAssertGreaterThanOrEqual(HUDLayout.energyBarCount, 40)
        XCTAssertLessThanOrEqual(HUDPhaseChrome.glowOpacity, 0.12)
        XCTAssertLessThanOrEqual(HUDPhaseChrome.borderOpacity, 0.24)
        XCTAssertLessThanOrEqual(HUDPhaseChrome.shadowOpacity, 0.10)
    }

    func testVoiceLanePersistsItsExactTaskIdentity() throws {
        let lane = VoiceLane(
            number: 4,
            task: ListeningTaskLock(
                id: "019f99a4-7867-7c23-ac29-0c0eca7da603",
                title: "Prototype SpeakEasy listening mode",
                cwd: "/Users/arach/dev/SpeakEasy"
            ),
            voiceOverride: LaneVoiceOverride(provider: "ElevenLabs", voiceID: "  voice-42  "),
            narrationCue: "  Warm, concise, and energized.  "
        )

        let decoded = try JSONDecoder().decode(
            VoiceLane.self,
            from: JSONEncoder().encode(lane)
        )

        XCTAssertEqual(decoded, lane)
        XCTAssertEqual(decoded.shortcutTitle, "⌘⌥4")
        XCTAssertEqual(decoded.task.id, lane.task.id)
        XCTAssertEqual(decoded.voiceOverride?.provider, "elevenlabs")
        XCTAssertEqual(decoded.voiceOverride?.voiceID, "voice-42")
        XCTAssertEqual(decoded.narrationCue, "Warm, concise, and energized.")
    }

    func testVoiceLaneDecodesLegacyAssignmentsWithoutVoiceOverride() throws {
        let legacyJSON = #"{"number":3,"task":{"id":"task-3","title":"Legacy task","cwd":"/tmp"}}"#
        let lane = try JSONDecoder().decode(VoiceLane.self, from: Data(legacyJSON.utf8))

        XCTAssertEqual(lane.number, 3)
        XCTAssertEqual(lane.task.id, "task-3")
        XCTAssertNil(lane.voiceOverride)
    }

    func testLaneVoiceOverrideRejectsBlankProviderOrVoice() {
        XCTAssertNil(LaneVoiceOverride(provider: "  ", voiceID: "nova"))
        XCTAssertNil(LaneVoiceOverride(provider: "openai", voiceID: "\n"))
    }

    func testLaneNarrationAppliesOnlyTheMatchingProviderVoice() throws {
        let task = ListeningTaskLock(id: "task-2", title: "Voice task", cwd: "/tmp")
        let lane = VoiceLane(
            number: 2,
            task: task,
            voiceOverride: try XCTUnwrap(LaneVoiceOverride(provider: "openai", voiceID: "coral")),
            narrationCue: "Speak with bright, compact energy."
        )
        let openAI = SpeechNarrationConfiguration(
            provider: "openai",
            voice: "nova",
            model: "gpt-4o-mini-tts",
            apiKey: "test-key",
            instructions: "Pronounce product names precisely.",
            rate: 190
        )

        let applied = openAI.applying(lane: lane)
        XCTAssertEqual(applied.voice, "coral")
        XCTAssertEqual(
            applied.instructions,
            "Pronounce product names precisely.\n\nSpeak with bright, compact energy."
        )

        let system = SpeechNarrationConfiguration(
            provider: "system",
            voice: "Samantha",
            model: nil,
            apiKey: "",
            instructions: nil,
            rate: 180
        ).applying(lane: lane)
        XCTAssertEqual(system.voice, "Samantha")
    }

    func testTurnContextKeepsItsNarrationSnapshot() {
        let lock = ListeningTaskLock(id: "task-7", title: "Snapshot task", cwd: "/tmp")
        let narration = SpeechNarrationConfiguration(
            provider: "openai",
            voice: "coral",
            model: "gpt-4o-mini-tts",
            apiKey: "test-key",
            instructions: "Keep it crisp.",
            rate: 205
        )
        let context = ListeningTurnContext(
            lock: lock,
            laneNumber: 7,
            narration: narration,
            playbackVolume: 0.65
        )

        XCTAssertEqual(context.lock, lock)
        XCTAssertEqual(context.laneNumber, 7)
        XCTAssertEqual(context.narration, narration)
        XCTAssertEqual(context.playbackVolume, 0.65)
    }

    func testCodexDeliveryNamesNewTurnsAndActiveTurnSteers() {
        XCTAssertEqual(CodexTurnDelivery.startedTurn.label, "Started a new turn in the exact task")
        XCTAssertEqual(
            CodexTurnDelivery.steeredActiveTurn.label,
            "Steered the active turn in the exact task"
        )
    }

    func testOnlyExplicitTaskSelectionRevealsCodex() {
        XCTAssertFalse(CodexTaskLockPresentation.background.revealsCodex)
        XCTAssertTrue(CodexTaskLockPresentation.revealInCodex.revealsCodex)
    }

    func testColdStartUsesAppleSpeechUntilParakeetIsReady() {
        XCTAssertEqual(
            VoxListeningService.preferredEngine(parakeetReady: false),
            .appleSpeech
        )
        XCTAssertEqual(
            VoxListeningService.preferredEngine(parakeetReady: true),
            .parakeet
        )
    }

    func testDedicatedMicrophonePreferenceRetainsStableIdentity() throws {
        let preference = ListeningInputPreference(id: "device-uid-42", name: "Studio Mic")
        let decoded = try JSONDecoder().decode(
            ListeningInputPreference.self,
            from: JSONEncoder().encode(preference)
        )

        XCTAssertEqual(decoded, preference)
        XCTAssertTrue(preference.isAvailable(in: [
            AudioInputDeviceInfo(id: "device-uid-42", name: "Studio Mic", isSystemDefault: false)
        ]))
        XCTAssertFalse(preference.isAvailable(in: []))
    }

    @MainActor
    func testLaneShortcutsUseDistinctNumberKeyCodes() {
        let codes = ListeningSessionController.laneRange.map(GlobalListeningShortcut.keyCode(forLane:))
        XCTAssertEqual(Set(codes).count, 9)
        XCTAssertEqual(GlobalListeningShortcut.title(forLane: 1), "⌘⌥1")
        XCTAssertEqual(GlobalListeningShortcut.title(forLane: 9), "⌘⌥9")
        XCTAssertEqual(GlobalListeningShortcut.confirmationTitle, "⌘⌥X")
    }

    func testCodexTaskLinkRejectsUnsafeThreadIdentifiers() {
        XCTAssertEqual(
            CodexTaskLink.url(threadId: "019f9573-3e55-7701-8968-09c12d4fafe5")?.absoluteString,
            "codex://threads/019f9573-3e55-7701-8968-09c12d4fafe5"
        )
        XCTAssertNil(CodexTaskLink.url(threadId: "../../settings"))
        XCTAssertNil(CodexTaskLink.url(threadId: "thread id"))
        XCTAssertNil(CodexTaskLink.url(threadId: ""))
    }

    @MainActor
    func testPlayerSettingsClampToSupportedRanges() {
        let engine = PlaybackEngine.shared

        engine.setVolume(2)
        engine.setPlaybackRate(4)
        XCTAssertEqual(engine.volume, 1)
        XCTAssertEqual(engine.playbackRate, 2)

        engine.setVolume(-1)
        engine.setPlaybackRate(0.1)
        XCTAssertEqual(engine.volume, 0)
        XCTAssertEqual(engine.playbackRate, 0.5)

        engine.setVolume(0.8)
        engine.setPlaybackRate(1)
    }
}
