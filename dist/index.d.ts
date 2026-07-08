interface ProviderConfig {
    text: string;
    rate: number;
    tempDir: string;
    voice?: string;
    apiKey?: string;
    volume?: number;
    instructions?: string;
}
/** @deprecated Use TTSAdapter from adapters/types instead. */
interface Provider {
    speak(config: ProviderConfig): Promise<void>;
    validateConfig(): boolean;
    getErrorMessage(error: unknown): string;
}
interface SpeakEasyConfig {
    provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini';
    systemVoice?: string;
    openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    elevenlabsVoiceId?: string;
    groqVoice?: string;
    geminiModel?: string;
    rate?: number;
    volume?: number;
    instructions?: string;
    apiKeys?: {
        openai?: string;
        elevenlabs?: string;
        groq?: string;
        gemini?: string;
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
    silent?: boolean;
}
interface GlobalConfig {
    providers?: {
        openai?: {
            enabled?: boolean;
            voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
            model?: string;
            apiKey?: string;
            instructions?: string;
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
        gemini?: {
            enabled?: boolean;
            model?: string;
            apiKey?: string;
        };
    };
    defaults?: {
        provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini';
        fallbackOrder?: string[];
        rate?: number;
        volume?: number;
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
    hud?: {
        enabled?: boolean;
        duration?: number;
        opacity?: number;
    };
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
    model?: string;
    source?: string;
    sessionId?: string;
    processId?: string;
    hostname?: string;
    user?: string;
    workingDirectory?: string;
    commandLine?: string;
    durationMs?: number;
    success?: boolean;
    errorMessage?: string;
}
interface CacheStats {
    totalEntries: number;
    totalSize: number;
    cacheHits: number;
    cacheMisses: number;
    providers: Record<string, number>;
    models: Record<string, number>;
    sources: Record<string, number>;
    dateRange: {
        earliest: Date;
        latest: Date;
    } | null;
    avgFileSize: number;
    hitRate: number;
}
type SqliteBackend = 'node' | 'bun';
declare class TTSCache {
    private cacheDir;
    private dbPath;
    private metadataFile;
    private statsFile;
    private ttlMs;
    private maxSize?;
    private logger;
    private db;
    private sqliteBackend;
    private jsonEntries;
    private useJsonFallback;
    private metadataLoaded;
    private cacheHits;
    private cacheMisses;
    constructor(cacheDir: string, ttl?: string | number, maxSize?: string | number, logger?: CacheLogger);
    private createDefaultLogger;
    private initializeStorage;
    private migrateJsonMetadataIfNeeded;
    private migrateLegacySqliteIfNeeded;
    private importStoredEntry;
    private importLegacyMetadataDb;
    private importLegacyKeyvDb;
    private ensureMetadataLoaded;
    private loadJsonMetadata;
    private saveJsonMetadata;
    private loadStats;
    private saveStats;
    private rowToStoredEntry;
    private rowToMetadata;
    private toMetadata;
    private isExpired;
    private isValidEntry;
    private inferModel;
    private getSource;
    private getSessionId;
    private upsertSqliteEntry;
    private getSqliteEntry;
    private deleteSqliteEntry;
    private deleteEntry;
    private enforceMaxSize;
    private buildSearchQuery;
    private filterJsonMetadata;
    private calculateStats;
    get(key: string): Promise<CacheEntry | undefined>;
    set(key: string, entry: Omit<CacheEntry, 'timestamp' | 'audioFilePath'>, audioBuffer: Buffer, options?: {
        model?: string;
        source?: string;
        durationMs?: number;
        success?: boolean;
        errorMessage?: string;
        extension?: 'mp3' | 'wav' | 'aiff';
    }): Promise<boolean>;
    getCacheMetadata(): Promise<CacheMetadata[]>;
    findByText(text: string): Promise<CacheMetadata[]>;
    findByProvider(provider: string): Promise<CacheMetadata[]>;
    search(options?: {
        text?: string;
        provider?: string;
        model?: string;
        source?: string;
        fromDate?: Date;
        toDate?: Date;
        minSize?: number;
        maxSize?: number;
        success?: boolean;
        workingDirectory?: string;
        user?: string;
        sessionId?: string;
        limit?: number;
        offset?: number;
    }): Promise<CacheMetadata[]>;
    getStats(): Promise<CacheStats>;
    getRecent(limit?: number): Promise<CacheMetadata[]>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    cleanup(maxAge?: number): Promise<void>;
    generateCacheKey(text: string, provider: string, voice: string, rate: number, instructions?: string): string;
    getCacheDir(): string;
    getEntryCount(): number;
    usesSqlite(): boolean;
    getSqliteBackend(): SqliteBackend | 'json';
}

type TTSProviderId = 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini';
type TTSAudioFormat = 'mp3' | 'wav' | 'aiff';
interface TTSRequest {
    text: string;
    voice: string;
    rate: number;
    volume: number;
    tempDir: string;
    apiKey?: string;
    instructions?: string;
}
interface TTSResult {
    audio: Buffer;
    format: TTSAudioFormat;
    model?: string;
}
interface TTSAdapterCapabilities {
    /** Audio can be written to the shared SQLite/file cache. */
    cacheable: boolean;
    /** Provider accepts steering instructions (accent, tone, etc.). */
    instructions: boolean;
    /** Caller can synthesize without playing (silent mode). */
    silent: boolean;
}
interface TTSAdapter {
    readonly id: TTSProviderId;
    readonly capabilities: TTSAdapterCapabilities;
    validate(): boolean;
    synthesize(request: TTSRequest): Promise<TTSResult>;
    formatError(error: unknown): string;
}

declare const PROVIDER_ORDER: TTSProviderId[];
declare function createAdapterRegistry(config: SpeakEasyConfig): Map<TTSProviderId, TTSAdapter>;

declare function playAudioFile(filePath: string, volume?: number): Promise<void>;
declare function playTTSResult(result: TTSResult, volume: number, tempDir: string): Promise<void>;
declare function stopPlayback(): void;

declare function getAvailableVoices(): string[];
declare function getBestVoice(language?: string): string;
declare class SystemProvider implements TTSAdapter, Provider {
    readonly id: "system";
    readonly capabilities: {
        cacheable: boolean;
        instructions: boolean;
        silent: boolean;
    };
    private voice;
    constructor(voice?: string);
    synthesize(request: TTSRequest): Promise<TTSResult>;
    validate(): boolean;
    formatError(error: unknown): string;
    validateConfig(): boolean;
    getErrorMessage(error: unknown): string;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    speak(config: ProviderConfig): Promise<void>;
}

declare class OpenAIProvider implements TTSAdapter, Provider {
    readonly id: "openai";
    readonly capabilities: {
        cacheable: boolean;
        instructions: boolean;
        silent: boolean;
    };
    private apiKey;
    private voice;
    private instructions?;
    constructor(apiKey?: string, voice?: string, instructions?: string);
    synthesize(request: TTSRequest): Promise<TTSResult>;
    private synthesizeWithInstructions;
    validate(): boolean;
    formatError(error: unknown): string;
    validateConfig(): boolean;
    getErrorMessage(error: unknown): string;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    speak(config: ProviderConfig): Promise<void>;
}

declare class ElevenLabsProvider implements TTSAdapter, Provider {
    readonly id: "elevenlabs";
    readonly capabilities: {
        cacheable: boolean;
        instructions: boolean;
        silent: boolean;
    };
    private apiKey;
    private voiceId;
    constructor(apiKey?: string, voiceId?: string);
    synthesize(request: TTSRequest): Promise<TTSResult>;
    validate(): boolean;
    formatError(error: unknown): string;
    validateConfig(): boolean;
    getErrorMessage(error: unknown): string;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    speak(config: ProviderConfig): Promise<void>;
}

declare class GroqProvider implements TTSAdapter, Provider {
    readonly id: "groq";
    readonly capabilities: {
        cacheable: boolean;
        instructions: boolean;
        silent: boolean;
    };
    private apiKey;
    private voice;
    constructor(apiKey?: string, voice?: string);
    synthesize(request: TTSRequest): Promise<TTSResult>;
    validate(): boolean;
    formatError(error: unknown): string;
    validateConfig(): boolean;
    getErrorMessage(error: unknown): string;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    speak(config: ProviderConfig): Promise<void>;
}

declare class GeminiProvider implements TTSAdapter, Provider {
    readonly id: "gemini";
    readonly capabilities: {
        cacheable: boolean;
        instructions: boolean;
        silent: boolean;
    };
    private apiKey;
    private model;
    private voiceName;
    constructor(apiKey?: string, model?: string, voiceName?: string);
    synthesize(request: TTSRequest): Promise<TTSResult>;
    private convertToWav;
    private parseMimeType;
    private createWavHeader;
    validate(): boolean;
    formatError(error: unknown): string;
    validateConfig(): boolean;
    getErrorMessage(error: unknown): string;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    speak(config: ProviderConfig): Promise<void>;
}

declare const CONFIG_FILE: string;
declare class SpeakEasy {
    private config;
    private adapters;
    private isPlaying;
    private queue;
    private cache?;
    private useCache;
    private debug;
    private hudEnabled;
    constructor(config: SpeakEasyConfig);
    speak(text: string, options?: SpeakEasyOptions): Promise<void>;
    private processQueue;
    private speakText;
    private buildRequest;
    private printConfigDiagnostics;
    private getVoiceForProvider;
    private getApiKeyForProvider;
    private sendHUDNotification;
    private stopSpeaking;
    private requireCache;
    getCacheStats(): Promise<CacheStats & {
        dir?: string;
    }>;
    getCacheMetadata(): Promise<CacheMetadata[]>;
    findByText(text: string): Promise<CacheMetadata[]>;
    findByProvider(provider: string): Promise<CacheMetadata[]>;
}
declare const say: (text: string, provider?: "system" | "openai" | "elevenlabs" | "groq" | "gemini") => Promise<void>;
declare const speak: (text: string, options?: SpeakEasyOptions & {
    provider?: "system" | "openai" | "elevenlabs" | "groq" | "gemini";
    volume?: number;
}) => Promise<void>;

export { CONFIG_FILE, type CacheMetadata, type CacheStats, ElevenLabsProvider, GeminiProvider, type GlobalConfig, GroqProvider, OpenAIProvider, PROVIDER_ORDER, type Provider, type ProviderConfig, SpeakEasy, type SpeakEasyConfig, type SpeakEasyOptions, SystemProvider, type TTSAdapter, type TTSAdapterCapabilities, type TTSAudioFormat, TTSCache, type TTSProviderId, type TTSRequest, type TTSResult, createAdapterRegistry, getAvailableVoices, getBestVoice, playAudioFile, playTTSResult, say, speak, stopPlayback };
