#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tools/release/common.sh
source "$SCRIPT_DIR/tools/release/common.sh"
cd "$SCRIPT_DIR"

BUNDLE_NAME="SpeakEasy.app"
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

"$SCRIPT_DIR/Scripts/sync-pad-assets.sh"

echo "Building SpeakEasy..."
swift build -c release

speakeasy_build_deck_runtime "$SCRIPT_DIR"

echo "Creating app bundle..."
speakeasy_bundle_app "$SCRIPT_DIR" "$APP_DIR"
speakeasy_set_bundle_version "$APP_DIR" "$(speakeasy_default_version)"
speakeasy_verify_bundle_layout "$APP_DIR"

echo "Signing app..."
"$SCRIPT_DIR/tools/release/sign-bundle.sh" "$APP_DIR"
speakeasy_verify_signed_bundle "$APP_DIR"

echo ""
echo "App bundle created: $APP_DIR"
echo ""

if [ "$INSTALL" = true ]; then
    echo "Installing to /Applications..."
    # Replacing a running bundle leaves its old helper and Caddy proxy alive,
    # which makes a successful install appear stale. Ask the app to quit, then
    # stop only helpers launched from the installed SpeakEasy bundle.
    osascript -e 'tell application "SpeakEasy" to quit' >/dev/null 2>&1 || true
    for _ in {1..20}; do
        pgrep -f '^/Applications/SpeakEasy.app/Contents/MacOS/SpeakEasy( |$)' >/dev/null 2>&1 || break
        sleep 0.25
    done
    app_pids="$(pgrep -f '^/Applications/SpeakEasy.app/Contents/MacOS/SpeakEasy( |$)' || true)"
    if [ -n "$app_pids" ]; then
        kill $app_pids >/dev/null 2>&1 || true
    fi
    helper_pids="$(pgrep -f '^/Applications/SpeakEasy.app/Contents/Helpers/speakeasy-runtime deck$' || true)"
    if [ -n "$helper_pids" ]; then
        kill $helper_pids >/dev/null 2>&1 || true
        for _ in {1..20}; do
            pgrep -f '^/Applications/SpeakEasy.app/Contents/Helpers/speakeasy-runtime deck$' >/dev/null 2>&1 || break
            sleep 0.25
        done
        helper_pids="$(pgrep -f '^/Applications/SpeakEasy.app/Contents/Helpers/speakeasy-runtime deck$' || true)"
        [ -z "$helper_pids" ] || kill -9 $helper_pids >/dev/null 2>&1 || true
    fi
    # A forced helper shutdown can orphan its private reverse proxy. Match only
    # the temporary Caddy configuration created by SpeakEasy's Deck runtime.
    caddy_pids="$(pgrep -f '[/]caddy run --config .*/speakeasy-deck-[^/]*/Caddyfile( |$)' || true)"
    if [ -n "$caddy_pids" ]; then
        kill $caddy_pids >/dev/null 2>&1 || true
    fi
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
