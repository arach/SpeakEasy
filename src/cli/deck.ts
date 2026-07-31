import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, lstatSync, renameSync } from 'node:fs';
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import { DeckRuntime } from './deck-runtime';
import { startDataPlane, writeDiscovery, clearDiscovery, type DataPlane } from './deck-live';

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

/** The device's slugified name (e.g. "air") — the {host} in speak.{host}.local. */
function deviceSlug(): string {
  let name = '';
  if (process.platform === 'darwin') {
    try {
      name = execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim();
    } catch {
      // fall through to os.hostname()
    }
  }
  if (!name) name = os.hostname().replace(/\.local$/, '');
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mac';
}

/** This Mac's mDNS name (e.g. "air.local") — every Mac already answers to it. */
function macBonjourName(): string | undefined {
  const slug = deviceSlug();
  return slug ? `${slug}.local` : undefined;
}

/** The deck capability token. Persistent across runs so a pinned iPad app keeps
 * working after a restart; file is owner-only, rotation on demand. */
function deckToken(rotate: boolean): string {
  const file = path.join(os.homedir(), '.config', 'speakeasy', 'deck-token');
  if (!rotate) {
    try {
      const st = lstatSync(file);
      const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
      if (st.isFile() && !st.isSymbolicLink() && (uid === -1 || st.uid === uid)) {
        if ((st.mode & 0o777) !== 0o600) chmodSync(file, 0o600);
        const existing = readFileSync(file, 'utf8').trim();
        if (/^[a-f0-9]{24,}$/.test(existing)) return existing;
      }
    } catch {
      // fall through to mint
    }
  }
  const token = randomBytes(12).toString('hex');
  try {
    const dir = path.dirname(file);
    mkdirSync(dir, { recursive: true });
    // temp + atomic rename — a symlink at the target is replaced, never followed
    const tmp = path.join(dir, `.deck-token.${process.pid}.tmp`);
    writeFileSync(tmp, token, { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, file);
  } catch {
    // best-effort — a per-run token still works for this run
  }
  return token;
}

/** Format a URL, omitting the port when it is the default HTTP port. */
function hostUrl(host: string, port: number): string {
  return `http://${host}${port === 80 ? '' : `:${port}`}`;
}

/** True when we can bind the port (macOS allows unprivileged low ports). */
async function portAvailable(port: number): Promise<boolean> {
  const { createServer } = await import('node:net');
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
  });
}

/** Advertise the vanity host via Bonjour so the iPad can type a name, not an IP. */
async function advertiseVanity(host: string, port: number): Promise<(() => void) | null> {
  try {
    const { default: Bonjour } = await import('bonjour-service');
    const bonjour = new Bonjour();
    const service = bonjour.publish({ name: `SpeakEasy Deck (${host})`, type: 'http', port, host });
    const up = await new Promise<boolean>((resolve) => {
      service.on('up', () => resolve(true));
      service.on('error', () => resolve(false)); // e.g. name already on the network
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

const EDGE_ROUTE_ID = 'speakeasy-deck';

/**
 * When another Caddy already owns :80 with its admin API exposed (e.g. a local
 * edge router), register a host route to our port — the vanity name then works
 * with no port in the URL. Returns a deregistration function, or null.
 */
async function registerEdgeRoute(host: string, port: number): Promise<(() => void) | null> {
  try {
    const admin = 'http://127.0.0.1:2019';
    // find the server listening on :80
    const serversRes = await fetch(`${admin}/config/apps/http/servers/`, { signal: AbortSignal.timeout(1500) });
    if (!serversRes.ok) return null;
    const servers = (await serversRes.json()) as Record<string, { listen?: string[] }>;
    const srv = Object.keys(servers).find((name) => (servers[name].listen ?? []).some((l) => l.endsWith(':80')));
    if (!srv) return null;

    // clear any stale route from a previous run so the @id never conflicts
    await fetch(`${admin}/id/${EDGE_ROUTE_ID}`, { method: 'DELETE', signal: AbortSignal.timeout(1500) }).catch(() => {});

    const res = await fetch(`${admin}/config/apps/http/servers/${srv}/routes/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        '@id': EDGE_ROUTE_ID,
        match: [{ host: [host] }],
        handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: `127.0.0.1:${port}` }] }],
        terminal: true,
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;

    return () => {
      fetch(`${admin}/id/${EDGE_ROUTE_ID}`, { method: 'DELETE', signal: AbortSignal.timeout(2000) }).catch(() => {});
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

function caddyConfig(root: string, port: number, tlsHost: string | null, caCert: string | null, live: { dataPort: number; token: string | null } | null): string {
  // Same-origin proxy to the loopback data plane — LAN clients never see the
  // data port. Open by default; --pair gates both routes behind the token.
  const gate = live?.token ? `\n\t\t@tok query k=${live.token}` : '';
  const prox = live?.token ? ' @tok' : '';
  const liveRoutes = live
    ? `
	route /ws* {${gate}
		reverse_proxy${prox} 127.0.0.1:${live.dataPort}
		respond 403
	}

	route /api/* {${gate}
		reverse_proxy${prox} 127.0.0.1:${live.dataPort}
		respond 403
	}
`
    : '';
  const caRoute = caCert
    ? `
	@cacert path /ca.crt
	handle @cacert {
		root * "${path.dirname(caCert)}"
		rewrite * /root.crt
		header Content-Type application/x-x509-ca-cert
		file_server
	}
`
    : '';
  const tlsSite = tlsHost
    ? `
https://${tlsHost} {
	tls internal
	root * ${root}
	file_server
${liveRoutes}${caRoute}
	@healthz path /healthz
	handle @healthz {
		header Content-Type application/json
		respond \`{"ok":true,"service":"speakeasy-deck","port":${port},"tls":true}\` 200
	}

	log {
		output discard
	}
}
`
    : '';
  // TLS on: keep automatic certs but not redirects — the iPad fetches /ca.crt
  // over plain HTTP before it can trust anything.
  const globalOpts = tlsHost
    ? '{\n\tadmin off\n\tauto_https disable_redirects\n}\n'
    : '{\n\tadmin off\n\tauto_https off\n}\n';
  return `${globalOpts}
http://:${port} {
	root * ${root}
	file_server
${liveRoutes}${caRoute}
	@healthz path /healthz
	handle @healthz {
		header Content-Type application/json
		respond \`{"ok":true,"service":"speakeasy-deck","port":${port}}\` 200
	}

	log {
		output discard
	}
}
${tlsSite}`;
}

/** Trust Caddy's local CA in the user's login keychain — no sudo, no prompt. */
function trustLocalCA(rootCert: string): boolean {
  if (process.platform !== 'darwin') return false;
  const keychain = path.join(os.homedir(), 'Library', 'Keychains', 'login.keychain-db');
  const found = spawnSync('security', ['find-certificate', '-c', 'Caddy Local Authority', keychain], { stdio: 'pipe' });
  if (found.status === 0) return true; // already trusted
  const added = spawnSync('security', ['add-trusted-cert', '-r', 'trustRoot', '-k', keychain, rootCert], { stdio: 'pipe' });
  return added.status === 0;
}

/** Caddy's local-CA root certificate path. When `expected` is true, returns the
 * platform default even if Caddy has not created the file yet (first run). */
function caddyRootCert(expected = false): string | undefined {
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Caddy', 'pki', 'authorities', 'local', 'root.crt'),
    path.join(os.homedir(), '.local', 'share', 'caddy', 'pki', 'authorities', 'local', 'root.crt'),
  ];
  const existing = candidates.find((p) => existsSync(p));
  return existing ?? (expected ? candidates[process.platform === 'darwin' ? 0 : 1] : undefined);
}

/** Serve via Caddy when it is installed — the same static server users get from deck/Caddyfile. */
async function startCaddy(caddy: string, root: string, port: number, tlsHost: string | null, caCert: string | null, live: { dataPort: number; token: string | null } | null): Promise<DeckHandle> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'speakeasy-deck-'));
  const config = path.join(dir, 'Caddyfile');
  await writeFile(config, caddyConfig(root, port, tlsHost, caCert, live));

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

/** Zero-dependency fallback when Caddy is not installed. Demo mode only — the
 * live data plane needs Caddy's same-origin proxy. */
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
    if (pathname === '/ca.crt') {
      const cert = caddyRootCert();
      if (cert) {
        res.writeHead(200, { 'content-type': 'application/x-x509-ca-cert', 'cache-control': 'no-store' });
        res.end(await readFile(cert));
        return;
      }
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

function parseDeckArgs(argv: string[]): { port: number | null; host: string; qr: boolean; caddy: boolean; mdns: boolean; tls: boolean; rotateToken: boolean; pair: boolean } {
  let port: number | null = null; // null = auto: 80 if free (port-free URL), else 43211
  let host = `speak.${deviceSlug()}.local`;
  let qr = true;
  let rotateToken = false;
  let pair = false;
  let caddy = true;
  let mdns = true;
  let tls = true;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') {
      const value = argv[++i];
      if (!value || !/^\d+$/.test(value)) {
        console.error('❌ --port requires a number, e.g. --port 43211');
        process.exit(1);
      }
      port = Number(value);
      if (port <= 0 || port > 65535) {
        console.error(`❌ Invalid port: ${port}`);
        process.exit(1);
      }
    } else if (arg === '--host') {
      const value = argv[++i];
      if (!value || value.startsWith('-') || !/^[a-z0-9.-]+$/.test(value)) {
        console.error('❌ --host requires a name like speak.air.local (lowercase letters, digits, dots, dashes)');
        process.exit(1);
      }
      host = value.endsWith('.local') ? value : `${value}.local`;
    } else if (arg === '--no-qr') {
      qr = false;
    } else if (arg === '--no-caddy') {
      caddy = false;
    } else if (arg === '--no-mdns') {
      mdns = false;
    } else if (arg === '--no-tls') {
      tls = false;
    } else if (arg === '--rotate-token') {
      rotateToken = true;
    } else if (arg === '--pair') {
      pair = true;
    } else {
      console.error(`❌ Unknown argument: ${arg}`);
      console.error('   Usage: speakeasy deck [--port <n>] [--host <name>] [--no-qr] [--no-caddy] [--no-mdns] [--no-tls]');
      process.exit(1);
    }
  }
  return { port, host, qr, caddy, mdns, tls, rotateToken, pair };
}

export async function runDeck(argv: string[]): Promise<void> {
  const args = parseDeckArgs(argv);
  const root = deckRoot();
  if (!existsSync(path.join(root, 'index.html'))) {
    console.error('❌ Deck assets not found at', root);
    console.error('   The deck ships with the @arach/speakeasy package — reinstall or run from the repo.');
    process.exit(1);
  }

  // Port selection. Explicit --port must be bindable — double-binding a busy
  // port routes traffic nondeterministically between the two servers. Auto
  // mode claims 80 for a port-free URL when free (macOS allows unprivileged
  // low ports), then scans 43211+ for the first verified-free port.
  let port: number;
  if (args.port !== null) {
    if (!(await portAvailable(args.port))) {
      console.error(`❌ Port ${args.port} is already in use.`);
      process.exit(1);
    }
    port = args.port;
  } else if (await portAvailable(80)) {
    port = 80;
  } else {
    port = -1;
    for (let candidate = DEFAULT_PORT; candidate < DEFAULT_PORT + 10; candidate++) {
      if (await portAvailable(candidate)) {
        port = candidate;
        break;
      }
    }
    if (port === -1) {
      console.error(`❌ No free port (80 and ${DEFAULT_PORT}–${DEFAULT_PORT + 9} are all in use) — pass --port <n>.`);
      process.exit(1);
    }
  }
  const { qr, host, mdns } = args;
  const caddy = args.caddy ? findCaddy() : null;

  // HTTPS on :443 with Caddy's local CA when we can — browsers only grant mic
  // (hold-to-speak) in a secure context. Independent of the HTTP port.
  const tlsHost = args.tls && caddy && (await portAvailable(443)) ? host : null;
  const caCert = tlsHost ? (caddyRootCert(true) ?? null) : null;

  // The data plane runs loopback-only on port+1ish; Caddy proxies /ws and
  // /api/* to it same-origin. Open on the local network by default; --pair
  // gates both routes behind the persistent capability token.
  const token = args.pair ? deckToken(args.rotateToken) : null;
  let dataPort: number | null = null;
  for (let candidate = port + 1; candidate <= Math.min(port + 5, 65535); candidate++) {
    if (await portAvailable(candidate)) {
      dataPort = candidate;
      break;
    }
  }

  let handle: DeckHandle;
  try {
    handle = caddy
      ? await startCaddy(caddy, root, port, tlsHost, caCert, dataPort ? { dataPort, token } : null)
      : await startNodeServer(root, port);
  } catch (error) {
    if (!caddy) {
      console.error('❌ Could not start the deck server:', (error as Error).message);
      process.exit(1);
    }
    console.error(`  ⚠️  Caddy failed (${(error as Error).message}) — falling back to the built-in server (demo mode only).`);
    try {
      handle = await startNodeServer(root, port);
    } catch (fallbackError) {
      console.error('❌ Built-in server also failed:', (fallbackError as Error).message);
      process.exit(1);
    }
  }

  // Live runtime — the deck reaches it through the Caddy proxy; the CLI mirror
  // uses the discovery file. Without it the deck is demo-only.
  let runtime: DeckRuntime | null = null;
  let dataPlane: DataPlane | null = null;
  if (dataPort) {
    runtime = new DeckRuntime();
    try {
      dataPlane = await startDataPlane(runtime, dataPort, token);
      writeDiscovery({ pid: process.pid, port, dataPort, host, token });
    } catch {
      dataPlane = null;
    }
  }

  const lan = lanAddress();
  const stopVanity = mdns && lan ? await advertiseVanity(host, port) : null;
  // port-free URL when an edge Caddy on :80 can host-route to us
  const stopEdge = stopVanity && port !== 80 ? await registerEdgeRoute(host, port) : null;
  const tlsUrl = stopVanity && tlsHost && handle.engine === 'caddy' ? `https://${host}` : null;
  // the CA file may only exist after Caddy's first TLS startup — re-verify before trusting
  const macTrusted = tlsUrl && caCert && existsSync(caCert) ? trustLocalCA(caCert) : false;
  const bonjour = macBonjourName();
  const padUrlBase = tlsUrl ?? (stopVanity
    ? stopEdge
      ? `http://${host}`
      : hostUrl(host, port)
    : bonjour
      ? hostUrl(bonjour, port)
      : `http://${lan ?? 'your-macs-ip'}:${port}`);
  // pair mode: the capability token travels in the URL fragment — never on the wire
  const padUrl = dataPlane && token && handle.engine === 'caddy' ? `${padUrlBase}#k=${token}` : padUrlBase;

  console.log('');
  console.log(chalk.bold('  🎛  SpeakEasy Deck'));
  console.log('');
  console.log(`  ${chalk.dim('On this Mac')}   ${hostUrl('localhost', port)}`);
  console.log(`  ${chalk.dim('On your iPad')}  ${chalk.green(chalk.bold(padUrl))}  ${chalk.dim('← same Wi-Fi, no IP needed')}`);
  if (stopVanity && bonjour) {
    console.log(`  ${chalk.dim('Fallback')}      ${hostUrl(bonjour, port)}${lan ? ` · ${hostUrl(lan, port)}` : ''}`);
  }
  console.log('');
  console.log(chalk.bold('  Set up in three steps'));
  console.log(`  ${chalk.cyan('1.')} iPad: open the URL above in Safari — or scan the code below`);
  console.log(`  ${chalk.cyan('2.')} Share → ${chalk.bold('Add to Home Screen')} for the full-screen deck`);
  console.log(`  ${chalk.cyan('3.')} Themes: ${chalk.dim('?theme=paper|ember|flight')} · Variants: ${chalk.dim('?variant=oxide')}`);
  console.log('');
  console.log(`  ${chalk.dim(`Served by ${handle.engine} · Is it running? curl ${hostUrl('localhost', port)}/healthz`)}`);
  if (tlsUrl) {
    console.log(`  ${chalk.dim('HTTPS is on (local CA, mic-ready).')}`);
    if (macTrusted) {
      console.log(`  ${chalk.green('✓')} ${chalk.dim('This Mac now trusts the CA — no action needed here.')}`);
    } else {
      console.log(`  ${chalk.dim('  This Mac: run `sudo caddy trust` once to trust the CA system-wide.')}`);
    }
    console.log(`  ${chalk.dim('  iPad, one time:')}`);
    console.log(`  ${chalk.dim(`  1. Open ${stopEdge ? `http://${host}` : hostUrl(host, port)}/ca.crt and install the profile`)}`);
    console.log(`  ${chalk.dim('  2. Settings → General → About → Certificate Trust Settings → enable "Caddy Local Authority"')}`);
  }
  console.log(`  ${chalk.dim('The deck runs its built-in demo state. Press Ctrl+C to stop.')}`);
  if (dataPlane) {
    console.log(`  ${chalk.green('✓')} ${chalk.dim(`Live runtime on :${dataPlane.dataPort} — the deck drives real synthesis; speaks from other shells mirror in.`)}`);
  } else {
    console.log(`  ${chalk.dim('Live runtime unavailable — deck runs demo state only.')}`);
  }
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
      dataPlane?.stop();
      runtime?.destroy();
      clearDiscovery();
      stopEdge?.();
      stopVanity?.();
      handle.stop();
      cleanup();
      resolve();
      setTimeout(resolve, 500).unref();
    };
    const onExit = (code: number | null) => {
      cleanup();
      dataPlane?.stop();
      runtime?.destroy();
      clearDiscovery();
      stopEdge?.();
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
