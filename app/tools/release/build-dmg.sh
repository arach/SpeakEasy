#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

APP_ROOT="$(speakeasy_release_root)"
REPO_ROOT="$(speakeasy_repo_root)"
DIST_DIR="$APP_ROOT/dist"
BUNDLE_NAME="SpeakEasy.app"
DMG_NAME="SpeakEasy.dmg"
BUNDLE="$DIST_DIR/$BUNDLE_NAME"
VERSION="${1:-$(speakeasy_default_version)}"
DMG_PATH="$DIST_DIR/$DMG_NAME"
DMG_BUILD_PATH="$DIST_DIR/.SpeakEasy-$VERSION.build.dmg"

SKIP_SIGN="${SPEAKEASY_SKIP_SIGN:-0}"
SKIP_NOTARIZE="${SPEAKEASY_SKIP_NOTARIZE:-0}"
NOTARY_PROFILE="${SPEAKEASY_NOTARY_PROFILE:-notarytool-air}"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Release version must be numeric (for example 0.2.18): $VERSION" >&2
    exit 1
fi

if [ "$SKIP_SIGN" != "1" ]; then
    if [ -z "${SPEAKEASY_SIGN_IDENTITY:-}" ] && [ -z "$(speakeasy_default_sign_identity || true)" ]; then
        echo "Error: No Developer ID signing identity found." >&2
        echo "Set SPEAKEASY_SIGN_IDENTITY or run with SPEAKEASY_SKIP_SIGN=1 for a local smoke DMG." >&2
        exit 1
    fi
fi

if [ "$SKIP_NOTARIZE" != "1" ] && [ "$SKIP_SIGN" != "1" ]; then
    echo "==> Verifying notarization credentials ($NOTARY_PROFILE)..."
    xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null
fi

"$APP_ROOT/Scripts/sync-pad-assets.sh"

echo "==> Building SpeakEasy v$VERSION (release)..."
cd "$APP_ROOT"
build_log="$(mktemp)"
if ! swift build -c release 2>&1 | tee "$build_log"; then
    echo "==> Swift build FAILED. Compiler errors:" >&2
    grep -E "error:" "$build_log" >&2 || true
    rm -f "$build_log"
    exit 1
fi
rm -f "$build_log"

speakeasy_build_deck_runtime "$APP_ROOT"

echo "==> Creating app bundle..."
mkdir -p "$DIST_DIR"
speakeasy_bundle_app "$APP_ROOT" "$BUNDLE"
speakeasy_set_bundle_version "$BUNDLE" "$VERSION"
speakeasy_verify_bundle_layout "$BUNDLE"
echo "    App bundle created at $BUNDLE"

SPEAKEASY_SIGN_STRICT=1 "$SCRIPT_DIR/sign-bundle.sh" "$BUNDLE"
if [ "$SKIP_SIGN" != "1" ]; then
    speakeasy_verify_signed_bundle "$BUNDLE"
fi

echo "==> Creating DMG..."
DMG_STAGING="$(mktemp -d)"
cleanup() {
    rm -rf "$DMG_STAGING"
    rm -f "$DMG_BUILD_PATH"
}
trap cleanup EXIT

ditto "$BUNDLE" "$DMG_STAGING/$BUNDLE_NAME"
ln -s /Applications "$DMG_STAGING/Applications"

rm -f "$DMG_PATH" "$DMG_BUILD_PATH"
hdiutil create \
    -volname "SpeakEasy" \
    -srcfolder "$DMG_STAGING" \
    -ov \
    -format UDZO \
    "$DMG_BUILD_PATH"

mv "$DMG_BUILD_PATH" "$DMG_PATH"

if [ "$SKIP_SIGN" = "1" ]; then
    echo "==> Skipping DMG signing because SPEAKEASY_SKIP_SIGN=1"
elif [ -n "${SPEAKEASY_SIGN_IDENTITY:-$(speakeasy_default_sign_identity || true)}" ]; then
    SIGN_IDENTITY="${SPEAKEASY_SIGN_IDENTITY:-$(speakeasy_default_sign_identity)}"
    echo "==> Signing DMG..."
    codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DMG_PATH"
fi

if [ "$SKIP_NOTARIZE" = "1" ] || [ "$SKIP_SIGN" = "1" ]; then
    echo "==> Skipping notarization"
else
    echo "==> Submitting for notarization..."
    xcrun notarytool submit "$DMG_PATH" \
        --keychain-profile "$NOTARY_PROFILE" \
        --wait

    echo "==> Stapling notarization ticket..."
    xcrun stapler staple "$DMG_PATH"
    xcrun stapler validate "$DMG_PATH"
fi

echo ""
echo "==> Verifying release artifact..."
SPEAKEASY_EXPECT_NOTARIZED="$([ "$SKIP_SIGN" != "1" ] && [ "$SKIP_NOTARIZE" != "1" ] && echo 1 || echo 0)" \
    "$SCRIPT_DIR/verify-dmg.sh" "$DMG_PATH" "$VERSION"

shasum -a 256 "$DMG_PATH" | sed "s#  .*#  $DMG_NAME#" > "$DIST_DIR/SpeakEasy.sha256"

echo ""
echo "==> Done: $DMG_PATH"
ls -lh "$DMG_PATH" "$DIST_DIR/SpeakEasy.sha256"

echo ""
echo "To ship:"
echo "  SPEAKEASY_VERSION=$VERSION ./tools/release/ship.sh dmg"
