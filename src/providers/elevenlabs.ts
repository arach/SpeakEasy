import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Provider, ProviderConfig } from '../types';

export class ElevenLabsProvider implements Provider {
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey: string = '', voiceId: string = 'EXAVITQu4vr4xnSDxMaL') {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const audioBuffer = await this.generateAudio(config);
    if (audioBuffer) {
      const tempFile = path.join(config.tempDir, `speech_${Date.now()}.mp3`);
      fs.writeFileSync(tempFile, audioBuffer);
      
      const volume = config.volume !== undefined ? config.volume : 0.7;
      const volumeFlag = volume !== 1.0 ? ` -v ${volume}` : '';
      execSync(`afplay${volumeFlag} "${tempFile}"`);
      
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  async generateAudio(config: ProviderConfig): Promise<Buffer | null> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    const BALANCED = 0.5;
    const NATURAL = 0.5;
    
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: config.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: BALANCED,
            similarity_boost: NATURAL,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');

        if (response.status === 401) {
          if (errorBody.includes('model_deprecated')) {
            throw new Error('ElevenLabs API error: Model deprecated - updating to newer model');
          }
          throw new Error('ElevenLabs API error: Invalid API key');
        } else if (response.status === 429) {
          throw new Error('ElevenLabs API error: Rate limit exceeded');
        } else if (response.status === 403) {
          throw new Error('ElevenLabs API error: Access forbidden - check your API key permissions');
        } else if (response.status === 422) {
          throw new Error('ElevenLabs API error: Invalid voice ID or parameters - check your configuration');
        }
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  getErrorMessage(error: any): string {
    if (error.message.includes('Invalid API key')) {
      return '🔑 Invalid ElevenLabs API key. Get yours at: https://elevenlabs.io/app/settings/api-keys';
    }
    if (error.message.includes('Access forbidden')) {
      return '🔒 ElevenLabs access forbidden. Ensure your API key has TTS permissions';
    }
    if (error.message.includes('Rate limit')) {
      return '⏰ ElevenLabs rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `ElevenLabs TTS failed: ${error.message}`;
  }
}