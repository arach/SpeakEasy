#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$REPO_ROOT"
PLUGIN_VERSION="$(bun -e 'const manifest = await Bun.file("plugins/speakeasy/.codex-plugin/plugin.json").json(); process.stdout.write(manifest.version)')"
VERSION="${PLUGIN_VERSION%%+*}"
DEFAULT_OUTPUT="$REPO_ROOT/dist/speakeasy-skill-$VERSION.zip"
OUTPUT_PATH="${1:-$DEFAULT_OUTPUT}"

if [[ "$OUTPUT_PATH" != /* ]]; then
    echo "Usage: build-submission.sh [/absolute/path/speakeasy-skill.zip]" >&2
    exit 64
fi

if [ -e "$OUTPUT_PATH" ] || [ -e "$OUTPUT_PATH.sha256" ]; then
    echo "Refusing to overwrite an existing submission artifact: $OUTPUT_PATH" >&2
    exit 1
fi

"$SCRIPT_DIR/verify-skill-bundle.sh"
"$SCRIPT_DIR/package-skill.sh" "$OUTPUT_PATH"

OUTPUT_DIR="$(dirname "$OUTPUT_PATH")"
OUTPUT_NAME="$(basename "$OUTPUT_PATH")"
(
    cd "$OUTPUT_DIR"
    shasum -a 256 "$OUTPUT_NAME" > "$OUTPUT_NAME.sha256"
)

echo "Submission artifact: $OUTPUT_PATH"
echo "SHA-256: $OUTPUT_PATH.sha256"
