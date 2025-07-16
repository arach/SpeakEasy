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
      execSync(`afplay "${tempFile}"`);
      
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
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: BALANCED,
            similarity_boost: NATURAL,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('ElevenLabs API error: Invalid API key');
        } else if (response.status === 429) {
          throw new Error('ElevenLabs API error: Rate limit exceeded');
        }
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`ElevenLabs TTS failed: ${error}`);
    }
  }

  validateConfig(): boolean {
    return !!this.apiKey;
  }

  getErrorMessage(error: any): string {
    if (error.message.includes('Invalid API key')) {
      return '🔑 Invalid ElevenLabs API key. Set ELEVENLABS_API_KEY environment variable or provide apiKeys.elevenlabs in config.';
    }
    return `ElevenLabs TTS failed: ${error.message}`;
  }
}