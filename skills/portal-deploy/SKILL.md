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

Before doing anything else, execute this block in a Bash tool call:

```bash
SHOWPANE_HOME="$HOME/.showpane"
SHOWPANE_BIN="$SHOWPANE_HOME/bin"
CONFIG="$SHOWPANE_HOME/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "Showpane not configured. Run /portal-setup first."
  exit 1
fi

APP_PATH=$("$SHOWPANE_BIN/showpane-config" get app_path 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null)
DEPLOY_MODE=$("$SHOWPANE_BIN/showpane-config" get deploy_mode 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','local'))" 2>/dev/null || echo "local")
ORG_SLUG=$("$SHOWPANE_BIN/showpane-config" get orgSlug 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null || true)
CLOUD_API_TOKEN=$("$SHOWPANE_BIN/showpane-config" get accessToken 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('accessToken',''))" 2>/dev/null || true)
CLOUD_API_BASE="${SHOWPANE_CLOUD_URL:-https://app.showpane.com}"
CLOUD_ORG_SLUG="${ORG_SLUG:-}"
CLOUD_PORTAL_URL=$("$SHOWPANE_BIN/showpane-config" get portalUrl 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('portalUrl',''))" 2>/dev/null || true)
APP_PATH="${SHOWPANE_APP_PATH:-$APP_PATH}"
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
DATABASE_URL="${DATABASE_URL:-}"
if [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "App dependencies not installed. Run: cd $APP_PATH && npm install"
  exit 1
fi

SKILL_DIR="${SHOWPANE_TOOLCHAIN_DIR:-$SHOWPANE_HOME/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
_UPD=$("$SHOWPANE_BIN/showpane-update-check" 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p "$SHOWPANE_HOME/sessions" "$SHOWPANE_HOME/analytics" "$SHOWPANE_HOME/checkpoints"
touch "$SHOWPANE_HOME/sessions/$PPID"
find "$SHOWPANE_HOME/sessions" -mmin +120 -type f -delete 2>/dev/null || true
TEL=$("$SHOWPANE_BIN/showpane-config" get telemetry 2>/dev/null || echo "anonymous")
TEL_PROMPTED=$([ -f "$SHOWPANE_HOME/.telemetry-prompted" ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="${PPID:-0}-$(date +%s)"

LEARN_FILE="$SHOWPANE_HOME/learnings.jsonl"
[ -f "$LEARN_FILE" ] && echo "LEARNINGS: $(wc -l < "$LEARN_FILE" | tr -d ' ') loaded" || echo "LEARNINGS: 0"
if [ -f "$SHOWPANE_HOME/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$SHOWPANE_HOME/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '
' ',' | sed 's/,$//' || true)
  [ -n "$_RECENT" ] && echo "RECENT_SKILLS: $_RECENT"
fi
if [ -f "$LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries"
  if [ "$_LEARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "RECENT_LEARNINGS:"
    tail -5 "$LEARN_FILE" 2>/dev/null
  fi
fi

SHOWPANE_TIMELINE="$SHOWPANE_HOME/timeline.jsonl"
mkdir -p "$(dirname "$SHOWPANE_TIMELINE")"
echo '{"skill":"portal-deploy","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
if [ "portal-deploy" = "portal-deploy" ]; then
  echo "ORG_SLUG: $ORG_SLUG"
  echo "CLOUD_API_TOKEN: ${CLOUD_API_TOKEN:+present}${CLOUD_API_TOKEN:-missing}"
  echo "CLOUD_API_BASE: ${CLOUD_API_BASE:-missing}"
  echo "CLOUD_ORG_SLUG: ${CLOUD_ORG_SLUG:-missing}"
  echo "CLOUD_PORTAL_URL: ${CLOUD_PORTAL_URL:-missing}"
fi
echo "TELEMETRY: $TEL"
echo "TEL_PROMPTED: $TEL_PROMPTED"
```

If output shows `JUST_UPGRADED <from> <to>`, tell the user Showpane was just upgraded and continue.

If output shows `UPGRADE_AVAILABLE <old> <new>`, tell the user a newer Showpane toolchain is available and recommend `/portal-upgrade`.

If `TEL_PROMPTED` is `no`, default telemetry to `anonymous` without interrupting the flow. Do not mention telemetry unless the user asks.

Run:
```bash
"$SHOWPANE_BIN/showpane-config" set telemetry anonymous
touch "$SHOWPANE_HOME/.telemetry-prompted"
```

If `RECENT_SKILLS` is shown, suggest the likely next skill:
- After portal-create → suggest /portal-preview
- After portal-preview → suggest /portal-deploy
- After portal-deploy → suggest /portal-status or /portal-verify
- After portal-setup → suggest /portal-onboard for a first run, or /portal-create for the fast path
- After portal-credentials → suggest /portal-deploy before external sharing
- After portal-update → suggest /portal-preview or /portal-deploy

If `RECENT_LEARNINGS` is shown, review them before proceeding. Apply them where relevant but do not mention them unless they materially affect the current task.

Read `skills/shared/runtime-principles.md` once near the start of the skill and apply the relevant product defaults.

If `skills/shared/platform-constraints.md` exists, read it once near the start of the skill and apply only the relevant limits.

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
  echo "ERROR: No cloud access token found. Run 'showpane login' to authenticate."
  exit 1
fi
```

If the token is missing, stop and tell the user:

- `showpane login` is the right next step
- it owns the whole browser flow now: sign up or sign in if needed, start checkout,
  then return to CLI authorization automatically
- do not manually steer the user through separate sign-up, sign-in, or checkout steps

If they are already inside Claude Code, explicitly suggest:

```text
! showpane login
```

Then resume deploy after login finishes.

#### 1b. Verify Showpane Cloud is reachable

```bash
curl -s -o /dev/null -w "%{http_code}" "$CLOUD_API_BASE/api/health"
```

Expected: HTTP 200. If Showpane Cloud is unreachable, stop and show the error. Token validity is checked by the deploy API itself — OSS should not call provider internals directly.

#### 1c. TypeScript type check

Run the standard type check:

```bash
cd "$APP_PATH" && npx tsc --noEmit
```

If type errors are found, display them and stop. Offer to fix simple issues (missing imports, typos).

#### 1d. Verify portals have credentials

Run list-portals and warn about portals missing credentials. This is a warning, not a blocker.

### Cloud Step 2: Run the canonical deploy command

Use the built-in deploy command instead of reimplementing the staged cloud protocol in shell.

```bash
DEPLOY_JSON=$(cd "$APP_PATH" && SHOWPANE_APP_PATH="$APP_PATH" NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$SKILL_DIR/bin/tsconfig.json" "$SKILL_DIR/bin/deploy-to-cloud.ts" --app-path "$APP_PATH" --wait --json)
echo "$DEPLOY_JSON"
```

That command already owns:
- type check
- project-link bootstrap
- `cloud:build`
- artifact packaging
- runtime export
- optional file sync
- deployment init/upload/finalize
- polling to terminal state
- hosted verification

Parse the JSON and stop immediately if `ok` is false.

### Cloud Step 3: Summarize the result

Read these fields from the returned JSON:
- `deploymentId`
- `status`
- `liveUrl`
- `portalCount`
- `firstPortalSlug`
- `fileSyncCount`
- `verification.portalStatus`
- `verification.healthStatus`

If `status` is not `live`, treat the deploy as failed.

Print a concise summary:

```text
Cloud deploy complete

  Status:     live
  Deploy ID:  dep_xxxxxxxxxxxx
  Live URL:   https://orgslug.showpane.com
  Portals:    N
  File sync:  N
```

### Cloud Step 4: Record deployment

Log the cloud deployment for operational memory:

```bash
DEPLOY_ID=$(echo "$DEPLOY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deploymentId',''))")
PORTAL_COUNT=$(echo "$DEPLOY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('portalCount',0))")
echo '{"skill":"portal-deploy","key":"deploy","insight":"Cloud deploy to '$CLOUD_ORG_SLUG'.showpane.com. Portals: '$PORTAL_COUNT' active. Deploy ID: '$DEPLOY_ID'.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

The deploy command already handles cleanup and hosted verification. Do not duplicate those steps here.

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
- **409 organization_required**: Tell the user to run `showpane login` again and let that browser flow continue. Do not manually redirect them into separate checkout steps from this skill.
- **409 organization_not_ready**: The org exists, but billing or provisioning is not publish-ready. Surface the returned `reason`, `nextAction`, and settings/checkout URL directly instead of collapsing it into a generic deploy failure.

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

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-deploy","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-deploy" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
