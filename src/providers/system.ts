import { execSync } from 'child_process';
import { Provider, ProviderConfig } from '../types';

export class SystemProvider implements Provider {
  private voice: string;

  constructor(voice: string = 'Samantha') {
    this.voice = voice;
  }

  async speak(config: ProviderConfig): Promise<void> {
    try {
      const volume = config.volume !== undefined ? config.volume : 0.7;
      
      // Generate audio file using say command, then play with volume control
      const tempFile = `${config.tempDir}/system_speech_${Date.now()}.aiff`;
      
      try {
        // Generate audio file with say command
        const sayCommand = `say -v ${this.voice} -r ${config.rate} -o "${tempFile}" "${config.text.replace(/"/g, '\\"')}"`;
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