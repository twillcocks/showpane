---
name: portal-dev
description: |
  Start the local development server for Showpane. Quick way to preview portals during development.
  Trigger phrases: "portal dev", "start dev server", "run showpane locally", "start the server". (showpane)
allowed-tools: [Bash, Read]
---

## Preamble (run first)

This skill uses a simplified preamble — no version check or learnings loading needed for starting a dev server.

```bash
# Read config
CONFIG="$HOME/.showpane/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "Showpane not configured. Run /portal setup first."
  exit 1
fi
APP_PATH=$(python3 -c "import json; d=json.load(open('$CONFIG')); print(d.get('app_path',''))" 2>/dev/null)
APP_PATH="${SHOWPANE_APP_PATH:-$APP_PATH}"
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "App path not found: $APP_PATH"
  echo "Run /portal setup to reconfigure."
  exit 1
fi
echo "APP_PATH: $APP_PATH"

# Predictive next-skill suggestion
if [ -f "$HOME/.showpane/timeline.jsonl" ]; then
  _RECENT=$(grep '"event":"completed"' "$HOME/.showpane/timeline.jsonl" 2>/dev/null | tail -3 | grep -o '"skill":"[^"]*"' | sed 's/"skill":"//;s/"//' | tr '\n' ',' | sed 's/,$//')
  [ -n "$_RECENT" ] && echo "RECENT_SKILLS: $_RECENT"
fi

# Search relevant learnings
LEARN_FILE="$HOME/.showpane/learnings.jsonl"
if [ -f "$LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries"
  if [ "$_LEARN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "RECENT_LEARNINGS:"
    tail -5 "$LEARN_FILE" 2>/dev/null
  fi
fi

# Track skill execution
SHOWPANE_TIMELINE="$HOME/.showpane/timeline.jsonl"
mkdir -p "$(dirname "$SHOWPANE_TIMELINE")"
echo '{"skill":"portal-dev","event":"started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$SHOWPANE_TIMELINE" 2>/dev/null
```

If RECENT_SKILLS is shown, suggest the likely next skill:
- After portal-create → suggest /portal-preview
- After portal-preview → suggest /portal-deploy or /portal-share
- After portal-deploy → suggest /portal-status or /portal-verify
- After portal-setup → suggest /portal-create
- After portal-credentials → suggest /portal-share
- After portal-update → suggest /portal-deploy

If RECENT_LEARNINGS is shown, review them before proceeding. Past learnings may contain
relevant warnings or tips for this operation. Apply them where relevant but don't
mention them unless they directly affect the current task.

## Steps

### Step 1: Check if port 3000 is already in use

```bash
lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null
```

If a process is listening on port 3000:

1. Check if it's already a Showpane/Next.js dev server:
   ```bash
   lsof -i :3000 -sTCP:LISTEN 2>/dev/null | head -5
   ```

2. If it's already the Showpane dev server, inform the user:
   > "Dev server is already running at http://localhost:3000. No action needed."
   >
   > Useful links:
   > - Login page: http://localhost:3000/client
   > - Example portal: http://localhost:3000/client/example

3. If it's a different process, warn the user:
   > "Port 3000 is in use by another process (PID: <pid>). Options:"
   > - Kill it: `kill <pid>` then re-run `/portal dev`
   > - Use a different port: `cd $APP_PATH && PORT=3001 npm run dev`

   Ask the user how to proceed. Do not kill processes without explicit permission.

### Step 2: Verify dependencies

Check that node_modules exists and the Prisma client is generated:

```bash
if [ ! -d "$APP_PATH/node_modules" ]; then
  echo "Installing dependencies..."
  cd "$APP_PATH" && npm install
elif [ ! -d "$APP_PATH/node_modules/.prisma" ]; then
  echo "Generating Prisma client..."
  cd "$APP_PATH" && npx prisma generate
fi
```

If `npm install` is needed, wait for it to complete before starting the dev server.

### Step 3: Source environment variables

The dev server needs DATABASE_URL and other env vars:

```bash
if [ -f "$APP_PATH/.env" ]; then
  echo "Loading .env from $APP_PATH"
else
  echo "WARNING: No .env file found at $APP_PATH/.env"
  echo "The dev server may fail without DATABASE_URL and AUTH_SECRET."
  echo "Create $APP_PATH/.env with at minimum:"
  echo "  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/showpane"
  echo "  AUTH_SECRET=<any-random-string>"
fi
```

### Step 4: Check database connectivity

Before starting the dev server, verify the database is reachable. The app will fail to load pages that query the database if the connection is broken.

```bash
if [ -f "$APP_PATH/.env" ]; then
  set -a && source "$APP_PATH/.env" && set +a
fi
if [ -n "$DATABASE_URL" ]; then
  cd "$APP_PATH" && npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "WARNING: Database connection failed. Check DATABASE_URL in $APP_PATH/.env"
    echo "The dev server will start but portal pages may not load correctly."
  fi
else
  echo "WARNING: DATABASE_URL not set in $APP_PATH/.env"
fi
```

This is a non-blocking check. If the database is down, the dev server still starts — it just won't be able to serve authenticated portal pages. Static pages and the example portal (which uses hardcoded data) will still work.

### Step 5: Check for pending migrations

```bash
cd "$APP_PATH" && npx prisma migrate status 2>&1 | grep -q "pending"
```

If there are pending migrations, inform the user:

> "There are pending database migrations. Run `cd $APP_PATH && npx prisma migrate dev` to apply them, or they will be applied automatically when you next run `/portal deploy`."

This is informational only — do not block the dev server start.

### Step 6: Start the dev server

Run the dev server in the background so it doesn't block the terminal:

```bash
cd "$APP_PATH" && npm run dev
```

Use the Bash tool's `run_in_background` parameter to start it without blocking. The user will see the output when Next.js finishes compiling.

If the `npm run dev` script is not defined in package.json, fall back to:

```bash
cd "$APP_PATH" && npx next dev
```

The dev server typically takes 3-10 seconds to start depending on the project size and machine speed.

### Step 7: List existing portals

After starting, discover which portals exist so the user has useful links:

```bash
ls -d "$APP_PATH/src/app/(portal)/client"/*/ 2>/dev/null | while read dir; do
  slug=$(basename "$dir")
  echo "$slug"
done
```

### Step 8: Confirm startup and show links

Present a clean summary:

```
Dev server starting at http://localhost:3000

  Login page:      http://localhost:3000/client
  Example portal:  http://localhost:3000/client/example
```

If the user has created portals, also list them:

```
  Your portals:
    - http://localhost:3000/client/acme-health
    - http://localhost:3000/client/beta-corp
```

Then show tips:

```
Tips:
  - Create a portal:   /portal create <slug>
  - Edit a portal:     /portal update <slug>
  - View all portals:  /portal list
  - Hot reload is ON:  edits to portal files appear instantly
  - Stop the server:   Ctrl+C in the terminal, or kill the process
```

## Error Handling

### Port conflict resolution
If port 3000 is occupied by a non-Showpane process:
- Show the PID and process name
- Offer two options: kill the process (with explicit permission) or use PORT=3001
- If using an alternate port, update all the links shown to the user

### npm run dev fails immediately
Common causes:
- **Missing .env**: Next.js may require certain env vars at build time. Check for required vars.
- **Port already in use**: Covered in Step 1 but can race if something starts between the check and the dev server launch.
- **Node version mismatch**: Showpane requires Node.js 18+. Check with `node --version`.
- **Corrupted node_modules**: Suggest `rm -rf $APP_PATH/node_modules && cd $APP_PATH && npm install`.

### Database-related page errors
If the dev server starts but portal pages show errors:
- Check the terminal output for Prisma errors
- Verify DATABASE_URL is correct and the database server is running
- Run `cd $APP_PATH && npx prisma migrate dev` to ensure the schema is up to date
- Run `cd $APP_PATH && npx prisma generate` to regenerate the Prisma client if the schema changed
- If using Docker for the database, ensure the database container is running: `docker compose ps`
- Check that the database user has the correct permissions for the showpane database

## Working with the Dev Server

### Hot reload behavior

The Next.js dev server watches all files under `src/` for changes. When you edit a portal's client component file, the browser automatically updates without a full page reload. This means:

- Editing tab content: reflected instantly in the browser
- Adding a new tab: reflected instantly
- Changing PortalShell props: reflected instantly
- Adding a new portal directory: requires navigating to the new URL manually (hot reload only works on already-loaded pages)
- Changing `prisma/schema.prisma`: requires restarting the dev server after running `npx prisma generate`

### Accessing portals during development

Portals in development can be accessed in two ways:

1. **Direct URL**: Navigate to `http://localhost:3000/client/<slug>` — this bypasses authentication during local development if the portal doesn't have credentials set yet
2. **Login page**: Navigate to `http://localhost:3000/client` — use this to test the full authentication flow with credentials created via `/portal credentials`

The example portal at `/client/example` always works without authentication and is a useful reference while building new portals.

### Stopping the dev server

The dev server can be stopped in several ways:
- `Ctrl+C` in the terminal where it's running
- `kill <pid>` using the PID shown during startup
- Running `lsof -i :3000 -sTCP:LISTEN -t | xargs kill` to find and kill whatever is on port 3000

### Using a different port

If port 3000 is reserved for another project, set the PORT environment variable:

```bash
cd "$APP_PATH" && PORT=3001 npm run dev
```

When using a non-standard port, all portal URLs change accordingly (e.g., `http://localhost:3001/client/<slug>`).

## Completion

As a final step, log skill completion:

```bash
echo '{"skill":"portal-dev","event":"completed","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> "$HOME/.showpane/timeline.jsonl" 2>/dev/null
```

## Conventions

- Never kill processes on port 3000 without explicit user permission
- Use the simplified preamble — dev server startup should be fast, not a health check
- If dependencies are missing, install them automatically (no need to ask)
- Show useful links after startup (login page, example portal, user's portals)
- The dev server uses Next.js hot reload — edits to portal files are reflected immediately without restarting
- If .env is missing, warn but still try to start (the server will show its own error)
- Keep the output minimal and scannable — the user wants to get to work, not read documentation
- Database and migration checks are informational, not blocking — let the dev server start regardless
- This is the most commonly run skill — optimize for speed and minimal friction
- When the dev server is already running, do not restart it — just confirm it is running and show the links
- If the user is starting their work session, suggest `/portal dev` followed by `/portal create` or `/portal update` as the natural workflow
- The dev server process belongs to the user's terminal session — do not try to daemonize it or manage it as a background service
- If the user closes their terminal, the dev server stops — this is expected behavior for a development workflow
