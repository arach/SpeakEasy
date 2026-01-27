# Add Voice Notifications to Project

Task template for integrating SpeakEasy voice notifications into a project.

## Objective

Add voice notifications to development workflows for build, test, and deployment events.

## Prerequisites

- Node.js project with package.json
- SpeakEasy installed (`pnpm add @arach/speakeasy`)
- API key configured (optional, system voice works without)

## Steps

### 1. Install SpeakEasy

```bash
pnpm add @arach/speakeasy
# or
npm install @arach/speakeasy
```

### 2. Configure API Keys (Optional)

For higher quality voices:

```bash
# Set environment variable
export OPENAI_API_KEY=sk-your-key

# Or use CLI
speakeasy --set-key openai YOUR_KEY
```

### 3. Add to npm Scripts

In `package.json`:

```json
{
  "scripts": {
    "build": "tsc && speakeasy 'Build complete'",
    "build:fail": "tsc || speakeasy 'Build failed'",
    "test": "vitest && speakeasy 'All tests passed'",
    "test:fail": "vitest || speakeasy 'Tests failed'",
    "dev": "speakeasy 'Starting dev server' && vite",
    "deploy": "pnpm build && speakeasy 'Deploying' && deploy-cmd && speakeasy 'Deployed'"
  }
}
```

### 4. Programmatic Integration

Create `scripts/notify.ts`:

```typescript
import { say, SpeakEasy } from '@arach/speakeasy';

// Simple notification
export async function notify(message: string) {
  await say(message, 'system');
}

// With priority
export async function notifyUrgent(message: string) {
  const speaker = new SpeakEasy({
    provider: 'openai',
    volume: 0.9,
  });
  await speaker.speak(message, { priority: 'high', interrupt: true });
}

// Cached notifications (faster repeat plays)
const speaker = new SpeakEasy({
  provider: 'openai',
  cache: { enabled: true, ttl: '7d' }
});

export async function notifyCached(message: string) {
  await speaker.speak(message);
}
```

### 5. Add to Build Tools

**Vite plugin:**

```typescript
// vite.config.ts
import { say } from '@arach/speakeasy';

export default {
  plugins: [
    {
      name: 'notify',
      buildEnd() {
        say('Build complete');
      }
    }
  ]
}
```

**Webpack plugin:**

```javascript
// webpack.config.js
const { say } = require('@arach/speakeasy');

module.exports = {
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.done.tap('NotifyPlugin', () => {
          say('Webpack build complete');
        });
      }
    }
  ]
}
```

### 6. Git Hooks

Create `.git/hooks/post-commit`:

```bash
#!/bin/bash
speakeasy "Commit created" --provider system
```

Create `.git/hooks/pre-push`:

```bash
#!/bin/bash
speakeasy "Pushing to remote" --provider system
```

Make executable:
```bash
chmod +x .git/hooks/post-commit .git/hooks/pre-push
```

### 7. CI/CD Integration

**GitHub Actions:**

```yaml
- name: Notify on success
  if: success()
  run: |
    npm install -g @arach/speakeasy
    speakeasy "Deployment successful" --provider system
```

### 8. Claude Code Hooks

Add to `.claude/hooks.json`:

```json
{
  "hooks": {
    "onTaskComplete": "speakeasy 'Task done'",
    "onError": "speakeasy 'Error occurred' --volume 0.9"
  }
}
```

## Configuration Options

### Voice Selection

```bash
# System (instant, no API)
speakeasy "Message" --provider system --voice Alex

# OpenAI (high quality)
speakeasy "Message" --provider openai --voice nova

# Groq (fast + good quality)
speakeasy "Message" --provider groq --voice tara
```

### Volume Control

```bash
# Quiet (30%)
speakeasy "Message" --volume 0.3

# Loud (90%)
speakeasy "Message" --volume 0.9
```

### Caching

Enable caching for repeated messages:

```bash
speakeasy "Build started" --cache --provider openai
```

## Done When

- [ ] SpeakEasy installed
- [ ] API keys configured (if using API providers)
- [ ] npm scripts updated with notifications
- [ ] Git hooks added (optional)
- [ ] Build tool integration working (optional)
- [ ] Notifications playing correctly
