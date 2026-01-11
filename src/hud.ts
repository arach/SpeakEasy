import { openSync, writeSync, closeSync, constants } from 'fs';
import { existsSync, statSync } from 'fs';

const HUD_PIPE_PATH = '/tmp/speakeasy-hud.fifo';

export interface HUDMessage {
  text?: string;
  provider?: string;
  cached?: boolean;
  timestamp?: number;
  audioLevel?: number;  // 0.0 to 1.0 for waveform amplitude
}

function writeToPipe(message: HUDMessage): void {
  if (!existsSync(HUD_PIPE_PATH)) {
    return;
  }

  try {
    const stats = statSync(HUD_PIPE_PATH);
    if (!stats.isFIFO()) {
      return;
    }

    // Open, write, close each time to ensure immediate delivery
    const fd = openSync(HUD_PIPE_PATH, constants.O_WRONLY | constants.O_NONBLOCK);
    try {
      const jsonMessage = JSON.stringify(message) + '\n';
      writeSync(fd, jsonMessage);
    } finally {
      closeSync(fd);
    }
  } catch {
    // Silently ignore - HUD might not be running
  }
}

export function closePipe(): void {
  // No-op now, kept for API compatibility
}

/**
 * Writes a message to the HUD named pipe (non-blocking).
 * If no reader is listening, the write fails silently.
 */
export function notifyHUD(message: HUDMessage): void {
  writeToPipe(message);
}

/**
 * Send just an audio level update (for waveform animation).
 * Call this frequently during audio playback (~30-60 Hz).
 */
export function updateAudioLevel(level: number): void {
  writeToPipe({ audioLevel: Math.max(0, Math.min(1, level)) });
}
