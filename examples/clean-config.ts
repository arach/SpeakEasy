#!/usr/bin/env node

/**
 * Clean provider configuration structure
 * Shows the ideal setup for all projects to share
 */

import { SpeechService } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Clean, provider-focused config structure
const config = {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      voice: 'nova',
      rate: 180,
      enabled: Boolean(process.env.OPENAI_API_KEY),
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      rate: 190,
      enabled: Boolean(process.env.ELEVENLABS_API_KEY),
    },
    system: {
      voice: 'Samantha',
      rate: 200,
      enabled: true, // Always available on macOS
    },
  },
  defaults: {
    provider: 'openai',
    fallbackOrder: ['openai', 'elevenlabs', 'system'] as const,
  },
};

// Clean factory that uses the config
export const createConfiguredSpeechService = {
  forNotifications: () => new SpeechService({
    provider: config.defaults.provider,
    openaiVoice: config.providers.openai.voice,
    elevenlabsVoiceId: config.providers.elevenlabs.voiceId,
    rate: config.providers[config.defaults.provider].rate,
    apiKeys: {
      openai: config.providers.openai.apiKey,
      elevenlabs: config.providers.elevenlabs.apiKey,
    },
  }),

  forDevelopment: () => new SpeechService({
    provider: 'system',
    systemVoice: config.providers.system.voice,
    rate: config.providers.system.rate,
  }),

  forProduction: () => new SpeechService({
    provider: config.defaults.fallbackOrder.find(p => config.providers[p].enabled) || 'system',
    openaiVoice: config.providers.openai.voice,
    elevenlabsVoiceId: config.providers.elevenlabs.voiceId,
    rate: 180,
    apiKeys: {
      openai: config.providers.openai.apiKey,
      elevenlabs: config.providers.elevenlabs.apiKey,
    },
  }),
};

async function testCleanConfig() {
  console.log('🎯 Clean Provider Configuration Test\n');

  console.log('📋 Provider Status:');
  Object.entries(config.providers).forEach(([name, provider]) => {
    console.log(`   ${name}: ${provider.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  });

  console.log('');

  // Test each enabled provider
  for (const [providerName, providerConfig] of Object.entries(config.providers)) {
    if (!providerConfig.enabled) continue;

    console.log(`🧪 Testing ${providerName}:`);
    try {
      const speech = new SpeechService({
        provider: providerName as any,
        ...(providerName === 'openai' ? {
          openaiVoice: providerConfig.voice,
          rate: providerConfig.rate,
          apiKeys: { openai: providerConfig.apiKey },
        } : {}),
        ...(providerName === 'elevenlabs' ? {
          elevenlabsVoiceId: providerConfig.voiceId,
          rate: providerConfig.rate,
          apiKeys: { elevenlabs: providerConfig.apiKey },
        } : {}),
        ...(providerName === 'system' ? {
          systemVoice: providerConfig.voice,
          rate: providerConfig.rate,
        } : {}),
      });

      await speech.speak(`This is the ${providerName} provider`);
      console.log(`   ✅ ${providerName} working`);
    } catch (error) {
      console.log(`   ❌ ${providerName} failed: ${error.message}`);
    }
  }

  console.log('\n✅ Clean config test completed!');
}

// Save clean config for all projects
function saveGlobalConfig() {
  const configPath = path.join(os.homedir(), '.config', 'speech', 'clean-config.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Saved clean config to: ${configPath}`);
  
  // Also create a .env template
  const envPath = path.join(os.homedir(), '.config', 'speech', '.env.template');
  const envTemplate = `# Speech Service API Keys
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
`;
  fs.writeFileSync(envPath, envTemplate);
  console.log(`✅ Created .env template at: ${envPath}`);
}

if (process.argv.includes('--save-global')) {
  saveGlobalConfig();
} else {
  testCleanConfig();
}

export { config };