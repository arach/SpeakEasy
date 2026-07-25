import * as fs from 'fs';
import { spawn } from 'child_process';
import { CONFIG_DIR, CONFIG_FILE, DEFAULTS, PROVIDERS, ProviderKey } from './constants';

function writeConfig(config: Record<string, unknown>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(CONFIG_DIR, 0o700);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  fs.chmodSync(CONFIG_FILE, 0o600);
}

function redactConfigSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactConfigSecrets);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /(api.?key|token|secret|password)/i.test(key) && entry ? '[configured]' : redactConfigSecrets(entry),
    ])
  );
}

export function loadGlobalConfig() {
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

export function hasConfig(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function showConfig(edit: boolean = false): void {
  try {
    console.log('📊 Configuration Location:');
    console.log(`   File: ${CONFIG_FILE}`);
    console.log('');

    if (edit) {
      if (!fs.existsSync(CONFIG_FILE)) {
        console.log('📝 Creating new configuration file...');

        if (!fs.existsSync(CONFIG_DIR)) {
          fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        const defaultConfig = {
          providers: {
            system: {
              enabled: true,
              voice: 'Samantha',
            },
          },
          defaults: {
            provider: DEFAULTS.provider,
            rate: DEFAULTS.rate,
          },
          global: {
            tempDir: '/tmp',
            cleanup: true,
          },
        };

        writeConfig(defaultConfig);
        console.log('✅ Created default configuration file');
      }

      const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
      console.log(`🔧 Opening config file with ${editor}...`);

      const child = spawn(editor, [CONFIG_FILE], {
        stdio: 'inherit',
        detached: false,
      });

      child.on('exit', (code: number) => {
        if (code === 0) {
          console.log('✅ Configuration file updated');
        } else {
          console.error(`❌ Editor exited with code ${code}`);
        }
      });

      return;
    }

    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      console.log('📋 Current Configuration:');
      console.log(JSON.stringify(redactConfigSecrets(config), null, 2));
    } else {
      console.log('📊 No configuration file found');
      console.log('');
      console.log('💡 To create a config file:');
      console.log(`   mkdir -p ${CONFIG_DIR}`);
      console.log(`   echo '{"providers":{"system":{"voice":"Samantha"}}}' > ${CONFIG_FILE}`);
      console.log('');
      console.log('🔧 Or use: speakeasy --config --edit');
    }
  } catch (error) {
    console.error('❌ Error reading config:', (error as Error).message);
  }
}

export function diagnoseConfig(): void {
  try {
    const globalConfig = loadGlobalConfig();
    console.log('🔍 Configuration Diagnostics');
    console.log('');

    if (fs.existsSync(CONFIG_FILE)) {
      console.log('✅ Config file found:', CONFIG_FILE);
    } else {
      console.log('❌ No config file found at:', CONFIG_FILE);
    }

    console.log('');
    console.log('📊 Settings Summary:');
    console.log(`   Default Provider: ${globalConfig.defaults?.provider || DEFAULTS.provider}`);
    console.log(`   Default Rate: ${globalConfig.defaults?.rate || DEFAULTS.rate} WPM`);
    console.log(`   Default Volume: ${((globalConfig.defaults?.volume || DEFAULTS.volume) * 100).toFixed(0)}%`);
    console.log(`   Fallback Order: ${(globalConfig.defaults?.fallbackOrder || ['system']).join(' → ')}`);
    console.log(`   Temp Dir: ${globalConfig.global?.tempDir || '/tmp'}`);
    console.log(`   Auto-cleanup: ${globalConfig.global?.cleanup !== false}`);

    console.log('');
    console.log('🔑 API Key Status:');

    const providers = [
      { name: 'OpenAI', configKey: 'openai', envKey: 'OPENAI_API_KEY' },
      { name: 'ElevenLabs', configKey: 'elevenlabs', envKey: 'ELEVENLABS_API_KEY' },
      { name: 'Groq', configKey: 'groq', envKey: 'GROQ_API_KEY' },
      { name: 'Gemini', configKey: 'gemini', envKey: 'GEMINI_API_KEY' },
    ];

    providers.forEach(({ name, configKey, envKey }) => {
      const fromConfig = globalConfig.providers?.[configKey as keyof typeof globalConfig.providers]?.apiKey;
      const fromEnv = process.env[envKey];

      if (fromConfig && fromConfig.length > 10) {
        console.log(`   ✅ ${name}: Available from config file`);
      } else if (fromEnv && fromEnv.length > 10) {
        console.log(`   ✅ ${name}: Available from environment`);
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
    console.log(`   Gemini: ${globalConfig.providers?.gemini?.model || 'gemini-2.5-flash-preview-tts'}`);

    console.log('');
    console.log('💡 Usage Tips:');
    console.log('   • Use --debug to see runtime details');
    console.log('   • Use --provider system for built-in voices (no API keys needed)');
    console.log('   • Edit ~/.config/speakeasy/settings.json to configure defaults');
  } catch (error) {
    console.error('❌ Error reading config:', (error as Error).message);
  }
}

export function setApiKey(provider: string, apiKey: string): void {
  const validProviders = PROVIDERS.map(p => p.key);

  if (!validProviders.includes(provider as Exclude<ProviderKey, 'system'>)) {
    console.error(`❌ Invalid provider: ${provider}`);
    console.error('');
    console.error('Valid providers:');
    PROVIDERS.forEach(p => {
      console.error(`   • ${p.key} (${p.name})`);
    });
    process.exit(1);
  }

  if (!apiKey || apiKey.trim().length === 0) {
    console.error('❌ API key cannot be empty');
    process.exit(1);
  }

  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Load existing config or create new one
    let config: Record<string, any> = {};
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(configData);
    }

    // Initialize providers section if needed
    if (!config.providers) {
      config.providers = {};
    }

    // Initialize specific provider if needed
    if (!config.providers[provider]) {
      config.providers[provider] = {};
    }

    // Set the API key
    config.providers[provider].apiKey = apiKey.trim();
    config.providers[provider].enabled = true;

    // Write config
    writeConfig(config);

    const providerInfo = PROVIDERS.find(p => p.key === provider);
    console.log(`✅ ${providerInfo?.name || provider} API key saved to config`);
    console.log('');
    console.log('🎉 You can now use:');
    console.log(`   speakeasy "Hello world" --provider ${provider}`);
    console.log('');
    console.log(`💡 To set as default provider:`);
    console.log(`   speakeasy --set-default ${provider}`);
  } catch (error) {
    console.error('❌ Error saving API key:', (error as Error).message);
    process.exit(1);
  }
}

export function setDefaultProvider(provider: string): void {
  const validProviders = ['system', ...PROVIDERS.map(p => p.key)];

  if (!validProviders.includes(provider)) {
    console.error(`❌ Invalid provider: ${provider}`);
    console.error('');
    console.error('Valid providers:');
    console.error('   • system (macOS built-in)');
    PROVIDERS.forEach(p => {
      console.error(`   • ${p.key} (${p.name})`);
    });
    process.exit(1);
  }

  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Load existing config or create new one
    let config: Record<string, any> = {};
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(configData);
    }

    // Initialize defaults section if needed
    if (!config.defaults) {
      config.defaults = {};
    }

    // Set the default provider
    config.defaults.provider = provider;

    // Write config
    writeConfig(config);

    console.log(`✅ Default provider set to: ${provider}`);
    console.log('');
    console.log('🎉 Now you can simply run:');
    console.log(`   speakeasy "Hello world"`);
  } catch (error) {
    console.error('❌ Error saving default provider:', (error as Error).message);
    process.exit(1);
  }
}
