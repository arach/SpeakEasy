#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPEN_AFTER_INSTALL=true
CURRENT_STEP="checking your Mac"

usage() {
    cat <<'EOF'
Install SpeakEasy and open its guided Deck setup.

Usage: ./app/install.sh [--no-open]

  --no-open   Install without launching SpeakEasy Settings
  -h, --help  Show this help
EOF
}

say_step() { printf '\n\033[1;38;5;166m›\033[0m %s\n' "$1"; }
say_ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
say_note() { printf '  \033[2m%s\033[0m\n' "$1"; }
die() { printf '\n\033[31mCould not install SpeakEasy:\033[0m %s\n' "$1" >&2; exit 1; }

on_error() {
    local exit_code=$?
    printf '\n\033[31mSpeakEasy stopped while %s.\033[0m\n' "$CURRENT_STEP" >&2
    printf 'Fix the message above, then run ./app/install.sh again.\n' >&2
    exit "$exit_code"
}
trap on_error ERR

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-open) OPEN_AFTER_INSTALL=false ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "Unknown option: $1" ;;
    esac
    shift
done

say_step "Checking prerequisites"
[[ "$(uname -s)" == "Darwin" ]] || die "The native SpeakEasy app requires macOS."
command -v bun >/dev/null 2>&1 || die "Bun is required. Install it from https://bun.sh, then run this installer again."
command -v xcrun >/dev/null 2>&1 || die "Apple command-line tools are required. Run: xcode-select --install"
xcrun --find swiftc >/dev/null 2>&1 || die "Swift is unavailable. Run: xcode-select --install"
say_ok "macOS and Apple build tools"
say_ok "Bun $(bun --version)"

CURRENT_STEP="installing JavaScript dependencies"
say_step "Installing pinned dependencies"
cd "$REPO_ROOT"
bun install --frozen-lockfile
say_ok "Dependencies are ready"

CURRENT_STEP="building and signing the app"
say_step "Building the native app and bundled Deck"
"$SCRIPT_DIR/build-app.sh" --install
say_ok "Installed /Applications/SpeakEasy.app"

CURRENT_STEP="checking Codex"
codex_path=""
for candidate in \
    "/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/Codex.app/Contents/Resources/codex"; do
    if [[ -x "$candidate" ]]; then codex_path="$candidate"; break; fi
done
if [[ -z "$codex_path" ]]; then
    codex_path="$(/bin/zsh -lic 'command -v codex' 2>/dev/null | tail -n 1 || true)"
fi
if [[ -n "$codex_path" && -x "$codex_path" ]]; then
    say_ok "Codex found"
else
    say_note "Codex was not found yet. Install/open the Codex desktop app or add the codex CLI to your login shell."
    say_note "SpeakEasy will show this as the only remaining setup step."
fi

if [[ "$OPEN_AFTER_INSTALL" == true ]]; then
    CURRENT_STEP="opening SpeakEasy"
    say_step "Opening guided setup"
    open -a "/Applications/SpeakEasy.app" --args --settings --deck-settings
    say_ok "SpeakEasy Settings is open"
fi

trap - ERR
printf '\n\033[1;32mSpeakEasy is installed.\033[0m\n'
printf 'Open the Deck tab, complete any remaining checked step, then press Start Deck.\n'
printf 'Your iPad or browser link appears as soon as the Deck is ready.\n\n'
