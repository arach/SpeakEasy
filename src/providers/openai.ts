import { Provider, ProviderConfig } from '../types';
import { TTSAdapter, TTSRequest, TTSResult } from '../adapters/types';
import { toTTSRequest } from '../adapters/request';
import { playTTSResult } from '../adapters/audio';

export class OpenAIProvider implements TTSAdapter, Provider {
  readonly id = 'openai' as const;
  readonly capabilities = {
    cacheable: true,
    instructions: true,
    silent: true,
  };

  private apiKey: string;
  private voice: string;
  private instructions?: string;

  constructor(apiKey: string = '', voice: string = 'nova', instructions?: string) {
    this.apiKey = apiKey;
    this.voice = voice;
    this.instructions = instructions;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const instructions = request.instructions || this.instructions;
    if (instructions) {
      return this.synthesizeWithInstructions(request, instructions);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: request.voice || this.voice,
          input: request.text,
          speed: request.rate / 200,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            'OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.'
          );
        }
        if (response.status === 429) {
          throw new Error(
            'OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.'
          );
        }
        throw new Error(
          `OpenAI API error: ${response.status}. Check your API key and rate limits.`
        );
      }

      const audioBuffer = await response.arrayBuffer();
      return {
        audio: Buffer.from(audioBuffer),
        format: 'mp3',
        model: 'tts-1',
      };
    } catch (error) {
      throw new Error(`OpenAI TTS failed: ${error}`);
    }
  }

  private async synthesizeWithInstructions(
    request: TTSRequest,
    instructions: string
  ): Promise<TTSResult> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-audio-preview',
          modalities: ['text', 'audio'],
          audio: {
            voice: request.voice || this.voice,
            format: 'mp3',
          },
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: request.text },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            'OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.'
          );
        }
        if (response.status === 429) {
          throw new Error(
            'OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.'
          );
        }
        const errorBody = await response.text();
        throw new Error(`OpenAI API error: ${response.status}. ${errorBody}`);
      }

      const data = (await response.json()) as {
        choices: Array<{
          message: {
            audio?: { data: string };
          };
        }>;
      };

      const audioData = data.choices?.[0]?.message?.audio?.data;
      if (!audioData) {
        throw new Error('No audio data in OpenAI response');
      }

      return {
        audio: Buffer.from(audioData, 'base64'),
        format: 'mp3',
        model: 'gpt-4o-audio-preview',
      };
    } catch (error) {
      throw new Error(`OpenAI TTS with instructions failed: ${error}`);
    }
  }

  validate(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Invalid API key')) {
      return '🔑 Invalid OpenAI API key. Get yours at: https://platform.openai.com/api-keys';
    }
    if (message.includes('Rate limit')) {
      return '⏰ OpenAI rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `OpenAI TTS failed: ${message}`;
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