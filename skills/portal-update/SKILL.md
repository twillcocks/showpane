---
name: portal-update
description: |
  Edit existing portal content — add tabs, update text, change structure, or refresh after a new meeting.
  Trigger phrases: "update portal", "edit portal", "change the portal", "add a tab to", "update content for". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

## Preamble (run first)

Before doing anything else, execute this block in a Bash tool call:

```bash
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
CLOUD_API_TOKEN=$("$SHOWPANE_BIN/showpane-config" get accessToken 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('accessToken',''))" 2>/dev/null || true)
CLOUD_API_BASE="${SHOWPANE_CLOUD_URL:-https://app.showpane.com}"
CLOUD_ORG_SLUG="${ORG_SLUG:-}"
CLOUD_PORTAL_URL=$("$SHOWPANE_BIN/showpane-config" get portalUrl 2>/dev/null || python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('portalUrl',''))" 2>/dev/null || true)
APP_PATH="${SHOWPANE_APP_PATH:-$APP_PATH}"
if [ -f "$APP_PATH/.env" ]; then set -a && source "$APP_PATH/.env" && set +a; fi
DATABASE_URL="${DATABASE_URL:-}"
if [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "App dependencies not installed. Run: cd $APP_PATH && npm install"
  exit 1
fi

SKILL_DIR="${SHOWPANE_TOOLCHAIN_DIR:-$SHOWPANE_HOME/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
_UPD=$("$SHOWPANE_BIN/showpane-update-check" 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p "$SHOWPANE_HOME/sessions" "$SHOWPANE_HOME/analytics" "$SHOWPANE_HOME/checkpoints"
touch "$SHOWPANE_HOME/sessions/$PPID"
find "$SHOWPANE_HOME/sessions" -mmin +120 -type f -delete 2>/dev/null || true
TEL=$("$SHOWPANE_BIN/showpane-config" get telemetry 2>/dev/null || echo "anonymous")
TEL_PROMPTED=$([ -f "$SHOWPANE_HOME/.telemetry-prompted" ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="${PPID:-0}-$(date +%s)"

LEARN_FILE="$SHOWPANE_HOME/learnings.jsonl"
[ -f "$LEARN_FILE" ] && echo "LEARNINGS: $(wc -l < "$LEARN_FILE" | tr -d ' ') loaded" || echo "LEARNINGS: 0"
if [ -f "$SHOWPANE_HOME/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$SHOWPANE_HOME/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '
' ',' | sed 's/,$//' || true)
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
echo '{"skill":"portal-update","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
if [ "portal-update" = "portal-deploy" ]; then
  echo "ORG_SLUG: $ORG_SLUG"
  echo "CLOUD_API_TOKEN: ${CLOUD_API_TOKEN:+present}${CLOUD_API_TOKEN:-missing}"
  echo "CLOUD_API_BASE: ${CLOUD_API_BASE:-missing}"
  echo "CLOUD_ORG_SLUG: ${CLOUD_ORG_SLUG:-missing}"
  echo "CLOUD_PORTAL_URL: ${CLOUD_PORTAL_URL:-missing}"
fi
echo "TELEMETRY: $TEL"
echo "TEL_PROMPTED: $TEL_PROMPTED"
```

If output shows `JUST_UPGRADED <from> <to>`, tell the user Showpane was just upgraded and continue.

If output shows `UPGRADE_AVAILABLE <old> <new>`, tell the user a newer Showpane toolchain is available and recommend `/portal-upgrade`.

If `TEL_PROMPTED` is `no`, default telemetry to `anonymous` without interrupting the flow. Do not mention telemetry unless the user asks.

Run:
```bash
"$SHOWPANE_BIN/showpane-config" set telemetry anonymous
touch "$SHOWPANE_HOME/.telemetry-prompted"
```

If `RECENT_SKILLS` is shown, suggest the likely next skill:
- After portal-create → suggest /portal-preview
- After portal-preview → suggest /portal-deploy
- After portal-deploy → suggest /portal-status or /portal-verify
- After portal-setup → suggest /portal-onboard for a first run, or /portal-create for the fast path
- After portal-credentials → suggest /portal-deploy before external sharing
- After portal-update → suggest /portal-preview or /portal-deploy

If `RECENT_LEARNINGS` is shown, review them before proceeding. Apply them where relevant but do not mention them unless they materially affect the current task.

Read `skills/shared/runtime-principles.md` directly from that exact path near the start of the skill and apply the relevant product defaults.

If `skills/shared/platform-constraints.md` exists, read it directly from that exact path near the start of the skill and apply only the relevant limits. No directory listing is needed first.

## Steps

### Step 1: Identify the portal to edit

If the user provided a slug (e.g., `/portal-update acme-health`), use it. Otherwise, ask which portal to update.

Verify the portal exists by checking for the client component file:

```bash
ls "$APP_PATH/src/app/(portal)/client/<slug>/<slug>-client.tsx" 2>/dev/null
```

If the file doesn't exist, inform the user and suggest `/portal-create <slug>` instead. If the slug directory exists but the client file has a different name, list the directory contents to find the correct file.

### Step 2: Read the existing portal

Read the full client component file:

```bash
cat "$APP_PATH/src/app/(portal)/client/<slug>/<slug>-client.tsx"
```

Also read the page.tsx for completeness:

```bash
cat "$APP_PATH/src/app/(portal)/client/<slug>/page.tsx"
```

Parse and understand the current portal structure:
- How many tabs exist and what are their IDs and labels?
- What content is in each tab?
- What PortalShell props are set?
- What icons are imported?

### Step 3: Present current structure

Show the user a concise summary of the portal's current state:

```
Portal: acme-health (Acme Health)

  Tabs:
    1. overview — "Services overview" (Presentation icon)
    2. meetings — "Meetings" (CalendarDays icon)
    3. documents — "Documents" (FileText icon, amber badge)

  Contact: Jane Smith (Account Manager)
  Last updated: 2 April 2026
```

This gives the user context before they describe what to change.

### Step 4: Scope lock

**CRITICAL: Only edit files within the portal's own directory.**

Allowed files:
- `$APP_PATH/src/app/(portal)/client/<slug>/page.tsx`
- `$APP_PATH/src/app/(portal)/client/<slug>/<slug>-client.tsx`
- Any other files within `$APP_PATH/src/app/(portal)/client/<slug>/`

Do NOT modify:
- `$APP_PATH/src/components/portal-shell.tsx` or any shared components
- Other portals' directories
- Files in `$APP_PATH/src/lib/`
- Any files outside the portal's directory

If the user's request would require changes to shared components, explain that this is outside the scope of a portal update and suggest they make those changes separately.

### Step 5: Check learnings for user preferences

Before making changes, read any relevant learnings from the learnings file:

```bash
if [ -f "$HOME/.showpane/learnings.jsonl" ]; then
  grep '"portal-update"\|"portal-create"' "$HOME/.showpane/learnings.jsonl" | tail -10
fi
```

Look for patterns that inform how to make edits:
- Tab preferences (how many tabs the user typically wants)
- Content density preferences (sparse vs. detailed)
- Styling preferences (color accents, badge usage)
- Structural patterns (timeline vs. bullet list for next steps)

Apply these preferences when generating new content, but do not mention them to the user unless relevant.

### Step 6: Understand the requested changes

Ask the user what they want to change. Common requests and how to handle them:

**Adding a new tab:**
1. Ask for the tab name and what content it should contain
2. Create a new function component for the tab content (e.g., `function PricingTab()`)
3. Add the tab to the `tabs` array in the exported component
4. Import any new icons needed
5. Keep the tab count at or below 6

**Updating existing content:**
1. Identify which tab and section to update
2. Make the targeted edit
3. Preserve the existing structure and styling

**Adding meeting notes from a new meeting:**
1. If a transcript is provided (from Granola or pasted), analyze it for new discussion points, action items, and documents
2. Add a new meeting section to the Meetings tab using the collapsible `<details>` pattern
3. Update the Next Steps tab if new action items were discussed
4. Update `lastUpdated` to today's date

**Changing the tab order:**
1. Reorder the `tabs` array — but keep overview/welcome as the first tab
2. Update the `hideFooterOnTab` prop if the first tab changes

**Removing a tab:**
1. Remove the tab from the `tabs` array
2. Remove the corresponding function component
3. Clean up unused icon imports
4. Ensure at least 2 tabs remain

**Updating contact info or metadata:**
1. Update the relevant PortalShell props
2. Update any inline mentions of the contact in tab content

### Step 7: Make the edits

Apply the changes to the client component file. Follow the same conventions as `/portal-create`:

- Cards: `rounded-2xl border bg-white shadow-sm`
- Card padding: `p-5 sm:p-6`
- Section headings: `text-base font-bold tracking-tight text-gray-900`
- Body text: `text-sm leading-relaxed text-gray-600`
- Small text: `text-xs text-gray-500`
- Responsive: use `sm:` breakpoints
- Icons from `lucide-react` only

When adding new content, match the visual weight and density of existing tabs. A portal with sparse, clean tabs should get sparse, clean new content — not suddenly dense data tables.

### Step 8: Show diff before confirming

After making edits, show the user a summary of what changed:

- Which tabs were added, removed, or modified
- What content was updated
- Any prop changes on PortalShell

If using git, show the actual diff:

```bash
cd "$APP_PATH" && git diff "src/app/(portal)/client/<slug>/"
```

Ask the user to confirm the changes look correct before considering the update complete.

### Step 9: Update lastUpdated

Update the `lastUpdated` prop on PortalShell to today's date in the format "7 April 2026". This signals to the client that the portal has fresh content.

### Step 10: Open preview

Check if the dev server is running:

```bash
lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null
```

If running, open the portal:

```bash
open "http://localhost:3000/client/<slug>"
```

If a specific tab was updated, deep-link to it:

```bash
open "http://localhost:3000/client/<slug>#<tab_id>"
```

If not running, suggest starting the dev server with `/portal-dev`.

### Step 11: Record learning

If the update reveals a pattern or preference, record it:

```bash
echo '{"skill":"portal-update","key":"<pattern>","insight":"<observation>","confidence":7,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

Examples of useful learnings:
- "User prefers 3-tab portals over 5-tab"
- "User always includes a Documents tab"
- "User prefers numbered next steps over bullet points"
- "User likes amber badges on action-required tabs"

## Granola Enrichment for Updates

When the user says something like "update the portal with the latest meeting" or "add notes from today's call", attempt Granola MCP integration:

1. Try `list_meetings` to get recent meetings
2. If available, show recent meetings and ask which one to add
3. If selected, pull the transcript with `get_meeting_transcript`
4. Analyze the transcript for new discussion points, action items, and documents
5. Add a new meeting section to the Meetings tab (or create the tab if it doesn't exist)
6. Update the Next Steps tab with any new action items
7. Update `lastUpdated` to today's date

If Granola is not available, ask the user to paste the transcript or describe the changes manually. Never fail because Granola is unavailable.

## Content Pattern Reference

When adding new content, use these patterns to match the existing portal style:

**Meeting notes section** (collapsible):
```tsx
<MeetingSection title="Follow-up Call" defaultOpen={true}>
  <ul className="space-y-2 text-sm text-gray-600">
    <li className="flex gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
      Discussion point text here
    </li>
  </ul>
</MeetingSection>
```

**Action item with status**:
```tsx
<li className="flex items-stretch gap-3 sm:gap-4">
  <div className="flex flex-col items-center">
    <span className={cn(
      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
      done ? "bg-green-500 text-white" : "bg-gray-900 text-white"
    )}>
      {done ? "✓" : index + 1}
    </span>
  </div>
  <div className="pb-5">
    <p className="text-sm font-semibold text-gray-900">Action title</p>
    <p className="mt-0.5 text-sm leading-relaxed text-gray-500">Details here</p>
  </div>
</li>
```

**Document download card**:
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex items-start gap-3">
    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
    <div>
      <p className="text-sm font-medium text-gray-900">Document title</p>
      <p className="mt-1 text-sm text-gray-500">Description or instructions</p>
    </div>
  </div>
  <button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 sm:w-auto">
    <Download className="h-3.5 w-3.5" />
    Download PDF
  </button>
</div>
```

## Completion

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-update","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-update" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
