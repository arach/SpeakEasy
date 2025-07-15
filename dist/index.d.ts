export interface SpeechConfig {
    provider: 'system' | 'openai' | 'elevenlabs';
    systemVoice?: string;
    openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    elevenlabsVoiceId?: string;
    rate?: number;
    apiKeys?: {
        openai?: string;
        elevenlabs?: string;
    };
    tempDir?: string;
}
export interface SpeechOptions {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
    cleanup?: boolean;
}
export declare class SpeechService {
    private config;
    private isPlaying;
    private queue;
    constructor(config: SpeechConfig);
    speak(text: string, options?: SpeechOptions): Promise<void>;
    private processQueue;
    private speakText;
    private cleanTextForSpeech;
    private speakWithSystem;
    private speakWithOpenAI;
    private speakWithElevenLabs;
    private stopSpeaking;
    clearQueue(): void;
}
export declare const createSpeechService: {
    forNotifications: () => SpeechService;
    forDevelopment: () => SpeechService;
    forProduction: () => SpeechService;
};
export declare const defaultSpeechService: SpeechService;
//# sourceMappingURL=index.d.ts.map