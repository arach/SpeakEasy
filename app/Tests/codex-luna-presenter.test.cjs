'use strict';

const assert = require('node:assert/strict');
const { chmod, mkdtemp, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const bridge = path.resolve(__dirname, '../Sources/SpeakEasy/Resources/codex-luna-presenter.cjs');

async function fakeCodex(directory, ephemeral = true) {
  const executable = path.join(directory, 'fake-codex.cjs');
  const source = `#!/usr/bin/env node
'use strict';
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
const send = (value) => process.stdout.write(JSON.stringify(value) + '\\n');
rl.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') {
    send({ id: message.id, result: { userAgent: 'fake' } });
  } else if (message.method === 'thread/start') {
    const p = message.params;
    if (p.model !== 'gpt-5.6-luna' || p.ephemeral !== true || p.sandbox !== 'read-only' || p.approvalPolicy !== 'never') {
      send({ id: message.id, error: { message: 'unsafe thread configuration' } });
    } else {
      send({ id: message.id, result: { thread: { id: 'presenter-thread', ephemeral: ${ephemeral} } } });
    }
  } else if (message.method === 'turn/start') {
    const p = message.params;
    if (p.model !== 'gpt-5.6-luna' || p.effort !== 'low' || p.sandboxPolicy?.type !== 'readOnly' || !p.outputSchema) {
      send({ id: message.id, error: { message: 'unsafe turn configuration' } });
      return;
    }
    const payload = JSON.parse(p.input[0].text);
    send({ id: message.id, result: { turn: { id: 'presenter-turn' } } });
    setTimeout(() => {
      send({ method: 'item/completed', params: { turnId: 'presenter-turn', item: { id: 'answer', type: 'agentMessage', text: JSON.stringify({ spokenText: 'Short spoken update.' }) } } });
      send({ method: 'turn/completed', params: { turn: { id: 'presenter-turn', status: 'completed' } } });
      if (payload.task.id !== 'task-1' || payload.task.turnId !== 'turn-1') process.exitCode = 2;
    }, 5);
  }
});
`;
  await writeFile(executable, source);
  await chmod(executable, 0o700);
  return executable;
}

function invoke(executable) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bridge, executable], {
      env: { ...process.env, SPEAKEASY_CODEX_BIN: executable },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify({
      taskID: 'task-1',
      turnID: 'turn-1',
      taskTitle: 'Canonical task',
      projectPath: '/tmp/project',
      response: 'The implementation is complete and all tests pass.',
    }));
  });
}

test('uses a separate ephemeral Luna thread with no action surface', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'speakeasy-luna-'));
  const result = await invoke(await fakeCodex(directory));
  const envelope = JSON.parse(result.stdout.trim());

  assert.equal(result.code, 0, result.stderr);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.ephemeral, true);
  assert.equal(envelope.model, 'gpt-5.6-luna');
  assert.equal(envelope.sourceTaskID, 'task-1');
  assert.equal(envelope.sourceTurnID, 'turn-1');
  assert.equal(envelope.spokenText, 'Short spoken update.');
});

test('fails closed if the presenter thread is not ephemeral', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'speakeasy-luna-'));
  const result = await invoke(await fakeCodex(directory, false));
  const envelope = JSON.parse(result.stdout.trim());

  assert.notEqual(result.code, 0);
  assert.equal(envelope.ok, false);
  assert.match(envelope.error, /ephemeral presenter thread/i);
});
