---
name: portal-deploy
description: |
  Publish the Showpane portal app to Showpane Cloud. Runs pre-flight checks, builds the app locally, uploads the artifact, and waits for the hosted publish to go live.
  Trigger phrases: "portal deploy", "deploy portals", "push to production", "ship the portals". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep, WebSearch]
---

Before proposing or executing cloud deploy behavior, read `skills/shared/platform-constraints.md`
and apply any relevant current platform limits.

## Preamble (run first)

```bash
# Read config
CONFIG="$HOME/.showpane/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "Showpane not configured. Run /portal setup first."
  exit 1
fi
APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null)
DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','local'))" 2>/dev/null)
ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null)
CLOUD_API_TOKEN=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',d).get('api_token', d.get('accessToken','')))" 2>/dev/null)
CLOUD_ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',d).get('org_slug', d.get('orgSlug','')))" 2>/dev/null)
CLOUD_PORTAL_URL=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('cloud',d).get('portal_url', d.get('portalUrl','')))" 2>/dev/null)
CLOUD_API_BASE="${SHOWPANE_CLOUD_URL:-https://app.showpane.com}"
APP_PATH="${SHOWPANE_APP_PATH:-$APP_PATH}"
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
DATABASE_URL="${DATABASE_URL:-}"
if [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "App dependencies not installed. Run: cd $APP_PATH && npm install"
  exit 1
fi
SKILL_DIR="${SHOWPANE_TOOLCHAIN_DIR:-$HOME/.showpane/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
LEARN_FILE="$HOME/.showpane/learnings.jsonl"
[ -f "$LEARN_FILE" ] && echo "LEARNINGS: $(wc -l < "$LEARN_FILE" | tr -d ' ') loaded" || echo "LEARNINGS: 0"

# Predictive next-skill suggestion
if [ -f "$HOME/.showpane/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$HOME/.showpane/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//' || true)
  [ -n "$_RECENT" ] && echo "RECENT_SKILLS: $_RECENT"
fi

# Search relevant learnings
LEARN_FILE="$HOME/.showpane/learnings.jsonl"
if [ -f "$LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries"
  if [ "$_LEARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "RECENT_LEARNINGS:"
    tail -5 "$LEARN_FILE" 2>/dev/null
  fi
fi

# Track skill execution
SHOWPANE_TIMELINE="$HOME/.showpane/timeline.jsonl"
mkdir -p "$(dirname "$SHOWPANE_TIMELINE")"
echo '{"skill":"portal-deploy","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
```

If RECENT_SKILLS is shown, suggest the likely next skill:
- After portal-create → suggest /portal-preview
- After portal-preview → suggest /portal-deploy or /portal-share
- After portal-deploy → suggest /portal-status or /portal-verify
- After portal-setup → suggest /portal-create
- After portal-credentials → suggest /portal-share
- After portal-update → suggest /portal-deploy

If RECENT_LEARNINGS is shown, review them before proceeding. Past learnings may contain
relevant warnings or tips for this operation. Apply them where relevant but don't
mention them unless they directly affect the current task.

## Steps

This skill always publishes to Showpane Cloud.

- If `CLOUD_API_TOKEN` is missing, stop and tell the user to run `showpane login`.
- If `DEPLOY_MODE` is `local`, that is fine — local is the normal authoring mode. The deploy target is still Showpane Cloud.

The flow below builds the app locally, packages the `.vercel/output` artifact, uploads that artifact to Showpane Cloud, and lets the control plane publish the hosted app. The OSS app should never need to reason about provider project IDs or call provider APIs directly.

### Cloud Step 1: Pre-flight checks

#### 1a. Verify cloud credentials

Check that the preamble successfully read cloud config values:

```bash
if [ -z "$CLOUD_API_TOKEN" ]; then
  echo "ERROR: No API token found. Run 'showpane login' to authenticate."
  exit 1
fi
```

If the token is missing, stop and tell the user to run `showpane login`.

#### 1b. Verify Showpane Cloud is reachable

```bash
curl -s -o /dev/null -w "%{http_code}" "$CLOUD_API_BASE/api/health"
```

Expected: HTTP 200. If Showpane Cloud is unreachable, stop and show the error. Token validity is checked by the deploy API itself — OSS should not call provider internals directly.

#### 1c. TypeScript type check

Run the standard type check:

```bash
cd "$APP_PATH" && npx tsc --noEmit 2>&1
```

If type errors are found, display them and stop. Offer to fix simple issues (missing imports, typos).

#### 1d. Verify portals have credentials

Run list-portals and warn about portals missing credentials. This is a warning, not a blocker.

### Cloud Step 2: Build the app

Before building, ensure the hidden local project-link metadata exists:

```bash
if [ ! -f "$APP_PATH/.vercel/project.json" ]; then
  cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/ensure-cloud-project-link.ts"
fi
```

Run the cloud build command that produces the prebuilt artifact:

```bash
cd "$APP_PATH" && npm run cloud:build
```

After the build completes, verify the output directory was created:

```bash
ls -la "$APP_PATH/.vercel/output/"
```

Expected: the `.vercel/output/` directory exists and contains `config.json`, `static/`, and optionally `functions/`. If the build fails or the output directory is missing, show the build errors and stop.

The build typically takes 30-90 seconds depending on the number of portals.

### Cloud Step 3: Package the deploy artifact

Package the prebuilt output plus the traced runtime files as a single zip artifact that can be handed to Showpane Cloud. This bundle must include:
- `.vercel/output/**`
- traced `.next/server/**` and `node_modules/**` files referenced by the build output
- a sanitized `.env` stub so the traced runtime can resolve its expected path without leaking local secrets

```bash
ARTIFACT_PATH="/tmp/showpane-deploy-${CLOUD_ORG_SLUG:-portal}.zip"
rm -f "$ARTIFACT_PATH"
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/create-deploy-bundle.ts" --output "$ARTIFACT_PATH"
test -f "$ARTIFACT_PATH" || { echo "ERROR: Artifact zip was not created"; exit 1; }
echo "Artifact ready: $ARTIFACT_PATH"
```

### Cloud Step 4: Export runtime data

Export the current local portal-runtime state so Showpane Cloud can sync credentials and portal metadata before publishing:

```bash
RUNTIME_DATA_PATH="/tmp/showpane-runtime-${CLOUD_ORG_SLUG:-portal}.json"
rm -f "$RUNTIME_DATA_PATH"
if [ -n "$ORG_SLUG" ]; then
  cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/export-runtime-state.ts" --org-slug "$ORG_SLUG" > "$RUNTIME_DATA_PATH"
else
  cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/export-runtime-state.ts" > "$RUNTIME_DATA_PATH"
fi
test -f "$RUNTIME_DATA_PATH" || { echo "ERROR: Runtime payload was not created"; exit 1; }
echo "Runtime payload ready: $RUNTIME_DATA_PATH"
```

### Cloud Step 5: Export file manifest

Export uploaded document metadata and checksums so Showpane Cloud can determine which files need syncing:

```bash
FILE_MANIFEST_PATH="/tmp/showpane-files-${CLOUD_ORG_SLUG:-portal}.json"
rm -f "$FILE_MANIFEST_PATH"
if [ -n "$ORG_SLUG" ]; then
  cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/export-file-manifest.ts" --org-slug "$ORG_SLUG" > "$FILE_MANIFEST_PATH"
else
  cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/export-file-manifest.ts" > "$FILE_MANIFEST_PATH"
fi
test -f "$FILE_MANIFEST_PATH" || { echo "ERROR: File manifest was not created"; exit 1; }
echo "File manifest ready: $FILE_MANIFEST_PATH"
```

### Cloud Step 6: Sync uploaded files

Ask Showpane Cloud which files are missing or stale, then upload only those file bytes:

```bash
SYNC_PLAN_RESPONSE=$(curl -s -X POST "$CLOUD_API_BASE/api/files/plan" \
  -H "Authorization: Bearer $CLOUD_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @"$FILE_MANIFEST_PATH")

MISSING_COUNT=$(echo "$SYNC_PLAN_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR: ' + d['error'])
    sys.exit(1)
print(len(d.get('missing', [])))
")

echo \"Files to sync: $MISSING_COUNT\"

if [ \"$MISSING_COUNT\" -gt 0 ]; then
  TMP_SYNC_DIR=$(mktemp -d /tmp/showpane-file-sync.XXXXXX)
  echo \"$SYNC_PLAN_RESPONSE\" | python3 -c '
import json, sys
for item in json.load(sys.stdin).get(\"missing\", []):
    print(\"\\t\".join([
        item[\"storagePath\"],
        item[\"portalSlug\"],
        item[\"filename\"],
        item[\"mimeType\"],
        str(item[\"size\"]),
        item[\"uploadedBy\"],
        item[\"uploadedAt\"],
        item[\"checksum\"],
    ]))
' | while IFS=$'\t' read -r STORAGE_PATH PORTAL_SLUG FILE_NAME MIME_TYPE FILE_SIZE UPLOADED_BY UPLOADED_AT CHECKSUM; do
    TMP_FILE="$TMP_SYNC_DIR/$CHECKSUM"
    cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/materialize-file.ts" --storage-path "$STORAGE_PATH" --output "$TMP_FILE"
    curl -s -X POST "$CLOUD_API_BASE/api/files/upload" \
      -H "Authorization: Bearer $CLOUD_API_TOKEN" \
      -F "file=@$TMP_FILE;type=$MIME_TYPE" \
      -F "storagePath=$STORAGE_PATH" \
      -F "portalSlug=$PORTAL_SLUG" \
      -F "filename=$FILE_NAME" \
      -F "mimeType=$MIME_TYPE" \
      -F "size=$FILE_SIZE" \
      -F "uploadedBy=$UPLOADED_BY" \
      -F "uploadedAt=$UPLOADED_AT" \
      -F "checksum=$CHECKSUM" \
      >/dev/null || exit 1
  done
fi
```

### Cloud Step 7: Start the staged deployment

```bash
PORTAL_COUNT=$(cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/list-portals.ts" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('portals', [])))")

INIT_RESPONSE=$(curl -s -X POST "$CLOUD_API_BASE/api/deployments" \
  -H "Authorization: Bearer $CLOUD_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary '{}')

echo \"$INIT_RESPONSE\" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR: ' + str(d['error']))
    sys.exit(1)
print('Deployment initialized')
print('ID: ' + d.get('deploymentId', 'unknown'))
print('Status: ' + d.get('status', 'unknown'))
"
```

Extract the deployment ID and the presigned artifact upload URL from the response. If the API returns an error, show it and stop.

### Cloud Step 8: Upload the artifact directly to storage

```bash
DEPLOY_ID=$(echo "$INIT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('deploymentId',''))")
ARTIFACT_UPLOAD_URL=$(echo "$INIT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('artifactUploadUrl',''))")

if [ -z "$DEPLOY_ID" ] || [ -z "$ARTIFACT_UPLOAD_URL" ]; then
  echo "ERROR: Missing deploymentId or artifact upload URL"
  exit 1
fi

curl -s -X PUT "$ARTIFACT_UPLOAD_URL" \
  -H "Content-Type: application/zip" \
  --data-binary @"$ARTIFACT_PATH" \
  >/dev/null
```

### Cloud Step 9: Finalize the deployment

```bash
FINALIZE_PAYLOAD="/tmp/showpane-deploy-finalize-${DEPLOY_ID}.json"
python3 - <<'PY' "$RUNTIME_DATA_PATH" "$PORTAL_COUNT" > "$FINALIZE_PAYLOAD"
import json, sys
runtime_path = sys.argv[1]
portal_count = int(sys.argv[2])
payload = {
  "portalCount": portal_count,
  "runtimeData": json.load(open(runtime_path)),
}
print(json.dumps(payload))
PY

FINALIZE_RESPONSE=$(curl -s -X POST "$CLOUD_API_BASE/api/deployments/$DEPLOY_ID/finalize" \
  -H "Authorization: Bearer $CLOUD_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @"$FINALIZE_PAYLOAD")

echo "$FINALIZE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR: ' + str(d['error']))
    sys.exit(1)
print('Deployment accepted')
print('ID: ' + d.get('deploymentId', 'unknown'))
print('Status: ' + d.get('status', 'unknown'))
"
```

### Cloud Step 10: Wait for cloud publish to finish

Poll Showpane Cloud until the deployment reaches `live` or `failed`:

```bash
echo "Waiting for deployment to go live..."
for i in $(seq 1 60); do
  sleep 5
  STATUS=$(curl -s \
    -H "Authorization: Bearer $CLOUD_API_TOKEN" \
    "$CLOUD_API_BASE/api/deployments/$DEPLOY_ID" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))")

  echo "  Status: $STATUS"

  if [ "$STATUS" = "live" ]; then
    echo "Deployment is live!"
    break
  fi

  if [ "$STATUS" = "failed" ] || [ "$STATUS" = "unhealthy" ]; then
    echo "ERROR: Deployment failed with status: $STATUS"
    curl -s \
      -H "Authorization: Bearer $CLOUD_API_TOKEN" \
      "$CLOUD_API_BASE/api/deployments/$DEPLOY_ID"
    exit 1
  fi
done

if [ "$STATUS" != "live" ]; then
  echo "WARNING: Deployment did not become ready within 5 minutes."
  echo "Check Showpane Cloud for status."
fi
```

The publish typically takes 15-60 seconds. Poll every 5 seconds for up to 5 minutes.

### Cloud Step 11: Post-deploy verification

Once the deployment is live, verify the portal is accessible:

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

### Cloud Step 12: Deployment summary

Print a clear summary:

```
Cloud deploy complete!

  Mode:       cloud
  Type check: passed
  Build:      .vercel/output/ (N files)
  Portals:    N active
  Status:     live
  Health:     OK (200)

  Portal URL: https://orgslug.showpane.com
  Deploy ID:  dep_xxxxxxxxxxxx
```

### Cloud Step 13: Record deployment

Log the cloud deployment for operational memory:

```bash
echo '{"skill":"portal-deploy","key":"deploy","insight":"Cloud deploy to '$CLOUD_ORG_SLUG'.showpane.com. Migrations: <count>. Portals: <count> active. Deploy ID: '$DEPLOY_ID'.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

### Cloud Step 14: Clean up

Remove the temporary artifact:

```bash
rm -f "$ARTIFACT_PATH"
rm -f "$RUNTIME_DATA_PATH"
rm -f "$FILE_MANIFEST_PATH"
rm -f "$FINALIZE_PAYLOAD"
[ -n "${TMP_SYNC_DIR:-}" ] && rm -rf "$TMP_SYNC_DIR"
```

---

## Post-Deploy Verification

After deployment succeeds, automatically run these verification steps. Do not ask the user — just do them.

### Step V1: DNS/URL Check
Fetch the portal URL and verify it returns 200:
```bash
PORTAL_URL="${CLOUD_PORTAL_URL:-https://$CLOUD_ORG_SLUG.showpane.com}"
echo "Verifying $PORTAL_URL..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PORTAL_URL" 2>/dev/null)
echo "HTTP status: $HTTP_CODE"
```
If not 200, warn but don't fail — DNS propagation may take time for cloud deploys.

### Step V2: Portal Content Check
If portals exist in the database, verify at least one portal login page loads:
```bash
# Get the first active portal slug
FIRST_SLUG=$(cd "$APP_PATH" && npx tsx -e "
  const { prisma } = require('./src/lib/db');
  prisma.clientPortal.findFirst({ where: { isActive: true }, select: { slug: true } })
    .then(p => console.log(p?.slug || ''))
    .finally(() => prisma.\$disconnect());
" 2>/dev/null)
if [ -n "$FIRST_SLUG" ]; then
  echo "Checking portal: $PORTAL_URL/client/$FIRST_SLUG"
  curl -s -o /dev/null -w "Portal login page: %{http_code}\n" "$PORTAL_URL/client/$FIRST_SLUG" 2>/dev/null
fi
```

### Step V3: SSL Check (cloud only)
For cloud deploys, verify SSL is working:
```bash
if [ "$DEPLOY_MODE" = "cloud" ] && [ -n "$CLOUD_PORTAL_URL" ]; then
  echo "Checking SSL..."
  SSL_OK=$(curl -s -o /dev/null -w "%{http_code}" "https://${CLOUD_ORG_SLUG}.showpane.com" 2>/dev/null)
  echo "SSL status: $SSL_OK"
fi
```

### Step V4: Summary
Print a deployment summary:
```
✓ Deployed successfully
  URL:     [portal URL]
  Portals: [count]
  SSL:     [ok/pending]
  
Next: /portal-status for ongoing monitoring
```

---

## Error Recovery

Deployments can fail at multiple points. Here is how to recover from each:

### Local build failure
If the local build fails:
- Check the type and build output directly
- Check that `.env` contains the expected local SQLite settings
- Check available disk space for the Next.js build and artifact zip

### Health check failure
If the health endpoint returns non-200 after deploy:
- Check the deployment status from `GET /api/deployments/$DEPLOY_ID`
- Common causes: DNS propagation, hosted runtime config issues, or a bad artifact upload
- Report the exact hosted error if Showpane Cloud returns one

### Cloud: Token invalid or auth expired
If the Showpane Cloud API returns 401/403 during pre-flight or publish:
- **401 Unauthorized**: The access token is expired or revoked. Run `showpane login` to re-authenticate.
- **403 Forbidden**: The token does not belong to an org that can publish. Re-authenticate or finish cloud onboarding.
- **409 organization_required**: The user authenticated but has no org yet. Send them to Showpane Cloud checkout to start the trial, then re-run `showpane login`.

### Cloud: Artifact upload failure
If the deployment init or finalize call fails:
- **400 Bad Request**: The runtime payload is missing or malformed. Rebuild locally and retry.
- **409 Conflict**: The deployment was not initialized, the artifact was not uploaded yet, or the org has no hosted project provisioned.
- **422 Validation Error**: The cloud control plane rejected the deploy metadata. Show the response body directly.

### Cloud: File sync failure
If `POST /api/files/plan` or `POST /api/files/upload` fails:
- **409 Conflict**: Hosted file sync needs object storage configured in Showpane Cloud. Configure S3/R2-backed storage before deploying documents.
- **404 Not Found**: The target portal slug does not exist in the synced runtime state. Re-export runtime data and retry the deploy.
- **413 Payload Too Large**: A single uploaded file is too large for multipart upload. Move that document to shared storage and link it instead of embedding it in the portal.
- **5xx**: The cloud storage layer failed. Retry after verifying storage credentials.

### Cloud: Publish stuck or failed
If the deployment never reaches `live`:
- Check the response from `GET /api/deployments/$DEPLOY_ID` for an `error` field.
- Report the failure exactly as returned by Showpane Cloud.
- Do not tell the user to debug provider internals directly unless the cloud response explicitly points there.

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-deploy","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Conventions

- Always run pre-flight checks before deploying — never skip the type check
- Credential warnings are non-blocking — the user decides whether to continue
- If any pre-flight check fails (type errors, missing deploy config), stop and explain
- Show the full deployment summary with portal count, migration status, and health
- If this is the first deploy, suggest running `/portal credentials` for all portals before deploying so clients can actually log in
- For Cloud deploys: build locally, upload the artifact to Showpane Cloud, and let the control plane publish it
- For Cloud deploys: upload the artifact directly to storage using the presigned URL, not through the deployment function body
- For Cloud deploys: always wait for the deployment to reach `live` before declaring success
- For Cloud deploys: the portal URL is `https://{org}.showpane.com` — verify it returns 200 after deploy
- For Cloud deploys: clean up the temporary artifact after deploy completes
- The CLI `showpane login` is auth only — org creation and billing live in Showpane Cloud checkout
- For Cloud deploys: OSS should never call provider APIs directly or require provider details from the user
