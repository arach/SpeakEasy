import SwiftUI
import HudsonUI

struct ProviderSettingsView: View {
    @EnvironmentObject private var config: ConfigManager
    @Binding var selection: SpeechProviderID

    var body: some View {
        HStack(alignment: .top, spacing: HudSpacing.xl) {
            VStack(alignment: .leading, spacing: HudSpacing.sm) {
                ForEach(SpeechProviderCatalog.all) { provider in
                    providerRow(provider)
                }
            }
            .frame(width: 236)

            HudDivider(axis: .vertical)

            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                providerIdentity
                providerDetail
            }
                .frame(maxWidth: 760, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private func providerRow(_ provider: SpeechProviderDescriptor) -> some View {
        let configured = isConfigured(provider.id)
        return ProviderNavigationRow(
            provider: provider,
            isSelected: selection == provider.id,
            isConfigured: configured,
            isDefault: config.defaultProvider == provider.id.rawValue,
            onTap: { selection = provider.id }
        )
    }

    private var providerIdentity: some View {
        let provider = SpeechProviderCatalog.descriptor(for: selection)
        let isDefault = config.defaultProvider == selection.rawValue
        return HStack(spacing: HudSpacing.md) {
            VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                Text(provider.name)
                    .font(HudFont.ui(HudTextSize.md, weight: .semibold))
                    .foregroundStyle(HudPalette.ink)
                Text(provider.summary)
                    .font(HudFont.ui(HudTextSize.xs))
                    .foregroundStyle(HudPalette.muted)
            }
            Spacer(minLength: 0)
            if isDefault {
                Label("Default provider", systemImage: "checkmark.seal.fill")
                    .font(HudFont.ui(HudTextSize.xs, weight: .medium))
                    .foregroundStyle(HudPalette.muted)
            } else {
                Button("Set as Default") {
                    config.defaultProvider = selection.rawValue
                }
                .buttonStyle(.plain)
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudTint.green.color)
            }
        }
        .frame(height: 40)
    }

    @ViewBuilder
    private var providerDetail: some View {
        switch selection {
        case .openai:
            OpenAIPlaygroundView()
        case .elevenlabs:
            ElevenLabsPlaygroundView()
        case .groq:
            GroqSettingsView()
        case .gemini:
            GeminiSettingsView()
        case .system:
            SystemSettingsView()
        }
    }

    private func isConfigured(_ provider: SpeechProviderID) -> Bool {
        switch provider {
        case .openai: return !config.openaiApiKey.isEmpty
        case .elevenlabs: return !config.elevenlabsApiKey.isEmpty
        case .groq: return !config.groqApiKey.isEmpty
        case .gemini: return !config.geminiApiKey.isEmpty
        case .system: return true
        }
    }
}

private struct ProviderNavigationRow: View {
    let provider: SpeechProviderDescriptor
    let isSelected: Bool
    let isConfigured: Bool
    let isDefault: Bool
    let onTap: () -> Void

    @Environment(\.hudTheme) private var theme
    @State private var isHovering = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: HudSpacing.md) {
                Image(systemName: provider.icon)
                    .font(HudFont.ui(HudTextSize.sm, weight: .medium))
                    .foregroundStyle(isSelected ? HudTint.green.color : theme.palette.muted)
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: theme.radius.standard)
                            .fill(isSelected ? HudSurface.tintFill(HudTint.green.color) : HudSurface.inset)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: theme.radius.standard)
                            .stroke(isSelected ? HudSurface.tintBorder(HudTint.green.color) : theme.hairline.subtle)
                    )

                VStack(alignment: .leading, spacing: HudSpacing.xxs) {
                    Text(provider.name)
                        .font(HudFont.ui(HudTextSize.sm, weight: isSelected ? .semibold : .medium))
                        .foregroundStyle(theme.palette.ink)
                    Text(provider.summary)
                        .font(HudFont.ui(HudTextSize.xs, weight: .light))
                        .foregroundStyle(theme.palette.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: HudSpacing.xs)

                HudBadge(
                    isDefault ? "DEFAULT" : isConfigured ? "READY" : "SETUP",
                    tint: isDefault ? HudPalette.muted : isConfigured ? HudPalette.statusOk : HudPalette.muted,
                    dot: isConfigured && !isDefault
                )
            }
            .padding(.horizontal, HudSpacing.md)
            .frame(height: 52)
            .background(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .fill(isSelected ? HudSurface.tintGhost(HudTint.green.color) : isHovering ? HudSurface.hover : HudSurface.inset)
            )
            .overlay(
                RoundedRectangle(cornerRadius: theme.radius.standard)
                    .stroke(isSelected ? HudSurface.tintBorder(HudTint.green.color) : theme.hairline.subtle)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .accessibilityLabel("\(provider.name), \(isConfigured ? "ready" : "setup required")")
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

struct ProviderAPIKeySection: View {
    let provider: SpeechProviderDescriptor
    @Binding var apiKey: String

    var body: some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.md) {
                    Image(systemName: "key.fill")
                        .foregroundStyle(HudPalette.muted)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("API Key")
                            .font(HudFont.ui(13, weight: .semibold))
                            .foregroundStyle(HudPalette.ink)
                        Text("Stored in SpeakEasy's local configuration")
                            .font(HudFont.ui(10))
                            .foregroundStyle(HudPalette.muted)
                    }
                    Spacer()
                    HudBadge(
                        apiKey.isEmpty ? "NOT CONFIGURED" : "CONFIGURED",
                        tint: apiKey.isEmpty ? HudPalette.muted : HudPalette.statusOk,
                        dot: true
                    )
                }

                HudSecretField(provider.apiKeyPlaceholder ?? "API key", text: $apiKey)

                HStack {
                    Text(apiKey.isEmpty
                         ? "Add a key to enable \(provider.name) generation and previews."
                         : "\(provider.name) is ready to use after saving settings.")
                        .font(HudFont.ui(10))
                        .foregroundStyle(HudPalette.muted)
                    Spacer()
                    if let url = provider.apiKeyURL {
                        Link("Get API Key", destination: url)
                            .font(HudFont.ui(10, weight: .semibold))
                            .foregroundStyle(HudTint.green.color)
                    }
                }
            }
        }
    }
}

struct GroqSettingsView: View {
    @EnvironmentObject private var config: ConfigManager

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            ProviderAPIKeySection(
                provider: SpeechProviderCatalog.descriptor(for: .groq),
                apiKey: Binding(get: { config.groqApiKey }, set: { config.groqApiKey = $0 })
            )
            providerFields(
                model: Binding(get: { config.groqModel }, set: { config.groqModel = $0 }),
                voice: Binding(get: { config.groqVoice }, set: { config.groqVoice = $0 })
            )
        }
    }

    private func providerFields(model: Binding<String>, voice: Binding<String>) -> some View {
        HudCard {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudSectionLabel("Generation")
                LabeledContent("Model") { TextField("Model", text: model).textFieldStyle(.roundedBorder) }
                LabeledContent("Voice") { TextField("Voice", text: voice).textFieldStyle(.roundedBorder) }
            }
        }
    }
}

struct GeminiSettingsView: View {
    @EnvironmentObject private var config: ConfigManager

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.xl) {
            ProviderAPIKeySection(
                provider: SpeechProviderCatalog.descriptor(for: .gemini),
                apiKey: Binding(get: { config.geminiApiKey }, set: { config.geminiApiKey = $0 })
            )
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    HudSectionLabel("Generation")
                    LabeledContent("Model") {
                        TextField("Model", text: Binding(
                            get: { config.geminiModel },
                            set: { config.geminiModel = $0 }
                        ))
                        .textFieldStyle(.roundedBorder)
                    }
                    LabeledContent("Voice") {
                        TextField("Voice", text: Binding(
                            get: { config.geminiVoice },
                            set: { config.geminiVoice = $0 }
                        ))
                        .textFieldStyle(.roundedBorder)
                    }
                }
            }
        }
    }
}
