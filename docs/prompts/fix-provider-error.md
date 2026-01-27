# Fix Provider Error

Task template for debugging and fixing TTS provider errors.

## Objective

Diagnose and fix errors when a TTS provider fails.

## Common Error Patterns

### 401 Unauthorized

**Cause:** Invalid or missing API key

**Fix:**
```bash
# Check if key is set
echo $OPENAI_API_KEY | head -c 10

# Set key
export OPENAI_API_KEY=sk-your-key

# Or add to config
speakeasy --set-key openai YOUR_KEY
```

### 404 Not Found

**Cause:** Invalid endpoint or resource ID

**For ElevenLabs:** Using voice name instead of voice ID
```bash
# Wrong
speakeasy "Hello" --provider elevenlabs --voice nova

# Correct
speakeasy "Hello" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL
```

### 400 Bad Request

**Cause:** Invalid request parameters

**Debug steps:**
1. Check the error message for details
2. Verify voice name is valid for provider
3. Check rate/speed parameter is in valid range

**For Groq:** Model terms not accepted
```
Visit: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
Accept terms, then retry
```

### 429 Rate Limited

**Cause:** Too many requests

**Fix:**
```bash
# Wait and retry
sleep 60
speakeasy "Hello" --provider openai

# Or use fallback
speakeasy "Hello" --provider system
```

### Network Errors

**Cause:** Connection issues

**Debug:**
```bash
# Test connectivity
curl -I https://api.openai.com

# Check with debug mode
speakeasy "Hello" --provider openai --debug
```

## Debugging Steps

### 1. Run Health Check

```bash
speakeasy --doctor
```

Look for:
- API key status
- Provider configuration
- Voice settings

### 2. Enable Debug Mode

```bash
speakeasy "Hello" --provider openai --debug
```

Shows:
- Provider selection
- Voice and rate settings
- Cache operations
- Error details

### 3. Check Configuration

```bash
speakeasy --config
speakeasy --diagnose
```

### 4. Test System Voice

```bash
speakeasy "Hello" --provider system
```

If system works, the issue is with the API provider.

### 5. Check Provider-Specific Issues

**OpenAI:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**ElevenLabs:**
```bash
curl https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: $ELEVENLABS_API_KEY"
```

**Groq:**
```bash
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

## Fix Implementation

### Update Error Handling

In `src/providers/{provider}.ts`:

```typescript
if (!response.ok) {
  const errorBody = await response.text().catch(() => '');

  if (response.status === 401) {
    throw new Error('Invalid API key');
  } else if (response.status === 404) {
    throw new Error(`Resource not found: ${errorBody}`);
  } else if (response.status === 400) {
    throw new Error(`Bad request: ${errorBody}`);
  } else if (response.status === 429) {
    throw new Error('Rate limit exceeded');
  }

  throw new Error(`API error ${response.status}: ${errorBody}`);
}
```

### Add User-Friendly Messages

In `getErrorMessage()`:

```typescript
getErrorMessage(error: any): string {
  if (error.message.includes('Invalid API key')) {
    return '🔑 Invalid API key. Get yours at: https://...';
  }
  if (error.message.includes('Rate limit')) {
    return '⏰ Rate limit exceeded. Try again later.';
  }
  return `Provider failed: ${error.message}`;
}
```

## Done When

- [ ] Error identified and understood
- [ ] Root cause fixed (API key, config, or code)
- [ ] Error message improved if needed
- [ ] Manual test passes
