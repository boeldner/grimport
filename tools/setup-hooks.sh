#!/usr/bin/env bash
set -euo pipefail

# One-time setup: point git at the repo's tracked hooks directory.

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

git config core.hooksPath .githooks

echo "core.hooksPath set to .githooks"
echo "pre-commit will now run: gitleaks protect --staged --redact --config .gitleaks.toml"
echo "install gitleaks if you have not: brew install gitleaks"
