# Troubleshooting Guide

Comprehensive troubleshooting guide for common SpeakEasy issues, with step-by-step solutions and diagnostic tools.

## Quick Diagnostics

### Health Check Commands

```bash
# Comprehensive health check
speakeasy --doctor

# Configuration diagnostics  
speakeasy --diagnose

# Current configuration
speakeasy --config

# Debug mode
speakeasy "test message" --debug
```

## Common Issues

### 1. "No text provided to speak"

**Problem:** CLI shows error about missing text
**Cause:** Text parameter not provided correctly

**Solutions:**
```bash
# ❌ Incorrect - missing text
speakeasy --provider openai

# ✅ Correct - positional text
speakeasy "Hello world" --provider openai

# ✅ Correct - explicit text flag
speakeasy --text "Hello world" --provider openai
```

### 2. API Key Issues

#### "OpenAI API key is required"

**Cause:** Missing or invalid OpenAI API key

**Solutions:**
```bash
# Set environment variable
export OPENAI_API_KEY="sk-your-key-here"

# Add to shell profile
echo 'export OPENAI_API_KEY="sk-your-key-here"' >> ~/.zshrc
source ~/.zshrc

# Add to global config
mkdir -p ~/.config/speakeasy
echo '{
  "providers": {
    "openai": {
      "apiKey": "sk-your-key-here"
    }
  }
}' > ~/.config/speakeasy/settings.json
```

**Verify API key:**
```bash
# Check environment variable
echo $OPENAI_API_KEY

# Should start with "sk-"
echo $OPENAI_API_KEY | head -c 3  # Should show "sk-"

# Test API key
speakeasy "test openai" --provider openai --debug
```

#### "ElevenLabs API key required"

**Solutions:**
```bash
# Set environment variable
export ELEVENLABS_API_KEY="your-elevenlabs-key"

# Add to config
echo '{
  "providers": {
    "elevenlabs": {
      "apiKey": "your-elevenlabs-key"
    }
  }
}' > ~/.config/speakeasy/settings.json
```

#### "Groq API key required"

**Solutions:**
```bash
# Set environment variable  
export GROQ_API_KEY="gsk_your-groq-key"

# Groq keys start with "gsk_"
echo $GROQ_API_KEY | head -c 4  # Should show "gsk_"
```

### 3. System Voice Issues

#### "System TTS failed" (macOS)

**Cause:** Missing `say` or `afplay` commands

**Diagnostics:**
```bash
# Check if commands exist
which say
which afplay

# Test say command directly
say "Hello world"

# List available voices
say -v ?
```

**Solutions:**
```bash
# On macOS, these should be built-in
# If missing, check macOS installation

# Use specific voice
speakeasy "Hello" --provider system --voice Alex

# Check system integrity
sudo /usr/sbin/system_profiler SPAudioDataType
```

#### Non-macOS Systems

**Problem:** System voice only works on macOS
**Solution:** Use API providers instead

```bash
# Use OpenAI instead of system
speakeasy "Hello" --provider openai

# Set OpenAI as default
echo '{
  "defaults": {
    "provider": "openai",
    "fallbackOrder": ["openai", "groq"]
  }
}' > ~/.config/speakeasy/settings.json
```

### 4. Network and API Issues  

#### "Rate limit exceeded"

**Cause:** Too many API requests in short time

**Solutions:**
```bash
# Wait and retry
sleep 60
speakeasy "retry message" --provider openai

# Use system voice as fallback
speakeasy "fallback message" --provider system

# Enable caching to reduce API calls
speakeasy "cached message" --cache --provider openai
```

#### "Network error" / "Connection failed"

**Diagnostics:**
```bash
# Test internet connection
ping google.com

# Test OpenAI API connectivity
curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" | head -c 100

# Test with debug mode
speakeasy "network test" --provider openai --debug
```

**Solutions:**
```bash
# Check firewall/proxy settings
# Use system voice as fallback
speakeasy "network fallback" --provider system

# Try different provider
speakeasy "try groq" --provider groq
```

### 5. Configuration Issues

#### "Configuration file has JSON errors"

**Cause:** Invalid JSON syntax in settings file

**Diagnostics:**
```bash
# Check JSON validity
cat ~/.config/speakeasy/settings.json | python -m json.tool

# Show configuration errors
speakeasy --diagnose
```

**Solutions:**
```bash
# Backup and recreate config
mv ~/.config/speakeasy/settings.json ~/.config/speakeasy/settings.json.bak

# Create minimal valid config
echo '{
  "providers": {
    "system": {
      "enabled": true
    }
  }
}' > ~/.config/speakeasy/settings.json

# Validate new config
speakeasy --config
```

#### "Config directory permissions error"

**Cause:** Cannot read/write configuration directory

**Solutions:**
```bash
# Fix permissions
chmod 755 ~/.config
chmod 755 ~/.config/speakeasy
chmod 644 ~/.config/speakeasy/settings.json

# Create directory if missing
mkdir -p ~/.config/speakeasy

# Check permissions
ls -la ~/.config/speakeasy/
```

### 6. Cache Issues

#### "Cache not enabled" 

**Cause:** Cache not properly configured

**Solutions:**
```bash
# Enable cache explicitly
speakeasy "test cache" --cache --provider openai

# Check cache configuration
speakeasy --diagnose | grep -i cache

# Enable cache in global config
echo '{
  "cache": {
    "enabled": true,
    "ttl": "7d",
    "maxSize": "100mb"
  }
}' > ~/.config/speakeasy/settings.json
```

#### "Cache directory not accessible"

**Solutions:**
```bash
# Fix cache directory permissions
mkdir -p /tmp/speakeasy-cache
chmod 755 /tmp/speakeasy-cache

# Use different cache directory
export SPEAKEASY_CACHE_DIR="$HOME/.cache/speakeasy"
mkdir -p "$SPEAKEASY_CACHE_DIR"

# Clear problematic cache
speakeasy --clear-cache
```

#### Cache taking too much space

**Solutions:**
```bash
# Check cache size
speakeasy --stats

# Clear cache
speakeasy --clear-cache

# Reduce cache size limit
echo '{
  "cache": {
    "maxSize": "50mb",
    "ttl": "1d"
  }
}' > ~/.config/speakeasy/settings.json
```

### 7. Voice and Audio Issues

#### "Voice not found" / "Invalid voice"

**Solutions:**
```bash
# List available system voices
say -v ?

# Use default voice
speakeasy "default voice" --provider system

# Use valid OpenAI voice
speakeasy "openai voice" --provider openai --voice nova

# Check voice configuration
speakeasy --diagnose | grep -i voice
```

#### No audio output / Silent playback

**Diagnostics:**
```bash
# Test system audio
say "audio test"

# Check volume settings
speakeasy "volume test" --volume 1.0 --provider system

# Test with debug mode
speakeasy "debug audio" --debug --provider system
```

**Solutions:**
```bash
# Check system volume (not affected by SpeakEasy)
# Increase SpeakEasy volume
speakeasy "louder" --volume 0.9

# Try different provider
speakeasy "try openai" --provider openai --volume 0.8

# Check audio hardware
system_profiler SPAudioDataType
```

### 8. Performance Issues

#### Slow speech generation

**Cause:** Network latency or API provider issues

**Solutions:**
```bash
# Use faster provider
speakeasy "fast speech" --provider groq

# Use system voice for instant results
speakeasy "instant speech" --provider system

# Enable caching for repeated text
speakeasy "cached speech" --cache --provider openai

# Check provider status
speakeasy --doctor
```

#### High memory usage

**Solutions:**
```bash
# Check cache size
speakeasy --stats

# Reduce cache size
echo '{
  "cache": {
    "maxSize": "20mb",
    "ttl": "1d"
  }
}' > ~/.config/speakeasy/settings.json

# Clear cache
speakeasy --clear-cache
```

## Advanced Diagnostics

### Debug Mode Analysis

```bash
# Enable debug mode
speakeasy "debug test" --debug --provider openai

# Debug output includes:
# - Provider selection
# - Voice and rate settings  
# - Cache operations
# - File generation
# - Playback details
```

**Example debug output:**
```
🔍 SpeakEasy Debug: Using provider 'openai'
🔍 SpeakEasy Debug: Voice 'nova', Rate 180 WPM, Volume 70%
🔍 SpeakEasy Debug: Cache key: abc123-def456
📦 SpeakEasy Debug: Cache miss - generating audio
🔊 SpeakEasy Debug: Playing generated audio
🔍 SpeakEasy Debug: Cleanup: removing temp file
```

### Health Check Deep Dive

```bash
speakeasy --doctor
```

**Checks performed:**
- ✅ System compatibility (macOS detection, required commands)
- ✅ Configuration file validation (JSON syntax, permissions)
- ✅ API key detection (config file and environment variables)
- ✅ Voice configuration validation
- ✅ Cache system health (directory permissions, TTL settings)

### Configuration Diagnostics

```bash
speakeasy --diagnose
```

**Detailed analysis:**
- Configuration file location and status
- Settings summary (provider, rate, volume, fallback order)
- API key status for each provider
- Voice settings per provider
- Cache configuration details
- Usage tips and recommendations

## Environment-Specific Issues

### macOS Issues

#### SIP (System Integrity Protection) conflicts
```bash
# Check SIP status
csrutil status

# SIP shouldn't affect SpeakEasy, but if issues occur:
# Use API providers instead of system voice
speakeasy "sip workaround" --provider openai
```

#### Homebrew conflicts
```bash
# If using Homebrew Node.js
which node
which npm

# Ensure proper PATH
echo $PATH | grep /usr/local/bin
```

### Linux/Windows Issues

#### System voice not available
```bash
# Expected behavior - system voice only works on macOS
# Use API providers instead
speakeasy "linux speech" --provider openai

# Set API provider as default
echo '{
  "defaults": {
    "provider": "openai"
  }
}' > ~/.config/speakeasy/settings.json
```

### Docker/Container Issues

#### Missing audio system
```bash
# Install audio packages (Debian/Ubuntu)
apt-get update && apt-get install -y alsa-utils pulseaudio

# Use API providers only (no system audio needed)
speakeasy "container speech" --provider openai
```

## Error Code Reference

### Exit Codes
- `0` - Success
- `1` - General error (missing text, invalid options)
- `2` - Configuration error (missing API keys, invalid config)
- `3` - Provider error (API failure, network issues)

### Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "No text provided to speak" | Missing text parameter | Add text as argument or --text flag |
| "API key is required" | Missing/invalid API key | Set environment variable or config |
| "Rate limit exceeded" | Too many API requests | Wait and retry, enable caching |
| "Network error" | Connection issues | Check internet, try fallback provider |
| "Voice not found" | Invalid voice name | Use valid voice or default |
| "Cache not enabled" | Cache configuration issue | Enable cache in config or CLI flag |
| "Permission denied" | File system permissions | Fix directory permissions |

## Getting Help

### Built-in Help
```bash
# CLI help
speakeasy --help

# Health check
speakeasy --doctor

# Configuration diagnostics
speakeasy --diagnose
```

### Debugging Steps

1. **Start with health check:**
   ```bash
   speakeasy --doctor
   ```

2. **Test with system voice:**
   ```bash
   speakeasy "system test" --provider system
   ```

3. **Test with debug mode:**
   ```bash
   speakeasy "debug test" --debug --provider openai
   ```

4. **Check configuration:**
   ```bash
   speakeasy --config
   speakeasy --diagnose
   ```

5. **Try minimal configuration:**
   ```bash
   # Backup current config
   mv ~/.config/speakeasy/settings.json ~/.config/speakeasy/settings.json.bak
   
   # Test with minimal config
   echo '{"providers":{"system":{"enabled":true}}}' > ~/.config/speakeasy/settings.json
   speakeasy "minimal test"
   ```

### Reporting Issues

When reporting issues, include:

1. **System information:**
   ```bash
   uname -a
   node --version
   npm list -g @arach/speakeasy
   ```

2. **Health check output:**
   ```bash
   speakeasy --doctor > health-check.txt
   ```

3. **Debug output:**
   ```bash
   speakeasy "reproduce issue" --debug > debug-output.txt 2>&1
   ```

4. **Configuration (sanitized):**
   ```bash
   speakeasy --config > config-output.txt
   # Remove API keys before sharing
   ```

For more help, see [CLI Reference](cli.md) and [Configuration Guide](configuration.md).