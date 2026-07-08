export type TTSProviderId = 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini';

export type TTSAudioFormat = 'mp3' | 'wav' | 'aiff';

export interface TTSRequest {
  text: string;
  voice: string;
  rate: number;
  volume: number;
  tempDir: string;
  apiKey?: string;
  instructions?: string;
}

export interface TTSResult {
  audio: Buffer;
  format: TTSAudioFormat;
  model?: string;
}

export interface TTSAdapterCapabilities {
  /** Audio can be written to the shared SQLite/file cache. */
  cacheable: boolean;
  /** Provider accepts steering instructions (accent, tone, etc.). */
  instructions: boolean;
  /** Caller can synthesize without playing (silent mode). */
  silent: boolean;
}

export interface TTSAdapter {
  readonly id: TTSProviderId;
  readonly capabilities: TTSAdapterCapabilities;
  validate(): boolean;
  synthesize(request: TTSRequest): Promise<TTSResult>;
  formatError(error: unknown): string;
}