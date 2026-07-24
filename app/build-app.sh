#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tools/release/common.sh
source "$SCRIPT_DIR/tools/release/common.sh"

BUNDLE_NAME="SpeakEasy.app"
BUILD_DIR="$SCRIPT_DIR/.build/release"
APP_DIR="$SCRIPT_DIR/$BUNDLE_NAME"
INSTALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--install)
            INSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-i|--install]"
            echo "  -i, --install    Install to /Applications after building"
            exit 1
            ;;
    esac
done

echo "Building SpeakEasy..."
swift build -c release

echo "Creating app bundle..."
speakeasy_bundle_app "$SCRIPT_DIR" "$APP_DIR"

echo "Signing app..."
"$SCRIPT_DIR/tools/release/sign-bundle.sh" "$APP_DIR"

echo ""
echo "App bundle created: $APP_DIR"
echo ""

if [ "$INSTALL" = true ]; then
    echo "Installing to /Applications..."
    rm -rf "/Applications/$BUNDLE_NAME"
    cp -R "$APP_DIR" /Applications/
    echo "Installed to /Applications/$BUNDLE_NAME"
    echo ""
    echo "To run:"
    echo "  open \"/Applications/$BUNDLE_NAME\""
else
    echo "To install to Applications:"
    echo "  cp -R \"$APP_DIR\" /Applications/"
    echo ""
    echo "Or run directly:"
    echo "  open \"$APP_DIR\""
    echo ""
    echo "To build and install in one step, use:"
    echo "  ./build-app.sh --install"
    echo ""
    echo "For a signed/notarized release DMG:"
    echo "  ./Scripts/build.sh"
fi