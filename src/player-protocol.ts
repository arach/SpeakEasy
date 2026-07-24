export const PLAYER_PROTOCOL_VERSION = 1;
export const PLAYER_SOCKET_PATH = '/tmp/speakeasy-player.sock';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'failed';
export type QueuePriority = 'high' | 'normal' | 'low';

export type PlayerCommand =
  | 'enqueue'
  | 'pause'
  | 'resume'
  | 'togglePlayback'
  | 'stop'
  | 'skip'
  | 'seek'
  | 'setVolume'
  | 'setPlaybackRate'
  | 'removeQueueItem'
  | 'clearQueue'
  | 'status';

export interface PlaybackItem {
  id: string;
  audioPath: string;
  title: string;
  text?: string;
  provider?: string;
  createdAt: string;
  synthesisRateWPM?: number;
  sourceThreadId?: string;
}

export interface PlayerCommandArguments {
  item?: PlaybackItem;
  priority?: QueuePriority;
  interrupt?: boolean;
  autoplay?: boolean;
  positionSeconds?: number;
  volume?: number;
  playbackRate?: number;
  itemId?: string;
}

export interface PlayerCommandRequest {
  protocolVersion: typeof PLAYER_PROTOCOL_VERSION;
  requestId: string;
  command: PlayerCommand;
  arguments?: PlayerCommandArguments;
}

export interface PlayerSnapshot {
  state: PlaybackState;
  currentItem?: PlaybackItem;
  queue: PlaybackItem[];
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  autoplayEnabled: boolean;
  audioLevel: number;
}

export interface PlayerCommandResponse {
  protocolVersion: number;
  requestId: string;
  ok: boolean;
  snapshot: PlayerSnapshot;
  error?: string;
}
