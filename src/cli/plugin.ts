import { execFileSync, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdtempSync, readdirSync, renameSync, rmSync, cpSync, lstatSync, readdirSync as listDir } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import os from 'node:os';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import chalk from 'chalk';

const REPO = 'arach/SpeakEasy';
const SKILL_SUBPATH = path.join('plugins', 'speakeasy', 'skills', 'speakeasy');
const MAX_TARBALL_BYTES = 150 * 1024 * 1024;
const KEEP_BACKUPS = 3;

interface Host {
  id: string;
  name: string;
  skillsDir: () => string;
  hint: string;
}

const HOSTS: Host[] = [
  {
    id: 'codex',
    name: 'Codex',
    skillsDir: () => path.join(os.homedir(), '.codex', 'skills'),
    hint: 'Start a new Codex session, then say: “Read this summary aloud in SpeakEasy.”',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    skillsDir: () => path.join(os.homedir(), '.claude', 'skills'),
    hint: 'Start a new Claude Code session, then ask it to read something aloud.',
  },
];

function usage(): void {
  console.error('');
  console.error(chalk.bold('  🔌 speakeasy plugin <host>'));
  console.error('');
  console.error('  Install the SpeakEasy skill into an agent host:');
  for (const h of HOSTS) console.error(`    ${chalk.cyan(h.id.padEnd(8))} ${h.name}  ${chalk.dim('→ ' + h.skillsDir())}`);
  console.error('');
  console.error(chalk.dim('  Example: speakeasy plugin codex          (latest release)'));
  console.error(chalk.dim('           speakeasy plugin codex --ref v0.2.17'));
  console.error('');
}

function parsePluginArgs(argv: string[]): { host: string; ref?: string } {
  let host = '';
  let ref: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ref') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        console.error('❌ --ref requires a value, e.g. --ref v0.2.17');
        process.exit(1);
      }
      ref = value;
      i++;
    } else if (arg.startsWith('-')) {
      console.error(`❌ Unknown flag: ${arg}`);
      usage();
      process.exit(1);
    } else if (!host) {
      host = arg;
    } else {
      console.error(`❌ Unexpected argument: ${arg}`);
      usage();
      process.exit(1);
    }
  }
  return { host, ref };
}

/** Resolve the latest release tag. Fails closed — never silently falls back to a moving branch. */
async function latestReleaseTag(): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'user-agent': 'speakeasy-cli' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(`could not reach GitHub to resolve the latest release (${(error as Error).message}) — retry, or pass --ref <tag>`);
  }
  if (!res.ok) {
    throw new Error(`could not resolve the latest release (HTTP ${res.status}) — retry, or pass --ref <tag>`);
  }
  const data = (await res.json()) as { tag_name?: string };
  if (!data.tag_name) throw new Error('latest release response had no tag — pass --ref <tag>');
  return data.tag_name;
}

async function downloadTarball(ref: string, dest: string): Promise<void> {
  const isBranch = ref === 'master' || ref === 'main';
  const candidates = isBranch ? [`heads/${ref}`] : [`tags/${ref}`, `heads/${ref}`];
  let lastError: Error | undefined;

  for (const candidate of candidates) {
    const url = `https://codeload.github.com/${REPO}/tar.gz/refs/${candidate}`;
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'speakeasy-cli' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok || !res.body) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > MAX_TARBALL_BYTES) throw new Error(`tarball too large (${declared} bytes)`);
      // enforce the cap while streaming — a missing or lying Content-Length must not fill the disk
      let received = 0;
      const counter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          received += chunk.length;
          if (received > MAX_TARBALL_BYTES) cb(new Error(`tarball exceeded ${MAX_TARBALL_BYTES} bytes`));
          else cb(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(res.body as never), counter, createWriteStream(dest));
      return;
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw new Error(`download failed for ref "${ref}" (${lastError?.message ?? 'no response'})`);
}

/** Reject archive entries that could escape the extraction directory. */
function validateTarballPaths(tarball: string): void {
  const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const entry of listing.split('\n')) {
    if (!entry) continue;
    if (entry.startsWith('/') || entry.split('/').includes('..')) {
      throw new Error(`unsafe archive entry: ${entry}`);
    }
  }
}

function extractSkill(tarball: string, workdir: string): string {
  execFileSync('tar', ['-xzf', tarball, '-C', workdir], { stdio: 'pipe' });
  const top = readdirSync(workdir).filter((e) => e !== '.DS_Store');
  for (const dir of top) {
    const candidate = path.join(workdir, dir, SKILL_SUBPATH);
    if (existsSync(path.join(candidate, 'SKILL.md'))) return candidate;
  }
  throw new Error(`skill not found at ${SKILL_SUBPATH} in that ref — the plugin may not exist there yet`);
}

/** The installed skill must be plain files — no symlinks pointing who-knows-where. */
function assertNoSymlinks(dir: string): void {
  for (const entry of listDir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (lstatSync(full).isSymbolicLink()) throw new Error(`refusing to install symlink: ${entry.name}`);
    if (entry.isDirectory()) assertNoSymlinks(full);
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Stage → validate → swap, restoring the previous install if the swap fails. */
function installSkill(skillSrc: string, destDir: string): { backup: string | null; dest: string } {
  const dest = path.join(destDir, 'speakeasy');
  const staging = path.join(destDir, `.speakeasy-staging-${process.pid}`);

  try {
    cpSync(skillSrc, staging, { recursive: true });
    if (!existsSync(path.join(staging, 'SKILL.md'))) throw new Error('staged skill is missing SKILL.md');
    assertNoSymlinks(staging);

    let backup: string | null = null;
    try {
      if (existsSync(dest)) {
        backup = `${dest}.backup-${timestamp()}`;
        renameSync(dest, backup);
      }
      renameSync(staging, dest);
    } catch (error) {
      // roll back: never leave the user without a working skill
      if (backup && existsSync(backup) && !existsSync(dest)) renameSync(backup, dest);
      throw error;
    }
    return { backup, dest };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/** Roll a failed install back: remove the staged dest and restore the backup. */
function rollbackInstall(dest: string, backup: string | null): void {
  rmSync(dest, { recursive: true, force: true });
  if (backup && existsSync(backup)) renameSync(backup, dest);
}

function pruneBackups(destDir: string): void {
  const backups = readdirSync(destDir)
    .filter((e) => e.startsWith('speakeasy.backup-'))
    .sort()
    .reverse();
  for (const old of backups.slice(KEEP_BACKUPS)) {
    rmSync(path.join(destDir, old), { recursive: true, force: true });
  }
}

export async function runPlugin(argv: string[]): Promise<void> {
  const { host, ref } = parsePluginArgs(argv);
  const target = HOSTS.find((h) => h.id === host);

  if (!target) {
    usage();
    if (host) {
      console.error(`❌ Unknown host: ${host}`);
      process.exit(1);
    }
    return;
  }

  console.log('');
  console.log(chalk.bold(`  🔌 SpeakEasy skill for ${target.name}`));
  console.log('');

  if (process.platform !== 'darwin') {
    console.log(chalk.yellow('  ⚠️  The native SpeakEasy player needs macOS 14+ — installing the skill anyway.'));
    console.log('');
  }

  const workdir = mkdtempSync(path.join(tmpdir(), 'speakeasy-plugin-'));
  let exitCode = 0;

  try {
    const stage = ref ?? (await latestReleaseTag());
    console.log(`  ${chalk.dim('Source')}     ${chalk.cyan(`github.com/${REPO}`)} ${chalk.dim('@')} ${stage}`);

    console.log(`  ${chalk.dim('Downloading…')}`);
    const tarball = path.join(workdir, 'repo.tar.gz');
    await downloadTarball(stage, tarball);

    console.log(`  ${chalk.dim('Extracting…')}`);
    validateTarballPaths(tarball);
    const skillSrc = extractSkill(tarball, workdir);

    const { backup, dest } = installSkill(skillSrc, target.skillsDir());
    if (backup) console.log(`  ${chalk.dim('Previous')}  ${chalk.yellow('moved to')} ${chalk.dim(backup)}`);
    console.log(`  ${chalk.dim('Installed')} ${chalk.green(dest)}`);

    const bun = spawnSync('which', ['bun'], { stdio: 'pipe' });
    let healthy = false;
    if (bun.status === 0) {
      console.log('');
      console.log(`  ${chalk.dim('Health check…')}`);
      const doctor = spawnSync('bun', [path.join(dest, 'scripts', 'speakeasy-runtime.ts'), '--doctor'], { stdio: 'inherit' });
      if (doctor.status !== 0) {
        rollbackInstall(dest, backup);
        throw new Error('health check failed — rolled back to the previous install');
      }
      healthy = true;
    } else {
      console.log('');
      console.log(chalk.yellow('  ⚠️  Bun not found — the skill scripts need it: https://bun.sh'));
      console.log(chalk.dim('      Install it, then verify: bun ' + path.join(dest, 'scripts', 'speakeasy-runtime.ts') + ' --doctor'));
    }
    // only prune once the new install has proven itself — backups are the way back
    if (healthy) pruneBackups(target.skillsDir());

    console.log('');
    console.log(`  ${chalk.green('✓')} ${target.hint}`);
    console.log('');
  } catch (error) {
    console.error('');
    console.error(`  ❌ Install failed: ${(error as Error).message}`);
    console.error(chalk.dim('     Check your network, or pick a ref explicitly with --ref <tag> (e.g. --ref master)'));
    console.error('');
    exitCode = 1;
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }

  if (exitCode !== 0) process.exit(exitCode);
}
