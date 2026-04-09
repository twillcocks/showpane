#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_DIR="$REPO_ROOT/packages/cli"
APP_DIR="$REPO_ROOT/app"
CLOUD_DIR="/Users/tobywillcocks/git/showpane-cloud"
REAL_HOME="${HOME}"
SHOWPANE_CLOUD_URL="${SHOWPANE_CLOUD_URL:-https://app.showpane.com}"

COMPANY_NAME="Acme E2E"
KEEP_TMP=false
RUN_CLOUD_CHECKS=auto
PROJECT_SLUG=""

usage() {
  cat <<'EOF'
Usage: scripts/test-e2e-local-to-cloud.sh [options]

Options:
  --company <name>   Company name to use for the fresh scaffold (default: "Acme E2E")
  --cloud            Require the cloud-build bridge checks
  --skip-cloud       Skip the cloud-build bridge checks even if local auth exists
  --keep-temp        Keep the temp test directory after the script exits
  -h, --help         Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --company)
      COMPANY_NAME="${2:-}"
      shift 2
      ;;
    --cloud)
      RUN_CLOUD_CHECKS=true
      shift
      ;;
    --skip-cloud)
      RUN_CLOUD_CHECKS=false
      shift
      ;;
    --keep-temp)
      KEEP_TMP=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

for cmd in node npm python3 rsync; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Missing required command: $cmd" >&2
    exit 1
  }
done

slugify() {
  python3 - "$1" <<'PY'
import re
import sys

name = sys.argv[1]
slug = name.lower()
slug = re.sub(r"\s+", "-", slug)
slug = re.sub(r"[^a-z0-9-]", "", slug)
slug = re.sub(r"-+", "-", slug)
slug = re.sub(r"(^-|-$)", "", slug)
print(slug)
PY
}

REAL_SHOWPANE_CONFIG="$REAL_HOME/.showpane/config.json"
REAL_SHOWPANE_ACCESS_TOKEN=""
if [[ -f "$REAL_SHOWPANE_CONFIG" ]]; then
  REAL_SHOWPANE_ACCESS_TOKEN="$(python3 - "$REAL_SHOWPANE_CONFIG" <<'PY'
import json
import sys

with open(sys.argv[1]) as fh:
    data = json.load(fh)
print(data.get("accessToken", ""))
PY
)"
fi

if [[ "$RUN_CLOUD_CHECKS" == "auto" ]]; then
  if [[ -n "$REAL_SHOWPANE_ACCESS_TOKEN" ]]; then
    RUN_CLOUD_CHECKS=true
  else
    RUN_CLOUD_CHECKS=false
  fi
fi

if [[ "$RUN_CLOUD_CHECKS" == "true" && -z "$REAL_SHOWPANE_ACCESS_TOKEN" ]]; then
  echo "Cloud checks requested, but no accessToken was found in $REAL_SHOWPANE_CONFIG" >&2
  echo "Run showpane login first, or re-run with --skip-cloud." >&2
  exit 1
fi

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/showpane-e2e.XXXXXX")"
TMP_HOME="$TMP_ROOT/home"
TMP_CACHE="$TMP_ROOT/npm-cache"
TMP_WORK="$TMP_ROOT/work"
TMP_BIN="$TMP_ROOT/bin"
TMP_PROJECT_ROOT=""

cleanup() {
  if [[ "$KEEP_TMP" == "true" ]]; then
    echo "Temp artifacts kept at: $TMP_ROOT"
    return
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

mkdir -p "$TMP_HOME" "$TMP_CACHE" "$TMP_WORK" "$TMP_BIN"
cat > "$TMP_BIN/open" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$TMP_BIN/xdg-open" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$TMP_BIN/open" "$TMP_BIN/xdg-open"

echo "== Repo verification =="
(cd "$APP_DIR" && npm install --no-audit)
(cd "$APP_DIR" && npm test)
(cd "$APP_DIR" && npm run build)
(cd "$CLI_DIR" && npm run build)
(cd "$CLOUD_DIR" && npm test)
(cd "$CLOUD_DIR" && npm run build)

echo
echo "== Pack local CLI =="
PACK_OUTPUT="$(cd "$CLI_DIR" && npm_config_cache="$TMP_CACHE" npm pack --json)"
export PACK_OUTPUT
TARBALL_NAME="$(python3 - <<'PY'
import json
import os
import sys

data = json.loads(os.environ["PACK_OUTPUT"])
print(data[-1]["filename"])
PY
)"
unset PACK_OUTPUT
TARBALL_PATH="$CLI_DIR/$TARBALL_NAME"
PROJECT_SLUG="$(slugify "$COMPANY_NAME")"

echo
echo "== Fresh scaffold =="
INSTALL_LOG="$TMP_ROOT/fresh-scaffold.log"
(
  cd "$TMP_WORK"
  env \
    HOME="$TMP_HOME" \
    PATH="$TMP_BIN:$PATH" \
    npm_config_cache="$TMP_CACHE" \
    npx --yes "file:$TARBALL_PATH" --yes --name "$COMPANY_NAME" --no-open
) >"$INSTALL_LOG" 2>&1 &
INSTALL_PID=$!

success_marker="Showpane is ready"
for _ in $(seq 1 180); do
  if grep -q "$success_marker" "$INSTALL_LOG" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$INSTALL_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

if ! grep -q "$success_marker" "$INSTALL_LOG" 2>/dev/null; then
  tail -n 120 "$INSTALL_LOG" >&2 || true
  echo "Fresh scaffold did not reach the success screen." >&2
  exit 1
fi

cat "$INSTALL_LOG"

kill -TERM "$INSTALL_PID" 2>/dev/null || true
pkill -f "$TMP_WORK/showpane-$PROJECT_SLUG" 2>/dev/null || true
sleep 1
kill -KILL "$INSTALL_PID" 2>/dev/null || true
pkill -9 -f "$TMP_WORK/showpane-$PROJECT_SLUG" 2>/dev/null || true

TMP_PROJECT_ROOT="$TMP_WORK/showpane-$PROJECT_SLUG"
if [[ ! -d "$TMP_PROJECT_ROOT" ]]; then
  echo "Expected scaffolded project at $TMP_PROJECT_ROOT" >&2
  exit 1
fi

echo
echo "== Scaffold assertions =="
for forbidden in \
  "prisma/schema.prisma" \
  "prisma/migrations" \
  "docker-compose.yml" \
  "docker" \
  "scripts/backup.sh" \
  "scripts/restore.sh" \
  "scripts/e2e-verify.sh"; do
  if [[ -e "$TMP_PROJECT_ROOT/$forbidden" ]]; then
    echo "Unexpected scaffold artifact present: $forbidden" >&2
    exit 1
  fi
done

echo
echo "== Generated project checks =="
(cd "$TMP_PROJECT_ROOT" && npm test)
(cd "$TMP_PROJECT_ROOT" && npm run build)

if [[ "$RUN_CLOUD_CHECKS" == "true" ]]; then
  echo
  echo "== Cloud bridge checks =="

  mkdir -p "$TMP_HOME/.showpane"
  python3 - "$TMP_HOME/.showpane/config.json" "$REAL_SHOWPANE_CONFIG" <<'PY'
import json
import os
import sys

target_path, source_path = sys.argv[1], sys.argv[2]
target = {}
if os.path.exists(target_path):
    with open(target_path) as fh:
        target = json.load(fh)
source = {}
with open(source_path) as fh:
    source = json.load(fh)
for key in ("accessToken", "accessTokenExpiresAt", "orgSlug", "portalUrl"):
    if key in source:
        target[key] = source[key]
target["deploy_mode"] = "cloud"
with open(target_path, "w") as fh:
    json.dump(target, fh, indent=2)
    fh.write("\n")
PY

  (
    cd "$TMP_PROJECT_ROOT"
    HOME="$TMP_HOME" \
    SHOWPANE_CLOUD_URL="$SHOWPANE_CLOUD_URL" \
    NODE_PATH="$TMP_PROJECT_ROOT/node_modules" \
    npx tsx --tsconfig "$TMP_PROJECT_ROOT/tsconfig.json" "$REPO_ROOT/bin/ensure-cloud-project-link.ts"
  )

  test -f "$TMP_PROJECT_ROOT/.vercel/project.json"

  (
    cd "$TMP_PROJECT_ROOT"
    HOME="$TMP_HOME" \
    npm_config_cache="$TMP_CACHE" \
    SHOWPANE_CLOUD_URL="$SHOWPANE_CLOUD_URL" \
    npm run cloud:build
  )

  test -f "$TMP_PROJECT_ROOT/.vercel/output/config.json"
else
  echo
  echo "== Cloud bridge checks skipped =="
  echo "Run showpane login first, then re-run this script with --cloud to verify fresh-project cloud builds."
fi

echo
echo "== Done =="
echo "Project: $TMP_PROJECT_ROOT"
echo "Temp home: $TMP_HOME"
