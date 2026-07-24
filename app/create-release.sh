#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Use the release helpers instead:"
echo "  ./Scripts/build.sh              # signed + notarized DMG in dist/"
echo "  ./Scripts/build.sh --local      # signed DMG, skip notarization"
echo "  ./tools/release/ship.sh dmg       # build + upload to GitHub Releases"
echo ""
exec "$SCRIPT_DIR/Scripts/build.sh" dist "$@"