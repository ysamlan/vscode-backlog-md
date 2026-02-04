#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Generate licenses for dependencies
bunx generate-license-file \
  --input "$PROJECT_ROOT/package.json" \
  --output "$PROJECT_ROOT/ThirdPartyNotices.txt" \
  --overwrite \
  --ci

# Append Lucide notice
cat "$SCRIPT_DIR/licenses/lucide-notice.txt" >> "$PROJECT_ROOT/ThirdPartyNotices.txt"

echo "Generated ThirdPartyNotices.txt"
