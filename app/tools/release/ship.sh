#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
RELEASE_REPO="${SPEAKEASY_RELEASE_REPO:-arach/SpeakEasy}"
RELEASE_TARGET="${SPEAKEASY_RELEASE_TARGET:-master}"
VERSION="${SPEAKEASY_VERSION:-$(node -p "require(process.argv[1]).version" "$REPO_ROOT/package.json" 2>/dev/null || echo '0.0.0')}"
TAG="v${VERSION}"
MODE="dmg"
DRY_RUN=0
UPLOAD_TMP=""

cleanup() {
    if [ -n "$UPLOAD_TMP" ] && [ -d "$UPLOAD_TMP" ]; then
        rm -rf "$UPLOAD_TMP"
    fi
}
trap cleanup EXIT

usage() {
    cat <<'EOF'
Usage: ./tools/release/ship.sh [dmg] [--dry-run]

Build the signed/notarized DMG and upload it to the public GitHub release.
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

Download \`SpeakEasy.dmg\` for the macOS companion app, or run \`speakeasy --app\` / \`speakeasy --update-app\` to install automatically.
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
        echo "==> Building DMG release asset..."
        run bash "$SCRIPT_DIR/build-dmg.sh" "$VERSION"
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
if [ "$DRY_RUN" -eq 0 ]; then
    cp "$ASSET_PATH" "$VERSIONED_DMG_PATH"
else
    run cp "$ASSET_PATH" "$VERSIONED_DMG_PATH"
fi
UPLOAD_PATHS+=("$VERSIONED_DMG_PATH")

if [ "$DRY_RUN" -eq 1 ]; then
    echo "==> DRY RUN: would create or update GitHub release $TAG in $RELEASE_REPO"
elif gh release view "$TAG" --repo "$RELEASE_REPO" >/dev/null 2>&1; then
    echo "==> Updating GitHub release $TAG in $RELEASE_REPO..."
    run gh release edit "$TAG" --repo "$RELEASE_REPO" --title "SpeakEasy $VERSION" --notes-file "$NOTES_PATH"
else
    echo "==> Creating GitHub release $TAG in $RELEASE_REPO..."
    run gh release create "$TAG" --repo "$RELEASE_REPO" --target "$RELEASE_TARGET" --title "SpeakEasy $VERSION" --notes-file "$NOTES_PATH"
fi

echo "==> Uploading release asset(s)..."
run gh release upload "$TAG" "${UPLOAD_PATHS[@]}" --repo "$RELEASE_REPO" --clobber

echo ""
if [ "$DRY_RUN" -eq 1 ]; then
    echo "==> Dry run complete for $TAG in $RELEASE_REPO"
else
    echo "==> Shipped $TAG to $RELEASE_REPO"
fi