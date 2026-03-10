#!/bin/bash
# Package Discord Channel Exporter into a .zip for Chrome Web Store or distribution

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="discord-channel-exporter"
VERSION=$(grep '"version"' "$SCRIPT_DIR/manifest.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
OUTPUT="$SCRIPT_DIR/${NAME}-v${VERSION}.zip"

# Remove old build
rm -f "$OUTPUT"

# Create zip (exclude dev/git files)
cd "$SCRIPT_DIR"
zip -r "$OUTPUT" \
  manifest.json \
  background.js \
  content.js \
  popup.html \
  popup.js \
  icons/ \
  LICENSE \
  README.md \
  -x "*.DS_Store"

echo ""
echo "Packaged: ${NAME}-v${VERSION}.zip ($(du -h "$OUTPUT" | cut -f1))"
