#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_VERSION="0.2.18"
VERSION="${SPEAKEASY_VERSION:-$DEFAULT_VERSION}"
RELEASE_REPO="${SPEAKEASY_RELEASE_REPO:-arach/SpeakEasy}"
RELEASE_ROOT="https://github.com/$RELEASE_REPO/releases/download/v$VERSION"
DMG_URL="$RELEASE_ROOT/SpeakEasy.dmg"
CHECKSUM_URL="$RELEASE_ROOT/SpeakEasy-$VERSION.sha256"
EXPECTED_TEAM_ID="2U83JFPW66"
EXPECTED_BUNDLE_ID="com.speakeasy.config"
TARGET_APP="/Applications/SpeakEasy.app"
OPEN_AFTER_INSTALL=1
SOURCE_DMG="${SPEAKEASY_DMG_PATH:-}"
CURRENT_STEP="checking this Mac"
TMP_ROOT=""
MOUNT_POINT=""
STAGED_APP=""
BACKUP_APP=""

usage() {
    cat <<EOF
Install the signed, notarized SpeakEasy $VERSION release.

Usage: bash install-speakeasy.sh [--no-open] [--dmg <local-path>]

  --no-open          Install without opening guided Deck setup
  --dmg <local-path> Verify and install a local release DMG
  -h, --help         Show this help

The default path downloads the exact v$VERSION release from:
  $DMG_URL
EOF
}

say_step() { printf '\n\033[1;38;5;36m›\033[0m %s\n' "$1"; }
say_ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
say_note() { printf '  \033[2m%s\033[0m\n' "$1"; }
die() { printf '\n\033[31mCould not install SpeakEasy:\033[0m %s\n' "$1" >&2; exit 1; }

cleanup() {
    local exit_code=$?

    if [[ -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]]; then
        hdiutil detach "$MOUNT_POINT" -quiet >/dev/null 2>&1 || true
    fi
    [[ -z "$STAGED_APP" || ! -e "$STAGED_APP" ]] || rm -rf "$STAGED_APP"

    if [[ "$exit_code" -ne 0 && -n "$BACKUP_APP" && -e "$BACKUP_APP" && ! -e "$TARGET_APP" ]]; then
        mv "$BACKUP_APP" "$TARGET_APP" >/dev/null 2>&1 || true
    fi

    if [[ "$exit_code" -eq 0 && -n "$BACKUP_APP" && -e "$BACKUP_APP" ]]; then
        rm -rf "$BACKUP_APP"
    fi
    [[ -z "$TMP_ROOT" || ! -d "$TMP_ROOT" ]] || rm -rf "$TMP_ROOT"

    if [[ "$exit_code" -ne 0 ]]; then
        printf '\n\033[31mSpeakEasy stopped while %s.\033[0m\n' "$CURRENT_STEP" >&2
        printf 'Nothing unsigned was installed. Fix the message above, then run the installer again.\n' >&2
    fi
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-open)
            OPEN_AFTER_INSTALL=0
            ;;
        --dmg)
            shift
            [[ $# -gt 0 ]] || die "--dmg needs a path."
            SOURCE_DMG="$1"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            die "Unknown option: $1"
            ;;
    esac
    shift
done

say_step "Checking this Mac"
[[ "$(uname -s)" == "Darwin" ]] || die "The native SpeakEasy app requires macOS."

is_apple_silicon=0
[[ "$(uname -m)" == "arm64" ]] && is_apple_silicon=1
[[ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" == "1" ]] && is_apple_silicon=1
[[ "$is_apple_silicon" == "1" ]] || die "SpeakEasy $VERSION requires an Apple silicon Mac."

macos_version="$(sw_vers -productVersion)"
macos_major="${macos_version%%.*}"
[[ "$macos_major" =~ ^[0-9]+$ && "$macos_major" -ge 14 ]] || die "SpeakEasy $VERSION requires macOS 14 or newer. This Mac has $macos_version."
[[ -w "/Applications" ]] || die "This account cannot write to /Applications. Sign in with an administrator account, or install manually from the DMG."

for command in curl shasum codesign spctl hdiutil ditto; do
    command -v "$command" >/dev/null 2>&1 || die "macOS is missing the required '$command' command."
done
say_ok "Apple silicon · macOS $macos_version"
say_ok "No Bun, Node, Xcode, or source checkout required"

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/speakeasy-install.XXXXXX")"
MOUNT_POINT="$TMP_ROOT/mount"
mkdir -p "$MOUNT_POINT"
DMG_PATH="$TMP_ROOT/SpeakEasy.dmg"
CHECKSUM_PATH="$TMP_ROOT/SpeakEasy-$VERSION.sha256"

if [[ -n "$SOURCE_DMG" ]]; then
    CURRENT_STEP="copying the local release"
    say_step "Loading the local release"
    [[ -f "$SOURCE_DMG" ]] || die "DMG not found: $SOURCE_DMG"
    ditto "$SOURCE_DMG" "$DMG_PATH"
    say_ok "Loaded $(basename "$SOURCE_DMG")"
else
    CURRENT_STEP="downloading the release"
    say_step "Downloading the exact v$VERSION release"
    curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$DMG_URL" --output "$DMG_PATH"
    curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 "$CHECKSUM_URL" --output "$CHECKSUM_PATH"
    say_ok "Downloaded SpeakEasy.dmg and its published checksum"

    CURRENT_STEP="verifying the published checksum"
    expected_checksum="$(awk '$2 == "SpeakEasy.dmg" { print $1; exit }' "$CHECKSUM_PATH")"
    [[ "$expected_checksum" =~ ^[0-9a-fA-F]{64}$ ]] || die "The release checksum file does not contain a valid SpeakEasy.dmg entry."
    actual_checksum="$(shasum -a 256 "$DMG_PATH" | awk '{ print $1 }')"
    [[ "$actual_checksum" == "$expected_checksum" ]] || die "The downloaded DMG does not match the published SHA-256 checksum."
    say_ok "SHA-256 $actual_checksum"
fi

CURRENT_STEP="asking Gatekeeper to verify the release"
say_step "Verifying Apple trust and release identity"
codesign --verify --strict --verbose=2 "$DMG_PATH"
gatekeeper_dmg="$(spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_PATH" 2>&1)" || {
    printf '%s\n' "$gatekeeper_dmg" >&2
    die "Gatekeeper rejected the release DMG."
}
printf '%s\n' "$gatekeeper_dmg" | grep -q 'source=Notarized Developer ID' || die "Gatekeeper did not identify the DMG as a notarized Developer ID release."
say_ok "Gatekeeper accepted the signed, notarized DMG"

CURRENT_STEP="auditing the app inside the DMG"
hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_POINT" -quiet
SOURCE_APP="$MOUNT_POINT/SpeakEasy.app"
[[ -d "$SOURCE_APP" ]] || die "The release does not contain SpeakEasy.app."

codesign --verify --deep --strict --verbose=2 "$SOURCE_APP"
gatekeeper_app="$(spctl --assess --type execute --verbose=2 "$SOURCE_APP" 2>&1)" || {
    printf '%s\n' "$gatekeeper_app" >&2
    die "Gatekeeper rejected SpeakEasy.app."
}
printf '%s\n' "$gatekeeper_app" | grep -q 'source=Notarized Developer ID' || die "Gatekeeper did not identify SpeakEasy.app as a notarized Developer ID release."

PLIST="$SOURCE_APP/Contents/Info.plist"
[[ -f "$PLIST" ]] || die "SpeakEasy.app is missing its Info.plist."
actual_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"
actual_bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")"
actual_team_id="$(codesign -dv --verbose=4 "$SOURCE_APP" 2>&1 | awk -F= '/^TeamIdentifier=/{ print $2; exit }')"

[[ "$actual_version" == "$VERSION" ]] || die "The DMG contains SpeakEasy $actual_version, not the requested $VERSION."
[[ "$actual_bundle_id" == "$EXPECTED_BUNDLE_ID" ]] || die "Unexpected app identity: $actual_bundle_id"
[[ "$actual_team_id" == "$EXPECTED_TEAM_ID" ]] || die "Unexpected Developer ID team: ${actual_team_id:-missing}"
say_ok "SpeakEasy $actual_version · $actual_bundle_id · team $actual_team_id"

CURRENT_STEP="stopping the previous SpeakEasy copy"
say_step "Installing safely in Applications"
osascript -e 'tell application "SpeakEasy" to quit' >/dev/null 2>&1 || true
for _ in {1..20}; do
    pgrep -f '^/Applications/SpeakEasy.app/Contents/MacOS/SpeakEasy( |$)' >/dev/null 2>&1 || break
    sleep 0.25
done

app_pids="$(pgrep -f '^/Applications/SpeakEasy.app/Contents/MacOS/SpeakEasy( |$)' || true)"
[[ -z "$app_pids" ]] || kill $app_pids >/dev/null 2>&1 || true

helper_pids="$(pgrep -f '^/Applications/SpeakEasy.app/Contents/Helpers/speakeasy-runtime deck$' || true)"
if [[ -n "$helper_pids" ]]; then
    kill $helper_pids >/dev/null 2>&1 || true
    for _ in {1..20}; do
        pgrep -f '^/Applications/SpeakEasy.app/Contents/Helpers/speakeasy-runtime deck$' >/dev/null 2>&1 || break
        sleep 0.25
    done
    helper_pids="$(pgrep -f '^/Applications/SpeakEasy.app/Contents/Helpers/speakeasy-runtime deck$' || true)"
    [[ -z "$helper_pids" ]] || kill -9 $helper_pids >/dev/null 2>&1 || true
fi

caddy_pids="$(pgrep -f '[/]caddy run --config .*/speakeasy-deck-[^/]*/Caddyfile( |$)' || true)"
[[ -z "$caddy_pids" ]] || kill $caddy_pids >/dev/null 2>&1 || true

STAGED_APP="/Applications/.SpeakEasy.installing.$$"
BACKUP_APP="/Applications/.SpeakEasy.backup.$$"
rm -rf "$STAGED_APP" "$BACKUP_APP"
ditto "$SOURCE_APP" "$STAGED_APP"
codesign --verify --deep --strict --verbose=2 "$STAGED_APP"

if [[ -e "$TARGET_APP" ]]; then
    mv "$TARGET_APP" "$BACKUP_APP"
fi
mv "$STAGED_APP" "$TARGET_APP"
STAGED_APP=""
rm -rf "$BACKUP_APP"
BACKUP_APP=""
say_ok "Installed $TARGET_APP"

if [[ "$OPEN_AFTER_INSTALL" == "1" ]]; then
    CURRENT_STEP="opening guided Deck setup"
    open "$TARGET_APP" --args --settings --deck-settings
    say_ok "Opened SpeakEasy Settings → Deck"
fi

CURRENT_STEP="finishing"
printf '\n\033[1;32mSpeakEasy %s is installed.\033[0m\n' "$VERSION"
printf 'The release, signature, Developer ID, and app version all passed.\n'
if [[ "$OPEN_AFTER_INSTALL" == "1" ]]; then
    printf 'In Deck settings, finish only the human steps macOS asks for: microphone and local-network access.\n'
    printf 'SpeakEasy will check the runtime, Codex, and live bridge before it shows a device link.\n'
fi
printf '\n'
