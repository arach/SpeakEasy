import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_VOICES, DEFAULTS, PROVIDERS } from './constants';
import { loadGlobalConfig } from './config';

export function runDoctor(): void {
  console.log('🏥 Speakeasy Configuration Health Check');
  console.log('');

  let issues = 0;
  let warnings = 0;

  console.log('🔍 System Compatibility:');
  if (process.platform === 'darwin') {
    console.log('   ✅ macOS detected - system voice support available');

    try {
      execSync('which say', { stdio: 'pipe' });
      console.log('   ✅ `say` command available');
    } catch {
      console.log('   ❌ `say` command not found');
      issues++;
    }

    try {
      execSync('which afplay', { stdio: 'pipe' });
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

  console.log('🔧 Configuration Health:');
  const globalConfig = loadGlobalConfig();

  if (fs.existsSync(CONFIG_FILE)) {
    console.log('   ✅ Config file exists');

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

  try {
    fs.accessSync(CONFIG_DIR, fs.constants.R_OK | fs.constants.W_OK);
    console.log('   ✅ Config directory permissions OK');
  } catch {
    console.log('   ❌ Cannot read/write config directory');
    issues++;
  }

  console.log('');

  console.log('🔑 API Key Configuration:');
  const providers = PROVIDERS;

  let configuredProviders = 0;
  providers.forEach(({ name, key, env }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromConfig = (globalConfig as any).providers?.[key]?.apiKey;
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

  console.log('🎙️  Voice Configuration:');
  const voices = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provider: 'system', voice: (globalConfig as any).providers?.system?.voice, default: DEFAULT_VOICES.system },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provider: 'openai', voice: (globalConfig as any).providers?.openai?.voice, default: DEFAULT_VOICES.openai },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provider: 'elevenlabs', voice: (globalConfig as any).providers?.elevenlabs?.voiceId, default: DEFAULT_VOICES.elevenlabs },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provider: 'groq', voice: (globalConfig as any).providers?.groq?.voice, default: DEFAULT_VOICES.groq },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provider: 'gemini', voice: (globalConfig as any).providers?.gemini?.model, default: DEFAULT_VOICES.gemini },
  ];

  voices.forEach(({ provider, voice, default: defaultVoice }) => {
    const current = voice || defaultVoice;
    console.log(`   ${provider}: ${current}`);
  });

  console.log('');

  console.log('📦 Cache Configuration:');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cacheEnabled = (globalConfig as any).cache?.enabled;
  const cacheDir = (globalConfig as any).cache?.dir || path.join('/tmp', 'speakeasy-cache');

  if (cacheEnabled) {
    console.log('   ✅ Cache enabled');
    console.log(`   📁 Cache dir: ${cacheDir}`);

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
        console.log("   • Add: echo '{\"providers\":{\"system\":{\"voice\":\"Samantha\"}}}' > ~/.config/speakeasy/settings.json");
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


