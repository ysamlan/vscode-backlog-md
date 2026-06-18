#!/bin/bash
# Run CDP cross-view tests, using xvfb-run in headless environments (CI, devcontainer on Linux)

set -e

STORAGE_PATH=".vscode-test"
CMD="vitest run --config vitest.cdp.config.ts"

# Ensure a VS Code binary exists for the CDP launcher (src/test/cdp/lib/vscode-launcher.ts).
#
# CI provisions its own binary (it curls linux-x64 into .vscode-test/ and calls
# vitest directly, bypassing this script), so this is purely a local-dev
# convenience. On macOS — where the launcher has no auto-download — fetch the
# latest stable build into .vscode-test/ so `bun run test:cdp` works on a fresh
# machine with no manual setup. Idempotent: only downloads when missing.
ensure_vscode_binary() {
  if [ "$(uname)" = "Darwin" ]; then
    local app="$STORAGE_PATH/Visual Studio Code.app/Contents/MacOS/Electron"
    if [ ! -x "$app" ]; then
      local arch plat zip
      arch="$(uname -m)"
      case "$arch" in
        arm64) plat="darwin-arm64" ;;
        x86_64) plat="darwin" ;;
        *) plat="darwin-universal" ;;
      esac
      echo "No local VS Code in $STORAGE_PATH — downloading latest stable ($plat)..."
      mkdir -p "$STORAGE_PATH"
      zip="$(mktemp -t vscode-cdp).zip"
      curl -fsSL "https://update.code.visualstudio.com/latest/$plat/stable" -o "$zip"
      # ditto preserves the .app bundle's symlinks/permissions; unzip mangles them.
      ditto -x -k "$zip" "$STORAGE_PATH"
      rm -f "$zip"
      echo "VS Code installed at $STORAGE_PATH/Visual Studio Code.app"
    fi
  elif [ ! -x "$STORAGE_PATH/VSCode-linux-x64/code" ]; then
    # Local Linux dev (CI handles its own download before calling vitest directly).
    echo "No local VS Code at $STORAGE_PATH/VSCode-linux-x64. Download it with:"
    echo "  mkdir -p $STORAGE_PATH && curl -fsSL https://update.code.visualstudio.com/latest/linux-x64/stable | tar -xz -C $STORAGE_PATH"
  fi
}

ensure_vscode_binary

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
