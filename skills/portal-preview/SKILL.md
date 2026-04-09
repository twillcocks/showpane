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
CONFIG="$HOME/.showpane/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "Showpane not configured. Run /portal setup first."
  exit 1
fi
APP_PATH=$(cat "$CONFIG" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('app_path',''))" 2>/dev/null)
DEPLOY_MODE=$(cat "$CONFIG" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('deploy_mode','docker'))" 2>/dev/null)
ORG_SLUG=$(cat "$CONFIG" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null)
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

# Predictive next-skill suggestion
if [ -f "$HOME/.showpane/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$HOME/.showpane/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//')
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
echo '{"skill":"portal-preview","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

## Overview

This skill opens a portal in the user's default web browser. It is the fastest way to see what a portal looks like after creating or updating it. The skill determines the correct URL based on the deployment mode and whether a local dev server is running, then opens it using the platform's native command.

This is a lightweight skill -- it does not start a dev server, build the app, or modify anything. It just opens a URL. If the dev server is not running, it tells the user how to start it.

## Steps

### Step 1: Identify the target portal

If the user specified a slug (e.g., "preview whzan"), use that slug directly.

If no slug is provided, check how many portals exist:
- If there is exactly one portal, use that one and mention it: "Opening your only portal: <slug>"
- If there are multiple portals, ask: "Which portal do you want to preview? Run /portal list to see your portals."
- If there are zero portals, say: "No portals found. Create one first with /portal create."

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

**Option B: Docker deploy mode (check port 8080)**

If `DEPLOY_MODE` is `docker`, check if the container is running:

```bash
lsof -i :8080 -sTCP:LISTEN -t >/dev/null 2>&1 && echo "DOCKER_RUNNING=true" || echo "DOCKER_RUNNING=false"
```

If running, the URL is:
```
http://localhost:8080/client/<slug>
```

**Option C: NEXT_PUBLIC_APP_URL is set**

If the environment variable `NEXT_PUBLIC_APP_URL` is set (sourced from `.env` by the preamble), use it:
```
${NEXT_PUBLIC_APP_URL}/client/<slug>
```

This handles production/staging URLs, custom domains, and any other deployment target.

**Fallback: Nothing running**

If no server is detected and no app URL is configured, do not open the browser. Instead, inform the user:

"No running server detected. Start the dev server with /portal dev, or set NEXT_PUBLIC_APP_URL in your .env file."

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
"Login with the credentials from /portal credentials <slug>. Or generate a share link with /portal share <slug> to bypass login."

If the portal is the example portal (slug is "example"), no credentials are needed -- it is publicly accessible by design.

## URL Priority Order

To be explicit about resolution order:

1. **Dev server on port 3000** -- always preferred for local development, regardless of other settings.
2. **Docker on port 8080** -- used when deploy_mode is docker and the container is running.
3. **NEXT_PUBLIC_APP_URL** -- used for production or staging environments, or when no local server is detected.
4. **Fallback** -- no URL available, prompt the user to start a server.

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
- **Inactive portal**: If the portal is deactivated (`isActive: false`), the preview will show a "not found" page. Warn the user: "Portal '<slug>' is inactive. You'll see a not-found page. Reactivate it first or use /portal list to check status."

## Error Handling

- If the preamble fails, stop and display the error.
- If no server is running and no URL is configured, provide clear instructions rather than opening a dead URL.
- If the `open` or `xdg-open` command fails, print the URL as a fallback: "Could not open browser automatically. Visit: <url>"

## Login Context

When the portal opens in the browser, the client will see a login page (unless they have an active session or use a share link). Provide context about how to access the portal:

- **Has credentials**: Remind the user of the username (derived from the slug). Do not display the password -- they can get it from `/portal credentials <slug>` if they need it.
- **No credentials**: Warn that the portal will show a login page but there are no credentials to enter. Suggest running `/portal credentials <slug>` first.
- **Example portal**: The built-in example at `/client/example` is publicly accessible and does not require login. No credentials needed.

If the user is previewing to check content before sharing with a client, suggest: "To see exactly what the client will see, open an incognito/private window. Your existing session cookies may affect the view."

## Previewing After Changes

A common workflow is: edit portal content with `/portal update`, then preview to verify. If the dev server is running with Next.js hot reload, changes to the client component files will appear immediately without a page refresh. If the user is running a production build (docker mode), they may need to rebuild first.

If the user just ran `/portal update` and then `/portal preview`, mention: "If you don't see your changes, make sure the dev server is running (hot reload) or rebuild with /portal deploy for docker mode."

## Multiple Portals Preview

If the user asks to "preview all portals" or "open all my portals", open each one in a separate browser tab. However, limit to 5 tabs maximum to avoid browser overload. If there are more than 5 portals, open the 5 most recently updated and note: "Opened the 5 most recently updated portals. Use /portal preview <slug> for specific portals."

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

As a final step, log skill completion:

```bash
echo '{"skill":"portal-preview","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Related Skills

- `/portal dev` -- start the local development server
- `/portal share` -- generate a link that works for anyone, not just the local machine
- `/portal deploy` -- deploy to production so the portal is accessible externally
- `/portal credentials` -- get or rotate login credentials for the portal
