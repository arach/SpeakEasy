# Add New TTS Provider

Task template for adding a new TTS provider to SpeakEasy.

## Objective

Add a new TTS provider that integrates with SpeakEasy's provider abstraction.

## Prerequisites

- Provider API documentation
- API key for the provider
- Understanding of the Provider interface

## Steps

### 1. Create Provider File

Create `src/providers/{provider-name}.ts`:

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Provider, ProviderConfig } from '../types';

export class {ProviderName}Provider implements Provider {
  private apiKey: string;
  private voice: string;

  constructor(apiKey: string = '', voice: string = 'default-voice') {
    this.apiKey = apiKey;
    this.voice = voice;
  }

  async speak(config: ProviderConfig): Promise<void> {
    const audioBuffer = await this.generateAudio(config);
    if (audioBuffer) {
      const tempFile = path.join(config.tempDir, `speech_${Date.now()}.mp3`);
      fs.writeFileSync(tempFile, audioBuffer);

      const volume = config.volume !== undefined ? config.volume : 0.7;
      const volumeFlag = volume !== 1.0 ? ` -v ${volume}` : '';
      execSync(`afplay${volumeFlag} "${tempFile}"`);

      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  async generateAudio(config: ProviderConfig): Promise<Buffer | null> {
    if (!this.apiKey) {
      throw new Error('{ProviderName} API key is required');
    }

    // Implement API call here
    const response = await fetch('https://api.provider.com/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: config.text,
        voice: this.voice,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  getErrorMessage(error: any): string {
    return `{ProviderName} TTS failed: ${error.message}`;
  }
}
```

### 2. Update Types

Add to `src/types.ts`:

```typescript
// In SpeakEasyConfig
{providerName}Voice?: string;

// In provider union
provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini' | '{providerName}';

// In apiKeys
{providerName}?: string;
```

### 3. Register Provider

In `src/index.ts`:

```typescript
// Import
import { {ProviderName}Provider } from './providers/{providerName}';

// In initializeProviders()
this.providers.set('{providerName}', new {ProviderName}Provider(
  this.config.apiKeys?.{providerName} || '',
  this.config.{providerName}Voice || 'default-voice'
));
```

### 4. Add CLI Support

In `src/bin/speakeasy-cli.ts`, add case in voice switch:

```typescript
case '{providerName}':
  config.{providerName}Voice = options.voice;
  break;
```

### 5. Update Constants

In `src/cli/constants.ts`:

```typescript
// Add to PROVIDERS array
{ name: '{ProviderName}', key: '{providerName}', env: '{PROVIDERNAME}_API_KEY' },

// Add to DEFAULT_VOICES
{providerName}: 'default-voice',
```

### 6. Add Documentation

Create `docs/providers/{providerName}.md` with:
- Setup instructions
- Available voices
- Configuration options
- Usage examples

## Verification

```bash
# Build
pnpm build

# Test with API key
export {PROVIDERNAME}_API_KEY=your-key
speakeasy "Hello" --provider {providerName}
```

## Done When

- [ ] Provider file created and implements Provider interface
- [ ] Types updated with new config options
- [ ] Provider registered in SpeakEasy class
- [ ] CLI handles --voice for new provider
- [ ] Constants updated with defaults
- [ ] Documentation added
- [ ] Manual test passes
