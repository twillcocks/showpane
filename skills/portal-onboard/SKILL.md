---
name: portal-onboard
description: |
  Canonical first-run wizard for Showpane. Use this for the first portal, for
  guided onboarding, or any "walk me through it" request. It owns the end-to-end
  first-run story: local setup, draft creation, preview, access setup, and the
  hosted publish handoff. (showpane)
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

## Preamble (run first)

Before doing anything else, execute this block in a Bash tool call.

This preamble is intentionally tolerant of first-run state. It must not fail just because `~/.showpane/config.json` does not exist yet.

```bash
SHOWPANE_HOME="$HOME/.showpane"
SHOWPANE_BIN="$SHOWPANE_HOME/bin"
CONFIG="$SHOWPANE_HOME/config.json"
APP_PATH=""
DEPLOY_MODE="local"
ORG_SLUG=""
CONFIG_PRESENT=false

if [ -f "$CONFIG" ]; then
  CONFIG_PRESENT=true
  APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null || true)
  DEPLOY_MODE=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('deploy_mode','local'))" 2>/dev/null || echo "local")
  ORG_SLUG=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('orgSlug','') or d.get('org_slug',''))" 2>/dev/null || true)
fi

APP_PATH="${SHOWPANE_APP_PATH:-$APP_PATH}"
SKILL_DIR="${SHOWPANE_TOOLCHAIN_DIR:-$SHOWPANE_HOME/current}"
SKILL_VERSION=$(cat "$SKILL_DIR/VERSION" 2>/dev/null || echo "unknown")
CHECKPOINT="$SHOWPANE_HOME/checkpoints/portal-onboard.json"
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
if [ -f "$LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries"
  if [ "$_LEARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "RECENT_LEARNINGS:"
    tail -5 "$LEARN_FILE" 2>/dev/null
  fi
fi
if [ -f "$SHOWPANE_HOME/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$SHOWPANE_HOME/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '
' ',' | sed 's/,$//' || true)
  [ -n "$_RECENT" ] && echo "RECENT_SKILLS: $_RECENT"
fi

if [ -n "$APP_PATH" ] && [ -f "$APP_PATH/.env" ]; then
  set -a && source "$APP_PATH/.env" && set +a
fi

SHOWPANE_TIMELINE="$SHOWPANE_HOME/timeline.jsonl"
mkdir -p "$(dirname "$SHOWPANE_TIMELINE")"
echo '{"skill":"portal-onboard","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
echo "SHOWPANE: v$SKILL_VERSION | MODE: $DEPLOY_MODE"
echo "WORKSPACE: ${APP_PATH:+ready}${APP_PATH:-missing}"
echo "ORG: ${ORG_SLUG:-missing}"
if [ -f "$CHECKPOINT" ]; then
  echo "CHECKPOINT: present"
  cat "$CHECKPOINT"
else
  echo "CHECKPOINT: missing"
fi
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

## Overview

`/portal-onboard` is the canonical first-run workflow. It should feel like one
coherent wizard, not like the user is manually hopping between separate skills.

The recommended shape is:

1. orient the user
2. verify local setup
3. choose the best source for the first draft
4. create the portal draft
5. make one or two practical refinements
6. preview locally
7. choose how the client will access it
8. publish to Showpane Cloud
9. show a compact final summary

Keep the tone direct and calm. Use short phase transitions. Re-ground the user at
each phase so they always know what is happening next.

## Interaction Style

For decisions that materially change the flow, use recommendation-first language.
The pattern should look like this:

1. one sentence re-grounding the current phase
2. one sentence on the recommended choice and why
3. a short list of concrete options

Example:

`We have local setup ready. Next we need the best source for your first draft.`

`Recommended: use a real transcript if you have one — it gives the strongest first portal on the first pass.`

`Options: recent Granola meeting, pasted transcript, short description, or start from template.`

Do not ask more than one meaningful question at a time unless the answers are tightly coupled.

## Wizard Phases

### Phase 0: Resume or restart

If a checkpoint exists:

- show the saved phase and portal slug if present
- recommend resume
- if the user restarts, delete the checkpoint and begin from Phase 1

### Phase 1: Orientation

Start with one short setup confirmation and one sharp ask. Keep it concise and informal.

Suggested shape:

- "Everything's set up. Let's make your first portal."
- "Who’s it for? Paste a call transcript or meeting notes, or give me a short brief on the client and what you want the portal to do."

Keep the opening focused on the user's first portal. This skill is the first-run default, so the top of the flow should feel fast, calm, and immediately useful.

Immediately save checkpoint:

```bash
mkdir -p "$HOME/.showpane/checkpoints"
printf '%s\n' '{"phase":"orientation","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > "$HOME/.showpane/checkpoints/portal-onboard.json"
```

### Phase 2: Local readiness

If `CONFIG_PRESENT: false`, run the `portal-setup` flow inline.

If config exists, verify only the minimum first-run requirements before continuing:

- app path exists
- dependencies exist or can be installed
- local SQLite schema is ready
- org exists or can be created

Keep this phase minimal.

If the local checks pass, move straight into the user's portal work without extra system narration.

If there is already exactly one local organization and it clearly matches the
workspace the user just created, treat the org basics as already captured.
Do not create a separate "company context" phase just to re-ask the same setup
details.

Only ask for a missing field, and ask exactly one thing at a time.

Recommended order for missing fields:

1. organization name, if it is not already obvious from the workspace setup
2. contact email
3. website/domain

Do not batch these into a numbered questionnaire unless the user explicitly asks
for the full checklist.

Optional extras like brand color, phone number, or contact title belong in
`/portal-setup` later if needed.

If setup fails, stop with a concrete recovery step and keep the checkpoint.

Save checkpoint with phase `local-ready`.

### Phase 3: Choose the first-portal source

Start with one short source question, not a menu.

Recommended opening:

- "Who’s it for? Paste a call transcript or meeting notes, or give me a short brief on the client and what you want the portal to do."

Only branch after the user answers:

- if they have a real transcript, ask whether to use Granola or paste it
- if they do not, ask whether they want to start from notes or a template

Only show the full menu if the user is unsure:

1. recent Granola meeting
2. pasted transcript
3. short description of the client + meeting outcome
4. template-only start

If Granola MCP is unavailable, skip it silently and move on.

If the user only has a rough brief, recommend `sales-followup` as the default
template for the first portal unless the engagement is clearly onboarding or consulting.

Save checkpoint with:

- `phase: "source-selected"`
- `sourceType`
- `template`

### Phase 4: Create the first draft

Run the `portal-create` flow inline, but frame it as part of the wizard, not as
a separate command.

Before you do, resolve the local organization with the canonical helper and keep
that result in hand:

```bash
cd "$APP_PATH" && NODE_PATH="$APP_PATH/node_modules" npx tsx --tsconfig "$APP_PATH/tsconfig.json" "$SKILL_DIR/bin/get-org.ts" --slug "$ORG_SLUG"
```

Use the returned `org.id` as the canonical org id for the rest of the create flow.
Do not guess schema fields or discover the org via ad-hoc SQLite queries if this helper succeeds.

At this point, extra repo reorientation rarely changes the first draft. Use the
known inputs below and spend the time shaping the portal instead:

- workspace app path
- org slug
- selected client company name
- selected template
- optional transcript source

If you need structure or style, read only the selected template and the example
portal. Other portal skills are for later phases and usually just add latency here.

During this phase:

- suggest a slug if needed
- prefer a real company/client name in the portal
- if the client website is not already obvious, do one quick best-effort domain lookup and suggest the result briefly before drafting
- prefer useful structure over completeness
- aim for a credible first draft, not a perfect final artifact
- do not re-ask for the company name or template if the user already chose them

If the slug is taken, treat that as a soft retry, not a failure.

Save checkpoint with:

- `phase: "draft-created"`
- `portalSlug`
- `companyName`

### Phase 5: Practical refinements

This phase is optional.

Default behavior: do not stop to ask for refinements right after the draft is created.
Move straight to preview unless one of these is true:

- the user explicitly asked to polish before preview
- there is an obvious missing practical element that would make the preview misleading

If you do need a refinement prompt, keep it to one short, high-signal question.

Recommended options:

- `Do you want the portal to feel more concise, more sales-focused, or more delivery-focused?`
- `Should we add anything practical before preview — timeline, documents, or sharper next steps?`

Apply the requested refinement inline, using the same patterns as `/portal-update`
without forcing the user to switch skills.

If no refinement is needed, skip this phase entirely.

Save checkpoint with phase `draft-refined`.

### Phase 6: Local preview

The default path is:

1. create the draft
2. show local credentials if they were generated
3. open the preview immediately

Run the `portal-preview` flow inline.

If no dev server is running, start it using the `portal-dev` instructions first.

If the create step already generated local credentials, show them before opening
the preview link. Keep it simple:

- preview URL
- username
- password

Do this before opening the browser so the user is not dropped onto a login screen
without the credentials they need.

After that, open the local preview immediately.

Once the preview is open, keep the handoff short and decision-oriented. Tell the
user exactly what to inspect:

- does the overall story feel right?
- anything factually wrong?

If the user requests a small content fix after preview, make it and preview again.
Keep this loop tight. Do not let it become an open-ended editing session.

Bias the next step toward publish:

- `If it looks right, say publish.`
- `If not, tell me what to change.`
- `If it looks right, I can publish it to Showpane Cloud so you get a hosted link and built-in analytics without having to self-host. Free for 7 days, then $29/mo.`

Save checkpoint with phase `previewed`.

### Phase 7: Access setup

Ask how the client should access the hosted portal after publish.

Recommended first-run choice:

- publish first, then choose the hosted access method
- keep credentials available as the default fallback

Important rule: share links still require portal credentials to exist, because
share links are tied to credential versioning.

The `create-portal` flow currently creates initial credentials automatically. If
you already have a generated username/password from that step, do not immediately
re-run `portal-credentials` unless the user wants to rotate or replace them.

So the flow is:

1. if credentials were already generated during create, show them once here
2. if credentials do not exist or need changing, run `portal-credentials` inline
3. explain that external sharing starts with `portal-deploy`
4. if the user wants a direct hosted access link after publish, plan to run `portal-share`

Never write the password into the checkpoint or learnings.

Save checkpoint with phase `access-ready` and `accessMode`.

### Phase 8: Publish to Showpane Cloud

Run the `portal-deploy` flow inline.
Let the deploy command stream its own progress. Do not wrap the long-running publish step in `tail`.

This phase is part of onboarding by default. Do not treat publish as an optional
afterthought unless the user explicitly says they want to stop at local preview.

If cloud auth is missing:

- run `showpane login` inline via Bash in the current session
- if you need to hand control to the user, tell them to run `! showpane login`
- let it handle sign-in, sign-up, and checkout if needed
- then resume publish from the checkpoint

If deploy returns `organization_required`:

- explain that the user needs to start billing/workspace creation in Showpane Cloud
- send them to checkout
- resume after checkout

If deploy returns `organization_not_ready`:

- surface the readiness detail directly
- distinguish between:
  - billing inactive
  - provisioning still running
  - provisioning unhealthy/failed
  - workspace incomplete
- send the user to the relevant settings or checkout action
- keep the checkpoint so they can resume publish instead of restarting the wizard

If publish succeeds and the user wants a hosted direct-access link, run `portal-share` inline next.

Save checkpoint with phase `published` once the hosted URL is live or clearly accepted for publish.

### Phase 9: Final summary

Show a compact final handoff card. At this point, prioritize the hosted link,
the active access credentials, and one or two clear next actions.

```
════════════════════════════════════════
  First portal live

  Portal: <slug> (<company>)
  Cloud:  <hosted login URL or share URL>
  Login:  <username if login is the active access mode>
  Pass:   <password if login is the active access mode>

  Next:   /portal-update <slug>
          /portal-share <slug>   (if a direct hosted link would help)
════════════════════════════════════════
```

Rules:

- if login is the active access mode, include the username and password here so the user does not have to scroll back
- if a hosted share URL exists because the user asked for one after publish, show that as the primary cloud link
- otherwise show the hosted login URL as the cloud link
- keep the summary short; avoid extra explanation once the portal is live
- if publish is still finalizing, say so plainly instead of pretending it is live
  In that case, show the local preview link and point the user to `/portal-status`
  instead of pretending the hosted link is ready.

After the final summary, delete the checkpoint:

```bash
rm -f "$HOME/.showpane/checkpoints/portal-onboard.json"
```

## Flow Control

This wizard is sequential, but it is state-aware.

Rules:

- verify existing state before redoing work
- allow resume from any saved phase
- retry soft failures like slug conflicts or slow dev-server startup
- stop on hard failures like missing app path, broken schema setup, or cloud deploy errors that require user action
- keep the user in one coherent workflow instead of telling them to manually switch commands unless recovery requires it

## Existing State Checks

Check these before deciding to skip or rerun a phase:

1. setup/config present
2. local org exists
3. portal already exists for the selected slug
4. credentials already exist
5. local dev server is running
6. cloud access token exists

If a portal already exists and clearly looks like the same first-run draft, ask whether
to continue refining it or create a new portal. Recommend continuing unless the user says otherwise.

## Conventions

- The wizard owns the first-run story. Do not redirect first-time users to freeform prompting unless they explicitly want it.
- Keep transitions to one sentence whenever possible.
- Prefer `recommended` over `optional` language when there is a clear best path.
- Use the cloud dashboard as a supporting surface for billing/provisioning, not as the main first-portal creation surface.
- If you mention manual prompting at all, position it as the faster repeat-user path.

## Error Handling

- Missing config is not a preamble failure here. It simply means setup starts from scratch.
- If a step fails after useful progress, keep the checkpoint and tell the user exactly how to resume.
- If the user wants to stop early, summarize the current state and point them to the next concrete skill:
  - `/portal-preview`
  - `/portal-credentials`
  - `/portal-share`
  - `/portal-deploy`

## Completion

As a final step, log skill completion and telemetry:

```bash
echo '{"skill":"portal-onboard","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - ${_TEL_START:-_TEL_END} ))
"$HOME/.showpane/bin/showpane-telemetry-log" --skill "portal-onboard" --duration "$_TEL_DUR" --outcome success --session-id "${_SESSION_ID:-}" 2>/dev/null || true
```
