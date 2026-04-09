---
name: portal-status
description: |
  Terminal dashboard showing all portals with health scores. Use when asked to "portal status",
  "dashboard", "health check", "how are my portals", or "overview of all portals". (showpane)
allowed-tools: [Bash, Read, Glob, Grep]
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
echo '{"skill":"portal-status","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

This skill produces a terminal-based status dashboard showing all portals with health scores, recent activity, and attention flags. It combines data from the portal list and analytics queries into a single at-a-glance view. Think of it as the "home screen" for a Showpane operator -- one command to understand the state of all client portals.

The health score is a composite 0-10 rating that weights recent activity, credential freshness, content recency, and file completeness. Portals scoring below 5 are flagged with suggestions for improvement.

## Steps

### Step 1: Fetch the portal list

Run the list script to get all active portals:

```bash
cd $APP_PATH && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig $APP_PATH/tsconfig.json $SKILL_DIR/bin/list-portals.ts --org-id <org_id>
```

This returns the list of portals with their metadata (slug, company name, status, last updated, credential info).

If the org has zero portals, display:

```
SHOWPANE STATUS DASHBOARD
════════════════════════════════════════════════════════════
  No portals yet. Run /portal create to get started.
════════════════════════════════════════════════════════════
```

### Step 2: Fetch analytics for each portal

For each portal in the list, query analytics:

```bash
cd $APP_PATH && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig $APP_PATH/tsconfig.json $SKILL_DIR/bin/query-analytics.ts --slug <slug> --org-id <org_id>
```

If you have many portals (5+), you can batch the queries. For a small number, sequential calls are fine. The script should return quickly for each portal.

Collect the following data points per portal:
- `views7d`: Total views in the last 7 days
- `lastActivity`: Timestamp of most recent event
- `credentialCreatedAt`: When credentials were first set up
- `lastUpdated`: When the portal content was last modified
- `hasFiles`: Whether the portal has at least one uploaded/attached file

### Step 3: Calculate health scores

Score each portal on a 0-10 scale using four weighted dimensions:

#### Recent Activity (30% weight)
- Views in last 7 days > 0: score 10
- No views in last 7 days but views in last 30 days > 0: score 5
- No views in last 30 days: score 0

#### Credential Freshness (20% weight)
- Credentials created less than 30 days ago: score 10
- Credentials created less than 90 days ago: score 7
- Credentials older than 90 days: score 3
- No credentials at all: score 0

#### Content Recency (30% weight)
- `lastUpdated` within 30 days: score 10
- `lastUpdated` within 90 days: score 7
- `lastUpdated` older than 90 days: score 3

#### Has Files (20% weight)
- At least 1 file/document attached: score 10
- No files: score 5

**Composite score** = (activity * 0.3) + (credentials * 0.2) + (content * 0.3) + (files * 0.2)

Round to one decimal place.

### Step 4: Display the dashboard

Format the output as a rich ASCII table:

```
SHOWPANE STATUS DASHBOARD
════════════════════════════════════════════════════════════
  Portal    Company              Health  Views(7d)  Last Login
  ───────── ──────────────────── ─────── ────────── ──────────
  whzan     Whzan Digital Health 8.5/10  12         2 days ago
  acme      Acme Corp            6.0/10  0          15 days ago
  example   Example Portal       3.0/10  0          Never
════════════════════════════════════════════════════════════
  3 portals | Avg health: 5.8/10 | 1 needs attention
```

Column definitions:

- **Portal**: The slug. Keep it short.
- **Company**: Client company name, truncated to 20 characters if needed.
- **Health**: Composite score out of 10, one decimal place.
- **Views(7d)**: View count in the last 7 days. "0" if none.
- **Last Login**: Human-readable relative time. "2 days ago", "15 days ago", "Never". Use "Never" if there are zero recorded events.

### Step 5: Flag portals needing attention

Any portal with a health score below 5.0 gets flagged. After the table, list specific, actionable suggestions:

```
NEEDS ATTENTION
────────────────────────────────────────
  example (3.0/10):
    - No views in 30 days. Check if credentials were shared with the client.
    - Content last updated 4 months ago. Consider refreshing.
    - No files attached. Add documents to increase engagement.
  
  acme (6.0/10):
    - No views in 7 days. Consider a follow-up email.
────────────────────────────────────────
```

Guidelines for suggestions:

- **No views, has credentials**: "Check if credentials were shared with the client."
- **No views, no credentials**: "Set up credentials with /portal credentials <slug> and share them."
- **Stale content (> 90 days)**: "Content last updated X months ago. Consider refreshing."
- **No files**: "Add documents to increase engagement."
- **Declining activity (had views before, none now)**: "Activity has dropped off. Consider a follow-up."
- **Old credentials (> 90 days)**: "Credentials are X months old. Consider rotating with /portal credentials <slug>."

Limit to 3 suggestions per portal maximum. Prioritize by impact.

### Step 6: Summarize

The footer line provides the aggregate view:
- Total portals count
- Average health score across all portals
- Count of portals needing attention (health < 5.0)

If all portals are healthy (score >= 7.0), add a positive note: "All portals healthy. Nice work."

If average health is below 5.0, flag it: "Overall health is low. Focus on the flagged portals above."

## Health Score Interpretation

Provide this legend if the user asks what the scores mean or on first use:

- **8-10**: Excellent. Portal is active, content is fresh, credentials are current.
- **5-7.9**: Okay. Some areas could use attention but the portal is functional.
- **Below 5**: Needs attention. The portal may be stale, unused, or missing key components.

## Conventions

- Always show all active portals. Do not filter or paginate -- the dashboard should be a complete picture.
- Sort by health score ascending (worst first) so the portals needing attention are at the top.
- Use relative time for "Last Login" column ("2 days ago", "3 weeks ago", "Never") for quick scanning.
- Use double-line box drawing (`═`) for outer borders and single-line (`─`) for internal dividers and the "needs attention" section.
- The dashboard should fit within 80 columns if possible. Truncate company names if needed.
- If learnings indicate the user checks status regularly, skip the health score legend and just show the dashboard.

## Error Handling

- If the preamble fails, stop and display the error.
- If the list query succeeds but analytics queries fail for some portals, still show the dashboard with available data. Mark missing analytics as "N/A" rather than failing the whole dashboard.
- If all queries fail, show the error and suggest checking the database connection.

## Dashboard Refresh

The status dashboard is a point-in-time snapshot. It does not auto-refresh or watch for changes. If the user wants to monitor portal health over time, suggest running `/portal status` periodically (e.g., weekly) or setting up a scheduled task.

If learnings indicate the user runs status checks regularly, track the trend: "Average health this week: 6.2/10 (up from 5.5/10 last week)." This requires comparing against previous status check results stored in learnings.

## Health Score Calibration

The health scoring weights are intentionally opinionated. They reflect what matters for a client portal product:

- **Activity (30%)** is weighted highest because the primary purpose of a portal is client engagement. A portal with no views is not serving its purpose.
- **Content recency (30%)** is equally weighted because stale content erodes trust. If a client sees the same content from months ago, they stop checking.
- **Credential freshness (20%)** matters for security hygiene. Old credentials are more likely to be compromised or forgotten.
- **Has files (20%)** is a completeness signal. Portals with documents tend to have higher engagement because they give clients a reason to return.

If the user disagrees with the weighting (e.g., "files aren't important for my portals"), note it as a learning for future reference but do not change the scoring algorithm at runtime. The scoring is consistent across all portals for comparability.

## Telemetry

If telemetry is enabled, the status skill records:

```json
{"skill":"portal-status","ts":"2026-04-07T12:00:00Z","duration_s":3,"outcome":"success","portal_count":3,"avg_health":5.8}
```

This helps track how often the user monitors their portals and whether overall health is trending up or down. No portal-specific data (slugs, company names) is included in telemetry.

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-status","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Related Skills

- `/portal analytics <slug>` -- deep dive into a specific portal's analytics
- `/portal list` -- simpler list without health scores
- `/portal preview <slug>` -- open a portal to verify its content
- `/portal credentials <slug>` -- set up or rotate credentials for a flagged portal
