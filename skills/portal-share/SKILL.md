---
name: portal-share
description: |
  Generate a time-limited share link for a client portal. Use when asked to "share portal",
  "send link", "generate share link", "share URL", or "create access link". (showpane)
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

This skill generates a signed, time-limited share link that allows a client to access their portal without entering a username and password. The link is useful for initial onboarding, sending to a client after a meeting, or providing access to someone who does not have the portal credentials.

Share links use HMAC-SHA256 signed tokens. The token encodes the portal slug, a share scope, an expiration time (default 24 hours), and the current credential version. If credentials are rotated after the link is generated, the link becomes invalid automatically -- this is by design.

## Steps

### Step 1: Identify the target portal

The user must specify which portal to share. If no slug is provided, ask: "Which portal do you want to share? Run /portal list to see your portals."

Do not proceed without a slug. Share links are portal-specific.

### Step 2: Generate the share link

Run the share link generator:

```bash
cd $APP_PATH && npx tsx $SKILL_DIR/bin/generate-share-link.ts --slug <slug> --org-id <org_id>
```

The script reads AUTH_SECRET from the app's `.env` file (sourced by the preamble) and uses the `signShareToken` function from the app's `client-auth.ts` module. It constructs a full URL using NEXT_PUBLIC_APP_URL (also from `.env`).

Expected success response:

```json
{
  "ok": true,
  "shareUrl": "https://portal.example.com/client/whzan/s/eyJ...",
  "expiresIn": "24h",
  "expiresAt": "2026-04-08T14:30:00Z"
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
  Expires: 24 hours (8 Apr 2026 14:30)
════════════════════════════════════════
```

### Step 4: Provide usage guidance

After displaying the link, add this note:

"Send this link to the client. They can access the portal without logging in. The link expires in 24 hours. If you rotate the portal credentials before the link expires, it will be invalidated."

If the user has previously generated share links (check learnings for patterns), you can skip the explanation and just show the link.

## Security Considerations

Share links are a convenience feature with intentional security trade-offs:

- **24-hour expiry**: Links expire automatically. This limits the exposure window if a link is forwarded to unintended recipients.
- **Credential version binding**: Rotating credentials invalidates all outstanding share links. This is the revocation mechanism -- if a link is compromised, rotate credentials with `/portal credentials <slug>`.
- **Single portal scope**: Each link grants access to exactly one portal. A share link for "whzan" cannot be used to access "acme".
- **No re-use tracking**: The link can be used multiple times within the 24-hour window by anyone who has it. There is no per-user tracking on share links.

Do NOT log the share URL to learnings or telemetry. The URL contains the signed token which is an access credential. Print it to stdout only.

## Conventions

- Always display the full URL, never truncate or abbreviate it. The user needs to copy-paste it.
- Show both the relative expiry ("24 hours") and the absolute expiry time ("8 Apr 2026 14:30") so the user knows exactly when access ends.
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
- `exp`: Unix timestamp when the token expires (24 hours from generation).
- `ver`: The credential version at time of signing. If credentials are rotated (bumping the version), this token becomes invalid even before expiry.
- `jti`: A random unique identifier for this specific token. Not currently used for revocation but available for future per-token revocation.

The signature is computed using AUTH_SECRET from the app's `.env`. If AUTH_SECRET changes (e.g., during a key rotation), all outstanding share links are invalidated.

## Workflow Patterns

Common patterns for using share links in practice:

**After a meeting**: Create the portal with `/portal create`, set up credentials with `/portal credentials`, then immediately generate a share link. Send the link in the follow-up email. The client can access the portal instantly without needing to remember a password.

**For quick reviews**: If a colleague or stakeholder needs to see the portal but should not have permanent credentials, a share link is ideal. It expires in 24 hours and does not create a persistent login.

**Re-sharing after content update**: If you update portal content with `/portal update` and want the client to see the changes, generate a fresh share link and send it. This is often easier than asking them to log in again.

## Learnings Integration

After generating a share link, consider recording a learning entry if this is the first time sharing this portal. The learning helps other skills (like `/portal analytics`) provide better context:

```json
{"skill":"portal-share","key":"share-event","insight":"whzan shared via link on 2026-04-07","confidence":10,"ts":"2026-04-07T14:30:00Z"}
```

Do not record the URL itself in learnings. Only record the fact that a share event occurred and when.

## Expiry Duration

The default expiry is 24 hours. This is not configurable in v1. The rationale:

- **Too short (1 hour)**: The client may not check their email in time. Creates support burden.
- **Too long (7 days)**: Increases the window of exposure if the link is forwarded to unintended recipients.
- **24 hours**: Long enough for the client to see the email and click through. Short enough that leaked links expire quickly.

If the user asks for a custom expiry, explain: "Share links expire in 24 hours (not configurable in this version). For permanent access, share the username and password from /portal credentials instead."

Future versions may support custom expiry via a `--expires` flag.

## Multiple Share Links

Generating a new share link does not invalidate the previous one. Both links remain valid until they expire or credentials are rotated. This means the user can safely generate multiple links for the same portal (e.g., one for the client contact, one for their colleague) without affecting each other.

If the user wants to revoke all outstanding share links immediately, the mechanism is credential rotation: `/portal credentials <slug>`. This bumps the credential version, which invalidates all tokens signed against the previous version.

## Related Skills

- `/portal credentials` -- set up or rotate credentials (required before sharing)
- `/portal preview` -- open the portal locally to verify content before sharing
- `/portal analytics` -- check engagement after sharing to see if the client accessed the portal
