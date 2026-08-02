import { Provider, ProviderConfig } from '../types';
import { TTSAdapter, TTSRequest, TTSResult } from '../adapters/types';
import { toTTSRequest } from '../adapters/request';
import { playTTSResult } from '../adapters/audio';

export class ElevenLabsProvider implements TTSAdapter, Provider {
  readonly id = 'elevenlabs' as const;
  readonly capabilities = {
    cacheable: true,
    instructions: false,
    silent: true,
  };

  private apiKey: string;
  private voiceId: string;

  constructor(apiKey: string = '', voiceId: string = 'EXAVITQu4vr4xnSDxMaL') {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    const BALANCED = 0.5;
    const NATURAL = 0.5;

    try {
      const voiceId = request.voice || this.voiceId;
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text: request.text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: BALANCED,
              similarity_boost: NATURAL,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');

        if (response.status === 401) {
          if (errorBody.includes('model_deprecated')) {
            throw new Error('ElevenLabs API error: Model deprecated - updating to newer model');
          }
          throw new Error('ElevenLabs API error: Invalid API key');
        }
        if (response.status === 429) {
          throw new Error('ElevenLabs API error: Rate limit exceeded');
        }
        if (response.status === 403) {
          throw new Error(
            'ElevenLabs API error: Access forbidden - check your API key permissions'
          );
        }
        if (response.status === 422) {
          throw new Error(
            'ElevenLabs API error: Invalid voice ID or parameters - check your configuration'
          );
        }
        if (response.status === 404) {
          throw new Error(
            `ElevenLabs API error: Voice ID "${voiceId}" not found. Use a valid voice ID (e.g., EXAVITQu4vr4xnSDxMaL) not a voice name`
          );
        }
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(audioBuffer),
        format: 'mp3',
        model: 'eleven_multilingual_v2',
      };
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }
  }

  validate(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Invalid API key')) {
      return '🔑 Invalid ElevenLabs API key. Get yours at: https://elevenlabs.io/app/settings/api-keys';
    }
    if (message.includes('Access forbidden')) {
      return '🔒 ElevenLabs access forbidden. Ensure your API key has TTS permissions';
    }
    if (message.includes('Rate limit')) {
      return '⏰ ElevenLabs rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    if (message.includes('not found')) {
      return '🔊 Invalid ElevenLabs voice ID. Use a voice ID like "EXAVITQu4vr4xnSDxMaL", not a name like "nova". Find voice IDs at: https://elevenlabs.io/app/voice-library';
    }
    return `ElevenLabs TTS failed: ${message}`;
  }

  validateConfig(): boolean {
    return this.validate();
  }

  getErrorMessage(error: unknown): string {
    return this.formatError(error);
  }

  async generateAudio(config: ProviderConfig): Promise<Buffer | null> {
    const result = await this.synthesize(toTTSRequest(config, this.voiceId));
    return result.audio;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const result = await this.synthesize(toTTSRequest(config, this.voiceId));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}