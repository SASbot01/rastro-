#!/bin/bash
# Genera los PNG 1080x1350 de cada slide con Chrome en modo oculto.
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in html/*.html; do
  n=$(basename "$f" .html)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1080,1350 --virtual-time-budget=4000 --screenshot="$PWD/$n.png" "file://$PWD/$f" >/dev/null 2>&1
  echo "$n.png"
done
