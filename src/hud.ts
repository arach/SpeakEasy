import { openSync, writeSync, closeSync, constants } from 'fs';
import { existsSync, statSync } from 'fs';

const HUD_PIPE_PATH = '/tmp/speakeasy-hud.fifo';

export interface HUDMessage {
  text: string;
  provider: string;
  cached: boolean;
  timestamp: number;
}

/**
 * Writes a message to the HUD named pipe (non-blocking).
 * If no reader is listening, the write fails silently.
 */
export function notifyHUD(message: HUDMessage): void {
  // Check if the pipe exists and is actually a FIFO
  if (!existsSync(HUD_PIPE_PATH)) {
    return; // Pipe doesn't exist, HUD probably not running
  }

  try {
    const stats = statSync(HUD_PIPE_PATH);
    if (!stats.isFIFO()) {
      return; // Not a named pipe
    }

    // Open with O_NONBLOCK to avoid blocking if no reader
    const fd = openSync(HUD_PIPE_PATH, constants.O_WRONLY | constants.O_NONBLOCK);

    try {
      const jsonMessage = JSON.stringify(message) + '\n';
      writeSync(fd, jsonMessage);
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    // Silently ignore errors (ENXIO when no reader, EPIPE if broken, etc.)
    // This is expected behavior when HUD is not running
  }
}
