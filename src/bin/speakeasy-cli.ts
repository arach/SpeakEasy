#!/usr/bin/env node

import { SpeakEasy, SpeakEasyConfig } from '../index';
import { showHelp as showHelpUI, showWelcome } from '../cli/ui';
import { hasConfig as hasConfigFile, showConfig as showConfigCmd, diagnoseConfig as diagnoseConfigCmd, setApiKey as setApiKeyCmd, setDefaultProvider as setDefaultProviderCmd } from '../cli/config';
import { runDoctor as runDoctorCmd } from '../cli/doctor';
import { clearCache as clearCacheCmd, playCachedAudio as playCachedAudioCmd, listCacheEntries as listCacheEntriesCmd } from '../cli/cache';
import { Command } from 'commander';
import { getPackageVersion } from '../cli/constants';
import { parseAndValidate } from '../cli/args';

interface CLIOptions {
  text?: string;
  provider?: string;
  voice?: string;
  rate?: number;
  volume?: number;
  instructions?: string;
  interrupt?: boolean;
  cache?: boolean;
  clearCache?: boolean;
  config?: boolean;
  edit?: boolean;
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
  out?: string;
  welcome?: boolean;
  silent?: boolean;
  setKey?: string;
  setDefault?: string;
}

async function run(): Promise<void> {
  if (process.argv.length <= 2) {
    showHelpUI();
    return;
  }

  const program = new Command();
  program
    .name('speakeasy')
    .helpOption('-H, --builtin-help', 'show built-in help')
    .version(getPackageVersion(), '-V, --version', 'output the version number')
    .argument('[text]')
    .option('-t, --text <text>')
    .option('-p, --provider <provider>')
    .option('-v, --voice <voice>')
    .option('-r, --rate <rate>')
    .option('--volume <volume>')
    .option('--instructions <instructions>', 'OpenAI: voice steering instructions (accent, tone, style)')
    .option('-i, --interrupt')
    .option('-c, --cache')
    .option('--clear-cache')
    .option('--config')
    .option('--edit')
    .option('-h, --help')
    .option('-d, --debug')
    .option('--diagnose')
    .option('--doctor')
    .option('--welcome')
    .option('--list')
    .option('--find <text>')
    .option('--stats')
    .option('--recent <n>')
    .option('--id <key>')
    .option('--play <key>')
    .option('--out <file>')
    .option('-s, --silent')
    .option('--set-key <provider>')
    .option('--set-default <provider>');

  program.parse(process.argv);
  const parsed = program.opts();
  let text = parsed.text || program.args[0] || '';

  const options = parseAndValidate({ ...parsed, text });

  if (options.help) {
    showHelpUI();
    return;
  }

  // Show welcome screen if no config exists or --welcome flag is used
  if (((!hasConfigFile() && !options.config && !options.help && !options.diagnose && !options.doctor) || options.welcome) && !options.help) {
    showWelcome();
    return;
  }

  if (options.config) {
    showConfigCmd(options.edit);
    return;
  }

  if (options.clearCache) {
    await clearCacheCmd();
    return;
  }

  if (options.diagnose) {
    diagnoseConfigCmd();
    return;
  }

  if (options.doctor) {
    runDoctorCmd();
    return;
  }

  if (options.setKey) {
    if (!text) {
      console.error('❌ API key required');
      console.error('');
      console.error('Usage: speakeasy --set-key <provider> <api-key>');
      console.error('');
      console.error('Example:');
      console.error('   speakeasy --set-key elevenlabs sk-xxxxxxxxxxxx');
      process.exit(1);
    }
    setApiKeyCmd(options.setKey, text);
    return;
  }

  if (options.setDefault) {
    setDefaultProviderCmd(options.setDefault);
    return;
  }

  if (options.play) {
    await playCachedAudioCmd(options.play);
    return;
  }

  if (options.list || options.find !== undefined || options.stats || options.recent !== undefined || options.id) {
    await listCacheEntriesCmd({
      find: options.find,
      stats: options.stats,
      recent: options.recent,
      id: options.id,
    });
    return;
  }

  // Skip text requirement for cache/non-speech commands
  const isCacheCommand =
    options.list || options.find !== undefined || options.stats || options.recent !== undefined || options.id || options.play || options.clearCache;
  const isConfigCommand = options.config || options.diagnose || options.doctor;

  if (!text && !isCacheCommand && !isConfigCommand) {
    console.error('❌ No text provided to speak');
    process.exit(1);
  }

  try {
    const config: SpeakEasyConfig = {
      provider: (options.provider as any) || 'system',
      rate: options.rate || 180,
      volume: options.volume !== undefined ? options.volume : undefined,
      instructions: options.instructions,
      debug: options.debug || false,
      ...((options.cache || options.out) && { cache: { enabled: true } }),
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
        case 'gemini':
          config.geminiModel = options.voice;
          break;
      }
    }

    // Skip pre-validation - let the main class handle it properly with config file loading

    const speaker = new SpeakEasy(config);
    await speaker.speak(text, { interrupt: options.interrupt, silent: options.silent });

    // Save to file if --out flag is provided
    if (options.out) {
      try {
        const cacheStats = await speaker.getCacheStats();
        if (cacheStats.dir) {
          const { TTSCache } = await import('../cache');
          const cache = new TTSCache(cacheStats.dir, '7d');
          const recentEntries = await cache.getRecent(1);

          if (recentEntries.length > 0) {
            const latestEntry = recentEntries[0];
            const fs = await import('fs');

            if (fs.existsSync(latestEntry.filePath)) {
              fs.copyFileSync(latestEntry.filePath, options.out);
              const stats = fs.statSync(options.out);
              console.log(`💾 Audio saved to: ${options.out} (${(stats.size / 1024).toFixed(1)} KB)`);
            } else {
              console.error(`❌ Audio file not found: ${latestEntry.filePath}`);
            }
          } else {
            console.error('❌ No recent audio files found in cache');
          }
        } else {
          console.error('❌ Cache not enabled - cannot save file');
        }
      } catch (error) {
        console.error('❌ Error saving file:', (error as Error).message);
      }
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
      } else if (options.provider === 'gemini' || errorMsg.includes('gemini')) {
        console.error('   Gemini:');
        console.error('   1. Get API key: https://makersuite.google.com/app/apikey');
        console.error('   2. Set: export GEMINI_API_KEY=your_key_here');
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


