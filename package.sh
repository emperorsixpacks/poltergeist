#!/usr/bin/env bash
# Package only the extension files into poltergeist.zip for easy "Load unpacked".
# The proxy (server.js) and docs are excluded — judges don't need them.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist && mkdir -p dist/poltergeist/icons

for f in manifest.json background.js content.js content.css popup.html popup.js assets.js; do
  cp "$f" dist/poltergeist/
done
cp icons/icon-16.png icons/icon-48.png icons/icon-128.png dist/poltergeist/icons/

rm -f poltergeist.zip
(cd dist && zip -r -X ../poltergeist.zip poltergeist >/dev/null)
rm -rf dist

echo "Built poltergeist.zip ($(du -h poltergeist.zip | cut -f1))"
