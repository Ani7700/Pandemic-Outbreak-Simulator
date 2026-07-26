#!/bin/bash
# Propagate each arm's single source files into its copies.
#
#   {arm}/index.html   -> {arm}/1..30/index.html    (each copy reads its version from the URL path)
#   {arm}/survey.html  -> {arm}/survey1-3.html      (each reads its interface version from its filename)
#                      -> {arm}/baseline/index.html (reads the baseline condition from the URL path)
#
# Run this after editing any {arm}/index.html or {arm}/survey.html.
#
# NOTE: the previous version of this script covered tarnpox and solvik only, so
# verrow's 30 copies and its baseline were never synced, and its root-level loops
# referred to files that do not exist at the repo root (they failed every run).
# Both fixed here.

cd "$(dirname "$0")" || exit 1

ARMS="tarnpox verrow solvik"
n=0

for arm in $ARMS; do
  if [ ! -f "$arm/index.html" ]; then
    echo "SKIP $arm - no index.html" >&2
    continue
  fi

  for v in $(seq 1 30); do
    if [ -d "$arm/$v" ]; then
      cp "$arm/index.html" "$arm/$v/index.html" || exit 1
      n=$((n + 1))
    fi
  done
  echo "synced $arm/index.html -> $arm/{1..30}/index.html"

  if [ -f "$arm/survey.html" ]; then
    for v in 1 2 3; do
      cp "$arm/survey.html" "$arm/survey$v.html" || exit 1
      n=$((n + 1))
    done
    echo "synced $arm/survey.html -> $arm/survey{1,2,3}.html"

    if [ -d "$arm/baseline" ]; then
      cp "$arm/survey.html" "$arm/baseline/index.html" || exit 1
      n=$((n + 1))
      echo "synced $arm/survey.html -> $arm/baseline/index.html"
    fi
  fi
done

echo "done - $n files written."
