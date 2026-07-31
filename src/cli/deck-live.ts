import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG_DIR } from './constants';
import { DeckRuntime, type DeckSnapshot } from './deck-runtime';

const DISCOVERY_FILE = path.join(CONFIG_DIR, 'deck-listener.json');
const MAX_SPEAK_BYTES = 64 * 1024;

export interface DataPlane {
  dataPort: number;
  stop: () => void;
}

/** Let other processes (the speak CLI) find a running deck listener. */
export function writeDiscovery(info: { pid: number; port: number; dataPort: number; host: string }): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(DISCOVERY_FILE, JSON.stringify(info));
  } catch {
    // discovery is best-effort
  }
}

export function clearDiscovery(): void {
  try {
    if (existsSync(DISCOVERY_FILE)) rmSync(DISCOVERY_FILE);
  } catch {
    // best-effort
  }
}

/**
 * The deck's data plane: WebSocket intents/snapshots for the deck client,
 * plus a small HTTP API so the speak CLI can mirror narration into the deck.
 * Always a plain Node server — Caddy only serves the static deck files.
 */
export async function startDataPlane(runtime: DeckRuntime, dataPort: number): Promise<DataPlane> {
  const clients = new Set<WebSocket>();

  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/api/snapshot') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(runtime.snapshot()));
      return;
    }

    if (url.pathname === '/api/speak' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > MAX_SPEAK_BYTES) {
          res.writeHead(413).end();
          return;
        }
      }
      try {
        const { text, lane, play } = JSON.parse(body) as { text?: unknown; lane?: unknown; play?: unknown };
        if (typeof text !== 'string' || !text.trim()) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'text required' }));
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

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify(runtime.snapshot()));
    ws.on('message', (data) => {
      void (async () => {
        let msg: { type?: unknown; name?: unknown; id?: unknown };
        try {
          msg = JSON.parse(String(data));
        } catch {
          return;
        }
        if (msg?.type === 'intent' && typeof msg.name === 'string') {
          const result = await runtime.apply(msg as never);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ack', id: msg.id ?? null, ...result }));
          }
        }
      })();
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  runtime.on('changed', (snap: DeckSnapshot) => {
    const payload = JSON.stringify(snap);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(dataPort, '0.0.0.0', () => resolve());
  });

  return {
    dataPort,
    stop: () => {
      for (const ws of clients) ws.terminate();
      wss.close();
      server.close();
    },
  };
}
