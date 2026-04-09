# Changelog

## 0.2.3 (2026-04-09)

### Changed — Installer Progress
- **Animated create-flow progress fixed** — the `npx showpane` installer now drives long-running setup commands through a non-blocking path, so the spinner can actually animate during dependency install, database setup, and app startup
- **More natural in-progress labels** — setup steps now read as `Creating`, `Installing`, `Configuring`, and `Starting` while work is underway, instead of showing the past-tense step names before anything has finished
- **First-run PATH setup prompt** — interactive installs now offer to add `~/.showpane/bin` to your shell PATH once, so future terminals can run `showpane claude` directly instead of falling back to `npx showpane claude`

## 0.2.2 (2026-04-09)

### Changed — First Run Clarity
- **Canonical Claude command on localhost** — the local welcome page now consistently presents `showpane claude` as the main command, with `npx showpane claude` only shown as a fallback note when needed
- **Clear terminal handoff** — both the success card in the installer and the localhost page now explicitly tell users to open a new terminal window before running Claude, so they do not try typing into the terminal that is already streaming local app logs
- **Visible install progress** — the `npx showpane` stepper now uses the animated create-flow progress UI during project creation instead of static arrows for each install step
- **Installer smoke coverage updated** — the local smoke test now asserts the new success-card guidance so the terminal handoff copy does not silently regress

## 0.2.1 (2026-04-09)

### Changed — First Portal Onboarding
- **Local welcome page refresh** — localhost onboarding now focuses on one Claude start command, two strong first-portal prompt examples, and a direct guide CTA instead of a numbered setup stack
- **Canonical first-portal guide** — public docs now center on `app.showpane.com/docs/first-portal` with transcript patterns, best practices, common mistakes, and a walkthrough slot
- **Early portal guidance nudge** — `/portal create` now points first-time users to the guide for the first three org-scoped portal creations, then stays quiet after that

## 0.2.0 (2026-04-08)

### Added — Showpane Cloud Platform
- **Cloud platform** (`platform/`) — hosted at app.showpane.com, $29/mo flat with 7-day trial
- **Clerk auth** — signup, login, team management with org-level access
- **Stripe billing** — single-tier subscription with webhook-driven provisioning
- **Sequential provisioning** — Stripe → Supabase org → Vercel project → subdomain → env vars → welcome deploy → email
- **Vercel Platforms API** integration — create projects, assign subdomains, deploy portals
- **CLI device auth** — `./setup --cloud` with browser-based authorization flow
- **Engagement dashboard** — feed-first 3-panel layout with stats cards and activity feed
- **Team access** — invite by email, roles (owner/admin/viewer), member management
- **Getting started** page — 3-step post-signup onboarding
- **Docs** — quickstart, self-hosted deploy, and cloud setup guides

### Added — Engagement Intelligence (portal app)
- **Visitor tracking** — `sp_visitor` first-party UUID cookie (30-day, no PII)
- **Section time analytics** — Intersection Observer tracks which sections are viewed and for how long
- **Expanded event types** — `section_view`, `section_time`, `file_download`, `share_link_access`
- **visitorId + metadata** on PortalEvent model for session-level analytics
- **"Powered by Showpane"** badge in portal footer

### Changed — Multi-Tenant Foundation
- **Prisma schema**: SQLite → PostgreSQL canonical provider
- **Cascade deletes** on PortalEvent and PortalFile when portal is deleted
- **Full tenancy identity rewrite** — all tokens carry organizationId, all DB lookups scoped by org
- **`getAuthenticatedPortal()`** replaces `getAuthenticatedSlug()` — returns `{orgId, slug}`
- **npx installer** uses `prisma db push` (works with SQLite despite Postgres schema)

### Security
- **Constant-time bearer comparison** in file upload routes (`timingSafeEqual`)
- **Path traversal guard** in local storage (`safePath()`)
- Linux binary targets for Vercel serverless deployment

## 0.1.0 (2026-04-08)

### Added
- `npx showpane` one-command installer with ASCII banner, SQLite setup, port probing
- Welcome page with onboarding guide (shows when no portals exist)
- SQLite support for local development (zero config)
- Auto-branding: fetch logos from Clearbit, avatars from Gravatar
- Granola MCP integration for meeting transcripts
- Cloud deployment path in `/portal deploy` (coming soon)
- GitHub Actions CI/CD for npm publishing
- DESIGN.md design system documentation

### Changed
- Default database from PostgreSQL to SQLite for local dev
- README rewritten for npx-first getting started
- Skills updated with auto-branding and npx mode support

## 0.0.1 (2026-04-07)

### Added
- Initial portal app with Next.js 15, Prisma, Docker deployment
- 14 Claude Code skills for portal management
- 3 portal templates (sales-followup, consulting, onboarding)
- PortalShell component system
- HMAC-SHA256 stateless authentication
