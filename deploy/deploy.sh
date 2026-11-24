#!/usr/bin/env bash
# Pull latest main and deploy. No image build — content is served live from the
# repo via the compose volume mount, so `git reset --hard` alone is the deploy.
set -euo pipefail

REPO="${REPO:-$HOME/project/icmr2027}"   # repo lives at ~/project/icmr2027
cd "$REPO"

# Prevent overlapping runs if a deploy is slow.
exec 9>/tmp/icmr-deploy.lock
flock -n 9 || { echo "deploy already running"; exit 0; }

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -c1-8
  else
    shasum -a 256 "$1" | cut -c1-8
  fi
}

generate_asset_versions() {
  local css_hash js_hash tmp
  css_hash=$(hash_file styles.css)
  js_hash=$(hash_file script.js)
  tmp=$(mktemp nginx/.asset-versions.XXXXXX)
  printf "sub_filter 'href=\"styles.css\"' 'href=\"styles.css?v=%s\"';\nsub_filter 'src=\"script.js\"' 'src=\"script.js?v=%s\"';\n" "$css_hash" "$js_hash" > "$tmp"
  chmod 644 "$tmp"
  mv "$tmp" nginx/asset-versions.inc
}

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ] && [ -f nginx/asset-versions.inc ]; then
  exit 0
fi

echo "$(date -Is) deploy $LOCAL -> $REMOTE"
CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE" || true)
git reset --hard origin/main       # content is now live via the volume mount
generate_asset_versions

# Recreate the container if docker-compose.yaml changed (port/image/mounts);
# otherwise reload nginx so config or generated asset hashes take effect.
if echo "$CHANGED" | grep -q '^docker-compose\.yaml$'; then
  docker compose up -d
else
  docker exec icmr2027-web nginx -t && docker exec icmr2027-web nginx -s reload
fi

echo "$(date -Is) deployed $REMOTE"
