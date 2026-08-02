import { afterEach, expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

import { acquireDeckProcessLock, deckConfigDefaults, findCaddy, portAvailable, startNodeServer } from '../src/cli/deck';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('No probe port');
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return address.port;
}

test('built-in server proxies authenticated HTTP and WebSocket runtime traffic', async () => {
  const token = 'test-capability-token';
  const dataServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.searchParams.get('k') !== token) {
      res.writeHead(403).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ live: true }));
  });
  const dataWss = new WebSocketServer({ server: dataServer, path: '/ws' });
  dataWss.on('connection', (socket) => socket.send(JSON.stringify({ type: 'snapshot', lanes: 10 })));
  await new Promise<void>((resolve, reject) => {
    dataServer.once('error', reject);
    dataServer.listen(0, '127.0.0.1', resolve);
  });
  const dataAddress = dataServer.address();
  if (!dataAddress || typeof dataAddress === 'string') throw new Error('No runtime port');
  cleanups.push(() => {
    for (const socket of dataWss.clients) socket.terminate();
    dataWss.close();
    dataServer.closeAllConnections();
    dataServer.close();
  });

  const root = await mkdtemp(path.join(tmpdir(), 'speakeasy-deck-server-test-'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>Deck</title>');
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const publicPort = await freePort();
  const handle = await startNodeServer(root, publicPort, { dataPort: dataAddress.port, token });
  cleanups.push(() => {
    handle.stop();
  });

  const denied = await fetch(`http://127.0.0.1:${publicPort}/api/snapshot`);
  const allowed = await fetch(`http://127.0.0.1:${publicPort}/api/snapshot?k=${token}`);
  expect(denied.status).toBe(403);
  expect(await allowed.json()).toEqual({ live: true });

  const snapshot = await new Promise<{ type: string; lanes: number }>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${publicPort}/ws?k=${token}`, {
      origin: `http://127.0.0.1:${publicPort}`,
    });
    const timer = setTimeout(() => reject(new Error('WebSocket proxy timed out')), 2_000);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(raw)));
      socket.close();
    });
    socket.once('error', reject);
  });
  expect(snapshot).toEqual({ type: 'snapshot', lanes: 10 });
});

test('port probing rejects a loopback-only listener', async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  cleanups.push(() => server.close());
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listener port');
  expect(await portAvailable(address.port)).toBe(false);
});

test('port probing rejects privileged HTTP ports for a normal user', async () => {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    expect(await portAvailable(81)).toBe(false);
  }
});

test('deck process lock rejects a second owner and releases safely', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'speakeasy-deck-lock-test-'));
  const lockFile = path.join(root, 'deck-runtime.lock');
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const first = acquireDeckProcessLock(lockFile);
  expect(first.acquired).toBe(true);
  const second = acquireDeckProcessLock(lockFile);
  expect(second.acquired).toBe(false);
  expect(second.existingPid).toBe(process.pid);

  first.release();
  const third = acquireDeckProcessLock(lockFile);
  expect(third.acquired).toBe(true);
  third.release();
});

test('release runtime resolves the bundled Caddy helper before PATH', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'speakeasy-deck-caddy-test-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const runtime = path.join(root, 'speakeasy-runtime');
  const caddy = path.join(root, 'caddy');
  await writeFile(runtime, 'runtime');
  await writeFile(caddy, '#!/bin/sh\nexit 0\n');
  await chmod(caddy, 0o755);

  expect(findCaddy(runtime)).toBe(caddy);
});

test('pairing defaults on and preserves an explicit opt-out', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'speakeasy-deck-config-test-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const missing = path.join(root, 'missing.json');
  expect(deckConfigDefaults(missing)).toEqual({ port: null, pair: true });

  const config = path.join(root, 'settings.json');
  await writeFile(config, JSON.stringify({ deck: { port: 43211 } }));
  expect(deckConfigDefaults(config)).toEqual({ port: 43211, pair: true });
  await writeFile(config, JSON.stringify({ deck: { pair: false } }));
  expect(deckConfigDefaults(config)).toEqual({ port: null, pair: false });
});
