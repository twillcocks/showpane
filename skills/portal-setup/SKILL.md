---
name: portal-setup
description: |
  Interactive setup wizard for Showpane. Creates config, installs deps, applies the local SQLite schema, and creates the organization.
  Trigger phrases: "portal setup", "configure showpane", "set up showpane", "initialize showpane". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../showpane-shared/bin/check-portal-guard.sh"
---

## Preamble (run first)

This skill's preamble is tolerant of first-run state because setup may create the config.

```bash
SHOWPANE_HOME="$HOME/.showpane"
SHOWPANE_BIN="$SHOWPANE_HOME/bin"
CONFIG="$SHOWPANE_HOME/config.json"
APP_PATH=""
DEPLOY_MODE="local"
ORG_SLUG=""
EXISTING_CONFIG=false

if [ -f "$CONFIG" ]; then
  EXISTING_CONFIG=true
  APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null || true)
  DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','local'))" 2>/dev/null || echo "local")
  ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null || true)
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
echo '{"skill":"portal-setup","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | SETUP MODE"
echo "EXISTING_CONFIG: $EXISTING_CONFIG"
echo "APP_PATH: ${APP_PATH:-missing}"
echo "DEPLOY_MODE: $DEPLOY_MODE"
echo "ORG_SLUG: ${ORG_SLUG:-missing}"
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

### Step 1: Check for existing configuration

If the preamble output shows `EXISTING_CONFIG: true`, inform the user that Showpane is already configured and show the current settings. Ask if they want to reconfigure. If they say no, exit gracefully. If they say yes, continue with the setup — existing values become defaults the user can accept or change.

### Step 2: Detect or ask for app_path

Try to find the Showpane app automatically by checking these locations in order:

1. Current working directory — look for `package.json` containing `"name"` with "showpane" in it
2. Parent directory — check `../app/` for the same
3. Common locations: `~/git/showpane/`, `~/showpane/`
4. The `SHOWPANE_APP_PATH` environment variable

Run the detection:

```bash
for candidate in "$(pwd)" "$(pwd)/../app" "$HOME/git/showpane/app" "$HOME/showpane/app"; do
  if [ -f "$candidate/package.json" ] && { [ -f "$candidate/prisma/schema.local.prisma" ] || [ -f "$candidate/prisma.config.ts" ]; }; then
    echo "FOUND: $(cd "$candidate" && pwd)"
    break
  fi
done
```

If found, confirm with the user: "Found Showpane app at /path/to/app. Use this? (Y/n)"

If not found, ask the user to provide the path. Validate that the path exists and contains `package.json` plus either `prisma/schema.local.prisma` or `prisma.config.ts`. If those markers are missing, the path is not a valid Showpane app directory — explain which file is missing and ask again.

Resolve the path to an absolute path (no `~` or relative components) before storing it. Use `cd "$path" && pwd` to resolve.

Store the resolved absolute path as `APP_PATH`.

#### Packaged Installer Mode

When the user is inside a freshly generated Showpane project, the setup should:
- Prefer the current working directory as `APP_PATH`
- Skip any suggestion to clone the upstream Showpane repository
- Auto-detect SQLite from DATABASE_URL (if it starts with "file:" it's SQLite)
- Reuse the existing workspace org name if it is already obvious, then ask for the next missing contact detail one at a time
- Be concise — the user just ran `npx showpane` and wants to get going fast

### Step 3: Set the workspace mode

Use `local` as the setup mode.

Store `DEPLOY_MODE=local` in the config written later in this flow.

### Step 4: Install dependencies

Check if `$APP_PATH/node_modules` exists. If not, run:

```bash
cd "$APP_PATH" && npm install
```

If node_modules exists but `.prisma` client is missing, run:

```bash
cd "$APP_PATH" && npm run prisma:generate
```

Wait for installation to complete before proceeding.

### Step 5: Apply the local database schema

Source the app's `.env` file to get `DATABASE_URL`:

```bash
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
```

The supported setup path is SQLite. Apply the local schema:

```bash
cd "$APP_PATH" && npm run prisma:db-push
```

If `DATABASE_URL` is not set in `.env`, inform the user they need to configure it. Provide guidance:
- For local development: `file:./dev.db`

If `DATABASE_URL` is set to anything other than a `file:` URL, explain that the supported setup flow is SQLite-first and suggest resetting `.env` back to `file:./dev.db`.

Do NOT proceed until the local schema is applied successfully.

### Step 6: Create or find Organization record

Ask the user for their organization details one at a time. Do not present all questions at once — guide them through the process conversationally.

Before asking anything, check the local database. If there is already exactly one organization and it clearly matches the workspace the user just created, keep it as the default and do not ask for the organization name again unless the user wants to change it.

If the org already exists with a real name, ask only for the next missing field.
Do not restart the whole org questionnaire from the top.

1. **Organization name** (required only if not already known) — e.g., "Acme Consulting". This is the name that appears in portal headers alongside the client name.
2. **Contact name** (required) — the person who appears on portal footers as the point of contact, e.g., "Jane Smith". This is typically the account manager or sales rep.
3. **Contact email** (required) — e.g., "jane@acme.com". Displayed in the portal footer as a mailto link.
4. **Contact title** (optional, default: "Account Manager") — e.g., "Director", "Partner", "Client Success Lead". Shown next to the contact name in the portal footer.
5. **Contact phone** (optional) — e.g., "+44 7700 900000". If provided, displayed alongside email in the portal footer.
6. **Company website URL** — e.g., "acme.com". Ask for it plainly instead of framing it as optional. Store the normalized value in `Organization.websiteUrl` so runtime branding can derive the company logo.
   - Do not generate and persist a provider logo URL in `Organization.logoUrl` from this field
   - Only set `Organization.logoUrl` if the user explicitly gives you a direct logo asset URL they want pinned
7. **Contact avatar**: Auto-populated from the contact email via Gravatar. No need to ask — just use `getAvatarUrl(email, contactName)` from `app/src/lib/branding.ts` and store in `Organization.contactAvatar`

Generate an org slug from the organization name: lowercase, replace spaces with hyphens, strip non-alphanumeric characters except hyphens, remove consecutive hyphens. For example, "Acme Consulting Ltd." becomes `acme-consulting-ltd`. Confirm the generated slug with the user and allow them to override it.

Create the organization record in the database using the app's Prisma client. The Organization model stores:
- `name`, `slug`, `contactName`, `contactEmail`, `contactTitle`, `contactPhone`

If an Organization with that slug already exists in the database, present two options:
1. Use the existing organization (show its current details so the user can verify)
2. Create a new organization with a different slug

If the user chooses to use the existing org, skip creation and proceed with that org's slug. This is common when reconfiguring or when multiple people set up the same Showpane instance.

### Step 7: Theme configuration

Ask the user for their primary brand color as a hex value. This color is used for active tab indicators, bullet point accents, and interactive elements throughout the portal. Provide suggestions:

- Default: `#1a1a1a` (near-black, professional — works well for most brands)
- Common choices: `#2563eb` (blue), `#059669` (green), `#dc2626` (red), `#7c3aed` (purple)
- Tip: if the user has a brand guidelines document or website, suggest pulling the primary color from there

Validate the input is a valid hex color:
- Accept with or without `#` prefix (add `#` if missing)
- Accept 3-digit shorthand (`#abc` expands to `#aabbcc`)
- Accept 6-digit full form (`#2563eb`)
- Reject anything else with a clear message: "Please enter a valid hex color like #2563eb"

Update the Organization record with `primaryColor` set to the validated hex value. The portal app reads this value and applies it via CSS custom properties (the `--primary` variable in the Tailwind theme).

If the user says "skip" or "default", use `#1a1a1a`. Brand color can always be changed later by running `/portal-setup` again.

### Step 8: Telemetry reminder

Do not re-run the global telemetry interview here.

If the shared runtime preamble already set telemetry, keep that value. If it has
not been set yet for some reason, default to:

- **anonymous** — local analytics plus anonymous remote sync, no stable device ID
- **off** — local analytics only, no remote sync

If you must set it manually, write the chosen value into config.

### Step 9: Save configuration

Create the `~/.showpane/` directory if it doesn't exist:

```bash
mkdir -p "$HOME/.showpane"
```

Write the config file:

```bash
cat > "$HOME/.showpane/config.json" << 'CONFIGEOF'
{
  "app_path": "<resolved_absolute_path>",
  "deploy_mode": "local",
  "orgSlug": "<org_slug>",
  "telemetry": "<anonymous|off>"
}
CONFIGEOF
chmod 600 "$HOME/.showpane/config.json"
```

Replace the placeholder values with the actual values collected. Use `chmod 600` so only the owner can read/write the config (it may contain sensitive paths).

### Step 10: Print success summary

Display a short success handoff:

```
Showpane setup complete!

  App:  /path/to/showpane-project
  Org:  Acme Consulting (acme-consulting)

Next:
  /portal-onboard
  /portal-create <slug>
```

### Step 11: Record learning (optional)

If this is the first setup, create an initial learning entry:

```bash
mkdir -p "$HOME/.showpane"
echo '{"skill":"portal-setup","key":"initial-setup","insight":"Setup completed. Deploy mode: <mode>. Org: <name>.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

## Error Handling

Each step can fail independently. Handle failures gracefully:

- **App path not found**: Ask the user to run `npx showpane` first or point setup at an existing generated Showpane project
- **npm install fails**: Check Node.js version (requires 18+), check internet connectivity, suggest clearing `node_modules` and retrying
- **Prisma db push fails**: Check that DATABASE_URL is set to `file:./dev.db` (or another valid SQLite `file:` URL) in `.env`
- **Organization creation fails**: Check database connectivity. If the Prisma client throws a connection error, verify DATABASE_URL in `.env`
- **Config write fails**: Check that `$HOME/.showpane/` is writable. On some systems, home directory permissions may block directory creation

Never silently continue past a failure. Each step depends on the previous step succeeding.

## Completion

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-setup","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-setup" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
