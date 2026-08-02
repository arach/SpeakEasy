#!/usr/bin/env bash
set -euo pipefail

DMG_PATH="${1:-}"
EXPECTED_VERSION="${2:-}"
EXPECT_NOTARIZED="${SPEAKEASY_EXPECT_NOTARIZED:-1}"

usage() {
    echo "Usage: ./tools/release/verify-dmg.sh <SpeakEasy.dmg> [expected-version]" >&2
}

if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
    usage
    exit 1
fi

DMG_PATH="$(cd "$(dirname "$DMG_PATH")" && pwd)/$(basename "$DMG_PATH")"
MOUNT_POINT="$(mktemp -d)"

cleanup() {
    hdiutil detach "$MOUNT_POINT" -quiet >/dev/null 2>&1 || true
    rmdir "$MOUNT_POINT" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "    Verifying DMG signature"
codesign --verify --verbose=2 "$DMG_PATH"

if [ "$EXPECT_NOTARIZED" = "1" ]; then
    echo "    Verifying stapled notarization ticket and Gatekeeper acceptance"
    xcrun stapler validate "$DMG_PATH"
    spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_PATH"
fi

echo "    Mounting read-only for an installed-payload audit"
hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_POINT" -quiet

APP="$MOUNT_POINT/SpeakEasy.app"
EXECUTABLE="$APP/Contents/MacOS/SpeakEasy"
HELPER="$APP/Contents/Helpers/speakeasy-runtime"
PLIST="$APP/Contents/Info.plist"

for path in "$APP" "$EXECUTABLE" "$HELPER" "$PLIST"; do
    if [ ! -e "$path" ]; then
        echo "Error: Release payload is missing $path" >&2
        exit 1
    fi
done

if [ ! -L "$MOUNT_POINT/Applications" ] || [ "$(readlink "$MOUNT_POINT/Applications")" != "/Applications" ]; then
    echo "Error: DMG is missing its Applications shortcut." >&2
    exit 1
fi

codesign --verify --deep --strict --verbose=2 "$APP"
if [ "$EXPECT_NOTARIZED" = "1" ]; then
    spctl --assess --type execute --verbose=2 "$APP"
fi

ACTUAL_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"
if [ -n "$EXPECTED_VERSION" ] && [ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]; then
    echo "Error: DMG contains SpeakEasy $ACTUAL_VERSION, expected $EXPECTED_VERSION." >&2
    exit 1
fi

APP_ARCHS="$(lipo -archs "$EXECUTABLE")"
HELPER_ARCHS="$(lipo -archs "$HELPER")"
case " $APP_ARCHS " in
    *" arm64 "*) ;;
    *) echo "Error: SpeakEasy executable is missing arm64: $APP_ARCHS" >&2; exit 1 ;;
esac
case " $HELPER_ARCHS " in
    *" arm64 "*) ;;
    *) echo "Error: Deck runtime is missing arm64: $HELPER_ARCHS" >&2; exit 1 ;;
esac

if otool -L "$EXECUTABLE" | awk 'NR > 1 { print $1 }' | grep -Ev '^(@rpath/|/System/Library/|/usr/lib/)' | grep -q .; then
    echo "Error: App contains a non-portable dynamic-library reference:" >&2
    otool -L "$EXECUTABLE" >&2
    exit 1
fi

echo "    Payload accepted: SpeakEasy $ACTUAL_VERSION · app $APP_ARCHS · runtime $HELPER_ARCHS"
