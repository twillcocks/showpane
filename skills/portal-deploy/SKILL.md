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
ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null)
CLOUD_API_TOKEN=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',d).get('api_token', d.get('accessToken','')))" 2>/dev/null)
CLOUD_PROJECT_ID=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',{}).get('vercel_project_id','') or d.get('vercelProjectId',''))" 2>/dev/null)
CLOUD_ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',d).get('org_slug', d.get('orgSlug','')))" 2>/dev/null)
CLOUD_PORTAL_URL=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',d).get('portal_url', d.get('portalUrl','')))" 2>/dev/null)
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

Check the `DEPLOY_MODE` variable from the preamble. Route accordingly:

- If `DEPLOY_MODE` is `"cloud"` — skip to **Cloud Deploy Flow** (after Step 6)
- If `DEPLOY_MODE` is `"docker"` or `"vercel"` or unset — continue with the existing self-hosted deploy flow (Steps 1-6)

If no deploy mode is configured, present the options:

1. **Self-host with Docker** (free) — Deploy with Docker Compose on your own server
2. **Showpane Cloud** ($29/month, 7-day free trial) — Managed hosting at {org}.showpane.com

If the user chooses Cloud but has not run `showpane login` yet (no `CLOUD_API_TOKEN`), tell them:

> "Run `showpane login` first to authenticate with Showpane Cloud, then re-run this deploy."

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

---

## Cloud Deploy Flow (when DEPLOY_MODE is "cloud")

This section runs instead of Steps 1-6 when `DEPLOY_MODE` is `"cloud"`. The cloud flow builds the app locally and uploads the build artifacts directly to Vercel via their REST API, deploying to the customer's `{org}.showpane.com` subdomain.

### Cloud Step 1: Pre-flight checks

#### 1a. Verify cloud credentials

Check that the preamble successfully read cloud config values:

```bash
if [ -z "$CLOUD_API_TOKEN" ]; then
  echo "ERROR: No API token found. Run 'showpane login' to authenticate."
  exit 1
fi
if [ -z "$CLOUD_PROJECT_ID" ]; then
  echo "ERROR: No Vercel project ID found in config. Run 'showpane login' to set up your project."
  exit 1
fi
```

If either is missing, stop and tell the user to run `showpane login`.

#### 1b. Verify the API token is valid

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $CLOUD_API_TOKEN" \
  "https://api.vercel.com/v9/projects/$CLOUD_PROJECT_ID"
```

Expected: HTTP 200. If 401 or 403, the token is invalid or expired — tell the user to run `showpane login` again. If 404, the project ID is wrong.

#### 1c. TypeScript type check

Same as the self-hosted flow:

```bash
cd "$APP_PATH" && npx tsc --noEmit 2>&1
```

If type errors are found, display them and stop. Offer to fix simple issues (missing imports, typos).

#### 1d. Verify portals have credentials

Same as self-hosted Step 1b — run list-portals and warn about portals missing credentials. This is a warning, not a blocker.

### Cloud Step 2: Apply database migrations

Run pending migrations against the cloud database:

```bash
cd "$APP_PATH" && npx prisma migrate deploy
```

The `DATABASE_URL` should point to the cloud database (set in `.env` or environment). If this fails, stop and show the error.

### Cloud Step 3: Build the app

Run a Next.js production build targeting the Vercel Build Output API format:

```bash
cd "$APP_PATH" && npx next build
```

After the build completes, verify the output directory was created:

```bash
ls -la "$APP_PATH/.vercel/output/"
```

Expected: the `.vercel/output/` directory exists and contains `config.json`, `static/`, and optionally `functions/`. If the build fails or the output directory is missing, show the build errors and stop.

The build typically takes 30-90 seconds depending on the number of portals.

### Cloud Step 4: Upload build artifacts to Vercel

This is the core of the cloud deploy. Upload every file in `.vercel/output/` to Vercel's Files API, then create a deployment referencing those files.

#### 4a. Upload files

Iterate over every file in the build output and upload each one. The Vercel Files API requires the SHA1 digest as a header.

```bash
API_TOKEN="$CLOUD_API_TOKEN"

# Collect all files and their SHA1 digests
find "$APP_PATH/.vercel/output" -type f | while read file; do
  sha=$(shasum -a 1 "$file" | cut -d' ' -f1)
  size=$(wc -c < "$file" | tr -d ' ')
  echo "Uploading: ${file#$APP_PATH/.vercel/output/} ($size bytes)"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://api.vercel.com/v2/files" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    -H "x-vercel-digest: $sha" \
    -H "x-vercel-size: $size" \
    --data-binary @"$file")

  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "409" ]; then
    echo "ERROR: Upload failed for ${file#$APP_PATH/.vercel/output/} (HTTP $HTTP_CODE)"
    exit 1
  fi
done
```

Note: HTTP 409 means the file already exists (same digest) — this is fine, skip it.

If any upload fails with a different error, stop and report which file failed.

#### 4b. Build the deployment manifest

After all files are uploaded, build a JSON manifest mapping file paths to their SHA1 digests and sizes. Use a Node.js script for this since constructing the JSON in bash is error-prone:

```bash
cd "$APP_PATH" && node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outputDir = path.join(process.cwd(), '.vercel', 'output');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    const data = fs.readFileSync(full);
    const sha = crypto.createHash('sha1').update(data).digest('hex');
    const rel = path.relative(outputDir, full);
    files.push({ file: rel, sha, size: data.length });
  }
}
walk(outputDir);

const manifest = {
  name: '$CLOUD_PROJECT_ID',
  project: '$CLOUD_PROJECT_ID',
  files: files.map(f => ({ file: f.file, sha: f.sha, size: f.size })),
  projectSettings: { framework: 'nextjs' }
};

fs.writeFileSync('/tmp/showpane-deploy-manifest.json', JSON.stringify(manifest));
console.log('Manifest built: ' + files.length + ' files');
"
```

#### 4c. Create the deployment

```bash
DEPLOY_RESPONSE=$(curl -s -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer $CLOUD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/showpane-deploy-manifest.json)

echo "$DEPLOY_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR: ' + d['error'].get('message', str(d['error'])))
    sys.exit(1)
print('Deployment created: ' + d.get('url', 'unknown'))
print('ID: ' + d.get('id', 'unknown'))
print('Status: ' + d.get('readyState', d.get('status', 'unknown')))
"
```

Extract the deployment ID and URL from the response. If the API returns an error, show it and stop.

### Cloud Step 5: Wait for deployment to be ready

Poll the deployment status until it reaches `READY` or `ERROR`:

```bash
DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

echo "Waiting for deployment to go live..."
for i in $(seq 1 60); do
  sleep 5
  STATUS=$(curl -s \
    -H "Authorization: Bearer $CLOUD_API_TOKEN" \
    "https://api.vercel.com/v13/deployments/$DEPLOY_ID" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('readyState','UNKNOWN'))")

  echo "  Status: $STATUS"

  if [ "$STATUS" = "READY" ]; then
    echo "Deployment is live!"
    break
  fi

  if [ "$STATUS" = "ERROR" ] || [ "$STATUS" = "CANCELED" ]; then
    echo "ERROR: Deployment failed with status: $STATUS"
    echo "Check the Vercel dashboard for details."
    exit 1
  fi
done

if [ "$STATUS" != "READY" ]; then
  echo "WARNING: Deployment did not become ready within 5 minutes."
  echo "Check the Vercel dashboard for status."
fi
```

The deployment typically takes 15-60 seconds. Poll every 5 seconds for up to 5 minutes.

### Cloud Step 6: Post-deploy verification

Once the deployment is READY, verify the portal is accessible:

```bash
PORTAL_URL="${CLOUD_PORTAL_URL:-https://$CLOUD_ORG_SLUG.showpane.com}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PORTAL_URL")
echo "Health check: $PORTAL_URL -> HTTP $HTTP_CODE"
```

Expected: HTTP 200. If not 200, warn the user but do not treat it as a fatal error — DNS propagation or edge caching may cause a brief delay.

Also check the API health endpoint:

```bash
curl -s -o /dev/null -w "%{http_code}" "$PORTAL_URL/api/health"
```

### Cloud Step 7: Deployment summary

Print a clear summary:

```
Cloud deploy complete!

  Mode:       cloud
  Migrations: up to date (or: N applied)
  Type check: passed
  Build:      .vercel/output/ (N files)
  Portals:    N active (M with credentials)
  Status:     READY
  Health:     OK (200)

  Portal URL: https://orgslug.showpane.com
  Deploy ID:  dpl_xxxxxxxxxxxx
```

### Cloud Step 8: Record deployment

Log the cloud deployment for operational memory:

```bash
echo '{"skill":"portal-deploy","key":"deploy","insight":"Cloud deploy to '$CLOUD_ORG_SLUG'.showpane.com. Migrations: <count>. Portals: <count> active. Deploy ID: '$DEPLOY_ID'.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

### Cloud Step 9: Clean up

Remove the temporary manifest file:

```bash
rm -f /tmp/showpane-deploy-manifest.json
```

---

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

### Cloud: Token or project ID invalid
If the Vercel API returns 401/403/404 during pre-flight:
- **401 Unauthorized**: The access token is expired or revoked. Run `showpane login` to re-authenticate.
- **403 Forbidden**: The token does not have access to this project. Check that the org and project match.
- **404 Not Found**: The `vercel_project_id` in config does not match a real project. Run `showpane login` to refresh.

### Cloud: File upload failure
If individual file uploads fail (non-200 and non-409):
- **413 Payload Too Large**: A single file exceeds Vercel's size limit (typically 100MB). Check for large assets that should be served from a CDN instead.
- **429 Too Many Requests**: Rate limited. Wait 10 seconds and retry the failed files. If persistent, upload in smaller batches.
- **500 Internal Server Error**: Transient Vercel issue. Retry the upload after a brief pause.

### Cloud: Deployment creation failure
If the POST to `/v13/deployments` fails:
- **400 Bad Request**: The manifest JSON is malformed or missing required fields. Check `/tmp/showpane-deploy-manifest.json` for issues.
- **402 Payment Required**: The Vercel account has hit its plan limits. Check the Vercel billing dashboard.
- **Missing files**: The deployment API returns `MISSING_FILES` with a list of SHA1 hashes. Re-upload those specific files and retry the deployment.

### Cloud: Deployment stuck or failed
If the deployment does not reach READY within 5 minutes:
- Check the Vercel dashboard for build logs and error details.
- Common causes: runtime errors in serverless functions, missing environment variables in the Vercel project settings.
- If the deployment shows ERROR, check the build output for specifics.

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
- For Cloud deploys: build locally, upload artifacts, and create the deployment — do not use `vercel deploy` CLI
- For Cloud deploys: always wait for the deployment to reach READY before declaring success
- For Cloud deploys: the portal URL is `https://{org}.showpane.com` — verify it returns 200 after deploy
- For Cloud deploys: clean up `/tmp/showpane-deploy-manifest.json` after deploy completes
- The CLI `showpane login` writes `accessToken`, `orgSlug`, `portalUrl` to config — the cloud deploy reads these with fallbacks for both the nested `cloud.*` keys and the top-level keys
