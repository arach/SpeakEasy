import XCTest
@testable import SpeakEasy

final class CompletionSubscriptionTests: XCTestCase {
    func testPackagedResourceResolverFindsTheLunaPresenter() {
        let presenter = SpeakEasyResources.url(
            forResource: "codex-luna-presenter",
            withExtension: "cjs"
        )
        XCTAssertNotNil(presenter)
        XCTAssertTrue(FileManager.default.isReadableFile(atPath: presenter?.path ?? ""))
    }

    private let task = ListeningTaskLock(
        id: "019f99a4-7867-7c23-ac29-0c0eca7da603",
        title: "Completion task",
        cwd: "/Users/arach/dev/SpeakEasy"
    )

    func testSubscriptionStorePersistsCursorAndExactlyOnceSet() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-completions-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = CompletionSubscriptionStore(fileURL: directory.appendingPathComponent("subscriptions.json"))
        let subscription = CompletionSubscription(
            task: task,
            lastObservedTurnID: "turn-2",
            lastEnqueuedTurnID: "turn-2",
            cursorOffset: 482,
            enqueuedTurnIDs: ["\(task.id)::turn-1", "\(task.id)::turn-2"],
            subscribedAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
        let activity = CompletionActivity(
            taskID: task.id,
            turnID: "turn-2",
            response: "Done",
            completedAt: Date(timeIntervalSince1970: 1_700_000_010),
            state: .announced,
            cursorOffset: 482,
            spokenText: "The task is done.",
            presentationSource: .luna,
            presentationModel: "gpt-5.6-luna"
        )

        try store.save(CompletionSubscriptionSnapshot(
            subscription: subscription,
            channel: CompletionChannelConfiguration(isMuted: true),
            activities: [activity]
        ))
        let restored = try store.load()

        XCTAssertEqual(restored.subscription, subscription)
        XCTAssertEqual(restored.subscription?.cursorOffset, 482)
        XCTAssertTrue(restored.subscription?.enqueuedTurnIDs.contains("\(task.id)::turn-1") == true)
        XCTAssertEqual(restored.activities.count, 1)
        XCTAssertEqual(restored.activities.first?.id, activity.id)
        XCTAssertEqual(restored.activities.first?.dedupeKey, activity.dedupeKey)
        XCTAssertEqual(restored.activities.first?.state, .announced)
        XCTAssertEqual(restored.activities.first?.spokenText, "The task is done.")
        XCTAssertEqual(restored.activities.first?.presentationSource, .luna)
        XCTAssertEqual(restored.activities.first?.presentationModel, "gpt-5.6-luna")
        XCTAssertTrue(restored.channel.isMuted)
    }

    func testLegacySubscriptionMigratesWithoutInventingASecondTask() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-completions-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let json = """
        {
          "schemaVersion": 1,
          "subscription": {
            "task": {"id":"task-1","title":"Title A","cwd":"/tmp/a"},
            "channelID":"completions",
            "isEnabled":true,
            "lastObservedTurnID":"turn-1",
            "lastEnqueuedTurnID":"turn-1",
            "subscribedAt":"2026-08-01T12:00:00Z"
          },
          "activities": []
        }
        """
        let url = directory.appendingPathComponent("subscriptions.json")
        try Data(json.utf8).write(to: url)

        let restored = try CompletionSubscriptionStore(fileURL: url).load()
        XCTAssertEqual(restored.schemaVersion, CompletionSubscriptionSnapshot.currentSchemaVersion)
        XCTAssertEqual(restored.subscription?.task.id, "task-1")
        XCTAssertEqual(restored.subscription?.enqueuedTurnIDs, ["task-1::turn-1"])
        XCTAssertNil(restored.subscription?.cursorOffset)
    }

    func testDedupeKeyUsesExactTaskAndTurnIdentity() {
        let first = CompletionSubscription(task: task)
        let otherTask = ListeningTaskLock(id: "other", title: task.title, cwd: task.cwd)
        let second = CompletionSubscription(task: otherTask)

        XCTAssertEqual(first.dedupeKey(turnID: "turn-7"), "\(task.id)::turn-7")
        XCTAssertNotEqual(first.dedupeKey(turnID: "turn-7"), second.dedupeKey(turnID: "turn-7"))
        XCTAssertNotEqual(first.dedupeKey(turnID: "turn-7"), first.dedupeKey(turnID: "turn-8"))
    }

    func testObserverPresenterFeatureIsDefaultOffWithEmergencyOverride() {
        XCTAssertFalse(ObserverPresenterFeature.isEnabled(environment: [:], configured: nil))
        XCTAssertTrue(ObserverPresenterFeature.isEnabled(environment: [:], configured: true))
        XCTAssertFalse(ObserverPresenterFeature.isEnabled(
            environment: [ObserverPresenterFeature.environmentKey: "0"],
            configured: true
        ))
        XCTAssertTrue(ObserverPresenterFeature.isEnabled(
            environment: [ObserverPresenterFeature.environmentKey: "yes"],
            configured: false
        ))
    }

    func testDeterministicProjectionRemovesSpeechHostileMarkupWithoutInventingASummary() {
        let response = """
        ## Completed
        The observer is installed. See [the task](https://example.com/task).

        ```swift
        fatalError("This code must not be narrated")
        ```

        - Tests pass
        - The full response remains in Codex
        """
        let spoken = CompletionSpeechProjector.project(response)

        XCTAssertTrue(spoken.contains("The observer is installed"))
        XCTAssertTrue(spoken.contains("Tests pass"))
        XCTAssertFalse(spoken.contains("fatalError"))
        XCTAssertFalse(spoken.contains("https://"))
        XCTAssertFalse(spoken.contains("##"))
    }

    func testDeterministicProjectionBoundsLongSpeechAndPointsBackToCodex() {
        let spoken = CompletionSpeechProjector.project(String(repeating: "result ", count: 500))
        XCTAssertLessThanOrEqual(spoken.count, 960)
        XCTAssertTrue(spoken.hasSuffix("The full response is available in Codex."))
    }

    func testBridgeParserAcceptsStructuredCompletionAndRejectsWrongProvenance() throws {
        let line = """
        {"ok":true,"type":"completion","taskID":"\(task.id)","turnID":"turn-9","response":"Final answer","completedAt":"2026-08-01T12:00:00.701Z","cursor":912,"provenance":{"owner":"codex-desktop","hostID":"local","protocolVersion":11,"rolloutPath":"/Users/arach/.codex/sessions/2026/turn-\(task.id).jsonl","rolloutIdentity":"1:2:abc"}}
        """
        guard case .completion(let event) = try CodexCompletionBridgeLineParser.parse(line, expectedTaskID: task.id) else {
            return XCTFail("Expected a completion event")
        }
        XCTAssertEqual(event.taskID, task.id)
        XCTAssertEqual(event.turnID, "turn-9")
        XCTAssertEqual(event.cursorOffset, 912)
        XCTAssertEqual(event.provenance.owner, "codex-desktop")

        let unsafe = line.replacingOccurrences(of: "\"owner\":\"codex-desktop\"", with: "\"owner\":\"app-server\"")
        XCTAssertThrowsError(try CodexCompletionBridgeLineParser.parse(unsafe, expectedTaskID: task.id)) { error in
            XCTAssertEqual(error as? CodexCompletionBridgeError, .invalidProvenance)
        }
    }

    func testBaselineAndCursorMessagesDoNotBecomeNarratableCompletions() throws {
        let baseline = "{\"ok\":true,\"type\":\"baseline\",\"taskID\":\"\(task.id)\",\"cursor\":200,\"rolloutIdentity\":\"1:2:abc\"}"
        let cursor = "{\"ok\":true,\"type\":\"cursor\",\"taskID\":\"\(task.id)\",\"turnID\":\"turn-failed\",\"cursor\":260}"

        guard case .baseline(_, let baselineOffset, let rolloutIdentity) = try CodexCompletionBridgeLineParser.parse(baseline, expectedTaskID: task.id) else {
            return XCTFail("Expected baseline")
        }
        guard case .cursor(_, let turnID, let cursorOffset) = try CodexCompletionBridgeLineParser.parse(cursor, expectedTaskID: task.id) else {
            return XCTFail("Expected cursor")
        }
        XCTAssertEqual(baselineOffset, 200)
        XCTAssertEqual(rolloutIdentity, "1:2:abc")
        XCTAssertEqual(turnID, "turn-failed")
        XCTAssertEqual(cursorOffset, 260)
    }

    func testCompletionPlaybackItemsRemainBehindInteractiveItemsOnTheWire() throws {
        let activityID = UUID()
        let completion = PlaybackItem(
            id: UUID(),
            audioPath: "/tmp/completion.mp3",
            title: "Completion task",
            text: "Done",
            provider: "system",
            createdAt: "2026-08-01T12:00:00Z",
            synthesisRateWPM: 180,
            sourceThreadId: task.id,
            channel: .completions,
            completionActivityID: activityID
        )
        let decoded = try JSONDecoder().decode(PlaybackItem.self, from: JSONEncoder().encode(completion))

        XCTAssertEqual(decoded.effectiveChannel, .completions)
        XCTAssertEqual(decoded.completionActivityID, activityID)
        XCTAssertEqual(decoded.sourceThreadId, task.id)
    }

    @MainActor
    func testCompletionQueueWaitsBehindInteractiveWork() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-playback-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let audioPath = directory.appendingPathComponent("placeholder.mp3").path
        try Data().write(to: URL(fileURLWithPath: audioPath))

        let engine = PlaybackEngine.shared
        engine.stop()
        engine.clearQueue()
        engine.setInteractiveBusy(true)
        defer {
            engine.stop()
            engine.clearQueue()
            engine.setInteractiveBusy(false)
        }

        let completion = PlaybackItem(
            id: UUID(), audioPath: audioPath, title: "Completion", text: "Done",
            provider: "system", createdAt: "2026-08-01T12:00:00Z", synthesisRateWPM: 180,
            sourceThreadId: task.id, channel: .completions
        )
        let interactive = PlaybackItem(
            id: UUID(), audioPath: audioPath, title: "Interactive", text: "Now",
            provider: "system", createdAt: "2026-08-01T12:00:00Z", synthesisRateWPM: 180,
            sourceThreadId: nil
        )
        try engine.enqueue(completion, priority: .normal, interrupt: false, autoplay: true)
        try engine.enqueue(interactive, priority: .high, interrupt: false, autoplay: false)

        XCTAssertEqual(engine.queue.map(\.id), [interactive.id, completion.id])
        XCTAssertNil(engine.currentItem)
    }

    @MainActor
    func testMuteReplayControlsAndUnsubscribeStayIndependentFromListeningState() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-completions-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let controller = CompletionSubscriptionController(
            store: CompletionSubscriptionStore(fileURL: directory.appendingPathComponent("subscriptions.json")),
            featureEnabled: true
        )

        controller.subscribe(to: task)
        XCTAssertTrue(controller.isSubscribed(to: task.id))
        XCTAssertTrue(controller.subscription?.isEnabled == true)
        XCTAssertEqual(controller.channel.channelID, CompletionChannelConfiguration.id)

        controller.setMuted(true)
        XCTAssertTrue(controller.channel.isMuted)
        XCTAssertEqual(controller.state, .muted)

        controller.setMuted(false)
        XCTAssertFalse(controller.channel.isMuted)
        controller.setEnabled(false)
        XCTAssertEqual(controller.state, .off)
        XCTAssertTrue(controller.isSubscribed(to: task.id))

        controller.unsubscribe()
        XCTAssertNil(controller.subscription)
        XCTAssertEqual(controller.state, .off)
    }

    @MainActor
    func testFeatureFlagOffPreventsCreatingAHiddenSubscription() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("speakeasy-completions-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let controller = CompletionSubscriptionController(
            store: CompletionSubscriptionStore(fileURL: directory.appendingPathComponent("subscriptions.json")),
            featureEnabled: false
        )

        controller.subscribe(to: task)

        XCTAssertFalse(controller.isFeatureEnabled)
        XCTAssertNil(controller.subscription)
        XCTAssertEqual(controller.state, .off)
    }
}
