#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 1 ] || [[ "$1" != /* ]]; then
    echo "Usage: package-skill.sh /absolute/path/speakeasy-skill.zip" >&2
    exit 64
fi

OUTPUT_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(cd "$SCRIPT_DIR/../skills" && pwd)"

if [ -e "$OUTPUT_PATH" ]; then
    echo "Refusing to overwrite existing archive: $OUTPUT_PATH" >&2
    exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
(
    cd "$SKILLS_DIR"
    COPYFILE_DISABLE=1 /usr/bin/zip -X -q -r "$OUTPUT_PATH" speakeasy \
        -x '*/.DS_Store' '*/__MACOSX/*'
)

/usr/bin/unzip -tq "$OUTPUT_PATH" >/dev/null
echo "Packaged SpeakEasy skill: $OUTPUT_PATH"
