#!/bin/bash
# Run e2e tests, using xvfb-run in headless environments (CI, devcontainer on Linux)

set -e

# Use a project-local directory for test resources to avoid macOS temp folder quarantine issues
STORAGE_PATH=".vscode-test"

# Use an isolated extensions dir so other installed extensions (e.g. GitLens) don't steal focus
EXTENSIONS_DIR="$STORAGE_PATH/test-extensions"
mkdir -p "$EXTENSIONS_DIR"

# Package the extension ourselves with --no-dependencies to avoid npm/bun node_modules incompatibility.
# vsce's default packaging runs `npm list --production` which fails with bun-managed node_modules.
VSIX_FILE=".vscode-test/test-extension.vsix"
bunx vsce package --no-dependencies -o "$VSIX_FILE"

# Split setup-and-run into separate steps so we can provide our pre-built vsix
SETUP_CMD="bunx extest get-vscode --storage $STORAGE_PATH && bunx extest get-chromedriver --storage $STORAGE_PATH && bunx extest install-vsix --vsix_file $VSIX_FILE --storage $STORAGE_PATH --extensions_dir $EXTENSIONS_DIR"
RUN_CMD="bunx extest run-tests 'out/test/e2e/*.test.js' --mocha_config .mocharc.json --storage $STORAGE_PATH --extensions_dir $EXTENSIONS_DIR"
CMD="$SETUP_CMD && $RUN_CMD"

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
