#!/usr/bin/env bash
# Pull latest main and deploy. No image build — content is served live from the
# repo via the compose volume mount, so `git reset --hard` alone is the deploy.
set -euo pipefail

REPO="${REPO:-$HOME/project/icmr2027}"   # repo lives at ~/project/icmr2027
cd "$REPO"

# Prevent overlapping runs if a deploy is slow.
exec 9>/tmp/icmr-deploy.lock
flock -n 9 || { echo "deploy already running"; exit 0; }

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "$(date -Is) deploy $LOCAL -> $REMOTE"
CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE" || true)
git reset --hard origin/main       # content is now live via the volume mount

# Only recreate the container if the compose itself changed (port/image/etc.).
# Static content needs nothing here. Still no --build.
if echo "$CHANGED" | grep -q '^docker-compose\.yaml$'; then
  docker compose up -d
fi

echo "$(date -Is) deployed $REMOTE"
