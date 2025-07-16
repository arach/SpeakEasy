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
import { TTSCache } from './cache';

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
  private config: SpeakEasyConfig;
  private providers: Map<string, Provider>;
  private isPlaying = false;
  private queue: Array<{ text: string; options: SpeakEasyOptions }> = [];
  private cache?: TTSCache;
  private useCache = false;

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

    const cacheConfig = config.cache || globalConfig.cache;
    this.useCache = cacheConfig?.enabled === true;
    if (this.useCache && cacheConfig) {
      const cacheDir = cacheConfig.dir || path.join(this.config.tempDir || '/tmp', 'speakeasy-cache');
      this.cache = new TTSCache(
        cacheDir,
        cacheConfig.ttl || '7d',
        cacheConfig.maxSize
      );
    }
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('system', new SystemProvider(this.config.systemVoice || 'Samantha'));
    this.providers.set('openai', new OpenAIProvider(this.config.apiKeys?.openai || '', this.config.openaiVoice || 'nova'));
    this.providers.set('elevenlabs', new ElevenLabsProvider(this.config.apiKeys?.elevenlabs || '', this.config.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL'));
    this.providers.set('groq', new GroqProvider(this.config.apiKeys?.groq || ''));
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
            const voice = this.getVoiceForProvider(providerName);
            const rate = this.config.rate || 180;
            const tempDir = this.config.tempDir || '/tmp';
            
            // Check cache first if caching is enabled
            if (this.useCache && providerName !== 'system' && this.cache) {
              const cacheKey = this.cache!.generateCacheKey(text, providerName, voice, rate);
              const cachedEntry = await this.cache!.get(cacheKey);
              
              if (cachedEntry) {
                // Play cached audio file
                await this.playCachedAudio(cachedEntry.audioFilePath);
                return;
              }
            }

            // Generate new audio
            let audioBuffer: Buffer | null = null;
            
            if (providerName === 'system') {
              // System provider doesn't support caching, use speak directly
              await provider.speak({
                text,
                rate,
                tempDir,
                voice,
                apiKey: this.getApiKeyForProvider(providerName) || ''
              });
              return;
            } else {
              // Use generateAudio for cacheable providers
              const generateMethod = (provider as any).generateAudio;
              if (generateMethod) {
                audioBuffer = await generateMethod.call(provider, {
                  text,
                  rate,
                  tempDir,
                  voice,
                  apiKey: this.getApiKeyForProvider(providerName) || ''
                });
              } else {
                // Fallback for providers without generateAudio
                await provider.speak({
                  text,
                  rate,
                  tempDir,
                  voice,
                  apiKey: this.getApiKeyForProvider(providerName) || ''
                });
                return;
              }
            }

            // Cache the audio if enabled and buffer was returned
            if (this.useCache && providerName !== 'system' && this.cache && audioBuffer) {
              const cacheKey = this.cache!.generateCacheKey(text, providerName, voice, rate);
              await this.cache!.set(cacheKey, {
                provider: providerName,
                voice,
                rate,
                text
              }, audioBuffer);
              
              // Play the generated audio
              const tempFile = path.join(tempDir, `speech_${Date.now()}.mp3`);
              fs.writeFileSync(tempFile, audioBuffer);
              execSync(`afplay "${tempFile}"`);
              
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            } else if (audioBuffer) {
              // Play directly if no caching
              const tempFile = path.join(tempDir, `speech_${Date.now()}.mp3`);
              fs.writeFileSync(tempFile, audioBuffer);
              execSync(`afplay "${tempFile}"`);
              
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            }

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

    // Fallback to system voice (never cached)
    const systemProvider = this.providers.get('system');
    if (systemProvider) {
      await systemProvider.speak({
        text,
        rate: this.config.rate || 180,
        tempDir: this.config.tempDir || '/tmp',
        voice: this.config.systemVoice || 'Samantha'
      });
    }
  }

  private async playCachedAudio(audioFilePath: string): Promise<void> {
    // Play cached audio file using system audio player
    const { execSync } = require('child_process');
    execSync(`afplay "${audioFilePath}"`, { stdio: 'inherit' });
  }

  private getVoiceForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return this.config.openaiVoice || 'nova';
      case 'elevenlabs': return this.config.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL';
      case 'system': return this.config.systemVoice || 'Samantha';
      case 'groq': return 'Celeste-PlayAI';
      default: return this.config.systemVoice || 'Samantha';
    }
  }

  private getApiKeyForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return this.config.apiKeys?.openai || '';
      case 'elevenlabs': return this.config.apiKeys?.elevenlabs || '';
      case 'groq': return this.config.apiKeys?.groq || '';
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

  getCacheStats(): Promise<{ size: number, dir?: string }> {
    return Promise.resolve({
      size: 0, // Keyv doesn't provide easy way to get size
      dir: this.cache?.getCacheDir()
    });
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