# Showpane

Generate professional client portals in minutes using Claude Code.

## Quick Start

```bash
npx showpane
```

That's it. One command sets up everything: SQLite database, dependencies, dev server. Your browser opens to a welcome page that teaches you the next step.

Then in Claude Code:

```
Create a portal for my call with Acme Health
```

Claude Code creates a branded portal with meeting notes, next steps, and documents. Preview it at `localhost:3000/client/acme-health`.

## How It Works

1. **`npx showpane`** — Installs locally with SQLite (zero config)
2. **Claude Code skills** — 14 slash commands for creating, managing, and deploying portals
3. **`/portal deploy`** — Self-host with Docker (free) or upgrade to Showpane Cloud ($29/mo)

Each client gets a bespoke React page. Claude Code IS the content editor. No CMS, no admin dashboard. The skill pack teaches Claude the portal conventions and Claude generates custom content for each client.

## Skills

Managed via Claude Code slash commands:

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
| `/portal share <slug>` | Generate a 24h share link |
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

For production deployment on your own infrastructure:

```bash
cd app
cp .env.example .env
# Edit .env — set DATABASE_URL (PostgreSQL) and AUTH_SECRET

AUTH_SECRET=$(openssl rand -base64 32) docker compose up -d
docker compose exec portal npx prisma migrate deploy
docker compose exec portal npx prisma db seed
```

Visit http://localhost:8080 and log in with `example` / `demo123`.

## Development

```bash
cd app
npm install
cp .env.example .env
# For local dev: DATABASE_URL="file:./dev.db" (SQLite)
# For production: DATABASE_URL="postgresql://..." (PostgreSQL)

npx prisma migrate dev
npm run dev
```

## Architecture

- **Next.js 15** with App Router
- **Prisma** with SQLite (local dev) or PostgreSQL (production)
- **HMAC-SHA256** stateless auth via Web Crypto
- **Docker Compose** for self-hosted deployment
- **Claude Code skill pack** for portal management

## Project Structure

```
showpane/
├── packages/cli/    — npx showpane installer
├── skills/          — 14 SKILL.md files (Claude Code slash commands)
├── bin/             — TypeScript utility scripts (DB operations)
├── templates/       — Portal reference implementations
├── app/             — Next.js portal application
├── setup            — Manual installation script
└── DESIGN.md        — Design system tokens and patterns
```

## License

- **App** (AGPL-3.0) — Portal application, Prisma schema, Docker setup
- **Skills** (MIT) — SKILL.md files, open distribution
