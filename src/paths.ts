import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

export const HOME_DIR = homedir();
export const CONFIG_DIR = path.join(HOME_DIR, '.config', 'speakeasy');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
export const HISTORY_DIR = path.join(CONFIG_DIR, 'history');

export const USER_APP_DIR = path.join(HOME_DIR, '.speakeasy');
export const USER_APP_PATH = path.join(USER_APP_DIR, 'SpeakEasy.app');
export const USER_APP_VERSION_FILE = path.join(USER_APP_DIR, '.app-version');
export const SYSTEM_APP_PATH = '/Applications/SpeakEasy.app';

export const CODEX_SKILLS_DIR = path.join(HOME_DIR, '.codex', 'skills');
export const CLAUDE_SKILLS_DIR = path.join(HOME_DIR, '.claude', 'skills');
export const CODEX_SESSIONS_DIR = path.join(HOME_DIR, '.codex', 'sessions');

export const DECK_DIR = path.join(CONFIG_DIR, 'deck');
export const DECK_LANES_FILE = path.join(CONFIG_DIR, 'deck-lanes.json');
export const DECK_TOKEN_FILE = path.join(CONFIG_DIR, 'deck-token');
export const DECK_LOCK_FILE = path.join(CONFIG_DIR, 'deck-runtime.lock');

export function defaultCacheDir(tempDir = '/tmp'): string {
  return path.join(tempDir, 'speakeasy-cache');
}

export const CACHE_DIRS = [...new Set([defaultCacheDir(tmpdir()), defaultCacheDir()])];
