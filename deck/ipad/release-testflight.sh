#!/bin/zsh
set -euo pipefail

# Archive/export are local. Upload is explicit and uses the active asc profile.
# Keep signing credentials in Keychain; never place API keys in this script.
export HUDSON_VOX_GIT_REVISION="${HUDSON_VOX_GIT_REVISION:-0989a058e04da9a5b012d38a577c772d13906745}"
RELEASE_ROOT="$(cd "$(dirname "$0")" && pwd)"
RELEASE_VERSION="${SPEAKEASY_RELEASE_VERSION:-0.3.0}"
RELEASE_BUILD="${SPEAKEASY_RELEASE_BUILD:-1}"
RELEASE_DIR="${SPEAKEASY_RELEASE_DIR:-$RELEASE_ROOT/.release/$RELEASE_VERSION-$RELEASE_BUILD}"
RELEASE_PROFILE="${SPEAKEASY_RELEASE_PROFILE:-SpeakEasy Pad App Store}"
RELEASE_MODE="${1:-export}"
if [[ "$RELEASE_MODE" != export && "$RELEASE_MODE" != upload ]]; then
  print -u2 'Usage: release-testflight.sh [export|upload]'
  exit 2
fi
if [[ "$RELEASE_MODE" == upload && -z "${ASC_APP_ID:-}" ]]; then
  print -u2 'ASC_APP_ID must identify the SpeakEasy Deck App Store Connect record.'
  exit 2
fi
mkdir -p "$RELEASE_DIR"
(cd "$RELEASE_ROOT" && xcodegen generate --spec project.yml)
xcodebuild -project "$RELEASE_ROOT/SpeakEasyDeck.xcodeproj" -scheme SpeakEasyDeck \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$RELEASE_ROOT/.derived-data" \
  -archivePath "$RELEASE_DIR/SpeakEasyDeck.xcarchive" \
  MARKETING_VERSION="$RELEASE_VERSION" CURRENT_PROJECT_VERSION="$RELEASE_BUILD" \
  DEVELOPMENT_TEAM=2U83JFPW66 SPEAKEASY_DISTRIBUTION_PROFILE="$RELEASE_PROFILE" archive
python3 - "$RELEASE_DIR/ExportOptions.plist" "$RELEASE_PROFILE" <<'PY'
import plistlib, sys
with open(sys.argv[1], 'wb') as f:
    plistlib.dump({
        'method': 'app-store-connect', 'destination': 'export',
        'teamID': '2U83JFPW66', 'signingStyle': 'manual',
        'signingCertificate': 'iPhone Distribution',
        'provisioningProfiles': {'dev.arach.speakeasy.deck': sys.argv[2]},
        'manageAppVersionAndBuildNumber': False, 'uploadSymbols': True,
    }, f)
PY
xcodebuild -exportArchive -archivePath "$RELEASE_DIR/SpeakEasyDeck.xcarchive" \
  -exportOptionsPlist "$RELEASE_DIR/ExportOptions.plist" -exportPath "$RELEASE_DIR/export"
if [[ "$RELEASE_MODE" == upload ]]; then
  # No automatic tester notification; distribution can use an existing beta group.
  args=(publish testflight --app "$ASC_APP_ID" --ipa "$RELEASE_DIR/export/SpeakEasyDeck.ipa"
    --version "$RELEASE_VERSION" --build-number "$RELEASE_BUILD" --wait --timeout 30m
    --test-notes 'Explore Herdr sessions and agents, bind voice lanes, and test recording, reply playback, full waveform previews, and reconnect recovery with the SpeakEasy Mac app.' --locale en-US)
  if [[ -n "${SPEAKEASY_TESTFLIGHT_GROUP:-}" ]]; then
    args+=(--group "$SPEAKEASY_TESTFLIGHT_GROUP")
  fi
  asc "${args[@]}"
fi
