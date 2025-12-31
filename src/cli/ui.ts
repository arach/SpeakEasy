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

   ${chalk.bold('ElevenLabs')} - Premium voices
   ${chalk.cyan('speakeasy --set-key elevenlabs YOUR_API_KEY')}
   Get key: ${chalk.underline('https://elevenlabs.io/app/settings/api-keys')}

   ${chalk.bold('OpenAI')} - High quality voices
   ${chalk.cyan('speakeasy --set-key openai YOUR_API_KEY')}
   Get key: ${chalk.underline('https://platform.openai.com/api-keys')}

   ${chalk.bold('Groq')} - Fast & cheap
   ${chalk.cyan('speakeasy --set-key groq YOUR_API_KEY')}
   Get key: ${chalk.underline('https://console.groq.com/keys')}

   ${chalk.bold('Gemini')} - Google's AI voices
   ${chalk.cyan('speakeasy --set-key gemini YOUR_API_KEY')}
   Get key: ${chalk.underline('https://makersuite.google.com/app/apikey')}

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
  --instructions      Voice instructions (OpenAI only): accent, tone, style
  --interrupt, -i     Interrupt current speech
  --cache, -c         Enable caching
  --clear-cache       Clear the cache
  --config            Show current configuration
  --config --edit     Edit configuration file in default editor
  --edit              Edit configuration file (implies --config)
  --set-key <p> <key> Save API key for provider (elevenlabs, openai, groq, gemini)
  --set-default <p>   Set default provider
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

  # Quick setup for API keys:
  speakeasy --set-key elevenlabs YOUR_API_KEY
  speakeasy --set-key openai sk-xxxxxxxxxxxx
  speakeasy --set-default elevenlabs  # Use elevenlabs by default

  # Voice steering with instructions (OpenAI only, uses gpt-4o-audio-preview):
  speakeasy "Hello!" --provider openai --instructions "Speak with a British accent"
  speakeasy "Good morning" --provider openai --instructions "Speak slowly and calmly"
  speakeasy "Welcome!" --provider openai --instructions "Sound excited and energetic"
`);
}


