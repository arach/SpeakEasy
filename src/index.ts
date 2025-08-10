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
import { GeminiProvider } from './providers/gemini';
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
  private debug = false;

  constructor(config: SpeakEasyConfig) {
    const globalConfig = loadGlobalConfig();
    

    this.config = {
      provider: config.provider || globalConfig.defaults?.provider || 'system',
      systemVoice: config.systemVoice || globalConfig.providers?.system?.voice || 'Samantha',
      openaiVoice: config.openaiVoice || globalConfig.providers?.openai?.voice || 'nova',
      elevenlabsVoiceId: config.elevenlabsVoiceId || globalConfig.providers?.elevenlabs?.voiceId || 'EXAVITQu4vr4xnSDxMaL',
      geminiModel: config.geminiModel || globalConfig.providers?.gemini?.model || 'gemini-2.5-pro-preview-tts',
      rate: config.rate || globalConfig.defaults?.rate || 180,
      volume: config.volume !== undefined ? config.volume : (globalConfig.defaults?.volume !== undefined ? globalConfig.defaults.volume : 0.7),
      debug: config.debug || false,
      apiKeys: {
        openai: config.apiKeys?.openai || globalConfig.providers?.openai?.apiKey || process.env.OPENAI_API_KEY || '',
        elevenlabs: config.apiKeys?.elevenlabs || globalConfig.providers?.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY || '',
        groq: config.apiKeys?.groq || globalConfig.providers?.groq?.apiKey || process.env.GROQ_API_KEY || '',
        gemini: config.apiKeys?.gemini || globalConfig.providers?.gemini?.apiKey || process.env.GEMINI_API_KEY || '',
      },
      tempDir: config.tempDir || globalConfig.global?.tempDir || '/tmp',
    };

    const cacheConfig = config.cache || globalConfig.cache;
    
    // Enable cache by default when API keys are present (for API-based providers)
    const hasApiKeys = !!(this.config.apiKeys?.openai || this.config.apiKeys?.elevenlabs || this.config.apiKeys?.groq || this.config.apiKeys?.gemini);
    const cacheEnabled = cacheConfig?.enabled ?? (hasApiKeys && this.config.provider !== 'system');
    
    this.useCache = cacheEnabled;
    if (this.useCache) {
      const cacheDir = cacheConfig?.dir || path.join(this.config.tempDir || '/tmp', 'speakeasy-cache');
      this.cache = new TTSCache(
        cacheDir,
        cacheConfig?.ttl || '7d',
        cacheConfig?.maxSize
      );
    }
    this.providers = new Map();
    this.initializeProviders();
    
    this.debug = this.config.debug || false;
    if (this.debug) {
      this.printConfigDiagnostics();
    }
  }

  private initializeProviders(): void {
    this.providers.set('system', new SystemProvider(this.config.systemVoice || 'Samantha'));
    this.providers.set('openai', new OpenAIProvider(this.config.apiKeys?.openai || '', this.config.openaiVoice || 'nova'));
    this.providers.set('elevenlabs', new ElevenLabsProvider(this.config.apiKeys?.elevenlabs || '', this.config.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL'));
    this.providers.set('groq', new GroqProvider(this.config.apiKeys?.groq || ''));
    this.providers.set('gemini', new GeminiProvider(this.config.apiKeys?.gemini || '', this.config.geminiModel || 'gemini-2.5-pro-preview-tts'));
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Speech error:', errorMsg);
      
      // Re-throw to let CLI handle with better formatting
      throw error;
    } finally {
      this.isPlaying = false;
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }

  private async speakText(text: string): Promise<void> {
    const requestedProvider = this.config.provider || 'system';
    
    if (this.debug) {
      console.log(`🔍 Requested provider: ${requestedProvider}`);
      console.log(`🔍 Text: "${text}"`);
    }
    
    // First, validate the requested provider
    const requestedProviderInstance = this.providers.get(requestedProvider);
    if (requestedProvider !== 'system' && requestedProviderInstance) {
      if (!requestedProviderInstance.validateConfig()) {
        const providerName = requestedProvider.charAt(0).toUpperCase() + requestedProvider.slice(1);
        let envVarHelp = '';
        switch (requestedProvider) {
          case 'openai':
            envVarHelp = 'export OPENAI_API_KEY=your_key_here';
            break;
          case 'elevenlabs':
            envVarHelp = 'export ELEVENLABS_API_KEY=your_key_here';
            break;
          case 'groq':
            envVarHelp = 'export GROQ_API_KEY=your_key_here';
            break;
          case 'gemini':
            envVarHelp = 'export GEMINI_API_KEY=your_key_here';
            break;
        }
        throw new Error(
          `${providerName} API key is required. ${envVarHelp ? `Run: ${envVarHelp}` : ''}`
        );
      }
    }

    const providers = ['system', 'openai', 'elevenlabs', 'groq', 'gemini'];
    let lastError: Error | null = null;

    for (const providerName of providers) {
      if (providerName === requestedProvider || lastError) {
        try {
          const provider = this.providers.get(providerName);
          if (provider && provider.validateConfig()) {
            const voice = this.getVoiceForProvider(providerName);
            const rate = this.config.rate || 180;
            const volume = this.config.volume !== undefined ? this.config.volume : 0.7;
            const tempDir = this.config.tempDir || '/tmp';
            
            if (this.debug) {
              console.log(`✅ Using provider: ${providerName}`);
              console.log(`🎙️  Voice/model: ${voice}`);
              console.log(`⚡ Rate: ${rate} WPM`);
              console.log(`🔊 Volume: ${(volume * 100).toFixed(0)}%`);
            }
            
            // Check cache first if caching is enabled
            if (this.useCache && providerName !== 'system' && this.cache) {
              const cacheKey = this.cache!.generateCacheKey(text, providerName, voice, rate);
              const cachedEntry = await this.cache!.get(cacheKey);
              
              if (cachedEntry) {
                console.log(`(already cached)`);
                if (this.debug) {
                  console.log(`📦 Using cached audio from: ${cachedEntry.audioFilePath}`);
                }
                await this.playCachedAudio(cachedEntry.audioFilePath);
                return;
              }
            }

            // Generate new audio
            let audioBuffer: Buffer | null = null;
            
            if (providerName === 'system') {
              // System provider doesn't support caching, use speak directly
              if (this.debug) {
                console.log(`🎙️  Using system voice: ${voice}`);
              }
              await provider.speak({
                text,
                rate,
                tempDir,
                voice,
                volume,
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
                  volume,
                  apiKey: this.getApiKeyForProvider(providerName) || ''
                });
              } else {
                // Fallback for providers without generateAudio
                await provider.speak({
                  text,
                  rate,
                  tempDir,
                  voice,
                  volume,
                  apiKey: this.getApiKeyForProvider(providerName) || ''
                });
                return;
              }
            }

            // Cache the audio if enabled and buffer was returned
            if (this.useCache && providerName !== 'system' && this.cache && audioBuffer) {
              const cacheKey = this.cache!.generateCacheKey(text, providerName, voice, rate);
              const startTime = Date.now();
              await this.cache!.set(cacheKey, {
                provider: providerName,
                voice,
                rate,
                text
              }, audioBuffer, {
                model: this.inferModel(providerName),
                durationMs: Date.now() - startTime,
                success: true
              });
              
              console.log('cached');
              
              // Play the generated audio
              const tempFile = path.join(tempDir, `speech_${Date.now()}.mp3`);
              fs.writeFileSync(tempFile, audioBuffer);
              const volumeFlag = volume !== 1.0 ? ` -v ${volume}` : '';
              execSync(`afplay${volumeFlag} "${tempFile}"`);
              
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
              }
            } else if (audioBuffer) {
              // Play directly if no caching
              const tempFile = path.join(tempDir, `speech_${Date.now()}.mp3`);
              if (this.debug) {
                console.log(`🎵 Playing generated audio: ${tempFile}`);
              }
              fs.writeFileSync(tempFile, audioBuffer);
              const volumeFlag = volume !== 1.0 ? ` -v ${volume}` : '';
              execSync(`afplay${volumeFlag} "${tempFile}"`);
              
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
      // If we tried a specific provider and it failed, provide better guidance
      if (requestedProvider !== 'system') {
        const providerName = requestedProvider.charAt(0).toUpperCase() + requestedProvider.slice(1);
        let helpText = '';
        
        if (lastError.message.includes('API key')) {
          switch (requestedProvider) {
            case 'openai':
              helpText = 'Get your API key: https://platform.openai.com/api-keys';
              break;
            case 'elevenlabs':
              helpText = 'Get your API key: https://elevenlabs.io/app/settings/api-keys';
              break;
            case 'groq':
              helpText = 'Get your API key: https://console.groq.com/keys';
              break;
            case 'gemini':
              helpText = 'Get your API key: https://makersuite.google.com/app/apikey';
              break;
          }
        }
        
        throw new Error(
          `${providerName} failed: ${lastError.message}${helpText ? `\n💡 ${helpText}` : ''}\n🗣️  Try: speakeasy --text "hello world" --provider system`
        );
      }
      throw new Error(`All providers failed. Last error: ${lastError.message}`);
    }

    // Fallback to system voice (never cached)
    const systemProvider = this.providers.get('system');
    if (systemProvider) {
      try {
        if (this.debug) {
          console.log(`🗣️  Falling back to system voice: ${this.config.systemVoice || 'Samantha'}`);
        }
        await systemProvider.speak({
          text,
          rate: this.config.rate || 180,
          tempDir: this.config.tempDir || '/tmp',
          voice: this.config.systemVoice || 'Samantha',
          volume: this.config.volume !== undefined ? this.config.volume : 0.7
        });
      } catch (error) {
        throw new Error(`System voice failed: ${error}. Ensure you're on macOS.`);
      }
    }
  }

  private printConfigDiagnostics(): void {
    console.log('🔍 Debug mode enabled');
    
    // Configuration summary
    console.log('📊 Current Configuration:');
    console.log(`   Provider: ${this.config.provider}`);
    console.log(`   Rate: ${this.config.rate} WPM`);
    console.log(`   Volume: ${((this.config.volume || 0.7) * 100).toFixed(0)}%`);
    console.log(`   System Voice: ${this.config.systemVoice}`);
    console.log(`   OpenAI Voice: ${this.config.openaiVoice}`);
    console.log(`   ElevenLabs Voice: ${this.config.elevenlabsVoiceId}`);
    console.log(`   Gemini Model: ${this.config.geminiModel}`);
    
    // API Key status
    console.log('🔑 API Key Status:');
    const providers = [
      { name: 'OpenAI', key: 'openai', env: 'OPENAI_API_KEY' },
      { name: 'ElevenLabs', key: 'elevenlabs', env: 'ELEVENLABS_API_KEY' },
      { name: 'Groq', key: 'groq', env: 'GROQ_API_KEY' },
      { name: 'Gemini', key: 'gemini', env: 'GEMINI_API_KEY' }
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
    
    // Cache status
    console.log('📦 Cache Status:');
    console.log(`   Enabled: ${this.useCache}`);
    if (this.cache) {
      console.log(`   Directory: ${(this.cache as any).dir || 'default'}`);
    }
    
    console.log('');
  }

  private async playCachedAudio(audioFilePath: string): Promise<void> {
    // Play cached audio file using system audio player
    const { execSync } = require('child_process');
    const volume = this.config.volume !== undefined ? this.config.volume : 0.7;
    const volumeFlag = volume !== 1.0 ? ` -v ${volume}` : '';
    execSync(`afplay${volumeFlag} "${audioFilePath}"`, { stdio: 'inherit' });
  }

  private getVoiceForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return this.config.openaiVoice || 'nova';
      case 'elevenlabs': return this.config.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL';
      case 'system': return this.config.systemVoice || 'Samantha';
      case 'groq': return 'Celeste-PlayAI';
      case 'gemini': return this.config.geminiModel || 'gemini-2.5-pro-preview-tts';
      default: return this.config.systemVoice || 'Samantha';
    }
  }

  private getApiKeyForProvider(provider: string): string {
    switch (provider) {
      case 'openai': return this.config.apiKeys?.openai || '';
      case 'elevenlabs': return this.config.apiKeys?.elevenlabs || '';
      case 'groq': return this.config.apiKeys?.groq || '';
      case 'gemini': return this.config.apiKeys?.gemini || '';
      default: return '';
    }
  }

  private inferModel(provider: string): string {
    switch (provider) {
      case 'openai': return 'tts-1';
      case 'elevenlabs': return 'eleven_multilingual_v2';
      case 'groq': return 'tts-1-hd';
      case 'gemini': return this.config.geminiModel || 'gemini-2.5-pro-preview-tts';
      case 'system': return 'macOS-system';
      default: return provider;
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
export const say = (text: string, provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini') => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for say()');
  }
  return new SpeakEasy(provider ? { provider } : {}).speak(text);
};

export const speak = (text: string, options?: SpeakEasyOptions & { provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini', volume?: number }) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text argument is required for speak()');
  }
  const { provider, volume, ...speakOptions } = options || {};
  const config: SpeakEasyConfig = { provider, volume };
  return new SpeakEasy(config).speak(text, speakOptions);
};

export * from './types';
export { SystemProvider } from './providers/system';
export { OpenAIProvider } from './providers/openai';
export { ElevenLabsProvider } from './providers/elevenlabs';
export { GroqProvider } from './providers/groq';
export { GeminiProvider } from './providers/gemini';
export { TTSCache } from './cache';