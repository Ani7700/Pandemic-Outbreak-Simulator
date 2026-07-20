#!/bin/bash
# Copy the single source index.html into every version folder (1..10).
# Each copy auto-detects its version from its URL path, so the files are identical.
# Run this after editing index.html (specifically the RISK_VERSIONS block).
cd "$(dirname "$0")" || exit 1
for n in $(seq 1 30); do
  if [ -d "$n" ]; then
    cp index.html "$n/index.html"
    echo "synced -> $n/index.html"
  fi
done
# The baseline surveys are the SAME file as survey.html (it detects the URL path
# to pick the condition), so keep the copies in step after editing survey.html.
for d in baseline; do
  if [ -d "$d" ]; then
    cp survey.html "$d/index.html"
    echo "synced -> $d/index.html"
  fi
done
# Tarnpox study: 22 interface versions are copies of tarnpox/index.html.
for n in $(seq 1 30); do
  if [ -d "tarnpox/$n" ]; then
    cp tarnpox/index.html "tarnpox/$n/index.html"
    echo "synced -> tarnpox/$n/index.html"
  fi
done
# Tarnpox baseline survey is the same file as tarnpox/survey.html.
if [ -d tarnpox/baseline ]; then
  cp tarnpox/survey.html tarnpox/baseline/index.html
  echo "synced -> tarnpox/baseline/index.html"
fi
# Solvik study: 22 interface versions are copies of solvik/index.html.
for n in $(seq 1 30); do
  if [ -d "solvik/$n" ]; then
    cp solvik/index.html "solvik/$n/index.html"
    echo "synced -> solvik/$n/index.html"
  fi
done
# Solvik baseline survey is the same file as solvik/survey.html.
if [ -d solvik/baseline ]; then
  cp solvik/survey.html solvik/baseline/index.html
  echo "synced -> solvik/baseline/index.html"
fi

# Fixed-arm survey pages: surveyN.html embeds a fixed interface version (no random).
for base in "" "solvik/" "tarnpox/"; do
  for n in 1 2 3; do
    cp "${base}survey.html" "${base}survey${n}.html"
    echo "synced -> ${base}survey${n}.html"
  done
done
echo "done. (create a new version folder with: mkdir N)"
