#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$ROOT/SpeakEasyDeck.xcodeproj"
SCHEME="SpeakEasyDeck"
DERIVED_DATA="$ROOT/.derived-data"
DEVICE_CACHE="$ROOT/.device-id.local"
BUNDLE_ID="dev.arach.speakeasy.deck"

resolve_device_id() {
  if [[ -n "${SPEAKEASY_DEVICE_ID:-}" ]]; then
    echo "$SPEAKEASY_DEVICE_ID"
    return
  fi
  if [[ -f "$DEVICE_CACHE" ]]; then
    cat "$DEVICE_CACHE"
    return
  fi
  xcrun xcdevice list | ruby -rjson -e '
    devices = JSON.parse(STDIN.read)
    ios = devices.select { |d|
      !d["simulator"] &&
      d["platform"] == "com.apple.platform.iphoneos" &&
      d["available"]
    }
    preferred = ios.find { |d| d["name"].to_s.downcase.include?("ipad") } || ios.first
    abort "no available iOS device found" unless preferred
    puts preferred["identifier"]
  '
}

DEVICE_ID="$(resolve_device_id)"
echo "$DEVICE_ID" > "$DEVICE_CACHE"

echo "==> generating project"
(cd "$ROOT" && xcodegen generate --spec project.yml)

echo "==> building for device $DEVICE_ID"
xcodebuild -project "$PROJECT" -scheme "$SCHEME" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphoneos/$SCHEME.app"
echo "==> installing $APP_PATH"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

echo "==> launching"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"
