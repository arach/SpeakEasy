#!/usr/bin/env node

import { SpeakEasy, SpeakEasyConfig } from '../dist/index.js';
import * as path from 'path';
import * as fs from 'fs';
import { TTSCache } from '../dist/cache.js';

const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speakeasy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

interface CLIOptions {
  text?: string;
  provider?: string;
  voice?: string;
  rate?: number;
  interrupt?: boolean;
  cache?: boolean;
  clearCache?: boolean;
  config?: boolean;
  help?: boolean;
}

function showHelp(): void {
  console.log(`
🗣️  SpeakEasy CLI - Text-to-Speech Command Line Tool

Usage:
  speakeasy [text] [options]
  speakeasy --text "Hello world" --provider openai
  speakeasy --config
  speakeasy --cache --clear

Options:
  --text, -t          Text to speak (can be positional argument)
  --provider, -p      Provider: system, openai, elevenlabs, groq
  --voice, -v         Voice to use (depends on provider)
  --rate, -r          Speech rate (words per minute)
  --interrupt, -i     Interrupt current speech
  --cache, -c         Enable caching
  --clear-cache       Clear the cache
  --config            Show current configuration
  --help, -h          Show this help

Examples:
  speakeasy "Hello world"
  speakeasy --text "Hello world" --provider openai --voice nova
  speakeasy --text "Hello world" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL
  speakeasy --cache --text "Hello cached world"
  speakeasy --clear-cache
`);
}

function showConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      console.log('📊 Current configuration:');
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('📊 No configuration file found at:', CONFIG_FILE);
    }
  } catch (error) {
    console.error('❌ Error reading config:', (error as Error).message);
  }
}

async function clearCache(): Promise<void> {
  try {
    const speaker = new SpeakEasy({});
    const stats = await speaker.getCacheStats();
    if (stats.dir) {
      const cache = new TTSCache(stats.dir, '7d');
      await cache.clear();
      console.log('🗑️  Cache cleared successfully');
    } else {
      console.log('❌ Cache not enabled or directory not found');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', (error as Error).message);
  }
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    return;
  }

  const options: CLIOptions = {};
  let text = '';

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      
      case '--config':
        options.config = true;
        break;
      
      case '--clear-cache':
        options.clearCache = true;
        break;
      
      case '--text':
      case '-t':
        text = args[++i];
        break;
      
      case '--provider':
      case '-p':
        options.provider = args[++i];
        break;
      
      case '--voice':
      case '-v':
        options.voice = args[++i];
        break;
      
      case '--rate':
      case '-r':
        options.rate = parseInt(args[++i]) || 180;
        break;
      
      case '--interrupt':
      case '-i':
        options.interrupt = true;
        break;
      
      case '--cache':
      case '-c':
        options.cache = true;
        break;
      
      default:
        // Positional argument (text)
        if (!text && !arg.startsWith('-')) {
          text = arg;
        }
        break;
    }
  }

  if (options.help) {
    showHelp();
    return;
  }

  if (options.config) {
    showConfig();
    return;
  }

  if (options.clearCache) {
    await clearCache();
    return;
  }

  if (!text) {
    console.error('❌ No text provided to speak');
    process.exit(1);
  }

  try {
    const config: SpeakEasyConfig = {
      provider: (options.provider as any) || 'system',
      rate: options.rate || 180,
      ...(options.cache && { cache: { enabled: true } })
    };

    if (options.voice) {
      switch (options.provider) {
        case 'system':
          config.systemVoice = options.voice;
          break;
        case 'openai':
          config.openaiVoice = options.voice as any;
          break;
        case 'elevenlabs':
          config.elevenlabsVoiceId = options.voice;
          break;
      }
    }

    const speaker = new SpeakEasy(config);
    await speaker.speak(text, { interrupt: options.interrupt });
    
    if (options.cache) {
      console.log('🔍 Cache stats:', await speaker.getCacheStats());
    }
    
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().catch(console.error);
}