import { SpeakEasyConfig } from '../types';
import { getBestVoice } from '../providers/system';
import { SystemProvider } from '../providers/system';
import { OpenAIProvider } from '../providers/openai';
import { ElevenLabsProvider } from '../providers/elevenlabs';
import { GroqProvider } from '../providers/groq';
import { GeminiProvider } from '../providers/gemini';
import { TTSAdapter, TTSProviderId } from './types';

export const PROVIDER_ORDER: TTSProviderId[] = [
  'system',
  'openai',
  'elevenlabs',
  'groq',
  'gemini',
];

export function createAdapterRegistry(config: SpeakEasyConfig): Map<TTSProviderId, TTSAdapter> {
  const registry = new Map<TTSProviderId, TTSAdapter>();

  registry.set('system', new SystemProvider(config.systemVoice || getBestVoice()));
  registry.set(
    'openai',
    new OpenAIProvider(
      config.apiKeys?.openai || '',
      config.openaiVoice || 'nova',
      config.instructions
    )
  );
  registry.set(
    'elevenlabs',
    new ElevenLabsProvider(
      config.apiKeys?.elevenlabs || '',
      config.elevenlabsVoiceId || 'EXAVITQu4vr4xnSDxMaL'
    )
  );
  registry.set(
    'groq',
    new GroqProvider(config.apiKeys?.groq || '', config.groqVoice || 'tara')
  );
  registry.set(
    'gemini',
    new GeminiProvider(
      config.apiKeys?.gemini || '',
      config.geminiModel || 'gemini-2.5-flash-preview-tts'
    )
  );

  return registry;
}