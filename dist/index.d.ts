export declare const CONFIG_FILE: string;
export interface SpeakEasyConfig {
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
export interface SpeakEasyOptions {
    priority?: 'high' | 'normal' | 'low';
    interrupt?: boolean;
    cleanup?: boolean;
}
export declare class SpeakEasy {
    private config;
    private isPlaying;
    private queue;
    constructor(config: SpeakEasyConfig);
    speak(text: string, options?: SpeakEasyOptions): Promise<void>;
    private processQueue;
    private speakText;
    private cleanTextForSpeech;
    private speakWithSystem;
    private speakWithOpenAI;
    private speakWithElevenLabs;
    private speakWithGroq;
    private stopSpeaking;
    clearQueue(): void;
}
export declare const say: (text: string, provider?: "system" | "openai" | "elevenlabs" | "groq") => Promise<void>;
export declare const speak: (text: string, options?: SpeakEasyOptions & {
    provider?: "system" | "openai" | "elevenlabs";
}) => Promise<void>;
//# sourceMappingURL=index.d.ts.map