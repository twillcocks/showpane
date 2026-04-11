import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..", "..");
export const SKILLS_ROOT = path.join(REPO_ROOT, "skills");

const PREAMBLE_PLACEHOLDER = "{{PREAMBLE}}";
const COMPLETION_PLACEHOLDER = "{{COMPLETION}}";

const NEXT_SKILL_SUGGESTIONS = [
  "- After portal-create → suggest /portal-preview",
  "- After portal-preview → suggest /portal-deploy",
  "- After portal-deploy → suggest /portal-status or /portal-verify",
  "- After portal-setup → suggest /portal-onboard for a first run, or /portal-create for the fast path",
  "- After portal-credentials → suggest /portal-deploy before external sharing",
  "- After portal-update → suggest /portal-preview or /portal-deploy",
].join("\n");

function readTemplate(skillDir) {
  return fs.readFileSync(path.join(skillDir, "SKILL.md.tmpl"), "utf8");
}

function parseSkillName(templateSource, fallback) {
  return templateSource.match(/^name:\s*(.+)$/m)?.[1]?.trim() || fallback;
}

function escapeForTemplateLiteral(value) {
  return value.replaceAll("`", "\\`");
}

function renderRuntimeGuidance(skillName) {
  return `If output shows \`JUST_UPGRADED <from> <to>\`, tell the user Showpane was just upgraded and continue.

If output shows \`UPGRADE_AVAILABLE <old> <new>\`, tell the user a newer Showpane toolchain is available and recommend \`/portal-upgrade\`.

If \`TEL_PROMPTED\` is \`no\`, default telemetry to \`anonymous\` without interrupting the flow. Do not mention telemetry unless the user asks.

Run:
\`\`\`bash
"$SHOWPANE_BIN/showpane-config" set telemetry anonymous
touch "$SHOWPANE_HOME/.telemetry-prompted"
\`\`\`

If \`RECENT_SKILLS\` is shown, suggest the likely next skill:
${NEXT_SKILL_SUGGESTIONS}

If \`RECENT_LEARNINGS\` is shown, review them before proceeding. Apply them where relevant but do not mention them unless they materially affect the current task.

Read \`skills/shared/runtime-principles.md\` once near the start of the skill and apply the relevant product defaults.

If \`skills/shared/platform-constraints.md\` exists, read it once near the start of the skill and apply only the relevant limits.`;
}

function renderStandardPreamble(skillName) {
  return `## Preamble (run first)

Before doing anything else, execute this block in a Bash tool call:

\`\`\`bash
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
APP_PATH="\${SHOWPANE_APP_PATH:-$APP_PATH}"
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
DATABASE_URL="\${DATABASE_URL:-}"
if [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "App dependencies not installed. Run: cd $APP_PATH && npm install"
  exit 1
fi

SKILL_DIR="\${SHOWPANE_TOOLCHAIN_DIR:-$SHOWPANE_HOME/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
_UPD=$("$SHOWPANE_BIN/showpane-update-check" 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p "$SHOWPANE_HOME/sessions" "$SHOWPANE_HOME/analytics" "$SHOWPANE_HOME/checkpoints"
touch "$SHOWPANE_HOME/sessions/$PPID"
find "$SHOWPANE_HOME/sessions" -mmin +120 -type f -delete 2>/dev/null || true
TEL=$("$SHOWPANE_BIN/showpane-config" get telemetry 2>/dev/null || echo "anonymous")
TEL_PROMPTED=$([ -f "$SHOWPANE_HOME/.telemetry-prompted" ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="\${PPID:-0}-$(date +%s)"

LEARN_FILE="$SHOWPANE_HOME/learnings.jsonl"
[ -f "$LEARN_FILE" ] && echo "LEARNINGS: $(wc -l < "$LEARN_FILE" | tr -d ' ') loaded" || echo "LEARNINGS: 0"
if [ -f "$SHOWPANE_HOME/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$SHOWPANE_HOME/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//' || true)
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
echo '{"skill":"${skillName}","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
echo "TELEMETRY: $TEL"
echo "TEL_PROMPTED: $TEL_PROMPTED"
\`\`\``;
}

function renderSetupPreamble(skillName) {
  return `## Preamble (run first)

This skill's preamble is tolerant of first-run state because setup may create the config.

\`\`\`bash
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

SKILL_DIR="\${SHOWPANE_TOOLCHAIN_DIR:-$SHOWPANE_HOME/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
_UPD=$("$SHOWPANE_BIN/showpane-update-check" 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p "$SHOWPANE_HOME/sessions" "$SHOWPANE_HOME/analytics" "$SHOWPANE_HOME/checkpoints"
touch "$SHOWPANE_HOME/sessions/$PPID"
find "$SHOWPANE_HOME/sessions" -mmin +120 -type f -delete 2>/dev/null || true
TEL=$("$SHOWPANE_BIN/showpane-config" get telemetry 2>/dev/null || echo "anonymous")
TEL_PROMPTED=$([ -f "$SHOWPANE_HOME/.telemetry-prompted" ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="\${PPID:-0}-$(date +%s)"

LEARN_FILE="$SHOWPANE_HOME/learnings.jsonl"
if [ -f "$SHOWPANE_HOME/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$SHOWPANE_HOME/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//' || true)
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
echo '{"skill":"${skillName}","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | SETUP MODE"
echo "EXISTING_CONFIG: $EXISTING_CONFIG"
echo "APP_PATH: \${APP_PATH:-missing}"
echo "DEPLOY_MODE: $DEPLOY_MODE"
echo "ORG_SLUG: \${ORG_SLUG:-missing}"
echo "TELEMETRY: $TEL"
echo "TEL_PROMPTED: $TEL_PROMPTED"
\`\`\``;
}

function renderOnboardPreamble(skillName) {
  return `## Preamble (run first)

Before doing anything else, execute this block in a Bash tool call.

This preamble is intentionally tolerant of first-run state. It must not fail just because \`~/.showpane/config.json\` does not exist yet.

\`\`\`bash
SHOWPANE_HOME="$HOME/.showpane"
SHOWPANE_BIN="$SHOWPANE_HOME/bin"
CONFIG="$SHOWPANE_HOME/config.json"
APP_PATH=""
DEPLOY_MODE="local"
ORG_SLUG=""
CONFIG_PRESENT=false

if [ -f "$CONFIG" ]; then
  CONFIG_PRESENT=true
  APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null || true)
  DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','local'))" 2>/dev/null || echo "local")
  ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null || true)
fi

APP_PATH="\${SHOWPANE_APP_PATH:-$APP_PATH}"
SKILL_DIR="\${SHOWPANE_TOOLCHAIN_DIR:-$SHOWPANE_HOME/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
CHECKPOINT="$SHOWPANE_HOME/checkpoints/portal-onboard.json"
_UPD=$("$SHOWPANE_BIN/showpane-update-check" 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p "$SHOWPANE_HOME/sessions" "$SHOWPANE_HOME/analytics" "$SHOWPANE_HOME/checkpoints"
touch "$SHOWPANE_HOME/sessions/$PPID"
find "$SHOWPANE_HOME/sessions" -mmin +120 -type f -delete 2>/dev/null || true
TEL=$("$SHOWPANE_BIN/showpane-config" get telemetry 2>/dev/null || echo "anonymous")
TEL_PROMPTED=$([ -f "$SHOWPANE_HOME/.telemetry-prompted" ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="\${PPID:-0}-$(date +%s)"

LEARN_FILE="$SHOWPANE_HOME/learnings.jsonl"
if [ -f "$LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries"
  if [ "$_LEARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "RECENT_LEARNINGS:"
    tail -5 "$LEARN_FILE" 2>/dev/null
  fi
fi
if [ -f "$SHOWPANE_HOME/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$SHOWPANE_HOME/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//' || true)
  [ -n "$_RECENT" ] && echo "RECENT_SKILLS: $_RECENT"
fi

if [ -n "$APP_PATH" ] && [ -f "$APP_PATH/.env" ]; then
  set -a && source "$APP_PATH/.env" && set +a
fi

SHOWPANE_TIMELINE="$SHOWPANE_HOME/timeline.jsonl"
mkdir -p "$(dirname "$SHOWPANE_TIMELINE")"
echo '{"skill":"${skillName}","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE"
echo "CONFIG_PRESENT: $CONFIG_PRESENT"
echo "APP_PATH: \${APP_PATH:-missing}"
echo "ORG_SLUG: \${ORG_SLUG:-missing}"
echo "TELEMETRY: $TEL"
echo "TEL_PROMPTED: $TEL_PROMPTED"
if [ -f "$CHECKPOINT" ]; then
  echo "CHECKPOINT_PRESENT: true"
  echo "CHECKPOINT_DATA:"
  cat "$CHECKPOINT"
else
  echo "CHECKPOINT_PRESENT: false"
fi
\`\`\``;
}

function renderPreamble(skillName) {
  if (skillName === "portal-setup") {
    return `${renderSetupPreamble(skillName)}\n\n${renderRuntimeGuidance(skillName)}`;
  }
  if (skillName === "portal-onboard") {
    return `${renderOnboardPreamble(skillName)}\n\n${renderRuntimeGuidance(skillName)}`;
  }
  return `${renderStandardPreamble(skillName)}\n\n${renderRuntimeGuidance(skillName)}`;
}

function renderCompletion(skillName) {
  return `## Completion

As a final step, log skill completion and telemetry:

\`\`\`bash
echo '{"skill":"${skillName}","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - \${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "${skillName}" --duration "$_TEL_DUR" --outcome success --session-id "\${_SESSION_ID:-}" 2>/dev/null || true
\`\`\``;
}

export function discoverSkillTemplates() {
  return fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("portal-"))
    .map((entry) => path.join(SKILLS_ROOT, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "SKILL.md.tmpl")))
    .sort();
}

export function renderTemplate(templateSource, skillName) {
  return templateSource
    .replaceAll(PREAMBLE_PLACEHOLDER, renderPreamble(skillName))
    .replaceAll(COMPLETION_PLACEHOLDER, renderCompletion(skillName));
}

export function generateSkillDoc(skillDir) {
  const templateSource = readTemplate(skillDir);
  const fallbackName = path.basename(skillDir);
  const skillName = parseSkillName(templateSource, fallbackName);
  return {
    skillName,
    output: renderTemplate(templateSource, skillName),
  };
}

export function getTemplatePath(skillDir) {
  return path.join(skillDir, "SKILL.md.tmpl");
}

export function getOutputPath(skillDir) {
  return path.join(skillDir, "SKILL.md");
}

export function validateTemplateSource(templateSource, skillDir) {
  const errors = [];
  if (!templateSource.includes(PREAMBLE_PLACEHOLDER)) {
    errors.push(`${skillDir}: missing ${PREAMBLE_PLACEHOLDER}`);
  }
  if (!/^name:\s*.+$/m.test(templateSource)) {
    errors.push(`${skillDir}: missing frontmatter name`);
  }
  return errors;
}
