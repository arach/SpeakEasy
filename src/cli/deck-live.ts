import { createServer, type IncomingMessage } from 'node:http';
import { mkdirSync, writeFileSync, renameSync, rmSync, existsSync, chmodSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG_DIR } from './constants';
import { DeckRuntime, parseIntent, type DeckSnapshot } from './deck-runtime';

const DISCOVERY_FILE = path.join(CONFIG_DIR, 'deck-listener.json');
const MAX_SPEAK_BYTES = 64 * 1024;
const MAX_WS_PAYLOAD = 16 * 1024;
const MAX_BUFFERED = 256 * 1024;

export interface DataPlane {
  dataPort: number;
  token: string;
  stop: () => void;
}

export interface DiscoveryInfo {
  pid: number;
  port: number;
  dataPort: number;
  host: string;
  token: string;
}

/** Atomic, owner-only discovery so the speak CLI can find (and authenticate to) a running deck. */
export function writeDiscovery(info: DiscoveryInfo): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    const tmp = `${DISCOVERY_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(info), { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, DISCOVERY_FILE);
  } catch {
    // discovery is best-effort
  }
}

/** Only remove the file if it is still ours — a newer deck instance must not lose its record. */
export function clearDiscovery(): void {
  try {
    if (!existsSync(DISCOVERY_FILE)) return;
    const info = JSON.parse(readFileSync(DISCOVERY_FILE, 'utf8')) as { pid?: number };
    if (info.pid === process.pid) rmSync(DISCOVERY_FILE);
  } catch {
    // best-effort
  }
}

function authorized(req: IncomingMessage, token: string): boolean {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.searchParams.get('k') !== token) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * The deck's data plane: WebSocket intents/snapshots for the deck client,
 * plus a small HTTP API so the speak CLI can mirror narration into the deck.
 * Loopback only — LAN clients reach it through the same-origin Caddy proxy,
 * which carries the per-run token.
 */
export async function startDataPlane(runtime: DeckRuntime, dataPort: number, token: string): Promise<DataPlane> {
  const clients = new Set<WebSocket>();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/api/snapshot') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(runtime.snapshot()));
      return;
    }

    if (url.pathname === '/api/speak' && req.method === 'POST') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req as AsyncIterable<Buffer>) {
        bytes += chunk.length;
        if (bytes > MAX_SPEAK_BYTES) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      try {
        const { text, lane, play } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          text?: unknown;
          lane?: unknown;
          play?: unknown;
        };
        if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'text required (1–4000 chars)' }));
          return;
        }
        const laneIx = typeof lane === 'number' && Number.isInteger(lane) ? lane : undefined;
        void runtime.narrate(text.trim(), laneIx ?? runtime.snapshot().lane, play === true);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'bad json' }));
      }
      return;
    }

    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: MAX_WS_PAYLOAD,
    verifyClient: (info, done) => {
      const url = new URL(info.req.url ?? '/', 'http://localhost');
      if (url.searchParams.get('k') !== token) return done(false, 403, 'Forbidden');
      const origin = info.req.headers.origin;
      if (origin) {
        try {
          if (new URL(origin).host !== info.req.headers.host) return done(false, 403, 'Forbidden');
        } catch {
          return done(false, 403, 'Forbidden');
        }
      }
      done(true);
    },
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify(runtime.snapshot()));
    ws.on('message', (data) => {
      void (async () => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(data));
        } catch {
          return;
        }
        const envelope = raw as { type?: unknown; id?: unknown };
        if (envelope?.type !== 'intent') return;
        const { intent, error } = parseIntent(raw);
        const result = intent
          ? await runtime.apply(intent)
          : { ok: false as const, rev: runtime.snapshot().rev, error: error ?? 'invalid intent' };
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ack', id: typeof envelope.id === 'number' ? envelope.id : null, ...result }));
        }
      })();
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  runtime.on('changed', (snap: DeckSnapshot) => {
    const payload = JSON.stringify(snap);
    for (const ws of clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      // never let a slow client stall the runtime
      if (ws.bufferedAmount > MAX_BUFFERED) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      ws.send(payload);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(dataPort, '127.0.0.1', () => resolve());
  });

  return {
    dataPort,
    token,
    stop: () => {
      for (const ws of clients) ws.terminate();
      wss.close();
      server.close();
    },
  };
}
