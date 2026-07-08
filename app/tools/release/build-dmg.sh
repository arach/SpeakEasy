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

SKIP_SIGN="${SPEAKEASY_SKIP_SIGN:-0}"
SKIP_NOTARIZE="${SPEAKEASY_SKIP_NOTARIZE:-0}"
NOTARY_PROFILE="${SPEAKEASY_NOTARY_PROFILE:-notarytool-art}"

if [ "$SKIP_SIGN" != "1" ]; then
    if [ -z "${SPEAKEASY_SIGN_IDENTITY:-}" ] && [ -z "$(speakeasy_default_sign_identity || true)" ]; then
        echo "Error: No Developer ID signing identity found." >&2
        echo "Set SPEAKEASY_SIGN_IDENTITY or run with SPEAKEASY_SKIP_SIGN=1 for a local smoke DMG." >&2
        exit 1
    fi
fi

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

echo "==> Creating app bundle..."
mkdir -p "$DIST_DIR"
speakeasy_bundle_app "$APP_ROOT" "$BUNDLE"
speakeasy_set_bundle_version "$BUNDLE" "$VERSION"
echo "    App bundle created at $BUNDLE"

SPEAKEASY_SIGN_STRICT=1 "$SCRIPT_DIR/sign-bundle.sh" "$BUNDLE"

echo "==> Creating DMG..."
DMG_STAGING="$(mktemp -d)"
cp -R "$BUNDLE" "$DMG_STAGING/"
ln -s /Applications "$DMG_STAGING/Applications"

hdiutil create \
    -volname "SpeakEasy" \
    -srcfolder "$DMG_STAGING" \
    -ov \
    -format UDZO \
    "$DIST_DIR/$DMG_NAME"

rm -rf "$DMG_STAGING"

if [ "$SKIP_SIGN" = "1" ]; then
    echo "==> Skipping DMG signing because SPEAKEASY_SKIP_SIGN=1"
elif [ -n "${SPEAKEASY_SIGN_IDENTITY:-$(speakeasy_default_sign_identity || true)}" ]; then
    SIGN_IDENTITY="${SPEAKEASY_SIGN_IDENTITY:-$(speakeasy_default_sign_identity)}"
    echo "==> Signing DMG..."
    codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DIST_DIR/$DMG_NAME"
fi

if [ "$SKIP_NOTARIZE" = "1" ] || [ "$SKIP_SIGN" = "1" ]; then
    echo "==> Skipping notarization"
else
    echo "==> Submitting for notarization..."
    xcrun notarytool submit "$DIST_DIR/$DMG_NAME" \
        --keychain-profile "$NOTARY_PROFILE" \
        --wait

    echo "==> Stapling notarization ticket..."
    xcrun stapler staple "$DIST_DIR/$DMG_NAME"
fi

echo ""
echo "==> Done: $DIST_DIR/$DMG_NAME"
ls -lh "$DIST_DIR/$DMG_NAME"
if [ "$SKIP_SIGN" != "1" ]; then
    spctl --assess --type open --context context:primary-signature -v "$DIST_DIR/$DMG_NAME" 2>&1 || true
fi

echo ""
echo "To ship:"
echo "  SPEAKEASY_VERSION=$VERSION ./tools/release/ship.sh dmg"