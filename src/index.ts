import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speakeasy');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

interface GlobalConfig {
  providers?: {
    openai?: {
      enabled?: boolean;
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      model?: string;
      apiKey?: string;
    };
    elevenlabs?: {
      enabled?: boolean;
      voiceId?: string;
      modelId?: string;
      apiKey?: string;
    };
    system?: {
      enabled?: boolean;
      voice?: string;
    };
    groq?: {
      enabled?: boolean;
      voice?: string;
      model?: string;
      apiKey?: string;
    };
  };
  defaults?: {
    provider?: 'system' | 'openai' | 'elevenlabs' | 'groq';
    fallbackOrder?: string[];
    rate?: number;
  };
  global?: {
    tempDir?: string;
    cleanup?: boolean;
  };
}

function loadGlobalConfig(): GlobalConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.warn('Failed to load global config:', error);
  }
  return {};
}

export interface SpeakEasyConfig {
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq';
  systemVoice?: string;
  openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  elevenlabsVoiceId?: string;
  rate?: number;
  apiKeys?: {
    openai?: string;
    elevenlabs?: string;
    groq?: string;
  };
  tempDir?: string;
}

export interface SpeakEasyOptions {
  priority?: 'high' | 'normal' | 'low';
  interrupt?: boolean;
  cleanup?: boolean;
}

export class SpeakEasy {
  private config: Required<SpeakEasyConfig>;
  private isPlaying = false;
  private queue: Array<{ text: string; options: SpeakEasyOptions }> = [];

  constructor(config: SpeakEasyConfig) {
    const globalConfig = loadGlobalConfig();
    
    this.config = {
      provider: config.provider || globalConfig.defaults?.provider || 'system',
      systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || 'Samantha',
      openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || 'nova',
      elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.providers?.elevenlabs?.voiceId || 'EXAVITQu4vr4xnSDxMaL',
      rate: config.rate || globalConfig.defaults?.rate || 180,
      apiKeys: {
        openai: config.apiKeys?.openai || globalConfig.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || '',
        elevenlabs: config.apiKeys?.elevenlabs || globalConfig.providers?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY || '',
        groq: config.apiKeys?.groq || globalConfig.providers?.groq?.apiKey || process.env.GROQ_API_KEY || '',
      },
      tempDir: config.tempDir || globalConfig.global?.tempDir || '/tmp',
    };
  }

  async speak(text: string, options: SpeakEasyOptions = {}): Promise<void> {
    const cleanText = this.cleanTextForSpeech(text);
    
    if (options.interrupt && this.isPlaying) {
      this.stopSpeaking();
    }

    if (options.priority === 'high') {
      this.queue.unshift({ text: cleanText, options });
    } else {
      this.queue.push({ text: cleanText, options });
    }

    if (!this.isPlaying) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    this.isPlaying = true;
    const { text, options } = this.queue.shift()!;

    try {
      await this.speakText(text);
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      this.isPlaying = false;
      // Process next item in queue
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }

  private async speakText(text: string): Promise<void> {
    switch (this.config.provider) {
      case 'openai':
        await this.speakWithOpenAI(text);
        break;
      case 'elevenlabs':
        await this.speakWithElevenLabs(text);
        break;
      case 'groq':
        await this.speakWithGroq(text);
        break;
      case 'system':
      default:
        await this.speakWithSystem(text);
        break;
    }
  }



  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[^\w\s.,!?'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async speakWithSystem(text: string): Promise<void> {
    try {
      const command = `say -v ${this.config.systemVoice} -r ${this.config.rate} "${text.replace(/"/g, '\\"')}"`;
      execSync(command);
    } catch (error) {
      throw new Error(`System TTS failed: ${error}`);
    }
  }

  private async speakWithOpenAI(text: string): Promise<void> {
    const openaiKey = this.config.apiKeys.openai;
    console.log('speakWithOpenAI: checking API key...');
    console.log('  config.apiKeys.openai:', this.config.apiKeys.openai);
    console.log('  resolved openaiKey:', openaiKey);
    console.log('  process.env.OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
    
    if (!openaiKey) {
      console.warn('No OpenAI API key, falling back to system voice');
      return this.speakWithSystem(text);
    }

    try {
      const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKeys.openai}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: this.config.openaiVoice,
          input: text,
          speed: this.config.rate / 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

      execSync(`afplay "${tempFile}"`);
      
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (error) {
      console.warn('OpenAI TTS failed, falling back to system voice:', error);
      return this.speakWithSystem(text);
    }
  }

  private async speakWithElevenLabs(text: string): Promise<void> {
    const elevenlabsKey = this.config.apiKeys.elevenlabs;
    console.log('speakWithElevenLabs: checking API key...');
    console.log('  config.apiKeys.elevenlabs:', this.config.apiKeys.elevenlabs);
    console.log('  resolved elevenlabsKey:', elevenlabsKey);
    console.log('  process.env.ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY);
    
    if (!elevenlabsKey) {
      console.warn('No ElevenLabs API key, falling back to system voice');
      return this.speakWithSystem(text);
    }

    const BALANCED = 0.5;
    const NATURAL = 0.5;
    try {
      const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabsVoiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.config.apiKeys.elevenlabs || '',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: BALANCED,
            similarity_boost: NATURAL,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

      execSync(`afplay "${tempFile}"`);
      
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (error) {
      console.warn('ElevenLabs TTS failed, falling back to system voice:', error);
      return this.speakWithSystem(text);
    }
  }

  private async speakWithGroq(text: string): Promise<void> {
    const groqKey = this.config.apiKeys.groq;
    console.log('speakWithGroq - API key:', groqKey);
    
    if (!groqKey) {
      console.warn('No Groq API key, falling back to system voice');
      return this.speakWithSystem(text);
    }



    try {
      const tempFile = path.join(this.config.tempDir, `speech_${Date.now()}.mp3`);
      
    
    

      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'playai-tts',
          voice: 'Celeste-PlayAI',
          input: text,
          speed: this.config.rate / 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

      execSync(`afplay "${tempFile}"`);
      
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (error) {
      console.warn('***** Groq TTS failed, falling back to system voice:', error);
      return this.speakWithSystem(text);
    }
  }

  private stopSpeaking(): void {
    try {
      // Kill any running 'say' or 'afplay' processes
      execSync('pkill -f "say|afplay"', { stdio: 'ignore' });
    } catch (error) {
    }
  }

  clearQueue(): void {
    this.queue = [];
  }
}

// Convenience functions with provider override
export const say = (text: string, provider?: 'system' | 'openai' | 'elevenlabs' | 'groq') => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for say()');
  }
  return new SpeakEasy({ provider: provider || 'system' }).speak(text);
};

export const speak = (text: string, options?: SpeakEasyOptions & { provider?: 'system' | 'openai' | 'elevenlabs' }) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for speak()');
  }
  const { provider, ...speakOptions } = options || {};
  return new SpeakEasy({ provider: provider || 'system' }).speak(text, speakOptions);
};
