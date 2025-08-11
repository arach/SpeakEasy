import * as path from 'path';
import { homedir } from 'os';

export const CONFIG_DIR = path.join(homedir(), '.config', 'speakeasy');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

export type ProviderKey = 'openai' | 'elevenlabs' | 'groq' | 'gemini' | 'system';

export const PROVIDERS: Array<{
  name: string;
  key: Exclude<ProviderKey, 'system'>;
  env: string;
}> = [
  { name: 'OpenAI', key: 'openai', env: 'OPENAI_API_KEY' },
  { name: 'ElevenLabs', key: 'elevenlabs', env: 'ELEVENLABS_API_KEY' },
  { name: 'Groq', key: 'groq', env: 'GROQ_API_KEY' },
  { name: 'Gemini', key: 'gemini', env: 'GEMINI_API_KEY' },
];

export const DEFAULT_VOICES: Record<ProviderKey, string> = {
  system: 'Samantha',
  openai: 'nova',
  elevenlabs: 'EXAVITQu4vr4xnSDxMaL',
  groq: 'nova',
  gemini: 'gemini-2.5-flash-preview-tts',
};

export const DEFAULTS = {
  rate: 180,
  volume: 0.7,
  provider: 'system' as ProviderKey,
};

export const getPackageVersion = (): string => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};


