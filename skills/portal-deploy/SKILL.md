---
name: portal-deploy
description: |
  Deploy the Showpane portal app. Runs pre-flight checks, applies migrations, and deploys via Docker or Vercel.
  Trigger phrases: "portal deploy", "deploy portals", "push to production", "ship the portals". (showpane)
---

## Preamble (run first)

```bash
# Read config
CONFIG="$HOME/.showpane/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "Showpane not configured. Run /portal setup first."
  exit 1
fi
APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null)
DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','docker'))" 2>/dev/null)
ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('org_slug',''))" 2>/dev/null)
APP_PATH="${SHOWPANE_APP_PATH:-$APP_PATH}"
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
DATABASE_URL="${DATABASE_URL:-}"
if [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "App dependencies not installed. Run: cd $APP_PATH && npm install"
  exit 1
fi
SKILL_DIR="$(dirname "$APP_PATH")"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
LEARN_FILE="$HOME/.showpane/learnings.jsonl"
[ -f "$LEARN_FILE" ] && echo "LEARNINGS: $(wc -l < "$LEARN_FILE" | tr -d ' ') loaded" || echo "LEARNINGS: 0"
```

## Steps

### Step 0: Choose deployment target

Present the deployment options:

1. **Self-host with Docker** (free) — Deploy with Docker Compose on your own server
2. **Showpane Cloud** ($29/month, 7-day free trial) — Managed hosting at {org}.showpane.com

If the user chooses Docker, continue with the existing deploy flow (Steps 1-6).

If the user chooses Cloud:
1. Inform: "Showpane Cloud is coming soon. For now, self-host with Docker or deploy to your own Vercel."
2. When cloud is available (check for `app.showpane.com/api/status`):
   a. Open browser to `app.showpane.com/cli/authorize?org=<org_slug>`
   b. User signs up with Clerk, adds Stripe payment
   c. CLI polls for authorization token via device auth flow
   d. On success: update config `deploy_mode: "cloud"`, store API token
   e. Build locally, upload to Vercel via Platforms API
   f. Portal goes live at `{org}.showpane.com`

For now, the cloud path should gracefully fall back: "Cloud deployment is not yet available. Would you like to deploy with Docker instead?"

### Step 1: Pre-flight checks

Run all checks before deploying. Any failure here should block the deploy.

#### 1a. TypeScript type check

```bash
cd "$APP_PATH" && npx tsc --noEmit 2>&1
```

If type errors are found, display them clearly and stop. Do not deploy with type errors. Common type errors during portal development:

- Missing imports (forgot to import an icon from lucide-react)
- PortalShell prop mismatch (wrong type for contact, missing required prop)
- Unused variables in tab content functions

For simple issues (missing import, typo in a prop name), offer to fix them before retrying the deploy. For complex type errors in shared code, suggest the user investigate and fix manually.

The type check typically takes 10-30 seconds depending on project size. If it takes longer than 60 seconds, it may indicate a problem with the TypeScript configuration.

#### 1b. Verify all portals have credentials

Run the list-portals script to check portal status:

```bash
cd "$APP_PATH" && npx tsx "$SKILL_DIR/bin/list-portals.ts" --org-id <org_id>
```

The output is a JSON array of portals. Check each portal for a `username` field. If any active portal lacks credentials, warn the user:

```
WARNING: The following portals have no login credentials:
  - acme-health
  - new-client

Clients won't be able to log in to these portals.
Run /portal credentials <slug> to create credentials, or continue anyway?
```

This is a warning, not a blocker — the user can choose to continue. Some portals may be works in progress that don't need credentials yet.

#### 1c. Verify deployment config exists

**For Docker mode:**
```bash
ls "$APP_PATH/docker-compose.yml" 2>/dev/null || ls "$APP_PATH/compose.yml" 2>/dev/null
```

**For Vercel mode:**
```bash
ls "$APP_PATH/.vercel/project.json" 2>/dev/null || ls "$APP_PATH/vercel.json" 2>/dev/null
```

If the config doesn't exist, inform the user and provide setup guidance:
- Docker: "No docker-compose.yml found. Create one or switch deploy mode to vercel."
- Vercel: "No Vercel config found. Run `npx vercel link` to connect your project."

#### 1d. Check for uncommitted changes (Vercel mode only)

For Vercel deploys, check if there are uncommitted changes:

```bash
cd "$APP_PATH" && git status --porcelain
```

If there are changes, show the user what will be committed as part of the deploy:

```bash
cd "$APP_PATH" && git diff --stat
```

List the changed files and ask the user to confirm. Pay attention to:
- `.env` files — these should NEVER be committed. If `.env` appears in the changes, warn the user and exclude it.
- Large binary files — these will slow down the deploy. Suggest adding them to `.gitignore`.
- Files outside the portal directories — these may be unintended changes.

If there are no changes to commit and the current branch is up to date with the remote, inform the user that there is nothing new to deploy.

### Step 2: Apply database migrations

Before deploying, apply any pending migrations:

```bash
cd "$APP_PATH" && npx prisma migrate deploy
```

This runs in production mode — it only applies pending migrations, never creates new ones. If this fails, stop the deploy and show the error. Common issues:
- DATABASE_URL not set or incorrect
- Database server unreachable
- Migration conflicts (rare, requires manual resolution)

### Step 3: Deploy

#### Docker mode

Build and restart the containers:

```bash
cd "$APP_PATH" && docker compose build && docker compose up -d
```

If `docker compose` is not available, try `docker-compose` (older syntax):

```bash
cd "$APP_PATH" && docker-compose build && docker-compose up -d
```

Wait for the containers to start. Check container status:

```bash
cd "$APP_PATH" && docker compose ps
```

All containers should show status "Up" or "running".

#### Vercel mode

Stage, commit, and push:

```bash
cd "$APP_PATH" && git add -A && git commit -m "Deploy portal updates" && git push
```

If there are no changes to commit, just push:

```bash
cd "$APP_PATH" && git push
```

The push triggers Vercel's automatic deployment pipeline. Note that the deploy is async — the push returns immediately, but the actual deployment takes 1-3 minutes.

For Vercel, inform the user:

> "Pushed to remote. Vercel will build and deploy automatically. Check your Vercel dashboard for deploy status."

### Step 4: Post-deploy verification

#### Docker mode

Wait a few seconds for the app to start, then hit the health endpoint:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health
```

Expected: HTTP 200. Then check the response body:

```bash
curl -s http://localhost:8080/api/health
```

Expected: `{"status":"ok"}` or similar health response.

If the health check fails:
1. Check container logs: `cd "$APP_PATH" && docker compose logs --tail=50`
2. Check if the port is correct (might be 3000, 8080, or custom)
3. Report the error and suggest debugging steps

#### Vercel mode

If a production URL is known (from config or Vercel project settings), check it:

```bash
curl -s -o /dev/null -w "%{http_code}" https://<production_url>/api/health
```

If the production URL is not known, skip the health check and inform the user:

> "Deploy triggered. Verify at your Vercel production URL once the build completes."

### Step 5: Deployment summary

Print a clear summary of what happened:

```
Deploy complete!

  Mode:       docker
  Migrations: 2 applied (or: up to date)
  Type check: passed
  Portals:    5 active (3 with credentials)
  Health:     OK (200)

  App URL:    http://localhost:8080
  Login:      http://localhost:8080/client
```

For Vercel:

```
Deploy triggered!

  Mode:       vercel
  Migrations: up to date
  Type check: passed
  Commit:     abc1234 "Deploy portal updates"
  Portals:    5 active (3 with credentials)

  Status:     Building (check Vercel dashboard)
  URL:        https://your-app.vercel.app
```

### Step 6: Record deployment

Log the deployment for operational memory:

```bash
echo '{"skill":"portal-deploy","key":"deploy","insight":"Deployed via <mode>. Migrations: <count>. Portals: <count> active.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

## Error Recovery

Deployments can fail at multiple points. Here is how to recover from each:

### Migration failure
If `npx prisma migrate deploy` fails:
- **Connection refused**: Database server is down. For Docker, check `docker compose ps` to see if the DB container is running. For remote DBs, check network connectivity.
- **Migration conflict**: A migration was edited after being applied. This requires manual resolution — check `npx prisma migrate status` to see which migration is problematic.
- **Permission denied**: The database user may not have DDL permissions. Check the DATABASE_URL credentials have CREATE TABLE / ALTER TABLE rights.

### Docker build failure
If `docker compose build` fails:
- Check the Dockerfile for syntax errors
- Check that all required files are present (especially `.env` and `prisma/schema.prisma`)
- Check available disk space — Docker builds can require significant space
- Try `docker compose build --no-cache` if a cached layer is stale

### Vercel push failure
If `git push` fails:
- **Authentication**: Check git credentials or SSH keys
- **Remote rejection**: The remote may have branch protections. Check if pushing to the correct branch.
- **Diverged history**: Someone else pushed since your last pull. Run `git pull --rebase` first.

### Health check failure
If the health endpoint returns non-200 after deploy:
- Check application logs: `docker compose logs --tail=100` (Docker) or Vercel function logs
- Common causes: missing environment variables, database connection issues, port conflicts
- For Docker, check if the container is actually running: `docker compose ps`

## Conventions

- Always run pre-flight checks before deploying — never skip the type check
- Credential warnings are non-blocking — the user decides whether to continue
- Migrations run before the deploy, not after
- For Docker: verify the health endpoint after deploy
- For Vercel: the deploy is async — inform the user to check the dashboard
- Never force-push or reset git history during Vercel deploys
- If any pre-flight check fails (type errors, missing deploy config), stop and explain
- Show the full deployment summary with portal count, migration status, and health
- The deploy commit message is always "Deploy portal updates" — keep it simple and consistent
- If the user wants a custom commit message, they should commit manually before running deploy
- For Vercel deploys, the build typically takes 1-3 minutes — do not poll or wait, just inform the user
- Always run migrations before the build/push step, never after — the app code expects the latest schema
- If this is the first deploy, suggest running `/portal credentials` for all portals before deploying so clients can actually log in
