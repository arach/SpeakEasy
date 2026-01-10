#!/bin/bash
# Build and install SpeakEasy Config as a macOS app
set -e

cd "$(dirname "$0")"

echo "Building SpeakEasyConfig..."
swift build -c release

# Create app bundle structure
APP_DIR="$HOME/Applications/SpeakEasy Config.app"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy executable
cp .build/release/SpeakEasyConfig "$APP_DIR/Contents/MacOS/"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>SpeakEasyConfig</string>
    <key>CFBundleIdentifier</key>
    <string>com.speakeasy.config</string>
    <key>CFBundleName</key>
    <string>SpeakEasy Config</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
EOF

echo "Installed to: $APP_DIR"
echo "You can now find 'SpeakEasy Config' in ~/Applications or Spotlight"
