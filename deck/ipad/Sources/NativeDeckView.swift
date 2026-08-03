import SwiftUI

extension View {
    func deckMono(_ size: CGFloat, weight: Font.Weight = .regular) -> some View {
        font(.system(size: size, weight: weight, design: .monospaced))
    }
}

struct NativeDeckView: View {
    @ObservedObject var connection: DeckConnection
    let laneViewer: DeckLaneViewerController
    let selectedDeck: DiscoveredDeck
    let onFindDecks: () -> Void
    @AppStorage(DeckThemeSelection.defaultsKey) private var selectedThemeRaw = DeckThemeID.flight.rawValue
    @AppStorage(DeckSurfaceSelection.defaultsKey) private var selectedSurfaceRaw = DeckSurfaceID.micro.rawValue
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
            VStack(spacing: compact ? 9 : 12) {
                if compact { compactTopBar } else { topBar }

                if let snapshot = connection.snapshot {
                    if compact {
                        KeypadPanel(
                            connection: connection,
                            snapshot: snapshot,
                            surface: selectedSurface,
                            compact: true,
                            showLaneSetup: { showingLaneSetup = true },
                            showActivity: { showingLaneActivity = true }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if geometry.size.width >= 980 {
                        HStack(spacing: 14) {
                            KeypadPanel(
                                connection: connection,
                                snapshot: snapshot,
                                surface: selectedSurface,
                                compact: false,
                                showLaneSetup: { showingLaneSetup = true }
                            )
                            .frame(width: min(600, geometry.size.width * 0.46))

                            DeckLaneWebView(controller: laneViewer)
                                .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 9))
                                .clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                    } else {
                        ScrollView(.vertical, showsIndicators: false) {
                            VStack(spacing: 14) {
                                KeypadPanel(
                                    connection: connection,
                                    snapshot: snapshot,
                                    surface: selectedSurface,
                                    compact: false,
                                    showLaneSetup: { showingLaneSetup = true }
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
            .padding(.horizontal, compact ? 10 : 16)
            .padding(.top, compact ? 8 : 14)
            .padding(.bottom, compact ? 8 : 12)
        }
        .background(DeckPalette.page.ignoresSafeArea())
        .preferredColorScheme(selectedTheme.colorScheme)
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
            DeckCompanionView(connection: connection, deck: selectedDeck, onFindDecks: onFindDecks)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showingLaneActivity) {
            CompactLaneActivityView(controller: laneViewer)
                .preferredColorScheme(selectedTheme.colorScheme)
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Text("SE")
                .deckMono(11, weight: .semibold)
                .foregroundStyle(DeckPalette.accent)
                .frame(width: 30, height: 30)
                .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 7))
                .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.accentEdge) }

            VStack(alignment: .leading, spacing: 2) {
                Text((connection.snapshot?.host ?? "SPEAKEASY").uppercased())
                    .deckMono(11.5, weight: .semibold)
                    .tracking(2.4)
                    .foregroundStyle(DeckPalette.ink)
                    .lineLimit(1)
                Text("NATIVE KEYPAD · WEB LANE VIEWER")
                    .deckMono(8.5)
                    .tracking(1.5)
                    .foregroundStyle(DeckPalette.ink3)
                    .lineLimit(1)
            }

            Spacer()

            Button { showingCompanion = true } label: {
                HStack(spacing: 7) {
                    Circle()
                        .fill(connection.state == .connected ? DeckPalette.accent : DeckPalette.ink4)
                        .frame(width: 6, height: 6)
                        .shadow(color: connection.state == .connected ? DeckPalette.accent.opacity(0.7) : .clear, radius: 5)
                    Text(connection.state.label)
                        .deckMono(8, weight: .medium)
                        .tracking(1.2)
                        .foregroundStyle(DeckPalette.ink3)
                }
                .frame(height: 34)
                .padding(.horizontal, 9)
                .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 8))
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line) }
            }
            .buttonStyle(DeckPressButtonStyle())

            Button { showingAppearance = true } label: {
                Label(selectedSurface.name.uppercased(), systemImage: "square.grid.3x3")
                    .deckMono(8.5, weight: .semibold)
                    .tracking(1)
                    .foregroundStyle(DeckPalette.ink2)
                    .lineLimit(1)
                    .frame(height: 34)
                    .padding(.horizontal, 10)
                    .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 8))
                    .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line) }
            }
            .buttonStyle(DeckPressButtonStyle())

            Button("SET LANES") { showingLaneSetup = true }
                .deckMono(9, weight: .semibold)
                .tracking(1.2)
                .foregroundStyle(DeckPalette.accent)
                .padding(.horizontal, 13)
                .frame(height: 36)
                .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 8))
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.accentEdge) }
                .buttonStyle(DeckPressButtonStyle())
        }
        .padding(.horizontal, 4)
        .frame(height: 36)
    }

    private var compactTopBar: some View {
        VStack(spacing: 7) {
            HStack(spacing: 9) {
                Text("SE")
                    .deckMono(10, weight: .semibold)
                    .foregroundStyle(DeckPalette.accent)
                    .frame(width: 32, height: 32)
                    .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 7))
                    .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.accentEdge) }

                VStack(alignment: .leading, spacing: 2) {
                    Text((connection.snapshot?.host ?? "SPEAKEASY").uppercased())
                        .deckMono(10, weight: .semibold)
                        .tracking(1.7)
                        .foregroundStyle(DeckPalette.ink)
                        .lineLimit(1)
                    Text("NATIVE DECK")
                        .deckMono(7.5, weight: .medium)
                        .tracking(1.2)
                        .foregroundStyle(DeckPalette.ink3)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Button { showingCompanion = true } label: {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(connection.state == .connected ? DeckPalette.accent : DeckPalette.ink4)
                            .frame(width: 6, height: 6)
                        Text(connection.state == .connected ? "LIVE" : "LINK")
                            .deckMono(7.5, weight: .semibold)
                            .tracking(1)
                            .lineLimit(1)
                    }
                    .foregroundStyle(DeckPalette.ink2)
                    .padding(.horizontal, 10)
                    .frame(height: 32)
                    .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 7))
                    .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.line) }
                }
                .buttonStyle(DeckPressButtonStyle())
            }

            HStack(spacing: 7) {
                Button { showingAppearance = true } label: {
                    Label(selectedSurface.name.uppercased(), systemImage: "slider.horizontal.3")
                        .deckMono(7.5, weight: .semibold)
                        .tracking(0.7)
                        .foregroundStyle(DeckPalette.ink2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 7))
                        .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.line) }
                }
                .buttonStyle(DeckPressButtonStyle())

                Button { showingLaneSetup = true } label: {
                    Text("SET LANES")
                        .deckMono(8, weight: .semibold)
                        .tracking(0.9)
                        .foregroundStyle(DeckPalette.accent)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background(DeckPalette.accentDark, in: RoundedRectangle(cornerRadius: 7))
                        .overlay { RoundedRectangle(cornerRadius: 7).stroke(DeckPalette.accentEdge) }
                }
                .buttonStyle(DeckPressButtonStyle())
            }
        }
    }

    private var nativeLinkPlaceholder: some View {
        VStack(spacing: 14) {
            ProgressView()
                .controlSize(.large)
                .tint(DeckPalette.accent)
            Text(connection.localStatus ?? "OPENING NATIVE LINK")
                .deckMono(11, weight: .semibold)
                .tracking(1.4)
                .foregroundStyle(DeckPalette.ink2)
            Text("The native keypad is waiting for its first runtime snapshot.")
                .deckMono(9)
                .foregroundStyle(DeckPalette.ink3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay { RoundedRectangle(cornerRadius: 12).stroke(DeckPalette.line) }
    }
}

struct KeypadPanel: View {
    @ObservedObject var connection: DeckConnection
    let snapshot: DeckSnapshot
    let surface: DeckSurfaceID
    var compact = false
    let showLaneSetup: () -> Void
    var showActivity: (() -> Void)? = nil
    @State private var volume: Double = 0.8

    var body: some View {
        VStack(spacing: compact ? 9 : 12) {
            HStack(alignment: .top) {
                Text(surface.name.uppercased())
                    .deckMono(8.5, weight: .medium)
                    .tracking(1.7)
                    .foregroundStyle(DeckPalette.ink3)
                    .lineLimit(1)
                Spacer()
                Button(action: showLaneSetup) {
                    if compact {
                        Text("\(snapshot.lanes.prefix(9).filter(\.isAssigned).count) / 9 BOUND")
                            .deckMono(7.5, weight: .semibold)
                            .tracking(0.8)
                            .foregroundStyle(DeckPalette.accent)
                            .lineLimit(1)
                    } else {
                        VStack(alignment: .trailing, spacing: 4) {
                        Text("\(snapshot.lanes.prefix(9).filter(\.isAssigned).count) / 9 BOUND")
                            .deckMono(8.5, weight: .medium)
                            .tracking(1.3)
                            .foregroundStyle(DeckPalette.accent)
                        Text("9 KEYS · NATIVE")
                            .deckMono(8.5)
                            .tracking(0.8)
                            .foregroundStyle(DeckPalette.ink3)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 11)
            .overlay(alignment: .bottom) { Rectangle().fill(DeckPalette.lineSoft).frame(height: 1) }

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
            .padding(.horizontal, 6)

            GeometryReader { geometry in
                NativeLaneSurface(
                    surface: surface,
                    connection: connection,
                    snapshot: snapshot,
                    size: geometry.size,
                    compact: compact
                )
            }

            HStack(spacing: compact ? 8 : 12) {
                if !compact { HardwareKnob(diameter: 48, dark: true) }
                HoldToSpeakButton(
                    phase: connection.capturePhase,
                    lane: snapshot.lane,
                    compact: compact,
                    onPress: connection.pttBegan,
                    onRelease: connection.pttEnded,
                    onCancel: connection.pttCancelled
                )
                VStack(spacing: 6) {
                    CompactDeckButton("LANES", action: showLaneSetup)
                    CompactDeckButton("STOP", action: connection.stop)
                }
                .frame(width: compact ? 64 : 76)
            }
            .frame(height: compact ? 62 : 68)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: compact ? 3 : 6), spacing: 7) {
                CompactDeckButton(compact ? "ACTIVITY" : "OVERVIEW") {
                    if compact, let showActivity {
                        showActivity()
                    } else {
                        connection.selectLane(9)
                    }
                }
                CompactDeckButton("SET LANES", action: showLaneSetup)
                CompactDeckButton("CANCEL", action: connection.stop)
                CompactDeckButton("REPLAY", action: connection.replay)
                CompactDeckButton(snapshot.autoplay ? "AUTO ON" : "AUTO OFF", action: connection.toggleAutoplay)
                CompactDeckButton(speedLabel, action: connection.cycleSpeed)
            }
            .frame(height: compact ? 70 : 38)
        }
        .padding(compact ? 12 : 16)
        .background(
            LinearGradient(colors: [DeckPalette.plateTop, DeckPalette.plateBottom], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 12)
        )
        .overlay { RoundedRectangle(cornerRadius: 12).stroke(DeckPalette.line) }
        .overlay { PlateFasteners() }
        .onAppear { volume = snapshot.vol }
        .onChange(of: snapshot.vol) { _, next in volume = next }
        .sensoryFeedback(.selection, trigger: snapshot.lane)
    }

    private var speedLabel: String {
        let speeds = [1.0, 1.25, 1.5, 0.75]
        let speed = speeds.indices.contains(snapshot.speedIx) ? speeds[snapshot.speedIx] : 1
        return String(format: "%.2F×", speed)
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
    let snapshot: DeckSnapshot
    let size: CGSize
    let compact: Bool

    private var lanes: [(offset: Int, element: DeckLaneInfo)] {
        Array(snapshot.lanes.prefix(9).enumerated())
    }

    private var flightLanes: [(offset: Int, element: DeckLaneInfo)] {
        Array(snapshot.lanes.prefix(6).enumerated())
    }

    private var active: (offset: Int, element: DeckLaneInfo)? {
        lanes.first(where: { $0.offset == snapshot.lane }) ?? lanes.first
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

    private var microSurface: some View {
        let cellHeight = max(72, (size.height - 18) / 3)
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 9), count: 3), spacing: 9) {
            ForEach(lanes, id: \.offset) { item in
                fullLaneKey(item).frame(height: cellHeight)
            }
        }
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
                    phase: connection.capturePhase,
                    inputLevel: connection.inputLevel
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
                    phase: connection.capturePhase,
                    inputLevel: connection.inputLevel,
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
                    phase: connection.capturePhase,
                    inputLevel: connection.inputLevel,
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
            voiceReactive: connection.capturePhase == .recording && snapshot.lane == item.offset,
            inputLevel: snapshot.lane == item.offset ? connection.inputLevel : 0
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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Text(String(format: "%02d", index + 1))
                    .deckMono(10, weight: .semibold)
                    .foregroundStyle(selected ? DeckPalette.accent : DeckPalette.ink2)
                    .frame(width: 24, alignment: .leading)
                Circle()
                    .fill(lane.state == .working ? DeckPalette.amber : lane.state == .speaking ? DeckPalette.accent : DeckPalette.ink4)
                    .frame(width: 5, height: 5)
                VStack(alignment: .leading, spacing: 2) {
                    Text(lane.name.uppercased()).deckMono(8.5, weight: .semibold).lineLimit(1)
                    if showsTask {
                        Text(lane.title).deckMono(7).foregroundStyle(DeckPalette.ink3).lineLimit(1)
                    }
                }
                Spacer(minLength: 2)
                Text(lane.threadId == nil ? "EMPTY" : selected ? "ACTIVE" : "ARMED")
                    .deckMono(6.5, weight: .semibold)
                    .foregroundStyle(selected ? DeckPalette.accent : DeckPalette.ink3)
            }
            .foregroundStyle(DeckPalette.ink)
            .padding(.horizontal, 9)
            .frame(maxWidth: .infinity, minHeight: showsTask ? 40 : 31)
            .background(selected ? DeckPalette.accentDark : DeckPalette.cell, in: RoundedRectangle(cornerRadius: 6))
            .overlay { RoundedRectangle(cornerRadius: 6).stroke(selected ? DeckPalette.accent : DeckPalette.line) }
        }
        .buttonStyle(DeckPressButtonStyle())
    }
}

struct ActiveLaneInstrument: View {
    let index: Int
    let lane: DeckLaneInfo
    let snippet: String?
    let phase: DeckCapturePhase
    let inputLevel: Double
    var circular = false
    var glass = false

    var body: some View {
        VStack(spacing: circular ? 8 : 12) {
            Text(phase == .recording ? "LISTENING" : phase == .transcribing ? "TRANSCRIBING" : "ACTIVE LANE")
                .deckMono(7.5, weight: .semibold)
                .tracking(1.8)
                .foregroundStyle(DeckPalette.accent)
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
            Text(snippet ?? lane.title)
                .deckMono(8.5)
                .lineSpacing(3)
                .foregroundStyle(DeckPalette.ink3)
                .lineLimit(3)
                .multilineTextAlignment(.center)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            glass ? DeckPalette.trace.opacity(0.78) : DeckPalette.panel,
            in: RoundedRectangle(cornerRadius: circular ? 80 : 10)
        )
        .overlay {
            RoundedRectangle(cornerRadius: circular ? 80 : 10)
                .stroke(glass || circular ? DeckPalette.accentDim : DeckPalette.line, lineWidth: glass ? 1.5 : 1)
        }
        .shadow(color: (glass || circular) ? DeckPalette.accent.opacity(0.1) : .clear, radius: 14)
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

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: compact ? 9 : 14) {
                ZStack {
                    Circle().fill(DeckPalette.ink.opacity(0.95))
                    Capsule().fill(DeckPalette.micBottom).frame(width: 8, height: 15)
                }
                .frame(width: compact ? 28 : 32, height: compact ? 28 : 32)
                .overlay { Circle().stroke(DeckPalette.accentDim, lineWidth: 1.5) }

                VStack(alignment: .leading, spacing: 3) {
                    Text(phase == .recording ? "LISTENING…" : phase == .transcribing ? "TRANSCRIBING…" : "HOLD TO SPEAK")
                        .deckMono(compact ? 10 : 12, weight: .semibold)
                        .tracking(compact ? 1.1 : 1.8)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.68)
                    Text(phase == .idle ? "Parakeet · lane \(lane == 9 ? "overview" : String(format: "%02d", lane + 1))" : phase.label)
                        .deckMono(8.5)
                        .foregroundStyle(Color(red: 0.62, green: 0.86, blue: 0.78))
                        .lineLimit(1)
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
            .scaleEffect(ownsHold ? 0.985 : 1)
            .brightness(ownsHold ? 0.05 : 0)
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
                            Text(lane.threadId == nil ? "FRESH" : "BOUND")
                                .deckMono(7, weight: .semibold)
                                .foregroundStyle(lane.threadId == nil ? DeckPalette.ink3 : DeckPalette.accent)
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
                Text(currentLane?.title ?? "Unassigned — choose a Codex task")
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundStyle(DeckPalette.ink)
                    .lineLimit(1)
                TextField("Search Codex task titles or projects", text: $query)
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
                                Text(thread.snippet)
                                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                                    .foregroundStyle(DeckPalette.ink)
                                    .lineLimit(2)
                                HStack {
                                    Text("\(thread.displayProject.uppercased()) · \(thread.alias)")
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
                        Text(connection.snapshot?.catalogError ?? "No matching Codex tasks")
                            .deckMono(9)
                            .foregroundStyle(DeckPalette.ink3)
                            .padding(30)
                    }
                }
                .padding(14)
            }
        }
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
            let haystack = "\(thread.displayProject) \(thread.snippet) \(thread.preview ?? "") \(thread.cwd) \(thread.id)".lowercased()
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

struct DeckPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? 0.05 : 0)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
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
