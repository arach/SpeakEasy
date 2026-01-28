import { execSync } from 'child_process';
import { Provider, ProviderConfig } from '../types';

// Preferred voices in order of quality (Premium > Enhanced > Standard)
const PREFERRED_VOICES = [
  'Ava (Premium)',      // Best quality US English
  'Evan (Enhanced)',    // High quality US English
  'Zoe (Premium)',      // Premium US English
  'Samantha (Enhanced)', // Enhanced Samantha
  'Samantha',           // Standard fallback
];

// Cache for available voices
let cachedVoices: string[] | null = null;

/**
 * Get all available system voices on macOS
 */
export function getAvailableVoices(): string[] {
  if (cachedVoices) return cachedVoices;

  try {
    const output = execSync('say -v "?"', { encoding: 'utf-8' });
    cachedVoices = output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Extract voice name (everything before the locale code)
        const match = line.match(/^(.+?)\s+[a-z]{2}[_-][A-Z]{2}/i);
        return match ? match[1].trim() : line.split(/\s+/)[0];
      });
    return cachedVoices;
  } catch {
    return ['Samantha']; // Fallback
  }
}

/**
 * Get the best available voice for the given language
 */
export function getBestVoice(language: string = 'en_US'): string {
  const available = getAvailableVoices();

  // Check preferred voices in order
  for (const voice of PREFERRED_VOICES) {
    if (available.includes(voice)) {
      return voice;
    }
  }

  // Fallback: find any English premium/enhanced voice
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

export class SystemProvider implements Provider {
  private voice: string;

  constructor(voice?: string) {
    this.voice = voice || getBestVoice();
  }

  async speak(config: ProviderConfig): Promise<void> {
    try {
      const volume = config.volume !== undefined ? config.volume : 0.7;
      
      // Generate audio file using say command, then play with volume control
      const tempFile = `${config.tempDir}/system_speech_${Date.now()}.aiff`;
      
      try {
        // Generate audio file with say command (quote voice name for names with special chars)
        const sayCommand = `say -v "${this.voice}" -r ${config.rate} -o "${tempFile}" "${config.text.replace(/"/g, '\\"')}"`;
        execSync(sayCommand);
        
        // Play with volume control using afplay
        const volumeFlag = volume !== 1.0 ? ` -v ${volume}` : '';
        const playCommand = `afplay${volumeFlag} "${tempFile}"`;
        execSync(playCommand);
        
        // Clean up temp file
        const fs = require('fs');
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (error) {
        // Clean up temp file even if there's an error
        const fs = require('fs');
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`System TTS failed: ${error}`);
    }
  }

  validateConfig(): boolean {
    return true; // System voice always works on macOS
  }

  getErrorMessage(error: any): string {
    return `System voice failed: ${error.message}. Ensure 'say' command is available.`;
  }
}