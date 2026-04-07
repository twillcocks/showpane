# Changelog

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
