#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

BUNDLE_PATH="${1:-}"
SIGN_STRICT="${SPEAKEASY_SIGN_STRICT:-0}"
SKIP_SIGN="${SPEAKEASY_SKIP_SIGN:-0}"
SIGN_IDENTITY="${SPEAKEASY_SIGN_IDENTITY:-}"
ENTITLEMENTS="${SPEAKEASY_ENTITLEMENTS:-$(speakeasy_release_root)/SpeakEasy.entitlements}"
BUNDLE_ID="${SPEAKEASY_BUNDLE_ID:-$(speakeasy_bundle_id)}"

usage() {
    cat <<'EOF'
Usage: ./tools/release/sign-bundle.sh <SpeakEasy.app>

Environment:
  SPEAKEASY_SKIP_SIGN=1       Skip signing
  SPEAKEASY_SIGN_STRICT=1     Require Developer ID (no ad-hoc fallback)
  SPEAKEASY_SIGN_IDENTITY=…   Override signing identity hash
  SPEAKEASY_ENTITLEMENTS=…    Entitlements plist path
EOF
}

if [ -z "$BUNDLE_PATH" ] || [ ! -d "$BUNDLE_PATH" ]; then
    usage >&2
    exit 1
fi

if [ "$SKIP_SIGN" = "1" ]; then
    echo "==> Skipping signing because SPEAKEASY_SKIP_SIGN=1"
    exit 0
fi

resolve_identity() {
    if [ -n "$SIGN_IDENTITY" ]; then
        echo "$SIGN_IDENTITY"
        return 0
    fi

    local developer_id
    developer_id="$(speakeasy_default_sign_identity || true)"
    if [ -n "$developer_id" ]; then
        echo "$developer_id"
        return 0
    fi

    if [ "$SIGN_STRICT" = "1" ]; then
        return 1
    fi

    speakeasy_fallback_sign_identity || true
}

run_codesign() {
    codesign "$@"
}

sign_path() {
    local target="$1"
    local identity="$2"
    local use_entitlements="${3:-0}"

    local args=(--force --options runtime --timestamp --sign "$identity")
    if [ "$use_entitlements" = "1" ] && [ -f "$ENTITLEMENTS" ]; then
        args+=(--entitlements "$ENTITLEMENTS")
    fi
    args+=("$target")
    run_codesign "${args[@]}"
}

sign_framework() {
    local framework_path="$1"
    local identity="$2"
    local framework_name binary_path

    framework_name="$(basename "$framework_path" .framework)"
    binary_path="$framework_path/$framework_name"
    if [ ! -f "$binary_path" ]; then
        return 0
    fi

    sign_path "$binary_path" "$identity" 0
    sign_path "$framework_path" "$identity" 0
}

sign_bundle_with_identity() {
    local identity="$1"
    local label="$2"
    local executable="$BUNDLE_PATH/Contents/MacOS/SpeakEasy"
    local framework_path

    echo "==> Signing ($label)..."

    for framework_path in \
        "$BUNDLE_PATH"/Contents/Frameworks/*.framework \
        "$BUNDLE_PATH"/Contents/MacOS/*.framework; do
        [ -e "$framework_path" ] || continue
        sign_framework "$framework_path" "$identity"
    done

    sign_path "$executable" "$identity" 1

    local bundle_args=(--force --options runtime --timestamp --sign "$identity" --identifier "$BUNDLE_ID")
    if [ -f "$ENTITLEMENTS" ]; then
        bundle_args+=(--entitlements "$ENTITLEMENTS")
    fi
    bundle_args+=("$BUNDLE_PATH")
    run_codesign "${bundle_args[@]}"

    if codesign -dv "$BUNDLE_PATH" 2>&1 | grep -q 'TeamIdentifier=not set'; then
        if [ "$label" = "ad-hoc" ]; then
            echo "    Signed ad-hoc (TeamIdentifier not set)"
            return 0
        fi
        echo "Error: codesign reported no TeamIdentifier after $label signing" >&2
        return 1
    fi

    codesign --verify --deep --strict --verbose=2 "$BUNDLE_PATH" 2>&1 | tail -3
}

IDENTITY="$(resolve_identity || true)"
if [ -z "$IDENTITY" ]; then
    if [ "$SIGN_STRICT" = "1" ]; then
        echo "Error: No Developer ID signing identity found." >&2
        echo "Set SPEAKEASY_SIGN_IDENTITY or install a Developer ID Application certificate." >&2
        exit 1
    fi

    echo "Warning: no signing identity found — using ad-hoc signature."
    sign_bundle_with_identity "-" "ad-hoc"
    exit 0
fi

echo "    Sign identity: $IDENTITY"
if sign_bundle_with_identity "$IDENTITY" "developer"; then
    exit 0
fi

if [ "$SIGN_STRICT" = "1" ]; then
    exit 1
fi

echo "Warning: developer signing failed — falling back to ad-hoc."
sign_bundle_with_identity "-" "ad-hoc"