import { CONFIG_FILE } from './constants';
import chalk from 'chalk';

export function showWelcome(): void {
  console.log(`
+=============================================================================+
|                                                                             |
| ███████╗██████╗ ███████╗ █████╗ ██╗  ██╗███████╗ █████╗ ███████╗██╗   ██╗   |
| ██╔════╝██╔══██╗██╔════╝██╔══██╗██║ ██╔╝██╔════╝██╔══██╗██╔════╝╚██╗ ██╔╝   |
| ███████╗██████╔╝█████╗  ███████║█████╔╝ █████╗  ███████║███████╗ ╚████╔╝    |
| ╚════██║██╔═══╝ ██╔══╝  ██╔══██║██╔═██╗ ██╔══╝  ██╔══██║╚════██║  ╚██╔╝     |
| ███████║██║     ███████╗██║  ██║██║  ██╗███████╗██║  ██║███████║   ██║      |
| ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝      |
|                                                                             |
+=============================================================================+

🎉 Welcome to SpeakEasy!

We didn't find a configuration file. Let's create one to get you started!

📦 What is SpeakEasy?
   A unified text-to-speech CLI that works with multiple providers.

   Supported Providers:
   • System Voices - macOS, Windows, Linux (no key needed)
   • ElevenLabs - Premium voices (🔑 key required)
   • OpenAI - High quality voices (🔑 key required)
   • Groq - Fast & cheap (🔑 key required)
   • Gemini - Google's AI voices (🔑 key required)

🚀 Quick Start:
   Try it now with built-in system voices:
   
   ${chalk.green('speakeasy "Hello! Welcome to SpeakEasy!" --provider system')}

🔧 Setup API Keys (optional):
   
   For ElevenLabs:
   ${chalk.cyan('export ELEVENLABS_API_KEY="your-api-key-here"')}
   Get key: https://elevenlabs.io/app/settings/api-keys
   
   For OpenAI TTS:
   ${chalk.cyan('export OPENAI_API_KEY="your-api-key-here"')}
   Get key: https://platform.openai.com/api-keys
   
   For Groq (fast & cheap):
   ${chalk.cyan('export GROQ_API_KEY="your-api-key-here"')}
   Get key: https://console.groq.com/keys
   
   For Gemini:
   ${chalk.cyan('export GEMINI_API_KEY="your-api-key-here"')}
   Get key: https://makersuite.google.com/app/apikey

💾 Configuration:
   Config file: ${chalk.gray(CONFIG_FILE)}
   Create config: ${chalk.yellow('speakeasy --config --edit')}
   View settings: ${chalk.yellow('speakeasy --config')}

🩺 Need Help?
   Diagnose setup: ${chalk.yellow('speakeasy --doctor')}
   Show all options: ${chalk.yellow('speakeasy --help')}

${chalk.dim('────────────────────────────────────────────────────────────')}

Built with ❤️ by Arach • https://arach.dev
`);
}

export function showHelp(): void {
  console.log(`
🗣️  SpeakEasy CLI - Text-to-Speech Command Line Tool

Usage:
  speakeasy [text] [options]
  speakeasy --text "Hello world" --provider openai
  speakeasy --config
  speakeasy --cache --clear

Options:
  --text, -t          Text to speak (can be positional argument)
  --provider, -p      Provider: system, openai, elevenlabs, groq, gemini
  --voice, -v         Voice to use (depends on provider)
  --rate, -r          Speech rate (words per minute)
  --volume            Volume (0.0 to 1.0, default: 0.7)
  --interrupt, -i     Interrupt current speech
  --cache, -c         Enable caching
  --clear-cache       Clear the cache
  --config            Show current configuration
  --config --edit     Edit configuration file in default editor
  --edit              Edit configuration file (implies --config)
  --help, -h          Show this help
  --debug, -d         Enable debug logging
  --diagnose          Show configuration diagnostics
  --doctor            Run health checks and provide fixes
  --welcome           Show welcome screen (for demo/testing)
  --list              List all cache entries
  --find "text"       Find cache entries by text
  --stats             Show cache statistics
  --recent N          Show N most recent cache entries
  --id KEY            Show detailed info for specific cache entry
  --play KEY          Play cached audio by ID
  --out FILE          Save audio to file (in addition to playing)

Examples:
  speakeasy "Hello world"
  speakeasy --text "Hello world" --provider openai --voice nova
  speakeasy --text "Hello world" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL
  speakeasy --text "Hello world" --volume 0.5
  speakeasy --cache --text "Hello cached world"
  speakeasy --clear-cache
  speakeasy --list                    # List all cache entries
  speakeasy --stats                   # Show cache statistics
  speakeasy --recent 20               # Show 20 most recent
  speakeasy --find "hello world"      # Find entries containing text
  speakeasy --id abc123-def456        # Show detailed entry info
  speakeasy --play abc123-def456      # Play cached audio by ID
  speakeasy "Hello world" --out audio.mp3  # Save to file
`);
}


