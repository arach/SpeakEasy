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
    debug?: boolean;
    cache?: {
        enabled?: boolean;
        ttl?: string | number;
        maxSize?: string | number;
        dir?: string;
    };
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
    cache?: {
        enabled?: boolean;
        ttl?: string | number;
        maxSize?: string | number;
        dir?: string;
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

interface CacheLogger {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
}
interface CacheEntry {
    audioFilePath: string;
    provider: string;
    voice: string;
    rate: number;
    timestamp: number;
    text: string;
}
interface CacheMetadata {
    cacheKey: string;
    originalText: string;
    provider: string;
    voice: string;
    rate: number;
    timestamp: number;
    fileSize: number;
    filePath: string;
}
declare class TTSCache {
    private cache;
    private cacheDir;
    private maxSize?;
    private logger;
    private metadataStore;
    private metadataFile;
    constructor(cacheDir: string, ttl?: string | number, maxSize?: string | number, logger?: CacheLogger);
    private createDefaultLogger;
    get(key: string): Promise<CacheEntry | undefined>;
    set(key: string, entry: Omit<CacheEntry, 'timestamp' | 'audioFilePath'>, audioBuffer: Buffer): Promise<boolean>;
    private addMetadata;
    private loadMetadataIndex;
    private saveMetadataIndex;
    getCacheMetadata(): Promise<CacheMetadata[]>;
    findByText(text: string): Promise<CacheMetadata[]>;
    findByProvider(provider: string): Promise<CacheMetadata[]>;
    delete(key: string): Promise<boolean>;
    private deleteMetadata;
    clear(): Promise<void>;
    cleanup(maxAge?: number): Promise<void>;
    private isValidEntry;
    generateCacheKey(text: string, provider: string, voice: string, rate: number): string;
    getCacheDir(): string;
}

declare const CONFIG_FILE: string;
declare class SpeakEasy {
    private config;
    private providers;
    private isPlaying;
    private queue;
    private cache?;
    private useCache;
    private debug;
    constructor(config: SpeakEasyConfig);
    private initializeProviders;
    speak(text: string, options?: SpeakEasyOptions): Promise<void>;
    private processQueue;
    private speakText;
    private printConfigDiagnostics;
    private playCachedAudio;
    private getVoiceForProvider;
    private getApiKeyForProvider;
    private stopSpeaking;
    getCacheStats(): Promise<{
        size: number;
        dir?: string;
    }>;
}
declare const say: (text: string, provider?: "system" | "openai" | "elevenlabs" | "groq") => Promise<void>;
declare const speak: (text: string, options?: SpeakEasyOptions & {
    provider?: "system" | "openai" | "elevenlabs" | "groq";
}) => Promise<void>;

export { CONFIG_FILE, ElevenLabsProvider, GlobalConfig, GroqProvider, OpenAIProvider, Provider, ProviderConfig, SpeakEasy, SpeakEasyConfig, SpeakEasyOptions, SystemProvider, TTSCache, say, speak };
