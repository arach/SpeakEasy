# CLI Reference

Complete command-line interface documentation for SpeakEasy.

## Installation

```bash
npm install -g @arach/speakeasy
```

## Basic Usage

```bash
speakeasy "Hello, world!"
```

## Command Syntax

```bash
speakeasy [text] [options]
speakeasy --text "text" [options]
```

## Core Options

### Text Input
- `--text, -t "text"` - Text to speak (can also be positional argument)
- Example: `speakeasy --text "Hello world"` or `speakeasy "Hello world"`

### Provider Selection
- `--provider, -p <provider>` - Choose TTS provider
- Options: `system`, `openai`, `elevenlabs`, `groq`
- Default: `system` (or configured default)
- Example: `speakeasy "Hello" --provider openai`

### Voice Configuration
- `--voice, -v <voice>` - Select voice (provider-dependent)
- System voices: `Samantha`, `Alex`, `Victoria`, etc.
- OpenAI voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- ElevenLabs: Custom voice IDs (e.g., `EXAVITQu4vr4xnSDxMaL`)
- Example: `speakeasy "Hello" --provider openai --voice nova`

### Speech Control
- `--rate, -r <number>` - Speech rate in words per minute (WPM)
- Range: 80-400 WPM (provider-dependent)
- Default: 180 WPM
- Example: `speakeasy "Fast speech" --rate 250`

- `--volume <number>` - Volume level (0.0 to 1.0)
- Default: 0.7 (70%)
- Example: `speakeasy "Quiet" --volume 0.3`

- `--interrupt, -i` - Interrupt any currently playing speech
- Example: `speakeasy "Stop everything" --interrupt`

### File Output
- `--out <file>` - Save audio to file (in addition to playing)
- Automatically enables caching when used
- Example: `speakeasy "Welcome message" --out welcome.mp3`
- Example: `speakeasy "Notification" --provider openai --voice nova --out notification.mp3`

## Cache Management

### Basic Cache Operations
- `--cache, -c` - Enable caching for this request
- `--clear-cache` - Delete all cached audio files
- Example: `speakeasy "Cache this" --cache --provider openai`

### Cache Inspection
- `--list` - List all cached entries
- `--stats` - Show cache statistics
- `--recent <N>` - Show N most recent cache entries
- `--find "text"` - Search cache entries by text content
- `--id <cache-key>` - Show detailed info for specific cache entry
- `--play <cache-key>` - Play cached audio by ID

### Cache Examples
```bash
# List all cached entries
speakeasy --list

# Show cache statistics
speakeasy --stats

# Find entries containing "hello"
speakeasy --find "hello"

# Show details for specific entry
speakeasy --id abc123-def456

# Play cached audio directly
speakeasy --play abc123-def456

# Show 10 most recent entries
speakeasy --recent 10
```

## Configuration & Diagnostics

### Configuration Commands
- `--config` - Display current configuration file
- `--diagnose` - Show detailed configuration diagnostics
- `--doctor` - Run comprehensive health check

### Debug & Help
- `--debug, -d` - Enable debug logging
- `--help, -h` - Show help message

### Diagnostic Examples
```bash
# Quick health check
speakeasy --doctor

# Detailed configuration analysis
speakeasy --diagnose

# View current settings
speakeasy --config

# Debug a speech request
speakeasy "Test debug" --debug --provider openai
```

## Complete Examples

### Basic Usage
```bash
# System voice (default)
speakeasy "Hello world"

# Specific provider
speakeasy "Hello world" --provider openai

# With voice selection
speakeasy "Hello world" --provider openai --voice nova

# Custom rate and volume
speakeasy "Fast and quiet" --rate 250 --volume 0.4

# Save to file (plays AND saves)
speakeasy "Welcome message" --out welcome.mp3
speakeasy "Meeting reminder" --provider openai --voice nova --out reminder.mp3
```

### Provider-Specific Examples
```bash
# System voice with custom rate
speakeasy "macOS speech" --provider system --voice Samantha --rate 200

# OpenAI with caching
speakeasy "OpenAI speech" --provider openai --voice nova --cache

# ElevenLabs with custom voice
speakeasy "ElevenLabs speech" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL

# Groq with high priority
speakeasy "Groq speech" --provider groq --voice onyx --interrupt
```

### Cache Management Workflow
```bash
# Generate and cache audio
speakeasy "Important message" --provider openai --cache

# List to find the cache ID
speakeasy --list

# Play directly from cache
speakeasy --play abc123-def456

# Check cache statistics
speakeasy --stats

# Clean up when done
speakeasy --clear-cache
```

### Configuration Management
```bash
# Check if setup is working
speakeasy --doctor

# View current configuration
speakeasy --config

# Debug configuration issues
speakeasy --diagnose

# Test with debug output
speakeasy "Test configuration" --debug
```

## Exit Codes

- `0` - Success
- `1` - General error (missing text, invalid options, etc.)
- `2` - Configuration error (missing API keys, invalid config file)
- `3` - Provider error (API failure, network issues)

## Environment Variables

These environment variables are automatically detected:

```bash
export OPENAI_API_KEY="sk-..."
export ELEVENLABS_API_KEY="..."
export GROQ_API_KEY="gsk_..."
```

## Configuration File

The CLI uses the global configuration file at:
`~/.config/speakeasy/settings.json`

See [Configuration Guide](configuration.md) for detailed setup.

## Common Use Cases

### Development Notifications
```bash
# Build completion notification
speakeasy "Build completed successfully" --provider system

# Error alerts
speakeasy "Build failed with errors" --provider openai --voice nova --volume 0.8
```

### Claude Code Integration
```bash
# Permission requests
speakeasy "Claude needs your permission" --provider openai --voice nova

# Status updates
speakeasy "Task completed successfully" --provider system --rate 180
```

### Accessibility
```bash
# Screen reader text
speakeasy "Page loaded successfully" --provider elevenlabs --volume 0.6

# Navigation cues
speakeasy "Entering settings menu" --provider system --rate 200
```

## Troubleshooting

### Common Issues

**"No text provided to speak"**
```bash
# ❌ Missing text
speakeasy --provider openai

# ✅ Correct usage
speakeasy "Hello world" --provider openai
```

**"API key required"**
```bash
# Set environment variable
export OPENAI_API_KEY="your-key-here"

# Or use config file
speakeasy --config
```

**"Cache not enabled"**
```bash
# Enable cache explicitly
speakeasy "Text" --cache --provider openai

# Or check cache configuration
speakeasy --diagnose
```

### Getting Help

```bash
# Show help
speakeasy --help

# Run health check
speakeasy --doctor

# Debug mode
speakeasy "test" --debug
```

For more troubleshooting, see [Troubleshooting Guide](troubleshooting.md).