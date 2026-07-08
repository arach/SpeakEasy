#!/usr/bin/env bash
# Shared release helpers for the SpeakEasy macOS companion.

speakeasy_release_root() {
    cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

speakeasy_repo_root() {
    cd "$(speakeasy_release_root)/.." && pwd
}

speakeasy_default_version() {
    local root
    root="$(speakeasy_repo_root)"
    if command -v node >/dev/null 2>&1; then
        node -p "require(process.argv[1]).version" "$root/package.json" 2>/dev/null || echo "0.0.0"
    else
        echo "0.0.0"
    fi
}

speakeasy_default_sign_identity() {
    security find-identity -v -p codesigning 2>/dev/null \
        | sed -n 's/^[[:space:]]*[0-9]*)[[:space:]]*\([A-F0-9]\{40\}\)[[:space:]]*"Developer ID Application:[^"]*".*/\1/p' \
        | head -n 1
}

speakeasy_fallback_sign_identity() {
    security find-identity -v -p codesigning 2>/dev/null \
        | sed -n 's/^[[:space:]]*[0-9]*)[[:space:]]*\([A-F0-9]\{40\}\)[[:space:]]*"Apple Development:[^"]*".*/\1/p' \
        | head -n 1
}

speakeasy_bundle_id() {
    echo "com.speakeasy.config"
}

speakeasy_copy_framework() {
    local framework_name="$1"
    local search_root="$2"
    local destination="$3"
    local source

    source="$(find "$search_root" -maxdepth 8 -path "*/$framework_name" -type d 2>/dev/null | head -n 1 || true)"
    if [[ -z "$source" ]]; then
        return 1
    fi

    ditto "$source" "$destination/$framework_name"
}

speakeasy_bundle_swiftpm_frameworks() {
    local executable="$1"
    local build_bin_dir="$2"
    local frameworks_dir="$3"
    local artifacts_dir="$4"
    local framework_names=()
    local framework_name

    while IFS= read -r framework_name; do
        framework_names+=("$framework_name")
    done < <(
        otool -L "$executable" \
            | awk '/@rpath\/.*\.framework\// { split($1, parts, "/"); print parts[2] }' \
            | sort -u
    )

    if (( ${#framework_names[@]} == 0 )); then
        return 0
    fi

    mkdir -p "$frameworks_dir"
    for framework_name in "${framework_names[@]}"; do
        if speakeasy_copy_framework "$framework_name" "$build_bin_dir" "$frameworks_dir"; then
            continue
        fi
        if speakeasy_copy_framework "$framework_name" "$artifacts_dir" "$frameworks_dir"; then
            continue
        fi

        echo "Could not find required framework: $framework_name" >&2
        return 1
    done

    if ! otool -l "$executable" | grep -q '@executable_path/../Frameworks'; then
        install_name_tool -add_rpath "@executable_path/../Frameworks" "$executable"
    fi
}

speakeasy_bundle_app() {
    local app_root="$1"
    local bundle_path="$2"
    local build_dir="$app_root/.build/release"
    local executable_path="$bundle_path/Contents/MacOS/SpeakEasy"

    rm -rf "$bundle_path"
    mkdir -p "$bundle_path/Contents/MacOS"
    mkdir -p "$bundle_path/Contents/Resources"

    cp "$build_dir/SpeakEasy" "$executable_path"
    chmod +x "$executable_path"

    echo "Bundling HudsonKit frameworks..."
    speakeasy_bundle_swiftpm_frameworks \
        "$executable_path" \
        "$build_dir" \
        "$bundle_path/Contents/Frameworks" \
        "$app_root/.build/artifacts"

    for fw in "$build_dir"/*.framework; do
        [ -e "$fw" ] || continue
        ditto "$fw" "$bundle_path/Contents/MacOS/$(basename "$fw")"
    done

    cp "$app_root/Resources/Info.plist" "$bundle_path/Contents/"

    if [ -f "$app_root/Resources/hud-preview-sample.aiff" ]; then
        cp "$app_root/Resources/hud-preview-sample.aiff" "$bundle_path/Contents/Resources/"
    fi

    echo "Generating app icon..."
    chmod +x "$app_root/Scripts/generate_icon.swift"
    swift "$app_root/Scripts/generate_icon.swift" "$bundle_path/Contents/Resources"

    printf 'APPL????' > "$bundle_path/Contents/PkgInfo"
}

speakeasy_set_bundle_version() {
    local bundle_path="$1"
    local version="$2"
    local plist="$bundle_path/Contents/Info.plist"

    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $version" "$plist"
}