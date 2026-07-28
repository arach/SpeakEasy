import XCTest
@testable import SpeakEasy

/// Covers the pop-up's pure presentation helpers. These back the strings a user
/// reads in the timeline, the volume readout, and the VoiceOver values, so they
/// are worth pinning even though the surrounding views are not snapshot-tested.
final class PopoverDesignTests: XCTestCase {

    // MARK: - Time

    func testTimeFormatsAsMinutesAndPaddedSeconds() {
        XCTAssertEqual(PopoverFormat.time(0), "0:00")
        XCTAssertEqual(PopoverFormat.time(9), "0:09")
        XCTAssertEqual(PopoverFormat.time(61), "1:01")
        XCTAssertEqual(PopoverFormat.time(128), "2:08")
        XCTAssertEqual(PopoverFormat.time(3_600), "60:00")
    }

    func testTimeTruncatesRatherThanRounding() {
        // A 0:59.9 position must not read as 1:00 while the item is still playing.
        XCTAssertEqual(PopoverFormat.time(59.9), "0:59")
    }

    func testTimeRejectsNonFiniteAndNegativeInput() {
        XCTAssertEqual(PopoverFormat.time(-1), "0:00")
        XCTAssertEqual(PopoverFormat.time(.infinity), "0:00")
        XCTAssertEqual(PopoverFormat.time(.nan), "0:00")
    }

    func testSpokenTimeDropsTheMinuteComponentUnderOneMinute() {
        XCTAssertEqual(PopoverFormat.spokenTime(0), "0 seconds")
        XCTAssertEqual(PopoverFormat.spokenTime(42), "42 seconds")
        XCTAssertEqual(PopoverFormat.spokenTime(128), "2 minutes 8 seconds")
        XCTAssertEqual(PopoverFormat.spokenTime(.nan), "0 seconds")
    }

    // MARK: - Speed

    func testSpeedLabelsCoverEveryOfferedRate() {
        XCTAssertEqual(PopoverFormat.speed(0.5), "0.5×")
        XCTAssertEqual(PopoverFormat.speed(0.75), "0.75×")
        XCTAssertEqual(PopoverFormat.speed(1.0), "1×")
        XCTAssertEqual(PopoverFormat.speed(1.25), "1.2×")
        XCTAssertEqual(PopoverFormat.speed(1.5), "1.5×")
        XCTAssertEqual(PopoverFormat.speed(2.0), "2×")
    }

    // MARK: - Volume

    func testPercentRoundsToWholeNumbers() {
        XCTAssertEqual(PopoverFormat.percent(0), "0%")
        XCTAssertEqual(PopoverFormat.percent(0.8), "80%")
        XCTAssertEqual(PopoverFormat.percent(0.805), "81%")
        XCTAssertEqual(PopoverFormat.percent(1), "100%")
    }

    func testVolumeSymbolEscalatesWithLevelAndMutesAtZero() {
        XCTAssertEqual(PopoverFormat.volumeSymbol(for: 0), "speaker.slash.fill")
        XCTAssertEqual(PopoverFormat.volumeSymbol(for: 0.2), "speaker.wave.1.fill")
        XCTAssertEqual(PopoverFormat.volumeSymbol(for: 0.5), "speaker.wave.2.fill")
        XCTAssertEqual(PopoverFormat.volumeSymbol(for: 0.9), "speaker.wave.3.fill")
    }

    // MARK: - Design invariants

    func testPopoverKeepsTheNativeMenuBarWidth() {
        XCTAssertEqual(PopoverMetrics.width, 320)
    }

    // MARK: - Snapshot fixtures

    @MainActor
    func testEverySnapshotFixtureIsAddressableByRawValue() {
        for fixture in ListeningSessionController.SnapshotFixture.allCases {
            XCTAssertEqual(
                ListeningSessionController.SnapshotFixture(rawValue: fixture.rawValue),
                fixture
            )
        }
        for fixture in PlaybackEngine.SnapshotFixture.allCases {
            XCTAssertEqual(PlaybackEngine.SnapshotFixture(rawValue: fixture.rawValue), fixture)
        }
    }

    @MainActor
    func testPlaybackFixturesProduceTheStatesTheBriefCallsFor() {
        let engine = PlaybackEngine.shared

        engine.installSnapshotFixture(.idle)
        XCTAssertEqual(engine.state, .idle)
        XCTAssertNil(engine.currentItem)
        XCTAssertTrue(engine.queue.isEmpty)

        engine.installSnapshotFixture(.playing)
        XCTAssertEqual(engine.state, .playing)
        XCTAssertNotNil(engine.currentItem)
        XCTAssertGreaterThan(engine.duration, engine.currentTime)
        XCTAssertFalse(engine.queue.isEmpty)

        engine.installSnapshotFixture(.queued)
        XCTAssertEqual(engine.state, .idle)
        XCTAssertNil(engine.currentItem)
        XCTAssertFalse(engine.queue.isEmpty)

        engine.installSnapshotFixture(.failed)
        XCTAssertEqual(engine.state, .failed)
        XCTAssertNotNil(engine.lastError)

        // Leave the shared singleton clean for other tests.
        engine.installSnapshotFixture(.idle)
    }

    @MainActor
    func testListeningFixturesSeparateLockedFromUnlockedState() {
        let controller = ListeningSessionController.shared

        controller.installLaneSnapshotFixture(.unlocked)
        XCTAssertNil(controller.lockedTask)
        XCTAssertFalse(controller.tasks.isEmpty)
        XCTAssertFalse(controller.selectedTaskID.isEmpty)
        XCTAssertNil(controller.lastError)

        controller.installLaneSnapshotFixture(.error)
        XCTAssertNil(controller.lockedTask)
        XCTAssertNotNil(controller.lastError)
        XCTAssertEqual(controller.phase, .failed)

        controller.installLaneSnapshotFixture(.locked)
        XCTAssertNotNil(controller.lockedTask)
        XCTAssertEqual(controller.activeLaneNumber, 2)
        XCTAssertNil(controller.lastError)

        controller.installLaneSnapshotFixture(.recording)
        XCTAssertEqual(controller.phase, .recording)
        XCTAssertNotNil(controller.lockedTask)
    }
}
