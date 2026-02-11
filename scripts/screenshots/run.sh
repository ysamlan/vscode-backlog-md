#!/bin/bash
# Cross-platform screenshot generation wrapper
#
# Uses xvfb-run on headless Linux, native display on macOS.
# Follows the pattern from scripts/run-e2e.sh.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Build the extension and webviews first
echo "Building extension..."
cd "$PROJECT_ROOT"
bun run build

CMD="bun \"$SCRIPT_DIR/generate.ts\" $*"

# Check if we need xvfb:
# - Not on macOS (darwin) - macOS doesn't use X11
# - Only in CI, devcontainer, or when no DISPLAY is set on Linux
NEEDS_XVFB=false
if [ "$(uname)" != "Darwin" ]; then
  if [ -n "$DEVCONTAINER" ] || [ -n "$CI" ] || [ -z "$DISPLAY" ]; then
    NEEDS_XVFB=true
  fi
fi

if [ "$NEEDS_XVFB" = true ]; then
  echo "Running screenshot generation with virtual display (xvfb)..."
  # Screen must be large enough for 1553x1043 window + DPI scaling
  exec xvfb-run -a --server-args="-screen 0 3200x2100x24" bash -c "$CMD"
else
  echo "Running screenshot generation..."
  exec bash -c "$CMD"
fi
