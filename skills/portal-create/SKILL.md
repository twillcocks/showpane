---
name: portal-create
description: |
  Scaffold a new client portal from a meeting transcript, template, or description.
  This is the faster repeat-user path once Showpane is already configured and the
  user does not need the guided first-run wizard.
  Trigger phrases: "create a portal", "new portal", "set up a client page", "make a portal for". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

If the user asks for unsupported hosted behavior, risky upload types, or cloud-specific
capabilities, read `skills/shared/platform-constraints.md` and apply the relevant limits.

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
echo '{"skill":"portal-create","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE | APP: $APP_PATH"
if [ "portal-create" = "portal-deploy" ]; then
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

Read `skills/shared/runtime-principles.md` once near the start of the skill and apply the relevant product defaults.

If `skills/shared/platform-constraints.md` exists, read it once near the start of the skill and apply only the relevant limits.

## Steps

### Step 1: Resolve the local organization

Resolve the organization from the configured `ORG_SLUG` before doing anything else:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/get-org.ts" --slug "$ORG_SLUG"
```

The helper returns:

```json
{"ok":true,"org":{"id":"...","slug":"...","name":"..."}}
```

Store:

- `ORG_ID`
- `ORG_NAME`
- `ORG_CONTACT_NAME`
- `ORG_CONTACT_TITLE`
- `ORG_CONTACT_EMAIL`
- `ORG_CONTACT_AVATAR`
- `ORG_SUPPORT_EMAIL`
- `ORG_WEBSITE_URL`

If the helper fails, stop and tell the user to run `/portal-setup` again instead
of guessing with ad-hoc SQL.

Do not probe `showpane --help`, `package.json`, `scripts/`, `prisma/`, or template
directories just to understand the project. Do not call `check-slug.ts` with
anything except `--org-id`.

The canonical references for this skill are:

- the configured `APP_PATH`
- the configured `ORG_SLUG`
- the org fields returned by `get-org.ts`
- this skill file
- `$SKILL_DIR/templates/<chosen-template>/...`
- `$APP_PATH/src/app/(portal)/client/example/example-client.tsx`

### Step 2: Determine the portal slug

If the user provided a slug (e.g., `/portal-create acme-health`), use it. Otherwise, infer from context — the company name mentioned in conversation, a meeting transcript, or ask the user directly.

Validate the slug by running:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/check-slug.ts" --slug <slug> --org-id "$ORG_ID"
```

The script returns `{"valid":true}` or `{"valid":false,"reason":"...","message":"..."}`. If invalid:
- `reason: "format"` — slug must be lowercase alphanumeric + hyphens, 2-50 chars, no leading/trailing hyphens
- `reason: "reserved"` — reserved names: api, client, s, admin, static, _next, health, example
- `reason: "taken"` — a portal with this slug already exists for this org

If invalid, explain the issue and ask for a different slug.

Also ask for the client's website domain (e.g., "acme-health.com"). This is optional but enables auto-branding:
- If provided, the client logo will be fetched via `getLogoUrl(domain)` and stored in `ClientPortal.logoUrl`
- If not provided, an initial-based logo is generated via `getInitialLogo(companyName)` and stored as a data URI

### Step 3: Granola MCP integration (optional)

Try to use the Granola MCP `list_meetings` tool to fetch recent meetings. This is a convenience, not a requirement.

**If Granola MCP is available:**
1. Call `list_meetings` to get recent meetings
2. Present the list to the user: date, title, participants
3. Ask which meeting to use (or "none — I'll describe the portal manually")
4. If a meeting is selected, call `get_meeting_transcript` to retrieve the full transcript
5. Store the transcript for content analysis in Step 4

**If Granola MCP is NOT available** (tool-not-found error):
- Skip gracefully. Do not mention Granola or show an error.
- Ask: "Do you have a meeting transcript to paste, or shall I work from a description?"
- If the user pastes a transcript, store it for analysis
- If no transcript, proceed to template selection with manual content

Never fail or block because Granola is unavailable. It is purely additive.

### Step 4: Template selection

Ask which template to use as a starting point. Keep this brief and practical —
the user chose `/portal-create` because they want the fast path, not a wizard.

1. **sales-followup** — Meeting notes, next steps, documents. Best after a sales call.
2. **consulting** — Project overview, deliverables, timeline. Best for ongoing engagements.
3. **onboarding** — Welcome, setup steps, resources. Best for new client onboarding.
4. **blank** — Start from scratch with just an overview tab.

Read the chosen template file from the exact toolchain path for structural inspiration:

```bash
cat "$SKILL_DIR/templates/<chosen-template>/<chosen-template>-client.tsx"
```

Always also read the example portal as your quality and style reference:

```bash
cat "$APP_PATH/src/app/(portal)/client/example/example-client.tsx"
```

The template provides content structure. The example provides quality and styling. Match the example's patterns: card styles, typography, spacing, responsive breakpoints. Templates are inspiration, not rigid scaffolds. Adapt the structure to fit the actual content.

Do not search the repo for templates or ask the filesystem where templates live.
Use the selected template and the exact `SKILL_DIR` path above.

### Step 5: Analyze transcript (if available)

If a transcript was provided (from Granola or pasted), analyze it to extract:

| Signal Found | Tab to Generate | Content Pattern |
|---|---|---|
| Meeting discussion topics | "Meetings" | Collapsible `<details>` sections per meeting with bullet points |
| Action items, next steps, follow-ups | "Next Steps" | Numbered timeline with status indicators (done/pending) |
| Documents mentioned (contracts, NDAs, proposals) | "Documents" | Download cards with file type icons from lucide-react |
| Service descriptions, capabilities discussed | "Services" | Grid of cards with title and description |
| Pricing, costs, tiers discussed | "Pricing" | Comparison table or tier cards |
| Project phases, milestones | "Timeline" | Vertical timeline with phase markers |

Always generate at minimum:
- An **overview/welcome tab** (first tab, always)
- At least **one additional tab** based on content

If the transcript is rich, generate up to 5-6 tabs. Do not exceed 6 tabs total.

Extract from the transcript:
- **Company name** and contact details (for PortalShell props)
- **Key discussion points** (for meeting notes)
- **Agreed actions** (for next steps timeline)
- **Mentioned documents** (for documents tab)
- **Services or products discussed** (for services/overview content)

### Step 6: Generate the portal files

Create two files in `$APP_PATH/src/app/(portal)/client/<slug>/`:

#### File 1: `page.tsx` (server component)

```tsx
import { <SlugName>PortalClient } from "./<slug>-client";

export const metadata = {
  title: "<Company Name> | Portal",
};

export default function <SlugName>Portal() {
  return <<SlugName>PortalClient />;
}
```

Convert the slug to PascalCase for the component name (e.g., `acme-health` becomes `AcmeHealth`).

#### File 2: `<slug>-client.tsx` (client component)

This is the main file. Follow these conventions exactly:

**Imports:**
```tsx
"use client";

import { type ReactNode } from "react";
import { /* icons from lucide-react */ } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell } from "@/components/portal-shell";
```

**Structure:**
- Define each tab's content as a separate function component within the file (e.g., `function OverviewTab()`, `function DocumentsTab()`)
- Export a single named component: `export function <SlugName>PortalClient()`
- The exported component returns `<PortalShell>` with all required props

**PortalShell props (all required):**
- `companyName` — the org's company name (from `ORG_NAME`)
- `companyLogo` — a `<span>` with the first letter of the company name, white text
- `clientName` — the client's company name (from transcript or user input)
- `clientLogoSrc` — if client domain was provided: use `getLogoUrl(domain)` from `app/src/lib/branding.ts`. If not: use `getInitialLogo(clientName)` to generate an SVG data URI. Store the chosen URL in the ClientPortal record's `logoUrl` field
- `clientLogoAlt` — the client company name
- `lastUpdated` — today's date formatted as "7 April 2026"
- `contact` — object with `name`, `title`, `avatarSrc`, `email` (from the `get-org.ts` result, not from ad-hoc config or DB probing)
- `tabs` — array of tab objects with `id`, `label`, `icon`, `content`, and optional `badge`
- `hideFooterOnTab` — set to `"overview"` (hides the contact footer on the first tab since it typically has contact info inline)

**Styling conventions (match the example portal exactly):**
- Cards: `rounded-2xl border bg-white shadow-sm`
- Card padding: `p-5 sm:p-6`
- Section headings: `text-base font-bold tracking-tight text-gray-900`
- Body text: `text-sm leading-relaxed text-gray-600`
- Small text: `text-xs text-gray-500`
- Bullet points: use `<span>` dots with `h-1.5 w-1.5 rounded-full` for bullet markers
- Status badges: `rounded-full px-2 py-0.5 text-[11px] font-medium` with color variants
- Buttons: `rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white`
- Grid layouts: `grid gap-3 sm:grid-cols-2` for card grids
- Spacing between sections: `mt-6` with `mb-4` for section headings
- Responsive: mobile-first, use `sm:` breakpoints for wider layouts

**Icon usage:**
Import only the icons you need from `lucide-react`. Common choices:
- `Presentation` for overview/services
- `CalendarDays` for meetings
- `FileText` for documents
- `BarChart3` for analytics/strategy
- `ListChecks` for next steps
- `Download` for download buttons
- `ChevronDown` for collapsible sections
- `Clock` for timeline
- `DollarSign` for pricing

**For collapsible meeting sections**, use the same `<details>` pattern as the example:
```tsx
<details open={defaultOpen} className="group">
  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-left">
    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
    <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
  </summary>
  <div className="mt-2 pl-5">{children}</div>
</details>
```

### Step 7: Create database record

Run the create-portal script to register the portal in the database:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/create-portal.ts" --slug <slug> --company "<client_company_name>" --org-id "$ORG_ID"
```

This creates the `ClientPortal` record with the slug and company name, links it to
the Organization, and currently auto-generates initial credentials. The script
returns `username` and `password`.

Do not dump those credentials into the middle of the flow unless the user asked.
For onboarding, carry them forward quietly and show them at the access phase.

### Step 8: Self-review

After generating the files, read them back and verify:

1. **PortalShell used?** The client component must use `<PortalShell>` as its root element.
2. **Minimum 2 tabs?** Check the `tabs` array has at least 2 entries.
3. **Contact info in props?** The `contact` prop must have `name`, `title`, `avatarSrc`, `email`.
4. **"use client" directive?** Must be the first line of the client component.
5. **Imports correct?** `cn` from `@/lib/utils`, `PortalShell` from `@/components/portal-shell`.
6. **No hardcoded localhost URLs?** Links should be relative or use placeholders.
7. **Responsive patterns?** Check for `sm:` breakpoints on grids and padding.
8. **Tab content functions?** Each tab should have its own function, not inline JSX.

If any check fails, fix the issue before proceeding.

### Step 9: Open preview

Check if the dev server is running:

```bash
lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null
```

If running, open the portal in the browser:

```bash
open "http://localhost:3000/client/<slug>"
```

If not running, suggest:

> "Start the dev server with `/portal-dev` to preview your portal at http://localhost:3000/client/<slug>"

### Step 10: Summary and next steps

Print a summary:

```
Portal created: <slug>

  Client:    <company_name>
  Tabs:      Overview, Next Steps, Documents (3 tabs)
  Files:     src/app/(portal)/client/<slug>/page.tsx
             src/app/(portal)/client/<slug>/<slug>-client.tsx

Next steps:
  1. Preview the portal:       /portal-preview <slug>
  2. Edit content:             /portal-update <slug>
  3. Rotate credentials:       /portal-credentials <slug>
  4. Deploy:                   /portal-deploy
```

### Step 11: Record learning

Append a learning about the portal creation for future reference:

```bash
echo '{"skill":"portal-create","key":"portal-created","insight":"Created portal <slug> for <company>. Template: <template>. Tabs: <tab_list>.","confidence":8,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

## Completion

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-create","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-create" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
