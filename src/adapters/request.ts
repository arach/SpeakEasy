import { ProviderConfig } from '../types';
import { TTSRequest } from './types';

export function toTTSRequest(config: ProviderConfig, defaultVoice: string): TTSRequest {
  return {
    text: config.text,
    voice: config.voice ?? defaultVoice,
    rate: config.rate,
    volume: config.volume ?? 0.7,
    tempDir: config.tempDir,
    apiKey: config.apiKey,
    instructions: config.instructions,
  };
}