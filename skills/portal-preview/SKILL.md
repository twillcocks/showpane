---
name: portal-preview
description: |
  Open a portal in the browser for preview. Use when asked to "preview portal",
  "open portal", "view portal", "show me the portal", or "open in browser". (showpane)
allowed-tools: [Bash, Read]
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
echo '{"skill":"portal-preview","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
if [ "portal-preview" = "portal-deploy" ]; then
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

Read `skills/shared/runtime-principles.md` directly from that exact path near the start of the skill and apply the relevant product defaults.

If `skills/shared/platform-constraints.md` exists, read it directly from that exact path near the start of the skill and apply only the relevant limits. No directory listing is needed first.

## Overview

This skill opens a portal in the user's default web browser. It is the fastest way to see what a portal looks like after creating or updating it. The skill determines the correct URL based on whether a local dev server is running and whether a public app URL is configured, then opens it using the platform's native command.

This is a lightweight skill -- it does not start a dev server, build the app, or modify anything. It just opens a URL. If the dev server is not running, it tells the user how to start it.

## Steps

### Step 1: Identify the target portal

If the user specified a slug (e.g., "preview whzan"), use that slug directly.

If no slug is provided, check how many portals exist:
- If there is exactly one portal, use that one and mention it: "Opening your only portal: <slug>"
- If there are multiple portals, ask: "Which portal do you want to preview? Run /portal-list to see your portals."
- If there are zero portals, say: "No portals found. Create one first with /portal-create."

For single-portal organizations, auto-selecting saves a round trip.

### Step 2: Determine the correct URL

The URL depends on the environment. Check in this order of priority:

**Option A: Local dev server running (check port 3000)**

```bash
lsof -i :3000 -sTCP:LISTEN -t >/dev/null 2>&1 && echo "DEV_RUNNING=true" || echo "DEV_RUNNING=false"
```

If a process is listening on port 3000, the URL is:
```
http://localhost:3000/client/<slug>
```

**Option B: NEXT_PUBLIC_APP_URL is set**

If the environment variable `NEXT_PUBLIC_APP_URL` is set (sourced from `.env` by the preamble), use it:
```
${NEXT_PUBLIC_APP_URL}/client/<slug>
```

This handles deployed URLs, custom domains, and any other public preview target.

**Fallback: Nothing running**

If no server is detected and no app URL is configured, do not open the browser. Instead, inform the user:

"No running server detected. Start the dev server with /portal-dev, or set NEXT_PUBLIC_APP_URL in your .env file."

### Step 3: Open the URL in the browser

Use the platform-appropriate command:

```bash
# macOS
open "<url>"

# Linux
xdg-open "<url>"
```

Detect the platform:

```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "<url>"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "<url>"
else
  echo "Cannot detect browser opener. Visit: <url>"
fi
```

Run this in a single Bash tool call so the browser opens immediately.

### Step 4: Print confirmation

After opening, display:

```
Opened portal for <slug> in browser
URL: http://localhost:3000/client/<slug>
```

If the portal has credentials set up, remind the user:
"Login with the credentials from /portal-credentials <slug>. For external access, publish first with /portal-deploy."

If the portal is the example portal (slug is "example"), no credentials are needed -- it is publicly accessible by design.

## URL Priority Order

To be explicit about resolution order:

1. **Dev server on port 3000** -- always preferred for local development, regardless of other settings.
2. **NEXT_PUBLIC_APP_URL** -- used for deployed environments or when no local server is detected.
3. **Fallback** -- no URL available, prompt the user to start a server.

This order ensures that during development, the user always sees the latest local version, even if NEXT_PUBLIC_APP_URL points to production.

## Conventions

- Always check for a running server before attempting to open. Opening a URL with no server just shows a browser error page -- a poor experience.
- Print the full URL so the user can copy-paste it if needed (e.g., to share with a colleague looking at the same screen).
- Do not open multiple browser tabs. One call to `open` per invocation.
- If the slug is "example", mention that this is the built-in example portal and does not require authentication.
- If learnings indicate the user prefers a specific browser or has a custom port, adapt the URL accordingly.

## Edge Cases

- **Port conflict**: If port 3000 has a non-Showpane process running, `lsof` will still detect it and the URL will be wrong. This is unlikely in practice but worth noting. The user will see a different app in the browser and can correct by specifying the URL manually.
- **WSL (Windows Subsystem for Linux)**: `xdg-open` may not work. On WSL, use `wslview` or `explorer.exe` instead. Detect WSL via `grep -qi microsoft /proc/version`.
- **SSH/remote session**: If the user is connected via SSH, opening a browser on the remote machine does nothing useful. Detect this via the `SSH_CONNECTION` environment variable and print the URL instead: "You appear to be in an SSH session. Visit this URL on your local machine: <url>"
- **Inactive portal**: If the portal is deactivated (`isActive: false`), the preview will show a "not found" page. Warn the user: "Portal '<slug>' is inactive. You'll see a not-found page. Reactivate it first or use /portal-list to check status."

## Error Handling

- If the preamble fails, stop and display the error.
- If no server is running and no URL is configured, provide clear instructions rather than opening a dead URL.
- If the `open` or `xdg-open` command fails, print the URL as a fallback: "Could not open browser automatically. Visit: <url>"

## Login Context

When the portal opens in the browser, the client will see a login page (unless they have an active session or use a share link). Provide context about how to access the portal:

- **Has credentials**: Remind the user of the username (derived from the slug). Do not display the password -- they can get it from `/portal-credentials <slug>` if they need it.
- **No credentials**: Warn that the portal will show a login page but there are no credentials to enter. Suggest running `/portal-credentials <slug>` first.
- **Example portal**: The built-in example at `/client/example` is publicly accessible and does not require login. No credentials needed.

If the user is previewing to check content before sharing with a client, suggest: "To see exactly what the client will see, open an incognito/private window. Your existing session cookies may affect the view. When the portal looks right, publish it with /portal-deploy before sending anything externally."

## Previewing After Changes

A common workflow is: edit portal content with `/portal-update`, then preview to verify. If the dev server is running with Next.js hot reload, changes to the client component files will appear immediately without a page refresh.

If the user just ran `/portal-update` and then `/portal-preview`, mention: "If you don't see your changes, make sure the dev server is running so hot reload can pick them up."

## Multiple Portals Preview

If the user asks to "preview all portals" or "open all my portals", open each one in a separate browser tab. However, limit to 5 tabs maximum to avoid browser overload. If there are more than 5 portals, open the 5 most recently updated and note: "Opened the 5 most recently updated portals. Use /portal-preview <slug> for specific portals."

To open multiple tabs, run the open command for each URL sequentially:

```bash
open "http://localhost:3000/client/whzan"
open "http://localhost:3000/client/acme"
open "http://localhost:3000/client/example"
```

Each `open` call creates a new tab in the default browser.

## Telemetry

If telemetry is enabled, the preview skill records a minimal event:

```json
{"skill":"portal-preview","ts":"2026-04-07T12:00:00Z","duration_s":1,"outcome":"success"}
```

No portal slug or URL is included in telemetry. The event only records that a preview was triggered.

## Completion

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-preview","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-preview" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
