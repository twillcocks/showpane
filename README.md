# Showpane

Generate professional client portals in minutes using Claude Code.

## Current Versions

- **Workspace/toolchain:** `1.1.8`
- **App scaffold:** `0.2.7`
- **Skill pack:** `1.1.7`
- **npm CLI:** `0.4.29`

## Quick Start

```bash
npx showpane
```

One command sets up everything: SQLite database, dependencies, and the local dev server. Your browser opens to a welcome page that teaches you the next step.

Then open a new terminal, move into the generated project, and start Claude there:

```bash
cd showpane-<your-company-slug>
showpane claude
```

If `showpane` is not on your `PATH` yet, use `npx showpane claude` instead.

Then in Claude Code, the recommended first-run path is:

```
/portal-onboard
```

Manual prompting still works if you already know what you want:

```
Create a portal for my call with Acme Health
```

Claude Code creates a branded portal with meeting notes, next steps, and documents. Preview it at `localhost:3000/client/acme-health`.

## Supported Workflow

### Local Workspace
Write and preview portals locally with zero-config SQLite.

```bash
npx showpane
```

### Showpane Cloud ($29/mo)
Hosted at `orgname.showpane.com` with engagement intelligence.

Authenticate once:

```bash
showpane login
```

Then publish from Claude Code:

```
/portal-deploy
```

Or publish from the workspace shell:

```bash
showpane deploy --wait
```

**Cloud includes:** Hosted activity feed, visitor tracking, per-section time analytics, email alerts, and team access for multiple operators.
The local app builds the portal, then Showpane Cloud publishes it on your behalf. OSS does not need to reason about provider projects directly.

## Skills

14 Claude Code slash commands for portal management:

| Command | Description |
|---------|-------------|
| `/portal-onboard` | Guided first-run experience |
| `/portal-create <slug>` | Scaffold a new portal (supports Granola transcripts) |
| `/portal-update <slug>` | Edit portal content via natural language |
| `/portal-credentials <slug>` | Create or rotate login credentials |
| `/portal-deploy` | Publish to Showpane Cloud |
| `/portal-dev` | Start local dev server |
| `/portal-preview [slug]` | Open portal in browser |
| `/portal-analytics [slug]` | View engagement data |
| `/portal-share <slug>` | Generate a reusable share link |
| `/portal-list` | List all portals |
| `/portal-status` | Dashboard with health scores |
| `/portal-delete <slug>` | Deactivate a portal |
| `/portal-setup` | Interactive setup wizard |
| `/portal-upgrade` | Update to latest version |

## Templates

Three portal templates for common use cases:

- **Sales follow-up** — Meeting notes, next steps, documents
- **Consulting** — Project overview, deliverables, timeline
- **Onboarding** — Welcome, setup checklist, resources

Templates are reference implementations. `/portal-create` reads them for inspiration and generates bespoke content tailored to each client.

## Development

### Repo Setup

Install the local repo toolchain and Claude skills from this checkout:

```bash
./setup
```

For the cloud-auth bootstrap path from the repo checkout:

```bash
./setup --cloud
```

### App Development

```bash
cd app
npm install
cp .env.example .env
# DATABASE_URL="file:./dev.db" for local dev (SQLite)

npm run prisma:db-push
npm run dev
```

Bare Prisma CLI commands in `app/` follow `DATABASE_URL`. The supported local workflow keeps this on SQLite.

### CLI Development

```bash
cd packages/cli
npm install
npm run build
npm test
```

## Architecture

- **Next.js 15** with App Router
- **Prisma** with SQLite for the supported local workspace flow
- **HMAC-SHA256** stateless auth with org-scoped tokens
- **Runtime snapshot + control plane** for hosted publish handoff
- **Claude Code skill pack** for portal management
- **Intersection Observer** for per-section time tracking
- **First-party visitor cookie** (`sp_visitor`) for session-level analytics

## Project Structure

```
showpane/
├── app/             — Next.js portal application (OSS)
├── packages/cli/    — npx showpane installer
├── packages/portal-contracts/ — shared portal/cloud contract types
├── skills/          — 14 SKILL.md files (Claude Code slash commands)
├── bin/             — TypeScript utility scripts (DB operations)
├── templates/       — Portal reference implementations
├── scripts/         — repo maintenance scripts
├── setup            — repo-local setup/bootstrap script
└── DESIGN.md        — Design system tokens and patterns
```

### Showpane Cloud

The hosted platform at app.showpane.com lives in the separate `showpane-cloud` repo and includes:

- **Clerk** auth (signup/login/team management)
- **Stripe** billing ($29/mo flat, 7-day trial)
- **Supabase** PostgreSQL with RLS
- **Provider provisioning APIs** behind the Showpane Cloud control plane for portal provisioning and hosted publish
- **Resend** for email alerts
- Engagement dashboard with real-time activity feed
- CLI device auth for `./setup --cloud`

## Self-Hosting

`showpane deploy` targets Showpane Cloud. Self-hosting the OSS app is possible, but it is an advanced manual path rather than a supported first-run workflow. See [SELF_HOSTING_COMMUNITY.md](SELF_HOSTING_COMMUNITY.md).

## License

This repository is currently licensed under **AGPL-3.0**. See [LICENSE](LICENSE).
