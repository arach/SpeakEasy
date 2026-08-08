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

speakeasy_caddy_version() {
    echo "2.11.4"
}

speakeasy_caddy_archive_sha256() {
    echo "9efb0af2d6cf09cfb5053c0e51721b9b3d4956d346234f39368d943d25a3c9a7"
}

speakeasy_caddy_binary_sha256() {
    echo "e9ebf99dfd4b72259debe1830c83e86c63fb89a88e28b4e7c5e78a35fa76c92d"
}

speakeasy_verify_sha256() {
    local file_path="$1"
    local expected="$2"
    local label="$3"
    local actual

    actual="$(shasum -a 256 "$file_path" | awk '{ print $1 }')"
    if [ "$actual" != "$expected" ]; then
        echo "$label SHA-256 mismatch: expected $expected, found $actual" >&2
        return 1
    fi
}

speakeasy_verify_caddy_identity() {
    local candidate="$1"
    local expected_version="$2"
    local actual_version

    if [ ! -x "$candidate" ]; then
        echo "Caddy is missing or not executable: $candidate" >&2
        return 1
    fi

    actual_version="$("$candidate" version 2>/dev/null | awk '{ print $1 }')"
    if [ "$actual_version" != "v$expected_version" ]; then
        echo "Caddy $expected_version is required, found ${actual_version:-unknown}: $candidate" >&2
        return 1
    fi

    if ! file "$candidate" | grep -q 'arm64'; then
        echo "Caddy must contain an arm64 executable: $candidate" >&2
        return 1
    fi
}

speakeasy_verify_caddy_source() {
    local candidate="$1"
    local expected_version="$2"

    speakeasy_verify_caddy_identity "$candidate" "$expected_version"
    speakeasy_verify_sha256 \
        "$candidate" \
        "$(speakeasy_caddy_binary_sha256)" \
        "Caddy $expected_version binary"
}

# Resolve a reproducible arm64 Caddy helper for the release bundle. An explicit
# path wins; otherwise use a matching PATH binary or fetch the pinned official
# GitHub release and verify both the archive and extracted binary against
# immutable SHA-256 digests pinned in this source tree.
speakeasy_prepare_caddy() {
    local app_root="$1"
    local version="$(speakeasy_caddy_version)"
    local override="${SPEAKEASY_CADDY_PATH:-}"
    local candidate=""
    local tools_dir="$app_root/.build/tools"
    local cached
    local archive_name
    local release_url
    local temp_dir

    version="${version#v}"
    cached="$tools_dir/caddy-$version"
    archive_name="caddy_${version}_mac_arm64.tar.gz"
    release_url="https://github.com/caddyserver/caddy/releases/download/v${version}"

    if [ -n "$override" ]; then
        if ! speakeasy_verify_caddy_source "$override" "$version"; then
            echo "SPEAKEASY_CADDY_PATH must point to the pinned release helper." >&2
            return 1
        fi
        echo "$override"
        return 0
    fi

    candidate="$(command -v caddy 2>/dev/null || true)"
    if [ -n "$candidate" ] && speakeasy_verify_caddy_source "$candidate" "$version" >/dev/null 2>&1; then
        echo "$candidate"
        return 0
    fi

    if speakeasy_verify_caddy_source "$cached" "$version" >/dev/null 2>&1; then
        echo "$cached"
        return 0
    fi

    if ! command -v curl >/dev/null 2>&1; then
        echo "curl is required to fetch the pinned Caddy helper." >&2
        return 1
    fi

    mkdir -p "$tools_dir"
    temp_dir="$(mktemp -d)"
    echo "Fetching pinned Caddy v$version for the secure Deck..." >&2
    if ! curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
        "$release_url/$archive_name" -o "$temp_dir/$archive_name"; then
        rm -rf "$temp_dir"
        echo "Could not download the pinned Caddy release." >&2
        return 1
    fi

    if ! speakeasy_verify_sha256 \
        "$temp_dir/$archive_name" \
        "$(speakeasy_caddy_archive_sha256)" \
        "Caddy $version archive"; then
        rm -rf "$temp_dir"
        echo "Caddy archive checksum verification failed." >&2
        return 1
    fi

    if ! tar -xzf "$temp_dir/$archive_name" -C "$temp_dir" caddy; then
        rm -rf "$temp_dir"
        echo "Could not extract the Caddy release helper." >&2
        return 1
    fi
    chmod +x "$temp_dir/caddy"
    if ! speakeasy_verify_caddy_source "$temp_dir/caddy" "$version"; then
        rm -rf "$temp_dir"
        return 1
    fi
    mv "$temp_dir/caddy" "$cached"
    rm -rf "$temp_dir"
    echo "$cached"
}

speakeasy_build_deck_runtime() {
    local app_root="$1"
    local repo_root
    repo_root="$(speakeasy_repo_root)"

    if ! command -v bun >/dev/null 2>&1; then
        echo "Bun is required to compile the bundled deck runtime." >&2
        return 1
    fi

    echo "Compiling the self-contained deck runtime..."
    bun build "$repo_root/src/bin/speakeasy-cli.ts" \
        --compile \
        --target=bun-darwin-arm64 \
        --outfile "$app_root/.build/release/speakeasy-runtime"
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

speakeasy_bundle_swiftpm_resources() {
    local build_bin_dir="$1"
    local resources_dir="$2"
    local resource_bundle

    while IFS= read -r -d '' resource_bundle; do
        ditto "$resource_bundle" "$resources_dir/$(basename "$resource_bundle")"
    done < <(find -L "$build_bin_dir" -maxdepth 1 -type d -name '*.bundle' -print0)
}

speakeasy_verify_bundle_layout() {
    local bundle_path="$1"
    local executable="$bundle_path/Contents/MacOS/SpeakEasy"
    local deck_runtime="$bundle_path/Contents/Helpers/speakeasy-runtime"
    local caddy_helper="$bundle_path/Contents/Helpers/caddy"
    local frameworks_dir="$bundle_path/Contents/Frameworks"
    local resources_dir="$bundle_path/Contents/Resources"
    local info_plist="$bundle_path/Contents/Info.plist"
    local pad_index
    local framework_name

    if [ ! -x "$executable" ]; then
        echo "Bundle executable is missing or not executable: $executable" >&2
        return 1
    fi

    if [ ! -x "$deck_runtime" ]; then
        echo "Bundled deck runtime is missing or not executable: $deck_runtime" >&2
        return 1
    fi

    if ! speakeasy_verify_caddy_source "$caddy_helper" "$(speakeasy_caddy_version)"; then
        echo "Bundled secure Deck helper is invalid: $caddy_helper" >&2
        return 1
    fi

    if [ ! -s "$resources_dir/Deck/index.html" ]; then
        echo "Bundled deck surface is missing: Contents/Resources/Deck/index.html" >&2
        return 1
    fi

    if [ ! -s "$resources_dir/ThirdPartyNotices/Caddy-LICENSE.txt" ]; then
        echo "Bundled Caddy license notice is missing." >&2
        return 1
    fi

    for resource in \
        "$resources_dir/SpeakEasy_SpeakEasy.bundle/codex-desktop-bridge.cjs" \
        "$resources_dir/SpeakEasy_SpeakEasy.bundle/codex-luna-presenter.cjs" \
        "$resources_dir/SpeakEasy_SpeakEasy.bundle/Pad/index.html"; do
        if [ ! -s "$resource" ]; then
            echo "SwiftPM runtime resource is missing from Contents/Resources: $resource" >&2
            return 1
        fi
    done

    if find "$bundle_path/Contents/MacOS" -maxdepth 1 -type d -name '*.framework' -print -quit \
        | grep -q .; then
        echo "Frameworks must live only in Contents/Frameworks, not Contents/MacOS." >&2
        return 1
    fi

    while IFS= read -r framework_name; do
        if [ ! -d "$frameworks_dir/$framework_name" ]; then
            echo "Linked framework is missing from the app bundle: $framework_name" >&2
            return 1
        fi
    done < <(
        otool -L "$executable" \
            | awk '/@rpath\/.*\.framework\// { split($1, parts, "/"); print parts[2] }' \
            | sort -u
    )

    pad_index="$(find "$resources_dir" -type f -path '*/Pad/index.html' -print -quit 2>/dev/null || true)"
    if [ -z "$pad_index" ]; then
        echo "Bundled SpeakEasy Pad index.html is missing." >&2
        return 1
    fi

    local pad_dir
    pad_dir="$(dirname "$pad_index")"
    for pad_asset in app.js app.css; do
        if [ ! -s "$pad_dir/$pad_asset" ]; then
            echo "Bundled SpeakEasy Pad asset is missing or empty: $pad_asset" >&2
            return 1
        fi
    done

    if [ -z "$(/usr/libexec/PlistBuddy -c 'Print :NSLocalNetworkUsageDescription' "$info_plist" 2>/dev/null || true)" ]; then
        echo "NSLocalNetworkUsageDescription is missing from the app bundle." >&2
        return 1
    fi

    local bonjour_services
    bonjour_services="$(/usr/libexec/PlistBuddy -c 'Print :NSBonjourServices' "$info_plist" 2>/dev/null || true)"
    for service in '_http._tcp' '_speakeasy-pad._tcp'; do
        if ! grep -Fq "$service" <<<"$bonjour_services"; then
            echo "Required Bonjour service is missing from the app bundle: $service" >&2
            return 1
        fi
    done
}

speakeasy_verify_signed_bundle() {
    local bundle_path="$1"
    local signed_entitlements

    codesign --verify --deep --strict --verbose=2 "$bundle_path"

    signed_entitlements="$({ codesign -d --entitlements :- "$bundle_path" 2>&1 \
        | sed -n '/<?xml/,$p' \
        | plutil -p - 2>/dev/null; } || true)"
    if ! grep -Fq '"com.apple.security.network.server" => true' <<<"$signed_entitlements"; then
        echo "Signed app is missing com.apple.security.network.server=true." >&2
        return 1
    fi
}

speakeasy_bundle_app() {
    local app_root="$1"
    local bundle_path="$2"
    local build_dir="$app_root/.build/release"
    local executable_path="$bundle_path/Contents/MacOS/SpeakEasy"
    local helper_path="$bundle_path/Contents/Helpers/speakeasy-runtime"
    local caddy_path="$bundle_path/Contents/Helpers/caddy"
    local caddy_source
    local repo_root
    repo_root="$(speakeasy_repo_root)"

    if [[ -d "$build_dir" ]]; then
        build_dir="$(cd "$build_dir" && pwd -P)"
    fi

    rm -rf "$bundle_path"
    mkdir -p "$bundle_path/Contents/MacOS"
    mkdir -p "$bundle_path/Contents/Helpers"
    mkdir -p "$bundle_path/Contents/Resources"

    cp "$build_dir/SpeakEasy" "$executable_path"
    chmod +x "$executable_path"

    cp "$build_dir/speakeasy-runtime" "$helper_path"
    chmod +x "$helper_path"

    caddy_source="$(speakeasy_prepare_caddy "$app_root")"
    cp -L "$caddy_source" "$caddy_path"
    chmod +x "$caddy_path"

    echo "Bundling HudsonKit frameworks..."
    speakeasy_bundle_swiftpm_frameworks \
        "$executable_path" \
        "$build_dir" \
        "$bundle_path/Contents/Frameworks" \
        "$app_root/.build/artifacts"

    speakeasy_bundle_swiftpm_resources \
        "$build_dir" \
        "$bundle_path/Contents/Resources"

    mkdir -p "$bundle_path/Contents/Resources/Deck"
    cp "$repo_root/deck/index.html" "$bundle_path/Contents/Resources/Deck/"
    cp "$repo_root/deck/themes.json" "$bundle_path/Contents/Resources/Deck/"
    ditto "$repo_root/deck/variants" "$bundle_path/Contents/Resources/Deck/variants"

    cp "$app_root/Resources/Info.plist" "$bundle_path/Contents/"

    if [ -d "$app_root/Resources/ThirdPartyNotices" ]; then
        ditto "$app_root/Resources/ThirdPartyNotices" "$bundle_path/Contents/Resources/ThirdPartyNotices"
    fi

    if [ -f "$app_root/Resources/hud-preview-sample.aiff" ]; then
        cp "$app_root/Resources/hud-preview-sample.aiff" "$bundle_path/Contents/Resources/"
    fi

    # One mark, every platform: the iPad Deck, this bundle, and the site all
    # render from design/icon/speakeasy-icon.swift so they cannot drift apart.
    echo "Generating app icon..."
    swift "$repo_root/design/icon/speakeasy-icon.swift" macos "$bundle_path/Contents/Resources"

    printf 'APPL????' > "$bundle_path/Contents/PkgInfo"
}

speakeasy_set_bundle_version() {
    local bundle_path="$1"
    local version="$2"
    local plist="$bundle_path/Contents/Info.plist"

    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $version" "$plist"
}
