#!/bin/bash
# Verify ThirdPartyNotices.txt is up to date with the lockfile.
# Regenerates the file (via generate-licenses.sh, which uses a clean install
# in a tmp dir) and fails if the committed version differs.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

bash "$SCRIPT_DIR/generate-licenses.sh" >/dev/null

if ! git -C "$PROJECT_ROOT" diff --exit-code ThirdPartyNotices.txt; then
  cat >&2 <<'EOF'

ThirdPartyNotices.txt was stale — a corrected version has been written to
the working tree. Stage and commit it:

  git add ThirdPartyNotices.txt

EOF
  exit 1
fi

echo "ThirdPartyNotices.txt is up to date."
