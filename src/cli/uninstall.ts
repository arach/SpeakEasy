import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import {
  CACHE_DIRS,
  CLAUDE_SKILLS_DIR,
  CODEX_SKILLS_DIR,
  CONFIG_DIR,
  CONFIG_FILE,
  DECK_DIR,
  DECK_LANES_FILE,
  DECK_LOCK_FILE,
  DECK_TOKEN_FILE,
  HISTORY_DIR,
  SYSTEM_APP_PATH,
  USER_APP_DIR,
} from '../paths';

/** Everything SpeakEasy can put on a machine, in one place.
 *
 *  This list is the allowlist: `remove()` refuses any path that did not come
 *  from here, so a bad join can never turn into an rm -rf of something we do
 *  not own. Adding a new install location means adding it here too. */
interface Item {
  kind: string;
  path: string;
  /** Personal data — kept unless the user asks for it to go. */
  personal?: boolean;
}

function items(): Item[] {
  const all: Item[] = [
    { kind: 'App', path: SYSTEM_APP_PATH },
    { kind: 'App', path: USER_APP_DIR },
    { kind: 'Plugin', path: path.join(CODEX_SKILLS_DIR, 'speakeasy') },
    { kind: 'Plugin', path: path.join(CLAUDE_SKILLS_DIR, 'speakeasy') },
    { kind: 'Deck', path: DECK_DIR },
    { kind: 'Deck', path: DECK_LANES_FILE },
    { kind: 'Deck', path: DECK_TOKEN_FILE },
    { kind: 'Deck', path: DECK_LOCK_FILE },
    ...CACHE_DIRS.map((cacheDir) => ({ kind: 'Cache', path: cacheDir })),
    { kind: 'Settings', path: CONFIG_FILE, personal: true },
    { kind: 'History', path: HISTORY_DIR, personal: true },
  ];

  // Skill backups the plugin installer leaves behind, and the deck's rotating
  // logs and listener snapshots — globbed, so they are found rather than named.
  for (const skills of [CODEX_SKILLS_DIR, CLAUDE_SKILLS_DIR]) {
    if (existsSync(skills)) {
      for (const entry of readdirSync(skills)) {
        if (entry.startsWith('speakeasy.backup-')) {
          all.push({ kind: 'Backup', path: path.join(skills, entry) });
        }
      }
    }
  }
  if (existsSync(CONFIG_DIR)) {
    for (const entry of readdirSync(CONFIG_DIR)) {
      if (entry.endsWith('.log')) all.push({ kind: 'Logs', path: path.join(CONFIG_DIR, entry) });
      else if (entry.startsWith('deck-listener')) all.push({ kind: 'State', path: path.join(CONFIG_DIR, entry) });
    }
  }

  // /tmp and os.tmpdir() are the same place on most Macs — do not list it twice
  const seen = new Set<string>();
  return all.filter((i) => {
    const real = path.resolve(i.path);
    if (seen.has(real)) return false;
    seen.add(real);
    return existsSync(real);
  });
}

/** The deck writes its pid to a lock file. Pulling its token and assets out
 *  from under a live process leaves a half-working server, so we stop first. */
function runningDeckPid(): number | null {
  if (!existsSync(DECK_LOCK_FILE)) return null;
  let pid: unknown;
  try {
    // written by acquireDeckProcessLock as {"pid":…,"nonce":…}
    ({ pid } = JSON.parse(readFileSync(DECK_LOCK_FILE, 'utf8')) as { pid?: unknown });
  } catch {
    return null; // a truncated or stale lock is not a running deck
  }
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0); // signal 0 tests for existence without touching it
    return pid;
  } catch {
    return null;
  }
}

function humanSize(target: string): string {
  try {
    const kb = Number(execFileSync('du', ['-sk', target], { encoding: 'utf8' }).trim().split(/\s+/)[0]);
    if (!Number.isFinite(kb)) return '';
    if (kb < 1024) return `${kb} KB`;
    if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  } catch {
    return '';
  }
}

function display(target: string): string {
  const home = os.homedir();
  return target.startsWith(home) ? `~${target.slice(home.length)}` : target;
}

/** Refuses anything that is not on the allowlist — see the note on Item. */
function remove(target: string, allowed: Set<string>): void {
  const real = path.resolve(target);
  if (!allowed.has(real)) throw new Error(`refusing to remove an unlisted path: ${real}`);
  if (real === os.homedir() || real === '/' || real.split(path.sep).length < 3) {
    throw new Error(`refusing to remove a root path: ${real}`);
  }
  rmSync(real, { recursive: true, force: true });
}

export function runUninstall(argv: string[]): void {
  const confirmed = argv.includes('--yes') || argv.includes('-y');
  const purge = argv.includes('--purge');

  for (const arg of argv) {
    if (!['--yes', '-y', '--purge'].includes(arg)) {
      console.error(`❌ Unknown flag: ${arg}`);
      console.error('   Usage: speakeasy uninstall [--yes] [--purge]');
      process.exit(1);
    }
  }

  const found = items();
  const targets = found.filter((i) => purge || !i.personal);
  const kept = found.filter((i) => !purge && i.personal);

  console.log('');
  console.log(chalk.bold('  🧹 SpeakEasy — what is installed'));
  console.log('');

  if (!found.length) {
    console.log(chalk.dim('    Nothing found. This machine is already clean.'));
    console.log('');
    return;
  }

  const width = Math.max(...targets.map((i) => display(i.path).length));
  for (const item of targets) {
    const size = statSync(item.path).isDirectory() ? humanSize(item.path) : '';
    console.log(`    ${chalk.cyan(item.kind.padEnd(9))} ${display(item.path).padEnd(width)}  ${chalk.dim(size)}`);
  }

  if (kept.length) {
    console.log('');
    console.log(chalk.dim('    Kept — pass --purge to remove these too:'));
    for (const item of kept) {
      console.log(chalk.dim(`    ${item.kind.padEnd(9)} ${display(item.path)}`));
    }
  }

  console.log('');

  const deckPid = runningDeckPid();
  if (deckPid) {
    console.log(chalk.yellow(`    ⚠️  The deck is running (pid ${deckPid}). Stop it first — otherwise it`));
    console.log(chalk.yellow('       keeps serving from memory and rewrites its token and lock on exit.'));
    console.log('');
  }

  if (!confirmed) {
    console.log(chalk.yellow('    Nothing was removed.'));
    console.log(chalk.dim('    Re-run with --yes to remove the items above.'));
    console.log('');
    return;
  }

  if (deckPid) {
    console.error(chalk.red(`❌ Refusing to uninstall while the deck is running (pid ${deckPid}).`));
    console.error('   Stop it, then re-run.');
    process.exit(1);
  }

  const allowed = new Set(targets.map((i) => path.resolve(i.path)));
  let removed = 0;
  let failed = 0;
  for (const item of targets) {
    try {
      remove(item.path, allowed);
      removed++;
    } catch (error) {
      failed++;
      console.error(chalk.red(`    ✗ ${display(item.path)} — ${(error as Error).message}`));
    }
  }

  console.log(`    ${chalk.green('✓')} Removed ${removed} item${removed === 1 ? '' : 's'}.`);
  if (failed) {
    console.log(chalk.yellow(`    ${failed} could not be removed — check permissions and re-run.`));
  }
  console.log('');
  console.log(chalk.dim('    The npm package is separate: npm uninstall -g @arach/speakeasy'));
  console.log('');

  if (failed) process.exitCode = 1;
}
