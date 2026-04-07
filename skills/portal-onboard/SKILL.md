---
name: portal-onboard
description: |
  Guided first-run experience that chains setup, create, credentials, and preview.
  Use when asked to "get started", "onboard", "first time setup", "walk me through",
  or "set up showpane from scratch". (showpane)
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
ORG_SLUG=$(cat "$CONFIG" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('org_slug',''))" 2>/dev/null)
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

## Overview

This skill is the guided first-run experience for Showpane. It chains four other skills together in sequence -- setup, create, credentials, and preview -- walking the user through each step with clear transitions. The goal is to go from zero to a working portal in the browser in under 5 minutes.

This is specifically designed for users who have just installed Showpane and want to see it working end-to-end. It is opinionated about the order of operations and provides more context and encouragement than the individual skills would on their own.

The onboard flow is linear. Each step depends on the previous one completing successfully. If any step fails, the flow stops and provides recovery instructions rather than skipping ahead.

## Steps

### Step 1: Welcome message

Start with a welcome that sets expectations:

"Welcome to Showpane! Let's set up your first client portal. This will take about 5 minutes and we'll go through four steps:

1. Configure Showpane (app path, database, organization)
2. Create your first portal
3. Set up login credentials
4. Open it in your browser

Let's get started."

This framing is important. It tells the user what to expect and roughly how long it will take. Uncertainty causes drop-off.

### Step 2: Run the setup flow

Read the instructions from `skills/portal-setup/SKILL.md` and execute the setup flow inline. This means you follow the setup skill's instructions as if the user had run `/portal setup` directly.

The setup flow will:
- Detect the app path (or ask the user)
- Verify the database connection
- Create or select an organization
- Write the config to `~/.showpane/config.json`
- Set file permissions

**Important**: If setup detects that Showpane is already configured (config file exists, database is connected, org exists), acknowledge it and skip to the next step: "Showpane is already configured. Skipping setup."

If setup fails at any point (database not reachable, app not found), stop the onboard flow and provide clear instructions: "Setup needs to be completed before we can continue. Fix the issue above and run /portal onboard again."

After successful setup, transition:

"Setup complete! Your Showpane instance is configured. Let's create your first portal."

### Step 3: Run the create flow

Read the instructions from `skills/portal-create/SKILL.md` and execute the create flow inline. This creates the portal page files and database record.

During onboarding, provide a bit more guidance than the standalone create skill would:

- Suggest a slug if the user is unsure: "Pick a short name for the portal URL, like your client's company name in lowercase. For example: 'acme' or 'whzan'."
- If the user has Granola MCP connected, offer to pull a recent meeting as the source material. If not, prompt for a brief description of the client and what the portal should contain.
- Use the sales-followup template as the default suggestion for first-time users: "We'll use the sales follow-up template as a starting point. You can customize everything after."

After successful creation, transition:

"Great! Portal '<slug>' created for <company>. Now let's set up credentials so your client can log in."

If creation fails (e.g., slug already taken), help the user pick a different slug and retry. Do not abort the entire onboard flow for a recoverable error.

### Step 4: Run the credentials flow

Read the instructions from `skills/portal-credentials/SKILL.md` and execute the credentials flow inline. This creates a username and password for the portal.

During onboarding, the credentials flow is straightforward -- generate initial credentials. There is no rotation to handle on first run.

After credentials are generated, display them clearly:

"Credentials created. Save these -- they are shown once:

  Username: <username>
  Password: <password>

You'll share these with your client (or use /portal share to generate a link instead)."

Transition to the final step:

"Almost done! Let's open your portal in the browser."

### Step 5: Run the preview flow

Read the instructions from `skills/portal-preview/SKILL.md` and execute the preview flow inline. This opens the portal in the user's default browser.

During onboarding, add a note about what the user will see:

"Opening your portal now. You'll see a login page. Use the credentials above to log in, or just review the page to make sure everything looks right."

If no dev server is running, start one: "The dev server isn't running. Let me start it for you." Then run the dev server startup (from `/portal dev` instructions) and wait for it to be ready before opening the browser.

After the browser opens, transition to the final summary.

### Step 6: Final summary

Display the completion summary in an ASCII box:

```
════════════════════════════════════════
  Showpane is ready!
  
  Portal: <slug> (<company>)
  URL: http://localhost:3000/client/<slug>
  Username: <username>
  
  Next: /portal deploy to go live
  Help: /portal list, /portal status
════════════════════════════════════════
```

Note: Do NOT include the password in the final summary. It was shown once during Step 4. The summary is a reference card the user might screenshot or scroll back to, so it should not contain the password.

After the summary, provide a brief "what's next" orientation:

"Your portal is live locally. Here's what you can do next:

- `/portal deploy` -- push to production so your client can access it
- `/portal share <slug>` -- generate a share link (no login needed)
- `/portal update <slug>` -- edit the portal content
- `/portal analytics <slug>` -- track client engagement
- `/portal status` -- see a dashboard of all your portals"

## Flow Control

This skill is a sequential orchestrator. Each step depends on the previous one:

```
setup -> create -> credentials -> preview -> summary
```

Rules:
- **Never skip a step.** Even if the user says "I already have credentials", verify by checking the database. If credentials exist, acknowledge and move on. But do not skip the check.
- **Stop on hard failures.** If setup cannot connect to the database, or create fails due to a missing dependency, stop and explain. Do not try to continue with a broken foundation.
- **Retry on soft failures.** If the user picks a slug that is taken, help them pick another. If the dev server takes a moment to start, wait. These are not reasons to abort.
- **Respect existing state.** If the user already has a configured Showpane, an existing portal, and credentials, acknowledge each one and skip to the next incomplete step. The onboard flow should work for both brand-new and partially-set-up installations.

## Detecting Existing State

Before each step, check whether it has already been completed:

1. **Setup**: Check if `~/.showpane/config.json` exists and is valid. If yes, skip setup.
2. **Create**: Check if the org has at least one portal (via `list-portals.ts`). If yes, ask: "You already have portals. Want to create another, or skip to credentials?"
3. **Credentials**: Check if the selected portal has credentials (from list response `hasCredentials` field). If yes, skip credentials.
4. **Preview**: Always run. Opening the browser is always useful.

## Conventions

- Use encouraging but not patronizing language. "Great!" and "Let's move on" are fine. "Wow, amazing job!" is too much.
- Keep transitions between steps to one sentence. Do not recap what just happened -- the user can see it.
- Use double-line box drawing (`═`) for the final summary box only. Keep step transitions as plain text.
- If the total onboard time exceeds 10 minutes (e.g., due to long create flow with Granola), do not comment on it. The user is working, not racing.
- If learnings exist from a previous session, load them silently. The onboard flow benefits from prior context without mentioning it.

## Error Handling

- If the preamble itself fails (no config), this is expected for first-run. In this specific case, do NOT abort. Instead, proceed directly to the setup step: "Looks like Showpane isn't configured yet. Let's fix that."
- If any bin/ script returns a non-zero exit, read the error from stderr, display it, and suggest a fix.
- If the user wants to bail out mid-flow, respect it: "No problem. You can pick up where you left off by running the individual skills: /portal setup, /portal create, /portal credentials, /portal preview."

## Special Case: Preamble Failure

Unlike other skills, `/portal onboard` should NOT hard-fail if the preamble reports "Showpane not configured." The entire point of this skill is to handle first-run. If the config file does not exist, catch the preamble error and proceed to Step 2 (setup) which will create the config.

To handle this: Run the preamble, capture the output. If it includes "not configured", note that setup is needed and continue. Do not exit.

## Related Skills

This skill chains the following skills inline (read their SKILL.md files for detailed instructions):
- `/portal setup` -- Step 2
- `/portal create` -- Step 3
- `/portal credentials` -- Step 4
- `/portal preview` -- Step 5
- `/portal dev` -- called within Step 5 if needed
- `/portal deploy` -- suggested as next step in the summary
