---
name: portal-credentials
description: |
  Create or rotate login credentials for a client portal. Generates username and password, hashes and stores in DB.
  Trigger phrases: "portal credentials", "create login", "rotate password", "reset credentials", "portal password". (showpane)
allowed-tools: [Bash, Read, Write, Edit]
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../showpane-shared/bin/check-portal-guard.sh"
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../showpane-shared/bin/check-portal-guard.sh"
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
echo '{"skill":"portal-credentials","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
if [ "portal-credentials" = "portal-deploy" ]; then
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

## Steps

### Step 1: Identify the portal

If the user provided a slug (e.g., `/portal-credentials acme-health`), use it. Otherwise, list available portals to help the user choose:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/list-portals.ts" --org-id <org_id>
```

Present the list and ask which portal needs credentials. If there is only one portal, confirm it rather than asking.

Verify the portal exists by checking the database. The `create-portal.ts` script should have been run during `/portal-create` to register the portal. If no DB record exists, inform the user:

> "No portal record found for '<slug>'. Run `/portal-create <slug>` first to register it."

Also check the portal's current credential status from the list output. If credentials already exist, inform the user before proceeding:

> "Portal '<slug>' already has credentials (username: <username>). Running this will rotate to a new password and invalidate all existing sessions. Continue? (y/N)"

This confirmation is important because credential rotation has an immediate impact on any clients currently logged in. Default to "no" to prevent accidental rotation.

### Step 2: Run the rotate-credentials script

This script handles both initial credential creation and rotation:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/rotate-credentials.ts" --slug <slug> --org-id <org_id>
```

The script returns JSON on stdout:

**For initial creation:**
```json
{"ok": true, "username": "acme-health", "password": "xK9mP2vL8nQr", "rotated": false}
```

**For rotation (credentials already existed):**
```json
{"ok": true, "username": "acme-health", "password": "bT4wN7jF3hYs", "rotated": true}
```

**On error:**
```json
{"error": "portal_not_found", "message": "No portal with slug 'acme-health' in org 'demo'"}
```

### Step 3: Handle script errors

If the script returns an error, handle it based on the error type:

- `portal_not_found` — The portal slug doesn't exist in the database for this org. Suggest running `/portal-create <slug>` first.
- `database_error` — Connection or query failure. Check DATABASE_URL and re-apply the local schema with `cd $APP_PATH && npm run prisma:db-push`.
- `auth_secret_missing` — The AUTH_SECRET environment variable is not set in `$APP_PATH/.env`. The rotate-credentials script needs this to function. Suggest adding `AUTH_SECRET=<random-string>` to the .env file.

If the script exits with a non-zero code but produces no JSON output, check stderr for Prisma or Node.js errors and relay them to the user.

### Step 4: Display credentials

Present the credentials clearly and prominently. Use an ASCII box for visibility:

```
┌─────────────────────────────────────────┐
│  Portal credentials for: acme-health    │
│                                         │
│  Username:  acme-health                 │
│  Password:  xK9mP2vL8nQr               │
│                                         │
│  Login URL: /client                     │
└─────────────────────────────────────────┘
```

The ASCII box ensures the credentials stand out clearly in terminal output. Do not use markdown formatting (bold, code blocks) as these may not render in all terminal environments.

### Step 5: Security warning

Immediately after displaying credentials, show this warning:

> **Save these credentials now.** They will not be shown again. The password is hashed in the database and cannot be retrieved. If lost, run `/portal-credentials <slug>` again to rotate to a new password.

If this was a rotation (`"rotated": true`), add:

> **Credential rotation complete.** All existing sessions for this portal have been invalidated immediately. Anyone currently logged in will need to re-authenticate with the new password.

### Step 6: Suggest sharing method

Provide guidance on how to share the credentials with the client:

> **How to share with your client:**
> - Send the username and password via a secure channel (encrypted email, Signal, etc.)
> - The login page is at `/client` — the client enters the portal slug as the "company" field, then the username and password
> - For external access, publish the portal first with `/portal-deploy`
> - After publish, you can use `/portal-share <slug>` if you want a direct hosted link instead of asking the client to log in

Recommend against sharing credentials via:
- Unencrypted email (can be intercepted)
- Slack or Teams messages (persistent and searchable by admins)
- Shared documents or spreadsheets

Good sharing channels:
- Signal or WhatsApp (encrypted, ephemeral)
- A phone call (verbal)
- An encrypted email service
- A password manager's secure sharing feature

### Step 7: Verify login works (if dev server running)

If the dev server is running, suggest testing the credentials:

```bash
lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null
```

If running, inform the user:

> "Test the login at http://localhost:3000/client — enter slug '<slug>', username '<username>', and the password shown above."

This step is optional but helps catch configuration issues (like AUTH_SECRET not being set) before sharing credentials with a client.

### Step 8: Summary

Print a brief summary:

```
Credentials created for: acme-health
  Action:   new credentials (or: rotated — old sessions invalidated)
  Username: acme-health
  Login:    /client

Next steps:
  1. Send credentials to the client via a secure channel
  2. Deploy if not already live: /portal-deploy
  3. Optional hosted direct link after publish: /portal-share <slug>
```

### Step 9: Record credential event

Record that credentials were created or rotated (but NEVER record the actual credentials):

```bash
echo '{"skill":"portal-credentials","key":"credentials-created","insight":"Created credentials for <slug>. Rotated: <true|false>.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

## Security Conventions

- **Credentials are shown exactly once.** Never log them, never write them to a file, never include them in learnings or telemetry.
- **Rotation is immediate.** When credentials are rotated, the `credentialVersion` is bumped in the database. All existing session tokens for that portal are invalidated instantly because they reference the old version.
- **Passwords are generated server-side** by the `rotate-credentials.ts` script using cryptographically secure random bytes. Do not generate passwords in the skill — always use the script.
- **Usernames are derived from the slug.** The username is typically the same as the portal slug (e.g., slug `acme-health` gets username `acme-health`).
- **No password in config or learnings.** The `~/.showpane/config.json` and `~/.showpane/learnings.jsonl` files must never contain passwords or password hashes.
- **AUTH_SECRET stays in .env.** The secret used for token signing lives in `$APP_PATH/.env` and is read at runtime by the app. It is never copied to config.json.

## Error Handling

- **Script not found**: If `$SKILL_DIR/bin/rotate-credentials.ts` does not exist, the skill pack may not be fully installed. Suggest running `/portal-upgrade` or checking the Showpane installation.
- **Prisma connection error**: DATABASE_URL may be wrong or the database may be down. Check the .env file and database status.
- **Permission denied on .env**: The preamble sources `$APP_PATH/.env`. If this file is not readable, the DATABASE_URL will not be set. Check file permissions.
- **Script timeout**: If the script takes more than 30 seconds, something is wrong. The most common cause is a database connection timeout — check network connectivity to the database host.

## Bulk credential creation

If the user asks to create credentials for multiple portals at once, run the rotate-credentials script for each portal sequentially. Display all credential sets together in a single output block:

```
┌─────────────────────────────────────────┐
│  1. acme-health                         │
│     Username: acme-health               │
│     Password: xK9mP2vL8nQr             │
│                                         │
│  2. beta-corp                           │
│     Username: beta-corp                 │
│     Password: mT7kR4wQ9nFs             │
└─────────────────────────────────────────┘
```

Even in bulk mode, show the security warning once after all credentials are displayed.

## Completion

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-credentials","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-credentials" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
