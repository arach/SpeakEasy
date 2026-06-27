/** @type {import('@arach/dewey').DeweyConfig} */
export default {
  project: {
    name: 'speakeasy',
    tagline: 'Unified text-to-speech library with multi-provider support',
    type: 'npm-package',
  },

  agent: {
    criticalContext: [
      'macOS only - uses `say` command and `afplay` for audio playback',
      'ElevenLabs requires voice IDs (e.g., EXAVITQu4vr4xnSDxMaL), NOT voice names',
      'Groq uses Orpheus model (canopylabs/orpheus-v1-english) with voices: tara, leah, jess, mia, zoe, leo, dan, zac',
      'Groq requires accepting model terms at console.groq.com before first use',
      'Cache is auto-enabled for API providers when keys are present',
      'Cache uses built-in SQLite (node:sqlite / bun:sqlite) — no native addons',
      'Requires Node.js >= 22.5 or Bun >= 1.0 for SQLite cache',
      'Use pnpm for package management',
    ],

    entryPoints: {
      'Source': 'src/',
      'Providers': 'src/providers/',
      'CLI': 'src/bin/speakeasy-cli.ts',
      'Types': 'src/types.ts',
      'Config': 'src/cli/config.ts',
    },

    rules: [
      { pattern: 'src/providers/*', instruction: 'Each provider implements the Provider interface from types.ts' },
      { pattern: 'src/bin/*', instruction: 'CLI entry point using commander.js' },
      { pattern: '*.test.ts', instruction: 'Tests use manual testing - run npm test' },
    ],

    sections: ['overview', 'quickstart', 'providers', 'configuration', 'cli', 'sdk'],
  },

  docs: {
    path: './docs',
    output: './',
    required: ['overview', 'quickstart', 'providers', 'configuration'],
  },
}
