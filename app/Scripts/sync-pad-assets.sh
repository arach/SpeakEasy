#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
PAD_ROOT="$REPO_ROOT/pad"
DESTINATION="$APP_ROOT/Sources/SpeakEasy/Resources/Pad"

if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is required to build the SpeakEasy Pad developer assets." >&2
    echo "The released SpeakEasy app already contains these assets." >&2
    exit 1
fi

echo "Building SpeakEasy Pad…"
(
    cd "$PAD_ROOT"
    bun run build
)

mkdir -p "$DESTINATION"
rsync -a --delete "$PAD_ROOT/dist/" "$DESTINATION/"
echo "Synced SpeakEasy Pad assets to $DESTINATION"
