# TODOs

Deferred items from Stage 2 CEO review (2026-04-08). Ordered by priority.

## P1 — High value, build soon after launch

### Engagement scoring (0-10 per portal)
Composite score based on visit frequency, section depth, file downloads, share events, recency. Shows as colored badge on dashboard ("Hot" / "Cold").
- **Why:** Distills all engagement intelligence into one actionable signal. Sales teams live on this.
- **Effort:** S (CC: ~1-2h). Computed from data already collected by visitor tracking + section time.
- **Depends on:** Phase 5 (engagement dashboard) must ship first.

### Slack webhook integration
Configurable webhook URL per org, fires on key portal events. "Acme just viewed your portal" in #sales.
- **Why:** People live in Slack. Getting alerts without opening a dashboard increases daily usage.
- **Effort:** S (CC: ~1-2h). Outbound HTTP POST on event trigger.
- **Depends on:** Phase 5 (event ingestion).

### Basic HubSpot/Salesforce webhook
Outbound webhooks on portal events for CRM integration. Biggest enterprise objection removal.
- **Why:** Enterprise buyers expect CRM integration. Removes the #1 objection from competitive analysis.
- **Effort:** M (CC: ~3-4h). Webhook config UI + event mapping.
- **Depends on:** Phase 5 (event ingestion).

## P2 — Medium value, build when demand validates

### Share chain attribution
Track who shared portal links and who opened them. See the buying committee forming in real time.
- **Why:** Turns engagement intelligence into sales intelligence. Knowing WHO is looking at your portal.
- **Effort:** M (CC: ~3-4h). Extend share link system with unique per-forward tracking.
- **Depends on:** Visitor tracking (accepted in Stage 2).

### Auto-generated OG preview cards
Dynamic OG images per portal with company name + logo via @vercel/og. Rich link previews on Slack/LinkedIn/email.
- **Why:** Professional polish. Makes shared links look intentional, not like a random URL.
- **Effort:** S (CC: ~1h). Well-documented Vercel feature.
- **Depends on:** Portal deployments on Vercel.

### Self-hosted to cloud migration tool
Import SQLite/Postgres data to Supabase. For users upgrading from self-hosted to cloud.
- **Why:** Removes friction from the upgrade path. Users shouldn't lose data when converting.
- **Effort:** M (CC: ~3-4h). Export script + import API.
- **Depends on:** Cloud platform (Phase 2-3).

### Custom domains (portal.youragency.com)
Let cloud customers use their own domain instead of orgname.showpane.com.
- **Why:** White-label appearance. Agencies want their brand, not Showpane's.
- **Effort:** M (CC: ~4h). Vercel domain API + SSL provisioning + DNS verification UI.
- **Depends on:** Cloud platform deployed.

## P3 — Lower priority, build when needed

### Portal expiration (auto-expire after N days)
Auto-disable portal access after a configurable period. Useful for time-limited proposals.
- **Why:** Sales follow-up portals shouldn't live forever. Creates urgency.
- **Effort:** S (CC: ~1-2h). Cron job + expiry field on ClientPortal.

### White-label emails
Send notification emails from the customer's domain, not showpane.com.
- **Why:** Professional appearance for agencies.
- **Effort:** M (CC: ~3-4h). Resend domain verification per org.
- **Depends on:** Email alerts (Phase 5).

### Webhook integrations (CRM, Zapier)
Generic outbound webhooks for any integration. Configurable per event type.
- **Why:** Extensibility. Connects Showpane to any workflow.
- **Effort:** M (CC: ~3-4h). Webhook config UI + delivery + retry.

### SSO/SAML (enterprise tier)
Enterprise auth for operator dashboard via Clerk's enterprise SSO.
- **Why:** Enterprise requirement. Unlocks higher-tier pricing.
- **Effort:** L (CC: ~6-8h). Clerk enterprise features + pricing tier.

### Client file upload UI
Web UI for clients to upload files to their portal (API exists, UI deferred).
- **Why:** Some portals need client-side document submission.
- **Effort:** S (CC: ~2h). React upload component + progress bar.

### Embedded portals (iframe)
Embed portal content in external websites via iframe.
- **Why:** Agencies may want to embed portals in their own sites.
- **Effort:** M (CC: ~3-4h). CSP headers + embed configuration.

### REST API access
Public API beyond Claude Code skills for programmatic portal management.
- **Why:** Power users and integrations need API access.
- **Effort:** L (CC: ~6-8h). API design + auth + docs.
