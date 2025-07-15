#!/usr/bin/env node

/**
 * Refactored provider configuration with clean API mapping
 * Better separation of concerns and provider-specific settings
 */

import { SpeechService } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Clean provider API mapping
interface ProviderConfig {
  name: string;
  enabled: boolean;
  settings: Record<string, any>;
  apiKey?: string;
  rate: number;
}

interface ProviderConfigs {
  openai: ProviderConfig;
  elevenlabs: ProviderConfig;
  system: ProviderConfig;
  groq?: ProviderConfig;
}

const providerConfigs: ProviderConfigs = {
  openai: {
    name: 'OpenAI',
    enabled: Boolean(process.env.OPENAI_API_KEY),
    settings: {
      model: 'tts-1',
      voice: 'nova',
      speed: 1.0,
    },
    apiKey: process.env.OPENAI_API_KEY,
    rate: 180,
  },
  elevenlabs: {
    name: 'ElevenLabs',
    enabled: Boolean(process.env.ELEVENLABS_API_KEY),
    settings: {
      model_id: 'eleven_monolingual_v1',
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      stability: 0.5,
      similarity_boost: 0.5,
    },
    apiKey: process.env.ELEVENLABS_API_KEY,
    rate: 190,
  },
  system: {
    name: 'System',
    enabled: true,
    settings: {
      voice: 'Samantha',
    },
    rate: 200,
  },
  groq: {
    name: 'Groq',
    enabled: Boolean(process.env.GROQ_API_KEY),
    settings: {
      model: 'tts-1',
      voice: 'nova',
      speed: 1.0,
    },
    apiKey: process.env.GROQ_API_KEY,
    rate: 185,
  },
};

// Provider adapter interface
interface ProviderAdapter {
  name: string;
  isEnabled(): boolean;
  createService(): SpeechService;
  getSettings(): Record<string, any>;
}

class OpenAIAdapter implements ProviderAdapter {
  name = 'openai';
  
  constructor(private config: ProviderConfig) {}
  
  isEnabled() {
    return this.config.enabled;
  }
  
  createService() {
    return new SpeechService({
      provider: 'openai',
      openaiVoice: this.config.settings.voice,
      rate: this.config.rate,
      apiKeys: { openai: this.config.apiKey },
    });
  }
  
  getSettings() {
    return this.config.settings;
  }
}

class ElevenLabsAdapter implements ProviderAdapter {
  name = 'elevenlabs';
  
  constructor(private config: ProviderConfig) {}
  
  isEnabled() {
    return this.config.enabled;
  }
  
  createService() {
    return new SpeechService({
      provider: 'elevenlabs',
      elevenlabsVoiceId: this.config.settings.voice_id,
      rate: this.config.rate,
      apiKeys: { elevenlabs: this.config.apiKey },
    });
  }
  
  getSettings() {
    return this.config.settings;
  }
}

class SystemAdapter implements ProviderAdapter {
  name = 'system';
  
  constructor(private config: ProviderConfig) {}
  
  isEnabled() {
    return this.config.enabled;
  }
  
  createService() {
    return new SpeechService({
      provider: 'system',
      systemVoice: this.config.settings.voice,
      rate: this.config.rate,
    });
  }
  
  getSettings() {
    return this.config.settings;
  }
}

// Provider registry
class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();

  constructor() {
    this.registerAdapters();
  }

  private registerAdapters() {
    if (providerConfigs.openai.enabled) {
      this.adapters.set('openai', new OpenAIAdapter(providerConfigs.openai));
    }
    if (providerConfigs.elevenlabs.enabled) {
      this.adapters.set('elevenlabs', new ElevenLabsAdapter(providerConfigs.elevenlabs));
    }
    if (providerConfigs.system.enabled) {
      this.adapters.set('system', new SystemAdapter(providerConfigs.system));
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAdapter(provider: string): ProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  createService(provider: string): SpeechService | undefined {
    const adapter = this.adapters.get(provider);
    return adapter?.createService();
  }

  getFallbackOrder(): string[] {
    return ['openai', 'elevenlabs', 'system'].filter(p => this.adapters.has(p));
  }
}

// Clean factory functions
export const createRefactoredSpeechService = {
  forProvider: (provider: keyof typeof providerConfigs) => {
    const config = providerConfigs[provider];
    if (!config.enabled) {
      throw new Error(`${provider} provider is not enabled`);
    }

    switch (provider) {
      case 'openai':
        return new SpeechService({
          provider: 'openai',
          openaiVoice: config.settings.voice,
          rate: config.rate,
          apiKeys: { openai: config.apiKey },
        });
      case 'elevenlabs':
        return new SpeechService({
          provider: 'elevenlabs',
          elevenlabsVoiceId: config.settings.voice_id,
          rate: config.rate,
          apiKeys: { elevenlabs: config.apiKey },
        });
      case 'system':
        return new SpeechService({
          provider: 'system',
          systemVoice: config.settings.voice,
          rate: config.rate,
        });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  },

  forBestAvailable: () => {
    const registry = new ProviderRegistry();
    const providers = registry.getFallbackOrder();
    
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    return registry.createService(providers[0])!;
  },

  forNotifications: () => createRefactoredSpeechService.forBestAvailable(),
  
  forDevelopment: () => createRefactoredSpeechService.forProvider('system'),
};

async function testRefactoredProviders() {
  console.log('🏗️ Refactored Provider Configuration Test\n');

  const registry = new ProviderRegistry();
  
  console.log('📋 Available Providers:');
  registry.getAvailableProviders().forEach(provider => {
    const config = providerConfigs[provider as keyof typeof providerConfigs];
    console.log(`   ${config.name}: ${config.enabled ? '✅' : '❌'}`);
  });

  console.log('');

  // Test each available provider
  for (const provider of registry.getAvailableProviders()) {
    console.log(`🧪 Testing ${provider}:`);
    try {
      const service = registry.createService(provider)!;
      await service.speak(`Testing ${provider} provider with refactored configuration`);
      console.log(`   ✅ ${provider} working`);
    } catch (error) {
      console.log(`   ❌ ${provider} failed: ${error.message}`);
    }
  }

  console.log('\n🔄 Testing best available provider:');
  try {
    const bestService = createRefactoredSpeechService.forBestAvailable();
    await bestService.speak('Using the best available provider based on configuration');
    console.log('   ✅ Best provider selected');
  } catch (error) {
    console.log('   ❌ Best provider failed:', error.message);
  }

  console.log('\n✅ Refactored provider test completed!');
}

// Save refactored config structure
function saveRefactoredConfig() {
  const configPath = path.join(os.homedir(), '.config', 'speech', 'providers.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify({
    providers: providerConfigs,
    defaults: {
      provider: 'openai',
      fallbackOrder: ['openai', 'elevenlabs', 'system'],
    },
  }, null, 2));
  
  console.log(`✅ Saved refactored config to: ${configPath}`);
}

if (process.argv.includes('--save-providers')) {
  saveRefactoredConfig();
} else {
  testRefactoredProviders();
}

export { providerConfigs, ProviderRegistry, createRefactoredSpeechService };