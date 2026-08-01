import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Provider, ProviderConfig } from '../types';
import { TTSAdapter, TTSRequest, TTSResult } from '../adapters/types';
import { toTTSRequest } from '../adapters/request';
import { playTTSResult } from '../adapters/audio';

const PREFERRED_VOICES = [
  'Ava (Premium)',
  'Evan (Enhanced)',
  'Zoe (Premium)',
  'Samantha (Enhanced)',
  'Samantha',
];

let cachedVoices: string[] | null = null;

export function getAvailableVoices(): string[] {
  if (cachedVoices) return cachedVoices;

  try {
    const output = execSync('say -v "?"', { encoding: 'utf-8' });
    cachedVoices = output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/^(.+?)\s+[a-z]{2}[_-][A-Z]{2}/i);
        return match ? match[1].trim() : line.split(/\s+/)[0];
      });
    return cachedVoices;
  } catch {
    return ['Samantha'];
  }
}

export function getBestVoice(language: string = 'en_US'): string {
  const available = getAvailableVoices();

  for (const voice of PREFERRED_VOICES) {
    if (available.includes(voice)) {
      return voice;
    }
  }

  const englishPremium = available.find(v =>
    v.includes('(Premium)') && (v.includes('en_') || !v.includes('_'))
  );
  if (englishPremium) return englishPremium;

  const englishEnhanced = available.find(v =>
    v.includes('(Enhanced)') && (v.includes('en_') || !v.includes('_'))
  );
  if (englishEnhanced) return englishEnhanced;

  return 'Samantha';
}

export class SystemProvider implements TTSAdapter, Provider {
  readonly id = 'system' as const;
  readonly capabilities = {
    cacheable: true,
    instructions: false,
    silent: true,
  };

  private voice: string;

  constructor(voice?: string) {
    this.voice = voice || getBestVoice();
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const voice = request.voice || this.voice;
    const tempFile = path.join(request.tempDir, `system_speech_${Date.now()}.aiff`);

    try {
      await runSay(['-v', voice, '-r', String(request.rate), '-o', tempFile, request.text]);
      const audio = fs.readFileSync(tempFile);
      return { audio, format: 'aiff', model: 'macOS-system' };
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  validate(): boolean {
    return true;
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return `System voice failed: ${message}. Ensure 'say' command is available.`;
  }

  validateConfig(): boolean {
    return this.validate();
  }

  getErrorMessage(error: unknown): string {
    return this.formatError(error);
  }

  async generateAudio(config: ProviderConfig): Promise<Buffer | null> {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    return result.audio;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const result = await this.synthesize(toTTSRequest(config, this.voice));
    await playTTSResult(result, config.volume ?? 0.7, config.tempDir);
  }
}

function runSay(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('say', args);
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`say exited with code ${code}`));
      }
    });
  });
}