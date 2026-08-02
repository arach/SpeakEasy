import { describe, expect, test } from 'bun:test';

import { resolveDeckTurnRoute } from './deck-runtime';

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
});
