#!/usr/bin/env bash
# SpeakEasy macOS release build helper (Lattices-style).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
    cat <<'EOF'
SpeakEasy macOS build helper

Usage:
  ./Scripts/build.sh                 Build signed + notarized release DMG
  ./Scripts/build.sh --local         Build signed DMG, skip notarization
  ./Scripts/build.sh app             Build signed .app in app/ (no DMG)

Preflight:
  security find-identity -v -p codesigning
  xcrun notarytool history --keychain-profile notarytool-art | head
EOF
}

cmd="${1:-dist}"

case "$cmd" in
    -h|--help|help)
        usage
        ;;
    --local|local|dist:local)
        SPEAKEASY_SKIP_NOTARIZE=1 "$APP_ROOT/tools/release/build-dmg.sh" "${2:-}"
        ;;
    dist)
        "$APP_ROOT/tools/release/build-dmg.sh" "${2:-}"
        ;;
    app)
        "$APP_ROOT/build-app.sh"
        ;;
    *)
        echo "Unknown command: $cmd" >&2
        usage >&2
        exit 1
        ;;
esac