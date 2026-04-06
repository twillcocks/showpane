# Showpane

Open-source client portal. Deploy with Docker, manage with Claude Code.

## Quick Start

```bash
# Clone
git clone https://github.com/twillcocks/showpane.git
cd showpane/app

# Set up environment
cp .env.example .env
# Edit .env — set AUTH_SECRET (openssl rand -base64 32)

# Start with Docker
AUTH_SECRET=$(openssl rand -base64 32) docker compose up -d

# Run migrations and seed
docker compose exec portal npx prisma migrate deploy
docker compose exec portal npx prisma db seed
```

Visit http://localhost and log in with `example` / `demo123`.

## Development

```bash
cd app
npm install
cp .env.example .env
# Set DATABASE_URL to a local Postgres instance
# Set AUTH_SECRET

npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Creating a Portal

Each client gets a React page at `src/app/(portal)/client/<slug>/`:

```
src/app/(portal)/client/acme/
  page.tsx          — Server component
  acme-client.tsx   — Client component with PortalShell
```

See `src/app/(portal)/client/example/` for a reference implementation.

After creating the page, add credentials:

```sql
-- Via prisma studio or direct SQL
INSERT INTO "ClientPortal" (id, "organizationId", slug, "companyName", username, "passwordHash", "credentialVersion")
VALUES (gen_random_uuid(), '<org-id>', 'acme', 'Acme Corp', 'acme', '<bcrypt-hash>', gen_random_uuid());
```

## Architecture

- **Next.js 15** with App Router
- **Prisma** with PostgreSQL
- **HMAC-SHA256** stateless auth (no session store)
- **Caddy** reverse proxy with automatic HTTPS
- **Docker Compose** for self-hosted deployment

## License

AGPL-3.0 — see [LICENSE](LICENSE)
