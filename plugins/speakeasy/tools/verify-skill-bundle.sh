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

# The portable manifest (plugin.json, agent-plugins.org spec) and the Codex
# submission manifest (.codex-plugin/plugin.json) describe one plugin — refuse
# to package if they drift on identity or base version.
bun -e '
const root = await Bun.file("plugins/speakeasy/plugin.json").json();
const codex = await Bun.file("plugins/speakeasy/.codex-plugin/plugin.json").json();
if (root.name !== codex.name) throw new Error(`manifest name drift: ${root.name} vs ${codex.name}`);
if (root.version !== codex.version.split("+")[0]) throw new Error(`manifest version drift: ${root.version} vs ${codex.version}`);
'

bun run build:plugin-runtime
chmod 0755 plugins/speakeasy/skills/speakeasy/runtime/speakeasy-cli.js

"$SCRIPT_DIR/package-skill.sh" "$VERIFY_TEMP_DIR/speakeasy-skill.zip"
mkdir "$VERIFY_TEMP_DIR/extracted"
/usr/bin/unzip -q "$VERIFY_TEMP_DIR/speakeasy-skill.zip" -d "$VERIFY_TEMP_DIR/extracted"

test -s "$VERIFY_TEMP_DIR/extracted/speakeasy/runtime/speakeasy-cli.js"
cd "$VERIFY_TEMP_DIR/extracted"
bun speakeasy/scripts/speakeasy-runtime.ts --help >/dev/null

echo "Verified isolated SpeakEasy skill bundle."
