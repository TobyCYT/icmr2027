# Auto-deploy

The site is static and served by nginx straight from the repo via a volume mount
(`docker-compose.yaml`). A deploy is just `git pull` — **no image build, no restart**.

A systemd timer polls `origin/main` every 2 minutes and force-syncs the repo. The
server only needs outbound internet (no public inbound), and the repo is public, so
`git fetch` needs no credentials.

## One-time server bootstrap

Repo path is `~/project/icmr2027`. The deploy user must be in the `docker` group.

```bash
cd ~/project/icmr2027

# 1. Move to the new build-free compose. Drop any local edits to tracked files.
git stash -u || true
git fetch origin main && git reset --hard origin/main

# 2. Recreate the container on the new image-based compose (pulls nginx:alpine, no build).
docker compose up -d

# 3. Install the deploy timer.
chmod +x deploy/deploy.sh

# Fill in your real values first:
#   - User=  -> your login name (echo "$USER")
#   - REPO=  -> absolute repo path (echo ~/project/icmr2027)
#   - ExecStart= -> $REPO/deploy/deploy.sh
sudo cp deploy/icmr-deploy.service deploy/icmr-deploy.timer /etc/systemd/system/
sudo "$EDITOR" /etc/systemd/system/icmr-deploy.service   # replace YOUR_DEPLOY_USER

sudo systemctl daemon-reload
sudo systemctl enable --now icmr-deploy.timer
```

## Check it

```bash
systemctl list-timers icmr-deploy.timer      # next scheduled run
journalctl -u icmr-deploy.service -f         # live deploy logs
REPO=~/project/icmr2027 deploy/deploy.sh     # run once by hand (silent if already up to date)
```

Push a content change to `main`; within ~2 min the log shows `deploy <old> -> <new>`
then `deployed <new>`, and the site reflects it with no rebuild.

## Cron alternative (instead of the systemd timer)

```cron
*/2 * * * * /home/USER/project/icmr2027/deploy/deploy.sh >> /home/USER/project/icmr2027/deploy.log 2>&1
```

## Notes

- Faster deploys: lower `OnUnitActiveSec` (e.g. `30s`) in `icmr-deploy.timer`.
- The script never runs `git clean`, so untracked files on the server are safe.
- If the repo becomes private, add a read-only deploy key or PAT for `git fetch`;
  nothing else changes.
