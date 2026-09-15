#!/usr/bin/env bash
#
# deploy-frontend.sh — one-command build + deploy for the pokeTFT static frontend + blog.
#
# Run from the repo root, after the room server (if it changed) has already
# been redeployed via ./deploy/update-server.sh, and after `npx netlify-cli
# login` has been run once on this machine:
#
#   ./deploy/deploy-frontend.sh
#
# VITE_PARTY_HOST defaults to the deployed room's public hostname (a public
# value, not a secret — already committed plainly in netlify.toml's
# [build.environment] block) but can be overridden for a different room:
#
#   VITE_PARTY_HOST=some-other-host ./deploy/deploy-frontend.sh
#
set -euo pipefail

VITE_PARTY_HOST="${VITE_PARTY_HOST:-room.pokefight.org}"

echo "==> Building main app (VITE_PARTY_HOST=$VITE_PARTY_HOST)"
VITE_PARTY_HOST="$VITE_PARTY_HOST" npx vite build

echo "==> Building blog"
npm --prefix blog ci
npm --prefix blog run build

echo "==> Merging blog into dist/blog"
rm -rf dist/blog
cp -r blog/dist dist/blog

echo "==> Deploying to Netlify"
npx netlify-cli deploy --prod --dir=dist

echo "==> SUCCESS: frontend + blog deployed"
