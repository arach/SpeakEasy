#!/usr/bin/env node

/**
 * Nested configuration structure with proper provider separation
 * Eliminates flat mixing of provider settings
 */

import { SpeechService } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Proper nested configuration structure
interface NestedConfig {
  providers: {
    openai: {
      enabled: boolean;
      settings: {
        voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
        model: string;
        speed: number;
      };
      apiKey?: string;
      rate: number;
    };
    elevenlabs: {
      enabled: boolean;
      settings: {
        voiceId: string;
        modelId: string;
        stability: number;
        similarityBoost: number;
      };
      apiKey?: string;
      rate: number;
    };
    system: {
      enabled: boolean;
      settings: {
        voice: string;
      };
      rate: number;
    };
    groq: {
      enabled: boolean;
      settings: {
        voice: string;
        model: string;
      };
      apiKey?: string;
      rate: number;
    };
  };
  defaults: {
    provider: keyof NestedConfig['providers'];
    fallbackOrder: (keyof NestedConfig['providers'])[];
  };
  global: {
    tempDir: string;
    cleanup: boolean;
  };
}

// Clean nested config
const nestedConfig: NestedConfig = {
  providers: {
    openai: {
      enabled: Boolean(process.env.OPENAI_API_KEY),
      settings: {
        voice: 'nova',
        model: 'tts-1',
        speed: 1.0,
      },
      apiKey: process.env.OPENAI_API_KEY,
      rate: 180,
    },
    elevenlabs: {
      enabled: Boolean(process.env.ELEVENLABS_API_KEY),
      settings: {
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        modelId: 'eleven_monolingual_v1',
        stability: 0.5,
        similarityBoost: 0.5,
      },
      apiKey: process.env.ELEVENLABS_API_KEY,
      rate: 190,
    },
    system: {
      enabled: true,
      settings: {
        voice: 'Samantha',
      },
      rate: 200,
    },
    groq: {
      enabled: Boolean(process.env.GROQ_API_KEY),
      settings: {
        voice: 'nova',
        model: 'tts-1',
      },
      apiKey: process.env.GROQ_API_KEY,
      rate: 185,
    },
  },
  defaults: {
    provider: 'openai',
    fallbackOrder: ['openai', 'elevenlabs', 'groq', 'system'],
  },
  global: {
    tempDir: '/tmp',
    cleanup: true,
  },
};

// Clean factory that uses nested config
class NestedSpeechServiceFactory {
  private config: NestedConfig;

  constructor(config: NestedConfig) {
    this.config = config;
  }

  createService(providerName: keyof NestedConfig['providers']): SpeechService {
    const provider = this.config.providers[providerName];
    
    if (!provider.enabled) {
      throw new Error(`${providerName} provider is disabled`);
    }

    switch (providerName) {
      case 'openai':
        return new SpeechService({
          provider: 'openai',
          openaiVoice: provider.settings.voice,
          rate: provider.rate,
          apiKeys: { openai: provider.apiKey },
        });
      
      case 'elevenlabs':
        return new SpeechService({
          provider: 'elevenlabs',
          elevenlabsVoiceId: provider.settings.voiceId,
          rate: provider.rate,
          apiKeys: { elevenlabs: provider.apiKey },
        });
      
      case 'system':
        return new SpeechService({
          provider: 'system',
          systemVoice: provider.settings.voice,
          rate: provider.rate,
        });
      
      case 'groq':
        // Note: Groq support would need to be added to the core service
        // This is a placeholder for now
        return new SpeechService({
          provider: 'openai', // Fallback to OpenAI for demo
          openaiVoice: provider.settings.voice,
          rate: provider.rate,
          apiKeys: { openai: provider.apiKey },
        });
      
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  createBestAvailable(): SpeechService {
    const available = this.config.defaults.fallbackOrder.filter(
      provider => this.config.providers[provider].enabled
    );
    
    if (available.length === 0) {
      throw new Error('No providers available');
    }
    
    return this.createService(available[0]);
  }

  createForNotifications(): SpeechService {
    return this.createBestAvailable();
  }

  createForDevelopment(): SpeechService {
    return this.createService('system');
  }

  getAvailableProviders(): (keyof NestedConfig['providers'])[] {
    return Object.entries(this.config.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider as keyof NestedConfig['providers']);
  }

  getProviderSettings(provider: keyof NestedConfig['providers']) {
    return this.config.providers[provider];
  }
}

// Factory with nested config
const createNestedSpeechService = {
  fromConfig: (config: NestedConfig) => new NestedSpeechServiceFactory(config),
  
  default: () => new NestedSpeechServiceFactory(nestedConfig),
  
  forProvider: (provider: keyof NestedConfig['providers']) => new NestedSpeechServiceFactory(nestedConfig).createService(provider),
  
  forNotifications: () => new NestedSpeechServiceFactory(nestedConfig).createBestAvailable(),
  
  forDevelopment: () => new NestedSpeechServiceFactory(nestedConfig).createService('system'),
};

async function testNestedConfig() {
  console.log('🏗️ Nested Configuration Test\n');

  const factory = createNestedSpeechService.default();

  console.log('📋 Provider Status:');
  factory.getAvailableProviders().forEach(provider => {
    const settings = factory.getProviderSettings(provider);
    console.log(`   ${provider}: ${settings.enabled ? '✅' : '❌'}`);
    console.log(`     Settings:`, settings.settings);
  });

  console.log('');

  // Test each provider
  for (const provider of factory.getAvailableProviders()) {
    console.log(`🧪 Testing ${provider}:`);
    try {
      const service = factory.createService(provider);
      await service.speak(`Testing ${provider} with nested configuration`);
      console.log(`   ✅ ${provider} working`);
    } catch (error) {
      console.log(`   ❌ ${provider} failed: ${error.message}`);
    }
  }

  console.log('\n✅ Nested config test completed!');
}

// Save nested config
function saveNestedConfig() {
  const configPath = path.join(os.homedir(), '.config', 'speech', 'nested-config.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(nestedConfig, null, 2));
  console.log(`✅ Saved nested config to: ${configPath}`);
}

if (process.argv.includes('--save-nested')) {
  saveNestedConfig();
} else {
  testNestedConfig();
}

export { nestedConfig, NestedSpeechServiceFactory };
export { createNestedSpeechService };