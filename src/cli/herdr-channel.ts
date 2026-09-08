import { createConnection } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { constants, existsSync, lstatSync, readdirSync } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const agentSchema = z.object({
  pane_id: z.string().min(1), terminal_id: z.string().min(1),
  agent: z.string().nullable().optional(), display_agent: z.string().nullable().optional(),
  name: z.string().nullable().optional(), title: z.string().nullable().optional(),
  terminal_title_stripped: z.string().nullable().optional(),
  cwd: z.string().nullable().optional(), foreground_cwd: z.string().nullable().optional(),
  agent_status: z.enum(['idle', 'working', 'blocked', 'done', 'unknown']),
  agent_session: z.object({ agent: z.string(), kind: z.enum(['id', 'path']), value: z.string(), source: z.string() }).nullable().optional(),
});
export type HerdrAgent = z.infer<typeof agentSchema>;
export const herdrBindingSchema = z.object({
  socketPath: z.string().min(1), agent: agentSchema,
});
export type HerdrBinding = z.infer<typeof herdrBindingSchema>;
export type HerdrRequest = (socketPath: string, method: string, params: Record<string, unknown>, options?: { signal?: AbortSignal; timeoutMs?: number }) => Promise<any>;

export function herdrSocketPath(): string {
  return process.env.SPEAKEASY_HERDR_SOCKET?.trim()
    || path.join(homedir(), '.config', 'herdr', 'herdr.sock');
}

/** Explicit, owner-only local socket; never use the currently focused pane. */
export const herdrRequest: HerdrRequest = (socketPath, method, params, options = {}) => new Promise((resolve, reject) => {
  try {
    const stat = lstatSync(socketPath);
    if (!stat.isSocket() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
      throw new Error('Herdr connection must be a private socket owned by this user.');
    }
  } catch { reject(new Error('Herdr is unavailable. Open Herdr on this Mac, then refresh channels.')); return; }
  if (options.signal?.aborted) { reject(new Error('Herdr reply capture was cancelled. The agent may still be working.')); return; }
  const id = randomUUID();
  const socket = createConnection(socketPath);
  socket.setEncoding('utf8');
  let buffer = '';
  let settled = false;
  const finish = (error?: Error, result?: unknown) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    socket.destroy();
    if (error) reject(error); else resolve(result);
  };
  const abort = () => finish(new Error('Herdr reply capture was cancelled. The agent may still be working.'));
  const timer = setTimeout(() => finish(new Error('Herdr did not finish in time. Check the agent before sending again.')), options.timeoutMs ?? 5000);
  options.signal?.addEventListener('abort', abort, { once: true });
  socket.on('connect', () => socket.write(JSON.stringify({ id, method, params }) + '\n'));
  socket.on('data', chunk => {
    buffer += chunk.toString('utf8');
    if (buffer.length > 2 * 1024 * 1024) { finish(new Error('Herdr returned an oversized response.')); return; }
    const newline = buffer.indexOf('\n');
    if (newline < 0) return;
    try {
      const envelope = JSON.parse(buffer.slice(0, newline));
      if (envelope.id !== id) throw new Error('Herdr returned a mismatched response.');
      if (envelope.error) throw new Error('Herdr could not complete the request. Check its agent pane before sending again.');
      if (!envelope.result) throw new Error('Herdr returned an empty response.');
      finish(undefined, envelope.result);
    } catch (error) { finish(error as Error); }
  });
  socket.on('error', () => finish(new Error('Herdr disconnected. Check the agent before sending again.')));
  socket.on('end', () => finish(new Error('Herdr closed the connection before confirming the result.')));
});

export function herdrChannelId(binding: HerdrBinding): string {
  // A pane is a location, not a conversation. Include both process and session identity.
  const { agent } = binding;
  return 'herdr:' + createHash('sha256').update(JSON.stringify([
    binding.socketPath, agent.pane_id, agent.terminal_id, agent.agent, agent.agent_session ?? null,
  ])).digest('hex').slice(0, 40);
}

export function herdrSocketPaths(): string[] {
  const explicit = process.env.SPEAKEASY_HERDR_SOCKET?.trim();
  if (explicit) return [explicit];
  const root = path.join(homedir(), '.config', 'herdr');
  const sockets = [herdrSocketPath()];
  try {
    for (const entry of readdirSync(path.join(root, 'sessions'), { withFileTypes: true })) {
      if (entry.isDirectory()) sockets.push(path.join(root, 'sessions', entry.name, 'herdr.sock'));
    }
  } catch { /* No named sessions yet. */ }
  return sockets.filter(socket => existsSync(socket));
}

export async function listHerdrChannels(request: HerdrRequest = herdrRequest): Promise<HerdrBinding[]> {
  const sockets = herdrSocketPaths();
  const results = await Promise.allSettled(sockets.map(async socketPath => {
    const result = await request(socketPath, 'agent.list', {});
    return z.array(agentSchema).parse(result.agents).map(agent => ({ socketPath, agent }));
  }));
  // An offline or older named server must not hide agents on healthy servers.
  if (results.length && results.every(result => result.status === 'rejected')) {
    throw new Error('Herdr sessions are unavailable. Check Herdr and refresh channels.');
  }
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}

export function assertSameHerdrAgent(binding: HerdrBinding, agent: HerdrAgent): void {
  if (herdrChannelId(binding) !== herdrChannelId({ ...binding, agent })) {
    throw new Error('The Herdr conversation changed. Select its channel again before speaking.');
  }
}

/** An explicit final-answer file avoids narrating prompts, tools, spinners, or old scrollback. */
export async function turnHerdrChannel(binding: HerdrBinding, text: string, options: {
  signal?: AbortSignal; timeoutMs?: number; request?: HerdrRequest;
} = {}): Promise<string> {
  const request = options.request ?? herdrRequest;
  const current = agentSchema.parse((await request(binding.socketPath, 'agent.get', { target: binding.agent.pane_id }, options)).agent);
  assertSameHerdrAgent(binding, current);
  if (!current.agent_session?.value) throw new Error('This Herdr agent has no conversation identity. Enable its Herdr session integration, then select it again.');
  if (current.agent_status !== 'idle' && current.agent_status !== 'done') {
    throw new Error('This Herdr agent is busy or needs attention. Finish that interaction before speaking.');
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'speakeasy-herdr-'));
  const responsePath = path.join(dir, 'reply.json');
  const requestId = randomUUID();
  try {
    const prompt = text + '\n\nSpeakEasy voice reply: respond directly to the message above. For microphone or connectivity tests, give only a brief acknowledgement and do not resume unrelated project work. After completing this request, write your final answer as UTF-8 JSON to ' + JSON.stringify(responsePath)
      + '. Use this shape: ' + JSON.stringify({ requestId, text: 'Your final answer as plain text' })
      + '. Include only the final answer in text, without terminal output or tool logs. Write the file once the answer is complete. This file is on the same Mac as this agent.';
    const result = await request(binding.socketPath, 'agent.prompt', {
      target: current.name || current.pane_id, text: prompt,
      wait: { until: ['idle', 'done', 'blocked'], timeout_ms: options.timeoutMs ?? 180000 },
    }, { signal: options.signal, timeoutMs: (options.timeoutMs ?? 180000) + 5000 });
    const after = agentSchema.parse(result.agent);
    assertSameHerdrAgent(binding, after);
    if (after.agent_status !== 'idle' && after.agent_status !== 'done') {
      throw new Error('The Herdr agent needs attention. Open its pane to continue.');
    }
    if (options.signal?.aborted) throw new Error('Herdr reply capture was cancelled. The agent may still be working.');
    let file;
    try {
      file = await open(responsePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 128 * 1024 || stat.uid !== process.getuid?.()) throw new Error('Invalid reply file');
      const reply = z.object({ requestId: z.literal(requestId), text: z.string().trim().min(1).max(32000) }).parse(JSON.parse(await file.readFile('utf8')));
      return reply.text;
    } catch {
      throw new Error('The Herdr agent did not provide a complete voice reply. Read its answer in Herdr; SpeakEasy has not retried the request.');
    } finally { await file?.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
}
