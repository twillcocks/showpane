---
name: portal-setup
description: |
  Interactive setup wizard for Showpane. Creates config, installs deps, runs migrations, and creates the organization.
  Trigger phrases: "portal setup", "configure showpane", "set up showpane", "initialize showpane". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../shared/bin/check-portal-guard.sh"
---

## Preamble (run first)

This skill's preamble is different from other skills — it does NOT require config.json to exist, because this skill creates it.

```bash
# --- Portal Setup Preamble ---
CONFIG="$HOME/.showpane/config.json"
EXISTING_CONFIG=false
if [ -f "$CONFIG" ]; then
  EXISTING_CONFIG=true
  APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null || true)
  DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode',''))" 2>/dev/null || true)
  ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null || true)
  echo "EXISTING_CONFIG: true"
  echo "APP_PATH: $APP_PATH"
  echo "DEPLOY_MODE: $DEPLOY_MODE"
  echo "ORG_SLUG: $ORG_SLUG"
else
  echo "EXISTING_CONFIG: false"
  echo "No config found. Starting fresh setup."
fi

SKILL_DIR="$(dirname "$APP_PATH")"
SKILL_VERSION=$(head -1 "$SKILL_DIR/skills/VERSION" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
echo "SHOWPANE: v$SKILL_VERSION | SETUP MODE"

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
echo '{"skill":"portal-setup","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
# --- End Preamble ---
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

### Step 1: Check for existing configuration

If the preamble output shows `EXISTING_CONFIG: true`, inform the user that Showpane is already configured and show the current settings. Ask if they want to reconfigure. If they say no, exit gracefully. If they say yes, continue with the setup — existing values become defaults the user can accept or change.

### Step 2: Detect or ask for app_path

Try to find the Showpane app automatically by checking these locations in order:

1. Current working directory — look for `package.json` containing `"name"` with "showpane" in it
2. Parent directory — check `../app/` for the same
3. Common locations: `~/git/showpane/app/`, `~/showpane/app/`
4. The `SHOWPANE_APP_PATH` environment variable

Run the detection:

```bash
for candidate in "$(pwd)" "$(pwd)/../app" "$HOME/git/showpane/app" "$HOME/showpane/app"; do
  if [ -f "$candidate/package.json" ] && [ -f "$candidate/prisma/schema.prisma" ]; then
    echo "FOUND: $(cd "$candidate" && pwd)"
    break
  fi
done
```

If found, confirm with the user: "Found Showpane app at /path/to/app. Use this? (Y/n)"

If not found, ask the user to provide the path. Validate that the path exists and contains both `package.json` and `prisma/schema.prisma`. If either file is missing, the path is not a valid Showpane app directory — explain which file is missing and ask again.

Resolve the path to an absolute path (no `~` or relative components) before storing it. Use `cd "$path" && pwd` to resolve.

Store the resolved absolute path as `APP_PATH`.

#### npx Mode

When `setup_source` is `"npx"` (set by the npx installer), the setup should:
- Skip the app_path detection (already known from the installer)
- Skip the deploy mode question (default to docker for local dev)
- Auto-detect SQLite from DATABASE_URL (if it starts with "file:" it's SQLite)
- Still ask for org name, contact details, and website URL
- Be more concise — the user just ran `npx showpane` and wants to get going fast

### Step 3: Ask for deploy mode

Present the options:

- **docker** — Self-hosted with Docker Compose. Best for VPS, dedicated servers, or local development.
- **vercel** — Deployed via Vercel. Pushes to git trigger automatic deploys.

Default to `docker` if the user doesn't have a preference. Store as `DEPLOY_MODE`.

### Step 4: Install dependencies

Check if `$APP_PATH/node_modules` exists. If not, run:

```bash
cd "$APP_PATH" && npm install
```

If node_modules exists but `.prisma` client is missing, run:

```bash
cd "$APP_PATH" && npx prisma generate
```

Wait for installation to complete before proceeding.

### Step 5: Run database migrations

Source the app's `.env` file to get `DATABASE_URL`:

```bash
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
```

Check if the database has existing tables. For a fresh database:

```bash
cd "$APP_PATH" && npx prisma migrate dev
```

For an existing database with pending migrations:

```bash
cd "$APP_PATH" && npx prisma migrate deploy
```

If `DATABASE_URL` is not set in `.env`, inform the user they need to configure it. Provide guidance:
- For local development: `postgresql://postgres:postgres@localhost:5432/showpane`
- For Docker: the docker-compose.yml should provide it
- For Vercel: set it in the Vercel dashboard environment variables

Do NOT proceed until migrations complete successfully.

### Step 6: Create or find Organization record

Ask the user for their organization details one at a time. Do not present all questions at once — guide them through the process conversationally.

1. **Organization name** (required) — e.g., "Acme Consulting". This is the name that appears in portal headers alongside the client name.
2. **Contact name** (required) — the person who appears on portal footers as the point of contact, e.g., "Jane Smith". This is typically the account manager or sales rep.
3. **Contact email** (required) — e.g., "jane@acme.com". Displayed in the portal footer as a mailto link.
4. **Contact title** (optional, default: "Account Manager") — e.g., "Director", "Partner", "Client Success Lead". Shown next to the contact name in the portal footer.
5. **Contact phone** (optional) — e.g., "+44 7700 900000". If provided, displayed alongside email in the portal footer.
6. **Company website URL** (optional) — e.g., "acme.com". Used to auto-fetch the company logo via Clearbit.
   - If provided, fetch logo URL: `https://logo.clearbit.com/{domain}` and store in `Organization.logoUrl`
   - Also store the URL in `Organization.websiteUrl`
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

If the user says "skip" or "default", use `#1a1a1a`. Brand color can always be changed later by running `/portal setup` again.

### Step 8: Telemetry opt-in

Ask the user about anonymous usage telemetry:

> "Help Showpane improve! Share anonymous usage data (which skills you use, how long they take). No code, file paths, or portal content is ever sent."

Options:
- **community** — anonymous usage stats with a stable device ID for deduplication
- **anonymous** — anonymous usage stats with no device ID
- **off** — no telemetry (default)

Store the choice in config.

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
  "deploy_mode": "<docker|vercel>",
  "orgSlug": "<org_slug>",
  "telemetry": "<community|anonymous|off>"
}
CONFIGEOF
chmod 600 "$HOME/.showpane/config.json"
```

Replace the placeholder values with the actual values collected. Use `chmod 600` so only the owner can read/write the config (it may contain sensitive paths).

### Step 10: Print success summary

Display a clear summary:

```
Showpane setup complete!

  App path:     /path/to/showpane/app
  Deploy mode:  docker
  Organization: Acme Consulting (acme-consulting)
  Brand color:  #2563eb
  Telemetry:    off

Next steps:
  1. Start the dev server:     /portal dev
  2. Create your first portal: /portal create <slug>
  3. View the example portal:  open http://localhost:3000/client/example
```

### Step 11: Record learning (optional)

If this is the first setup, create an initial learning entry:

```bash
mkdir -p "$HOME/.showpane"
echo '{"skill":"portal-setup","key":"initial-setup","insight":"Setup completed. Deploy mode: <mode>. Org: <name>.","confidence":10,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

## Error Handling

Each step can fail independently. Handle failures gracefully:

- **App path not found**: Ask the user to clone the Showpane repo first (`git clone https://github.com/showpane/showpane.git`)
- **npm install fails**: Check Node.js version (requires 18+), check internet connectivity, suggest clearing `node_modules` and retrying
- **Prisma migrate fails**: Check DATABASE_URL is correct and the database server is running. For local dev, suggest `docker compose up -d db` if a database service exists in docker-compose.yml
- **Organization creation fails**: Check database connectivity. If the Prisma client throws a connection error, verify DATABASE_URL in `.env`
- **Config write fails**: Check that `$HOME/.showpane/` is writable. On some systems, home directory permissions may block directory creation

Never silently continue past a failure. Each step depends on the previous step succeeding.

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-setup","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Conventions

- Never store DATABASE_URL or AUTH_SECRET in config.json — these live in the app's `.env` file
- Config file permissions must be 600 (owner read/write only)
- The orgSlug in config.json determines which Organization record is used by all other skills
- All user-facing output should be concise and scannable — use indented key-value pairs, not paragraphs
- If any step fails, provide a clear error message and suggest how to fix it, but do not silently continue
- The setup wizard is interactive — ask one question at a time, don't dump all questions at once
- When reconfiguring, show current values as defaults so the user can press enter to keep them
- The setup wizard should complete in under 5 minutes for a user with all prerequisites (Node.js, Postgres, the repo cloned)
