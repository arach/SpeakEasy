import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { 
  SpeakEasyConfig, 
  SpeakEasyOptions, 
  GlobalConfig, 
  Provider 
} from './types';
import { SystemProvider } from './providers/system';
import { OpenAIProvider } from './providers/openai';
import { ElevenLabsProvider } from './providers/elevenlabs';
import { GroqProvider } from './providers/groq';

const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speakeasy');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

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

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[^\w\s.,!?'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class SpeakEasy {
  private config: Required<SpeakEasyConfig>;
  private providers: Map<string, Provider>;
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

    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('system', new SystemProvider(this.config.systemVoice));
    this.providers.set('openai', new OpenAIProvider(this.config.apiKeys.openai || '', this.config.openaiVoice));
    this.providers.set('elevenlabs', new ElevenLabsProvider(this.config.apiKeys.elevenlabs || '', this.config.elevenlabsVoiceId));
    this.providers.set('groq', new GroqProvider(this.config.apiKeys.groq || ''));
  }

  static builder() {
    return new SpeakEasyBuilder();
  }

  async speak(text: string, options: SpeakEasyOptions = {}): Promise<void> {
    const cleanText = cleanTextForSpeech(text);
    
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
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }

  private async speakText(text: string): Promise<void> {
    const providers = ['system', 'openai', 'elevenlabs', 'groq'];
    let lastError: Error | null = null;

    for (const providerName of providers) {
      if (providerName === this.config.provider || lastError) {
        try {
          const provider = this.providers.get(providerName);
          if (provider && provider.validateConfig()) {
            await provider.speak({
              text,
              rate: this.config.rate,
              tempDir: this.config.tempDir,
              voice: this.getVoiceForProvider(providerName),
              apiKey: this.getApiKeyForProvider(providerName) || ''
            });
            return;
          }
        } catch (error) {
          console.warn(`${providerName} provider failed:`, error);
          lastError = error as Error;
          continue;
        }
      }
    }

    if (lastError) {
      throw new Error(`All providers failed. Last error: ${lastError.message}`);
    }

    // Fallback to system voice
    const systemProvider = this.providers.get('system');
    if (systemProvider) {
      await systemProvider.speak({
        text,
        rate: this.config.rate,
        tempDir: this.config.tempDir,
        voice: this.config.systemVoice
      });
    }
  }

  private getVoiceForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return this.config.openaiVoice;
      case 'elevenlabs': return this.config.elevenlabsVoiceId;
      case 'system': return this.config.systemVoice;
      case 'groq': return 'Celeste-PlayAI';
      default: return this.config.systemVoice;
    }
  }

  private getApiKeyForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return this.config.apiKeys.openai || '';
      case 'elevenlabs': return this.config.apiKeys.elevenlabs || '';
      case 'groq': return this.config.apiKeys.groq || '';
      default: return '';
    }
  }

  private stopSpeaking(): void {
    try {
      execSync('pkill -f "say|afplay"', { stdio: 'ignore' });
    } catch (error) {
      // Ignore errors when killing processes
    }
  }

  clearQueue(): void {
    this.queue = [];
  }
}

export class SpeakEasyBuilder {
  private config: SpeakEasyConfig = {};

  withProvider(provider: 'system' | 'openai' | 'elevenlabs' | 'groq'): this {
    this.config.provider = provider;
    return this;
  }

  withSystemVoice(voice: string): this {
    this.config.systemVoice = voice;
    return this;
  }

  withOpenAIVoice(voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'): this {
    this.config.openaiVoice = voice;
    return this;
  }

  withElevenLabsVoice(voiceId: string): this {
    this.config.elevenlabsVoiceId = voiceId;
    return this;
  }

  withRate(rate: number): this {
    this.config.rate = rate;
    return this;
  }

  withApiKeys(keys: Partial<SpeakEasyConfig['apiKeys']>): this {
    this.config.apiKeys = { ...this.config.apiKeys, ...keys };
    return this;
  }

  withTempDir(dir: string): this {
    this.config.tempDir = dir;
    return this;
  }

  build(): SpeakEasy {
    return new SpeakEasy(this.config);
  }
}

// Convenience functions
export const say = (text: string, provider?: 'system' | 'openai' | 'elevenlabs' | 'groq') => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for say()');
  }
  return new SpeakEasy({ provider: provider || 'system' }).speak(text);
};

export const speak = (text: string, options?: SpeakEasyOptions & { provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' }) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for speak()');
  }
  const { provider, ...speakOptions } = options || {};
  return new SpeakEasy({ provider: provider || 'system' }).speak(text, speakOptions);
};

export * from './types';
export { SystemProvider } from './providers/system';
export { OpenAIProvider } from './providers/openai';
export { ElevenLabsProvider } from './providers/elevenlabs';
export { GroqProvider } from './providers/groq';