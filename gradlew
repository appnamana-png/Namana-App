#!/usr/bin/env bash
# Universal Gradle wrapper for root repository execution (compatible with apk-builder-action)
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure android directory gradlew is executable
if [ -f "$DIR/android/gradlew" ]; then
    chmod +x "$DIR/android/gradlew" 2>/dev/null || true
fi

# Prepare arguments
ARGS=()
for arg in "$@"; do
    case "$arg" in
        ":assembleRelease")
            ARGS+=("assembleRelease")
            ;;
        ":assembleDebug")
            ARGS+=("assembleDebug")
            ;;
        ":bundleRelease")
            ARGS+=("bundleRelease")
            ;;
        *)
            ARGS+=("$arg")
            ;;
    esac
done

echo "==> Running Android build in $DIR/android with args: ${ARGS[*]}"
cd "$DIR/android"
./gradlew "${ARGS[@]}"
BUILD_STATUS=$?

# Synchronize build outputs to root app/build/outputs/apk/
# so that tools searching in /app/build or /android/app/build both find the APK
cd "$DIR"
mkdir -p "$DIR/app/build/outputs/apk/release" "$DIR/app/build/outputs/apk/debug" 2>/dev/null || true
if [ -d "$DIR/android/app/build/outputs/apk" ]; then
    cp -ru "$DIR/android/app/build/outputs/apk/"* "$DIR/app/build/outputs/apk/" 2>/dev/null || cp -r "$DIR/android/app/build/outputs/apk/"* "$DIR/app/build/outputs/apk/" 2>/dev/null || true
fi

exit $BUILD_STATUS
