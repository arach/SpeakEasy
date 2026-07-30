import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4',
};

const DEFAULT_PORT = 43211;
const VANITY_HOST = 'speakeasy.local';

/** The built CLI lives at dist/bin/speakeasy-cli.js; deck assets ship at the package root. */
function deckRoot(): string {
  return path.resolve(__dirname, '..', '..', 'deck');
}

function lanAddress(): string | undefined {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return undefined;
}

/** This Mac's mDNS name (e.g. "air.local") — every Mac already answers to it. */
function macBonjourName(): string | undefined {
  if (process.platform === 'darwin') {
    try {
      const name = execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim();
      if (name) return `${name}.local`;
    } catch {
      // fall through to os.hostname()
    }
  }
  const host = os.hostname().replace(/\.local$/, '');
  return host ? `${host}.local` : undefined;
}

/** Advertise VANITY_HOST via Bonjour so the iPad can type a name, not an IP. */
async function advertiseVanity(port: number): Promise<(() => void) | null> {
  try {
    const { default: Bonjour } = await import('bonjour-service');
    const bonjour = new Bonjour();
    const service = bonjour.publish({ name: 'SpeakEasy Deck', type: 'http', port, host: VANITY_HOST });
    const up = await new Promise<boolean>((resolve) => {
      service.on('up', () => resolve(true));
      setTimeout(() => resolve(false), 2000).unref();
    });
    if (!up) {
      // never confirmed on the network — don't print a URL that won't resolve
      service.stop?.();
      bonjour.destroy();
      return null;
    }
    return () => {
      service.stop?.();
      bonjour.destroy();
    };
  } catch {
    return null;
  }
}

interface DeckHandle {
  engine: string;
  stop: () => void;
  exited: Promise<number | null>;
}

function findCaddy(): string | null {
  const res = spawnSync('which', ['caddy'], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

function caddyConfig(root: string, port: number): string {
  return `{
	admin off
	auto_https off
}

http://:${port} {
	root * ${root}
	file_server

	@healthz path /healthz
	handle @healthz {
		header Content-Type application/json
		respond \`{"ok":true,"service":"speakeasy-deck","port":${port}}\` 200
	}

	log {
		output discard
	}
}
`;
}

/** Serve via Caddy when it is installed — the same static server users get from deck/Caddyfile. */
async function startCaddy(caddy: string, root: string, port: number): Promise<DeckHandle> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'speakeasy-deck-'));
  const config = path.join(dir, 'Caddyfile');
  await writeFile(config, caddyConfig(root, port));

  const child: ChildProcess = spawn(caddy, ['run', '--config', config], { stdio: ['ignore', 'ignore', 'pipe'] });
  let errBuf = '';
  child.stderr?.on('data', (d) => (errBuf += d));
  const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => {});
  const exited = new Promise<number | null>((resolve) => {
    child.once('exit', (code) => {
      cleanup();
      resolve(code);
    });
    child.once('error', (error) => {
      errBuf += String(error);
      cleanup();
      resolve(-1);
    });
  });

  // one idempotent escalated stop — graceful first, SIGKILL if the child ignores it
  let stopped = false;
  const escalatedStop = () => {
    if (stopped) return;
    stopped = true;
    child.kill('SIGINT');
    const killer = setTimeout(() => child.kill('SIGKILL'), 3000);
    killer.unref();
    exited.finally(() => clearTimeout(killer));
  };

  const deadline = Date.now() + 10_000;
  for (;;) {
    let settled = false;
    await Promise.race([exited.then(() => (settled = true)), new Promise((r) => setTimeout(r, 150))]);
    if (settled) {
      throw new Error(`caddy exited before becoming ready: ${errBuf.trim() || 'no output'}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) break;
    } catch {
      // not up yet (or a peer that accepts sockets but never answers — probes are bounded)
    }
    if (Date.now() > deadline) {
      escalatedStop();
      // make sure the port is actually free before the caller falls back
      await Promise.race([exited, new Promise((r) => setTimeout(r, 3500))]);
      throw new Error('caddy did not become ready in 10s');
    }
  }

  return {
    engine: 'caddy',
    stop: escalatedStop,
    exited,
  };
}

/** Zero-dependency fallback when Caddy is not installed. */
async function startNodeServer(root: string, port: number): Promise<DeckHandle> {
  const server = createServer(async (req, res) => {
    let pathname: string;
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, service: 'speakeasy-deck', port }));
      return;
    }
    if (pathname === '/') pathname = '/index.html';
    const file = path.join(root, path.normalize(pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve());
  });

  return {
    engine: 'built-in server',
    stop: () => server.close(),
    exited: new Promise((resolve) => server.once('close', () => resolve(0))),
  };
}

function parseDeckArgs(argv: string[]): { port: number; qr: boolean; caddy: boolean; mdns: boolean } {
  let port = DEFAULT_PORT;
  let qr = true;
  let caddy = true;
  let mdns = true;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') {
      const value = argv[++i];
      if (!value || !/^\d+$/.test(value)) {
        console.error('❌ --port requires a number, e.g. --port 43211');
        process.exit(1);
      }
      port = Number(value);
    } else if (arg === '--no-qr') {
      qr = false;
    } else if (arg === '--no-caddy') {
      caddy = false;
    } else if (arg === '--no-mdns') {
      mdns = false;
    } else {
      console.error(`❌ Unknown argument: ${arg}`);
      console.error('   Usage: speakeasy deck [--port <n>] [--no-qr] [--no-caddy] [--no-mdns]');
      process.exit(1);
    }
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`❌ Invalid port: ${port}`);
    process.exit(1);
  }
  return { port, qr, caddy, mdns };
}

export async function runDeck(argv: string[]): Promise<void> {
  const { port, qr, caddy: preferCaddy, mdns } = parseDeckArgs(argv);
  const root = deckRoot();
  if (!existsSync(path.join(root, 'index.html'))) {
    console.error('❌ Deck assets not found at', root);
    console.error('   The deck ships with the @arach/speakeasy package — reinstall or run from the repo.');
    process.exit(1);
  }

  let handle: DeckHandle;
  const caddy = preferCaddy ? findCaddy() : null;
  try {
    handle = caddy ? await startCaddy(caddy, root, port) : await startNodeServer(root, port);
  } catch (error) {
    if (!caddy) {
      console.error('❌ Could not start the deck server:', (error as Error).message);
      process.exit(1);
    }
    console.error(`  ⚠️  Caddy failed (${(error as Error).message}) — falling back to the built-in server.`);
    try {
      handle = await startNodeServer(root, port);
    } catch (fallbackError) {
      console.error('❌ Built-in server also failed:', (fallbackError as Error).message);
      process.exit(1);
    }
  }

  const lan = lanAddress();
  const stopVanity = mdns && lan ? await advertiseVanity(port) : null;
  const bonjour = macBonjourName();
  const padUrl = stopVanity
    ? `http://${VANITY_HOST}:${port}`
    : bonjour
      ? `http://${bonjour}:${port}`
      : `http://${lan ?? 'your-macs-ip'}:${port}`;

  console.log('');
  console.log(chalk.bold('  🎛  SpeakEasy Deck'));
  console.log('');
  console.log(`  ${chalk.dim('On this Mac')}   http://localhost:${port}`);
  console.log(`  ${chalk.dim('On your iPad')}  ${chalk.green(chalk.bold(padUrl))}  ${chalk.dim('← same Wi-Fi, no IP needed')}`);
  if (stopVanity && bonjour) {
    console.log(`  ${chalk.dim('Fallback')}      http://${bonjour}:${port}${lan ? ` · http://${lan}:${port}` : ''}`);
  }
  console.log('');
  console.log(chalk.bold('  Set up in three steps'));
  console.log(`  ${chalk.cyan('1.')} iPad: open the URL above in Safari — or scan the code below`);
  console.log(`  ${chalk.cyan('2.')} Share → ${chalk.bold('Add to Home Screen')} for the full-screen deck`);
  console.log(`  ${chalk.cyan('3.')} Themes: ${chalk.dim('?theme=paper|ember|flight')} · Variants: ${chalk.dim('?variant=oxide')}`);
  console.log('');
  console.log(`  ${chalk.dim(`Served by ${handle.engine} · Is it running? curl http://localhost:${port}/healthz`)}`);
  console.log(`  ${chalk.dim('The deck runs its built-in demo state. Press Ctrl+C to stop.')}`);
  console.log('');

  if (qr && (lan || bonjour)) {
    try {
      const { default: QRCode } = await import('qrcode');
      const art = await QRCode.toString(padUrl, { type: 'terminal', small: true });
      console.log(art);
    } catch {
      console.log(chalk.dim('  (QR unavailable — type the URL manually)'));
    }
  }

  // Run until Ctrl+C / SIGTERM — or until the server dies underneath us.
  await new Promise<void>((resolve) => {
    let stopping = false;
    const onShutdown = () => {
      stopping = true;
      stopVanity?.();
      handle.stop();
      cleanup();
      resolve();
      setTimeout(resolve, 500).unref();
    };
    const onExit = (code: number | null) => {
      cleanup();
      stopVanity?.();
      if (stopping) {
        resolve();
        return;
      }
      console.error('');
      console.error(`  ⚠️  ${handle.engine} exited unexpectedly (code ${code ?? 'unknown'}) — deck is no longer being served.`);
      process.exitCode = 1;
      resolve();
    };
    const cleanup = () => {
      process.removeListener('SIGINT', onShutdown);
      process.removeListener('SIGTERM', onShutdown);
    };
    process.on('SIGINT', onShutdown);
    process.on('SIGTERM', onShutdown);
    handle.exited.then(onExit);
  });
}
