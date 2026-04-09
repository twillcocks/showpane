---
name: portal-create
description: |
  Scaffold a new client portal from a meeting transcript, template, or description.
  Trigger phrases: "create a portal", "new portal", "set up a client page", "make a portal for". (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

If the user asks for unsupported hosted behavior, risky upload types, or cloud-specific
capabilities, read `skills/shared/platform-constraints.md` and apply the relevant limits.

## Preamble (run first)

```bash
# Read config
CONFIG="$HOME/.showpane/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "Showpane not configured. Run /portal setup first."
  exit 1
fi
APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null)
DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','docker'))" 2>/dev/null)
ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null)
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
  _RECENT=$(grep '"event":"completed"' "$HOME/.showpane/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//')
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
echo '{"skill":"portal-create","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

## Steps

### Step 1: Determine the portal slug

If the user provided a slug (e.g., `/portal create acme-health`), use it. Otherwise, infer from context — the company name mentioned in conversation, a meeting transcript, or ask the user directly.

Validate the slug by running:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/check-slug.ts" --slug <slug> --org-id <org_id>
```

The script returns `{"valid":true}` or `{"valid":false,"reason":"...","message":"..."}`. If invalid:
- `reason: "format"` — slug must be lowercase alphanumeric + hyphens, 2-50 chars, no leading/trailing hyphens
- `reason: "reserved"` — reserved names: api, client, s, admin, static, _next, health, example
- `reason: "taken"` — a portal with this slug already exists for this org

If invalid, explain the issue and ask for a different slug.

Also ask for the client's website domain (e.g., "acme-health.com"). This is optional but enables auto-branding:
- If provided, the client logo will be fetched via `getLogoUrl(domain)` and stored in `ClientPortal.logoUrl`
- If not provided, an initial-based logo is generated via `getInitialLogo(companyName)` and stored as a data URI

### Step 2: Granola MCP integration (optional)

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

### Step 3: Template selection

Ask which template to use as a starting point:

1. **sales-followup** — Meeting notes, next steps, documents. Best after a sales call.
2. **consulting** — Project overview, deliverables, timeline. Best for ongoing engagements.
3. **onboarding** — Welcome, setup steps, resources. Best for new client onboarding.
4. **blank** — Start from scratch with just an overview tab.

Read the chosen template file from `$SKILL_DIR/templates/` for structural inspiration:

```bash
cat "$SKILL_DIR/templates/sales-followup/sales-followup-client.tsx"
```

Always also read the example portal as your quality and style reference:

```bash
cat "$APP_PATH/src/app/(portal)/client/example/example-client.tsx"
```

The template provides content structure. The example provides quality and styling. Match the example's patterns: card styles, typography, spacing, responsive breakpoints. Templates are inspiration, not rigid scaffolds. Adapt the structure to fit the actual content.

### Step 4: Analyze transcript (if available)

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

### Step 5: Generate the portal files

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
- `companyName` — the org's company name (from config/DB)
- `companyLogo` — a `<span>` with the first letter of the company name, white text
- `clientName` — the client's company name (from transcript or user input)
- `clientLogoSrc` — if client domain was provided: use `getLogoUrl(domain)` from `app/src/lib/branding.ts`. If not: use `getInitialLogo(clientName)` to generate an SVG data URI. Store the chosen URL in the ClientPortal record's `logoUrl` field
- `clientLogoAlt` — the client company name
- `lastUpdated` — today's date formatted as "7 April 2026"
- `contact` — object with `name`, `title`, `avatarSrc`, `email` (from org config)
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

### Step 6: Create database record

Run the create-portal script to register the portal in the database:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/create-portal.ts" --slug <slug> --company "<client_company_name>" --org-id <org_id>
```

This creates the `ClientPortal` record with the slug, company name, and links it to the Organization. It does NOT create credentials — that is a separate step via `/portal credentials`.

### Step 7: Self-review

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

### Step 8: Open preview

Check if the dev server is running:

```bash
lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null
```

If running, open the portal in the browser:

```bash
open "http://localhost:3000/client/<slug>"
```

If not running, suggest:

> "Start the dev server with `/portal dev` to preview your portal at http://localhost:3000/client/<slug>"

### Step 9: Summary and next steps

Print a summary:

```
Portal created: <slug>

  Client:    <company_name>
  Tabs:      Overview, Next Steps, Documents (3 tabs)
  Files:     src/app/(portal)/client/<slug>/page.tsx
             src/app/(portal)/client/<slug>/<slug>-client.tsx

Next steps:
  1. Create login credentials: /portal credentials <slug>
  2. Preview the portal:       /portal preview <slug>
  3. Edit content:             /portal update <slug>
  4. Deploy:                   /portal deploy
```

### Step 10: Record learning

Append a learning about the portal creation for future reference:

```bash
echo '{"skill":"portal-create","key":"portal-created","insight":"Created portal <slug> for <company>. Template: <template>. Tabs: <tab_list>.","confidence":8,"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/learnings.jsonl"
```

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-create","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Conventions

- Always use `"use client"` as the first line of the client component
- Import `PortalShell` from `@/components/portal-shell`
- Import `cn` from `@/lib/utils`
- Import icons from `lucide-react`
- Minimum 2 tabs, maximum 6
- First tab is always overview/welcome
- Tab content as separate function components within the file
- Cards: `rounded-2xl border bg-white shadow-sm`
- Text: `text-sm` for body, `text-base font-bold` for headings
- Spacing: consistent `p-5 sm:p-6` for card padding
- Scope lock: only create files in `$APP_PATH/src/app/(portal)/client/<slug>/`
- Never modify shared components, other portals, or lib files during portal creation
- The example portal at `$APP_PATH/src/app/(portal)/client/example/` is the gold standard — when in doubt, match its patterns
