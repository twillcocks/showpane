---
name: portal-delete
description: |
  Deactivate a client portal. Use when asked to "delete portal", "remove portal",
  "deactivate portal", "archive portal", or "shut down portal". (showpane)
allowed-tools: [Bash, Read, Write, Edit]
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../showpane-shared/bin/check-portal-guard.sh"
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/../showpane-shared/bin/check-portal-guard.sh"
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
echo '{"skill":"portal-delete","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

## Safety Guard

This skill has a PreToolUse guard that warns before destructive operations
(database resets and file deletion). If the guard
triggers, confirm the action is intentional before proceeding.

## Overview

This skill deactivates a client portal by setting `isActive` to `false` in the database. It is a soft delete -- the portal page files remain in the git repository and the database record is preserved, but the portal becomes inaccessible to clients. Existing authenticated sessions and share links stop working because token validation requires an active portal record.

Soft delete is intentional. Nothing is truly destroyed. If the user changes their mind, the portal can be reactivated by updating the database record directly. This design avoids the need for a separate "undo" mechanism.

## Steps

### Step 1: Identify the target portal

The user must specify which portal to deactivate. If no slug is provided, ask: "Which portal do you want to deactivate? Run /portal list to see your portals."

Do not proceed without a confirmed slug.

### Step 2: Confirm with the user

Before executing the delete, present a confirmation prompt. This is the one moment where the skill pauses for human input:

"This will deactivate portal '<slug>'. Existing sessions will expire within 7 days. The page files will remain in git but won't be accessible. Continue?"

Wait for the user to confirm. Accept "yes", "y", "continue", "go ahead", or similar affirmatives. If the user says "no", "cancel", "wait", or anything non-affirmative, abort: "Cancelled. Portal '<slug>' remains active."

Do NOT skip this confirmation step. Even though the operation is reversible, deactivating a portal affects live client access. The user should consciously decide.

### Step 3: Execute the deactivation

Run the delete script:

```bash
cd $APP_PATH && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig $APP_PATH/tsconfig.json $SKILL_DIR/bin/delete-portal.ts --slug <slug> --org-id <org_id>
```

Expected success response:

```json
{
  "ok": true,
  "slug": "whzan",
  "previousStatus": "active",
  "newStatus": "inactive",
  "sessionsAffected": 3,
  "shareLinksAffected": 1
}
```

Expected error responses:

- `portal_not_found`: The slug does not exist in this organization. Suggest `/portal list`.
- `already_inactive`: The portal is already deactivated. Inform the user: "Portal '<slug>' is already inactive. No changes made."

### Step 4: Print confirmation

Display a clear confirmation of what happened:

```
════════════════════════════════════════
  Portal deactivated: whzan
  
  Status: Active -> Inactive
  Sessions affected: 3 (will expire within 7 days)
  Share links affected: 1 (invalidated by deactivation)
  
  Page files remain in:
  src/app/(portal)/client/whzan/
════════════════════════════════════════
```

### Step 5: Explain what happens next

After the confirmation box, provide a brief explanation of the consequences:

- "The portal URL will return a 'not found' page for any new visitors."
- "Clients with active sessions can still access the portal until their session expires (up to 7 days)."
- "The page files (`page.tsx`, `*-client.tsx`) remain in the codebase. You can delete them from git manually if you want to clean up, or leave them for potential reactivation."

Note: "The deactivation takes effect immediately -- no redeployment needed. The app checks the `isActive` flag at request time."

### Step 6: Suggest next actions

Depending on context:

- "To reactivate this portal later, update the database record: set `isActive` to `true` on the ClientPortal with slug '<slug>'."
- "To permanently remove the page files: `git rm -r src/app/(portal)/client/<slug>/` and commit."
- "To see your remaining portals: /portal list"

## What Deactivation Does NOT Do

Be explicit about what this skill does not touch:

1. **Does not delete database records.** The `ClientPortal` row, credentials, and analytics events are all preserved.
2. **Does not delete files.** The React components in `src/app/(portal)/client/<slug>/` remain in the codebase.
3. **Does not immediately terminate sessions.** Existing sessions expire on their natural schedule. The `isActive` check happens on new requests, but session tokens may still be valid for their remaining TTL.
4. **Does not notify the client.** There is no email or notification sent to the client. If the client needs to know, the user should communicate that separately.

## Edge Cases

- **Portal with active share link**: Deactivation invalidates the link because the portal is no longer active. If the portal should stay active but all tokens must be revoked, rotate credentials with `/portal credentials <slug>`.
- **Portal already inactive**: The script returns `already_inactive`. Do not treat this as an error -- just inform the user.
- **Last remaining portal**: No special handling. The user can deactivate their last portal. The organization continues to exist with zero active portals.

## Conventions

- Always confirm before executing. No exceptions.
- Use double-line box drawing (`═`) for the confirmation box.
- Show the file path where page files remain so the user knows where to look if they want to clean up.
- Do not suggest automatic file deletion. Let the user decide whether to keep or remove the source files.
- If learnings indicate the user has previously reactivated a portal, emphasize the reversibility more prominently.

## Error Handling

- If the preamble fails, stop and display the error.
- If the portal is not found, suggest `/portal list` to verify the slug.
- If the database operation fails, show the error from stderr. Common cause: database connection issues.
- If the user cancels, acknowledge cleanly and stop. Do not ask again.

## Reactivation

Deactivation is reversible. To reactivate a portal, you have two options:

**Option 1: Direct database update.** Run a query against the database to set `isActive` back to `true`:

```bash
cd $APP_PATH && npx tsx -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.clientPortal.update({
    where: { slug_organizationId: { slug: '<slug>', organizationId: '<org_id>' } },
    data: { isActive: true }
  }).then(console.log).finally(() => prisma.\$disconnect());
"
```

This is intentionally manual. There is no `/portal reactivate` skill in v1. Reactivation should be a deliberate choice, not a casual undo.

**Option 2: Re-create the portal.** If the page files were deleted from git after deactivation, the simplest path is to run `/portal create <slug>` again. This creates new page files and a new database record. The old analytics data is tied to the old record and will not carry over.

## Audit Trail

The delete operation updates the database record but does not create an explicit audit log entry. However, the state change is visible through:

- The `isActive` field on the `ClientPortal` record (false after deactivation)
- The `updatedAt` timestamp on the record (set to the deactivation time)
- Git history if the user subsequently removes the page files

If learnings are enabled, the skill records the deactivation event:

```json
{"skill":"portal-delete","key":"deactivated","insight":"whzan deactivated on 2026-04-07","confidence":10,"ts":"2026-04-07T15:00:00Z"}
```

This helps other skills provide context. For example, `/portal status` can note when a portal was deactivated if the user asks about it.

## Bulk Deactivation

If the user wants to deactivate multiple portals at once, handle each one sequentially with a confirmation for each. Do not batch-deactivate without individual confirmation. Each portal represents a client relationship, and the user should consciously decide about each one.

If the user explicitly asks to "deactivate all portals" or "shut everything down", confirm once with the full list: "This will deactivate all 5 portals: whzan, acme, example, client-a, client-b. Are you sure?" Then execute them sequentially.

## Deactivation vs Credential Rotation

Two operations can revoke client access, and they serve different purposes:

- **Deactivation** (this skill): Removes the portal entirely from client view. New visitors see "not found". Existing sessions and share links stop working because the portal is inactive. Use when the client relationship has ended or the portal is no longer needed.
- **Credential rotation** (`/portal credentials`): Changes the password and invalidates all tokens (sessions + share links). The portal remains active and accessible. Use when credentials may be compromised but the portal should stay live.

If the user wants to immediately revoke all access AND deactivate, the sequence is: rotate credentials first (to kill existing sessions immediately), then deactivate (to prevent new logins).

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-delete","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Related Skills

- `/portal list` -- see all portals before deciding which to deactivate
- `/portal credentials` -- rotate credentials to immediately revoke all access (stronger than deactivate)
- `/portal status` -- check portal health to identify candidates for deactivation
