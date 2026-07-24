import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import {
  PLAYER_PROTOCOL_VERSION,
  PLAYER_SOCKET_PATH,
  PlaybackItem,
  PlayerCommand,
  PlayerCommandArguments,
  PlayerCommandRequest,
  PlayerCommandResponse,
  QueuePriority,
} from './player-protocol';

export interface EnqueueOptions {
  title?: string;
  text?: string;
  provider?: string;
  synthesisRateWPM?: number;
  sourceThreadId?: string;
  priority?: QueuePriority;
  interrupt?: boolean;
  autoplay?: boolean;
}

export class PlayerUnavailableError extends Error {
  constructor(message = 'SpeakEasy player is unavailable') {
    super(message);
    this.name = 'PlayerUnavailableError';
  }
}

export function sendPlayerCommand(
  command: PlayerCommand,
  commandArguments?: PlayerCommandArguments,
  timeoutMs = 5_000,
): Promise<PlayerCommandResponse> {
  const request: PlayerCommandRequest = {
    protocolVersion: PLAYER_PROTOCOL_VERSION,
    requestId: randomUUID(),
    command,
    arguments: commandArguments,
  };

  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: PLAYER_SOCKET_PATH });
    let buffer = '';
    let settled = false;

    const finish = (error?: Error, response?: PlayerCommandResponse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else if (response) resolve(response);
    };

    socket.setTimeout(timeoutMs, () => {
      finish(new PlayerUnavailableError('SpeakEasy player did not respond'));
    });

    socket.on('connect', () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });

    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;

      try {
        const response = JSON.parse(buffer.slice(0, newline)) as PlayerCommandResponse;
        if (response.protocolVersion !== PLAYER_PROTOCOL_VERSION) {
          finish(new Error(`Unsupported SpeakEasy player protocol ${response.protocolVersion}`));
          return;
        }
        if (response.requestId.toLowerCase() !== request.requestId.toLowerCase()) {
          finish(new Error('SpeakEasy player returned a mismatched request id'));
          return;
        }
        finish(undefined, response);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });

    socket.on('error', error => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ECONNREFUSED') {
        finish(new PlayerUnavailableError());
      } else {
        finish(error);
      }
    });

    socket.on('end', () => {
      if (!settled) finish(new Error('SpeakEasy player closed the connection without a response'));
    });
  });
}

export function enqueueInPlayer(audioPath: string, options: EnqueueOptions = {}) {
  const item: PlaybackItem = {
    id: randomUUID(),
    audioPath,
    title: options.title ?? 'SpeakEasy narration',
    text: options.text,
    provider: options.provider,
    createdAt: new Date().toISOString(),
    synthesisRateWPM: options.synthesisRateWPM,
    sourceThreadId: options.sourceThreadId ?? process.env.CODEX_THREAD_ID,
  };

  return sendPlayerCommand('enqueue', {
    item,
    priority: options.priority ?? 'normal',
    interrupt: options.interrupt ?? false,
    autoplay: options.autoplay ?? true,
  });
}
