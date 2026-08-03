import SwiftUI
import UIKit

struct DeckAppearanceView: View {
    @Binding var selectedThemeRaw: String
    @Binding var selectedSurfaceRaw: String
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var draftTheme: DeckThemeID
    @State private var draftSurface: DeckSurfaceID

    init(selectedThemeRaw: Binding<String>, selectedSurfaceRaw: Binding<String>) {
        _selectedThemeRaw = selectedThemeRaw
        _selectedSurfaceRaw = selectedSurfaceRaw
        _draftTheme = State(initialValue: DeckThemeID(rawValue: selectedThemeRaw.wrappedValue) ?? .flight)
        _draftSurface = State(initialValue: DeckSurfaceID(rawValue: selectedSurfaceRaw.wrappedValue) ?? .micro)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("HYBRID DECK")
                            .deckMono(9, weight: .semibold)
                            .tracking(1.8)
                            .foregroundStyle(DeckPalette.accent)
                        Text("Appearance")
                            .font(.system(size: 30, weight: .semibold, design: .rounded))
                            .foregroundStyle(DeckPalette.ink)
                        Text("Choose the native control layout and color system independently. The lane viewer stays in the iPad split and opens from Activity on iPhone.")
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundStyle(DeckPalette.ink3)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    sectionHeading("CONTROL SURFACE", detail: "Native layout")

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                        ForEach(DeckSurfaceID.allCases) { surface in
                            Button { draftSurface = surface } label: {
                                VStack(alignment: .leading, spacing: 9) {
                                    SurfaceMiniature(surface: surface)
                                    HStack(alignment: .top) {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(surface.name.uppercased()).deckMono(9.5, weight: .semibold).tracking(1)
                                            Text(surface.detail).deckMono(7.5).foregroundStyle(DeckPalette.ink3)
                                        }
                                        Spacer()
                                        Image(systemName: draftSurface == surface ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(DeckPalette.accent)
                                    }
                                }
                                .foregroundStyle(DeckPalette.ink)
                                .padding(9)
                                .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 10))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(draftSurface == surface ? DeckPalette.accent : DeckPalette.line, lineWidth: draftSurface == surface ? 2 : 1)
                                }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                            .accessibilityAddTraits(draftSurface == surface ? .isSelected : [])
                        }
                    }

                    sectionHeading("DECK THEME", detail: "Color system")

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 14)], spacing: 14) {
                        ForEach(DeckThemeID.allCases) { theme in
                            Button {
                                draftTheme = theme
                            } label: {
                                VStack(alignment: .leading, spacing: 10) {
                                    HybridThemeMiniature(theme: theme)
                                    HStack(alignment: .firstTextBaseline) {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(theme.name.uppercased())
                                                .deckMono(10, weight: .semibold)
                                                .tracking(1.2)
                                            Text(theme.detail)
                                                .deckMono(8.5)
                                                .foregroundStyle(theme.palette.ink3)
                                        }
                                        Spacer()
                                        Image(systemName: draftTheme == theme ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(theme.palette.accent)
                                    }
                                    .foregroundStyle(theme.palette.ink)
                                }
                                .padding(10)
                                .background(theme.palette.panel, in: RoundedRectangle(cornerRadius: 12))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(draftTheme == theme ? theme.palette.accent : theme.palette.line, lineWidth: draftTheme == theme ? 2 : 1)
                                }
                            }
                            .buttonStyle(DeckPressButtonStyle())
                            .accessibilityLabel("\(theme.name) theme, \(theme.detail)")
                            .accessibilityAddTraits(draftTheme == theme ? .isSelected : [])
                        }
                    }

                }
                .padding(24)
            }
            .background(DeckPalette.page)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                appearanceActionBar
            }
            .navigationTitle("Appearance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(DeckPalette.accent)
                }
            }
        }
        .preferredColorScheme(DeckThemeSelection.current.colorScheme)
    }

    private var hasChanges: Bool {
        draftTheme.rawValue != selectedThemeRaw || draftSurface.rawValue != selectedSurfaceRaw
    }

    private var appearanceActionBar: some View {
        Group {
            if horizontalSizeClass == .compact {
                VStack(spacing: 9) {
                    HStack(spacing: 10) {
                        appearanceStatus
                        Spacer(minLength: 4)
                        cancelAppearanceButton
                    }
                    applyAppearanceButton
                        .frame(maxWidth: .infinity)
                }
            } else {
                HStack(spacing: 12) {
                    appearanceStatus
                    Spacer(minLength: 8)
                    cancelAppearanceButton
                    applyAppearanceButton
                }
            }
        }
        .padding(.horizontal, horizontalSizeClass == .compact ? 14 : 24)
        .padding(.vertical, horizontalSizeClass == .compact ? 10 : 12)
        .background(DeckPalette.panel)
        .overlay(alignment: .top) {
            Rectangle().fill(DeckPalette.line).frame(height: 1)
        }
        .shadow(color: .black.opacity(0.16), radius: 10, y: -2)
    }

    private var appearanceStatus: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(hasChanges ? "UNAPPLIED PREVIEW" : "SAVED APPEARANCE")
                .deckMono(8.5, weight: .semibold)
                .tracking(1)
                .foregroundStyle(hasChanges ? DeckPalette.accent : DeckPalette.ink2)
                .lineLimit(1)
            Text("\(draftSurface.name) · \(draftTheme.name)")
                .deckMono(8)
                .foregroundStyle(DeckPalette.ink3)
                .lineLimit(1)
                .minimumScaleFactor(0.76)
        }
    }

    private var cancelAppearanceButton: some View {
        Button { dismiss() } label: {
            Text("CANCEL")
                .deckMono(8.5, weight: .semibold)
                .tracking(0.8)
                .foregroundStyle(DeckPalette.ink2)
                .padding(.horizontal, 16)
                .frame(height: 46)
                .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 8))
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(DeckPalette.line) }
        }
        .buttonStyle(DeckPressButtonStyle())
    }

    private var applyAppearanceButton: some View {
        Button {
            selectedThemeRaw = draftTheme.rawValue
            selectedSurfaceRaw = draftSurface.rawValue
            dismiss()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 25, height: 25)
                    .background(.white.opacity(0.16), in: Circle())
                Text("APPLY APPEARANCE")
                    .deckMono(9.5, weight: .semibold)
                    .tracking(0.8)
                    .lineLimit(1)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 17)
            .frame(
                minWidth: 190,
                maxWidth: horizontalSizeClass == .compact ? .infinity : 190,
                minHeight: 48
            )
            .background(
                LinearGradient(
                    colors: [draftTheme.palette.micTop, draftTheme.palette.micBottom],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                in: RoundedRectangle(cornerRadius: 9)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 9)
                    .stroke(draftTheme.palette.accent.opacity(0.75), lineWidth: 1)
            }
            .shadow(color: draftTheme.palette.accent.opacity(0.2), radius: 6, y: 2)
        }
        .buttonStyle(DeckPressButtonStyle())
    }

    private func sectionHeading(_ title: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).deckMono(9, weight: .semibold).tracking(1.7).foregroundStyle(DeckPalette.accent)
            Spacer()
            Text(detail).deckMono(8).foregroundStyle(DeckPalette.ink3)
        }
        .padding(.top, 4)
    }
}

private struct SurfaceMiniature: View {
    let surface: DeckSurfaceID

    var body: some View {
        ZStack {
            DeckPalette.plate
            switch surface {
            case .console:
                HStack(spacing: 4) { rows(6); activeField }
            case .cluster:
                VStack(spacing: 4) { Circle().stroke(DeckPalette.accent, lineWidth: 2).frame(width: 48, height: 48); keys(9, columns: 9) }
            case .flightDeck:
                HStack(spacing: 3) {
                    ForEach(0..<6, id: \.self) { index in
                        VStack(spacing: 2) {
                            Capsule().fill(DeckPalette.line).frame(width: 2)
                            HStack(spacing: 1) {
                                ForEach(0..<3, id: \.self) { detent in
                                    Circle()
                                        .fill(detent == (2 - index % 3) ? DeckPalette.accent : DeckPalette.ink4)
                                        .frame(width: 2.5, height: 2.5)
                                }
                            }
                            .frame(height: 4)
                        }
                            .padding(3).background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 2))
                    }
                }
            case .checklist:
                rows(7)
            case .pfd:
                VStack(spacing: 4) { activeField; keys(9, columns: 9) }
            case .micro:
                VStack(spacing: 4) { keys(9, columns: 3); RoundedRectangle(cornerRadius: 3).fill(DeckPalette.accent).frame(height: 10) }
            }
        }
        .padding(7)
        .frame(height: 82)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay { RoundedRectangle(cornerRadius: 6).stroke(DeckPalette.line) }
    }

    private func keys(_ count: Int, columns: Int) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: columns), spacing: 2) {
            ForEach(0..<count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(index == 1 ? DeckPalette.accentDark : DeckPalette.cell)
                    .overlay { RoundedRectangle(cornerRadius: 1.5).stroke(index == 1 ? DeckPalette.accent : DeckPalette.line, lineWidth: 0.5) }
                    .frame(minHeight: columns == 3 ? 14 : 9)
            }
        }
    }

    private func rows(_ count: Int) -> some View {
        VStack(spacing: 2) {
            ForEach(0..<count, id: \.self) { index in
                HStack(spacing: 3) {
                    RoundedRectangle(cornerRadius: 1).fill(index == 1 ? DeckPalette.accent : DeckPalette.ink3).frame(width: 12, height: 2)
                    RoundedRectangle(cornerRadius: 1).fill(DeckPalette.line).frame(height: 2)
                }
                .padding(2)
                .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 1.5))
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var activeField: some View {
        VStack(spacing: 4) {
            Text("02").font(.system(size: 14, weight: .semibold, design: .monospaced)).foregroundStyle(DeckPalette.accent)
            RoundedRectangle(cornerRadius: 1).fill(DeckPalette.accent).frame(width: 32, height: 2)
            RoundedRectangle(cornerRadius: 1).fill(DeckPalette.line).frame(width: 44, height: 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 3))
        .overlay { RoundedRectangle(cornerRadius: 3).stroke(DeckPalette.line) }
    }
}

private struct HybridThemeMiniature: View {
    let theme: DeckThemeID
    private var palette: DeckThemePalette { theme.palette }

    var body: some View {
        VStack(spacing: 5) {
            HStack(spacing: 4) {
                RoundedRectangle(cornerRadius: 2).fill(palette.accent).frame(width: 15, height: 4)
                RoundedRectangle(cornerRadius: 2).fill(palette.ink3).frame(width: 42, height: 3)
                Spacer()
                Circle().fill(palette.accent).frame(width: 4, height: 4)
                RoundedRectangle(cornerRadius: 2).fill(palette.line).frame(width: 24, height: 4)
            }

            HStack(spacing: 5) {
                VStack(spacing: 4) {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 3), spacing: 3) {
                        ForEach(0..<9, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 2.5)
                                .fill(index == 1 ? palette.accentDark : palette.pad)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 2.5)
                                        .stroke(index == 1 ? palette.accent : palette.line, lineWidth: 0.7)
                                }
                                .overlay(alignment: .topLeading) {
                                    Text("\(index + 1)")
                                        .font(.system(size: 4.5, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(index == 1 ? palette.accent : palette.ink2)
                                        .padding(2)
                                }
                                .frame(height: 20)
                        }
                    }
                    RoundedRectangle(cornerRadius: 3)
                        .fill(LinearGradient(colors: [palette.micTop, palette.micBottom], startPoint: .top, endPoint: .bottom))
                        .frame(height: 15)
                        .overlay {
                            HStack(spacing: 2) {
                                Circle().fill(.white.opacity(0.9)).frame(width: 6, height: 6)
                                RoundedRectangle(cornerRadius: 1).fill(.white.opacity(0.72)).frame(width: 32, height: 2)
                            }
                        }
                }
                .padding(5)
                .frame(maxWidth: .infinity)
                .background(palette.plate, in: RoundedRectangle(cornerRadius: 4))

                VStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                RoundedRectangle(cornerRadius: 1).fill(index == 0 ? palette.accent : palette.ink3).frame(width: 20 + CGFloat(index * 5), height: 2.5)
                                Spacer()
                                Circle().fill(index == 1 ? palette.amber : palette.accent).frame(width: 3, height: 3)
                            }
                            RoundedRectangle(cornerRadius: 1).fill(palette.line).frame(height: 2)
                            RoundedRectangle(cornerRadius: 1).fill(palette.lineSoft).frame(width: 38, height: 2)
                        }
                        .padding(5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(palette.cell, in: RoundedRectangle(cornerRadius: 3))
                    }
                }
                .padding(5)
                .frame(maxWidth: .infinity)
                .background(palette.panel, in: RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding(7)
        .frame(height: 118)
        .background(palette.page, in: RoundedRectangle(cornerRadius: 7))
        .overlay { RoundedRectangle(cornerRadius: 7).stroke(palette.line) }
    }
}

struct DeckCompanionView: View {
    @ObservedObject var connection: DeckConnection
    let deck: DiscoveredDeck
    let onFindDecks: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("COMPANION LINK")
                        .deckMono(9, weight: .semibold)
                        .tracking(1.8)
                        .foregroundStyle(DeckPalette.accent)
                    Text(deck.displayName)
                        .font(.system(size: 27, weight: .semibold, design: .rounded))
                        .foregroundStyle(DeckPalette.ink)
                    Text("The native controls and WebKit lane viewer share the same authoritative Mac runtime.")
                        .font(.system(size: 12.5, design: .monospaced))
                        .foregroundStyle(DeckPalette.ink3)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 12) {
                    SignalBars(active: connection.state == .connected)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(connection.state.label)
                            .deckMono(10, weight: .semibold)
                            .tracking(1.4)
                            .foregroundStyle(DeckPalette.accent)
                        Text(connection.localStatus ?? "Native link ready")
                            .deckMono(9)
                            .foregroundStyle(DeckPalette.ink3)
                    }
                    Spacer()
                }
                .padding(14)
                .background(DeckPalette.cell, in: RoundedRectangle(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).stroke(DeckPalette.line) }

                VStack(spacing: 0) {
                    fact("PAIRING", "Approved iPad · Keychain")
                    Divider().overlay(DeckPalette.lineSoft)
                    fact("ROUTE", deck.url.scheme == "https" ? "Private HTTPS + WebSocket" : "Local network")
                    Divider().overlay(DeckPalette.lineSoft)
                    fact("HOST", deck.url.host ?? "Unknown Mac")
                    Divider().overlay(DeckPalette.lineSoft)
                    fact("AUDIO", "Native iPad player · Parakeet capture")
                }
                .background(DeckPalette.panel, in: RoundedRectangle(cornerRadius: 10))
                .overlay { RoundedRectangle(cornerRadius: 10).stroke(DeckPalette.line) }

                HStack(spacing: 10) {
                    Button("RECONNECT NOW") { connection.reconnectNow() }
                        .buttonStyle(.borderedProminent)
                        .tint(DeckPalette.accent)
                        .foregroundStyle(DeckPalette.accentDark)
                    Button("FIND MACS AGAIN") {
                        onFindDecks()
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                    Button(copied ? "COPIED" : "COPY DIAGNOSTICS") {
                        UIPasteboard.general.string = diagnostics
                        copied = true
                    }
                    .buttonStyle(.bordered)
                }
                .deckMono(8.5, weight: .semibold)

                Spacer()
            }
            .padding(24)
            .background(DeckPalette.page)
            .navigationTitle("Companion Link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(DeckPalette.accent)
                }
            }
        }
        .preferredColorScheme(DeckThemeSelection.current.colorScheme)
    }

    private func fact(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).deckMono(8, weight: .semibold).tracking(1.2).foregroundStyle(DeckPalette.ink3)
            Spacer()
            Text(value).deckMono(9, weight: .medium).foregroundStyle(DeckPalette.ink2)
        }
        .padding(.horizontal, 14)
        .frame(height: 44)
    }

    private var diagnostics: String {
        [
            "SpeakEasy Deck diagnostics",
            "Mac: \(deck.displayName)",
            "Host: \(deck.url.host ?? "unknown")",
            "Transport: \(deck.url.scheme ?? "unknown")",
            "State: \(connection.state.label)",
            "Status: \(connection.localStatus ?? "ready")",
            "Theme: \(DeckThemeSelection.current.name)",
            "Surface: native keypad + WebKit lane viewer",
        ].joined(separator: "\n")
    }
}

private struct SignalBars: View {
    let active: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(0..<4, id: \.self) { index in
                Capsule()
                    .fill(active ? DeckPalette.accent : DeckPalette.ink4)
                    .frame(width: 4, height: CGFloat(7 + index * 4))
            }
        }
        .frame(width: 26, height: 24)
    }
}
