# Showpane Skill Preamble

Before executing any skill, run the following setup in a Bash tool call:

```bash
# --- Showpane Preamble ---

# 1. Read config (env vars override config.json)
SHOWPANE_CONFIG="${HOME}/.showpane/config.json"
if [ -f "$SHOWPANE_CONFIG" ]; then
  _cfg_app_path=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('app_path',''))" 2>/dev/null || true)
  _cfg_deploy_mode=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('deploy_mode',''))" 2>/dev/null || true)
  _cfg_org_slug=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('org_slug',''))" 2>/dev/null || true)
fi

export APP_PATH="${SHOWPANE_APP_PATH:-${_cfg_app_path:-}}"
export DEPLOY_MODE="${_cfg_deploy_mode:-local}"
export ORG_SLUG="${_cfg_org_slug:-}"

if [ -z "$APP_PATH" ]; then
  echo "ERROR: APP_PATH not set. Run: showpane-config set app_path /path/to/showpane/app" >&2
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
SKILL_DIR="$(dirname "$APP_PATH")"
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

# 6. Load telemetry setting
TELEMETRY=$(python3 -c "import json; d=json.load(open('$SHOWPANE_CONFIG')); print(d.get('telemetry','off'))" 2>/dev/null || echo "off")

# 7. Print status
echo "SHOWPANE_VERSION: $SKILL_VERSION"
echo "DEPLOY_MODE: $DEPLOY_MODE"
echo "APP_PATH: $APP_PATH"
echo "LEARNINGS: $LEARNINGS_COUNT entries"

# --- End Preamble ---
```

All bin/ scripts run via:
```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$SKILL_DIR/bin/tsconfig.json" "$SKILL_DIR/bin/script.ts" [args]
```
