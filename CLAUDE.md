## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

### Showpane portal skills
- "Create a portal", "new portal for [client]" → invoke portal-create
- "Deploy", "push to production", "publish portal" → invoke portal-deploy
- "List portals", "show portals", "what portals exist" → invoke portal-list
- "Portal status", "health check", "how are my portals" → invoke portal-status
- "Share portal", "create share link", "send to client" → invoke portal-share
- "Update portal", "edit portal", "change portal content" → invoke portal-update
- "Delete portal", "remove portal", "deactivate" → invoke portal-delete
- "Portal analytics", "engagement", "who viewed" → invoke portal-analytics
- "Verify portal", "check deployment", "is my portal working" → invoke portal-verify
- "Portal credentials", "reset password", "change login" → invoke portal-credentials
- "Set up showpane", "configure", "initial setup" → invoke portal-setup
- "Preview portal", "open portal", "view portal" → invoke portal-preview
- "Onboard", "full setup + create", "get started" → invoke portal-onboard
- "Start dev server", "run locally" → invoke portal-dev
- "Upgrade skills", "update showpane" → invoke portal-upgrade

### gstack skills (if installed)
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
