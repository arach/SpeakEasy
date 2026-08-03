#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$ROOT/SpeakEasyDeck.xcodeproj"
SCHEME="SpeakEasyDeck"
DERIVED_DATA="$ROOT/.derived-data"
DEVICE_CACHE="$ROOT/.device-id.local"
BUNDLE_ID="dev.arach.speakeasy.deck"
DISCOVERY_FILE="$HOME/.config/speakeasy/deck-listener.json"
CADDY_ROOT="$HOME/Library/Application Support/Caddy/pki/authorities/local/root.crt"

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
if [[ -f "$DISCOVERY_FILE" && -f "$CADDY_ROOT" ]]; then
  # A developer-installed iPad should be immediately useful. Pass the exact
  # paired URL plus this Mac's public CA anchor only for the first launch; the
  # app copies both into this-device-only Keychain storage. Never print the
  # environment JSON because the paired URL contains the Deck capability.
  PROVISIONING_ENV="$(python3 - "$DISCOVERY_FILE" "$CADDY_ROOT" <<'PY'
import base64
import json
import pathlib
import ssl
import sys

discovery = json.loads(pathlib.Path(sys.argv[1]).read_text())
pem = pathlib.Path(sys.argv[2]).read_text()
url = discovery.get("url")
if not isinstance(url, str) or not url.startswith("https://"):
    raise SystemExit("running Deck did not publish a paired HTTPS URL")
der = ssl.PEM_cert_to_DER_cert(pem)
print(json.dumps({
    "SPEAKEASY_DECK_URL": url,
    "SPEAKEASY_DECK_ROOT_DER": base64.b64encode(der).decode(),
}))
PY
)"
  xcrun devicectl device process launch --terminate-existing \
    --device "$DEVICE_ID" \
    --environment-variables "$PROVISIONING_ENV" \
    "$BUNDLE_ID"
  echo "==> paired securely with the running Deck (saved on iPad)"
else
  xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"
  echo "==> launch complete; start 'speakeasy deck' to provision a secure connection"
fi
