# Showpane

Open-source client portal. Deploy with Docker, manage with Claude Code.

## Install

```bash
git clone https://github.com/twillcocks/showpane.git
cd showpane
./setup
```

This installs the skill pack into `~/.claude/skills/showpane/` and sets up the app.

## Getting Started

The fastest way to get started is the guided onboarding:

```
/portal onboard
```

This walks you through: setup, creating your first portal, setting credentials, and previewing it.

Or do it step by step:

```
/portal setup          # Configure your deployment
/portal create acme    # Create a portal for Acme Corp
/portal credentials acme  # Set login credentials
/portal dev            # Start the dev server
/portal preview acme   # Open in browser
```

## Skills

Showpane is managed via Claude Code slash commands:

| Command | Description |
|---------|-------------|
| `/portal setup` | Interactive setup wizard |
| `/portal create <slug>` | Scaffold a new portal (supports Granola transcripts) |
| `/portal update <slug>` | Edit portal content via natural language |
| `/portal credentials <slug>` | Create or rotate login credentials |
| `/portal deploy` | Deploy (Docker or Vercel) |
| `/portal dev` | Start local dev server |
| `/portal preview [slug]` | Open portal in browser |
| `/portal analytics [slug]` | View portal activity and engagement |
| `/portal share <slug>` | Generate a 24h share link |
| `/portal list` | List all portals |
| `/portal status` | Dashboard with health scores |
| `/portal delete <slug>` | Deactivate a portal |
| `/portal onboard` | Guided first-run experience |
| `/portal upgrade` | Update to latest version |

## Templates

Three portal templates for common use cases:

- **Sales follow-up** — Meeting notes, next steps, documents
- **Consulting** — Project overview, deliverables, timeline
- **Onboarding** — Welcome, setup checklist, resources

Templates are reference implementations. `/portal create` reads them for inspiration and generates bespoke content tailored to each client.

## Docker Quick Start

```bash
cd app
cp .env.example .env
# Edit .env — set AUTH_SECRET (openssl rand -base64 32)

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
# Set DATABASE_URL and AUTH_SECRET

npx prisma migrate dev
npx prisma db seed
npm run dev
```

## How It Works

Each client gets a bespoke React page at `src/app/(portal)/client/<slug>/`:

```
src/app/(portal)/client/acme/
  page.tsx          — Server component
  acme-client.tsx   — Client component with PortalShell
```

Claude Code IS the content editor. The skill pack teaches Claude Code the conventions (PortalShell component, tab structure, content patterns) and Claude generates custom content for each client. No CMS, no admin dashboard.

Mechanical operations (DB records, credential hashing, analytics queries) are handled by tested TypeScript scripts in `bin/`. Creative operations (portal content, tab structure, meeting notes) are handled by Claude Code following the skill instructions.

## Architecture

- **Next.js 15** with App Router
- **Prisma** with PostgreSQL
- **HMAC-SHA256** stateless auth via Web Crypto
- **Caddy** reverse proxy with automatic HTTPS
- **Docker Compose** for self-hosted deployment
- **Claude Code skill pack** for portal management

## Project Structure

```
showpane/
├── skills/          — 14 SKILL.md files (Claude Code slash commands)
├── bin/             — TypeScript utility scripts (DB operations)
├── templates/       — Portal reference implementations
├── app/             — Next.js portal application
├── setup            — Installation script
└── packages/ee/     — Future commercial features
```

## License

- **App** (AGPL-3.0) — Portal application, Prisma schema, Docker setup
- **Skills** (MIT) — SKILL.md files, open distribution
- **EE** (proprietary) — Future commercial features in `packages/ee/`
