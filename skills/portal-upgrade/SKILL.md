---
name: portal-upgrade
description: |
  Self-update the Showpane skill pack to the latest version. Use when asked to "upgrade",
  "update showpane", "update skills", "get latest version", or "check for updates". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
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
echo '{"skill":"portal-upgrade","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

This skill updates the Showpane skill pack to the latest version from the remote repository. It checks the current version, fetches remote changes, shows what has changed, pulls the updates, and re-runs the setup script to apply any configuration changes. The skill pack lives in its own git repository, separate from the app, so updating skills does not affect the running portal application.

The upgrade is a git pull operation. Showpane skills are distributed as a git repository, and upgrading means pulling the latest commits from the `main` branch. This keeps things simple and transparent -- the user can see exactly what changed via standard git tooling.

## Steps

### Step 1: Check current version

Read the current skill pack version from the VERSION file:

```bash
cat $SKILL_DIR/VERSION
```

This was already captured by the preamble, but read it explicitly here so you have the full version string (e.g., "1.0.0 (requires app >= 0.1.0)").

Display the current version:

"Current version: 1.0.0"

### Step 2: Fetch remote changes

Navigate to the skill pack repository root (one level above the skills directory) and fetch from origin:

```bash
cd $SKILL_DIR/.. && git fetch origin main
```

This downloads the latest remote state without modifying the local working tree. If the fetch fails (network error, authentication issue), stop and report:

"Could not reach the remote repository. Check your network connection and git credentials."

If the repository is not a git repo (e.g., skills were installed via copy rather than clone), report:

"The skills directory is not a git repository. Re-install Showpane from the git repository to enable upgrades."

### Step 3: Compare local vs remote

Check how many commits are ahead on the remote:

```bash
cd $SKILL_DIR/.. && git rev-list --count HEAD..origin/main
```

This returns a number. If the count is 0, there are no updates available.

**If no updates:**

```
════════════════════════════════════════
  Showpane skills are up to date.
  Current version: 1.0.0
════════════════════════════════════════
```

Stop here. No further action needed.

**If updates are available, continue to Step 4.**

### Step 4: Show what changed

Display the commit log for pending changes so the user can see what is being updated:

```bash
cd $SKILL_DIR/.. && git log --oneline HEAD..origin/main
```

Format the output as a change summary:

```
Updates available: 3 new commits

  a1b2c3d  Add portal-analytics trend comparison
  d4e5f6g  Fix credential rotation version bump
  h7i8j9k  Update preamble with telemetry opt-in

```

This gives the user visibility into what is about to change. It builds trust -- the user can see exactly what they are pulling.

If there are many commits (10+), show the first 10 and note: "...and N more commits. Run `git log HEAD..origin/main` in the skills repo for the full list."

### Step 5: Pull the updates

Apply the changes:

```bash
cd $SKILL_DIR/.. && git pull origin main
```

If the pull encounters merge conflicts (unlikely for a read-only skill pack, but possible if the user has made local modifications), report the conflict and suggest:

"Merge conflict detected. You have local modifications to the skill pack. Options:
1. Resolve conflicts manually: `cd <skill_dir>/.. && git mergetool`
2. Discard local changes and take the remote version: `cd <skill_dir>/.. && git reset --hard origin/main`
3. Keep your local version and skip the update."

Do not automatically force-reset. The user may have intentional local customizations.

### Step 6: Re-run setup

After a successful pull, re-run the setup script to apply any configuration changes that came with the update:

```bash
cd $SKILL_DIR/.. && ./setup
```

The setup script handles:
- Installing new dependencies if the app's package.json changed
- Running Prisma migrations if the schema changed
- Updating the config file format if needed
- Setting file permissions

If the setup script does not exist or fails, note it but do not treat it as a fatal error: "Setup script not found or failed. The skill files are updated. You may need to run `npm install` and `npx prisma migrate deploy` manually if the update included dependency or schema changes."

### Step 7: Display the new version

Read the updated VERSION file:

```bash
cat $SKILL_DIR/VERSION
```

Display the upgrade confirmation:

```
════════════════════════════════════════
  Showpane upgraded!
  
  Previous: 1.0.0
  Current:  1.1.0
  
  3 commits applied
════════════════════════════════════════
```

If the version string includes a new app compatibility requirement (e.g., "1.1.0 (requires app >= 0.2.0)"), check whether the current app version meets the requirement. If not, warn:

"The updated skills require app version >= 0.2.0 but you have 0.1.0. Some skills may not work correctly. Update the app: `cd $APP_PATH && git pull origin main && npm install && npx prisma migrate deploy`"

## Version Compatibility

The VERSION file format is: `<skill_version> (requires app >= <min_app_version>)`

After upgrading, compare:
- Read the new minimum app version from `skills/VERSION`
- Read the current app version from `$APP_PATH/VERSION`
- If the app version is below the minimum, warn the user

This prevents a situation where upgraded skills call bin/ scripts that depend on app features not yet available in the user's installed app version.

## Conventions

- Always show the current version before checking for updates. This gives the user a reference point.
- Always show what changed before pulling. No silent updates.
- Use double-line box drawing (`═`) for the version display boxes.
- If the user runs upgrade frequently (check learnings), keep output minimal: just the version change and commit count.
- Do not auto-upgrade on other skill invocations. The upgrade is only triggered explicitly by this skill or by the update checker in the preamble (which only prints a notice, never auto-pulls).

## Edge Cases

- **Dirty working tree**: If the user has uncommitted changes in the skill pack repo, `git pull` may refuse. Detect this with `git status --porcelain` before pulling. If dirty, warn: "You have local changes in the skills directory. Commit or stash them before upgrading."
- **Detached HEAD**: If the repo is in detached HEAD state, the pull will fail. Detect and suggest: "The skills repo is in detached HEAD state. Run `git checkout main` first."
- **No remote configured**: If there is no `origin` remote, the fetch will fail. Suggest re-cloning from the Showpane repository.
- **Rate limiting**: GitHub may rate-limit unauthenticated git operations. If fetch fails with a rate limit error, suggest: "GitHub rate limit hit. Try again in a few minutes, or configure git credentials for higher limits."

## Error Handling

- If the preamble fails, stop and display the error.
- If `git fetch` fails, report the network/auth error and stop. Do not attempt to pull.
- If `git pull` fails due to conflicts, provide the three options listed above. Do not force-reset without user consent.
- If the setup script fails after a successful pull, note the failure but confirm that the skill files themselves are updated.

## Changelog Awareness

After pulling updates, check if a CHANGELOG.md exists in the repository root:

```bash
cat $SKILL_DIR/../CHANGELOG.md 2>/dev/null | head -50
```

If a changelog exists, extract the entries between the previous and current version and display them as a "What's new" section:

```
What's new in 1.1.0:
  - Portal analytics now shows trend comparisons
  - Fixed credential rotation not bumping version number
  - Preamble now includes telemetry opt-in status
```

If no changelog exists, the commit log from Step 4 serves as the change summary.

## Upgrade Frequency

There is no auto-upgrade mechanism. The user must explicitly run `/portal upgrade` to check for and apply updates. The preamble includes a lightweight version check that prints a notice if the local version is behind, but it never auto-pulls.

Suggested upgrade frequency: monthly, or when the user encounters an issue that may have been fixed upstream. The skill does not nag or remind.

## Learnings Preservation

Upgrading the skill pack does not affect the user's learnings file (`~/.showpane/learnings.jsonl`). Learnings are stored outside the git repository and persist across upgrades. Similarly, the config file (`~/.showpane/config.json`) and telemetry data (`~/.showpane/telemetry.jsonl`) are not touched by the upgrade.

If a new version introduces changes to the learnings format, the changelog or setup script should handle migration transparently.

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-upgrade","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Related Skills

- `/portal setup` -- re-run setup independently if the upgrade's setup step failed
- `/portal status` -- check that all portals are healthy after an upgrade
- `/portal dev` -- restart the dev server to pick up any app changes
