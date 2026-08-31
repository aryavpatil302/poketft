#!/usr/bin/env bash
#
# update-server.sh — one-command redeploy for the pokeTFT room server on EC2.
#
# Run from the repo root:
#
#   ./deploy/update-server.sh
#
# IMPORTANT: run this AFTER pushing your change to the repo's git remote.
# The remote box pulls from that git remote, never from this machine — a run
# against an unpushed commit succeeds and restarts the service, but deploys
# nothing new. That is a confusing, silent no-op, not a failure this script
# can detect.
#
# Every setting below is overridable from the environment without editing
# this file, e.g.:
#
#   SSH_HOST=ubuntu@my-other-box.example.com ./deploy/update-server.sh
#
set -euo pipefail

# ─── Settings (all overridable from the environment) ───────────────────────
SSH_HOST="${SSH_HOST:-ubuntu@room.pokefight.org}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pokefight-key.pem}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/poketft/poketft}"
SERVICE_NAME="${SERVICE_NAME:-poketft-room}"
SERVICE_USER="${SERVICE_USER:-poketft}"
ROOM_PORT="${ROOM_PORT:-1999}" # must stay equal to Environment=PORT= in deploy/poketft-room.service

# ─── Local preflight ─────────────────────────────────────────────────────────
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at '$SSH_KEY'. Override with SSH_KEY=/path/to/key ./deploy/update-server.sh" >&2
  exit 1
fi

# ─── Run the whole redeploy in a single SSH session ─────────────────────────
# BatchMode=yes: fail immediately on a bad/missing key instead of hanging on
# an interactive password prompt.
ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_HOST" bash -s -- "$REMOTE_APP_DIR" "$SERVICE_NAME" "$SERVICE_USER" "$ROOM_PORT" <<'REMOTE'
set -euo pipefail

# Positional params from the local invocation above. The heredoc delimiter
# is single-quoted so the LOCAL shell performs no expansion on this body —
# these values reach the remote only as $1-$4, never spliced into script text.
APP_DIR="$1"
SERVICE="$2"
SVC_USER="$3"
PORT="$4"

cd "$APP_DIR"

echo "==> Pulling latest code as $SVC_USER"
# -u "$SVC_USER": the service user is nologin and cannot be SSH'd into
#   directly, yet must own every file it later writes.
# -H: points HOME at the service user's home so npm's cache doesn't land in
#   (or fail against) the login user's home.
# -n: stdin is already occupied by this heredoc — without -n, a sudo
#   password prompt would silently eat the rest of the script instead of
#   failing loudly.
sudo -n -u "$SVC_USER" -H git pull --ff-only

echo "==> Installing dependencies"
# Unconditional, every deploy: this repo commits node_modules but tracks
# only the macOS @esbuild/darwin-arm64 binary — the Linux box needs its own.
# Do not try to detect whether this is "needed"; DEPLOY.md's own step 5
# warns skipping it produces a confusing silent failure.
sudo -n -u "$SVC_USER" -H npm install

echo "==> Restarting $SERVICE"
sudo -n systemctl restart "$SERVICE"

# Give the process a moment to bind its port before anything asks it to answer.
sleep 3

echo "==> Verifying"
ok=1
sudo -n systemctl status "$SERVICE" --no-pager || ok=0
sudo -n systemctl is-active --quiet "$SERVICE" || ok=0
curl -sf "http://127.0.0.1:${PORT}/parties/main/healthcheck" || ok=0

if [ "$ok" != "1" ]; then
  echo "==> FAILED: $SERVICE is not healthy. Last 30 lines of its journal:" >&2
  sudo -n journalctl -u "$SERVICE" -n 30 --no-pager >&2
  exit 1
fi

echo "==> SUCCESS: $SERVICE is active and serving on port $PORT"
REMOTE
