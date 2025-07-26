import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Provider, ProviderConfig } from '../types';

export class GroqProvider implements Provider {
  private apiKey: string;
  private voice: string;

  constructor(apiKey: string = '', voice: string = 'Celeste-PlayAI') {
    this.apiKey = apiKey;
    this.voice = voice;
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
      throw new Error('Groq API key is required');
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'playai-tts',
          voice: this.voice,
          input: config.text,
          speed: config.rate / 200,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Groq API error: Invalid API key');
        } else if (response.status === 429) {
          throw new Error('Groq API error: Rate limit exceeded');
        }
        throw new Error(`Groq API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`Groq TTS failed: ${error}`);
    }
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  getErrorMessage(error: any): string {
    if (error.message.includes('Invalid API key')) {
      return '🔑 Invalid Groq API key. Get yours at: https://console.groq.com/keys';
    }
    if (error.message.includes('Rate limit')) {
      return '⏰ Groq rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `Groq TTS failed: ${error.message}`;
  }
}