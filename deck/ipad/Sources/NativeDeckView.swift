import SwiftUI

extension View {
    func deckMono(_ size: CGFloat, weight: Font.Weight = .regular) -> some View {
        font(.system(size: size, weight: weight, design: .monospaced))
    }
}

struct SpeakEasyMark: View {
    let size: CGFloat

    var body: some View {
        Image("SpeakEasyMark")
            .resizable()
            .renderingMode(.original)
            .scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.18))
    }
}

struct NativeDeckView: View {
    @ObservedObject var connection: DeckConnection
    @ObservedObject var voice: DeckVoice
    let laneViewer: DeckLaneViewerController
    let selectedDeck: DiscoveredDeck
    let onFindDecks: () -> Void
    @AppStorage(DeckThemeSelection.defaultsKey) private var selectedThemeRaw = DeckThemeID.flight.rawValue
    @AppStorage(DeckSurfaceSelection.defaultsKey) private var selectedSurfaceRaw = DeckSurfaceID.micro.rawValue
    @AppStorage("speakeasy.deck.terminal-layout") private var usesTerminalLayout = true
    @State private var showingLaneSetup = false
    @State private var showingAppearance = {
        #if DEBUG
        ProcessInfo.processInfo.environment["SPEAKEASY_SHOW_APPEARANCE"] == "1"
        #else
        false
        #endif
    }()
    @State private var showingCompanion = false
    @State private var showingLaneActivity = {
        #if DEBUG
        ProcessInfo.processInfo.environment["SPEAKEASY_SHOW_ACTIVITY"] == "1"
        #else
        false
        #endif
    }()

    private var selectedTheme: DeckThemeID {
        DeckThemeID(rawValue: selectedThemeRaw) ?? .flight
    }

    private var selectedSurface: DeckSurfaceID {
        DeckSurfaceID(rawValue: selectedSurfaceRaw) ?? .micro
    }

    var body: some View {
        GeometryReader { geometry in
            let compact = geometry.size.width < 620
            Group {
                if let snapshot = connection.snapshot {
                    if usesTerminalLayout {
                        TerminalDeckView(connection: connection, voice: voice, snapshot: snapshot,
                                         showSetup: { showingLaneSetup = true },
                                         showConnection: { showingCompanion = true })
                    } else if compact {
                        KeypadPanel(
                            connection: connection,
                            voice: voice,
                            snapshot: snapshot,
                            surface: selectedSurface,
                            compact: true,
                            showLaneSetup: { showingLaneSetup = true },
                            showAppearance: { showingAppearance = true },
                            showCompanion: { showingCompanion = true },
                            showActivity: { showingLaneActivity = true }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if selectedSurface == .micro {
                        // Micro Deck renders its own console beside the key
                        // bank, so sharing the surface with the WebKit lane
                        // viewer squeezes the pad into a quarter of a half.
                        // Every other surface still wants the viewer.
                        //
                        // This gate used to live inside the >= 980 branch, and
                        // that left a dead band: an iPad in portrait is about
                        // 820 pt, which fell through to the stacked fallback
                        // below — the whole deck crushed into a fixed 720 pt
                        // box with the web viewer under it, all inside an outer
                        // ScrollView fighting the lane picker and the exchange
                        // well for the same drag. It read as an app that had
                        // stopped accepting touches, which is very nearly what
                        // it was. Micro owns the whole surface at every width
                        // it is offered; only the sub-620 compact path differs,
                        // and that one is a deliberate layout, not a fallback.
                        KeypadPanel(
                            connection: connection,
                            voice: voice,
                            snapshot: snapshot,
                            surface: selectedSurface,
                            compact: false,
                            showLaneSetup: { showingLaneSetup = true },
                            showAppearance: { showingAppearance = true },
                            showCompanion: { showingCompanion = true },
                            showActivity: { showingLaneActivity = true }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if geometry.size.width >= 980 {
                        HStack(spacing: 12) {
                            KeypadPanel(
                                connection: connection,
                                voice: voice,
                                snapshot: snapshot,
                                surface: selectedSurface,
                                compact: false,
                                showLaneSetup: { showingLaneSetup = true },
                                showAppearance: { showingAppearance = true },
                                showCompanion: { showingCompanion = true }
                            )
                            .frame(width: min(600, geometry.size.width * 0.46))

                            DeckLaneWebView(controller: laneViewer)
                                .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 9))
                                .clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                    } else {
                        ScrollView(.vertical, showsIndicators: false) {
                            VStack(spacing: 12) {
                                KeypadPanel(
                                    connection: connection,
                                    voice: voice,
                                    snapshot: snapshot,
                                    surface: selectedSurface,
                                    compact: false,
                                    showLaneSetup: { showingLaneSetup = true },
                                    showAppearance: { showingAppearance = true },
                                    showCompanion: { showingCompanion = true }
                                )
                                .frame(height: 720)

                                DeckLaneWebView(controller: laneViewer)
                                    .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 9))
                                    .clipShape(RoundedRectangle(cornerRadius: 9))
                                    .frame(height: 720)
                            }
                        }
                    }
                } else {
                    nativeLinkPlaceholder
                }
            }
            .padding(.horizontal, compact ? 8 : 12)
            .padding(.top, compact ? 6 : 8)
            .padding(.bottom, compact ? 6 : 10)
        }
        .background(Color.black.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .onAppear { laneViewer.theme = selectedTheme }
        .onChange(of: selectedThemeRaw) { _, _ in laneViewer.theme = selectedTheme }
        .sheet(isPresented: $showingLaneSetup) {
            LaneSetupView(connection: connection)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingAppearance) {
            DeckAppearanceView(selectedThemeRaw: $selectedThemeRaw, selectedSurfaceRaw: $selectedSurfaceRaw)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingCompanion) {
            DeckCompanionView(connection: connection, voice: voice, deck: selectedDeck, onFindDecks: onFindDecks)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showingLaneActivity) {
            CompactLaneActivityView(controller: laneViewer)
                .preferredColorScheme(selectedTheme.colorScheme)
        }
    }

    /// Pre-snapshot shell: host identity and link chrome live on the plate so
    /// the operator never sees a separate title bar above an empty deck.
    private var nativeLinkPlaceholder: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                SpeakEasyMark(size: 17)
                Text("DECK")
                    .deckMono(10, weight: .semibold)
                    .tracking(1.8)
                    .foregroundStyle(DeckPalette.ink)
                Rectangle()
                    .fill(DeckPalette.lineSoft)
                    .frame(width: 1, height: 17)

                Button { showingCompanion = true } label: {
                    HStack(spacing: 7) {
                        Circle()
                            .fill(connection.state == .connected ? DeckPalette.accent : DeckPalette.ink4)
                            .frame(width: 6, height: 6)
                            .shadow(color: connection.state == .connected ? DeckPalette.accent.opacity(0.7) : .clear, radius: 5)
                        Text(selectedDeck.displayName.uppercased())
                            .deckMono(11, weight: .semibold)
                            .tracking(1.6)
                            .foregroundStyle(DeckPalette.ink)
                            .lineLimit(1)
                    }
                }
                .buttonStyle(DeckPressButtonStyle())

                Spacer(minLength: 6)

                Button { showingAppearance = true } label: {
                    Text(selectedSurface.name.uppercased())
                        .deckMono(8, weight: .semibold)
                        .tracking(1)
                        .foregroundStyle(DeckPalette.ink2)
                        .padding(.horizontal, 9)
                        .frame(height: 28)
                        .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 6))
                        .overlay { RoundedRectangle(cornerRadius: 6).stroke(DeckPalette.lineSoft) }
                }
                .buttonStyle(DeckPressButtonStyle())
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 10)
            .overlay(alignment: .bottom) { Rectangle().fill(DeckPalette.lineSoft).frame(height: 1) }

            VStack(spacing: 12) {
                ProgressView()
                    .controlSize(.large)
                    .tint(DeckPalette.accent)
                Text(connection.localStatus ?? "OPENING NATIVE LINK")
                    .deckMono(11, weight: .semibold)
                    .tracking(1.4)
                    .foregroundStyle(DeckPalette.ink2)
                Text("Waiting for the first runtime snapshot from this Mac.")
                    .deckMono(9)
                    .foregroundStyle(DeckPalette.ink3)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(14)
        .background { DeckPlateBackground(cornerRadius: 12) }
        .overlay { PlateFasteners() }
    }
}

struct KeypadPanel: View {
    @ObservedObject var connection: DeckConnection
    @ObservedObject var voice: DeckVoice
    let snapshot: DeckSnapshot
    let surface: DeckSurfaceID
    var compact = false
    let showLaneSetup: () -> Void
    let showAppearance: () -> Void
    let showCompanion: () -> Void
    var showActivity: (() -> Void)? = nil
    @State private var volume: Double = 0.8

    private var laneCap: Int { surface == .micro ? 6 : 9 }
    private var boundCount: Int {
        snapshot.lanes.prefix(laneCap).filter(\.isAssigned).count
    }

    var body: some View {
        VStack(spacing: compact ? 7 : 9) {
            // No title band. Host and settings ride as a thin strip at the top
            // of the plate rather than occupying a row of their own, so the
            // lane list starts immediately instead of after 50pt of chrome
            // holding two controls.
            panelHeader
                .padding(.bottom, compact ? -3 : -4)

            // Micro Deck drops the instrument bar entirely. The two dials are
            // decorative -- HardwareKnob and SpeakerGrille have no action -- and
            // they were spending a full-width band to frame a single slider.
            // Volume moves into the console, where it costs one row instead.
            if surface != .micro {
            HStack(spacing: compact ? 9 : 14) {
                HardwareKnob(diameter: compact ? 36 : 44)

                VStack(spacing: 5) {
                    HStack {
                        Text("NARRATION")
                            .deckMono(8.5, weight: .medium)
                            .tracking(1.4)
                            .foregroundStyle(DeckPalette.ink2)
                            .lineLimit(1)
                        Spacer()
                        Text("\(Int(volume * 100))%")
                            .deckMono(8.5, weight: .semibold)
                            .foregroundStyle(DeckPalette.accent)
                    }
                    Slider(value: $volume, in: 0...1) { editing in
                        if !editing { connection.setVolume(volume) }
                    }
                    .tint(DeckPalette.accent)
                    .controlSize(.small)
                    Text("NATIVE AUDIO ENGINE")
                        .deckMono(7.5, weight: .medium)
                        .tracking(1.2)
                        .foregroundStyle(DeckPalette.ink3)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                SpeakerGrille(diameter: compact ? 36 : 44)
            }
            .padding(.horizontal, 4)
            }

            GeometryReader { geometry in
                NativeLaneSurface(
                    surface: surface,
                    connection: connection,
                    voice: voice,
                    snapshot: snapshot,
                    size: geometry.size,
                    compact: compact,
                    showLaneSetup: showLaneSetup,
                    showActivity: showActivity
                )
            }

            // Micro Deck carries its own Hold to Speak, transport, and lane
            // keys on the programmable pad, so the shared footer would be a
            // second copy of controls the operator already has under a thumb.
            if surface != .micro {
                HStack(spacing: compact ? 8 : 12) {
                    if !compact { HardwareKnob(diameter: 48, dark: true) }
                    HoldToSpeakButton(
                        phase: voice.phase,
                        lane: snapshot.lane,
                        compact: compact,
                        onPress: voice.pttBegan,
                        onRelease: voice.pttEnded,
                        onCancel: voice.pttCancelled
                    )
                    VStack(spacing: 6) {
                        CompactDeckButton("LANES", action: showLaneSetup)
                        CompactDeckButton("STOP", action: stopEverything)
                    }
                    .frame(width: compact ? 64 : 76)
                }
                .frame(height: compact ? 62 : 68)
            }

            // Every one of these six is bindable on the pad, so on Micro Deck
            // the strip is a duplicate of keys already under the operator's
            // thumb. Other surfaces have no pad and still need it.
            if surface != .micro {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: compact ? 3 : 6), spacing: 7) {
                    CompactDeckButton(compact ? "ACTIVITY" : "OVERVIEW") {
                        if compact, let showActivity {
                            showActivity()
                        } else {
                            connection.selectLane(9)
                        }
                    }
                    CompactDeckButton("SET LANES", action: showLaneSetup)
                    CompactDeckButton("CANCEL", action: stopEverything)
                    CompactDeckButton("REPLAY", action: connection.replay)
                    CompactDeckButton(snapshot.autoplay ? "AUTO ON" : "AUTO OFF", action: connection.toggleAutoplay)
                    CompactDeckButton(speedLabel, action: connection.cycleSpeed)
                }
                .frame(height: compact ? 70 : 38)
            }
        }
        .padding(compact ? 10 : 12)
        .background { DeckPlateBackground(cornerRadius: 12) }
        .overlay { PlateFasteners() }
        .onAppear { volume = snapshot.vol }
        .onChange(of: snapshot.vol) { _, next in volume = next }
        .sensoryFeedback(.selection, trigger: snapshot.lane)
    }

    /// Host identity on the left; connection, surface, and lanes as deck-local
    /// chrome on the right. No second title bar above the plate.
    private var panelHeader: some View {
        HStack(spacing: compact ? 6 : 8) {
            SpeakEasyMark(size: compact ? 14 : 15)
            Text("DECK")
                .deckMono(compact ? 8.5 : 9, weight: .semibold)
                .tracking(compact ? 1.2 : 1.5)
                .foregroundStyle(DeckPalette.ink)
            Rectangle()
                .fill(DeckPalette.lineSoft)
                .frame(width: 1, height: compact ? 14 : 15)

            Button(action: showCompanion) {
                HStack(spacing: 7) {
                    Circle()
                        .fill(connection.state == .connected ? DeckPalette.accent : DeckPalette.ink4)
                        .frame(width: 6, height: 6)
                        .shadow(color: connection.state == .connected ? DeckPalette.accent.opacity(0.65) : .clear, radius: 4)
                    Text(snapshot.host.uppercased())
                        .deckMono(compact ? 8.5 : 9, weight: .semibold)
                        .tracking(compact ? 1.2 : 1.5)
                        .foregroundStyle(DeckPalette.ink3)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    if voice.undelivered > 0 || voice.heldAudio > 0 {
                        Text("· \(voice.undelivered + voice.heldAudio)")
                            .deckMono(7.5, weight: .semibold)
                            .tracking(0.8)
                            .foregroundStyle(DeckPalette.accent)
                            .lineLimit(1)
                    }
                }
            }
            .buttonStyle(DeckPressButtonStyle())
            .accessibilityLabel("\(snapshot.host), \(connection.state.label)")

            Spacer(minLength: 4)

            // One control, and a glyph rather than a word.
            //
            // Faders, not a gear: every mark on this surface is drawn from the
            // same instrument vocabulary as the key bank, and three faders read
            // as "adjust this panel" in that language. A gear would be the only
            // piece of desktop-software iconography on the plate.
            Button(action: showAppearance) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: compact ? 10.5 : 11.5, weight: .medium))
                    .foregroundStyle(DeckPalette.ink3)
                    .frame(width: compact ? 22 : 24, height: compact ? 22 : 24)
                    .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 5))
                    .overlay { RoundedRectangle(cornerRadius: 5).stroke(DeckPalette.line) }
            }
            .buttonStyle(DeckPressButtonStyle())
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, 2)
        .padding(.bottom, compact ? 7 : 8)
        .overlay(alignment: .bottom) { Rectangle().fill(DeckPalette.lineSoft).frame(height: 1) }
    }

    private var speedLabel: String { DeckPlaybackSpeeds.label(at: snapshot.speedIx) }

    /// Silence narration and abandon a hold in progress. Transcripts already
    /// captured are the operator's words and survive this button.
    private func stopEverything() {
        voice.stopCapture()
        connection.stop()
    }
}

/// Console plate: quiet top-lit panel with a hard rim. Tokens only.
private struct DeckPlateBackground: View {
    var cornerRadius: CGFloat = 12

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        shape
            .fill(
                LinearGradient(
                    colors: [
                        DeckPalette.plateTop,
                        DeckPalette.plate,
                        DeckPalette.plateBottom,
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay {
                // Soft top catch only — enough lift without a second fill wash.
                shape
                    .fill(
                        LinearGradient(
                            colors: [
                                DeckPalette.panelHead.opacity(0.55),
                                Color.clear,
                            ],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
                    .allowsHitTesting(false)
            }
            .overlay {
                PlateGrain(cornerRadius: cornerRadius)
            }
            .overlay {
                shape.stroke(DeckPalette.line, lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.14), radius: 1.5, y: 1)
    }
}

/// Light scan grain so the plate separates from the page without reading as haze.
private struct PlateGrain: View {
    var cornerRadius: CGFloat = 12

    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 5
            var path = Path()
            for y in stride(from: 0.0, through: size.height, by: step) {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
            }
            context.stroke(path, with: .color(DeckPalette.lineSoft.opacity(0.22)), lineWidth: 0.5)
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .allowsHitTesting(false)
    }
}

private struct CompactLaneActivityView: View {
    @Environment(\.dismiss) private var dismiss
    let controller: DeckLaneViewerController

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LANE ACTIVITY")
                        .deckMono(11, weight: .semibold)
                        .tracking(1.5)
                        .foregroundStyle(DeckPalette.ink)
                    Text("SECONDARY WEB VIEWER")
                        .deckMono(7.5, weight: .medium)
                        .tracking(1.1)
                        .foregroundStyle(DeckPalette.ink3)
                }

                Spacer()

                Button { dismiss() } label: {
                    Label("KEYPAD", systemImage: "chevron.backward")
                        .deckMono(8.5, weight: .semibold)
                        .tracking(0.9)
                        .foregroundStyle(DeckPalette.accent)
                        .lineLimit(1)
                        .padding(.horizontal, 12)
                        .frame(height: 36)
                        .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 8))
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.accentEdge) }
                }
                .buttonStyle(DeckPressButtonStyle())
            }
            .padding(.horizontal, 4)

            DeckLaneWebView(controller: controller)
                .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 9))
                .clipShape(RoundedRectangle(cornerRadius: 9))
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(DeckPalette.page.ignoresSafeArea())
    }
}

struct NativeLaneSurface: View {
    let surface: DeckSurfaceID
    @ObservedObject var connection: DeckConnection
    @ObservedObject var voice: DeckVoice
    let snapshot: DeckSnapshot
    let size: CGSize
    let compact: Bool
    var showLaneSetup: (() -> Void)?
    var showActivity: (() -> Void)?

    /// Micro Deck owns a programmable key bank. It lives here rather than in
    /// KeypadPanel so the store is created once per surface, not per snapshot.
    @StateObject private var padStore = DeckPadStore()
    /// Local turn lifecycle walkthrough — no Codex, no network.
    @StateObject private var turnDemo = DeckTurnDemo()
    @State private var microVolume: Double = 0.8
    /// Where the thumb is during a scrub. Owned by the surface because the
    /// timeline and the clock that reads it now live in two different panels.
    @State private var scrubTarget: Double?

    private var lanes: [(offset: Int, element: DeckLaneInfo)] {
        Array(snapshot.lanes.prefix(9).enumerated())
    }

    private var flightLanes: [(offset: Int, element: DeckLaneInfo)] {
        Array(snapshot.lanes.prefix(6).enumerated())
    }

    /// Resolved against the snapshot, not against the list this surface happens
    /// to draw.
    ///
    /// `lanes` is `prefix(9)` — the nine worker lanes. The runtime has ten: the
    /// tenth, index 9, is the deck-owned overview officer, and it is reachable
    /// from the pad's OVERVIEW and DIGEST keys. Looking the active lane up in
    /// the truncated list meant index 9 never matched, so it fell through to
    /// `?? lanes.first` and the console quietly showed **lane 01** instead.
    ///
    /// Both keys worked the whole time — the runtime switched, the overview
    /// officer answered — and neither could be seen doing it. A fallback that
    /// silently substitutes a different lane's identity is worse than no
    /// fallback: it makes a working feature look broken and, worse, attributes
    /// one lane's reply to another. So resolve against `snapshot.lanes`, which
    /// is the authority on how many lanes exist.
    private var active: (offset: Int, element: DeckLaneInfo)? {
        guard snapshot.lanes.indices.contains(snapshot.lane) else { return lanes.first }
        return (snapshot.lane, snapshot.lanes[snapshot.lane])
    }

    @ViewBuilder
    var body: some View {
        switch surface {
        case .console:
            consoleSurface
        case .cluster:
            clusterSurface
        case .flightDeck:
            flightDeckSurface
        case .checklist:
            checklistSurface
        case .pfd:
            pfdSurface
        case .micro:
            microSurface
        }
    }

    /// Left column is the hand: lane picker on top, key bank pinned under it.
    /// Right column is the eye: the console readout, which never needs a touch.
    ///
    /// The pad is a fixed height rather than a proportion. Four rows at roughly
    /// 200 pt lands each key near 45 pt -- comfortably past the 44 pt touch
    /// minimum while keeping the whole bank inside one thumb arc. Scaling it
    /// with the panel is what made the earlier version require moving your hand
    /// across the bank to reach a corner key.
    /// Shared so the audio instrument can match one pad row exactly.
    private var padBankHeight: CGFloat {
        max(compact ? 190 : 240, size.height * padStore.placement.padFraction)
    }

    /// Same inter-row gap the pad bank uses — shared so the player can land on
    /// that grid without estimating.
    private var padRowGap: CGFloat { compact ? 5 : 7 }

    /// Pure key-face height of one pad row (gap not included).
    private var padRowHeight: CGFloat {
        (padBankHeight - padRowGap * 3) / 4
    }

    /// Bottom two pad rows including the single gap between them.
    private var twoRowHeight: CGFloat {
        DeckPlayerConsole.height(rowUnit: padRowHeight, rowGap: padRowGap)
    }

    /// Vertical gap between the flex upper region and the fixed bottom block
    /// in each column. Shared so both columns share one vertical rhythm.
    private var columnStackGap: CGFloat { compact ? 8 : 10 }

    private var microSurface: some View {
        let placement = padStore.placement
        let handWidth: CGFloat? = compact ? nil : min(size.width * placement.columnFraction, 640)
        return HStack(alignment: .top, spacing: compact ? 8 : 12) {
            if !compact && placement.side == .right {
                microConsole
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }

            handColumn
                .frame(maxHeight: .infinity, alignment: .bottom)
                .frame(width: handWidth)

            if !compact && placement.side == .left {
                microConsole
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
        }
    }

    private var handColumn: some View {
        // Pad is a fixed block on the shared grid. Lane picker takes leftover
        // above (or below) so the pad's bottom edge is a true baseline when
        // the picker sits on top — which is what the player column matches.
        let pad = DeckPadView(
            connection: connection,
            voice: voice,
            store: padStore,
            snapshot: snapshot,
            compact: compact,
            showLaneSetup: { showLaneSetup?() },
            showActivity: showActivity
        )
        .frame(height: padBankHeight)

        return VStack(spacing: columnStackGap) {
            if padStore.placement.pickerEdge == .top {
                lanePicker.frame(maxWidth: .infinity, maxHeight: .infinity)
                pad
            } else {
                pad
                lanePicker.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxHeight: .infinity)
    }

    /// Scrollable because nine rows will not always fit above a fixed pad on
    /// every device height, and silently clipping lanes would be worse than a
    /// scroll the operator can feel.
    /// Six, not nine. Nine rows squeezed the picker to the point where the task
    /// line under each lane name was the first thing to go, and the pad can
    /// bind any lane the list no longer shows.
    private var microLanes: [(offset: Int, element: DeckLaneInfo)] {
        Array(snapshot.lanes.prefix(6).enumerated())
    }

    private var lanePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            // No caption. The console opposite carries no label before it, and
            // a list of numbered lanes does not need to be told it is one.

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 6) {
                    ForEach(microLanes, id: \.offset) { item in
                        CompactLaneRow(
                            index: item.offset,
                            lane: item.element,
                            selected: snapshot.lane == item.offset,
                            showsTask: true,
                            lastTurn: snapshot.lastAgentMessage(in: item.offset)?.text
                        ) {
                            connection.selectLane(item.offset)
                        }
                    }
                }
            }
        }
    }

    private var microConsole: some View {
        let livePhase = turnDemo.isRunning ? turnDemo.phase : voice.phase
        let liveLevel = turnDemo.isRunning ? turnDemo.inputLevel : voice.inputLevel
        let liveDeckPhase = turnDemo.isRunning ? turnDemo.deckPhase : snapshot.phase
        let livePlayback = turnDemo.isRunning ? turnDemo.playback : playbackState
        let liveMeter = turnDemo.isRunning ? turnDemo.meter : connection.meter
        let realMessages: [DeckMessage] = snapshot.threads.indices.contains(snapshot.lane)
            ? snapshot.threads[snapshot.lane] : []
        // Demo owns the well while it runs, and after settle only if this lane
        // has no real thread yet — never permanently mask live Codex turns.
        let liveMessages: [DeckMessage] = {
            if turnDemo.isRunning { return turnDemo.messages }
            if !turnDemo.messages.isEmpty, realMessages.isEmpty { return turnDemo.messages }
            return realMessages
        }()
        let liveReply: DeckLastReply? = {
            if let last = (turnDemo.isRunning || realMessages.isEmpty
                           ? turnDemo.messages
                           : []).last(where: { $0.role == "agent" }) {
                return DeckLastReply(duration: last.dur, playable: last.file != nil, text: last.text)
            }
            return lastReply
        }()

        // One surface: identity + exchange (panel texture) over the player
        // foot (plate texture). No gap, no second rounded card — the player is
        // the counterpart band to the numeral header. Height still lands on the
        // pad's two-row baseline so the hand column and eye column share a grid.
        let laneShape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        return VStack(spacing: 0) {
            if let active {
                ActiveLaneInstrument(
                    index: active.offset,
                    lane: active.element,
                    messages: liveMessages,
                    snippet: liveMessages.last(where: { $0.role == "agent" })?.text
                        ?? snapshot.lastAgentMessage(in: active.offset)?.text,
                    phase: livePhase,
                    inputLevel: liveLevel,
                    playback: livePlayback,
                    meter: liveMeter,
                    scrubTarget: $scrubTarget,
                    onSeek: { connection.seek(to: $0) },
                    onPlayMessage: { connection.togglePlayback(lane: active.offset, message: $0) },
                    showsRadio: false,
                    ownsChrome: false
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background {
                    LinearGradient(
                        colors: [DeckPalette.panelHead, DeckPalette.panel, DeckPalette.trace],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            } else {
                Color.clear.frame(maxHeight: .infinity)
            }

            DeckPlayerConsole(
                phase: livePhase,
                inputLevel: liveLevel,
                deckPhase: liveDeckPhase,
                undelivered: turnDemo.isRunning ? 0 : voice.undelivered,
                heldAudio: turnDemo.isRunning ? 0 : voice.heldAudio,
                lane: snapshot.lane,
                playback: livePlayback,
                lastReply: liveReply,
                meter: liveMeter,
                rowUnit: padRowHeight,
                rowGap: padRowGap,
                embedded: true,
                volume: $microVolume,
                scrubTarget: $scrubTarget,
                onVolumeCommit: { connection.setVolume($0) },
                onTogglePlayPause: connection.togglePlayPause,
                onPlayLast: connection.replay,
                onCycleSpeed: connection.cycleSpeed,
                onToggleAutoplay: connection.toggleAutoplay,
                onSeek: { connection.seek(to: $0) }
            )
            .frame(height: twoRowHeight)
        }
        .frame(maxHeight: .infinity)
        .clipShape(laneShape)
        .overlay {
            laneShape.strokeBorder(
                (livePhase == .recording || (livePlayback.isPlaying && !livePlayback.paused))
                    ? DeckPalette.accent.opacity(0.38)
                    : DeckPalette.line,
                lineWidth: 1
            )
        }
        .onAppear { microVolume = snapshot.vol }
        .onChange(of: snapshot.vol) { _, next in microVolume = next }
    }

    /// What the audio bar's PLAY key acts on when nothing is playing.
    /// `playback.replay` on the runtime only succeeds for a file-backed agent
    /// reply, so `playable` mirrors that condition rather than merely "there is
    /// a last message".
    private var lastReply: DeckLastReply? {
        guard let message = snapshot.lastAgentMessage(in: snapshot.lane) else { return nil }
        return DeckLastReply(duration: message.dur, playable: message.file != nil, text: message.text)
    }

    private var playbackState: DeckPlaybackState {
        guard let id = snapshot.playing else {
            return DeckPlaybackState(speedIndex: snapshot.speedIx, autoplay: snapshot.autoplay)
        }
        let message = snapshot.message(id: id)
        return DeckPlaybackState(
            id: id,
            paused: snapshot.paused,
            position: snapshot.pos,
            duration: message?.dur ?? 0,
            speedIndex: snapshot.speedIx,
            autoplay: snapshot.autoplay,
            text: message?.text
        )
    }

    private var consoleSurface: some View {
        HStack(spacing: 10) {
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 5) {
                    ForEach(lanes, id: \.offset) { item in
                        CompactLaneRow(index: item.offset, lane: item.element, selected: snapshot.lane == item.offset) {
                            connection.selectLane(item.offset)
                        }
                    }
                }
            }
            .frame(width: size.width * 0.43)

            if let active {
                ActiveLaneInstrument(
                    index: active.offset,
                    lane: active.element,
                    snippet: snapshot.lastAgentMessage(in: active.offset)?.text,
                    phase: voice.phase,
                    inputLevel: voice.inputLevel
                )
            }
        }
    }

    private var clusterSurface: some View {
        VStack(spacing: 9) {
            if let active {
                ActiveLaneInstrument(
                    index: active.offset,
                    lane: active.element,
                    snippet: snapshot.lastAgentMessage(in: active.offset)?.text,
                    phase: voice.phase,
                    inputLevel: voice.inputLevel,
                    circular: true
                )
            }
            compactGrid
                .frame(height: min(96, size.height * 0.28))
        }
    }

    @ViewBuilder
    private var flightDeckSurface: some View {
        if compact {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 8) {
                    ForEach(flightLanes, id: \.offset) { item in
                        flightStrip(item)
                            .frame(width: 108)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
        } else {
            HStack(spacing: 7) {
                ForEach(flightLanes, id: \.offset) { item in
                    flightStrip(item)
                }
            }
        }
    }

    private func flightStrip(_ item: (offset: Int, element: DeckLaneInfo)) -> some View {
        FlightChannelStrip(
            index: item.offset,
            lane: item.element,
            selected: snapshot.lane == item.offset,
            active: snapshot.playing?.hasPrefix("\(item.offset):") == true || item.element.state == .working
        ) {
            connection.selectLane(item.offset)
        }
    }

    private var checklistSurface: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: 5) {
                ForEach(lanes, id: \.offset) { item in
                    CompactLaneRow(
                        index: item.offset,
                        lane: item.element,
                        selected: snapshot.lane == item.offset,
                        showsTask: true
                    ) {
                        connection.selectLane(item.offset)
                    }
                }
            }
        }
    }

    private var pfdSurface: some View {
        VStack(spacing: 8) {
            if let active {
                ActiveLaneInstrument(
                    index: active.offset,
                    lane: active.element,
                    snippet: snapshot.lastAgentMessage(in: active.offset)?.text,
                    phase: voice.phase,
                    inputLevel: voice.inputLevel,
                    glass: true
                )
            }
            compactGrid.frame(height: min(100, size.height * 0.3))
        }
    }

    private var compactGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 3), spacing: 5) {
            ForEach(lanes, id: \.offset) { item in
                Button { connection.selectLane(item.offset) } label: {
                    HStack(spacing: 5) {
                        Text(String(format: "%02d", item.offset + 1)).deckMono(8.5, weight: .semibold)
                        Text(item.element.name.uppercased()).deckMono(7.5).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(snapshot.lane == item.offset ? DeckPalette.accent : DeckPalette.ink2)
                    .padding(.horizontal, 7)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(snapshot.lane == item.offset ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 5))
                    .overlay { RoundedRectangle(cornerRadius: 5).stroke(snapshot.lane == item.offset ? DeckPalette.accent : DeckPalette.line) }
                }
                .buttonStyle(DeckPressButtonStyle())
            }
        }
    }

    private func fullLaneKey(_ item: (offset: Int, element: DeckLaneInfo)) -> some View {
        LaneKey(
            index: item.offset,
            lane: item.element,
            selected: snapshot.lane == item.offset,
            playing: snapshot.playing?.hasPrefix("\(item.offset):") == true,
            snippet: snapshot.lastAgentMessage(in: item.offset)?.text,
            voiceReactive: voice.phase == .recording && snapshot.lane == item.offset,
            inputLevel: snapshot.lane == item.offset ? voice.inputLevel : 0
        ) {
            connection.selectLane(item.offset)
        }
    }
}

struct CompactLaneRow: View {
    let index: Int
    let lane: DeckLaneInfo
    let selected: Bool
    var showsTask = false
    /// The most recent thing said in this lane. Used as the summary when the
    /// title is empty or identical to the project name.
    var lastTurn: String? = nil
    let action: () -> Void

    private var isEmpty: Bool { !lane.isAssigned }
    private var isWorking: Bool { lane.state == .working }
    private var isSpeaking: Bool { lane.state == .speaking }

    /// Ownership badge — not the thread id. A deck thread has no codex id until
    /// its first turn answers, and it is fully speakable before then.
    private var badge: String {
        if isEmpty { return "EMPTY" }
        if selected { return "ACTIVE" }
        if lane.isNewDeckThread { return "NEW" }
        return "ARMED"
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: showsTask ? .center : .top, spacing: showsTask ? 12 : 9) {
                // Rank mark. Large enough to scan as a column of addresses, not
                // a caption next to the title. Fixed width keeps the text gutters
                // aligned even when the active numeral is bold.
                Text(String(format: "%02d", index + 1))
                    .deckMono(showsTask ? 20 : 11, weight: selected ? .bold : .semibold)
                    .foregroundStyle(numberColour)
                    .frame(width: showsTask ? 36 : 24, alignment: .leading)

                if showsTask {
                    taskBody
                } else {
                    Text(lane.name.uppercased())
                        .deckMono(9.5, weight: selected ? .semibold : .medium)
                        .foregroundStyle(nameColour)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }

                Spacer(minLength: 6)

                // Bare label. Colour alone carries state — no second capsule.
                Text(badge)
                    .deckMono(6.5, weight: .bold)
                    .tracking(1.1)
                    .foregroundStyle(badgeColour)
            }
            .padding(.horizontal, showsTask ? 12 : 10)
            .padding(.vertical, showsTask ? 11 : 9)
            .frame(maxWidth: .infinity, minHeight: showsTask ? 58 : 30, alignment: .leading)
            .background { rowBackground }
            .overlay { rowChrome }
        }
        .buttonStyle(DeckPressButtonStyle())
    }

    /// Project + metadata on the first line, work summary on the second.
    /// Identity first so the eye can find a lane by where it lives; summary
    /// second so the same glance can confirm what it is doing.
    private var taskBody: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(identityLine)
                .deckMono(8, weight: .semibold)
                .tracking(0.3)
                .foregroundStyle(selected ? DeckPalette.ink2 : DeckPalette.ink3)
                .lineLimit(1)
                .truncationMode(.middle)

            Text(summaryLine)
                .deckMono(10.5, weight: selected ? .semibold : .medium)
                .foregroundStyle(nameColour)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    /// Project, branch, and relative time — only the parts that exist.
    private var identityLine: String {
        if isEmpty { return "Unbound" }
        var parts: [String] = []
        if let project = lane.project, !project.isEmpty {
            parts.append(project)
        } else if !lane.name.isEmpty {
            parts.append(lane.name)
        }
        if let branch = lane.branch, !branch.isEmpty { parts.append(branch) }
        if let ago = Self.relative(lane.updatedAt) { parts.append(ago) }
        return parts.isEmpty ? "Standing by" : parts.joined(separator: " · ")
    }

    /// What the lane is about: title first, last agent turn as fallback.
    private var summaryLine: String {
        if isEmpty { return "No thread bound" }
        let title = lane.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty { return title }
        if let turn = flattenedTurn { return turn }
        if lane.isNewDeckThread { return "New deck thread" }
        return "Standing by"
    }

    private var flattenedTurn: String? {
        guard let raw = lastTurn else { return nil }
        let flat = raw.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return flat.isEmpty ? nil : flat
    }

    /// Coarse on purpose. A lane that answered four minutes ago and one that
    /// answered four and a half are the same lane to the operator, and a clock
    /// that ticks inside a list is motion with nothing behind it.
    static func relative(_ epochMillis: Double?) -> String? {
        guard let epochMillis, epochMillis > 0 else { return nil }
        let seconds = Date().timeIntervalSince1970 - epochMillis / 1000
        guard seconds >= 0 else { return nil }
        switch seconds {
        case ..<90: return "just now"
        case ..<3600: return "\(Int(seconds / 60))m ago"
        case ..<86_400: return "\(Int(seconds / 3600))h ago"
        default: return "\(Int(seconds / 86_400))d ago"
        }
    }

    private var numberColour: Color {
        if selected { return DeckPalette.accent }
        if isEmpty { return DeckPalette.ink4 }
        return DeckPalette.ink2
    }

    private var nameColour: Color {
        if selected { return DeckPalette.ink }
        if isEmpty { return DeckPalette.ink4 }
        return DeckPalette.ink
    }

    private var badgeColour: Color {
        if selected { return DeckPalette.accent }
        if isWorking { return DeckPalette.amber }
        if isEmpty { return DeckPalette.ink4 }
        if lane.isNewDeckThread { return DeckPalette.micTop }
        return DeckPalette.ink3
    }

    @ViewBuilder
    private var rowBackground: some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        if selected {
            // Flat accent wash — no muddy diagonal. Selection is the rim + numeral.
            shape.fill(DeckPalette.accentDark.opacity(0.88))
        } else if isEmpty {
            shape.fill(DeckPalette.trace.opacity(0.5))
        } else {
            shape.fill(DeckPalette.cell.opacity(0.92))
        }
    }

    private var rowChrome: some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        return shape.strokeBorder(
            selected ? DeckPalette.accent : (isEmpty ? DeckPalette.lineSoft.opacity(0.55) : DeckPalette.lineSoft),
            lineWidth: selected ? 1.25 : 1
        )
    }
}

struct ActiveLaneInstrument: View {
    let index: Int
    let lane: DeckLaneInfo
    /// Full lane thread — the exchange well's real content. Defaults empty so
    /// compact surfaces that only pass a snippet still compile.
    var messages: [DeckMessage] = []
    let snippet: String?
    let phase: DeckCapturePhase
    let inputLevel: Double
    var circular = false
    var glass = false
    /// The lane's live audio, on the surfaces that have a transport to go with
    /// it. Given both, the trace band draws the real envelope, the playhead and
    /// the sentence being heard; without them it stays the idle readout, which is
    /// all the surfaces with no player can honestly show.
    var playback: DeckPlaybackState?
    var meter: DeckPlaybackMeter?
    var scrubTarget: Binding<Double?> = .constant(nil)
    var onSeek: (Double) -> Void = { _ in }
    /// Replay a specific file-backed message by index in this lane's thread.
    /// Nil on surfaces that have no transport; the row still draws, it just
    /// is not a button.
    var onPlayMessage: ((Int) -> Void)? = nil
    /// Micro Deck draws the radio inside `DeckPlayerConsole` under this panel.
    /// Other surfaces still want the legacy in-panel bay.
    var showsRadio: Bool = true
    /// When false, the parent owns outer fill + border (Micro fuses identity +
    /// player into one surface). Identity / exchange still draw; chrome does not.
    var ownsChrome: Bool = true
    @State private var copied = false

    private var phaseLabel: String {
        switch phase {
        case .recording: "LISTENING"
        case .transcribing: "TRANSCRIBING"
        case .arming: "ARMING"
        case .preparing: "PREPARING"
        case .held: "HELD"
        case .delivering: "SENDING"
        case .idle:
            switch lane.state {
            case .working: "WORKING"
            case .speaking: "SPEAKING"
            case .empty: "UNBOUND"
            case .idle: "ACTIVE LANE"
            }
        }
    }

    private var phaseColour: Color {
        switch phase {
        case .recording, .transcribing: DeckPalette.accent
        case .held, .delivering, .arming, .preparing: DeckPalette.amber
        case .idle:
            lane.state == .working ? DeckPalette.amber
                : lane.state == .speaking ? DeckPalette.accent
                : DeckPalette.accentDim
        }
    }

    var body: some View {
        Group {
            if circular || glass {
                legacyCenteredBody
            } else {
                instrumentBody
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { instrumentShellFill }
        .overlay { instrumentShellStroke }
        // No drop shadow on the panel. A black blur under a panel reads as
        // depth on a dark plate and as haze on a light one; the panel already
        // separates from the plate by fill and by its own border.
        .shadow(color: .clear, radius: 0)
    }

    @ViewBuilder
    private var instrumentShellFill: some View {
        if ownsChrome { instrumentBackground }
    }

    @ViewBuilder
    private var instrumentShellStroke: some View {
        if ownsChrome { instrumentChrome }
    }

    // Shared column rail — identity numeral, ledger roles, and the player ring
    // all sit here so project name / turn body / TURN title share one left edge.
    private var laneEdgePad: CGFloat { 14 }
    private var laneGutter: CGFloat { 50 }
    private var laneColumnGap: CGFloat { 12 }

    /// Micro / console instrument: identity, ledger turns, optional radio.
    private var instrumentBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Numeral in the gutter; project / phase on the text rail.
            HStack(alignment: .center, spacing: laneColumnGap) {
                Text(String(format: "%02d", index + 1))
                    .font(.system(size: 28, weight: .semibold, design: .monospaced))
                    .foregroundStyle(DeckPalette.accent)
                    .frame(width: laneGutter, alignment: .leading)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(projectLabel)
                            .deckMono(10.5, weight: .semibold)
                            .tracking(1.0)
                            .foregroundStyle(DeckPalette.ink)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 6)
                        Circle()
                            .fill(phaseColour)
                            .frame(width: 5, height: 5)
                        Text(phaseLabel)
                            .deckMono(7, weight: .bold)
                            .tracking(1.3)
                            .foregroundStyle(phaseColour)
                            .lineLimit(1)
                    }

                    HStack(spacing: 7) {
                        if let branch = lane.branch, !branch.isEmpty {
                            Text(branch)
                                .deckMono(7.5, weight: .medium)
                                .foregroundStyle(DeckPalette.ink3)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        sessionRow
                        Spacer(minLength: 0)
                    }
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, laneEdgePad)
            .padding(.top, 12)
            .padding(.bottom, 10)
            .overlay(alignment: .bottom) {
                Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
            }

            // Ledger turn stream — same plate, same rail as identity.
            exchangeField
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if showsRadio {
                Group {
                    if let playback, let meter {
                        DeckLaneTrace(
                            phase: phase,
                            inputLevel: inputLevel,
                            playback: playback,
                            meter: meter,
                            scrubTarget: scrubTarget,
                            onSeek: onSeek
                        )
                    } else {
                        legacyTrace
                            .frame(height: DeckLaneTrace.bayHeight)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .padding(.bottom, 10)
            }
        }
    }

    /// Ledger of turns. Role sits in the lane-number gutter; body text starts
    /// on the same edge as the project name (and the player TURN title).
    ///
    /// Tapping a file-backed agent turn replays *that* turn. PLAY on the
    /// transport still means last-in-lane.
    private var exchangeField: some View {
        Group {
            if messages.isEmpty {
                Text(exchangeText)
                    .deckMono(9)
                    .lineSpacing(3.5)
                    .foregroundStyle(DeckPalette.ink3)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    // Empty prompt lives on the text rail, under the project name.
                    .padding(.leading, laneEdgePad + laneGutter + laneColumnGap)
                    .padding(.trailing, laneEdgePad)
                    .padding(.top, 12)
                    .padding(.bottom, 10)
            } else {
                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        LazyVStack(alignment: .leading, spacing: 8) {
                            ForEach(Array(messages.enumerated()), id: \.offset) { messageIndex, message in
                                exchangeRow(index: messageIndex, message: message)
                                    .id(messageIndex)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, laneEdgePad)
                        .padding(.top, 10)
                        .padding(.bottom, 12)
                    }
                    .onAppear { scrollExchangeToEnd(proxy) }
                    .onChange(of: messages.count) { _, _ in scrollExchangeToEnd(proxy) }
                    .onChange(of: playback?.id) { _, _ in
                        if let id = playback?.id,
                           let messageIndex = Int(id.split(separator: ":").last ?? ""),
                           messages.indices.contains(messageIndex) {
                            withAnimation(.easeOut(duration: 0.2)) {
                                proxy.scrollTo(messageIndex, anchor: .bottom)
                            }
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.clear)
    }

    private func scrollExchangeToEnd(_ proxy: ScrollViewProxy) {
        guard let last = messages.indices.last else { return }
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.15)) {
                proxy.scrollTo(last, anchor: .bottom)
            }
        }
    }

    @ViewBuilder
    private func exchangeRow(index messageIndex: Int, message: DeckMessage) -> some View {
        let isYou = message.role == "you"
        let playable = message.file != nil
        let playing = isMessagePlaying(messageIndex)
        // Ledger line: role in the numeral gutter · body on the text rail.
        let row = HStack(alignment: .top, spacing: laneColumnGap) {
            VStack(alignment: .leading, spacing: 2) {
                Text(isYou ? "YOU" : "AGENT")
                    .deckMono(6.5, weight: .bold)
                    .tracking(0.9)
                    .foregroundStyle(playing ? DeckPalette.accent : DeckPalette.ink4)
                if playable, playing {
                    Image(systemName: playback?.paused == true ? "pause.fill" : "speaker.wave.2.fill")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(DeckPalette.accent)
                        .accessibilityHidden(true)
                }
            }
            .frame(width: laneGutter, alignment: .leading)

            Text(message.text)
                .deckMono(9)
                .lineSpacing(2.5)
                .foregroundStyle(playing ? DeckPalette.ink : DeckPalette.ink2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) {
            // Rank mark in the gutter — only while this turn is under the playhead.
            Rectangle()
                .fill(playing ? DeckPalette.accent : .clear)
                .frame(width: 1)
        }
        .contentShape(Rectangle())

        if playable, let onPlayMessage {
            Button {
                onPlayMessage(messageIndex)
            } label: {
                row.contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(playing ? "Pause message" : "Play message")
            .accessibilityHint(isYou ? "Your turn" : "Agent reply")
        } else {
            row
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(isYou ? "You" : "Agent"): \(message.text)")
        }
    }

    private func isMessagePlaying(_ messageIndex: Int) -> Bool {
        playback?.id == "\(index):\(messageIndex)"
    }

    /// Surfaces with no transport of their own. Same reserved bay height as the
    /// live radio so the panel geometry never depends on which surface drew it.
    private var legacyTrace: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(phase == .recording ? "LISTENING" : "")
                    .deckMono(6, weight: .semibold)
                    .tracking(1.1)
                    .foregroundStyle(phase == .recording ? DeckPalette.accent : DeckPalette.ink4)
                Spacer()
                Text("—:—")
                    .deckMono(6.5, weight: .medium)
                    .foregroundStyle(DeckPalette.ink4.opacity(0.45))
            }
            Group {
                if phase == .recording {
                    LaneSparkline(
                        seed: lane.name,
                        active: true,
                        voiceReactive: true,
                        inputLevel: inputLevel
                    )
                    .foregroundStyle(DeckPalette.accent)
                } else {
                    LaneIdleReadout()
                }
            }
            .frame(height: 32)
            .frame(maxWidth: .infinity)
            Capsule()
                .fill(DeckPalette.line)
                .frame(height: 3)
                .opacity(0.35)
            Text("NOTHING TO PLAY")
                .deckMono(8.5)
                .foregroundStyle(DeckPalette.ink4)
                .opacity(0.55)
                .frame(maxWidth: .infinity, minHeight: 28, alignment: .topLeading)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(
            DeckPalette.trace,
            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(DeckPalette.line, lineWidth: 1)
        }
    }

    /// Cluster / PFD keep the centred readout — different surfaces, different
    /// space budget, not a second Micro console.
    private var legacyCenteredBody: some View {
        VStack(spacing: circular ? 8 : 12) {
            Text(phaseLabel)
                .deckMono(7.5, weight: .semibold)
                .tracking(1.8)
                .foregroundStyle(phaseColour)
            Text(String(format: "%02d", index + 1))
                .font(.system(size: circular ? 38 : 30, weight: .semibold, design: .monospaced))
                .foregroundStyle(DeckPalette.accent)
            Text(lane.name.uppercased())
                .deckMono(12, weight: .semibold)
                .tracking(1.3)
                .foregroundStyle(DeckPalette.ink)
                .lineLimit(1)
            LaneSparkline(seed: lane.name, active: lane.state != .idle, voiceReactive: phase == .recording, inputLevel: inputLevel)
                .foregroundStyle(DeckPalette.accent)
                .frame(height: 24)
                .padding(.horizontal, 16)
            Text(exchangeText)
                .deckMono(8.5)
                .lineSpacing(3)
                .foregroundStyle(DeckPalette.ink3)
                .lineLimit(3)
                .multilineTextAlignment(.center)
        }
        .padding(14)
    }

    /// Session identity plus the lifecycle actions worth a tap from here.
    /// Tapping the id copies the FULL codex thread id, not the short alias —
    /// the alias is for reading, the full id is what other tools need.
    @ViewBuilder
    private var sessionRow: some View {
        HStack(spacing: 6) {
            if let threadID = lane.threadId, !threadID.isEmpty {
                Button {
                    UIPasteboard.general.string = threadID
                    copied = true
                    Task {
                        try? await Task.sleep(nanoseconds: 1_400_000_000)
                        copied = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 7, weight: .semibold))
                        Text(copied ? "COPIED" : (lane.sessionAlias ?? String(threadID.prefix(8))).uppercased())
                            .deckMono(7, weight: .semibold)
                            .tracking(0.8)
                    }
                    .foregroundStyle(copied ? DeckPalette.accent : DeckPalette.ink3)
                    .padding(.horizontal, 6)
                    .frame(height: 17)
                    .background(DeckPalette.trace, in: RoundedRectangle(cornerRadius: 4))
                    .overlay { RoundedRectangle(cornerRadius: 4).strokeBorder(DeckPalette.lineSoft) }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy session id")
            } else if lane.isNewDeckThread {
                Text("NO SESSION YET · SPEAK TO START")
                    .deckMono(7, weight: .medium)
                    .tracking(0.8)
                    .foregroundStyle(DeckPalette.micTop)
            }

            if lane.origin == "deck" {
                Text("DECK")
                    .deckMono(6.5, weight: .bold)
                    .tracking(0.9)
                    .foregroundStyle(DeckPalette.micTop)
                    .padding(.horizontal, 5)
                    .frame(height: 17)
                    .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 4))
            }
        }
    }

    /// Project alone. The branch now sits on its own line in supporting
    /// weight, so the loudest line carries only the thing that identifies
    /// which checkout the operator is talking to.
    private var projectLabel: String {
        if let project = lane.project, !project.isEmpty { return project.uppercased() }
        if let cwd = lane.cwd {
            let name = URL(fileURLWithPath: cwd).lastPathComponent
            if !name.isEmpty { return name.uppercased() }
        }
        return lane.isAssigned ? "STANDING BY" : "NO THREAD"
    }

    private var identitySubline: String {
        var parts: [String] = []
        if let project = lane.project, !project.isEmpty {
            parts.append(project)
        } else if let cwd = lane.cwd {
            let name = URL(fileURLWithPath: cwd).lastPathComponent
            if !name.isEmpty { parts.append(name) }
        }
        if let branch = lane.branch, !branch.isEmpty {
            parts.append(branch)
        }
        if parts.isEmpty {
            return lane.isAssigned ? "STANDING BY" : "NO THREAD"
        }
        return parts.joined(separator: "  ·  ").uppercased()
    }

    private var exchangeText: String {
        if let snippet, !snippet.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return snippet
        }
        let title = lane.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty { return title }
        return lane.isAssigned
            ? "No exchange yet on this lane."
            : "Bind a thread to give this lane a voice."
    }

    @ViewBuilder
    private var instrumentBackground: some View {
        let shape = RoundedRectangle(cornerRadius: circular ? 80 : 10, style: .continuous)
        if glass {
            shape.fill(DeckPalette.trace.opacity(0.78))
        } else if circular {
            shape.fill(DeckPalette.panel)
        } else {
            shape.fill(
                LinearGradient(
                    colors: [DeckPalette.panelHead, DeckPalette.panel, DeckPalette.trace],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
        }
    }

    private var instrumentChrome: some View {
        // One hard edge, full strength. A gradient stroke dissolves the
        // boundary it is supposed to draw — on Ceramic the top fades into the
        // fill and the panel loses its cut. Crispness is a 1px border.
        RoundedRectangle(cornerRadius: circular ? 80 : 10, style: .continuous)
            .strokeBorder(
                glass || circular ? DeckPalette.accentDim : DeckPalette.line,
                lineWidth: glass ? 1.5 : 1
            )
    }
}

/// Idle audio figure for the lane panel: a recessed readout, not a flat
/// sparkline. A seeded path at 0.18 amplitude across a wide span reads as a
/// graph that has stopped working; a labelled well reads as a meter at rest.
struct LaneIdleReadout: View {
    var label: String = "—"

    var body: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            Text(label)
                .deckMono(6.5, weight: .semibold)
                .tracking(1.4)
                .foregroundStyle(DeckPalette.ink4)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            DeckPalette.trace,
            in: RoundedRectangle(cornerRadius: 4, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .strokeBorder(DeckPalette.line, lineWidth: 1)
        }
        .accessibilityLabel(label)
    }
}

struct FlightChannelStrip: View {
    let index: Int
    let lane: DeckLaneInfo
    let selected: Bool
    let active: Bool
    let action: () -> Void

    private var profile: FlightMixerProfile { FlightMixerProfile.forLane(index) }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                HStack(spacing: 4) {
                    Text(String(format: "%02d", index + 1)).deckMono(10, weight: .semibold)
                    Spacer(minLength: 0)
                    Circle()
                        .fill(active ? DeckPalette.amber : selected ? DeckPalette.accent : DeckPalette.ink4)
                        .frame(width: 6, height: 6)
                        .shadow(color: active ? DeckPalette.amber.opacity(0.65) : .clear, radius: 4)
                }

                Text(lane.name.uppercased())
                    .deckMono(7.5, weight: .semibold)
                    .tracking(0.7)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)

                VStack(alignment: .leading, spacing: 2) {
                    Text("EFFORT")
                        .deckMono(5.5, weight: .semibold)
                        .tracking(0.8)
                        .foregroundStyle(DeckPalette.ink3)
                    Text(profile.effort)
                        .deckMono(7, weight: .semibold)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .foregroundStyle(selected ? DeckPalette.accent : DeckPalette.ink2)

                GeometryReader { geometry in
                    let travel = max(0, geometry.size.height - 18)
                    let faderY = travel * CGFloat(1 - profile.level)
                    ZStack(alignment: .top) {
                        VStack {
                            Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
                            Spacer()
                            Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
                            Spacer()
                            Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
                        }
                        .padding(.horizontal, 6)

                        Capsule()
                            .fill(DeckPalette.line)
                            .frame(width: 4)
                            .frame(maxWidth: .infinity)

                        Capsule()
                            .fill(selected ? DeckPalette.accent.opacity(0.34) : DeckPalette.ink4.opacity(0.4))
                            .frame(width: 4, height: max(2, geometry.size.height - faderY - 8))
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                        RoundedRectangle(cornerRadius: 3)
                            .fill(
                                LinearGradient(
                                    colors: selected ? [DeckPalette.accent, DeckPalette.accentDim] : [DeckPalette.ink2, DeckPalette.ink3],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(maxWidth: .infinity)
                            .frame(height: 18)
                            .overlay { RoundedRectangle(cornerRadius: 3).stroke(DeckPalette.line) }
                            .shadow(color: .black.opacity(0.28), radius: 2, y: 1)
                            .offset(y: faderY)
                    }
                }

                FlightModelSwitch(model: profile.model, selected: selected)
            }
            .foregroundStyle(selected ? DeckPalette.accent : DeckPalette.ink2)
            .padding(9)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(selected ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 6))
            .overlay { RoundedRectangle(cornerRadius: 6).stroke(selected ? DeckPalette.accent : DeckPalette.line) }
        }
        .buttonStyle(DeckPressButtonStyle())
        .accessibilityLabel("Lane \(index + 1), \(lane.name), \(profile.model.name), effort \(profile.effort)")
    }
}

private struct FlightModelSwitch: View {
    let model: FlightModelTier
    let selected: Bool

    var body: some View {
        VStack(spacing: 4) {
            Text("MODEL")
                .deckMono(5.2, weight: .semibold)
                .tracking(1)
                .foregroundStyle(DeckPalette.ink3)

            HStack(spacing: 0) {
                ForEach(FlightModelTier.allCases, id: \.rawValue) { tier in
                    Text(tier.shortName)
                        .deckMono(5.5, weight: .semibold)
                        .foregroundStyle(tier == model ? (selected ? DeckPalette.accent : DeckPalette.ink) : DeckPalette.ink4)
                        .frame(maxWidth: .infinity)
                }
            }

            GeometryReader { geometry in
                let inset: CGFloat = 2
                let segment = max(1, (geometry.size.width - inset * 2) / 3)
                ZStack(alignment: .leading) {
                    Capsule().fill(DeckPalette.lineSoft)
                    HStack(spacing: 0) {
                        ForEach(0..<3, id: \.self) { _ in
                            Circle().fill(DeckPalette.ink4.opacity(0.42)).frame(width: 2.5, height: 2.5).frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.horizontal, 4)

                    RoundedRectangle(cornerRadius: 3)
                        .fill(selected ? DeckPalette.accent : DeckPalette.ink2)
                        .frame(width: segment, height: geometry.size.height - inset * 2)
                        .overlay { RoundedRectangle(cornerRadius: 3).stroke(DeckPalette.line) }
                        .shadow(color: .black.opacity(0.24), radius: 1.5, y: 1)
                        .offset(x: inset + segment * CGFloat(model.detent), y: inset)
                }
            }
            .frame(height: 10)

            Text(model.name)
                .deckMono(7.5, weight: .semibold)
                .tracking(0.8)
                .foregroundStyle(selected ? DeckPalette.accent : DeckPalette.ink2)
                .lineLimit(1)
                .minimumScaleFactor(0.68)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 5)
        .padding(.vertical, 6)
        .background(DeckPalette.plate, in: RoundedRectangle(cornerRadius: 4))
        .overlay { RoundedRectangle(cornerRadius: 4).stroke(selected ? DeckPalette.accentEdge : DeckPalette.line) }
    }
}

private enum FlightModelTier: String, CaseIterable {
    case terra
    case luna
    case sol

    var name: String { rawValue.uppercased() }
    var shortName: String {
        switch self {
        case .terra: "T"
        case .luna: "L"
        case .sol: "S"
        }
    }
    var detent: Int {
        switch self {
        case .terra: 0
        case .luna: 1
        case .sol: 2
        }
    }
}

private struct FlightMixerProfile {
    let model: FlightModelTier
    let effort: String
    let level: Double

    static func forLane(_ index: Int) -> FlightMixerProfile {
        let profiles = [
            FlightMixerProfile(model: .sol, effort: "XHIGH", level: 0.86),
            FlightMixerProfile(model: .luna, effort: "HIGH", level: 0.69),
            FlightMixerProfile(model: .terra, effort: "MED", level: 0.51),
            FlightMixerProfile(model: .sol, effort: "HIGH", level: 0.72),
            FlightMixerProfile(model: .luna, effort: "MED", level: 0.50),
            FlightMixerProfile(model: .terra, effort: "LOW", level: 0.29),
        ]
        return profiles[index % profiles.count]
    }
}

struct LaneKey: View {
    @Environment(\.displayScale) private var displayScale
    let index: Int
    let lane: DeckLaneInfo
    let selected: Bool
    let playing: Bool
    let snippet: String?
    let voiceReactive: Bool
    let inputLevel: Double
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Text("\(index + 1)")
                        .deckMono(17, weight: .semibold)
                        .foregroundStyle(isUnassigned ? DeckPalette.ink4 : selected ? DeckPalette.accent : DeckPalette.ink)
                    Spacer()
                    Circle()
                        .fill(stateColor)
                        .frame(width: 6, height: 6)
                        .shadow(color: isLive ? stateColor.opacity(0.8) : .clear, radius: 4)
                }

                if !isUnassigned, let snippet, !snippet.isEmpty {
                    Text("“\(snippet)”")
                        .deckMono(8.5)
                        .lineSpacing(3)
                        .foregroundStyle(selected ? DeckPalette.ink2 : DeckPalette.ink3)
                        .lineLimit(3)
                        .padding(.top, 8)
                }

                Spacer(minLength: 6)

                LaneSparkline(
                    seed: lane.name,
                    active: isLive,
                    voiceReactive: voiceReactive,
                    inputLevel: inputLevel
                )
                    .foregroundStyle(selected ? DeckPalette.accent : isLive ? stateColor : DeckPalette.line)
                    .frame(height: 16)
                    .padding(.bottom, 7)

                Text(lane.name.uppercased())
                    .deckMono(8.5, weight: .semibold)
                    .tracking(1.2)
                    .foregroundStyle(selected ? DeckPalette.accent : DeckPalette.ink2)
                    .lineLimit(1)
                Text(playing ? "PLAYING" : isUnassigned ? "UNASSIGNED" : lane.state.rawValue.uppercased())
                    .deckMono(8, weight: .medium)
                    .tracking(0.8)
                    .foregroundStyle(selected ? DeckPalette.accent : stateColor)
                    .padding(.top, 3)
            }
            .padding(11)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    colors: selected ? [DeckPalette.accentDark.opacity(0.95), DeckPalette.padBottom] : isUnassigned ? [DeckPalette.empty, DeckPalette.page] : [DeckPalette.pad, DeckPalette.padBottom],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 9)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 9)
                    .strokeBorder(
                        selected ? DeckPalette.accent : DeckPalette.line,
                        lineWidth: borderWidth
                    )
            }
            .shadow(color: selected ? DeckPalette.accent.opacity(0.1) : .clear, radius: selected ? 5 : 0)
        }
        .buttonStyle(DeckPressButtonStyle())
        .accessibilityLabel("Lane \(index + 1), \(lane.name), \(lane.state.rawValue)")
    }

    private var isUnassigned: Bool { lane.threadId == nil }
    private var isLive: Bool { lane.state == .working || lane.state == .speaking || playing }
    private var borderWidth: CGFloat { (selected ? 2 : 1) / max(displayScale, 1) }
    private var stateColor: Color {
        if isUnassigned { return DeckPalette.ink4 }
        switch lane.state {
        case .speaking: return DeckPalette.accent
        case .working: return DeckPalette.amber
        case .idle: return DeckPalette.ink3
        case .empty: return DeckPalette.ink4
        }
    }
}

struct LaneSparkline: View {
    let seed: String
    let active: Bool
    let voiceReactive: Bool
    let inputLevel: Double

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !voiceReactive)) { timeline in
            Canvas { context, size in
                let path = voiceReactive
                    ? voicePath(size: size, time: timeline.date.timeIntervalSinceReferenceDate)
                    : seededPath(size: size)

                if voiceReactive {
                    context.opacity = 0.24
                    context.stroke(path, with: .foreground, lineWidth: 4.5)
                    context.opacity = 1
                    context.stroke(path, with: .foreground, lineWidth: 1.7)
                } else {
                    context.stroke(path, with: .foreground, lineWidth: 1.2)
                }
            }
        }
    }

    private func seededPath(size: CGSize) -> Path {
        var value = seed.unicodeScalars.reduce(0) { ($0 &* 37 &+ Int($1.value)) % 99_991 }
        var path = Path()
        path.move(to: CGPoint(x: 0, y: size.height / 2))
        for index in 1...10 {
            value = (value &* 1_103_515_245 &+ 12_345) & 0x7fffffff
            let random = CGFloat(value) / CGFloat(Int32.max)
            let amplitude = active ? size.height * 0.72 : size.height * 0.18
            let y = size.height / 2 + (random - 0.5) * amplitude
            path.addLine(to: CGPoint(x: size.width * CGFloat(index) / 10, y: y))
        }
        return path
    }

    private func voicePath(size: CGSize, time: TimeInterval) -> Path {
        let level = CGFloat(min(1, max(0, inputLevel)))
        let amplitude = size.height * (0.05 + level * 0.82)
        let middle = size.height / 2
        var path = Path()

        for index in 0...28 {
            let progress = CGFloat(index) / 28
            let envelope = 0.35 + 0.65 * sin(progress * .pi)
            let primary = sin(progress * .pi * 4 + CGFloat(time * 11.5))
            let detail = sin(progress * .pi * 9 - CGFloat(time * 16.0)) * 0.36
            let y = middle + (primary + detail) * amplitude * envelope * 0.5
            let point = CGPoint(x: size.width * progress, y: y)
            index == 0 ? path.move(to: point) : path.addLine(to: point)
        }
        return path
    }
}

struct HoldToSpeakButton: View {
    let phase: DeckCapturePhase
    let lane: Int
    var compact = false
    let onPress: () -> Void
    let onRelease: () -> Void
    let onCancel: () -> Void
    @State private var ownsHold = false

    /// Never say "hold to speak" while the device is still carrying words the
    /// operator already spoke — queued work is visible, not silent.
    private var headline: String {
        switch phase {
        case .recording: "LISTENING…"
        case .transcribing: "TRANSCRIBING…"
        case .arming: "STARTING…"
        case .preparing: "PREPARING…"
        case .held(let count): "\(count) HELD"
        case .delivering(let count): "\(count) TO SEND"
        case .idle: "HOLD TO SPEAK"
        }
    }

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: compact ? 9 : 14) {
                ZStack {
                    Circle().fill(DeckPalette.ink.opacity(0.95))
                    Capsule().fill(DeckPalette.micBottom).frame(width: 8, height: 15)
                }
                .frame(width: compact ? 28 : 32, height: compact ? 28 : 32)
                .overlay { Circle().stroke(DeckPalette.accentDim, lineWidth: 1.5) }

                // One line at rest.
                //
                // This carried "Parakeet · lane 03" underneath at all times —
                // the engine, which never changes and which the operator did
                // not choose, and the lane, which is already the loudest thing
                // in the picker and named again in the console header. The
                // biggest key on the deck was spending half its face restating
                // two facts. The second line now appears only when the device
                // is doing something the operator cannot see elsewhere: words
                // held, words queued, a model warming.
                VStack(alignment: .leading, spacing: 3) {
                    Text(headline)
                        .deckMono(compact ? 10 : 12, weight: .semibold)
                        .tracking(compact ? 1.1 : 1.8)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.68)
                    if phase != .idle, phase != .recording {
                        Text(phase.label)
                            .deckMono(8.5)
                            .foregroundStyle(Color(red: 0.62, green: 0.86, blue: 0.78))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 4)
                ListeningBars(active: phase == .recording)
            }
            .padding(.horizontal, compact ? 11 : 16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                LinearGradient(colors: [DeckPalette.micTop, DeckPalette.micBottom], startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay { RoundedRectangle(cornerRadius: 10).stroke(DeckPalette.accentDim, lineWidth: 1.5) }
            // Down, not up. Every other key on this deck darkens and sinks when
            // pressed; this one was the last thing still brightening, which read
            // as a different kind of object under the same thumb.
            .scaleEffect(ownsHold ? 0.985 : 1)
            .offset(y: ownsHold ? 0.75 : 0)
            .brightness(ownsHold ? -0.035 : 0)
            .contentShape(RoundedRectangle(cornerRadius: 10))
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { _ in
                        guard !ownsHold else { return }
                        ownsHold = true
                        onPress()
                    }
                    .onEnded { value in
                        guard ownsHold else { return }
                        ownsHold = false
                        let point = value.location
                        let inside = point.x >= 0 && point.y >= 0 && point.x <= geometry.size.width && point.y <= geometry.size.height
                        inside ? onRelease() : onCancel()
                    }
            )
            .accessibilityElement()
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Hold to speak using local Parakeet")
            .onDisappear {
                if ownsHold { ownsHold = false; onCancel() }
            }
        }
    }
}

struct ListeningBars: View {
    let active: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 2.5) {
            ForEach(0..<10, id: \.self) { index in
                Capsule()
                    .fill(.white.opacity(active ? 0.9 : 0.45))
                    .frame(width: 2.5, height: active ? CGFloat(6 + (index * 7) % 4 * 4) : 4)
                    .animation(
                        active ? .easeInOut(duration: 0.45 + Double(index % 5) * 0.08).repeatForever(autoreverses: true).delay(Double(index % 4) * 0.04) : .default,
                        value: active
                    )
            }
        }
        .frame(height: 28)
    }
}

struct LaneSetupView: View {
    @ObservedObject var connection: DeckConnection
    @Environment(\.dismiss) private var dismiss
    @State private var laneIndex = 0
    @State private var query = ""

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                if geometry.size.width >= 700 {
                    HStack(spacing: 0) {
                        lanePicker.frame(width: 280)
                        Rectangle().fill(DeckPalette.lineSoft).frame(width: 1)
                        catalog
                    }
                } else {
                    VStack(spacing: 0) {
                        lanePicker.frame(height: 190)
                        Rectangle().fill(DeckPalette.lineSoft).frame(height: 1)
                        catalog
                    }
                }
            }
            .background(DeckPalette.panel)
            .navigationTitle("Set lanes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.foregroundStyle(DeckPalette.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            laneIndex = min(8, max(0, connection.snapshot?.lane ?? 0))
            connection.refreshCatalog()
        }
    }

    private var lanePicker: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                ForEach(Array((connection.snapshot?.lanes ?? []).prefix(9).enumerated()), id: \.offset) { index, lane in
                    Button {
                        laneIndex = index
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(String(format: "%02d", index + 1)).deckMono(11, weight: .semibold)
                            // Ownership, not the presence of a thread id: a deck
                            // thread acquires an id once it answers, and reading
                            // "BOUND" would make it look like a Desktop task.
                            Text(lane.origin == "deck" ? "DECK" : lane.threadId == nil ? "FRESH" : "BOUND")
                                .deckMono(7, weight: .semibold)
                                .foregroundStyle(lane.origin == "deck" ? DeckPalette.micTop : lane.threadId == nil ? DeckPalette.ink3 : DeckPalette.accent)
                            Text(lane.title).deckMono(8).lineLimit(2).foregroundStyle(DeckPalette.ink2)
                        }
                        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                        .padding(9)
                        .background(laneIndex == index ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(laneIndex == index ? DeckPalette.accent : DeckPalette.line) }
                    }
                    .buttonStyle(DeckPressButtonStyle())
                }
            }
            .padding(12)
        }
        .background(DeckPalette.panelHead)
    }

    private var catalog: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 9) {
                Text("PAD \(String(format: "%02d", laneIndex + 1))")
                    .deckMono(8.5, weight: .semibold)
                    .tracking(1.3)
                    .foregroundStyle(DeckPalette.accent)
                Text(currentLane?.title ?? "Unassigned — choose an agent channel")
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundStyle(DeckPalette.ink)
                    .lineLimit(1)
                TextField("Search agents, task titles or projects", text: $query)
                    .textFieldStyle(.plain)
                    .deckMono(11)
                    .padding(.horizontal, 12)
                    .frame(height: 40)
                    .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line) }
            }
            .padding(14)
            .overlay(alignment: .bottom) { Rectangle().fill(DeckPalette.lineSoft).frame(height: 1) }

            ScrollView {
                LazyVStack(spacing: 8) {
                    newThreadSection
                    Text("OR RESUME A CODEX TASK")
                        .deckMono(8, weight: .medium)
                        .tracking(1.4)
                        .foregroundStyle(DeckPalette.ink4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)

                    Button {
                        connection.assignLane(laneIndex, threadID: nil)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("CLEAR ASSIGNMENT").deckMono(9, weight: .semibold).tracking(1.1).foregroundStyle(DeckPalette.accent)
                            Text("Leave this pad unassigned. Speaking will not create a shadow task.")
                                .deckMono(8.5).foregroundStyle(DeckPalette.ink3)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 9))
                        .overlay { RoundedRectangle(cornerRadius: 9).stroke(DeckPalette.accentEdge, style: StrokeStyle(lineWidth: 1, dash: [5])) }
                    }
                    .buttonStyle(DeckPressButtonStyle())

                    ForEach(filteredCatalog) { thread in
                        Button {
                            connection.assignLane(laneIndex, threadID: thread.id)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                if let agent = thread.agentName {
                                    Text("\(agent.uppercased()) · \(thread.agentStatus ?? "unknown")")
                                        .deckMono(8, weight: .semibold).foregroundStyle(DeckPalette.ink2)
                                }
                                Text(thread.snippet)
                                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                                    .foregroundStyle(DeckPalette.ink)
                                    .lineLimit(2)
                                HStack {
                                    Text(thread.channelContext)
                                        .deckMono(7.5, weight: .medium)
                                        .tracking(0.7)
                                        .foregroundStyle(DeckPalette.ink3)
                                    Spacer()
                                    if boundLane(for: thread.id) != nil {
                                        Text("PAD \((boundLane(for: thread.id) ?? 0) + 1)")
                                            .deckMono(7.5, weight: .semibold)
                                            .foregroundStyle(DeckPalette.accent)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(currentLane?.threadId == thread.id ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 9))
                            .overlay { RoundedRectangle(cornerRadius: 9).stroke(currentLane?.threadId == thread.id ? DeckPalette.accentEdge : DeckPalette.line) }
                        }
                        .buttonStyle(DeckPressButtonStyle())
                    }

                    if filteredCatalog.isEmpty {
                        Text(connection.snapshot?.catalogError ?? "No matching agent channels")
                            .deckMono(9)
                            .foregroundStyle(DeckPalette.ink3)
                            .padding(30)
                    }
                }
                .padding(14)
            }
        }
    }

    /// The picker's primary action. A new thread is the common case when the
    /// pad is empty, so it leads the sheet instead of hiding under the task
    /// list — resuming an existing Codex task is the alternative below it.
    private var newThreadSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                connection.newThread(laneIndex)
                dismiss()
            } label: {
                HStack(spacing: 11) {
                    Text("＋")
                        .font(.system(size: 21, weight: .light, design: .monospaced))
                        .foregroundStyle(DeckPalette.ink)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("NEW THREAD")
                            .deckMono(11, weight: .semibold)
                            .tracking(1.3)
                            .foregroundStyle(DeckPalette.ink)
                        Text("Fresh Codex thread on this pad. Hold to speak and it starts.")
                            .deckMono(8.5)
                            .foregroundStyle(DeckPalette.ink2)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 13)
                .padding(.vertical, 13)
                .background(
                    LinearGradient(
                        colors: [DeckPalette.micTop, DeckPalette.micBottom],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    in: RoundedRectangle(cornerRadius: 9)
                )
                .overlay { RoundedRectangle(cornerRadius: 9).stroke(DeckPalette.accentEdge) }
            }
            .buttonStyle(DeckPressButtonStyle())

            if !recentProjects.isEmpty {
                Text("START IT IN")
                    .deckMono(7.5, weight: .medium)
                    .tracking(1.3)
                    .foregroundStyle(DeckPalette.ink4)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(recentProjects, id: \.cwd) { project in
                            Button {
                                connection.newThread(laneIndex, cwd: project.cwd)
                                dismiss()
                            } label: {
                                Text(project.name.uppercased())
                                    .deckMono(8.5, weight: .semibold)
                                    .tracking(0.8)
                                    .foregroundStyle(DeckPalette.ink2)
                                    .padding(.horizontal, 10)
                                    .frame(height: 28)
                                    .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 7))
                                    .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.line) }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                        }
                    }
                    .padding(.horizontal, 1)
                }
            }
        }
    }

    /// Distinct checkouts from the Codex catalog, newest first — the working
    /// directories the operator actually uses, without a file browser.
    private var recentProjects: [(name: String, cwd: String)] {
        var seen = Set<String>()
        var out: [(name: String, cwd: String)] = []
        for thread in connection.snapshot?.catalog ?? [] {
            guard !thread.cwd.isEmpty, seen.insert(thread.cwd).inserted else { continue }
            out.append((thread.displayProject, thread.cwd))
            if out.count == 6 { break }
        }
        return out
    }

    private var currentLane: DeckLaneInfo? {
        guard let lanes = connection.snapshot?.lanes, lanes.indices.contains(laneIndex) else { return nil }
        return lanes[laneIndex]
    }

    private var filteredCatalog: [DeckThreadInfo] {
        let catalog = connection.snapshot?.catalog ?? []
        let terms = query.lowercased().split(whereSeparator: \.isWhitespace)
        guard !terms.isEmpty else { return catalog }
        return catalog.filter { thread in
            let haystack = "\(thread.channelContext) \(thread.agentName ?? "") \(thread.displayProject) \(thread.snippet) \(thread.preview ?? "") \(thread.cwd) \(thread.id)".lowercased()
            return terms.allSatisfy { haystack.contains($0) }
        }
    }

    private func boundLane(for threadID: String) -> Int? {
        connection.snapshot?.lanes.prefix(9).firstIndex(where: { $0.threadId == threadID })
    }
}

struct CompactDeckButton: View {
    let title: String
    let action: () -> Void

    init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .deckMono(7.5, weight: .semibold)
                .tracking(0.7)
                .foregroundStyle(DeckPalette.ink2)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity, minHeight: 30, maxHeight: .infinity)
                .background(
                    LinearGradient(colors: [DeckPalette.pad, DeckPalette.padBottom], startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 7)
                )
                .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.line) }
        }
        .buttonStyle(DeckPressButtonStyle())
    }
}

/// The press for every control that is not a 4x4 keycap — lane rows, transport
/// keys, chips, settings. These have no shared material to reach into, so the
/// press has to be honest with transform and tone alone.
///
/// Direction matters more than amount. This used to *brighten* on press while
/// the keycaps darkened, so the two halves of the same panel disagreed about
/// which way a key moves. Brightening is also wrong twice over: on Ceramic a
/// +0.05 lift on a #FFFDF8 cell clips to nothing (in 224 frames of the capture
/// not one lane-row press is visible), and on the dark themes it says "lit",
/// which this deck reserves for things that genuinely are — live state, the
/// connection pip, the narration meter. A pressed control is not lit. It has
/// moved out of the light.
struct DeckPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.988 : 1)
            .offset(y: configuration.isPressed ? 0.75 : 0)
            // Two shading terms because one does not cover both ends of the
            // theme range. The multiply is proportional, so it carries the
            // light themes without washing warm cream toward grey; the additive
            // term carries the dark themes, where multiplying near-black does
            // essentially nothing.
            .colorMultiply(configuration.isPressed ? Color(white: 0.93) : .white)
            .brightness(configuration.isPressed ? -0.035 : 0)
            .animation(DeckPressMotion.curve(pressed: configuration.isPressed), value: configuration.isPressed)
    }
}

struct HardwareKnob: View {
    var diameter: CGFloat = 44
    var dark = false

    var body: some View {
        ZStack(alignment: .top) {
            Circle()
                .fill(
                    RadialGradient(
                        colors: dark ? [Color(white: 0.24), Color(white: 0.08)] : [Color(white: 0.92), Color(white: 0.45)],
                        center: UnitPoint(x: 0.35, y: 0.28),
                        startRadius: 1,
                        endRadius: diameter / 2
                    )
                )
                .shadow(color: .black.opacity(0.45), radius: 4, y: 3)
            Capsule()
                .fill(dark ? DeckPalette.ink3 : Color(white: 0.2))
                .frame(width: 2, height: 9)
                .padding(.top, 5)
        }
        .frame(width: diameter, height: diameter)
        .overlay { Circle().stroke(DeckPalette.ink4, lineWidth: 1) }
    }
}

struct SpeakerGrille: View {
    var diameter: CGFloat = 44

    var body: some View {
        Canvas { context, size in
            for x in stride(from: 7.0, through: size.width - 5, by: 4) {
                for y in stride(from: 7.0, through: size.height - 5, by: 4) {
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.2, height: 1.2)), with: .color(DeckPalette.ink3.opacity(0.8)))
                }
            }
        }
        .frame(width: diameter, height: diameter)
        .background(Color(white: 0.09), in: Circle())
        .overlay { Circle().stroke(DeckPalette.ink4) }
        .shadow(color: .black.opacity(0.4), radius: 3, y: 2)
    }
}

struct PlateFasteners: View {
    var body: some View {
        GeometryReader { geometry in
            ForEach(0..<4, id: \.self) { index in
                Circle()
                    .fill(DeckPalette.line)
                    .frame(width: 4, height: 4)
                    .position(
                        x: index % 2 == 0 ? 8 : geometry.size.width - 8,
                        y: index < 2 ? 8 : geometry.size.height - 8
                    )
            }
        }
        .allowsHitTesting(false)
    }
}

/// Native counterpart to the compact monochrome browser terminal.
/// Audio capture, durable delivery, and playback stay with the existing owners.
private struct TerminalDeckView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var connection: DeckConnection
    @ObservedObject var voice: DeckVoice
    let snapshot: DeckSnapshot
    let showSetup: () -> Void
    let showConnection: () -> Void
    @AppStorage("speakeasy.terminal.sidebar") private var sidebarWidth = 250.0
    @State private var dragWidth: Double?
    @State private var holding = false
    @State private var showingExplore = false
    private let accent = Color(red: 0.80, green: 0.85, blue: 0.51)
    private let rule = Color(white: 0.22)
    private let secondary = Color(white: 0.67)

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    SpeakEasyMark(size: 23)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("SPEAKEASY").deckMono(12, weight: .semibold).tracking(2)
                        Text("VOICE TERMINAL").deckMono(8).tracking(1.5).foregroundStyle(secondary)
                    }
                    Spacer()
                    Button(action: showConnection) {
                        Label(snapshot.host.uppercased(), systemImage: "network")
                            .deckMono(10).foregroundStyle(secondary)
                    }
                    Button("EXPLORE") { showingExplore = true }
                        .deckMono(10, weight: .medium).padding(12)
                    Button("SET LANES", action: showSetup)
                        .deckMono(10, weight: .medium).padding(.horizontal, 14).padding(.vertical, 12)
                        .background(Color(white: 0.08), in: RoundedRectangle(cornerRadius: 5))
                        .overlay(RoundedRectangle(cornerRadius: 5).stroke(rule))
                }.padding(.horizontal, 16).frame(height: 52)
                Rectangle().fill(rule).frame(height: 1)
                HStack(spacing: 0) {
                    channels.frame(width: min(max(160, sidebarWidth), max(160, geometry.size.width - 330)))
                    Rectangle().fill(Color(white: 0.07)).frame(width: 14)
                        .overlay(Capsule().fill(secondary).frame(width: 2, height: 32))
                        .contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                            if dragWidth == nil { dragWidth = sidebarWidth }
                            sidebarWidth = min(max(160, (dragWidth ?? sidebarWidth) + value.translation.width), max(160, min(440, geometry.size.width - 330)))
                        }.onEnded { _ in dragWidth = nil })
                        .accessibilityLabel("Channel sidebar width")
                        .accessibilityValue("\(Int(sidebarWidth)) points")
                        .accessibilityAdjustableAction { direction in
                            sidebarWidth = min(440, max(160, sidebarWidth + (direction == .increment ? 16 : -16)))
                        }
                    conversation
                }
            }
            .foregroundStyle(Color(white: 0.95))
            .background(Color.black)
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $showingExplore) {
            HerdrExploreView(connection: connection).presentationDetents([.large])
        }
        .onDisappear { if holding { holding = false; voice.pttCancelled() } }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active && holding { holding = false; voice.pttCancelled() }
        }
    }

    private var channels: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("[ CHANNELS ]").deckMono(9).tracking(1.5).foregroundStyle(secondary).padding(14)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(snapshot.lanes.enumerated()), id: \.offset) { index, lane in
                            Button {
                                guard !holding else { return }
                                connection.selectLane(index)
                            } label: {
                                VStack(alignment: .leading, spacing: 5) {
                                    HStack {
                                        Text(lane.num).deckMono(14, weight: .semibold)
                                        Spacer()
                                        Circle().fill(lane.state == .working || lane.state == .speaking ? accent : Color(white: 0.3)).frame(width: 5, height: 5)
                                    }
                                    Text(lane.project ?? lane.name).deckMono(10, weight: .medium).lineLimit(1)
                                    Text(lane.title).deckMono(11).lineLimit(2).multilineTextAlignment(.leading)
                                    Text(lane.branch ?? snapshot.lastAgentMessage(in: index)?.text ?? "No replies yet")
                                        .deckMono(9).foregroundStyle(secondary).lineLimit(1)
                                    HStack {
                                        Text(lane.isAssigned ? lane.state.rawValue.uppercased() : "UNASSIGNED")
                                        Spacer()
                                        Text("\(replyCount(index)) REPLIES")
                                    }.deckMono(8).foregroundStyle(secondary)
                                }
                                .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                                .background(index == snapshot.lane ? Color(white: 0.14) : Color(white: 0.045))
                                .overlay(alignment: .leading) { if index == snapshot.lane { Rectangle().fill(accent).frame(width: 2) } }
                                .overlay(alignment: .bottom) { Rectangle().fill(rule).frame(height: 0.5) }
                            }.id(index)
                        }
                    }
                }
                .onAppear { proxy.scrollTo(snapshot.lane, anchor: .center) }
                .onChange(of: snapshot.lane) { _, lane in proxy.scrollTo(lane, anchor: .center) }
            }
            Button("+ CONNECT CHANNEL", action: showSetup)
                .deckMono(10).frame(maxWidth: .infinity, minHeight: 44)
                .overlay(alignment: .top) { Rectangle().fill(rule).frame(height: 1) }
        }.background(Color(white: 0.045))
    }

    private func replyCount(_ index: Int) -> Int {
        snapshot.threads.indices.contains(index) ? snapshot.threads[index].filter { $0.role == "agent" }.count : 0
    }

    private var conversation: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 9) {
                Text("ACTIVE LANE \(snapshot.activeLane?.num ?? "—")").deckMono(8).tracking(1.5).foregroundStyle(secondary)
                Text(snapshot.activeLane?.title ?? "Choose a channel").deckMono(20, weight: .semibold).lineLimit(2)
                HStack(alignment: .top, spacing: 20) {
                    fact("PROJECT", snapshot.activeLane?.project ?? "—")
                    fact("BRANCH", snapshot.activeLane?.branch ?? "—")
                }
                fact("WORKSPACE", snapshot.activeLane?.cwd ?? "—")
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(rule).frame(height: 1)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        HStack {
                            Text("CONVERSATION")
                            Spacer()
                            Text("\(snapshot.activeMessages.count) MESSAGES")
                        }.deckMono(8).tracking(1).foregroundStyle(secondary)
                        ForEach(Array(snapshot.activeMessages.enumerated()), id: \.offset) { index, message in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(message.role == "you" ? "YOU" : "AGENT").deckMono(8).foregroundStyle(secondary)
                                Text(message.text).deckMono(13).lineSpacing(5).textSelection(.enabled)
                                if message.hasAudio {
                                    HStack(spacing: 14) {
                                        Button {
                                            connection.sendIntent("playback.toggle", ["id": "\(snapshot.lane):\(index)"])
                                        } label: {
                                            Image(systemName: snapshot.playing == "\(snapshot.lane):\(index)" && !snapshot.paused ? "pause.fill" : "play.fill")
                                                .frame(width: 36, height: 36).background(accent, in: RoundedRectangle(cornerRadius: 4)).foregroundStyle(.black)
                                        }.accessibilityLabel("Play or pause reply")
                                        TerminalReplyWave(meter: connection.meter,
                                                          messageID: "\(snapshot.lane):\(index)",
                                                          duration: message.dur,
                                                          preview: connection.waveformPreviews[message.audioUrl ?? ""],
                                                          accent: accent) { fraction in
                                            connection.sendIntent("playback.scrub", ["id": "\(snapshot.lane):\(index)", "frac": fraction])
                                        }.frame(height: 38)
                                            .task(id: message.audioUrl) {
                                                if let path = message.audioUrl { connection.loadWaveform(path: path) }
                                            }
                                        Text(String(format: "%.0fs", message.dur)).deckMono(10).foregroundStyle(secondary)
                                        Spacer()
                                        Button(DeckPlaybackSpeeds.label(at: snapshot.speedIx)) { connection.sendIntent("playback.speed") }.deckMono(11).frame(minWidth: 44, minHeight: 36)
                                    }
                                }
                            }
                            .padding(.horizontal, message.role == "you" ? 16 : 2)
                            .padding(.vertical, message.role == "you" ? 12 : 8)
                            .background {
                                if message.role == "you" {
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .fill(Color(white: 0.12))
                                }
                            }
                            .padding(.leading, message.role == "you" ? 36 : 0)
                            .padding(.trailing, message.role == "you" ? 0 : 20)
                            .frame(maxWidth: .infinity, alignment: message.role == "you" ? .trailing : .leading)
                            .id(index)
                        }
                        Color.clear.frame(height: 1).id("end")
                    }.padding(16)
                }
                .onChange(of: snapshot.activeMessages.count) { _, _ in proxy.scrollTo("end", anchor: .bottom) }
                .onChange(of: snapshot.lane) { _, _ in proxy.scrollTo("end", anchor: .bottom) }
            }
            controls
        }.background(Color(white: 0.025))
    }

    private func fact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label).deckMono(8).foregroundStyle(secondary)
            Text(value).deckMono(10).lineLimit(1).truncationMode(.middle)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "mic").font(.system(size: 20))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(holding ? "RELEASE TO SEND" : "HOLD TO SPEAK").deckMono(11, weight: .semibold)
                        Text(voice.phase == .recording ? "Microphone on" : holding ? "Starting microphone" : "Microphone off").deckMono(9)
                    }
                    Spacer()
                    HStack(spacing: 2) {
                        ForEach(0..<18) { index in
                            Rectangle().frame(width: 2, height: holding ? 3 + voice.inputLevel * Double(8 + (index % 5) * 4) : 2)
                        }
                    }.frame(height: 28).accessibilityHidden(true)
                }
                .foregroundStyle(.black).padding(14).frame(minHeight: 62)
                .background(holding ? accent : Color(white: 0.92), in: RoundedRectangle(cornerRadius: 5))
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).onChanged { _ in
                    if !holding && !voice.phase.isBusy && snapshot.activeLane?.isAssigned == true { holding = true; voice.pttBegan() }
                }.onEnded { _ in if holding { holding = false; voice.pttEnded() } })
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(holding ? "Send recording" : "Start recording")
                .accessibilityAddTraits(.isButton)
                .accessibilityAction {
                    if holding { holding = false; voice.pttEnded() }
                    else if !voice.phase.isBusy && snapshot.activeLane?.isAssigned == true { holding = true; voice.pttBegan() }
                }
                Button {
                    holding = false; voice.stopCapture(); connection.stop()
                } label: { Image(systemName: "stop.fill").frame(width: 44, height: 44) }
                .accessibilityLabel("Stop")
            }
            HStack {
                Text(connection.localStatus ?? voice.status ?? voice.phase.label).lineLimit(2)
                Spacer()
                Slider(value: Binding(get: { snapshot.vol }, set: { connection.sendIntent("playback.volume", ["vol": $0]) }), in: 0...1)
                    .tint(Color(white: 0.7)).frame(width: 110).accessibilityLabel("Narration volume")
            }.deckMono(8).foregroundStyle(secondary)
        }.padding(12).background(Color(white: 0.055))
            .overlay(alignment: .top) { Rectangle().fill(rule).frame(height: 1) }
    }
}

/// Full-file audio preview with progress from the native player.
private struct TerminalReplyWave: View {
    @ObservedObject var meter: DeckPlaybackMeter
    let messageID: String
    let duration: Double
    let preview: [Double]?
    let accent: Color
    let seek: (Double) -> Void
    private var progress: Double {
        meter.id == messageID ? min(1, max(0, meter.position / max(duration, 0.01))) : 0
    }
    var body: some View {
        GeometryReader { geometry in
            Canvas { context, size in
                let count = 64
                let slot = size.width / Double(count)
                for index in 0..<count {
                    let bucket = index * DeckPlaybackMeter.bucketCount / count
                    let level = preview?.indices.contains(bucket) == true ? preview![bucket] : 0
                    let height = max(2, min(1, level) * (size.height - 4))
                    let rect = CGRect(x: Double(index) * slot, y: (size.height - height) / 2, width: max(1, slot - 2), height: height)
                    context.fill(Path(roundedRect: rect, cornerRadius: 1), with: .color(Double(index) / Double(count) < progress ? accent : Color(white: 0.34)))
                }
                if meter.id == messageID {
                    let rect = CGRect(x: max(0, min(size.width - 1, progress * size.width)), y: 2, width: 1, height: size.height - 4)
                    context.fill(Path(rect), with: .color(Color(white: 0.85)))
                }
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onEnded { value in
                seek(min(1, max(0, value.location.x / max(1, geometry.size.width))))
            })
        }
        .accessibilityLabel("Reply waveform and playback position")
        .accessibilityValue("\(Int(progress * 100)) percent")
        .accessibilityAdjustableAction { direction in seek(min(1, max(0, progress + (direction == .increment ? 0.1 : -0.1)))) }
    }
}


private struct HerdrExploreView: View {
    @ObservedObject var connection: DeckConnection
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    private var agents: [DeckThreadInfo] {
        (connection.snapshot?.catalog ?? []).filter { $0.originator == "herdr" }
    }
    private var matches: [DeckThreadInfo] {
        agents.filter { query.isEmpty || "\($0.channelContext) \($0.snippet) \($0.agentName ?? "") \($0.cwd) \($0.agentStatus ?? "")".localizedCaseInsensitiveContains(query) }
    }
    private var sessions: [String] { Array(Set(matches.map(\.channelContext))).sorted() }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(alignment: .top, spacing: 16) {
                        Image(systemName: "desktopcomputer")
                            .font(.system(size: 28, weight: .light))
                            .frame(width: 56, height: 56)
                            .background(Color(white: 0.1), in: RoundedRectangle(cornerRadius: 16))
                        VStack(alignment: .leading, spacing: 5) {
                            Text("CONNECTED HOST").font(.system(size: 9, weight: .medium, design: .monospaced)).tracking(2).foregroundStyle(.secondary)
                            Text(connection.snapshot?.host ?? "Disconnected")
                                .font(.system(size: 22, weight: .semibold))
                            Text("Your Herdr landscape").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 22) {
                        metric("SESSIONS", Set(agents.compactMap(\.herdrSession)).count)
                        metric("AGENTS", agents.count)
                        metric("WORKING", agents.filter { $0.agentStatus == "working" }.count)
                        metric("ATTENTION", agents.filter { $0.agentStatus == "blocked" || $0.agentStatus == "unlinked" }.count)
                    }.padding(.top, 6)
                }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(white: 0.055), in: RoundedRectangle(cornerRadius: 20))
                ForEach(sessions, id: \.self) { session in
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 9) {
                            Image(systemName: "square.stack.3d.up").foregroundStyle(.secondary)
                            Text(matches.first { $0.channelContext == session }?.herdrSession ?? session)
                                .font(.system(size: 16, weight: .semibold))
                            Spacer()
                            Text("\(matches.filter { $0.channelContext == session }.count) agents")
                                .font(.caption.monospaced()).foregroundStyle(.secondary)
                        }.padding(.bottom, 14)

                        ForEach(matches.filter { $0.channelContext == session }) { agent in
                            DisclosureGroup {
                                VStack(alignment: .leading, spacing: 12) {
                                    LabeledContent("Agent", value: agent.agentName ?? "Unknown")
                                    LabeledContent("State", value: agent.agentStatus ?? "unknown")
                                    Text(agent.cwd).textSelection(.enabled)
                                    let lanes = (connection.snapshot?.lanes ?? []).filter { $0.threadId == agent.id }
                                    Text(lanes.isEmpty ? "Not assigned to a lane" : "Lane " + lanes.map(\.num).joined(separator: ", "))
                                        .foregroundStyle(.secondary)
                                    if agent.agentStatus == "unlinked" {
                                        Text("Session integration is required before voice can target this conversation.")
                                            .foregroundStyle(.secondary)
                                    }
                                }.font(.footnote.monospaced()).padding(.vertical, 8)
                            } label: {
                                HStack(spacing: 12) {
                                    Circle().fill(agent.agentStatus == "working" ? Color(red: 0.80, green: 0.85, blue: 0.51) : Color(white: 0.42))
                                        .frame(width: 6, height: 6)
                                    VStack(alignment: .leading, spacing: 5) {
                                    Text(agent.snippet).font(.system(size: 13, weight: .medium)).foregroundStyle(.white)
                                    Text("\(agent.agentName ?? "Agent") · \(agent.agentStatus ?? "unknown")")
                                        .font(.caption.monospaced()).foregroundStyle(.secondary)
                                    }
                                }.padding(.vertical, 10)
                            }
                            Rectangle().fill(Color(white: 0.14)).frame(height: 1)
                        }
                    }
                }
                if matches.isEmpty {
                    Text(query.isEmpty ? "No Herdr agents found on this Mac. Open a Herdr session, then refresh." : "No matching agents")
                        .foregroundStyle(.secondary)
                }
                if let error = connection.snapshot?.catalogError {
                    Text(error).font(.footnote).foregroundStyle(.secondary)
                }
                }.padding(20).frame(maxWidth: 900).frame(maxWidth: .infinity)
            }
            .background(Color.black)
            .searchable(text: $query, prompt: "Sessions, agents, workspaces or states")
            .navigationTitle("Explore")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Refresh", systemImage: "arrow.clockwise") { connection.refreshCatalog() }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
            .onAppear { connection.refreshCatalog() }
        }.preferredColorScheme(.dark).tint(.white)
    }

    private func metric(_ title: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(String(value)).font(.system(size: 20, weight: .medium, design: .monospaced)).monospacedDigit()
            Text(title).font(.system(size: 8, weight: .medium, design: .monospaced)).tracking(1).foregroundStyle(.secondary)
        }
    }
}
