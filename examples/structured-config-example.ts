#!/usr/bin/env node

/**
 * Better structured configuration example
 * Uses clear provider-specific settings
 */

import { SpeechService } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Better config structure
interface SpeechConfig {
  providers: {
    system: {
      enabled: boolean;
      voice: string;
      rate: number;
    };
    openai: {
      enabled: boolean;
      voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      rate: number;
      apiKey?: string;
    };
    elevenlabs: {
      enabled: boolean;
      voiceId: string;
      rate: number;
      apiKey?: string;
    };
  };
  defaultProvider: 'system' | 'openai' | 'elevenlabs';
  fallbackOrder: ('system' | 'openai' | 'elevenlabs')[];
}

const betterConfig: SpeechConfig = {
  providers: {
    system: {
      enabled: true,
      voice: 'Samantha',
      rate: 200,
    },
    openai: {
      enabled: true,
      voice: 'nova',
      rate: 180,
      apiKey: process.env.OPENAI_API_KEY,
    },
    elevenlabs: {
      enabled: true,
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
      rate: 190,
      apiKey: process.env.ELEVENLABS_API_KEY,
    },
  },
  defaultProvider: 'openai',
  fallbackOrder: ['openai', 'elevenlabs', 'system'],
};

class ConfigurableSpeechService {
  private config: SpeechConfig;

  constructor(config: SpeechConfig) {
    this.config = config;
  }

  async speak(text: string, options: { provider?: keyof SpeechConfig['providers'] } = {}) {
    const provider = options.provider || this.config.defaultProvider;
    const providerConfig = this.config.providers[provider];

    if (!providerConfig.enabled) {
      throw new Error(`${provider} provider is disabled`);
    }

    const speech = new SpeechService({
      provider: provider,
      ...(provider === 'system' ? {
        systemVoice: providerConfig.voice,
        rate: providerConfig.rate,
      } : {}),
      ...(provider === 'openai' ? {
        openaiVoice: providerConfig.voice,
        rate: providerConfig.rate,
        apiKeys: { openai: providerConfig.apiKey },
      } : {}),
      ...(provider === 'elevenlabs' ? {
        elevenlabsVoiceId: providerConfig.voiceId,
        rate: providerConfig.rate,
        apiKeys: { elevenlabs: providerConfig.apiKey },
      } : {}),
    });

    await speech.speak(text);
  }

  async speakWithFallback(text: string) {
    for (const provider of this.config.fallbackOrder) {
      const providerConfig = this.config.providers[provider];
      
      if (!providerConfig.enabled) continue;
      
      try {
        console.log(`🎯 Trying ${provider}...`);
        await this.speak(text, { provider });
        console.log(`✅ ${provider} succeeded`);
        return;
      } catch (error) {
        console.warn(`⚠️ ${provider} failed: ${error.message}`);
      }
    }
    throw new Error('All providers failed');
  }

  getAvailableProviders() {
    return Object.entries(this.config.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider);
  }
}

async function testStructuredConfig() {
  console.log('🏗️ Structured Configuration Test\n');

  const service = new ConfigurableSpeechService(betterConfig);

  console.log('📋 Available providers:', service.getAvailableProviders());
  console.log('');

  // Test specific providers
  for (const provider of service.getAvailableProviders()) {
    console.log(`🧪 Testing ${provider}:`);
    try {
      await service.speak(`This is a test with the ${provider} provider`, { provider });
      console.log(`   ✅ ${provider} working`);
    } catch (error) {
      console.log(`   ❌ ${provider} failed: ${error.message}`);
    }
  }

  console.log('\n🔄 Testing fallback system:');
  try {
    await service.speakWithFallback('Testing automatic fallback system');
  } catch (error) {
    console.log('❌ Fallback failed:', error.message);
  }

  console.log('\n✅ Structured config test completed!');
}

// Save better config structure
function saveBetterConfig() {
  const configPath = path.join(os.homedir(), '.config', 'speech', 'structured-config.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(betterConfig, null, 2));
  console.log(`✅ Saved better config to: ${configPath}`);
}

if (process.argv.includes('--save-config')) {
  saveBetterConfig();
} else {
  testStructuredConfig();
}