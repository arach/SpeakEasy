import SwiftUI

struct PadShellView: View {
    @StateObject private var model = PadShellModel()

    var body: some View {
        ZStack {
            if let link = model.pairingLink {
                PadWebView(url: link.url, reloadToken: model.reloadToken)
                    .ignoresSafeArea()
                    .overlay(alignment: .leading) {
                        shellMenu
                    }
            } else {
                PairingWelcomeView(
                    scan: model.scan,
                    paste: model.pastePairingLink
                )
            }
        }
        .background(Color(red: 0.015, green: 0.027, blue: 0.03))
        .sheet(isPresented: $model.isShowingScanner) {
            PairingScannerView(
                onCode: model.accept,
                onCancel: { model.isShowingScanner = false }
            )
            .ignoresSafeArea()
        }
        .alert("SpeakEasy Pad", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private var shellMenu: some View {
        Menu {
            Button("Scan a new Mac", systemImage: "qrcode.viewfinder", action: model.scan)
            Button("Reload Pad", systemImage: "arrow.clockwise", action: model.reload)
            Divider()
            Button("Forget this Mac", systemImage: "xmark.circle", role: .destructive, action: model.forget)
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))
                .frame(width: 30, height: 58)
                .background(.black.opacity(0.42), in: UnevenRoundedRectangle(bottomTrailingRadius: 12, topTrailingRadius: 12))
                .overlay(alignment: .trailing) {
                    Rectangle().fill(.white.opacity(0.12)).frame(width: 0.5)
                }
        }
        .accessibilityLabel("SpeakEasy Pad app options")
    }
}

private struct PairingWelcomeView: View {
    let scan: () -> Void
    let paste: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.05, green: 0.09, blue: 0.10), Color(red: 0.01, green: 0.02, blue: 0.025)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(spacing: 30) {
                VStack(spacing: 11) {
                    Text("SE")
                        .font(.system(size: 22, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(red: 0.45, green: 0.95, blue: 0.81))
                        .frame(width: 62, height: 62)
                        .background(Color(red: 0.45, green: 0.95, blue: 0.81).opacity(0.08), in: RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(.white.opacity(0.14)))
                    Text("SPEAKEASY PAD")
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .tracking(3)
                    Text("Your Mac owns the conversation. This iPad becomes the control surface.")
                        .font(.system(size: 17))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 520)
                }

                VStack(spacing: 12) {
                    Button(action: scan) {
                        Label("Scan the code on your Mac", systemImage: "qrcode.viewfinder")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PadPrimaryButtonStyle())

                    Button(action: paste) {
                        Label("Paste copied Pad link", systemImage: "doc.on.clipboard")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(.white.opacity(0.7))
                }
                .frame(maxWidth: 390)

                Text("The current day-pass is stored in this iPad’s Keychain and can be revoked from the Mac.")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 520)
            }
            .padding(40)
        }
        .ignoresSafeArea()
    }
}

private struct PadPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .padding(.horizontal, 20)
            .frame(height: 54)
            .foregroundStyle(Color(red: 0.02, green: 0.09, blue: 0.075))
            .background(Color(red: 0.45, green: 0.95, blue: 0.81), in: RoundedRectangle(cornerRadius: 12))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}
