import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Provider, ProviderConfig } from '../types';

export class GeminiProvider implements Provider {
  private apiKey: string;
  private model: string;
  private voiceName: string;

  constructor(apiKey: string = '', model: string = 'gemini-2.5-pro-preview-tts', voiceName: string = 'Aoede') {
    this.apiKey = apiKey;
    this.model = model;
    this.voiceName = voiceName;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const audioBuffer = await this.generateAudio(config);
    if (audioBuffer) {
      const tempFile = path.join(config.tempDir, `speech_${Date.now()}.wav`);
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
      throw new Error('Gemini API key is required');
    }

    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Use the text generation model with audio output capability
      const model = genAI.getGenerativeModel({ 
        model: this.model,
      });

      // Generate content with audio output
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: config.text
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'audio/wav',
        }
      });

      const response = await result.response;
      
      // Check if we have audio data in the response
      if (response.candidates && response.candidates[0]?.content?.parts?.[0]) {
        const part = response.candidates[0].content.parts[0];
        
        // Handle inline data (audio content)
        if ('inlineData' in part && part.inlineData) {
          const audioData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'audio/wav';
          
          // Convert base64 to buffer
          const buffer = Buffer.from(audioData, 'base64');
          
          // If it's already WAV, return as-is
          if (mimeType.includes('wav')) {
            return buffer;
          }
          
          // Otherwise, convert to WAV
          return this.convertToWav(buffer, mimeType);
        }
      }
      
      throw new Error('No audio content received from Gemini API');
    } catch (error: any) {
      // Check if it's an API error
      if (error.message?.includes('API key')) {
        throw new Error(`Gemini API error: Invalid API key. Check your GEMINI_API_KEY environment variable.`);
      } else if (error.message?.includes('quota') || error.message?.includes('rate')) {
        throw new Error(`Gemini API error: Rate limit exceeded. Try again later or reduce request frequency.`);
      } else if (error.message?.includes('model')) {
        throw new Error(`Gemini API error: Model '${this.model}' may not support audio generation. Try 'gemini-2.5-pro-preview-tts' or check available models.`);
      }
      throw new Error(`Gemini TTS failed: ${error.message || error}`);
    }
  }

  private convertToWav(rawData: Buffer, mimeType: string): Buffer {
    // Parse audio parameters from MIME type
    const options = this.parseMimeType(mimeType);
    
    // Create WAV header
    const wavHeader = this.createWavHeader(rawData.length, options);
    
    // Combine header and data
    return Buffer.concat([wavHeader, rawData]);
  }

  private parseMimeType(mimeType: string): { numChannels: number, sampleRate: number, bitsPerSample: number } {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [, format] = fileType.split('/');

    const options = {
      numChannels: 1,
      sampleRate: 24000, // Default sample rate
      bitsPerSample: 16   // Default bits per sample
    };

    // Parse format (e.g., L16 means 16-bit linear PCM)
    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    // Parse parameters (e.g., rate=24000)
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

  private createWavHeader(dataLength: number, options: { numChannels: number, sampleRate: number, bitsPerSample: number }): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = Buffer.alloc(44);

    // RIFF header
    buffer.write('RIFF', 0);                      // ChunkID
    buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
    buffer.write('WAVE', 8);                      // Format
    
    // fmt subchunk
    buffer.write('fmt ', 12);                     // Subchunk1ID
    buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
    buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22);        // NumChannels
    buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
    buffer.writeUInt32LE(byteRate, 28);           // ByteRate
    buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
    
    // data subchunk
    buffer.write('data', 36);                     // Subchunk2ID
    buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size

    return buffer;
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  getErrorMessage(error: any): string {
    if (error.message.includes('Invalid API key')) {
      return '🔑 Invalid Gemini API key. Get yours at: https://aistudio.google.com/apikey';
    }
    if (error.message.includes('Rate limit') || error.message.includes('quota')) {
      return '⏰ Gemini rate limit exceeded. Try again later or use system voice: `speakeasy "text" --provider system`';
    }
    if (error.message.includes('model')) {
      return '❌ Model not supported for audio. Try using gemini-2.5-pro-preview-tts or check available models.';
    }
    return `Gemini TTS failed: ${error.message}`;
  }
}