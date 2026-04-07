---
name: portal-list
description: |
  List all client portals in the organization. Use when asked to "list portals",
  "show portals", "what portals do I have", "my portals", or "all portals". (showpane)
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

This skill retrieves all portals belonging to the current organization and displays them as a formatted table in the terminal. It is the quickest way to see what portals exist, their status, and when they were last updated. It is also a good starting point before running other portal-specific skills -- users often run `/portal list` to find a slug before using `/portal analytics`, `/portal share`, or `/portal preview`.

## Steps

### Step 1: Query all portals

Run the list script:

```bash
cd $APP_PATH && npx tsx $SKILL_DIR/bin/list-portals.ts --org-id <org_id>
```

Use the `ORG_SLUG` from the preamble output to determine the `org_id`. The script resolves the org slug to an ID internally if needed.

Expected success response:

```json
{
  "ok": true,
  "orgName": "Demo Company",
  "portals": [
    {
      "slug": "whzan",
      "companyName": "Whzan Digital Health",
      "isActive": true,
      "lastUpdated": "2026-04-02T10:00:00Z",
      "hasCredentials": true,
      "tabCount": 4
    },
    {
      "slug": "acme",
      "companyName": "Acme Corp",
      "isActive": true,
      "lastUpdated": "2026-04-05T14:22:00Z",
      "hasCredentials": true,
      "tabCount": 3
    }
  ],
  "total": 2
}
```

If the script exits with a non-zero code, read stderr. Common errors:

- `org_not_found`: The organization slug from config does not exist in the database. The user may need to re-run `/portal setup`.
- `database_error`: Connection issue. Check that DATABASE_URL is correct and the database is accessible.

### Step 2: Format as an ASCII table

Present the portal list in a clean, scannable format:

```
PORTALS (Demo Company)
════════════════════════════════════════
  Slug        Company              Status    Last Updated
  ─────────── ──────────────────── ───────── ────────────
  whzan       Whzan Digital Health Active    2 Apr 2026
  acme        Acme Corp            Active    5 Apr 2026
  example     Example Portal       Active    6 Apr 2026
════════════════════════════════════════
  3 portals total
```

Column definitions:

- **Slug**: The URL-safe identifier used in the portal path (`/client/<slug>`).
- **Company**: The client company name displayed in the portal header.
- **Status**: "Active" for portals with `isActive: true`. "Inactive" for deactivated portals. Inactive portals should be displayed in the table but noted as such.
- **Last Updated**: The date the portal content or configuration was last modified. Format as `DD Mon YYYY`.

### Step 3: Handle empty state

If the organization has zero portals, do not show an empty table. Instead, display:

```
PORTALS (Demo Company)
════════════════════════════════════════
  No portals yet.
  
  Create your first portal: /portal create <slug>
════════════════════════════════════════
```

This guides new users toward the next action. If the user ran `/portal onboard`, they would have gone through this already, but many users will discover the CLI skill-by-skill.

### Step 4: Add contextual hints

After the table, provide brief contextual guidance based on what the list reveals:

- **All portals active, credentials set**: No additional notes needed. The list is self-explanatory.
- **Portal without credentials**: Append a note: "Portal 'example' has no credentials. Run /portal credentials example to set up access."
- **Inactive portals present**: "1 inactive portal not shown. Use --all to include inactive portals." (The `--all` flag can be passed to `list-portals.ts`.)
- **Large number of portals (10+)**: Consider grouping or paginating. For now, just show all of them -- the terminal handles scrolling.

Keep hints to one line each. Do not over-explain.

## Filtering and Sorting

The default sort order is by `lastUpdated` descending (most recently updated first). This puts the portals the user is actively working on at the top.

If the user asks to filter (e.g., "show only active portals" or "portals updated this week"), apply the filter before formatting. Common filters:

- `--active-only` (default): Only show portals with `isActive: true`.
- `--all`: Include inactive/deactivated portals.
- `--updated-since <date>`: Only portals updated after the given date.

Pass these flags through to the `list-portals.ts` script if the user requests them.

## Conventions

- Always show the organization name in the header so the user has context about which org they are viewing.
- Format dates as `DD Mon YYYY` (e.g., "2 Apr 2026"). Do not show times in the list view -- they add clutter without value at this level.
- Right-pad string columns for alignment. The table should look clean even with varying slug and company name lengths.
- Use double-line box drawing (`═`) for outer borders and single-line (`─`) for the header separator.
- If the response includes `tabCount`, do not show it in the default table. It is available for other skills (like `/portal status`) but too detailed for a list view.
- The footer line ("3 portals total") should always be present, even for a single portal ("1 portal total").

## Error Handling

- If the preamble fails, stop and display the error. Do not attempt to query the database.
- If the database query fails, show the error from stderr and suggest checking the connection: "Database query failed. Verify your DATABASE_URL is correct and the database is running."
- If the org is not found, suggest re-running `/portal setup` to reconfigure.

## Data Freshness

The list data comes directly from the database at query time. It reflects the current state of all portals, including any changes made moments ago. There is no caching layer. If the user just created a portal with `/portal create`, it will appear in the list immediately.

The `lastUpdated` timestamp reflects when the portal's database record was last modified. This includes credential changes, status changes, and metadata updates. It does NOT reflect when the portal's React source files were last edited -- file changes are tracked by git, not the database.

## Multi-Organization Support

In v1, Showpane supports a single organization per installation. The `org_id` parameter is always derived from the config. Future versions may support multiple organizations, at which point the list skill would accept an `--org` flag to filter.

If the user asks about portals in a different organization, explain: "Showpane is configured for organization '<org_slug>'. To work with a different org, update your config: edit ~/.showpane/config.json and change the org_slug value, or set it via environment variable."

## Output as Input

The list output is designed to be scannable and to feed into other skills. When a user sees the list and asks to do something with a specific portal (e.g., "show analytics for whzan"), the slug is immediately available from the list.

If the user follows up with an action after seeing the list, carry the context forward. Do not ask them to re-specify the slug if they just referenced it from the list output.

## Learnings Integration

The list skill does not write learnings. It is a read-only query. However, if learnings indicate that the user has a preferred portal or frequently works with a specific client, you can highlight that portal in the output (e.g., bold the slug or add a note like "recently active").

## Portal Lifecycle States

Portals have two states in the database:

- **Active** (`isActive: true`): The portal is accessible to clients. It appears in the default list view. This is the normal operating state.
- **Inactive** (`isActive: false`): The portal has been deactivated via `/portal delete`. It is hidden from the default list view but still exists in the database. Page files may or may not still be in the repository.

There is no "draft" or "pending" state. A portal is either active or inactive. When `/portal create` runs, the portal is immediately active. If the user wants to prepare a portal before making it accessible, they should create it and set up credentials last -- the portal page exists but is behind the login gate.

## Response Format Details

The `list-portals.ts` script returns JSON with these fields per portal:

- `slug` (string): URL identifier, 2-50 characters, lowercase alphanumeric and hyphens.
- `companyName` (string): Display name of the client company.
- `isActive` (boolean): Current status.
- `lastUpdated` (ISO 8601 string): Last modification timestamp.
- `hasCredentials` (boolean): Whether the portal has a username/password configured.
- `tabCount` (number): How many tabs the portal has. Not shown in list view but used by status dashboard.
- `createdAt` (ISO 8601 string): When the portal was first created.

All fields are guaranteed to be present. None are nullable.

## Related Skills

- `/portal status` -- richer view with health scores and activity data
- `/portal analytics` -- deep dive into a specific portal's engagement
- `/portal create` -- create a new portal
- `/portal delete` -- deactivate a portal from this list
