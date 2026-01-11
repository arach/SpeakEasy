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

// Keep file descriptor open for level updates (avoids open/close overhead)
let pipeFd: number | null = null;

function ensurePipeOpen(): number | null {
  if (pipeFd !== null) {
    return pipeFd;
  }

  if (!existsSync(HUD_PIPE_PATH)) {
    return null;
  }

  try {
    const stats = statSync(HUD_PIPE_PATH);
    if (!stats.isFIFO()) {
      return null;
    }

    pipeFd = openSync(HUD_PIPE_PATH, constants.O_WRONLY | constants.O_NONBLOCK);
    return pipeFd;
  } catch {
    return null;
  }
}

function writeToPipe(message: HUDMessage): void {
  const fd = ensurePipeOpen();
  if (fd === null) return;

  try {
    const jsonMessage = JSON.stringify(message) + '\n';
    writeSync(fd, jsonMessage);
  } catch {
    // Pipe broken, close and retry next time
    closePipe();
  }
}

export function closePipe(): void {
  if (pipeFd !== null) {
    try {
      closeSync(pipeFd);
    } catch {
      // Ignore
    }
    pipeFd = null;
  }
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
