#!/bin/bash
# Copy the single source index.html into every version folder (1..10).
# Each copy auto-detects its version from its URL path, so the files are identical.
# Run this after editing index.html (specifically the RISK_VERSIONS block).
cd "$(dirname "$0")" || exit 1
for n in $(seq 1 25); do
  if [ -d "$n" ]; then
    cp index.html "$n/index.html"
    echo "synced -> $n/index.html"
  fi
done
# The baseline surveys are the SAME file as survey.html (it detects the URL path
# to pick the condition), so keep the copies in step after editing survey.html.
for d in baseline-chatbot baseline-text; do
  if [ -d "$d" ]; then
    cp survey.html "$d/index.html"
    echo "synced -> $d/index.html"
  fi
done
echo "done. (create a new version folder with: mkdir N)"
