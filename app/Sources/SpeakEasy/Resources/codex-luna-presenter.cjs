#!/usr/bin/env node
'use strict';

// SpeakEasy's presentation model runs in its own Codex app-server process.
// Every presentation uses an ephemeral thread, so it cannot create or resume a
// user-visible Codex task. The parent process receives one JSON object on stdin
// and this bridge emits one JSON envelope on stdout.

const { spawn } = require('node:child_process');
const { accessSync, constants } = require('node:fs');
const { homedir } = require('node:os');

const MODEL = 'gpt-5.6-luna';
const TIMEOUT_MS = 20_000;
const SYSTEM_PROMPT = [
  "You are SpeakEasy's read-only speech presenter.",
  'Turn a completed Codex response into a concise spoken update.',
  'Preserve the actual outcome, failures, decisions, and next action. Do not add facts.',
  'Do not execute tools, inspect files, browse, send messages, or modify the source task.',
  'Use plain spoken language: at most three short sentences and 80 words.',
  'Omit markdown, code, raw URLs, commit hashes, and implementation noise unless essential.',
  'Return only the requested JSON object.',
].join(' ');

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['spokenText'],
  properties: {
    spokenText: { type: 'string', minLength: 1, maxLength: 900 },
  },
};

function writeEnvelope(envelope) {
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
}

function fail(message, code = 'presenter_failed') {
  writeEnvelope({ ok: false, code, error: String(message || 'Luna presenter failed.') });
  process.exitCode = 1;
}

function executable(path) {
  if (!path) return false;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveCodex() {
  const candidates = [
    process.env.SPEAKEASY_CODEX_BIN,
    process.env.CODEX_BIN,
    process.argv[2],
    '/Applications/ChatGPT.app/Contents/Resources/codex',
    '/Applications/Codex.app/Contents/Resources/codex',
    `${homedir()}/.local/bin/codex`,
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
  ];
  return candidates.find(executable);
}

function safeString(value, limit) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, limit);
}

function parseInput(raw) {
  const input = JSON.parse(raw);
  const taskID = safeString(input.taskID, 128);
  const turnID = safeString(input.turnID, 128);
  const taskTitle = safeString(input.taskTitle, 240);
  const projectPath = safeString(input.projectPath, 1024);
  const response = safeString(input.response, 80_000);
  if (!taskID || !turnID || !response) throw new Error('Presenter input is incomplete.');
  return { taskID, turnID, taskTitle, projectPath, response };
}

function requestPayload(input) {
  return JSON.stringify({
    task: {
      id: input.taskID,
      turnId: input.turnID,
      title: input.taskTitle,
      projectPath: input.projectPath,
    },
    canonicalResponse: input.response,
  });
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const codex = resolveCodex();
  if (!codex) throw Object.assign(new Error('Codex is unavailable for Luna presentation.'), { code: 'codex_unavailable' });
  const input = parseInput(await readStdin());
  const child = spawn(codex, ['app-server', '--stdio'], {
    cwd: '/tmp',
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let nextID = 1;
  let stdoutBuffer = '';
  let stderr = '';
  let threadID;
  let turnID;
  let finalText = '';
  const pending = new Map();

  const stop = () => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  };
  const timer = setTimeout(() => {
    for (const { reject } of pending.values()) reject(new Error('Luna presenter timed out.'));
    pending.clear();
    completedReject(new Error('Luna presenter timed out.'));
    stop();
  }, TIMEOUT_MS);

  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const notify = (method, params) => send({ method, ...(params ? { params } : {}) });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextID++;
    pending.set(id, { resolve, reject });
    send({ id, method, params });
  });

  let completedResolve;
  let completedReject;
  const completed = new Promise((resolve, reject) => {
    completedResolve = resolve;
    completedReject = reject;
  });

  const handleMessage = (message) => {
    if (Object.prototype.hasOwnProperty.call(message, 'id')
      && (Object.prototype.hasOwnProperty.call(message, 'result')
        || Object.prototype.hasOwnProperty.call(message, 'error'))) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message || 'Codex app-server request failed.'));
      else waiter.resolve(message.result);
      return;
    }

    // No presenter tool is supported. Reject any app-server request instead of
    // letting this presentation-only process acquire an action surface.
    if (Object.prototype.hasOwnProperty.call(message, 'id') && message.method) {
      send({ id: message.id, error: { code: -32000, message: 'SpeakEasy presenter tools are disabled.' } });
      return;
    }

    if (message.method === 'item/agentMessage/delta'
      && message.params?.turnId === turnID
      && typeof message.params?.delta === 'string') {
      finalText += message.params.delta;
      return;
    }
    if (message.method === 'item/completed'
      && message.params?.turnId === turnID
      && message.params?.item?.type === 'agentMessage'
      && typeof message.params.item.text === 'string') {
      finalText = message.params.item.text;
      return;
    }
    if (message.method === 'turn/completed' && message.params?.turn?.id === turnID) {
      const status = message.params.turn.status;
      if (status === 'completed') completedResolve();
      else completedReject(new Error(message.params.turn.error?.message || `Luna presenter turn ${status}.`));
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk;
    while (true) {
      const newline = stdoutBuffer.indexOf('\n');
      if (newline < 0) break;
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      try { handleMessage(JSON.parse(line)); } catch { /* ignore non-protocol output */ }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-8_000); });
  child.once('error', (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    completedReject(error);
  });
  child.once('exit', (code) => {
    const error = new Error(stderr.trim() || `Presenter app-server exited (${code ?? 'signal'}).`);
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    completedReject(error);
  });

  try {
    await request('initialize', {
      clientInfo: { name: 'speakeasy-presenter', title: 'SpeakEasy Presenter', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    notify('initialized');

    const started = await request('thread/start', {
      cwd: '/tmp',
      approvalPolicy: 'never',
      sandbox: 'read-only',
      model: MODEL,
      baseInstructions: SYSTEM_PROMPT,
      developerInstructions: SYSTEM_PROMPT,
      ephemeral: true,
    });
    threadID = started?.thread?.id;
    if (!threadID || started?.thread?.ephemeral !== true) {
      throw new Error('Codex did not establish an ephemeral presenter thread.');
    }

    const turn = await request('turn/start', {
      threadId: threadID,
      cwd: '/tmp',
      model: MODEL,
      effort: 'low',
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'readOnly', networkAccess: false },
      input: [{ type: 'text', text: requestPayload(input), text_elements: [] }],
      outputSchema: OUTPUT_SCHEMA,
    });
    turnID = turn?.turn?.id;
    if (!turnID) throw new Error('Codex did not start a Luna presenter turn.');
    await completed;

    const parsed = JSON.parse(finalText.trim());
    const spokenText = safeString(parsed.spokenText, 900);
    if (!spokenText) throw new Error('Luna returned an empty spoken presentation.');
    writeEnvelope({
      ok: true,
      spokenText,
      model: MODEL,
      ephemeral: true,
      sourceTaskID: input.taskID,
      sourceTurnID: input.turnID,
    });
  } finally {
    clearTimeout(timer);
    stop();
  }
}

main().catch((error) => fail(error?.message, error?.code));
