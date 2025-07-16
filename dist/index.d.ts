interface ProviderConfig {
    text: string;
    rate: number;
    tempDir: string;
    voice?: string;
    apiKey?: string;
}
interface Provider {
    speak(config: ProviderConfig): Promise<void>;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
}
interface SpeakEasyConfig {
    provider?: 'system' | 'openai' | 'elevenlabs' | 'groq';
    systemVoice?: string;
    openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    elevenlabsVoiceId?: string;
    rate?: number;
    apiKeys?: {
        openai?: string;
        elevenlabs?: string;
        groq?: string;
    };
    tempDir?: string;
}
interface SpeakEasyOptions {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
    cleanup?: boolean;
}
interface GlobalConfig {
    providers?: {
        openai?: {
            enabled?: boolean;
            voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
            model?: string;
            apiKey?: string;
        };
        elevenlabs?: {
            enabled?: boolean;
            voiceId?: string;
            modelId?: string;
            apiKey?: string;
        };
        system?: {
            enabled?: boolean;
            voice?: string;
        };
        groq?: {
            enabled?: boolean;
            voice?: string;
            model?: string;
            apiKey?: string;
        };
    };
    defaults?: {
        provider?: 'system' | 'openai' | 'elevenlabs' | 'groq';
        fallbackOrder?: string[];
        rate?: number;
    };
    global?: {
        tempDir?: string;
        cleanup?: boolean;
    };
}

declare class SystemProvider implements Provider {
    private voice;
    constructor(voice?: string);
    speak(config: ProviderConfig): Promise<void>;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
}

declare class OpenAIProvider implements Provider {
    private apiKey;
    private voice;
    constructor(apiKey?: string, voice?: string);
    speak(config: ProviderConfig): Promise<void>;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
}

declare class ElevenLabsProvider implements Provider {
    private apiKey;
    private voiceId;
    constructor(apiKey?: string, voiceId?: string);
    speak(config: ProviderConfig): Promise<void>;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
}

declare class GroqProvider implements Provider {
    private apiKey;
    private voice;
    constructor(apiKey?: string, voice?: string);
    speak(config: ProviderConfig): Promise<void>;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
}

declare const CONFIG_FILE: string;
declare class SpeakEasy {
    private config;
    private providers;
    private isPlaying;
    private queue;
    private cache;
    private useCache;
    constructor(config: SpeakEasyConfig, useCache?: boolean);
    private initializeProviders;
    static builder(): SpeakEasyBuilder;
    speak(text: string, options?: SpeakEasyOptions): Promise<void>;
    private processQueue;
    private speakText;
    private playCachedAudio;
    private getVoiceForProvider;
    private getApiKeyForProvider;
    private stopSpeaking;
    clearQueue(): void;
    clearCache(): Promise<void>;
    cleanupCache(maxAge?: number): Promise<void>;
    enableCache(): void;
    disableCache(): void;
    getCacheStats(): Promise<{
        size: number;
        dir: string;
    }>;
}
declare class SpeakEasyBuilder {
    private config;
    withProvider(provider: 'system' | 'openai' | 'elevenlabs' | 'groq'): this;
    withSystemVoice(voice: string): this;
    withOpenAIVoice(voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'): this;
    withElevenLabsVoice(voiceId: string): this;
    withRate(rate: number): this;
    withApiKeys(keys: Partial<SpeakEasyConfig['apiKeys']>): this;
    withTempDir(dir: string): this;
    build(): SpeakEasy;
}
declare const say: (text: string, provider?: "system" | "openai" | "elevenlabs" | "groq", useCache?: boolean) => Promise<void>;
declare const speak: (text: string, options?: SpeakEasyOptions & {
    provider?: "system" | "openai" | "elevenlabs" | "groq";
}, useCache?: boolean) => Promise<void>;

export { CONFIG_FILE, ElevenLabsProvider, GlobalConfig, GroqProvider, OpenAIProvider, Provider, ProviderConfig, SpeakEasy, SpeakEasyBuilder, SpeakEasyConfig, SpeakEasyOptions, SystemProvider, say, speak };
