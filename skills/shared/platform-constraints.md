# Showpane Platform Constraints

Use these only when relevant to the user's request. Do not proactively dump them unless the request would violate one.

## Cloud

- Cloud CLI login is intended for workspace owners/admins only.
- Do not suggest that users can copy reusable cloud API tokens from the dashboard.

## Uploads

- Uploaded files are restricted to a safe allowlist.
- Active web content is not allowed. In particular: `svg`, `html`, `xml`, and JavaScript files should be rejected.
- Per-file upload limit: `50MB`.
- Per-portal storage quota: `500MB`.
- Upload rate limit: `10 uploads/minute` per portal.

## Portal Sharing

- Share links are temporary access links.
- Share-link access should not be described as equivalent to a full operator login.
- Share-link visitors should not be told they can upload files or generate new share links.

## Analytics

- Browser clients should not receive reusable org-wide analytics bearer tokens.
- Event ingestion is rate-limited.
- Event metadata must stay small; large blobs should not be suggested as analytics payloads.

## Messaging Guidance

- When a request conflicts with one of these rules, explain the limit plainly and suggest the nearest supported path.
- Prefer: "Showpane currently doesn't allow X" over a long security explanation.
