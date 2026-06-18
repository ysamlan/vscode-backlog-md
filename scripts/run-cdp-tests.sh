#!/bin/bash
# Run CDP cross-view tests, using xvfb-run in headless environments (CI, devcontainer on Linux)
#
# The VS Code binary is provisioned by the test launcher itself
# (src/test/cdp/lib/vscode-launcher.ts): on macOS it downloads the latest stable
# build into .vscode-test/ on first run; CI downloads its own linux-x64 binary
# before invoking vitest.

set -e

CMD="vitest run --config vitest.cdp.config.ts"

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
  echo "Running CDP cross-view tests with virtual display (xvfb)..."
  exec xvfb-run -a --server-args="-screen 0 1920x1080x24" bash -c "$CMD"
else
  echo "Running CDP cross-view tests..."
  exec bash -c "$CMD"
fi
