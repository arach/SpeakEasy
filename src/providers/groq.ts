import { Provider, ProviderConfig } from '../types';
import { TTSAdapter, TTSRequest, TTSResult } from '../adapters/types';
import { toTTSRequest } from '../adapters/request';
import { playTTSResult } from '../adapters/audio';

export class GroqProvider implements TTSAdapter, Provider {
  readonly id = 'groq' as const;
  readonly capabilities = {
    cacheable: true,
    instructions: false,
    silent: true,
  };

  private apiKey: string;
  private voice: string;

  constructor(apiKey: string = '', voice: string = 'tara') {
    this.apiKey = apiKey;
    this.voice = voice;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error('Groq API key is required');
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'canopylabs/orpheus-v1-english',
          voice: request.voice || this.voice,
          input: request.text,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        if (response.status === 401) {
          throw new Error('Groq API error: Invalid API key');
        }
        if (response.status === 429) {
          throw new Error('Groq API error: Rate limit exceeded');
        }
        if (response.status === 400) {
          throw new Error(
            `Groq API error: Bad request - ${errorBody || 'check voice name and parameters'}`
          );
        }
        throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(audioBuffer),
        format: 'mp3',
        model: 'canopylabs/orpheus-v1-english',
      };
    } catch (error) {
      throw new Error(`Groq TTS failed: ${error}`);
    }
  }

  validate(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Invalid API key')) {
      return '🔑 Invalid Groq API key. Get yours at: https://console.groq.com/keys';
    }
    if (message.includes('Rate limit')) {
      return '⏰ Groq rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `Groq TTS failed: ${message}`;
  }

  validateConfig(): boolean {
    return this.validate();
  }

  getErrorMessage(error: unknown): string {
    return this.formatError(error);
  }

  async generateAudio(config: ProviderConfig): Promise<Buffer | null> {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    return result.audio;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}