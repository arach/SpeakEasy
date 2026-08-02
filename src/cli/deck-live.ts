import { createServer, type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, renameSync, rmSync, existsSync, chmodSync, readFileSync, statSync, lstatSync, createReadStream, openSync, readSync, closeSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG_DIR } from './constants';
import { DeckRuntime, parseIntent, type DeckSnapshot } from './deck-runtime';

const DISCOVERY_FILE = path.join(CONFIG_DIR, 'deck-listener.json');
const MAX_SPEAK_BYTES = 64 * 1024;
const MAX_TRANSCRIBE_BYTES = 16 * 1024 * 1024;
const MAX_WS_PAYLOAD = 16 * 1024;
const MAX_BUFFERED = 256 * 1024;
const PLAYER_SOCKET_PATH = '/tmp/speakeasy-player.sock';

interface TranscriptionResponse {
  protocolVersion?: number;
  requestId?: string;
  ok?: boolean;
  text?: string | null;
  engine?: string;
  error?: string | null;
}

function requestLocalTranscription(audioPath: string): Promise<TranscriptionResponse> {
  return new Promise((resolve, reject) => {
    try {
      const socketInfo = lstatSync(PLAYER_SOCKET_PATH);
      if (!socketInfo.isSocket() || socketInfo.uid !== process.getuid?.() || (socketInfo.mode & 0o077) !== 0) {
        reject(new Error('LOCAL TRANSCRIBER UNAVAILABLE · OPEN SPEAKEASY'));
        return;
      }
    } catch {
      reject(new Error('LOCAL TRANSCRIBER UNAVAILABLE · OPEN SPEAKEASY'));
      return;
    }

    const requestId = randomUUID();
    const socket = createConnection(PLAYER_SOCKET_PATH);
    let settled = false;
    let body = '';
    const finish = (error?: Error, response?: TranscriptionResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error);
      else resolve(response ?? { ok: false, error: 'LOCAL TRANSCRIPTION FAILED' });
    };
    const timeout = setTimeout(() => finish(new Error('LOCAL TRANSCRIPTION TIMED OUT')), 180_000);

    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(JSON.stringify({ protocolVersion: 1, requestId, command: 'transcribe', audioPath }) + '\n');
    });
    socket.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        finish(new Error('INVALID LOCAL TRANSCRIBER RESPONSE'));
        return;
      }
      const newline = body.indexOf('\n');
      if (newline < 0) return;
      try {
        const response = JSON.parse(body.slice(0, newline)) as TranscriptionResponse;
        if (response.requestId?.toLowerCase() !== requestId.toLowerCase() || response.protocolVersion !== 1) {
          finish(new Error('INVALID LOCAL TRANSCRIBER RESPONSE'));
          return;
        }
        finish(undefined, response);
      } catch {
        finish(new Error('INVALID LOCAL TRANSCRIBER RESPONSE'));
      }
    });
    socket.on('error', () => finish(new Error('LOCAL TRANSCRIBER UNAVAILABLE · OPEN SPEAKEASY')));
    socket.on('end', () => finish(new Error('LOCAL TRANSCRIBER CLOSED EARLY')));
  });
}

export interface DataPlane {
  dataPort: number;
  token: string | null;
  stop: () => void;
}

export interface DiscoveryInfo {
  pid: number;
  port: number;
  dataPort: number;
  host: string;
  token: string | null;
  /** the exact URL a device should open — https/vanity aware, #k= when paired */
  url?: string | null;
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

function authorized(req: IncomingMessage, token: string | null): boolean {
  if (token) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.searchParams.get('k') !== token) return false;
  }
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
 * Loopback only — LAN clients reach it through the same-origin Caddy proxy.
 * Open by default (trusted local network); a token is enforced when the deck
 * is started with --pair.
 */
export async function startDataPlane(runtime: DeckRuntime, dataPort: number, token: string | null): Promise<DataPlane> {
  const clients = new Set<WebSocket>();
  // the runtime only plays through the Mac when no deck is watching
  runtime.liveClients = () => clients.size;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    // synthesized audio for connected decks — the device plays it, not the Mac
    if (url.pathname.startsWith('/audio/') && req.method === 'GET') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      let file: string;
      try {
        file = path.join(runtime.audioDir, path.basename(decodeURIComponent(url.pathname)));
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (!file.startsWith(runtime.audioDir) || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      // sniff the magic bytes — the cache stores some providers' WAV under .mp3
      const head = Buffer.alloc(12);
      const fd = openSync(file, 'r');
      readSync(fd, head, 0, 12, 0);
      closeSync(fd);
      const type =
        head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WAVE'
          ? 'audio/wav'
          : head.toString('ascii', 0, 4) === 'FORM' && ['AIFF', 'AIFC'].includes(head.toString('ascii', 8, 12))
            ? 'audio/aiff'
            : head.toString('ascii', 0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
              ? 'audio/mpeg'
              : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'content-length': statSync(file).size, 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
      return;
    }

    if (url.pathname === '/api/snapshot') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(runtime.snapshot()));
      return;
    }

    // Devices capture their own microphone as PCM WAV, then the native Mac
    // app runs the existing local Parakeet model. The bounded upload and its
    // owner-only temporary file are removed immediately after transcription.
    if (url.pathname === '/api/transcribe' && req.method === 'POST') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const contentType = String(req.headers['content-type'] ?? '').split(';', 1)[0].toLowerCase();
      const extensions: Record<string, string> = {
        'audio/wav': '.wav',
        'audio/x-wav': '.wav',
        'audio/aiff': '.aiff',
        'audio/x-aiff': '.aiff',
        'audio/mp4': '.m4a',
        'audio/m4a': '.m4a',
      };
      const extension = extensions[contentType];
      if (!extension) {
        res.writeHead(415, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'PCM WAV AUDIO REQUIRED' }));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const chunk of req as AsyncIterable<Buffer>) {
          bytes += chunk.length;
          if (bytes > MAX_TRANSCRIBE_BYTES) {
            res.writeHead(413, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'RECORDING TOO LONG' }));
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (bytes <= 44) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'EMPTY RECORDING' }));
        return;
      }

      const directory = mkdtempSync(path.join(tmpdir(), 'speakeasy-deck-transcribe-'));
      const audioPath = path.join(directory, `capture${extension}`);
      try {
        chmodSync(directory, 0o700);
        writeFileSync(audioPath, Buffer.concat(chunks), { mode: 0o600 });
        chmodSync(audioPath, 0o600);
        const response = await requestLocalTranscription(audioPath);
        const ok = response.ok === true && typeof response.text === 'string' && response.text.trim().length > 0;
        res.writeHead(ok ? 200 : 422, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({
          ok,
          text: ok ? response.text!.trim() : undefined,
          engine: response.engine ?? 'parakeet',
          error: ok ? undefined : (response.error || 'NO SPEECH DETECTED'),
        }));
      } catch (error) {
        res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'LOCAL TRANSCRIPTION FAILED' }));
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
      return;
    }

    // Management channel: the same intents the deck sends over the WS, for
    // trusted local tools (the settings app's Deck tab). Bare intent objects,
    // schema-validated by the same parseIntent as the socket path.
    if (url.pathname === '/api/intent' && req.method === 'POST') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const chunk of req as AsyncIterable<Buffer>) {
          bytes += chunk.length;
          if (bytes > MAX_WS_PAYLOAD) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        // client aborted mid-upload — nothing to parse, nothing to apply
        res.writeHead(400).end();
        return;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'bad json' }));
        return;
      }
      const { intent, error } = parseIntent(raw);
      const result = intent
        ? await runtime.apply(intent)
        : { ok: false as const, rev: runtime.snapshot().rev, error: error ?? 'invalid intent' };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/speak' && req.method === 'POST') {
      if (!authorized(req, token)) {
        res.writeHead(403).end();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const chunk of req as AsyncIterable<Buffer>) {
          bytes += chunk.length;
          if (bytes > MAX_SPEAK_BYTES) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        res.writeHead(400).end();
        return;
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
      if (token) {
        const url = new URL(info.req.url ?? '/', 'http://localhost');
        if (url.searchParams.get('k') !== token) return done(false, 403, 'Forbidden');
      }
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
