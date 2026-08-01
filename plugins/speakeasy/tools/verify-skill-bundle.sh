#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VERIFY_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/speakeasy-skill-verify.XXXXXX")"

cleanup() {
    rm -rf -- "$VERIFY_TEMP_DIR"
}
trap cleanup EXIT

cd "$REPO_ROOT"
bun run build:plugin-runtime
chmod 0755 plugins/speakeasy/skills/speakeasy/runtime/speakeasy-cli.js

"$SCRIPT_DIR/package-skill.sh" "$VERIFY_TEMP_DIR/speakeasy-skill.zip"
mkdir "$VERIFY_TEMP_DIR/extracted"
/usr/bin/unzip -q "$VERIFY_TEMP_DIR/speakeasy-skill.zip" -d "$VERIFY_TEMP_DIR/extracted"

test -s "$VERIFY_TEMP_DIR/extracted/speakeasy/runtime/speakeasy-cli.js"
cd "$VERIFY_TEMP_DIR/extracted"
bun speakeasy/scripts/speakeasy-runtime.ts --help >/dev/null

echo "Verified isolated SpeakEasy skill bundle."
