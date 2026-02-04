#!/bin/bash
# Run e2e tests, using xvfb-run in headless environments (CI, devcontainer)

set -e

CMD="fnm exec --using=22 -- npx extest setup-and-run 'out/test/e2e/*.test.js' --mocha_config .mocharc.json"

if [ -n "$DEVCONTAINER" ] || [ -n "$CI" ] || [ -z "$DISPLAY" ]; then
  echo "Running e2e tests with virtual display (xvfb)..."
  exec xvfb-run -a bash -c "$CMD"
else
  echo "Running e2e tests..."
  exec bash -c "$CMD"
fi
