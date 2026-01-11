export interface ProviderConfig {
  text: string;
  rate: number;
  tempDir: string;
  voice?: string;
  apiKey?: string;
  volume?: number;
  instructions?: string; // OpenAI-only: steering instructions for voice style, accent, tone
}

export interface Provider {
  speak(config: ProviderConfig): Promise<void>;
  validateConfig(): boolean;
  getErrorMessage(error: any): string;
}

export interface SpeakEasyConfig {
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini';
  systemVoice?: string;
  openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  elevenlabsVoiceId?: string;
  geminiModel?: string;
  rate?: number;
  volume?: number;
  instructions?: string; // OpenAI-only: steering instructions for voice style, accent, tone
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
    ttl?: string | number; // '7d', '1h', 86400000, etc.
    maxSize?: string | number; // '100mb', '1gb', 104857600, etc.
    dir?: string;
  };
}

export interface SpeakEasyOptions {
  priority?: 'high' | 'normal' | 'low';
  interrupt?: boolean;
  cleanup?: boolean;
  silent?: boolean; // Generate audio without playing it
}

export interface GlobalConfig {
  providers?: {
    openai?: {
      enabled?: boolean;
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      model?: string;
      apiKey?: string;
      instructions?: string; // Steering instructions for voice style, accent, tone
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
    ttl?: string | number; // '7d', '1h', 86400000, etc.
    maxSize?: string | number; // '100mb', '1gb', 104857600, etc.
    dir?: string;
  };
  hud?: {
    enabled?: boolean;
    duration?: number;
    opacity?: number;
  };
}