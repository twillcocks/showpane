---
name: portal-analytics
description: |
  View portal engagement analytics in the terminal. Use when asked to "show analytics",
  "portal stats", "how is the portal doing", "engagement", or "view counts". (showpane)
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
```

## Overview

This skill queries the analytics backend for a specific portal or all portals in the organization and presents engagement data as a formatted ASCII dashboard in the terminal. It uses the `query-analytics.ts` bin script which reads event data from the database via Prisma.

Analytics give the portal owner a quick read on whether clients are actually engaging with the content. Low views or stale activity flags portals that need attention -- a nudge to follow up, refresh content, or check that credentials are still working.

## Steps

### Step 1: Determine the target portal

Check whether the user specified a portal slug:

- If a slug was provided (e.g., "show analytics for whzan"), use that slug directly.
- If no slug was provided, the skill will query analytics for ALL portals in the organization. Let the user know you are pulling org-wide analytics.

Capture the slug (if any) and the ORG_SLUG from the preamble output for the next step.

### Step 2: Query the analytics data

Run the analytics query script. For a specific portal:

```bash
cd $APP_PATH && npx tsx $SKILL_DIR/bin/query-analytics.ts --slug <slug> --org-id <org_id>
```

For all portals (omit the `--slug` flag):

```bash
cd $APP_PATH && npx tsx $SKILL_DIR/bin/query-analytics.ts --org-id <org_id>
```

The script returns JSON on stdout. Expected shape for a single portal:

```json
{
  "ok": true,
  "portal": {
    "slug": "whzan",
    "companyName": "Whzan Digital Health",
    "views": 45,
    "tabSwitches": 123,
    "lastActivity": "2026-04-07T10:30:00Z",
    "mostViewedTab": "Services overview",
    "previousPeriodViews": 33
  }
}
```

For all portals, the response includes a `portals` array with the same fields per entry plus an `orgSummary` object.

If the script exits with a non-zero code, read stderr for the error JSON. Common errors:

- `portal_not_found`: The slug does not exist in this organization. Suggest running `/portal list` to see available portals.
- `no_analytics_data`: The portal exists but has zero recorded events. This is normal for brand-new portals.

### Step 3: Format the output as an ASCII table

Present the data in a clean, scannable terminal format. For a single portal:

```
Portal: whzan (Whzan Digital Health)
Period: Last 30 days
════════════════════════════════════════
  Views:        45
  Tab switches: 123
  Last activity: 2026-04-07 10:30
  Most viewed tab: "Services overview"
════════════════════════════════════════
```

For multiple portals, use a summary table:

```
ANALYTICS (Demo Company) — Last 30 days
════════════════════════════════════════════════════════════
  Slug        Company              Views   Tab Switches  Last Activity
  ─────────── ──────────────────── ─────── ───────────── ──────────────
  whzan       Whzan Digital Health 45      123           7 Apr 10:30
  acme        Acme Corp            12      34            5 Apr 14:22
  example     Example Portal       0       0             Never
════════════════════════════════════════════════════════════
  Total views: 57 | Active portals: 2/3
```

### Step 4: Show trends when previous period data is available

If the analytics response includes `previousPeriodViews` (or equivalent previous-period fields), calculate and display the delta:

```
  Views:        45 (+12 vs previous 30d)
```

Use a `+` prefix for increases and `-` for decreases. If the previous period had zero views and the current has some, show it as `(new activity)` rather than a percentage.

For the multi-portal table, append a trend column:

```
  Slug        Views   Trend
  ─────────── ─────── ──────────
  whzan       45      +12 (+36%)
  acme        12      -3 (-20%)
  example     0       --
```

### Step 5: Provide actionable commentary

After the table, add a brief note if any portals need attention:

- **Zero views in 30 days**: "Portal 'example' has had no views. Consider checking credentials or sending a reminder to the client."
- **Declining trend**: "Portal 'acme' views dropped 20%. The client may need a content refresh or follow-up call."
- **Strong engagement**: "Portal 'whzan' is your most active portal. Good engagement."

Keep commentary to 1-2 sentences maximum. Do not over-explain. The numbers speak for themselves.

## Conventions

- Always format dates as `DD Mon YYYY` or `DD Mon HH:MM` for recency (e.g., "7 Apr 10:30").
- Use double-line box drawing (`═`) for outer borders and single-line (`─`) for internal dividers.
- Right-align numeric columns in multi-portal tables for scannability.
- If the user asks for a specific time period (e.g., "last 7 days"), pass `--period 7d` to the script if supported. Default is 30 days.
- Never expose raw JSON to the user. Always format as the ASCII table described above.
- If learnings indicate the user prefers a specific portal or checks analytics frequently, mention the most relevant portal first.

## Analytics Events

The analytics system tracks the following event types. Understanding what is tracked helps interpret the numbers:

- **page_view**: Recorded when a client loads the portal page. One view per page load, not per session. If a client refreshes the page, that counts as a second view.
- **tab_switch**: Recorded when a client clicks a different tab within the portal. This is the best engagement signal -- it means the client is actively exploring content, not just landing on the page and leaving.
- **file_download**: Recorded when a client downloads a document from the Documents tab. This indicates high-intent engagement.
- **share_link_access**: Recorded when someone accesses the portal via a share link rather than username/password login.

When reading the analytics output, tab switches relative to views gives you a rough engagement depth. A portal with 10 views and 30 tab switches means clients are exploring (3 tabs per visit on average). A portal with 10 views and 2 tab switches means clients are landing and leaving.

## Time Periods

The default analytics period is 30 days. The script supports the following periods via the `--period` flag:

- `7d` -- last 7 days (useful for checking recent activity after sharing a portal)
- `30d` -- last 30 days (default, good general-purpose view)
- `90d` -- last 90 days (useful for long-running client relationships)
- `all` -- all time (useful for seeing total engagement since portal creation)

When the user asks for a custom period, map their language to the closest supported option:
- "this week" or "recent" -> `7d`
- "this month" -> `30d`
- "this quarter" -> `90d`
- "total" or "all time" or "since we started" -> `all`

## Interpreting Zero Activity

A portal with zero views is not necessarily a problem. Context matters:

- **New portal (created in last 7 days)**: Zero views is expected if credentials have not been shared yet. Note: "Portal was created recently. Share credentials with the client to start tracking engagement."
- **Portal with credentials but no views**: The client may not have received the credentials, or the email landed in spam. Suggest: "Credentials exist but no one has logged in. Consider resending or generating a share link."
- **Portal that previously had views but now has zero**: The client relationship may have gone cold. This is the most actionable signal -- suggest a follow-up.
- **Portal with credentials and share link but no views**: The share link may have expired before the client clicked it. Suggest generating a fresh one with `/portal share`.

## Telemetry

If telemetry is enabled, the analytics skill records a minimal event after each query. The telemetry payload does not include any analytics data (view counts, portal slugs, or company names). It only records that the skill was invoked and how long the query took:

```json
{"skill":"portal-analytics","ts":"2026-04-07T12:00:00Z","duration_s":2,"outcome":"success"}
```

## Error Handling

- If the preamble fails (no config, no Prisma), stop and show the error. Do not attempt to query analytics.
- If `query-analytics.ts` returns a non-zero exit code, display the error message from stderr and suggest a fix.
- If DATABASE_URL is empty, tell the user: "No database configured. Run /portal setup to connect your database."
- If the analytics query times out (large dataset), suggest narrowing the period: "Query took too long. Try a shorter period: /portal analytics whzan --period 7d"

## Learnings Integration

After displaying analytics, check the learnings file for patterns that add context:

- If a learning records when credentials were last shared for this portal, note the time gap: "Credentials were shared 3 days ago. Give the client a few more days before following up."
- If a learning records that the user prefers weekly analytics checks, tailor the output to highlight week-over-week changes rather than 30-day totals.
- Do not write new learnings from this skill. Analytics is a read-only operation.

## Related Skills

- `/portal status` -- broader health dashboard with scoring (uses analytics as one input)
- `/portal list` -- see all portals without analytics data
- `/portal share` -- generate a share link for a portal with strong engagement
