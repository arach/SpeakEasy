'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseCompletionRecord,
  isTerminalRecord,
  observationMessages,
} = require('../Sources/SpeakEasy/Resources/codex-desktop-bridge.cjs');

const taskID = '019f99a4-7867-7c23-ac29-0c0eca7da603';

test('bridge parser ignores progress and accepts only terminal final responses', () => {
  const progress = { type: 'event_msg', payload: { type: 'agent_message', turn_id: 'turn-1', message: 'partial' } };
  assert.equal(isTerminalRecord(progress), false);
  assert.equal(parseCompletionRecord(progress, taskID), null);

  const complete = {
    type: 'event_msg',
    timestamp: '2026-08-01T12:00:00.000Z',
    payload: { type: 'task_complete', turn_id: 'turn-1', last_agent_message: 'Final answer' },
  };
  assert.equal(isTerminalRecord(complete), true);
  assert.deepEqual(parseCompletionRecord(complete, taskID), {
    taskID,
    turnID: 'turn-1',
    response: 'Final answer',
    completedAt: '2026-08-01T12:00:00.000Z',
  });
});

test('bridge parser keeps exact task identity independent of response text', () => {
  const record = {
    type: 'event_msg',
    payload: { type: 'turn_completed', turn_id: 'turn-2', final_response: 'Same title' },
  };
  assert.equal(parseCompletionRecord(record, taskID).taskID, taskID);
  assert.equal(parseCompletionRecord(record, 'different-task').taskID, 'different-task');
});

test('completion observation commits its cursor atomically with the event', () => {
  const provenance = { owner: 'codex-desktop', rolloutIdentity: 'rollout-1' };
  const complete = {
    type: 'event_msg',
    timestamp: '2026-08-01T12:00:00.000Z',
    payload: { type: 'task_complete', turn_id: 'turn-3', last_agent_message: 'Done' },
  };
  const observations = observationMessages(complete, taskID, 900, provenance);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].type, 'completion');
  assert.equal(observations[0].cursor, 900);
  assert.equal(observations[0].provenance, provenance);

  const failed = {
    type: 'event_msg',
    payload: { type: 'task_failed', turn_id: 'turn-4' },
  };
  assert.deepEqual(observationMessages(failed, taskID, 950, provenance), [{
    type: 'cursor',
    taskID,
    turnID: 'turn-4',
    cursor: 950,
  }]);
});
