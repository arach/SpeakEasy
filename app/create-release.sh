#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Build the app first
./build-app.sh

# Create release zip
echo "Creating release zip..."
cd "$SCRIPT_DIR"
rm -f SpeakEasy.app.zip
ditto -c -k --sequesterRsrc --keepParent SpeakEasy.app SpeakEasy.app.zip

echo ""
echo "✅ Created: $SCRIPT_DIR/SpeakEasy.app.zip"
echo ""
echo "To create a GitHub release:"
echo "  1. git tag v1.0.0 && git push --tags"
echo "  2. gh release create v1.0.0 SpeakEasy.app.zip --title 'v1.0.0' --notes 'Initial release'"
echo ""
echo "Or upload manually at: https://github.com/arach/speakeasy/releases/new"
