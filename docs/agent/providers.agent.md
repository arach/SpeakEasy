# Providers (Agent Reference)

## Provider Matrix

| Provider | Model | Default Voice | API Key Env | Endpoint |
|----------|-------|---------------|-------------|----------|
| system | macOS `say` | Samantha | N/A | Local |
| openai | tts-1 | nova | OPENAI_API_KEY | api.openai.com/v1/audio/speech |
| elevenlabs | eleven_monolingual_v1 | EXAVITQu4vr4xnSDxMaL | ELEVENLABS_API_KEY | api.elevenlabs.io/v1/text-to-speech/{voiceId} |
| groq | canopylabs/orpheus-v1-english | tara | GROQ_API_KEY | api.groq.com/openai/v1/audio/speech |
| gemini | gemini-2.5-flash-preview-tts | Puck | GEMINI_API_KEY | Google AI SDK |

## Voice Lists

### OpenAI
`alloy` | `echo` | `fable` | `onyx` | `nova` | `shimmer`

### Groq (Orpheus)
`tara` | `leah` | `jess` | `mia` | `zoe` | `leo` | `dan` | `zac`

### ElevenLabs
Uses voice IDs, not names. Default: `EXAVITQu4vr4xnSDxMaL`
Get IDs: https://elevenlabs.io/app/voice-library

### System (macOS)
Run `say -v ?` for full list. Common: `Samantha`, `Alex`, `Victoria`, `Daniel`

## Provider Files

| File | Class | Constructor |
|------|-------|-------------|
| src/providers/system.ts | SystemProvider | (voice: string) |
| src/providers/openai.ts | OpenAIProvider | (apiKey, voice, instructions?) |
| src/providers/elevenlabs.ts | ElevenLabsProvider | (apiKey, voiceId) |
| src/providers/groq.ts | GroqProvider | (apiKey, voice) |
| src/providers/gemini.ts | GeminiProvider | (apiKey, model) |

## Config Properties

| Provider | Voice Config | Other Config |
|----------|--------------|--------------|
| system | systemVoice | - |
| openai | openaiVoice | instructions |
| elevenlabs | elevenlabsVoiceId | - |
| groq | groqVoice | - |
| gemini | geminiModel | - |

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 401 | Invalid API key | Check/set API key |
| 404 | Invalid voice/endpoint | Use valid voice ID |
| 400 | Bad request | Check parameters |
| 429 | Rate limited | Wait and retry |

## Groq Special Notes

- Requires terms acceptance: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
- 200 char limit per request
- No speed parameter

## ElevenLabs Special Notes

- Voice names don't work, must use voice IDs
- Default voice ID is Rachel: EXAVITQu4vr4xnSDxMaL
