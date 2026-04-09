# showpane

CLI for [Showpane](https://showpane.com) — AI-generated client portals.

## Install

```bash
npx showpane
```

## Commands

### `npx showpane` (default)
Scaffold a new Showpane portal project. Unpacks a version-pinned scaffold, installs the global Showpane toolchain, sets up Prisma, and starts the local app.

Flags:

- `--name <company>` — provide the company name non-interactively
- `--yes` — skip prompts when paired with `--name`
- `--no-open` — do not open the local app in the browser
- `--verbose` — stream raw install logs instead of the quiet installer view

### `showpane login`
Authenticate with Showpane Cloud for hosted portal deployment.
This is auth only — org creation and billing happen in the Showpane Cloud web app.

### `showpane sync`
Install or refresh the global Showpane toolchain and Claude Code skills for the current CLI version.

### `showpane upgrade`
Upgrade a generated Showpane project using packaged scaffold assets instead of upstream git history.

## Requirements

- Node.js 20+
- Claude Code (for portal creation)

## Local Smoke Test

```bash
npm run smoke:test-local
```

Builds the local CLI, packs it, and runs the full `npx` scaffold flow in a temp directory with a deliberately conflicting parent `DATABASE_URL`.
