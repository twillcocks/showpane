# Self-Hosting Notes

Showpane is designed around:

- Local authoring with SQLite
- Hosted publish with Showpane Cloud via `showpane login` + `/portal-deploy` or `showpane deploy`

`showpane deploy` is a Showpane Cloud deploy path. It is not a generic self-hosting deploy command.

Advanced teams can still adapt the OSS app for their own infrastructure if they want to, but this repo no longer ships a production deployment stack in the default workflow.

If you go down that path, you own the runtime, database, storage, auth, backups, monitoring, and upgrades.

Useful starting points in this repo:

- `app/` for the local portal app
- `templates/` for the reference portal patterns Claude reads
- `packages/portal-contracts/` for the local/cloud contract types
- `app/src/lib/runtime-state.ts` and `packages/cli/bundle/toolchain/bin/export-runtime-state.ts` for snapshot/export plumbing
- `app/src/lib/storage.ts` for local vs object-storage behavior
