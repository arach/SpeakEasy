import { describe, expect, test } from 'bun:test';
import { writeFile, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { herdrChannelId, turnHerdrChannel, type HerdrBinding, type HerdrRequest } from './herdr-channel';
import { resolveDeckTurnRoute } from './deck-runtime';

const binding: HerdrBinding = {
  socketPath: '/tmp/herdr-test.sock',
  agent: { pane_id: 'w1:p1', terminal_id: 'terminal-one', agent: 'claude', agent_status: 'idle',
    agent_session: { agent: 'claude', kind: 'id', value: 'conversation-one', source: 'integration' } },
};
function receipt(text: string) {
  const file = JSON.parse(text.match(/UTF-8 JSON to ("[^\n]+?")\./)![1]) as string;
  const id = JSON.parse(text.match(/Use this shape: (\{[^\n]+?\})\./)![1]).requestId as string;
  return { file, id };
}

describe('Herdr voice channel', () => {
  test('keeps transport and identity separate from Codex, even after restore', () => {
    const id = herdrChannelId(binding);
    expect(resolveDeckTurnRoute(0, id, 'herdr')).toEqual({ kind: 'herdr', channelId: id });
    expect(resolveDeckTurnRoute(0, id)).toEqual({ kind: 'herdr', channelId: id });
    expect(resolveDeckTurnRoute(0, undefined, 'herdr')).toEqual({ kind: 'unassigned' });
    expect(resolveDeckTurnRoute(0, 'some-codex-task', 'herdr')).toEqual({ kind: 'unassigned' });
    expect(herdrChannelId({ ...binding, socketPath: '/another-machine/socket' })).not.toBe(id);
  });

  test('reads only the matching final answer and removes its temporary file', async () => {
    let output = '';
    let sends = 0;
    const request: HerdrRequest = async (_socket, method, params) => {
      if (method === 'agent.get') return { agent: binding.agent };
      sends++;
      expect(params.target).toBe(binding.agent.pane_id);
      expect(params.wait).toEqual({ until: ['idle', 'done', 'blocked'], timeout_ms: 180000 });
      const { file, id } = receipt(String(params.text));
      output = file;
      await writeFile(file, JSON.stringify({ requestId: id, text: 'The requested work is complete.' }));
      return { agent: { ...binding.agent, agent_status: 'done' } };
    };
    expect(await turnHerdrChannel(binding, 'Check the build', { request })).toBe('The requested work is complete.');
    expect(sends).toBe(1);
    expect(existsSync(output)).toBe(false);
  });

  test.each(['working', 'blocked', 'unknown'] as const)('refuses %s before sending', async status => {
    let sends = 0;
    const request: HerdrRequest = async (_s, method) => {
      if (method !== 'agent.get') sends++;
      return { agent: { ...binding.agent, agent_status: status } };
    };
    await expect(turnHerdrChannel(binding, 'Hello', { request })).rejects.toThrow('busy or needs attention');
    expect(sends).toBe(0);
  });

  test('refuses replacement conversations before sending', async () => {
    const request: HerdrRequest = async () => ({ agent: { ...binding.agent,
      agent_session: { ...binding.agent.agent_session!, value: 'replacement' } } });
    await expect(turnHerdrChannel(binding, 'Hello', { request })).rejects.toThrow('conversation changed');
  });

  test('requires session identity rather than assuming a reused terminal is the same chat', async () => {
    const unidentified = { ...binding, agent: { ...binding.agent, agent_session: null } };
    const request: HerdrRequest = async () => ({ agent: unidentified.agent });
    await expect(turnHerdrChannel(unidentified, 'Hello', { request })).rejects.toThrow('no conversation identity');
  });

  test.each(['missing', 'wrong-id', 'symlink', 'oversize'] as const)('rejects %s reply without resending', async mode => {
    let sends = 0;
    const request: HerdrRequest = async (_s, method, params) => {
      if (method === 'agent.get') return { agent: binding.agent };
      sends++;
      const { file, id } = receipt(String(params.text));
      if (mode === 'wrong-id') await writeFile(file, JSON.stringify({ requestId: 'old', text: 'Old answer' }));
      if (mode === 'symlink') await symlink('/etc/hosts', file);
      if (mode === 'oversize') await writeFile(file, JSON.stringify({ requestId: id, text: 'x'.repeat(140000) }));
      return { agent: { ...binding.agent, agent_status: 'done' } };
    };
    await expect(turnHerdrChannel(binding, 'Hello', { request })).rejects.toThrow('complete voice reply');
    expect(sends).toBe(1);
  });

  test('does not accept a response from a replacement agent or an approval dialog', async () => {
    for (const agent of [
      { ...binding.agent, terminal_id: 'replacement' },
      { ...binding.agent, agent_status: 'blocked' as const },
    ]) {
      const request: HerdrRequest = async (_s, method) => ({ agent: method === 'agent.get' ? binding.agent : agent });
      await expect(turnHerdrChannel(binding, 'Hello', { request })).rejects.toThrow();
    }
  });
});

describe('Herdr socket transport', () => {
  test('uses explicit target and correlates fragmented UTF-8 responses', async () => {
    const { createServer } = await import('node:net');
    const { mkdtemp, chmod, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { herdrRequest } = await import('./herdr-channel');
    const dir = await mkdtemp(join(tmpdir(), 'se-herdr-test-'));
    const socketPath = join(dir, 'api.sock');
    const server = createServer(socket => {
      socket.once('data', data => {
        const req = JSON.parse(data.toString());
        expect(req.method).toBe('agent.get');
        expect(req.params.target).toBe('w1:p1');
        const result = Buffer.from(JSON.stringify({ id: req.id, result: { text: 'réponse' } }) + '\n');
        const split = result.indexOf(Buffer.from('é')) + 1;
        socket.write(result.subarray(0, split));
        setTimeout(() => socket.end(result.subarray(split)), 5);
      });
    });
    try {
      await new Promise<void>(resolve => server.listen(socketPath, resolve));
      await chmod(socketPath, 0o600);
      expect(await herdrRequest(socketPath, 'agent.get', { target: 'w1:p1' })).toEqual({ text: 'réponse' });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test('restores a Herdr lane without reading Codex history or duplicating its binding', async () => {
  const { DeckRuntime } = await import('./deck-runtime');
  const { deckAgentRuntimeDir } = await import('./deck-agent-client');
  const { randomUUID } = await import('node:crypto');
  const { mkdir, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const key = 'speakeasy-herdr-test-' + randomUUID();
  const dir = deckAgentRuntimeDir(key);
  let reads = 0;
  const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false, taskTailRead: () => {
    reads++;
    return { ok: false, code: 'UNEXPECTED', message: 'Herdr must not read Codex history' };
  } });
  const internal = runtime as any;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'herdr-channel.json'), JSON.stringify(binding));
    internal.persistLaneKeys = () => {};
    internal.laneKeys = Array.from({ length: 9 }, (_, i) => i < 2 ? key : key + '-' + i);
    internal.lanes.forEach((lane: any) => { lane.threadId = undefined; lane.origin = undefined; });
    reads = 0; // Ignore constructor hydration of the user's pre-existing Codex lanes.
    internal.restoreLaneBindings();
    expect(runtime.snapshot().lanes[0]).toMatchObject({ origin: 'herdr', threadId: herdrChannelId(binding) });
    expect(runtime.snapshot().lanes[1].threadId).toBeUndefined();
    internal.syncLaneTaskTail(0);
    expect(reads).toBe(0);
  } finally {
    runtime.destroy();
    await rm(dir, { recursive: true, force: true });
  }
});
