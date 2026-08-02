#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
RELEASE_REPO="${SPEAKEASY_RELEASE_REPO:-arach/SpeakEasy}"
RELEASE_TARGET="${SPEAKEASY_RELEASE_TARGET:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
VERSION="${SPEAKEASY_VERSION:-$(node -p "require(process.argv[1]).version" "$REPO_ROOT/package.json" 2>/dev/null || echo '0.0.0')}"
TAG="v${VERSION}"
MODE="dmg"
DRY_RUN=0
SKIP_BUILD=0
PRERELEASE=0
DRAFT=0
UPLOAD_TMP=""

cleanup() {
    if [ -n "$UPLOAD_TMP" ] && [ -d "$UPLOAD_TMP" ]; then
        rm -rf "$UPLOAD_TMP"
    fi
}
trap cleanup EXIT

usage() {
    cat <<'EOF'
Usage: ./tools/release/ship.sh [dmg] [--skip-build] [--prerelease|--draft] [--dry-run]

Build the signed/notarized DMG and upload it to the public GitHub release.

  --skip-build   Upload the already verified dist/SpeakEasy.dmg
  --prerelease   Publish as a test release without replacing Latest
  --draft        Create a private draft release
EOF
}

need_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Error: Missing required command: $1" >&2
        exit 1
    fi
}

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf 'DRY RUN:'
        printf ' %q' "$@"
        printf '\n'
        return 0
    fi
    "$@"
}

release_notes_file() {
    local notes_path="$1"

    cat > "$notes_path" <<EOF
Release $VERSION

SpeakEasy is now a dual-mode voice companion for Codex: explicit local dictation
goes to the exact task you choose, and the real response returns through the
native player.

### Install

1. Download \`SpeakEasy.dmg\`.
2. Drag SpeakEasy to Applications.
3. Open SpeakEasy and choose **Settings → Deck**.
4. Complete the three readiness checks, then open the device link.

The app is Developer ID signed, Apple-notarized, and self-contained. This build
supports Apple silicon Macs running macOS 14 or newer. Codex Desktop is required
for exact-task voice lanes; the system narration voice works without an API key.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        dmg)
            MODE="$1"
            ;;
        --dry-run)
            DRY_RUN=1
            ;;
        --skip-build)
            SKIP_BUILD=1
            ;;
        --prerelease)
            PRERELEASE=1
            ;;
        --draft)
            DRAFT=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Error: Unknown argument: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

need_cmd gh

case "$MODE" in
    dmg)
        ASSET_PATH="$DIST_DIR/SpeakEasy.dmg"
        if [ "$SKIP_BUILD" -eq 1 ]; then
            echo "==> Verifying existing DMG release asset..."
            run env SPEAKEASY_EXPECT_NOTARIZED=1 bash "$SCRIPT_DIR/verify-dmg.sh" "$ASSET_PATH" "$VERSION"
        else
            echo "==> Building DMG release asset..."
            run bash "$SCRIPT_DIR/build-dmg.sh" "$VERSION"
        fi
        ;;
esac

if [ "$DRY_RUN" -eq 0 ] && [ ! -f "$ASSET_PATH" ]; then
    echo "Error: Expected asset not found: $ASSET_PATH" >&2
    exit 1
fi

NOTES_PATH=""
if [ "$DRY_RUN" -eq 0 ]; then
    UPLOAD_TMP="$(mktemp -d)"
    NOTES_PATH="$UPLOAD_TMP/release-notes.md"
    release_notes_file "$NOTES_PATH"
else
    NOTES_PATH="\$RUNNER_TEMP/release-notes.md"
fi

UPLOAD_PATHS=("$ASSET_PATH")
VERSIONED_DMG_PATH="${UPLOAD_TMP:-$DIST_DIR}/SpeakEasy-$VERSION.dmg"
CHECKSUM_PATH="${UPLOAD_TMP:-$DIST_DIR}/SpeakEasy-$VERSION.sha256"
if [ "$DRY_RUN" -eq 0 ]; then
    cp "$ASSET_PATH" "$VERSIONED_DMG_PATH"
    checksum="$(shasum -a 256 "$ASSET_PATH" | awk '{print $1}')"
    printf '%s  %s\n%s  %s\n' \
        "$checksum" "SpeakEasy.dmg" \
        "$checksum" "SpeakEasy-$VERSION.dmg" > "$CHECKSUM_PATH"
else
    run cp "$ASSET_PATH" "$VERSIONED_DMG_PATH"
fi
UPLOAD_PATHS+=("$VERSIONED_DMG_PATH" "$CHECKSUM_PATH")

release_flags=()
[ "$PRERELEASE" -eq 0 ] || release_flags+=(--prerelease)
[ "$DRAFT" -eq 0 ] || release_flags+=(--draft)

if [ "$DRY_RUN" -eq 1 ]; then
    echo "==> DRY RUN: would create or update GitHub release $TAG in $RELEASE_REPO"
elif gh release view "$TAG" --repo "$RELEASE_REPO" >/dev/null 2>&1; then
    echo "==> Updating GitHub release $TAG in $RELEASE_REPO..."
    edit_flags=()
    [ "$PRERELEASE" -eq 0 ] || edit_flags+=(--prerelease=true)
    [ "$DRAFT" -eq 0 ] || edit_flags+=(--draft=true)
    run gh release edit "$TAG" --repo "$RELEASE_REPO" --title "SpeakEasy $VERSION" --notes-file "$NOTES_PATH" "${edit_flags[@]}"
else
    echo "==> Creating GitHub release $TAG in $RELEASE_REPO..."
    run gh release create "$TAG" --repo "$RELEASE_REPO" --target "$RELEASE_TARGET" --title "SpeakEasy $VERSION" --notes-file "$NOTES_PATH" "${release_flags[@]}"
fi

echo "==> Uploading release asset(s)..."
run gh release upload "$TAG" "${UPLOAD_PATHS[@]}" --repo "$RELEASE_REPO" --clobber

echo ""
if [ "$DRY_RUN" -eq 1 ]; then
    echo "==> Dry run complete for $TAG in $RELEASE_REPO"
else
    echo "==> Shipped $TAG to $RELEASE_REPO"
fi
