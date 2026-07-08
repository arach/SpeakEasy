import * as fs from 'fs';
import * as path from 'path';
import {
  SpeakEasyConfig,
  SpeakEasyOptions,
  GlobalConfig,
} from './types';
import { getBestVoice } from './providers/system';
import { TTSCache, CacheMetadata, CacheStats } from './cache';
import { notifyHUD, closePipe } from './hud';
import { getHistory } from './history';
import { TTSAdapter, TTSProviderId, TTSRequest } from './adapters/types';
import { createAdapterRegistry, PROVIDER_ORDER } from './adapters/registry';
import { playAudioFile, playTTSResult, stopPlayback } from './adapters/audio';

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

const API_KEY_HELP: Partial<Record<TTSProviderId, string>> = {
  openai: 'export OPENAI_API_KEY=your_key_here',
  elevenlabs: 'export ELEVENLABS_API_KEY=your_key_here',
  groq: 'export GROQ_API_KEY=your_key_here',
  gemini: 'export GEMINI_API_KEY=your_key_here',
};

const API_KEY_URLS: Partial<Record<TTSProviderId, string>> = {
  openai: 'https://platform.openai.com/api-keys',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
  groq: 'https://console.groq.com/keys',
  gemini: 'https://makersuite.google.com/app/apikey',
};

export class SpeakEasy {
  private config: SpeakEasyConfig;
  private adapters: Map<TTSProviderId, TTSAdapter>;
  private isPlaying = false;
  private queue: Array<{ text: string; options: SpeakEasyOptions }> = [];
  private cache?: TTSCache;
  private useCache = false;
  private debug = false;
  private hudEnabled = false;

  constructor(config: SpeakEasyConfig) {
    const globalConfig = loadGlobalConfig();
    this.hudEnabled = globalConfig.hud?.enabled ?? false;

    this.config = {
      provider: config.provider || globalConfig.defaults?.provider || 'system',
      systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || getBestVoice(),
      openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || 'nova',
      elevenlabsVoiceId:
        config.elevenlabsVoiceId ||
        globalConfig.providers?.elevenlabs?.voiceId ||
        'EXAVITQu4vr4xnSDxMaL',
      groqVoice: config.groqVoice || globalConfig.providers?.groq?.voice || 'tara',
      geminiModel:
        config.geminiModel ||
        globalConfig.providers?.gemini?.model ||
        'gemini-2.5-flash-preview-tts',
      rate: config.rate || globalConfig.defaults?.rate || 180,
      volume:
        config.volume !== undefined
          ? config.volume
          : globalConfig.defaults?.volume !== undefined
            ? globalConfig.defaults.volume
            : 0.7,
      instructions: config.instructions || globalConfig.providers?.openai?.instructions,
      debug: config.debug || false,
      apiKeys: {
        openai:
          config.apiKeys?.openai ||
          globalConfig.providers?.openai?.apiKey ||
          process.env.OPENAI_API_KEY ||
          '',
        elevenlabs:
          config.apiKeys?.elevenlabs ||
          globalConfig.providers?.elevenlabs?.apiKey ||
          process.env.ELEVENLABS_API_KEY ||
          '',
        groq:
          config.apiKeys?.groq ||
          globalConfig.providers?.groq?.apiKey ||
          process.env.GROQ_API_KEY ||
          '',
        gemini:
          config.apiKeys?.gemini ||
          globalConfig.providers?.gemini?.apiKey ||
          process.env.GEMINI_API_KEY ||
          '',
      },
      tempDir: config.tempDir || globalConfig.global?.tempDir || '/tmp',
    };

    const cacheConfig = config.cache || globalConfig.cache;
    const hasApiKeys = !!(
      this.config.apiKeys?.openai ||
      this.config.apiKeys?.elevenlabs ||
      this.config.apiKeys?.groq ||
      this.config.apiKeys?.gemini
    );
    const cacheEnabled = cacheConfig?.enabled ?? (hasApiKeys && this.config.provider !== 'system');

    this.useCache = cacheEnabled;
    if (this.useCache) {
      const cacheDir = cacheConfig?.dir || path.join(this.config.tempDir || '/tmp', 'speakeasy-cache');
      this.cache = new TTSCache(cacheDir, cacheConfig?.ttl || '7d', cacheConfig?.maxSize);
    }

    this.adapters = createAdapterRegistry(this.config);
    this.debug = this.config.debug || false;

    if (this.debug) {
      this.printConfigDiagnostics();
    }
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
      await this.speakText(text, options);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Speech error:', errorMsg);
      throw error;
    } finally {
      this.isPlaying = false;
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }

  private async speakText(text: string, options: SpeakEasyOptions = {}): Promise<void> {
    const requestedId = (this.config.provider || 'system') as TTSProviderId;
    const silent = options.silent || false;

    if (this.debug) {
      console.log(`🔍 Requested provider: ${requestedId}`);
      console.log(`🔍 Text: "${text}"`);
      if (silent) console.log(`🔇 Silent mode: audio will not be played`);
    }

    const requestedAdapter = this.adapters.get(requestedId);
    if (requestedId !== 'system' && requestedAdapter && !requestedAdapter.validate()) {
      const providerName = requestedId.charAt(0).toUpperCase() + requestedId.slice(1);
      const envVarHelp = API_KEY_HELP[requestedId];
      throw new Error(
        `${providerName} API key is required.${envVarHelp ? ` Run: ${envVarHelp}` : ''}`
      );
    }

    let lastError: Error | null = null;

    for (const providerId of PROVIDER_ORDER) {
      if (providerId !== requestedId && !lastError) continue;

      const adapter = this.adapters.get(providerId);
      if (!adapter?.validate()) continue;

      try {
        const request = this.buildRequest(text, providerId);

        if (this.debug) {
          console.log(`✅ Using provider: ${providerId}`);
          console.log(`🎙️  Voice/model: ${request.voice}`);
          console.log(`⚡ Rate: ${request.rate} WPM`);
          console.log(`🔊 Volume: ${(request.volume * 100).toFixed(0)}%`);
        }

        if (this.useCache && adapter.capabilities.cacheable && this.cache) {
          const cacheKey = this.cache.generateCacheKey(
            text,
            providerId,
            request.voice,
            request.rate,
            adapter.capabilities.instructions ? request.instructions : undefined
          );
          const cachedEntry = await this.cache.get(cacheKey);

          if (cachedEntry) {
            console.log('(already cached)');
            if (this.debug) {
              console.log(`📦 Using cached audio from: ${cachedEntry.audioFilePath}`);
            }
            await this.sendHUDNotification(text, providerId, true);
            if (!silent) {
              await playAudioFile(cachedEntry.audioFilePath, request.volume);
            }
            return;
          }
        }

        const startTime = Date.now();
        const result = await adapter.synthesize(request);

        if (this.useCache && adapter.capabilities.cacheable && this.cache) {
          const cacheKey = this.cache.generateCacheKey(
            text,
            providerId,
            request.voice,
            request.rate,
            adapter.capabilities.instructions ? request.instructions : undefined
          );
          await this.cache.set(
            cacheKey,
            {
              provider: providerId,
              voice: request.voice,
              rate: request.rate,
              text,
            },
            result.audio,
            {
              model: result.model ?? providerId,
              durationMs: Date.now() - startTime,
              success: true,
              extension: result.format,
            }
          );
          console.log('cached');
        }

        await this.sendHUDNotification(text, providerId, false);
        if (!silent) {
          await playTTSResult(result, request.volume, request.tempDir);
        }
        return;
      } catch (error) {
        console.warn(`${providerId} provider failed:`, error);
        lastError = error as Error;
      }
    }

    if (lastError) {
      if (requestedId !== 'system') {
        const providerName = requestedId.charAt(0).toUpperCase() + requestedId.slice(1);
        const helpUrl = lastError.message.includes('API key')
          ? API_KEY_URLS[requestedId]
          : undefined;

        throw new Error(
          `${providerName} failed: ${lastError.message}${
            helpUrl ? `\n💡 Get your API key: ${helpUrl}` : ''
          }\n🗣️  Try: speakeasy --text "hello world" --provider system`
        );
      }
      throw new Error(`All providers failed. Last error: ${lastError.message}`);
    }

    throw new Error(`No available TTS provider. Ensure you're on macOS for system voice.`);
  }

  private buildRequest(text: string, providerId: TTSProviderId): TTSRequest {
    return {
      text,
      voice: this.getVoiceForProvider(providerId),
      rate: this.config.rate || 180,
      volume: this.config.volume !== undefined ? this.config.volume : 0.7,
      tempDir: this.config.tempDir || '/tmp',
      apiKey: this.getApiKeyForProvider(providerId) || undefined,
      instructions: providerId === 'openai' ? this.config.instructions : undefined,
    };
  }

  private printConfigDiagnostics(): void {
    console.log('🔍 Debug mode enabled');
    console.log('📊 Current Configuration:');
    console.log(`   Provider: ${this.config.provider}`);
    console.log(`   Rate: ${this.config.rate} WPM`);
    console.log(`   Volume: ${((this.config.volume || 0.7) * 100).toFixed(0)}%`);
    console.log(`   System Voice: ${this.config.systemVoice}`);
    console.log(`   OpenAI Voice: ${this.config.openaiVoice}`);
    console.log(`   ElevenLabs Voice: ${this.config.elevenlabsVoiceId}`);
    console.log(`   Gemini Model: ${this.config.geminiModel}`);
    if (this.config.instructions) {
      console.log(
        `   Instructions: "${this.config.instructions.substring(0, 50)}${this.config.instructions.length > 50 ? '...' : ''}"`
      );
    }

    console.log('🔑 API Key Status:');
    const providers = [
      { name: 'OpenAI', key: 'openai', env: 'OPENAI_API_KEY' },
      { name: 'ElevenLabs', key: 'elevenlabs', env: 'ELEVENLABS_API_KEY' },
      { name: 'Groq', key: 'groq', env: 'GROQ_API_KEY' },
      { name: 'Gemini', key: 'gemini', env: 'GEMINI_API_KEY' },
    ];

    providers.forEach(({ name, key, env }) => {
      const fromConfig = this.config.apiKeys?.[key as keyof typeof this.config.apiKeys];
      const fromEnv = process.env[env];

      if (fromConfig && fromConfig.length > 10) {
        console.log(`   ✅ ${name}: Available from config (${fromConfig.substring(0, 8)}...)`);
      } else if (fromEnv && fromEnv.length > 10) {
        console.log(`   ✅ ${name}: Available from environment (${fromEnv.substring(0, 8)}...)`);
      } else {
        console.log(`   ❌ ${name}: Not available`);
      }
    });

    console.log('📦 Cache Status:');
    console.log(`   Enabled: ${this.useCache}`);
    if (this.cache) {
      console.log(`   Directory: ${(this.cache as any).dir || 'default'}`);
    }
    console.log('');
  }

  private getVoiceForProvider(provider: TTSProviderId): string {
    switch (provider) {
      case 'openai':
        return this.config.openaiVoice || 'nova';
      case 'elevenlabs':
        return this.config.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL';
      case 'system':
        return this.config.systemVoice || 'Samantha';
      case 'groq':
        return this.config.groqVoice || 'tara';
      case 'gemini':
        return this.config.geminiModel || 'gemini-2.5-flash-preview-tts';
      default:
        return this.config.systemVoice || 'Samantha';
    }
  }

  private getApiKeyForProvider(provider: TTSProviderId): string {
    switch (provider) {
      case 'openai':
        return this.config.apiKeys?.openai || '';
      case 'elevenlabs':
        return this.config.apiKeys?.elevenlabs || '';
      case 'groq':
        return this.config.apiKeys?.groq || '';
      case 'gemini':
        return this.config.apiKeys?.gemini || '';
      default:
        return '';
    }
  }

  private async sendHUDNotification(
    text: string,
    provider: string,
    cached: boolean
  ): Promise<void> {
    const timestamp = Date.now();

    getHistory().add({
      text,
      provider,
      timestamp,
      cached,
    });

    if (!this.hudEnabled) return;

    notifyHUD({
      text: text.substring(0, 200),
      provider,
      cached,
      timestamp,
    });

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private stopSpeaking(): void {
    stopPlayback();
  }

  private requireCache(): TTSCache {
    if (!this.cache) {
      throw new Error(
        'Cache is not enabled. Configure cache.enabled or use an API provider with keys present.'
      );
    }
    return this.cache;
  }

  async getCacheStats(): Promise<CacheStats & { dir?: string }> {
    if (!this.cache) {
      return {
        totalEntries: 0,
        totalSize: 0,
        cacheHits: 0,
        cacheMisses: 0,
        providers: {},
        models: {},
        sources: {},
        dateRange: null,
        avgFileSize: 0,
        hitRate: 0,
      };
    }

    const stats = await this.cache.getStats();
    return {
      ...stats,
      dir: this.cache.getCacheDir(),
    };
  }

  async getCacheMetadata(): Promise<CacheMetadata[]> {
    return this.requireCache().getCacheMetadata();
  }

  async findByText(text: string): Promise<CacheMetadata[]> {
    return this.requireCache().findByText(text);
  }

  async findByProvider(provider: string): Promise<CacheMetadata[]> {
    return this.requireCache().findByProvider(provider);
  }
}

export const say = (
  text: string,
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini'
) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for say()');
  }
  return new SpeakEasy(provider ? { provider } : {}).speak(text);
};

export const speak = (
  text: string,
  options?: SpeakEasyOptions & {
    provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini';
    volume?: number;
  }
) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for speak()');
  }
  const { provider, volume, ...speakOptions } = options || {};
  const config: SpeakEasyConfig = { provider, volume };
  return new SpeakEasy(config).speak(text, speakOptions);
};

export * from './types';
export * from './adapters/types';
export { createAdapterRegistry, PROVIDER_ORDER } from './adapters/registry';
export { playAudioFile, playTTSResult, stopPlayback } from './adapters/audio';
export { SystemProvider, getAvailableVoices, getBestVoice } from './providers/system';
export { OpenAIProvider } from './providers/openai';
export { ElevenLabsProvider } from './providers/elevenlabs';
export { GroqProvider } from './providers/groq';
export { GeminiProvider } from './providers/gemini';
export { TTSCache, CacheMetadata, CacheStats } from './cache';