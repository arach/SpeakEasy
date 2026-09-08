import { describe, expect, test } from 'bun:test';

import { describeCanonicalFailure, parseIntent, resolveDeckTurnRoute } from './deck-runtime';

describe('Deck turn authority', () => {
  test('routes a bound worker pad to its exact canonical Codex task', () => {
    expect(resolveDeckTurnRoute(2, '  task-123  ')).toEqual({
      kind: 'canonical',
      taskId: 'task-123',
    });
  });

  test('refuses an unassigned worker pad instead of creating a session', () => {
    expect(resolveDeckTurnRoute(2)).toEqual({ kind: 'unassigned' });
    expect(resolveDeckTurnRoute(2, '   ')).toEqual({ kind: 'unassigned' });
  });

  test('reserves the hidden model transport for the overview role', () => {
    expect(resolveDeckTurnRoute(9, 'ignored-worker-task')).toEqual({ kind: 'overview' });
  });

  test('routes an operator-created deck thread to the deck-owned session', () => {
    expect(resolveDeckTurnRoute(2, undefined, 'deck')).toEqual({ kind: 'deck', index: 2 });
  });

  test('a deck thread keeps its own transport once it has a thread id', () => {
    // The session adapter records a codex thread id for a deck thread as soon
    // as it answers. Routing that id through the Desktop bridge would hang
    // forever, because no Codex Desktop window owns it.
    expect(resolveDeckTurnRoute(2, 'deck-thread-id', 'deck')).toEqual({
      kind: 'deck',
      index: 2,
    });
  });

  test('a codex-bound lane that lost its task never falls back to a session', () => {
    // The regression 38ed6d6 fixed: a failed bind must stay refused, not
    // quietly become a shadow app-server session.
    expect(resolveDeckTurnRoute(2, undefined, 'codex')).toEqual({ kind: 'unassigned' });
    expect(resolveDeckTurnRoute(2, '   ', 'codex')).toEqual({ kind: 'unassigned' });
  });

  test('accepts a new-thread intent from the Deck picker', () => {
    expect(parseIntent({ name: 'lane.new', index: 3 }).intent).toEqual({
      name: 'lane.new',
      index: 3,
    });
    expect(parseIntent({ name: 'lane.new', index: 9 }).intent).toBeUndefined();
  });

  test('accepts an atomic assign-and-activate intent from the Deck picker', () => {
    expect(parseIntent({
      name: 'lane.assign',
      index: 0,
      threadId: 'task-123',
      activate: true,
    }).intent).toEqual({
      name: 'lane.assign',
      index: 0,
      threadId: 'task-123',
      activate: true,
    });
  });
});

describe('Canonical failure diagnosis', () => {
  test('a refused socket names the app that is down, not the errno', () => {
    const why = describeCanonicalFailure(
      'connect ECONNREFUSED /Users/arach/.codex/ipc/ipc.sock',
    );
    expect(why).toContain('Codex Desktop is not running');
    // The operator hears this. A path and an errno are not instructions.
    expect(why).not.toContain('ECONNREFUSED');
    expect(why).not.toContain('.sock');
  });

  test('a missing socket is a different fault from a refused one', () => {
    const missing = describeCanonicalFailure(
      'connect ENOENT /Users/arach/.codex/ipc/ipc.sock',
    );
    expect(missing).toContain('never opened its bridge');
    expect(missing).not.toEqual(
      describeCanonicalFailure('connect ECONNREFUSED /Users/arach/.codex/ipc/ipc.sock'),
    );
  });

  test('an unowned task still says to open it, not to start the app', () => {
    const why = describeCanonicalFailure('task-owner-unavailable');
    expect(why).toContain('No Codex Desktop window owns that task');
    expect(why).not.toContain('is not running');
  });

  test('an unrecognised fault reports itself rather than inventing a cause', () => {
    expect(describeCanonicalFailure('stream closed mid-frame')).toContain(
      'stream closed mid-frame',
    );
  });
});

describe('Owner handshake timeout', () => {
  test('a warm timeout is reported as an unowned task, not as slowness', () => {
    const why = describeCanonicalFailure(
      'Timed out warming the exact Codex task after 9000ms.',
    );
    expect(why).toContain('No Codex Desktop window owns that task');
    // "Timed out" invites waiting, and waiting never fixes this one.
    expect(why).not.toMatch(/timed out/i);
  });
});
