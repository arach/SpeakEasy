import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Provider, ProviderConfig } from '../types';

export class OpenAIProvider implements Provider {
  private apiKey: string;
  private voice: string;
  private instructions?: string;

  constructor(apiKey: string = '', voice: string = 'nova', instructions?: string) {
    this.apiKey = apiKey;
    this.voice = voice;
    this.instructions = instructions;
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
      throw new Error('OpenAI API key is required');
    }

    // Use instructions from config or constructor
    const instructions = config.instructions || this.instructions;

    // If instructions are provided, use gpt-4o-audio-preview with chat completions
    if (instructions) {
      return this.generateAudioWithInstructions(config, instructions);
    }

    // Standard TTS endpoint (no instructions)
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: this.voice,
          input: config.text,
          speed: config.rate / 200,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.`);
        } else if (response.status === 429) {
          throw new Error(`OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.`);
        }
        throw new Error(`OpenAI API error: ${response.status}. Check your API key and rate limits.`);
      }

      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
    } catch (error) {
      throw new Error(`OpenAI TTS failed: ${error}`);
    }
  }

  private async generateAudioWithInstructions(config: ProviderConfig, instructions: string): Promise<Buffer | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-audio-preview',
          modalities: ['text', 'audio'],
          audio: {
            voice: this.voice,
            format: 'mp3',
          },
          messages: [
            {
              role: 'system',
              content: instructions,
            },
            {
              role: 'user',
              content: config.text,
            },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`OpenAI API error: Invalid API key. Check your OPENAI_API_KEY environment variable.`);
        } else if (response.status === 429) {
          throw new Error(`OpenAI API error: Rate limit exceeded. Try again later or reduce request frequency.`);
        }
        const errorBody = await response.text();
        throw new Error(`OpenAI API error: ${response.status}. ${errorBody}`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: {
            audio?: {
              data: string;
            };
          };
        }>;
      };

      // Extract audio from response
      const audioData = data.choices?.[0]?.message?.audio?.data;
      if (!audioData) {
        throw new Error('No audio data in OpenAI response');
      }

      // Audio data is base64 encoded
      return Buffer.from(audioData, 'base64');
    } catch (error) {
      throw new Error(`OpenAI TTS with instructions failed: ${error}`);
    }
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  getErrorMessage(error: any): string {
    if (error.message.includes('Invalid API key')) {
      return '🔑 Invalid OpenAI API key. Get yours at: https://platform.openai.com/api-keys';
    }
    if (error.message.includes('Rate limit')) {
      return '⏰ OpenAI rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    return `OpenAI TTS failed: ${error.message}`;
  }
}