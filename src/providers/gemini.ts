import { Provider, ProviderConfig } from '../types';
import { TTSAdapter, TTSRequest, TTSResult } from '../adapters/types';
import { toTTSRequest } from '../adapters/request';
import { playTTSResult } from '../adapters/audio';

export class GeminiProvider implements TTSAdapter, Provider {
  readonly id = 'gemini' as const;
  readonly capabilities = {
    cacheable: true,
    instructions: false,
    silent: true,
  };

  private apiKey: string;
  private model: string;
  private voiceName: string;

  constructor(
    apiKey: string = '',
    model: string = 'gemini-2.5-flash-preview-tts',
    voiceName: string = 'Puck'
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.voiceName = voiceName;
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: request.text }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: request.voice || this.voiceName,
                  },
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const error = JSON.parse(errorData);
          errorMessage = error.error?.message || errorMessage;
        } catch {
          // Use raw error if not JSON
        }

        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key');
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as any;

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]) {
        const part = data.candidates[0].content.parts[0];

        if ('inlineData' in part && part.inlineData) {
          const audioData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'audio/wav';
          const buffer = Buffer.from(audioData, 'base64');

          if (mimeType.includes('wav')) {
            return { audio: buffer, format: 'wav', model: this.model };
          }

          return {
            audio: this.convertToWav(buffer, mimeType),
            format: 'wav',
            model: this.model,
          };
        }
      }

      throw new Error('No audio content received from Gemini API');
    } catch (error: any) {
      if (error.message?.includes('API key') || error.message?.includes('Invalid API key')) {
        throw new Error(
          'Gemini API error: Invalid API key. Check your GEMINI_API_KEY environment variable.'
        );
      }
      if (
        error.message?.includes('quota') ||
        error.message?.includes('rate') ||
        error.message?.includes('Rate limit')
      ) {
        throw new Error(
          'Gemini API error: Rate limit exceeded. Try again later or reduce request frequency.'
        );
      }
      if (error.message?.includes('model')) {
        throw new Error(
          `Gemini API error: Model '${this.model}' may not support audio generation. Try 'gemini-2.5-flash-preview-tts' or check available models.`
        );
      }
      throw new Error(`Gemini TTS failed: ${error.message || error}`);
    }
  }

  private convertToWav(rawData: Buffer, mimeType: string): Buffer {
    const options = this.parseMimeType(mimeType);
    const wavHeader = this.createWavHeader(rawData.length, options);
    return Buffer.concat([wavHeader, rawData]);
  }

  private parseMimeType(mimeType: string): {
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
  } {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [, format] = fileType.split('/');

    const options = {
      numChannels: 1,
      sampleRate: 24000,
      bitsPerSample: 16,
    };

    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
        const rate = parseInt(value, 10);
        if (!isNaN(rate)) {
          options.sampleRate = rate;
        }
      }
    }

    return options;
  }

  private createWavHeader(
    dataLength: number,
    options: { numChannels: number; sampleRate: number; bitsPerSample: number }
  ): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
  }

  validate(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Invalid API key')) {
      return '🔑 Invalid Gemini API key. Get yours at: https://aistudio.google.com/apikey';
    }
    if (message.includes('Rate limit') || message.includes('quota')) {
      return '⏰ Gemini rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    if (message.includes('model')) {
      return '❌ Model not supported for audio. Try using gemini-2.5-flash-preview-tts or check available models.';
    }
    return `Gemini TTS failed: ${message}`;
  }

  validateConfig(): boolean {
    return this.validate();
  }

  getErrorMessage(error: unknown): string {
    return this.formatError(error);
  }

  async generateAudio(config: ProviderConfig): Promise<Buffer | null> {
    const result = await this.synthesize(toTTSRequest(config, this.model));
    return result.audio;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const result = await this.synthesize(toTTSRequest(config, this.model));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}