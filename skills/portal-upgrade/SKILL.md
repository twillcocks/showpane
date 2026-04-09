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
DEPLOY_MODE=$(cat "$CONFIG" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('deploy_mode','local'))" 2>/dev/null)
ORG_SLUG=$(cat "$CONFIG" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null)
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

This skill updates both the global Showpane toolchain and the current project using the packaged Showpane CLI. The upgrade is versioned -- it does not depend on the user's project being a git clone of the upstream Showpane repository.

The flow is:
1. Check the current installed Showpane/toolchain version
2. Check the latest published CLI version on npm
3. Run a dry-run project upgrade to detect conflicts
4. Sync the matching global toolchain
5. Apply the project upgrade

## Steps

### Step 1: Check current version

Read the current skill pack version from the VERSION file:

```bash
cat $SKILL_DIR/VERSION
```

This was already captured by the preamble, but read it explicitly here so you have the full version string (e.g., "1.0.0 (requires app >= 0.1.0)").

Display the current version:

"Current version: 1.0.0"

### Step 2: Check the latest published Showpane version

Run:

```bash
npm view showpane version
```

If the command fails, report:

"Could not reach the npm registry. Check your network connection and try again."

If the returned version matches the current Showpane version, inform the user that no published upgrade is available and stop.

### Step 3: Dry-run the project upgrade

Run a dry-run against the user's project before changing anything:

```bash
npx showpane@latest upgrade --project "$APP_PATH" --dry-run
```

If the dry-run reports conflicts, stop and show the conflicted managed files. Explain:

"Showpane found local edits in framework-managed files. Review or revert those files before running the upgrade."

### Step 4: Sync the latest toolchain

Install the matching global Showpane toolchain and Claude Code skill links:

```bash
npx showpane@latest sync
```

If sync fails, stop and report the error. Do not continue to the project upgrade.

### Step 5: Apply the project upgrade

Run:

```bash
npx showpane@latest upgrade --project "$APP_PATH"
```

This applies packaged scaffold updates to managed files only. It does not rely on upstream git history.

### Step 6: Display the resulting version

Read the project version file:

```bash
cat "$APP_PATH/VERSION"
```

Display a short confirmation:

```
════════════════════════════════════════
  Showpane upgraded!

  Toolchain: latest published version
  App:       <APP_PATH/VERSION>
════════════════════════════════════════
```

## Version Compatibility

The VERSION file format remains: `<skill_version> (requires app >= <min_app_version>)`

After syncing the toolchain, compare:
- Read the new minimum app version from `"$SKILL_DIR/skills/VERSION"`
- Read the current app version from `"$APP_PATH/VERSION"`
- If the app version is below the minimum, warn the user

## Conventions

- Always show the current version before checking for updates. This gives the user a reference point.
- Always run the dry-run first. No silent updates.
- Use double-line box drawing (`═`) for the version display boxes.
- If the user runs upgrade frequently (check learnings), keep output minimal: just the version change and commit count.
- Do not auto-upgrade on other skill invocations. The upgrade is only triggered explicitly by this skill.

## Edge Cases

- **Dry-run conflicts**: Stop and surface the file list. Do not attempt a force-upgrade.
- **Registry/network failure**: If `npm view` or `npx showpane@latest ...` fails due to connectivity, report it and stop.
- **Toolchain sync fails**: Do not continue to the project upgrade.

## Error Handling

- If the preamble fails, stop and display the error.
- If the dry-run fails, report the error and stop.
- If the real upgrade fails after the dry-run succeeded, show the CLI error output and stop.
- Do not attempt to recover with git commands.

## Changelog Awareness

After a successful upgrade, check if a CHANGELOG.md exists in the project root:

```bash
cat "$APP_PATH/CHANGELOG.md" 2>/dev/null | head -50
```

If a changelog exists, extract the entries between the previous and current version and display them as a "What's new" section:

```
What's new in 1.1.0:
  - Portal analytics now shows trend comparisons
  - Fixed credential rotation not bumping version number
  - Preamble now includes telemetry opt-in status
```

If no changelog exists, the CLI dry-run summary serves as the change summary.

## Upgrade Frequency

There is no auto-upgrade mechanism. The user must explicitly run `/portal upgrade` to check for and apply updates.

Suggested upgrade frequency: monthly, or when the user encounters an issue that may have been fixed upstream. The skill does not nag or remind.

## Learnings Preservation

Upgrading does not affect the user's learnings file (`~/.showpane/learnings.jsonl`). Learnings are stored outside the project and persist across upgrades. Similarly, the config file (`~/.showpane/config.json`) and telemetry data (`~/.showpane/telemetry.jsonl`) are not touched by the upgrade.

If a new version introduces changes to the learnings format, the changelog or setup script should handle migration transparently.

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-upgrade","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Related Skills

- `/portal setup` -- re-run setup independently if the upgraded project needs reconfiguration
- `/portal status` -- check that all portals are healthy after an upgrade
- `/portal dev` -- restart the dev server to pick up any app changes
