#!/usr/bin/env node

import { SpeakEasy, SpeakEasyConfig } from '../index';
import * as path from 'path';
import * as fs from 'fs';
import { TTSCache } from '../cache';

const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speakeasy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

function loadGlobalConfig() {
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

interface CLIOptions {
  text?: string;
  provider?: string;
  voice?: string;
  rate?: number;
  interrupt?: boolean;
  cache?: boolean;
  clearCache?: boolean;
  config?: boolean;
  diagnose?: boolean;
  doctor?: boolean;
  help?: boolean;
  debug?: boolean;
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
  --debug, -d         Enable debug logging
  --diagnose          Show configuration diagnostics
  --doctor            Run health checks and provide fixes

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

function diagnoseConfig(): void {
  try {
    const globalConfig = loadGlobalConfig();
    console.log('🔍 Configuration Diagnostics');
    console.log('');
    
    // Global config file status
    if (fs.existsSync(CONFIG_FILE)) {
      console.log('✅ Config file found:', CONFIG_FILE);
    } else {
      console.log('❌ No config file found at:', CONFIG_FILE);
    }
    
    console.log('');
    console.log('📊 Settings Summary:');
    console.log(`   Default Provider: ${globalConfig.defaults?.provider || 'system'}`);
    console.log(`   Default Rate: ${globalConfig.defaults?.rate || 180} WPM`);
    console.log(`   Fallback Order: ${(globalConfig.defaults?.fallbackOrder || ['system']).join(' → ')}`);
    console.log(`   Temp Dir: ${globalConfig.global?.tempDir || '/tmp'}`);
    console.log(`   Auto-cleanup: ${globalConfig.global?.cleanup !== false}`);
    
    console.log('');
    console.log('🔑 API Key Status:');
    
    const providers = [
      { name: 'OpenAI', configKey: 'openai', envKey: 'OPENAI_API_KEY' },
      { name: 'ElevenLabs', configKey: 'elevenlabs', envKey: 'ELEVENLABS_API_KEY' },
      { name: 'Groq', configKey: 'groq', envKey: 'GROQ_API_KEY' }
    ];
    
    providers.forEach(({ name, configKey, envKey }) => {
      const fromConfig = globalConfig.providers?.[configKey as keyof typeof globalConfig.providers]?.apiKey;
      const fromEnv = process.env[envKey];
      
      if (fromConfig && fromConfig.length > 10) {
        console.log(`   ✅ ${name}: Available from config file (${fromConfig.substring(0, 8)}...)`);
      } else if (fromEnv && fromEnv.length > 10) {
        console.log(`   ✅ ${name}: Available from environment (${fromEnv.substring(0, 8)}...)`);
      } else {
        console.log(`   ❌ ${name}: Not configured`);
        if (globalConfig.providers?.[configKey as keyof typeof globalConfig.providers]?.enabled) {
          console.log(`      → Expected in config.providers.${configKey}.apiKey`);
        }
        console.log(`      → Or set: export ${envKey}=your_key_here`);
      }
    });
    
    console.log('');
    console.log('🎙️  Voice Settings:');
    console.log(`   System: ${globalConfig.providers?.system?.voice || 'Samantha'}`);
    console.log(`   OpenAI: ${globalConfig.providers?.openai?.voice || 'nova'}`);
    console.log(`   ElevenLabs: ${globalConfig.providers?.elevenlabs?.voiceId || 'EXAVITQu4vr4xnSDxMaL'}`);
    console.log(`   Groq: ${globalConfig.providers?.groq?.voice || 'nova'}`);
    
    console.log('');
    console.log('💡 Usage Tips:');
    console.log('   • Use --debug to see runtime details');
    console.log('   • Use --provider system for built-in voices (no API keys needed)');
    console.log('   • Edit ~/.config/speakeasy/settings.json to configure defaults');
    
} catch (error) {
    console.error('❌ Error reading config:', (error as Error).message);
  }
}

function runDoctor(): void {
  console.log('🏥 Speakeasy Configuration Health Check');
  console.log('');
  
  let issues = 0;
  let warnings = 0;
  
  // 1. System Compatibility Check
  console.log('🔍 System Compatibility:');
  if (process.platform === 'darwin') {
    console.log('   ✅ macOS detected - system voice support available');
    
    // Check for required commands
    try {
      require('child_process').execSync('which say', { stdio: 'pipe' });
      console.log('   ✅ `say` command available');
    } catch {
      console.log('   ❌ `say` command not found');
      issues++;
    }
    
    try {
      require('child_process').execSync('which afplay', { stdio: 'pipe' });
      console.log('   ✅ `afplay` command available');
    } catch {
      console.log('   ❌ `afplay` command not found');
      issues++;
    }
  } else {
    console.log('   ⚠️  Non-macOS system - system voice limited');
    warnings++;
  }
  
  console.log('');
  
  // 2. Configuration Health Check
  console.log('🔧 Configuration Health:');
  const globalConfig = loadGlobalConfig();
  
  // Config file existence
  if (fs.existsSync(CONFIG_FILE)) {
    console.log('   ✅ Config file exists');
    
    // Check JSON validity
    try {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      JSON.parse(configData);
      console.log('   ✅ Config file is valid JSON');
    } catch (error) {
      console.log(`   ❌ Config file has JSON errors: ${(error as Error).message}`);
      issues++;
    }
  } else {
    console.log('   ❌ No config file found');
    console.log('   💡 Create: ~/.config/speakeasy/settings.json');
    issues++;
  }
  
  // Check directory permissions
  try {
    fs.accessSync(CONFIG_DIR, fs.constants.R_OK | fs.constants.W_OK);
    console.log('   ✅ Config directory permissions OK');
  } catch {
    console.log('   ❌ Cannot read/write config directory');
    issues++;
  }
  
  console.log('');
  
  // 3. API Key Configuration
  console.log('🔑 API Key Configuration:');
  const providers = [
    { name: 'OpenAI', key: 'openai', env: 'OPENAI_API_KEY' },
    { name: 'ElevenLabs', key: 'elevenlabs', env: 'ELEVENLABS_API_KEY' },
    { name: 'Groq', key: 'groq', env: 'GROQ_API_KEY' }
  ];
  
  let configuredProviders = 0;
  providers.forEach(({ name, key, env }) => {
    const fromConfig = globalConfig.providers?.[key as keyof typeof globalConfig.providers]?.apiKey;
    const fromEnv = process.env[env];
    
    if (fromConfig && fromConfig.length > 10) {
      console.log(`   ✅ ${name}: Configured in file`);
      configuredProviders++;
    } else if (fromEnv && fromEnv.length > 10) {
      console.log(`   ✅ ${name}: Configured via environment`);
      configuredProviders++;
    } else {
      console.log(`   ❌ ${name}: Not configured`);
      console.log(`   💡 Set: export ${env}=your_key_here`);
    }
  });
  
  if (configuredProviders === 0 && process.platform !== 'darwin') {
    console.log('   ⚠️  No API providers configured - limited to system voice');
    warnings++;
  }
  
  console.log('');
  
  // 4. Voice Configuration
  console.log('🎙️  Voice Configuration:');
  const voices = [
    { provider: 'system', voice: globalConfig.providers?.system?.voice, default: 'Samantha' },
    { provider: 'openai', voice: globalConfig.providers?.openai?.voice, default: 'nova' },
    { provider: 'elevenlabs', voice: globalConfig.providers?.elevenlabs?.voiceId, default: 'EXAVITQu4vr4xnSDxMaL' },
    { provider: 'groq', voice: globalConfig.providers?.groq?.voice, default: 'nova' }
  ];
  
  voices.forEach(({ provider, voice, default: defaultVoice }) => {
    const current = voice || defaultVoice;
    console.log(`   ${provider}: ${current}`);
  });
  
  console.log('');
  
  // 5. Cache Configuration
  console.log('📦 Cache Configuration:');
  const cacheEnabled = globalConfig.cache?.enabled;
  const cacheDir = globalConfig.cache?.dir || path.join('/tmp', 'speakeasy-cache');
  
  if (cacheEnabled) {
    console.log('   ✅ Cache enabled');
    console.log(`   📁 Cache dir: ${cacheDir}`);
    
    // Check cache directory
    try {
      if (fs.existsSync(cacheDir)) {
        fs.accessSync(cacheDir, fs.constants.R_OK | fs.constants.W_OK);
        console.log('   ✅ Cache directory accessible');
      } else {
        console.log('   ⚠️  Cache directory will be created on first use');
      }
    } catch {
      console.log('   ❌ Cannot access cache directory');
      issues++;
    }
  } else {
    console.log('   ℹ️  Cache disabled (will be enabled with API keys)');
  }
  
  console.log('');
  
  // 6. Summary and Recommendations
  console.log('📋 Health Summary:');
  if (issues === 0 && warnings === 0) {
    console.log('   🎉 All checks passed! Speakeasy is healthy.');
  } else {
    console.log(`   ${issues > 0 ? '❌' : '⚠️'} ${issues} issues, ${warnings} warnings found`);
    
    if (issues > 0) {
      console.log('');
      console.log('🔧 Quick Fixes:');
      
      if (process.platform !== 'darwin') {
        console.log('   • On non-macOS, ensure API keys are configured');
      }
      
      if (!fs.existsSync(CONFIG_FILE)) {
        console.log('   • Create config: mkdir -p ~/.config/speakeasy');
        console.log('   • Add: echo \'{"providers":{"system":{"voice":"Samantha"}}}\' > ~/.config/speakeasy/settings.json');
      }
      
      if (configuredProviders === 0 && process.platform !== 'darwin') {
        console.log('   • Configure at least one API provider');
      }
    }
  }
  
  console.log('');
  console.log('💡 Next Steps:');
  console.log('   • Run: speakeasy "Hello world" to test');
  console.log('   • Run: speakeasy --config to view raw config');
  console.log('   • Run: speakeasy --diagnose for detailed diagnostics');
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
      
      case '--debug':
      case '-d':
        options.debug = true;
        break;
      
      case '--diagnose':
        options.diagnose = true;
        break;
      
      case '--doctor':
        options.doctor = true;
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

  if (options.diagnose) {
    diagnoseConfig();
    return;
  }

  if (options.doctor) {
    runDoctor();
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
      debug: options.debug || false,
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

    // Skip pre-validation - let the main class handle it properly with config file loading

    const speaker = new SpeakEasy(config);
    await speaker.speak(text, { interrupt: options.interrupt });
    
    if (options.cache) {
      console.log('🔍 Cache stats:', await speaker.getCacheStats());
    }
    
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    // Provide better error guidance based on the provider used
    if (options.provider === 'elevenlabs' && errorMessage.includes('API key')) {
      console.error('❌ ElevenLabs Error:', errorMessage);
      console.error('💡 To use ElevenLabs, set: export ELEVENLABS_API_KEY=your_key_here');
    } else if (options.provider === 'openai' && errorMessage.includes('API key')) {
      console.error('❌ OpenAI Error:', errorMessage);
      console.error('💡 To use OpenAI, set: export OPENAI_API_KEY=your_key_here');
    } else if (options.provider === 'groq' && errorMessage.includes('API key')) {
      console.error('❌ Groq Error:', errorMessage);
      console.error('💡 To use Groq, set: export GROQ_API_KEY=your_key_here');
    } else {
      console.error('❌ Error:', errorMessage);
    }
    
    // Always suggest the system provider as fallback
    if (options.provider !== 'system') {
      console.error('🗣️  Fallback: Use --provider system for macOS built-in voices (no API key needed)');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  run().catch(console.error);
}