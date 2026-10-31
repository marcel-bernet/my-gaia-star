#!/usr/bin/env bash
# Renders the share cards in public/ from scripts/og_image.html (needs Chrome and node_modules).
set -euo pipefail
cd "$(dirname "$0")"
CHROME=${CHROME:-google-chrome}
shot() { # size, output, query
  "$CHROME" --headless --allow-file-access-from-files --hide-scrollbars --virtual-time-budget=8000 \
    --window-size="$1" --screenshot="../public/$2" "file://$PWD/og_image.html$3" 2>/dev/null
}
shot 1200,630 og-image.png ''
for lang in en es ca; do shot 1080,1920 "story-$lang.png" "?story&lang=$lang"; done
shot 180,180 apple-touch-icon.png '?icon'
