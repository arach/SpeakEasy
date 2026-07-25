#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const MAX_FRAME_BYTES = 256 * 1024 * 1024;
const FOLLOW_VERSION = 1;
const STREAM_VERSION = 11;
const START_TURN_VERSION = 1;
const STEER_TURN_VERSION = 1;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const TURN_TIMEOUT_MS = 30 * 60_000;

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function writeResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function fail(message, code = 'bridge-failed') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function listTasks(limit) {
  const database = path.join(codexHome(), 'state_5.sqlite');
  const catalogDatabase = path.join(codexHome(), 'sqlite', 'codex-dev.db');
  if (!fs.existsSync(database) || !fs.existsSync(catalogDatabase)) {
    fail('Codex task catalog is unavailable.', 'catalog-unavailable');
  }
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const escapedCatalogDatabase = catalogDatabase.replaceAll("'", "''");
  const query = `
    ATTACH DATABASE '${escapedCatalogDatabase}' AS desktop_catalog;
    SELECT
      state.id AS id,
      COALESCE(
        NULLIF(catalog.display_title, ''),
        NULLIF(state.name, ''),
        NULLIF(SUBSTR(REPLACE(state.preview, CHAR(10), ' '), 1, 96), ''),
        'Untitled task'
      ) AS title,
      COALESCE(state.preview, '') AS preview,
      state.cwd AS cwd,
      CASE WHEN state.updated_at_ms > 0 THEN state.updated_at_ms / 1000.0 ELSE state.updated_at END AS updatedAt
    FROM threads AS state
    LEFT JOIN desktop_catalog.local_thread_catalog AS catalog
      ON catalog.host_id = 'local' AND catalog.thread_id = state.id AND catalog.missing_candidate = 0
    WHERE
      state.archived = 0
    ORDER BY state.recency_at_ms DESC, state.updated_at_ms DESC
    LIMIT ${boundedLimit};
  `;
  const output = execFileSync('/usr/bin/sqlite3', ['-readonly', '-json', database, query], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(output || '[]');
}

function assertPrivateCodexSocket(socketPath) {
  const socket = fs.lstatSync(socketPath);
  const directory = fs.lstatSync(path.dirname(socketPath));
  if (!socket.isSocket() || socket.uid !== process.getuid()) {
    fail('Codex Desktop IPC socket is not owned by this user.', 'unsafe-socket');
  }
  if (!directory.isDirectory() || directory.uid !== process.getuid() || (directory.mode & 0o022) !== 0) {
    fail('Codex Desktop IPC directory is not private.', 'unsafe-socket');
  }
}

function assertRolloutPath(rolloutPath, threadId) {
  const sessionsRoot = path.resolve(codexHome(), 'sessions');
  const resolved = path.resolve(rolloutPath);
  if (!resolved.startsWith(`${sessionsRoot}${path.sep}`) || !path.basename(resolved).includes(threadId)) {
    fail('Codex Desktop returned an unsafe task transcript path.', 'unsafe-rollout-path');
  }
  const info = fs.lstatSync(resolved);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid()) {
    fail('Codex task transcript is not a private user-owned file.', 'unsafe-rollout-path');
  }
  return resolved;
}

function latestActiveTurnId(rolloutPath) {
  const size = fs.statSync(rolloutPath).size;
  const maximumScan = 32 * 1024 * 1024;
  const start = Math.max(0, size - maximumScan);
  const descriptor = fs.openSync(rolloutPath, 'r');
  let text;
  try {
    const data = Buffer.allocUnsafe(size - start);
    fs.readSync(descriptor, data, 0, data.length, start);
    text = data.toString('utf8');
  } finally {
    fs.closeSync(descriptor);
  }
  if (start > 0) text = text.slice(text.indexOf('\n') + 1);

  let activeTurnId = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    const payload = record?.type === 'event_msg' ? record.payload : null;
    if (payload?.type === 'task_started' && typeof payload.turn_id === 'string') {
      activeTurnId = payload.turn_id;
    } else if (
      ['task_complete', 'task_failed', 'turn_aborted'].includes(payload?.type) &&
      payload?.turn_id === activeTurnId
    ) {
      activeTurnId = null;
    }
  }
  return activeTurnId;
}

function frame(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  if (body.length === 0 || body.length > MAX_FRAME_BYTES) fail('Desktop IPC message is too large.');
  const output = Buffer.allocUnsafe(body.length + 4);
  output.writeUInt32LE(body.length, 0);
  body.copy(output, 4);
  return output;
}

class DesktopIPCClient {
  constructor(threadId) {
    this.threadId = threadId;
    this.socketPath = path.join(codexHome(), 'ipc', 'ipc.sock');
    this.clientId = 'initializing-client';
    this.ownerClientId = null;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.snapshotWaiter = null;
  }

  async connect() {
    assertPrivateCodexSocket(this.socketPath);
    this.socket = net.connect(this.socketPath);
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (error) => this.rejectAll(error));
    this.socket.on('close', () => this.rejectAll(new Error('Codex Desktop IPC connection closed.')));
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });
    const initialized = await this.request('initialize', { clientType: 'speakeasy' }, {
      allowUninitialized: true,
      version: 0,
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
    });
    if (initialized.resultType !== 'success' || typeof initialized.result?.clientId !== 'string') {
      fail('Codex Desktop rejected the SpeakEasy bridge.', 'desktop-unavailable');
    }
    this.clientId = initialized.result.clientId;
  }

  async follow() {
    const snapshotPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.snapshotWaiter = null;
        reject(Object.assign(
          new Error('Open the locked task in Codex Desktop, then try the hotkey again.'),
          { code: 'task-owner-unavailable' },
        ));
      }, SNAPSHOT_TIMEOUT_MS);
      this.snapshotWaiter = {
        resolve: (snapshot) => {
          clearTimeout(timer);
          this.snapshotWaiter = null;
          resolve(snapshot);
        },
        reject,
      };
    });
    this.broadcast('thread-stream-following-changed', {
      conversationId: this.threadId,
      hostId: 'local',
      following: true,
    }, FOLLOW_VERSION);
    return snapshotPromise;
  }

  async startTurn(text, ownerClientId) {
    const response = await this.request('thread-follower-start-turn', {
      conversationId: this.threadId,
      turnStartParams: {
        input: [{ type: 'text', text, text_elements: [] }],
        attachments: [],
      },
    }, {
      targetClientId: ownerClientId,
      version: START_TURN_VERSION,
      timeoutMs: 30_000,
    });
    if (response.resultType !== 'success') {
      fail(`Codex Desktop could not start the turn: ${response.error || 'unknown error'}`, 'turn-start-failed');
    }
    const turnId = response.result?.result?.turn?.id;
    if (typeof turnId !== 'string' || turnId.length === 0) {
      fail('Codex Desktop returned an unreadable turn response.', 'protocol-mismatch');
    }
    return turnId;
  }

  async steerTurn(text, ownerClientId, state) {
    const clientUserMessageId = randomUUID();
    const context = {
      prompt: text,
      workspaceRoots: state.cwd ? [state.cwd] : [],
      collaborationMode: state.latestCollaborationMode || null,
      commentAttachments: [],
      imageAttachments: [],
      fileAttachments: [],
      pastedTextAttachments: [],
      addedFiles: [],
      appshotContexts: [],
      mcpAppModelContextAttachments: [],
    };
    const response = await this.request('thread-follower-steer-turn', {
      conversationId: this.threadId,
      input: [{ type: 'text', text, text_elements: [] }],
      restoreMessage: {
        id: clientUserMessageId,
        text,
        context,
        cwd: state.cwd || '/',
        createdAt: Date.now(),
      },
      serviceTier: null,
      attachments: [],
      clientUserMessageId,
    }, {
      targetClientId: ownerClientId,
      version: STEER_TURN_VERSION,
      timeoutMs: 30_000,
    });
    if (response.resultType !== 'success') {
      fail(`Codex Desktop could not steer the active turn: ${response.error || 'unknown error'}`, 'turn-steer-failed');
    }
  }

  broadcast(method, params, version) {
    this.send({
      type: 'broadcast',
      method,
      sourceClientId: this.clientId,
      params,
      version,
    });
  }

  request(method, params, options = {}) {
    if (!options.allowUninitialized && this.clientId === 'initializing-client') {
      fail('Desktop IPC client is not initialized.', 'desktop-unavailable');
    }
    const requestId = randomUUID();
    const timeoutMs = options.timeoutMs || 5_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(Object.assign(new Error(`Timed out waiting for ${method}.`), { code: 'desktop-timeout' }));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      this.send({
        type: 'request',
        requestId,
        sourceClientId: this.clientId,
        targetClientId: options.targetClientId,
        version: options.version || 0,
        method,
        params,
        timeoutMs,
      });
    });
  }

  send(message) {
    if (!this.socket?.writable) fail('Codex Desktop IPC is not connected.', 'desktop-unavailable');
    this.socket.write(frame(message));
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length === 0 || length > MAX_FRAME_BYTES) {
        this.rejectAll(new Error(`Invalid Desktop IPC frame length: ${length}`));
        this.socket?.destroy();
        return;
      }
      if (this.buffer.length < length + 4) return;
      const message = JSON.parse(this.buffer.subarray(4, length + 4).toString('utf8'));
      this.buffer = this.buffer.subarray(length + 4);
      this.onMessage(message);
    }
  }

  onMessage(message) {
    if (message.type === 'response') {
      const waiter = this.pending.get(message.requestId);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.pending.delete(message.requestId);
        waiter.resolve(message);
      }
      return;
    }
    if (message.type !== 'broadcast' || message.method !== 'thread-stream-state-changed') return;
    if (message.version !== STREAM_VERSION) {
      this.snapshotWaiter?.reject(Object.assign(
        new Error('Codex Desktop task streaming protocol changed; update SpeakEasy.'),
        { code: 'protocol-mismatch' },
      ));
      this.snapshotWaiter = null;
      return;
    }
    const { params } = message;
    if (
      params?.hostId !== 'local' ||
      params?.conversationId !== this.threadId ||
      params?.change?.type !== 'snapshot'
    ) return;
    this.ownerClientId = message.sourceClientId;
    this.snapshotWaiter?.resolve({
      ownerClientId: message.sourceClientId,
      state: params.change.conversationState,
    });
  }

  rejectAll(error) {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.pending.clear();
    this.snapshotWaiter?.reject(error);
    this.snapshotWaiter = null;
  }

  close() {
    if (this.clientId !== 'initializing-client' && this.socket?.writable) {
      this.broadcast('thread-stream-following-changed', {
        conversationId: this.threadId,
        hostId: 'local',
        following: false,
      }, FOLLOW_VERSION);
    }
    this.socket?.end();
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForTurn(rolloutPath, offset, turnId) {
  const descriptor = fs.openSync(rolloutPath, 'r');
  let position = offset;
  let pending = '';
  const deadline = Date.now() + TURN_TIMEOUT_MS;
  try {
    while (Date.now() < deadline) {
      const size = fs.fstatSync(descriptor).size;
      if (size > position) {
        const chunk = Buffer.allocUnsafe(Math.min(size - position, 1024 * 1024));
        const count = fs.readSync(descriptor, chunk, 0, chunk.length, position);
        position += count;
        pending += chunk.subarray(0, count).toString('utf8');
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) {
          if (!line) continue;
          let record;
          try { record = JSON.parse(line); } catch { continue; }
          const payload = record?.payload;
          if (record?.type !== 'event_msg' || !payload) continue;
          if (payload.type === 'task_complete' && payload.turn_id === turnId) {
            const response = String(payload.last_agent_message || '').trim();
            if (!response) fail('Codex completed without a final answer.', 'empty-response');
            return response;
          }
          if (
            (payload.type === 'task_failed' || payload.type === 'turn_aborted') &&
            payload.turn_id === turnId
          ) {
            fail(payload.message || 'The Codex turn failed.', 'turn-failed');
          }
        }
      }
      await sleep(150);
    }
  } finally {
    fs.closeSync(descriptor);
  }
  fail('Timed out waiting for the Codex response.', 'turn-timeout');
}

async function withClient(threadId, action) {
  const client = new DesktopIPCClient(threadId);
  try {
    await client.connect();
    const snapshot = await client.follow();
    return await action(client, snapshot);
  } finally {
    client.close();
  }
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === 'list') {
    writeResult({ ok: true, tasks: listTasks(argument) });
    return;
  }
  if ((command === 'validate' || command === 'submit') && argument) {
    const result = await withClient(argument, async (client, snapshot) => {
      const state = snapshot.state || {};
      const rolloutPath = assertRolloutPath(state.rolloutPath, argument);
      if (state.id !== argument) fail('Codex Desktop returned the wrong task.', 'task-mismatch');
      if (command === 'validate') {
        return {
          ok: true,
          task: { id: state.id, title: state.title || 'Untitled task', cwd: state.cwd || '' },
        };
      }
      const text = (await readStdin()).trim();
      if (!text) fail('The transcript is empty.', 'empty-transcript');
      const offset = fs.statSync(rolloutPath).size;
      const taskIsActive = state?.threadRuntimeStatus?.type === 'active';
      const activeTurnId = taskIsActive ? latestActiveTurnId(rolloutPath) : null;
      if (taskIsActive && !activeTurnId) {
        fail('Codex Desktop reports an active task without a correlatable turn.', 'protocol-mismatch');
      }
      let turnId;
      let delivery;
      if (activeTurnId) {
        await client.steerTurn(text, snapshot.ownerClientId, state);
        turnId = activeTurnId;
        delivery = 'steered-active-turn';
      } else {
        turnId = await client.startTurn(text, snapshot.ownerClientId);
        delivery = 'started-turn';
      }
      const response = await waitForTurn(rolloutPath, offset, turnId);
      return { ok: true, threadId: argument, turnId, delivery, response };
    });
    writeResult(result);
    return;
  }
  fail('Usage: codex-desktop-bridge.cjs list [limit] | validate <task-id> | submit <task-id>', 'usage');
}

main().catch((error) => {
  writeResult({
    ok: false,
    code: error?.code || 'bridge-failed',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
