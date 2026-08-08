import Combine
import Foundation
import SwiftUI

/// Local, disposable walkthrough of one turn's UI states.
///
/// Nothing leaves the device and nothing talks to Codex. It drives the same
/// surfaces a real turn does — capture phase, Mac phase, exchange well, and
/// narration meter — so the operator can judge the lifecycle without speaking
/// empty statements into a live agent.
@MainActor
final class DeckTurnDemo: ObservableObject {
    @Published private(set) var isRunning = false
    @Published private(set) var phase: DeckCapturePhase = .idle
    @Published private(set) var deckPhase: String = "idle"
    @Published private(set) var inputLevel: Double = 0
    @Published private(set) var playback = DeckPlaybackState()
    @Published private(set) var messages: [DeckMessage] = []
    /// Dedicated meter so the demo never contaminates the real player's envelope.
    let meter = DeckPlaybackMeter()

    private var task: Task<Void, Never>?
    private var tick: Task<Void, Never>?

    private static let youText = "Mock turn — walk the full lifecycle without Codex."
    private static let agentText =
        "Lifecycle walkthrough complete. Listening, transcription, Mac work, and narration all lit in sequence."
    private static let duration: Double = 4.2

    func toggle(lane: Int, speedIndex: Int, autoplay: Bool) {
        if isRunning {
            stop()
        } else {
            start(lane: lane, speedIndex: speedIndex, autoplay: autoplay)
        }
    }

    func stop() {
        task?.cancel()
        task = nil
        stopLevelTick()
        reset()
    }

    private func start(lane: Int, speedIndex: Int, autoplay: Bool) {
        stop()
        isRunning = true
        messages = []
        let demoId = "\(lane):demo"

        task = Task { [weak self] in
            guard let self else { return }

            // 1 · Mic warms
            self.phase = .arming
            if await self.sleep(0.35) { return }

            // 2 · Listening with a moving level + capture bars
            self.phase = .recording
            self.startLevelTick()
            if await self.sleep(1.8) { return }
            self.stopLevelTick()
            self.inputLevel = 0

            // 3 · On-device transcript
            self.phase = .transcribing
            if await self.sleep(0.7) { return }

            // Spoken turn lands in the exchange
            self.messages = [
                DeckMessage(role: "you", text: Self.youText, dur: 0, mirrored: nil, file: nil, audioUrl: nil),
            ]
            self.phase = .idle

            // 4 · Mac working
            self.deckPhase = "submitting"
            if await self.sleep(1.1) { return }
            self.deckPhase = "idle"

            // Reply lands; treat as file-backed so PLAY would arm after
            self.messages = [
                DeckMessage(role: "you", text: Self.youText, dur: 0, mirrored: nil, file: nil, audioUrl: nil),
                DeckMessage(
                    role: "agent",
                    text: Self.agentText,
                    dur: Self.duration,
                    mirrored: nil,
                    file: "demo.m4a",
                    audioUrl: "demo://turn"
                ),
            ]

            // 5 · Narration — drive meter + transport as if speaking
            self.playback = DeckPlaybackState(
                id: demoId,
                paused: false,
                position: 0,
                duration: Self.duration,
                speedIndex: speedIndex,
                autoplay: autoplay,
                text: Self.agentText
            )
            self.meter.begin(id: demoId, duration: Self.duration)

            let steps = 42
            for step in 0...steps {
                if Task.isCancelled { return }
                let t = Double(step) / Double(steps)
                let position = t * Self.duration
                // Speech-shaped level: phrases with breaths, not a sine.
                let phrase = abs(sin(t * .pi * 4.2)) * 0.7 + abs(sin(t * .pi * 11)) * 0.25
                let breath = (sin(t * .pi * 2) > -0.35) ? 1.0 : 0.08
                let power = Float(-48 + 48 * phrase * breath)
                self.meter.ingest(power: power, position: position, duration: Self.duration)
                self.playback.position = position
                try? await Task.sleep(nanoseconds: 95_000_000)
            }

            if Task.isCancelled { return }

            // Clear playback at end-of-clip so the face latches FINISHED → READY.
            // Console watches the outgoing position (near duration) to latch REPLAY.
            self.playback = DeckPlaybackState(
                speedIndex: speedIndex,
                autoplay: autoplay
            )
            self.meter.clear()
            self.isRunning = false
            self.task = nil
        }
    }

    private func reset() {
        phase = .idle
        deckPhase = "idle"
        inputLevel = 0
        playback = DeckPlaybackState()
        messages = []
        meter.clear()
        isRunning = false
    }

    private func startLevelTick() {
        stopLevelTick()
        tick = Task { [weak self] in
            var t = 0.0
            while !Task.isCancelled {
                // Soft speech envelope while "listening"
                let level = 0.18
                    + abs(sin(t * 2.4)) * 0.45
                    + abs(sin(t * 7.1)) * 0.22
                    + Double.random(in: 0...0.08)
                self?.inputLevel = min(1, level)
                t += 0.05
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
    }

    private func stopLevelTick() {
        tick?.cancel()
        tick = nil
        inputLevel = 0
    }

    /// Returns true when the demo was cancelled and the caller should exit.
    private func sleep(_ seconds: Double) async -> Bool {
        do {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            return Task.isCancelled
        } catch {
            return true
        }
    }
}
