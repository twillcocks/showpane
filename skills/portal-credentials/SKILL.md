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
echo '{"skill":"portal-credentials","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

### Step 1: Identify the portal

If the user provided a slug (e.g., `/portal credentials acme-health`), use it. Otherwise, list available portals to help the user choose:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/list-portals.ts" --org-id <org_id>
```

Present the list and ask which portal needs credentials. If there is only one portal, confirm it rather than asking.

Verify the portal exists by checking the database. The `create-portal.ts` script should have been run during `/portal create` to register the portal. If no DB record exists, inform the user:

> "No portal record found for '<slug>'. Run `/portal create <slug>` first to register it."

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

- `portal_not_found` — The portal slug doesn't exist in the database for this org. Suggest running `/portal create <slug>` first.
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

> **Save these credentials now.** They will not be shown again. The password is hashed in the database and cannot be retrieved. If lost, run `/portal credentials <slug>` again to rotate to a new password.

If this was a rotation (`"rotated": true`), add:

> **Credential rotation complete.** All existing sessions for this portal have been invalidated immediately. Anyone currently logged in will need to re-authenticate with the new password.

### Step 6: Suggest sharing method

Provide guidance on how to share the credentials with the client:

> **How to share with your client:**
> - Send the username and password via a secure channel (encrypted email, Signal, etc.)
> - The login page is at `/client` — the client enters the portal slug as the "company" field, then the username and password
> - For a direct link without credentials, use `/portal share <slug>` to generate a reusable share URL that bypasses the login entirely

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
  2. Generate a share link: /portal share <slug>
  3. Deploy if not already live: /portal deploy
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

- **Script not found**: If `$SKILL_DIR/bin/rotate-credentials.ts` does not exist, the skill pack may not be fully installed. Suggest running `/portal upgrade` or checking the Showpane installation.
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

As a final step, log skill completion:

```bash
echo '{"skill":"portal-credentials","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Conventions

- Always run the bin script rather than manipulating the database directly — never generate passwords, hash them, or write to the database from the skill
- Show credentials in an ASCII box for clear visibility in the terminal
- Warn about credential impermanence immediately after displaying them
- If the portal has no DB record, direct the user to `/portal create` first
- Never store, log, or record the plaintext password anywhere — not in learnings, not in telemetry, not in config
- Confirm before rotating existing credentials (default to "no") since rotation invalidates sessions
- The username is always the same as the portal slug — this is by design for simplicity
- If the user asks "what is the password for X portal", explain that passwords are one-way hashed and cannot be retrieved — offer to rotate to a new one instead
- After creating credentials, always suggest the next step: either share with the client or deploy if not already live
- If the app is not deployed yet, credentials still work — they are stored in the database regardless of whether the app is running in production
