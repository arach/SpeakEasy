import Combine
import Foundation

/// The narration currently coming out of this device, measured rather than
/// imagined: real output level from `AVAudioPlayer` metering, laid out against
/// the file's own timeline.
///
/// This is deliberately *not* a property on `DeckConnection`. It republishes at
/// 20 Hz, and every view that observes the connection -- the whole deck -- would
/// re-render at that rate. Only the audio instrument observes this object, so
/// the 20 Hz invalidation stays inside one subtree.
final class DeckPlaybackMeter: ObservableObject {
    /// Buckets, not samples. A 40 s message at 20 Hz is 800 readings for a
    /// ~230 pt track; bucketing to the drawable resolution keeps the envelope
    /// stable instead of reshaping itself every frame as the sample count grows.
    /// Dense envelope for wide radio bays (matches capture bar density).
    static let bucketCount = 120

    /// Envelope of the message being heard, indexed by position in the file.
    /// A bucket is filled the moment it is played, so a bucket that is still
    /// zero is one this device has genuinely never played -- seek forward and
    /// the skipped span stays empty, which is the truth.
    @Published private(set) var buckets: [Double] = Array(repeating: 0, count: bucketCount)
    /// Smoothed instantaneous level, for the status dot.
    @Published private(set) var level: Double = 0
    @Published private(set) var position: Double = 0
    @Published private(set) var duration: Double = 0
    /// "lane:index" of the message these readings belong to. The instrument
    /// checks it before trusting them, so a stale envelope can never be drawn
    /// under a different message.
    @Published private(set) var id: String?

    init() {}

    /// Harness constructor. The gallery needs a plausible envelope to evaluate
    /// the playing states, and there is no audio in a preview.
    init(preview id: String, buckets: [Double], position: Double, duration: Double) {
        self.id = id
        self.buckets = buckets
        self.position = position
        self.duration = duration
        self.level = buckets.isEmpty ? 0 : buckets[min(buckets.count - 1, Int(Double(buckets.count) * position / max(duration, 0.01)))]
    }

    func begin(id: String, duration: Double) {
        guard self.id != id else { return }
        self.id = id
        self.duration = duration
        position = 0
        level = 0
        buckets = Array(repeating: 0, count: Self.bucketCount)
    }

    func clear() {
        guard id != nil else { return }
        id = nil
        level = 0
        position = 0
        duration = 0
        buckets = Array(repeating: 0, count: Self.bucketCount)
    }

    /// One metering reading. `power` is peak dBFS as AVAudioPlayer reports it.
    func ingest(power: Float, position: Double, duration: Double) {
        self.position = position
        if duration > 0 { self.duration = duration }

        // -48 dBFS is the practical floor for spoken narration; below it the
        // curve is all room tone and the bars never settle.
        let normalized = Double(max(0, (power + 48) / 48))
        // Mild expansion so ordinary speech does not sit pinned near the top.
        let shaped = min(1, pow(normalized, 1.6))
        level += (shaped - level) * (shaped > level ? 0.6 : 0.22)

        guard self.duration > 0 else { return }
        let slot = Int((position / self.duration) * Double(Self.bucketCount))
        guard buckets.indices.contains(slot) else { return }
        // Max, not mean: the envelope should show the loudest thing that
        // happened in that slice, which is what an eye reads a waveform for.
        if shaped > buckets[slot] { buckets[slot] = shaped }
    }

    /// A scrub moved the playhead; adopt it immediately so the figure does not
    /// lag a metering tick behind the thumb.
    func moved(to seconds: Double) {
        position = seconds
    }
}
