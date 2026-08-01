#!/bin/bash
# Quick launcher for SpeakEasy Config app
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
"$APP_ROOT/Scripts/sync-pad-assets.sh"
cd "$APP_ROOT"
swift run
