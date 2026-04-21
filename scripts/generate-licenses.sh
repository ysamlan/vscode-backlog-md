#!/bin/bash
# Regenerate ThirdPartyNotices.txt.
#
# Installs dependencies in a tmp dir rather than using the working-copy
# node_modules. `bun install` doesn't prune orphaned directories when the
# dependency graph shrinks (https://github.com/oven-sh/bun/issues/3605), and
# `generate-license-file` follows Node's nearest-ancestor resolution — so an
# orphaned nested copy on disk can shadow the real top-level version and get
# recorded in the notices instead. A clean install sidesteps this. With bun's
# shared cache this adds ~2s.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cp "$PROJECT_ROOT/package.json" \
   "$PROJECT_ROOT/bun.lock" \
   "$PROJECT_ROOT/bunfig.toml" \
   "$PROJECT_ROOT/.generate-license-file.config.json" \
   "$WORK_DIR/"

(cd "$WORK_DIR" && bun install --frozen-lockfile --ignore-scripts >/dev/null)

(cd "$WORK_DIR" && ./node_modules/.bin/generate-license-file \
  --input package.json \
  --output ThirdPartyNotices.txt \
  --config .generate-license-file.config.json \
  --overwrite \
  --ci)
cat "$SCRIPT_DIR/licenses/lucide-notice.txt" >> "$WORK_DIR/ThirdPartyNotices.txt"

cp "$WORK_DIR/ThirdPartyNotices.txt" "$PROJECT_ROOT/ThirdPartyNotices.txt"
echo "Generated ThirdPartyNotices.txt"
