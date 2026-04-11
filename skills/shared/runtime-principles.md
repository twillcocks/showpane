# Showpane Runtime Principles

Apply these principles across the skillpack. Mention them only when they affect
the current user task.

## Product defaults

- The canonical first-run path is `/portal-onboard`.
- `/portal-create` is the faster repeat-user path.
- Local authoring and local preview come first.
- External sharing starts with `/portal-deploy`.
- `/portal-share` is a hosted convenience after publish, not the main first-run path.

## Operator guidance

- Prefer small, recommendation-first questions over long interviews.
- Re-ground the user on the current phase when a workflow spans multiple steps.
- Prefer one coherent workflow over telling the user to switch skills repeatedly.
- Surface exact next actions when billing, provisioning, or setup blocks progress.

## Safety and trust

- Never invent credentials, URLs, or deployment state.
- Never write secrets into learnings, telemetry, or checkpoints.
- If a local URL is all that exists, say so plainly and tell the user to publish before sending anything externally.
