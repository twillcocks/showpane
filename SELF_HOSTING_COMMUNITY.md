# Self-Hosting Notes

Showpane is designed around:

- Local authoring with SQLite
- Hosted publish with Showpane Cloud

Advanced teams can still adapt the OSS app for their own infrastructure if they want to, but this repo no longer ships a production deployment stack in the default workflow.

If you go down that path, you own the runtime, database, storage, auth, backups, monitoring, and upgrades.

Useful starting points in this repo:

- The local portal app code
- The SQLite authoring flow
- The runtime snapshot and cloud publish/export plumbing, which may be useful as reference code
