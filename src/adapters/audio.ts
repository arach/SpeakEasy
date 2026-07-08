import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { TTSAudioFormat, TTSResult } from './types';
import { updateAudioLevel } from '../hud';

export function extensionForFormat(format: TTSAudioFormat): string {
  return format;
}

export function playAudioFile(filePath: string, volume: number = 1.0): Promise<void> {
  return new Promise((resolve, reject) => {
    const volumeArgs = volume !== 1.0 ? ['-v', volume.toString()] : [];
    const afplay = spawn('afplay', [...volumeArgs, filePath]);

    let levelInterval: NodeJS.Timeout | null = null;
    let phase = 0;

    const startLevelSimulation = () => {
      levelInterval = setInterval(() => {
        const base = 0.4 + Math.sin(phase * 0.3) * 0.2;
        const variation = Math.random() * 0.3;
        const level = Math.min(1, Math.max(0, base + variation));
        updateAudioLevel(level);
        phase++;
      }, 33);
    };

    const stopLevelSimulation = () => {
      if (levelInterval) {
        clearInterval(levelInterval);
        levelInterval = null;
      }
      updateAudioLevel(0);
    };

    startLevelSimulation();

    afplay.on('close', (code) => {
      stopLevelSimulation();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`afplay exited with code ${code}`));
      }
    });

    afplay.on('error', (err) => {
      stopLevelSimulation();
      reject(err);
    });
  });
}

export async function playTTSResult(
  result: TTSResult,
  volume: number,
  tempDir: string
): Promise<void> {
  const tempFile = path.join(
    tempDir,
    `speech_${Date.now()}.${extensionForFormat(result.format)}`
  );

  fs.writeFileSync(tempFile, result.audio);
  try {
    await playAudioFile(tempFile, volume);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

export function stopPlayback(): void {
  try {
    execSync('pkill -f "say|afplay"', { stdio: 'ignore' });
  } catch {
    // Ignore when no playback process is running.
  }
}