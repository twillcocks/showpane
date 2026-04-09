---
name: portal-share
description: |
  Generate a reusable secure share link for a client portal. Use when asked to "share portal",
  "send link", "generate share link", "share URL", or "create access link". (showpane)
allowed-tools: [Bash, Read]
---

If the user asks for broader share-link capabilities than Showpane supports, read
`skills/shared/platform-constraints.md` and apply the relevant limits.

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
echo '{"skill":"portal-share","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
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

This skill generates a signed share link that allows a client to access their portal without entering a username and password. The link is useful for initial onboarding, sending to a client after a meeting, or providing access to someone who does not have the portal credentials.

Share links use HMAC-SHA256 signed tokens. The token encodes the portal slug, a share scope, and the current credential version. Share links do not expire automatically. If credentials are rotated after the link is generated, the link becomes invalid automatically -- this is by design.

## Steps

### Step 1: Identify the target portal

The user must specify which portal to share. If no slug is provided, ask: "Which portal do you want to share? Run /portal list to see your portals."

Do not proceed without a slug. Share links are portal-specific.

### Step 2: Generate the share link

Run the share link generator:

```bash
cd $APP_PATH && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig $APP_PATH/tsconfig.json $SKILL_DIR/bin/generate-share-link.ts --slug <slug> --org-id <org_id>
```

The script reads AUTH_SECRET from the app's `.env` file (sourced by the preamble) and uses the `signShareToken` function from the app's `client-auth.ts` module. It constructs a full URL using NEXT_PUBLIC_APP_URL (also from `.env`).

Expected success response:

```json
{
  "ok": true,
  "shareUrl": "https://portal.example.com/client/whzan/s/eyJ...",
  "expiresIn": "never"
}
```

Expected error responses:

- `portal_not_found`: The slug does not exist. Suggest `/portal list`.
- `no_credentials`: The portal has no credentials set up. Share links require credentials because the token's validity is tied to the credential version. Suggest running `/portal credentials <slug>` first.
- `no_auth_secret`: AUTH_SECRET is not set in the app's `.env`. The user needs to add one. Suggest: `openssl rand -base64 32` to generate a secret.
- `no_app_url`: NEXT_PUBLIC_APP_URL is not set. The script cannot construct the full share URL. Ask the user what their portal's public URL is.

### Step 3: Display the share link

Present the link in a clear, copy-friendly ASCII box:

```
════════════════════════════════════════
  Share link for: whzan
  https://portal.example.com/client/whzan/s/eyJ...
  Expires: never (until credentials rotate)
════════════════════════════════════════
```

### Step 4: Provide usage guidance

After displaying the link, add this note:

"Send this link to the client. They can access the portal without logging in. The link stays valid until the portal credentials are rotated or the portal is deactivated."

If the user has previously generated share links (check learnings for patterns), you can skip the explanation and just show the link.

## Security Considerations

Share links are a convenience feature with intentional security trade-offs:

- **No automatic expiry**: Links remain valid until credentials are rotated, the portal is deactivated, or AUTH_SECRET changes.
- **Credential version binding**: Rotating credentials invalidates all outstanding share links. This is the revocation mechanism -- if a link is compromised, rotate credentials with `/portal credentials <slug>`.
- **Single portal scope**: Each link grants access to exactly one portal. A share link for "whzan" cannot be used to access "acme".
- **No re-use tracking**: The link can be used multiple times by anyone who has it. There is no per-user tracking on share links.

Do NOT log the share URL to learnings or telemetry. The URL contains the signed token which is an access credential. Print it to stdout only.

## Conventions

- Always display the full URL, never truncate or abbreviate it. The user needs to copy-paste it.
- Make it clear that the link does not expire automatically and is revoked by credential rotation or portal deactivation.
- Use double-line box drawing (`═`) for the border around the link.
- If NEXT_PUBLIC_APP_URL is `http://localhost:3000`, warn the user: "This is a local development URL. The client won't be able to access it remotely. Deploy the app first with /portal deploy, then generate the share link."
- If the deploy mode is `docker` and the URL looks like localhost, same warning applies.

## Error Handling

- If AUTH_SECRET is missing, this is a hard blocker. Explain that share links require a signing secret and provide the generation command: `openssl rand -base64 32`.
- If the portal has no credentials, explain that share links are tied to credential versions and the user needs to set up credentials first.
- If the script fails for any other reason, show the error message from stderr and suggest the user check their configuration with `/portal status`.

## Token Anatomy

For troubleshooting and understanding, here is what a share token contains. You do not need to decode tokens manually, but knowing the structure helps when debugging access issues.

The token is a base64url-encoded JSON payload with an HMAC-SHA256 signature appended:

```json
{
  "v": 1,
  "slug": "whzan",
  "scope": "share",
  "exp": 1712588400,
  "ver": 3,
  "jti": "random-unique-id"
}
```

Fields:
- `v`: Token format version. Always 1 for now.
- `slug`: The portal this token grants access to.
- `scope`: Always "share" for share links. Distinguishes from session tokens.
- `exp`: `null` for non-expiring share links.
- `ver`: The credential version at time of signing. If credentials are rotated (bumping the version), this token becomes invalid even before expiry.
- `jti`: A random unique identifier for this specific token. Not currently used for revocation but available for future per-token revocation.

The signature is computed using AUTH_SECRET from the app's `.env`. If AUTH_SECRET changes (e.g., during a key rotation), all outstanding share links are invalidated.

## Workflow Patterns

Common patterns for using share links in practice:

**After a meeting**: Create the portal with `/portal create`, set up credentials with `/portal credentials`, then immediately generate a share link. Send the link in the follow-up email. The client can access the portal instantly without needing to remember a password.

**For quick reviews**: If a colleague or stakeholder needs to see the portal but should not have permanent credentials, a share link is ideal. It can be reused and does not create a full operator login.

**Re-sharing after content update**: If you update portal content with `/portal update` and want the client to see the changes, generate a fresh share link and send it. This is often easier than asking them to log in again.

## Learnings Integration

After generating a share link, consider recording a learning entry if this is the first time sharing this portal. The learning helps other skills (like `/portal analytics`) provide better context:

```json
{"skill":"portal-share","key":"share-event","insight":"whzan shared via link on 2026-04-07","confidence":10,"ts":"2026-04-07T14:30:00Z"}
```

Do not record the URL itself in learnings. Only record the fact that a share event occurred and when.

## Expiry Duration

Share links do not expire automatically in this version.

The revocation mechanisms are:

- rotate credentials with `/portal credentials <slug>`
- deactivate the portal with `/portal delete <slug>`
- rotate `AUTH_SECRET`

## Multiple Share Links

Generating a new share link does not invalidate the previous one. Both links remain valid until credentials are rotated, the portal is deactivated, or AUTH_SECRET changes. This means the user can safely generate multiple links for the same portal (e.g., one for the client contact, one for their colleague) without affecting each other.

If the user wants to revoke all outstanding share links immediately, the mechanism is credential rotation: `/portal credentials <slug>`. This bumps the credential version, which invalidates all tokens signed against the previous version.

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-share","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Related Skills

- `/portal credentials` -- set up or rotate credentials (required before sharing)
- `/portal preview` -- open the portal locally to verify content before sharing
- `/portal analytics` -- check engagement after sharing to see if the client accessed the portal
