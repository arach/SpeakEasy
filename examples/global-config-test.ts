#!/usr/bin/env node

/**
 * Test global configuration usage
 * Demonstrates how the config file is actually used
 */

import { SpeechService, createSpeechService } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function testGlobalConfig() {
  console.log('⚙️  Global Configuration Test\n');

  const configPath = path.join(os.homedir(), '.config', 'speech', 'config.json');
  
  // Show current config structure
  console.log('📋 Current config structure:');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('   Provider:', config.provider);
    console.log('   OpenAI Voice:', config.openaiVoice);
    console.log('   ElevenLabs Voice:', config.elevenlabsVoiceId);
    console.log('   Rate:', config.rate);
    console.log('   API Keys:', {
      openai: config.apiKeys?.openai ? '✅ Set' : '❌ Missing',
      elevenlabs: config.apiKeys?.elevenlabs ? '✅ Set' : '❌ Missing'
    });
  } catch (error) {
    console.log('   ❌ No global config found');
  }

  console.log('\n🧪 Testing with global config:');
  
  // Test 1: Use global config directly
  console.log('1️⃣  SpeechService with global config:');
  try {
    const speech = new SpeechService({ provider: 'openai' }); // Will use global config values
    await speech.speak('Testing OpenAI Nova voice from global config');
    console.log('   ✅ Global config working');
  } catch (error) {
    console.log('   ❌ Global config failed:', error.message);
  }

  // Test 2: Override specific settings
  console.log('\n2️⃣  Override global config:');
  try {
    const speech = new SpeechService({
      provider: 'openai',
      openaiVoice: 'shimmer', // Override global setting
      rate: 220, // Override global setting
      // apiKeys will still come from global config
    });
    await speech.speak('Testing with overridden OpenAI Shimmer voice');
    console.log('   ✅ Override working');
  } catch (error) {
    console.log('   ❌ Override failed:', error.message);
  }

  // Test 3: Factory functions use global config
  console.log('\n3️⃣  Factory functions with global config:');
  try {
    const speech = createSpeechService.forNotifications();
    await speech.speak('Factory function using global config');
    console.log('   ✅ Factory with global config working');
  } catch (error) {
    console.log('   ❌ Factory failed:', error.message);
  }

  console.log('\n✅ Global config test completed!');
}

// Create a better config structure example
async function createBetterConfig() {
  const configPath = path.join(os.homedir(), '.config', 'speech', 'config.json');
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Better config structure (keeping API keys in env vars)
  const betterConfig = {
    provider: 'openai',
    openaiVoice: 'nova',
    elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    rate: 180,
    systemVoice: 'Samantha',
    tempDir: '/tmp',
    // Remove API keys from config - use env vars instead
  };

  fs.writeFileSync(configPath, JSON.stringify(betterConfig, null, 2));
  console.log('✅ Created better config structure');
}

if (process.argv.includes('--fix-config')) {
  createBetterConfig();
} else {
  testGlobalConfig();
}