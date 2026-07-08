#!/bin/bash
# Copy the single source index.html into every version folder (1..10).
# Each copy auto-detects its version from its URL path, so the files are identical.
# Run this after editing index.html (specifically the RISK_VERSIONS block).
cd "$(dirname "$0")" || exit 1
for n in 1 2 3 4 5 6 7 8 9 10; do
  if [ -d "$n" ]; then
    cp index.html "$n/index.html"
    echo "synced -> $n/index.html"
  fi
done
echo "done. (create a new version folder with: mkdir N)"
