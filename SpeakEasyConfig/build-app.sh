#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="SpeakEasy Config"
BUNDLE_NAME="SpeakEasyConfig.app"
BUILD_DIR="$SCRIPT_DIR/.build/release"
APP_DIR="$SCRIPT_DIR/$BUNDLE_NAME"

echo "Building SpeakEasy Config..."

# Build release version
swift build -c release

echo "Creating app bundle..."

# Create app bundle structure
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy executable
cp "$BUILD_DIR/SpeakEasyConfig" "$APP_DIR/Contents/MacOS/"

# Copy Info.plist
cp "$SCRIPT_DIR/Resources/Info.plist" "$APP_DIR/Contents/"

# Generate icon
echo "Generating app icon..."
chmod +x "$SCRIPT_DIR/Scripts/generate_icon.swift"
swift "$SCRIPT_DIR/Scripts/generate_icon.swift" "$APP_DIR/Contents/Resources"

# Create PkgInfo
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

# Sign the app (ad-hoc for local use)
echo "Signing app..."
codesign --force --deep --sign - "$APP_DIR"

echo ""
echo "App bundle created: $APP_DIR"
echo ""
echo "To install to Applications:"
echo "  cp -R \"$APP_DIR\" /Applications/"
echo ""
echo "Or run directly:"
echo "  open \"$APP_DIR\""
