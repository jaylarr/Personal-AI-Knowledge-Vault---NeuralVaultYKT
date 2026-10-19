# API reference — current foundation

Only loopback HTTP is supported. Exact configured Host and browser Origin are required. Cross-site requests are denied. Responses include server-generated `X-Request-Id`, security headers and no-store; errors omit internal details.

| Route | Behavior |
| --- | --- |
| GET /health | 200 `{status:"alive",service:"atlas-api"}`; liveness only |
| GET /ready | 503 `{status:"setup_required",codes:[...]}`; no credentials or dependency URLs |
| GET /api/v1/setup/services | Real restricted SQL/JWKS/private-bucket HEAD probes; database/auth/storage connected/not_configured/unavailable, no secrets |
| GET /api/v1/auth/check | Verified bearer JWT required; current identity's stored receipt or null |
| POST /api/v1/auth/check | Verified JWT required; persist a new per-identity receipt under forced RLS; returns authenticated/receipt/vault_access=setup_required |
| GET /api/v1/me | Verified configured owner and current enabled membership; own workspace ID/name/revision only |
| GET /api/v1/workspaces/:id/organization | Owner-only validated workspace/projects/collections snapshot |
| GET/POST /api/v1/workspaces/:id/projects | Owner list/create; create name/slug/description |
| PATCH /api/v1/projects/:id | Owner name/description/archive/restore; expected_revision required |
| GET/POST /api/v1/workspaces/:id/collections | Owner list/create; parent_id nullable; collections do not grant sharing |
| PATCH /api/v1/collections/:id | Owner rename/move/archive/restore with expected_revision; cycles denied |
| POST /api/v1/collections/:id/merge | target_id, expected_revision, target_revision, explicit child_conflicts mapping; atomic memberships/children/manual overrides |
| Other /api/* | No domain implementation yet; authentication middleware denies missing bearer401; authenticated unsupported operations remain503 |
| Built SPA routes/assets | Safe root-confined serving; no dotfiles, arbitrary extensions or API fallback |

All organization mutations require an Idempotency-Key of 8–128 URL-safe characters. Exact replay returns the committed original DTO; changed payload with the same key returns409. Workspace locks serialize edits; expected revisions reject stale state. Merge preserves source identity, manual membership origin/locks and exclusion decisions; conflicting include/exclude overrides require owner reconciliation first. Child name collisions require exact source-child to target-child mapping. No ACL changes occur. Archive/restore/move currently use PATCH rather than separate action aliases. Collections keep children/contents when archived; restoring a parent restores navigation to retained children.

Payload limit: 2 MiB; API timeout: 10 seconds. Strict unknown-field rejection; snake_case DTOs runtime validated. Missing/invalid bearer401, unrelated/disabled owner403, hidden individual404, stale/conflict409, invalid fields400, missing setup/database503. No public owner enrollment or arbitrary caller Principal/JobContext. Domain routes only operate after configured owner resolution; actual production owner/domain setup remains pending. Full remaining routes and fifteen MCP schemas are in handoff5.10.


