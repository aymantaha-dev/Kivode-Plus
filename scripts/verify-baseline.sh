#!/usr/bin/env bash
set -euo pipefail

npm ci
if [ -f .eslintrc ] || [ -f .eslintrc.js ] || [ -f .eslintrc.cjs ] || [ -f eslint.config.js ]; then
  npm run lint
else
  echo "Skipping lint: ESLint configuration not found"
fi
npm run build
node scripts/security-checks.mjs
