# Showpane Skill Preamble

Before executing any skill, run the following setup in a Bash tool call:

```bash
# --- Showpane Preamble ---

# 1. Read config (env vars override config.json)
SHOWPANE_CONFIG="${HOME}/.showpane/config.json"
if [ -f "$SHOWPANE_CONFIG" ]; then
  _cfg_app_path=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('app_path',''))" 2>/dev/null || true)
  _cfg_deploy_mode=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('deploy_mode',''))" 2>/dev/null || true)
  _cfg_org_slug=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null || true)
fi

export APP_PATH="${SHOWPANE_APP_PATH:-${_cfg_app_path:-}}"
export DEPLOY_MODE="${_cfg_deploy_mode:-local}"
export ORG_SLUG="${_cfg_org_slug:-}"

if [ -z "$APP_PATH" ]; then
  echo "ERROR: APP_PATH not set. Run: showpane-config set app_path /path/to/showpane-project" >&2
  exit 1
fi

# 2. Source app .env
if [ -f "$APP_PATH/.env" ]; then
  set -a && source "$APP_PATH/.env" && set +a
fi

# Allow DATABASE_URL env override
export DATABASE_URL="${DATABASE_URL:-}"

# 3. Verify app installed
if [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "ERROR: Prisma client not generated. Run: cd $APP_PATH && npm install && npx prisma generate" >&2
  exit 1
fi

# 4. Version check
SKILL_DIR="${SHOWPANE_TOOLCHAIN_DIR:-$HOME/.showpane/current}"
SKILL_VERSION=$(head -1 "$SKILL_DIR/skills/VERSION" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
APP_VERSION=$(head -1 "$APP_PATH/VERSION" 2>/dev/null || echo "unknown")
APP_REQUIRED=$(head -1 "$SKILL_DIR/skills/VERSION" 2>/dev/null | grep -oP '(?<=app >= )\S+' || echo "unknown")

if [ "$APP_VERSION" != "unknown" ] && [ "$APP_REQUIRED" != "unknown" ]; then
  if [ "$(printf '%s\n' "$APP_REQUIRED" "$APP_VERSION" | sort -V | head -1)" != "$APP_REQUIRED" ]; then
    echo "WARNING: App version $APP_VERSION may not meet skills requirement (>= $APP_REQUIRED)" >&2
  fi
fi

# 5. Load learnings count
LEARNINGS_FILE="${HOME}/.showpane/learnings.jsonl"
LEARNINGS_COUNT=0
if [ -f "$LEARNINGS_FILE" ]; then
  LEARNINGS_COUNT=$(wc -l < "$LEARNINGS_FILE" | tr -d ' ')
fi

# 5b. Predictive next-skill suggestion
if [ -f "$HOME/.showpane/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$HOME/.showpane/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//')
  [ -n "$_RECENT" ] && echo "RECENT_SKILLS: $_RECENT"
fi

# 5c. Search relevant learnings
LEARN_FILE="$HOME/.showpane/learnings.jsonl"
if [ -f "$LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries"
  if [ "$_LEARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "RECENT_LEARNINGS:"
    tail -5 "$LEARN_FILE" 2>/dev/null
  fi
fi

# 5d. Checkpoint: save/resume state
SHOWPANE_CHECKPOINTS="$HOME/.showpane/checkpoints"
mkdir -p "$SHOWPANE_CHECKPOINTS"

save_checkpoint() {
  local skill="$1" step="$2" data="$3"
  echo '{"skill":"'"$skill"'","step":"'"$step"'","data":'"$data"',"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$SHOWPANE_CHECKPOINTS/${skill}.json"
}

load_checkpoint() {
  local skill="$1"
  local cp="$SHOWPANE_CHECKPOINTS/${skill}.json"
  if [ -f "$cp" ]; then
    cat "$cp"
  fi
}

clear_checkpoint() {
  local skill="$1"
  rm -f "$SHOWPANE_CHECKPOINTS/${skill}.json"
}

# 6. Load telemetry setting
TELEMETRY=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('telemetry','off'))" 2>/dev/null || echo "off")

# 7. Print status
echo "SHOWPANE_VERSION: $SKILL_VERSION"
echo "DEPLOY_MODE: $DEPLOY_MODE"
echo "APP_PATH: $APP_PATH"
echo "LEARNINGS: $LEARNINGS_COUNT entries"

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

If `skills/shared/platform-constraints.md` exists, read it once near the start of the skill
and apply only the constraints relevant to the current request. Mention them only when the
user is about to do something unsupported or limited.

## Checkpoint/Resume

Skills can save progress with `save_checkpoint "skill-name" "step-name" '{"key":"value"}'`.
On restart, `load_checkpoint "skill-name"` returns the saved state.
After successful completion, `clear_checkpoint "skill-name"` cleans up.

If a checkpoint exists when a skill starts, offer to resume:
"Found a checkpoint from [timestamp]. Resume from step [step-name]?"

All bin/ scripts run via:
```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/script.ts" [args]
```
