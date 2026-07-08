#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="SpeakEasy"
BUNDLE_NAME="SpeakEasy.app"
BUILD_DIR="$SCRIPT_DIR/.build/release"
APP_DIR="$SCRIPT_DIR/$BUNDLE_NAME"
INSTALL=false

copy_framework() {
    local framework_name="$1"
    local search_root="$2"
    local destination="$3"
    local source

    source="$(find "$search_root" -maxdepth 8 -path "*/$framework_name" -type d 2>/dev/null | head -n 1 || true)"
    if [[ -z "$source" ]]; then
        return 1
    fi

    ditto "$source" "$destination/$framework_name"
    return 0
}

bundle_swiftpm_frameworks() {
    local executable="$1"
    local build_bin_dir="$2"
    local frameworks_dir="$3"
    local framework_names=()
    local framework_name

    while IFS= read -r framework_name; do
        framework_names+=("$framework_name")
    done < <(
        otool -L "$executable" |
            awk '/@rpath\/.*\.framework\// { split($1, parts, "/"); print parts[2] }' |
            sort -u
    )

    if (( ${#framework_names[@]} == 0 )); then
        return 0
    fi

    mkdir -p "$frameworks_dir"
    for framework_name in "${framework_names[@]}"; do
        if copy_framework "$framework_name" "$build_bin_dir" "$frameworks_dir"; then
            continue
        fi
        if copy_framework "$framework_name" "$SCRIPT_DIR/.build/artifacts" "$frameworks_dir"; then
            continue
        fi

        echo "Could not find required framework: $framework_name" >&2
        exit 1
    done

    if ! otool -l "$executable" | grep -q '@executable_path/../Frameworks'; then
        install_name_tool -add_rpath "@executable_path/../Frameworks" "$executable"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--install)
            INSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-i|--install]"
            echo "  -i, --install    Install to /Applications after building"
            exit 1
            ;;
    esac
done

echo "Building SpeakEasy..."

# Build release version
swift build -c release

echo "Creating app bundle..."

# Create app bundle structure
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy executable
cp "$BUILD_DIR/SpeakEasy" "$APP_DIR/Contents/MacOS/SpeakEasy"
chmod +x "$APP_DIR/Contents/MacOS/SpeakEasy"

# Bundle HudsonKit frameworks. The binary links them via @rpath/@loader_path;
# without this the app aborts at launch with "Library not loaded".
echo "Bundling HudsonKit frameworks..."
bundle_swiftpm_frameworks "$APP_DIR/Contents/MacOS/SpeakEasy" "$BUILD_DIR" "$APP_DIR/Contents/Frameworks"
for fw in "$BUILD_DIR"/*.framework; do
    [ -e "$fw" ] || continue
    ditto "$fw" "$APP_DIR/Contents/MacOS/$(basename "$fw")"
done

# Copy Info.plist
cp "$SCRIPT_DIR/Resources/Info.plist" "$APP_DIR/Contents/"

# Copy audio resources
if [ -f "$SCRIPT_DIR/Resources/hud-preview-sample.aiff" ]; then
    cp "$SCRIPT_DIR/Resources/hud-preview-sample.aiff" "$APP_DIR/Contents/Resources/"
fi

# Generate icon
echo "Generating app icon..."
chmod +x "$SCRIPT_DIR/Scripts/generate_icon.swift"
swift "$SCRIPT_DIR/Scripts/generate_icon.swift" "$APP_DIR/Contents/Resources"

# Create PkgInfo
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

# Sign the app (ad-hoc for local use)
echo "Signing app..."
codesign --force --deep --sign - "$APP_DIR"

echo ""
echo "App bundle created: $APP_DIR"
echo ""

if [ "$INSTALL" = true ]; then
    echo "Installing to /Applications..."
    # Remove old version first
    rm -rf "/Applications/$BUNDLE_NAME"
    cp -R "$APP_DIR" /Applications/
    echo "Installed to /Applications/$BUNDLE_NAME"
    echo ""
    echo "To run:"
    echo "  open \"/Applications/$BUNDLE_NAME\""
else
    echo "To install to Applications:"
    echo "  cp -R \"$APP_DIR\" /Applications/"
    echo ""
    echo "Or run directly:"
    echo "  open \"$APP_DIR\""
    echo ""
    echo "To build and install in one step, use:"
    echo "  ./build-app.sh --install"
fi
