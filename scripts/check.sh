#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "check: claude plugin validate --strict ."
claude plugin validate --strict .

echo "check: claude plugin validate --strict plugins/spindle"
claude plugin validate --strict plugins/spindle

echo "check: claude plugin test plugins/spindle"
claude plugin test plugins/spindle

echo "check: zsh scripts/check-mockup.sh"
zsh scripts/check-mockup.sh

if [ -d plugins/spindle/.claude-plugin/types ]; then
  echo "check: tsc -p plugins/spindle"
  tsc -p plugins/spindle
else
  echo "type-check skipped: the engine has not laid its types in plugins/spindle/.claude-plugin/types"
fi
