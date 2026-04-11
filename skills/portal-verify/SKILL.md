---
name: portal-verify
description: |
  Verify a Showpane Cloud portal after publish: DNS, SSL, login page, content rendering, engagement tracking.
  Trigger phrases: "verify portal", "check deployment", "is my portal working", "portal health". (showpane)
allowed-tools: [Bash, Read, Glob, Grep]
---

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
echo '{"skill":"portal-verify","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
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

### Step 1: URL Reachability

Determine the portal URL and check that it responds.

```bash
if [ -z "$CLOUD_PORTAL_URL" ] && [ -z "$CLOUD_ORG_SLUG" ]; then
  echo "No hosted portal URL configured. Run /portal-deploy first."
  exit 1
fi
PORTAL_URL="${CLOUD_PORTAL_URL:-https://$CLOUD_ORG_SLUG.showpane.com}"
echo "Checking app URL: $CLOUD_API_BASE"
APP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUD_API_BASE/api/health" 2>/dev/null)
echo "App health: $APP_CODE"

echo "Checking org URL: $PORTAL_URL"
ORG_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PORTAL_URL" 2>/dev/null)
echo "Org portal: $ORG_CODE"

if [ "$ORG_CODE" = "200" ]; then
  URL_STATUS="ok"
else
  URL_STATUS="unreachable ($ORG_CODE)"
fi
```

If the URL is unreachable, warn the user but continue with remaining checks. DNS propagation or cold starts can cause brief unavailability.

### Step 2: SSL Verification (cloud only)

For cloud deploys, verify the SSL certificate is valid and HTTPS redirect works.

```bash
if [ "$DEPLOY_MODE" = "cloud" ] && [ -n "$CLOUD_ORG_SLUG" ]; then
  HTTPS_URL="https://${CLOUD_ORG_SLUG}.showpane.com"
  echo "Checking SSL for $HTTPS_URL..."

  # Check certificate validity and expiry
  SSL_INFO=$(echo | openssl s_client -servername "${CLOUD_ORG_SLUG}.showpane.com" \
    -connect "${CLOUD_ORG_SLUG}.showpane.com:443" 2>/dev/null \
    | openssl x509 -noout -dates 2>/dev/null)

  if [ -n "$SSL_INFO" ]; then
    SSL_EXPIRY=$(echo "$SSL_INFO" | grep 'notAfter' | cut -d= -f2)
    echo "SSL valid, expires: $SSL_EXPIRY"
    SSL_STATUS="valid, expires $SSL_EXPIRY"
  else
    echo "SSL certificate not found or invalid"
    SSL_STATUS="not found"
  fi

  # Check HTTPS redirect from HTTP
  HTTP_URL="http://${CLOUD_ORG_SLUG}.showpane.com"
  REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL" 2>/dev/null)
  if [ "$REDIRECT_CODE" = "301" ] || [ "$REDIRECT_CODE" = "308" ]; then
    echo "HTTP->HTTPS redirect: OK ($REDIRECT_CODE)"
  else
    echo "HTTP->HTTPS redirect: $REDIRECT_CODE (expected 301 or 308)"
  fi
else
  SSL_STATUS="n/a (no cloud org configured)"
fi
```

### Step 3: Portal Login Pages

List all active portals from the database and verify each login page loads.

```bash
cd "$APP_PATH" && PORTAL_LIST=$(npx tsx -e "
  const { prisma } = require('./src/lib/db');
  prisma.clientPortal.findMany({ where: { isActive: true }, select: { slug: true, clientName: true } })
    .then(portals => console.log(JSON.stringify(portals)))
    .finally(() => prisma.\$disconnect());
" 2>/dev/null)

echo "Active portals: $PORTAL_LIST"
```

For each portal, verify the login page returns a response and contains auth-related content:

```bash
PORTAL_URL="${CLOUD_PORTAL_URL:-https://$CLOUD_ORG_SLUG.showpane.com}"
echo "$PORTAL_LIST" | python3 -c "
import sys, json
portals = json.load(sys.stdin)
for p in portals:
    slug = p['slug']
    name = p.get('clientName', slug)
    print(f'  {name} ({slug})')
print(f'{len(portals)} active portals')
" 2>/dev/null
```

Then for each portal slug, check the login page:

```bash
for SLUG in $(echo "$PORTAL_LIST" | python3 -c "
import sys, json
for p in json.load(sys.stdin): print(p['slug'])
" 2>/dev/null); do
  PAGE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PORTAL_URL/client/$SLUG" 2>/dev/null)
  PAGE_BODY=$(curl -s "$PORTAL_URL/client/$SLUG" 2>/dev/null | head -c 5000)
  HAS_AUTH=$(echo "$PAGE_BODY" | grep -ci 'password\|login\|sign.in\|auth' 2>/dev/null || echo "0")
  if [ "$PAGE_CODE" = "200" ] && [ "$HAS_AUTH" -gt 0 ]; then
    echo "  $SLUG: Login page OK"
  elif [ "$PAGE_CODE" = "200" ]; then
    echo "  $SLUG: Page loads ($PAGE_CODE) but no auth content detected"
  else
    echo "  $SLUG: FAILED ($PAGE_CODE)"
  fi
done
```

### Step 4: Engagement Tracking

Verify the client events API endpoint responds.

```bash
PORTAL_URL="${CLOUD_PORTAL_URL:-http://localhost:3000}"
EVENTS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$PORTAL_URL/api/client-events" 2>/dev/null)
echo "Events endpoint: $EVENTS_CODE"
```

For cloud deploys, also verify the cloud events URL is reachable:

```bash
if [ "$DEPLOY_MODE" = "cloud" ] && [ -n "$CLOUD_EVENTS_URL" ]; then
  CLOUD_EVENTS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$CLOUD_EVENTS_URL/api/client-events" 2>/dev/null)
  echo "Cloud events endpoint: $CLOUD_EVENTS_CODE"
fi
```

The events endpoint should return 200 or 204 for OPTIONS requests. A 404 means the route is not deployed. A 405 (Method Not Allowed) is also acceptable — it means the route exists but only accepts POST.

### Step 5: File Downloads

Check if any PortalFile records exist and verify file download endpoints work.

```bash
cd "$APP_PATH" && FILE_INFO=$(npx tsx -e "
  const { prisma } = require('./src/lib/db');
  prisma.portalFile.findMany({ select: { id: true, filename: true, portalId: true } })
    .then(files => console.log(JSON.stringify({ count: files.length, files: files.slice(0, 5) })))
    .catch(() => console.log(JSON.stringify({ count: 0, files: [] })))
    .finally(() => prisma.\$disconnect());
" 2>/dev/null)

FILE_COUNT=$(echo "$FILE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
echo "Hosted files: $FILE_COUNT"
```

If files exist, verify a sample file download endpoint responds:

```bash
if [ "$FILE_COUNT" -gt 0 ]; then
  SAMPLE_FILE_ID=$(echo "$FILE_INFO" | python3 -c "
import sys, json
files = json.load(sys.stdin).get('files', [])
if files: print(files[0]['id'])
" 2>/dev/null)
  if [ -n "$SAMPLE_FILE_ID" ]; then
    PORTAL_URL="${CLOUD_PORTAL_URL:-http://localhost:3000}"
    DL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PORTAL_URL/api/files/$SAMPLE_FILE_ID" 2>/dev/null)
    echo "File download endpoint: $DL_CODE"
    if [ "$DL_CODE" = "200" ] || [ "$DL_CODE" = "302" ]; then
      FILE_STATUS="accessible"
    else
      FILE_STATUS="endpoint returned $DL_CODE"
    fi
  fi
else
  FILE_STATUS="none hosted"
fi
```

### Step 6: Report

Compile all check results into a health report. Print it in this format:

```
Portal Health Report
====================
URL:          https://orgslug.showpane.com  [ok/unreachable]
SSL:          Valid, expires 2027-01-15      [ok/not found/n/a]
Portals:      3 active
  acme:       Login page [ok/failed], Events [ok/failed]
  betacorp:   Login page [ok/failed], Events [ok/failed]
  demo:       Login page [ok/failed], Events [ok/failed]
Files:        5 hosted, all accessible       [ok/issues]

Overall: HEALTHY / DEGRADED / UNHEALTHY
```

Rules for the overall status:
- **HEALTHY**: All checks pass (URL reachable, SSL valid for cloud, all portals load, events endpoint responds)
- **DEGRADED**: URL reachable but some portals fail, or SSL is pending, or events endpoint is down
- **UNHEALTHY**: URL is unreachable, or no portals load

After the report, suggest next steps:
- If UNHEALTHY: "Run /portal-deploy to redeploy, or /investigate to debug."
- If DEGRADED: "Check individual portal issues above. Run /portal-status for ongoing monitoring."
- If HEALTHY: "All systems operational. Run /portal-status for ongoing monitoring."

## Conventions

- This skill is read-only — it never modifies the deployment or database
- All checks use curl with short timeouts to avoid hanging on unreachable endpoints
- Cloud checks verify both the control plane (app.showpane.com) and the org portal (orgslug.showpane.com)
- The PortalFile model may not exist in all schema versions — catch errors gracefully
- If the database is unreachable, skip DB-dependent checks (Steps 3, 5) and note it in the report
- SSL checks only apply when a cloud portal URL is configured
- The events endpoint check uses OPTIONS to avoid creating spurious event records
