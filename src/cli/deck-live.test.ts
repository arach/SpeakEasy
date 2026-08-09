import { afterEach, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { createConnection, type Socket } from 'node:net';
import { startDataPlane, type DataPlane } from './deck-live';
import { DeckRuntime } from './deck-runtime';

const runtimes: DeckRuntime[] = [];
const planes: DataPlane[] = [];
const sockets: Socket[] = [];

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.destroy();
  for (const plane of planes.splice(0)) plane.stop();
  for (const runtime of runtimes.splice(0)) runtime.destroy();
});

async function eventually(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition did not become true');
    await Bun.sleep(10);
  }
}

describe('deck data plane heartbeat', () => {
  test('evicts an open client that stops answering pings', async () => {
    const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
    runtimes.push(runtime);
    const plane = await startDataPlane(runtime, 0, null, { heartbeatIntervalMs: 25 });
    planes.push(plane);

    // A raw upgraded socket models the half-open mobile connection precisely:
    // it remains TCP-open but has no WebSocket runtime left to answer pings.
    const socket = createConnection(plane.dataPort, '127.0.0.1');
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => {
        socket.write([
          'GET /ws HTTP/1.1',
          `Host: 127.0.0.1:${plane.dataPort}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
      });
      socket.once('data', (data) => {
        if (data.toString('latin1').includes('101 Switching Protocols')) resolve();
        else reject(new Error('websocket upgrade failed'));
      });
      socket.once('error', reject);
    });

    expect(runtime.snapshot().clients).toBe(1);
    await eventually(() => runtime.snapshot().clients === 0);
    expect(runtime.snapshot().clients).toBe(0);
  });
});
