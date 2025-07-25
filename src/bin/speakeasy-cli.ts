#!/usr/bin/env node

import { SpeakEasy, SpeakEasyConfig } from '../index';
import * as path from 'path';
import * as fs from 'fs';
import { TTSCache, CacheMetadata } from '../cache';

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
  list?: boolean;
  find?: string;
  stats?: boolean;
  recent?: number;
  id?: string;
  play?: string;
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
  --list              List all cache entries
  --find "text"       Find cache entries by text
  --stats             Show cache statistics
  --recent N          Show N most recent cache entries
  --id KEY            Show detailed info for specific cache entry
  --play KEY          Play cached audio by ID

Examples:
  speakeasy "Hello world"
  speakeasy --text "Hello world" --provider openai --voice nova
  speakeasy --text "Hello world" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL
  speakeasy --cache --text "Hello cached world"
  speakeasy --clear-cache
  speakeasy --list                    # List all cache entries
  speakeasy --stats                   # Show cache statistics
  speakeasy --recent 20               # Show 20 most recent
  speakeasy --find "hello world"      # Find entries containing text
  speakeasy --id abc123-def456        # Show detailed entry info
  speakeasy --play abc123-def456      # Play cached audio by ID
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

async function playCachedAudio(cacheKey: string): Promise<void> {
  try {
    const speaker = new SpeakEasy({});
    const cacheStats = await speaker.getCacheStats();
    
    if (!cacheStats.dir) {
      console.log('❌ Cache not enabled or directory not found');
      return;
    }

    const cache = new TTSCache(cacheStats.dir, '7d');
    const allMetadata = await cache.getCacheMetadata();
    const entry = allMetadata.find(m => m.cacheKey === cacheKey);
    
    if (!entry) {
      console.log(`❌ Cache entry not found: ${cacheKey}`);
      return;
    }

    if (!fs.existsSync(entry.filePath)) {
      console.log(`❌ Audio file not found: ${entry.filePath}`);
      return;
    }

    console.log(`🎵 Playing cached audio: "${entry.originalText.substring(0, 50)}${entry.originalText.length > 50 ? '...' : ''}"`);
    console.log(`   Provider: ${entry.provider}, Voice: ${entry.voice}`);
    
    const { execSync } = require('child_process');
    execSync(`afplay "${entry.filePath}"`, { stdio: 'inherit' });
    
  } catch (error) {
    console.error('❌ Error playing cached audio:', (error as Error).message);
  }
}

async function listCacheEntries(options: {
  find?: string;
  stats?: boolean;
  recent?: number;
  id?: string;
} = {}): Promise<void> {
  try {
    const speaker = new SpeakEasy({});
    const cacheStats = await speaker.getCacheStats();
    
    if (!cacheStats.dir) {
      console.log('❌ Cache not enabled or directory not found');
      return;
    }

    const cache = new TTSCache(cacheStats.dir, '7d');

    if (options.id) {
      // Show detailed info for specific entry
      const allMetadata = await cache.getCacheMetadata();
      const entry = allMetadata.find(m => m.cacheKey === options.id);
      
      if (entry) {
        console.log('🔍 Cache Entry Details');
        console.log('═════════════════════');
        console.log(`ID: ${entry.cacheKey}`);
        console.log(`Text: "${entry.originalText}"`);
        console.log(`Provider: ${entry.provider}`);
        console.log(`Model: ${entry.model || 'unknown'}`);
        console.log(`Voice: ${entry.voice}`);
        console.log(`Rate: ${entry.rate} WPM`);
        console.log(`Size: ${(entry.fileSize / 1024).toFixed(1)} KB`);
        console.log(`Created: ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`File: ${entry.filePath}`);
        console.log(`Source: ${entry.source || 'unknown'}`);
        console.log(`Session: ${entry.sessionId || 'unknown'}`);
        console.log(`Directory: ${entry.workingDirectory || 'unknown'}`);
        console.log(`User: ${entry.user || 'unknown'}`);
        console.log(`Duration: ${entry.durationMs ? `${entry.durationMs}ms` : 'unknown'}`);
        console.log(`Success: ${entry.success ? '✅' : '❌'}`);
        if (entry.errorMessage) {
          console.log(`Error: ${entry.errorMessage}`);
        }
      } else {
        console.log(`❌ Cache entry not found: ${options.id}`);
      }
      return;
    }

    if (options.stats) {
      // Show cache statistics
      const stats = await cache.getStats();
      console.log('📊 Cache Statistics');
      console.log('══════════════════');
      console.log(`Total Entries: ${stats.totalEntries}`);
      console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Cache Hits: ${stats.cacheHits}`);
      console.log(`Cache Misses: ${stats.cacheMisses}`);
      console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`Avg File Size: ${(stats.avgFileSize / 1024).toFixed(1)} KB`);
      
      if (stats.dateRange) {
        console.log(`Date Range: ${stats.dateRange.earliest.toLocaleDateString()} - ${stats.dateRange.latest.toLocaleDateString()}`);
      }
      
      console.log('\n📈 By Provider:');
      Object.entries(stats.providers).forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });
      
      console.log('\n📈 By Model:');
      Object.entries(stats.models).forEach(([model, count]) => {
        console.log(`  ${model}: ${count}`);
      });
      
      console.log('\n📈 By Source:');
      Object.entries(stats.sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
      return;
    }

    let entries: CacheMetadata[];
    
    if (options.recent) {
      entries = await cache.getRecent(options.recent);
    } else if (options.find) {
      entries = await cache.findByText(options.find);
    } else {
      entries = await cache.getCacheMetadata();
    }

    if (entries.length === 0) {
      console.log('📭 No cache entries found');
      return;
    }

    console.log(`📋 Cache Entries (${entries.length})`);
    console.log('═══════════════════════');
    
    entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.cacheKey}`);
      console.log(`   Text: "${entry.originalText.substring(0, 50)}${entry.originalText.length > 50 ? '...' : ''}"`);
      console.log(`   Provider: ${entry.provider}`);
      console.log(`   Voice: ${entry.voice}`);
      console.log(`   Size: ${(entry.fileSize / 1024).toFixed(1)} KB`);
      console.log(`   Created: ${new Date(entry.timestamp).toLocaleString()}`);
      console.log(`   File: ${path.basename(entry.filePath)}`);
      if (entry.model) console.log(`   Model: ${entry.model}`);
    });
    
    console.log(`\n💡 Use --id KEY to see full details, --play KEY to play audio`);
  } catch (error) {
    console.error('❌ Error accessing cache:', (error as Error).message);
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
      
      case '--list':
        options.list = true;
        break;
      
      case '--find':
        options.find = args[++i];
        break;
      
      case '--stats':
        options.stats = true;
        break;
      
      case '--recent':
        options.recent = parseInt(args[++i]) || 10;
        break;
      
      case '--id':
        options.id = args[++i];
        break;
      
      case '--play':
        options.play = args[++i];
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

  if (options.play) {
    await playCachedAudio(options.play);
    return;
  }

  if (options.list || options.find !== undefined || options.stats || options.recent !== undefined || options.id) {
    await listCacheEntries({
      find: options.find,
      stats: options.stats,
      recent: options.recent,
      id: options.id
    });
    return;
  }

  // Skip text requirement for cache/non-speech commands
  const isCacheCommand = options.list || options.find !== undefined || options.stats || options.recent !== undefined || options.id || options.play || options.clearCache;
  const isConfigCommand = options.config || options.diagnose || options.doctor;
  
  if (!text && !isCacheCommand && !isConfigCommand) {
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
    const errorMsg = errorMessage.toLowerCase();
    
    console.error('❌ Error:', errorMessage);
    console.error('');
    
    if (errorMsg.includes('api key') || errorMsg.includes('invalid') || errorMsg.includes('required')) {
      console.error('🔑 Setup Guide:');
      console.error('');
      
      if (options.provider === 'elevenlabs' || errorMsg.includes('elevenlabs')) {
        console.error('   ElevenLabs:');
        console.error('   1. Get API key: https://elevenlabs.io/app/settings/api-keys');
        console.error('   2. Set: export ELEVENLABS_API_KEY=your_key_here');
      } else if (options.provider === 'openai' || errorMsg.includes('openai')) {
        console.error('   OpenAI:');
        console.error('   1. Get API key: https://platform.openai.com/api-keys');
        console.error('   2. Set: export OPENAI_API_KEY=your_key_here');
      } else if (options.provider === 'groq' || errorMsg.includes('groq')) {
        console.error('   Groq:');
        console.error('   1. Get API key: https://console.groq.com/keys');
        console.error('   2. Set: export GROQ_API_KEY=your_key_here');
      }
      
      console.error('');
      console.error('   🗣️  Quick fix: Use macOS built-in voices (no API key needed)');
      console.error('   speakeasy "hello world" --provider system');
      console.error('');
      console.error('   🔧 Run: speakeasy --doctor for full setup help');
    } else if (errorMsg.includes('rate limit')) {
      console.error('⏰ Rate Limit Exceeded');
      console.error('');
      console.error('💡 Solutions:');
      console.error('   • Wait 60 seconds and retry');
      console.error('   • Use system voice: speakeasy "text" --provider system');
      console.error('   • Check your provider dashboard for limits');
    } else {
      console.error('💡 Try: speakeasy --doctor for troubleshooting help');
    }
    
    // Always suggest the system provider as fallback
    if (options.provider !== 'system') {
      console.error('');
      console.error('🗣️  Quick fix: Use macOS built-in voices (no API key needed)');
      console.error('   speakeasy "text" --provider system');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  run().catch(console.error);
}