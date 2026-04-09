# Showpane

Generate professional client portals in minutes using Claude Code.

## Quick Start

```bash
npx showpane
```

One command sets up everything: SQLite database, dependencies, dev server. Your browser opens to a welcome page that teaches you the next step.

Then open the generated project:

```bash
cd showpane-<your-company-slug>
claude
```

Then in Claude Code:

```
Create a portal for my call with Acme Health
```

Claude Code creates a branded portal with meeting notes, next steps, and documents. Preview it at `localhost:3000/client/acme-health`.

## Two Modes

### Self-Hosted (Free)
Run on your own infrastructure. Unlimited portals, single operator.

```bash
npx showpane           # Local dev with SQLite
cd showpane-<your-company-slug>
docker compose up -d   # Production with PostgreSQL + Caddy
```

### Showpane Cloud ($29/mo)
Hosted at `orgname.showpane.com` with engagement intelligence.

```
claude /portal deploy   # Choose "Cloud" when prompted
```

**Cloud includes:** Real-time activity feed, visitor tracking, per-section time analytics, email alerts, team access (multiple operators), 1-year analytics retention.
The local app builds the portal, then Showpane Cloud publishes it on your behalf. OSS does not need to reason about Vercel projects directly.

## Skills

14 Claude Code slash commands for portal management:

| Command | Description |
|---------|-------------|
| `/portal onboard` | Guided first-run experience |
| `/portal create <slug>` | Scaffold a new portal (supports Granola transcripts) |
| `/portal update <slug>` | Edit portal content via natural language |
| `/portal credentials <slug>` | Create or rotate login credentials |
| `/portal deploy` | Deploy (Docker or Showpane Cloud) |
| `/portal dev` | Start local dev server |
| `/portal preview [slug]` | Open portal in browser |
| `/portal analytics [slug]` | View engagement data |
| `/portal share <slug>` | Generate a reusable share link |
| `/portal list` | List all portals |
| `/portal status` | Dashboard with health scores |
| `/portal delete <slug>` | Deactivate a portal |
| `/portal setup` | Interactive setup wizard |
| `/portal upgrade` | Update to latest version |

## Templates

Three portal templates for common use cases:

- **Sales follow-up** — Meeting notes, next steps, documents
- **Consulting** — Project overview, deliverables, timeline
- **Onboarding** — Welcome, setup checklist, resources

Templates are reference implementations. `/portal create` reads them for inspiration and generates bespoke content tailored to each client.

## Self-Hosting with Docker

```bash
cd showpane-<your-company-slug>
cp .env.example .env
# Edit .env — set DATABASE_URL (PostgreSQL) and AUTH_SECRET

AUTH_SECRET=$(openssl rand -base64 32) docker compose up -d
docker compose exec portal npx prisma migrate deploy
docker compose exec portal npx prisma db seed
```

Visit http://localhost:8080 and log in with `example` / `demo-only-password`.

## Development (Repo)

```bash
cd app
npm install
cp .env.example .env
# DATABASE_URL="file:./dev.db" for local dev (SQLite)

npx prisma db push
npm run dev
```

## Architecture

- **Next.js 15** with App Router
- **Prisma** with PostgreSQL (canonical) or SQLite (local dev via `db push`)
- **HMAC-SHA256** stateless auth with org-scoped tokens
- **Docker Compose** for self-hosted deployment (PostgreSQL + Caddy)
- **Claude Code skill pack** for portal management
- **Intersection Observer** for per-section time tracking
- **First-party visitor cookie** (`sp_visitor`) for session-level analytics

## Project Structure

```
showpane/
├── app/             — Next.js portal application (OSS)
├── platform/        — Showpane Cloud (app.showpane.com)
├── packages/cli/    — npx showpane installer
├── skills/          — 14 SKILL.md files (Claude Code slash commands)
├── bin/             — TypeScript utility scripts (DB operations)
├── templates/       — Portal reference implementations
├── setup            — Manual installation script
└── DESIGN.md        — Design system tokens and patterns
```

### Cloud Platform (`platform/`)

The hosted platform at app.showpane.com. Separate Next.js app with:

- **Clerk** auth (signup/login/team management)
- **Stripe** billing ($29/mo flat, 7-day trial)
- **Supabase** PostgreSQL with RLS
- **Vercel Platforms API** behind the Showpane Cloud control plane for portal provisioning and hosted publish
- **Resend** for email alerts
- Engagement dashboard with real-time activity feed
- CLI device auth for `./setup --cloud`

## License

- **App** (AGPL-3.0) — Portal application, Prisma schema, Docker setup
- **Skills** (MIT) — SKILL.md files, open distribution
