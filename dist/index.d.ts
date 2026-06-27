interface ProviderConfig {
    text: string;
    rate: number;
    tempDir: string;
    voice?: string;
    apiKey?: string;
    volume?: number;
    instructions?: string;
}
interface Provider {
    speak(config: ProviderConfig): Promise<void>;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
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
        extension?: 'mp3' | 'wav';
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
    generateCacheKey(text: string, provider: string, voice: string, rate: number): string;
    getCacheDir(): string;
    getEntryCount(): number;
    usesSqlite(): boolean;
    getSqliteBackend(): SqliteBackend | 'json';
}

/**
 * Get all available system voices on macOS
 */
declare function getAvailableVoices(): string[];
/**
 * Get the best available voice for the given language
 */
declare function getBestVoice(language?: string): string;
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
    private instructions?;
    constructor(apiKey?: string, voice?: string, instructions?: string);
    speak(config: ProviderConfig): Promise<void>;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    private generateAudioWithInstructions;
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

declare class GeminiProvider implements Provider {
    private apiKey;
    private model;
    private voiceName;
    constructor(apiKey?: string, model?: string, voiceName?: string);
    speak(config: ProviderConfig): Promise<void>;
    generateAudio(config: ProviderConfig): Promise<Buffer | null>;
    private convertToWav;
    private parseMimeType;
    private createWavHeader;
    validateConfig(): boolean;
    getErrorMessage(error: any): string;
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
    private hudEnabled;
    constructor(config: SpeakEasyConfig);
    private initializeProviders;
    speak(text: string, options?: SpeakEasyOptions): Promise<void>;
    private processQueue;
    private speakText;
    private printConfigDiagnostics;
    private playCachedAudio;
    private getVoiceForProvider;
    private getApiKeyForProvider;
    private inferModel;
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

export { CONFIG_FILE, type CacheMetadata, type CacheStats, ElevenLabsProvider, GeminiProvider, type GlobalConfig, GroqProvider, OpenAIProvider, type Provider, type ProviderConfig, SpeakEasy, type SpeakEasyConfig, type SpeakEasyOptions, SystemProvider, TTSCache, getAvailableVoices, getBestVoice, say, speak };
