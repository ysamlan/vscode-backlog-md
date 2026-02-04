#!/bin/bash
# Run e2e tests, using xvfb-run in headless environments (CI, devcontainer on Linux)

set -e

CMD="bunx extest setup-and-run 'out/test/e2e/*.test.js' --mocha_config .mocharc.json"

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
  echo "Running e2e tests with virtual display (xvfb)..."
  exec xvfb-run -a bash -c "$CMD"
else
  echo "Running e2e tests..."
  exec bash -c "$CMD"
fi
