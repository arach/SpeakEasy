import { expect, test } from 'bun:test';

import {
  codexProjectCwd,
  codexProjectName,
  displayCodexThreadTitle,
} from '../src/cli/codex-thread-catalog';

const state = {
  'local-projects': {
    speak: { name: 'speakeasy', rootPaths: ['/Users/arach/dev/SpeakEasy'] },
    talkie: { name: 'talkie', rootPaths: ['/Users/arach/dev/talkie'] },
  },
  'thread-project-assignments': {
    assigned: { projectId: 'talkie' },
  },
};

test('Codex project assignment wins over cwd inference', () => {
  expect(codexProjectName(state, 'assigned', '/Users/arach/dev/SpeakEasy')).toBe('talkie');
});

test('Codex project root labels direct checkouts', () => {
  expect(codexProjectName(state, 'direct', '/Users/arach/dev/SpeakEasy/deck')).toBe('speakeasy');
});

test('Codex project root labels managed worktrees by checkout leaf', () => {
  expect(codexProjectName(state, 'worktree', '/Users/arach/.codex/worktrees/befb/SpeakEasy')).toBe('speakeasy');
});

test('unknown projects keep a readable cwd fallback', () => {
  expect(codexProjectName(state, 'unknown', '/Users/arach/dev/lattices')).toBe('lattices');
});

test('project root replaces an app-server root cwd placeholder', () => {
  expect(codexProjectCwd(state, 'assigned', '/')).toBe('/Users/arach/dev/talkie');
});

test('a task-specific checkout wins over the configured project root', () => {
  expect(codexProjectCwd(state, 'assigned', '/Users/arach/.codex/worktrees/feed/talkie')).toBe(
    '/Users/arach/.codex/worktrees/feed/talkie',
  );
});

test('Scout broker envelopes display only their task subject', () => {
  const raw = '⌖ @arach → SpeakEasy-heisenberg-2 (@session-ms9b3yap-xzbrbp) · ask:xmutyz › Review the uncommitted changes in src/cli/deck-runtime.ts (run: git diff src/cli/deck-runtime.ts). delivery: routed · session: continuing session <!-- SCOUT BROKER REPLY MODE --> reply machinery';
  expect(displayCodexThreadTitle(raw)).toBe(
    'Review the uncommitted changes in src/cli/deck-runtime.ts',
  );
});

test('ordinary Codex task titles remain unchanged', () => {
  expect(displayCodexThreadTitle('Tighten the active lane identity panel')).toBe(
    'Tighten the active lane identity panel',
  );
});
