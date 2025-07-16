import { execSync } from 'child_process';
import { Provider, ProviderConfig } from '../types';

export class SystemProvider implements Provider {
  private voice: string;

  constructor(voice: string = 'Samantha') {
    this.voice = voice;
  }

  async speak(config: ProviderConfig): Promise<void> {
    try {
      const command = `say -v ${this.voice} -r ${config.rate} "${config.text.replace(/"/g, '\\"')}"`;
      execSync(command);
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