# Architecture

Personal extension (P02, 2026-10-22): browser-safe contracts feed a projectless local service composed of policy, session adapter, coverage journal, review leases, owner context selection and skill catalog/source packages. Dedicated API/MCP operations require explicit personal capabilities and host grants; old project capture credentials do not inherit access. Owner-cookie controls handle candidates, suppression and skill curation. Coverage lives under .atlas/personal/coverage, outside domain catalog admission counts. Original owner messages are streamed and returned through bounded acknowledged pages. Hooks queue metadata under current-turn consent and never start an agent/API. Installed hooks/grants/history rollout remain separately gated. Local Markdown remains source of truth; no new AI service or cloud writes.

## Local domain extension — 2026-10-18

Schema3 append-only Markdown revisions and exact originals are controlled by local commit manifests. Existing K01 tools stay intact; fifteen additive tools provide evidence-based source processing, review and bounded retrieval. Browser contracts remain Node-free. Deterministic bounded workers parse/chunk local bytes; connected agents perform inference. No model API/key, embeddings, cloud knowledge writes or agent launcher is added. See LOCAL_COMPLETION_REPORT.md and BACKUP.md for current verification and remaining gates.

New text and PDF extraction use versioned local-text-v2/pdf-text-v2 chunking with paragraph/fence boundaries and exact code-point offsets. Historical v1 versions keep their original chunk algorithm and identifiers. Large catalogs cache already verified bytes against file identity/size/nanosecond timestamps; directory and transaction changes invalidate the projection, periodic chain verification remains, and actual deliveries/evidence/credentials are checked freshly. A failed commit publication stays unacknowledged and can be resumed with its original request key.

Retrieval uses current permitted source evidence and complete serialized response budgets. Continuation binds actor, filters, ordered heads and content-index revision. Trace receipts retain identifiers and rank/budget metadata rather than raw queries or returned source text. An explicit, authorized compatibility-context option adds a labeled reviewed packet within the same character budget; capture-only credentials receive no expanded read access. Owner history is explicit and labels old evidence; default agent retrieval excludes stale facts.

The graph loads source metadata, follows recorded structural/current evidence/approved semantic links, and supports bounded one/two-hop focus. Browser-local camera/type/review/evidence settings are validated and revisioned; they never change Markdown or permissions. The owner workspace exposes source versions, exact downloads/evidence, review, organization, scoped agents/tasks, retrieval traces and isolated backup/restore. Stored attachments and unsupported extraction remain distinguishable from reviewed knowledge.

## K01 knowledge selection — 2026-10-17

The local file service now distinguishes durable keyed knowledge from legacy activity. Browser-safe optional schemas carry owner/project scope, evidence status and immutable replacement metadata; Node helpers resolve heads and select bounded lexical context. API/MCP/CLI share local contracts while cloud contracts stay unchanged. New Markdown has flat properties and explicit source/version links. The current graph receives filtered snapshots from LocalApp; graph mechanics are unchanged. See KNOWLEDGE_QUALITY_REPORT.md.


## Current L01 architecture — local files

The owner's 2026-10-17 local-folder decision supersedes the cloud knowledge design below. Vault/ Markdown/YAML is authoritative. Node loopback API reads the same folder as agents/Obsidian; no database/index is required. Three MCP tools use that API, and direct file access is supported. Local UI includes a real file/link graph, plain note viewer/search and automatic refresh. .atlas/ contains local metadata/history/imports. The launcher uses the existing protected transport credential in memory and does not load Neon credentials. See LOCAL_VAULT_DESIGN.md and LOCAL_VAULT_REPORT.md for access boundaries and evidence. The prior Neon implementation/data/resources remain preserved historical compatibility code, not the normal runtime path.

G03 supersedes the historical G01/G02 SVG renderer with browser-only Three WebGL / R3F 9, custom GLSL point/edge/pulse/zap batches and native Three bloom. The original same-origin localSnapshot contract and file reader remain. Seeded category/link/collision layout runs in a bounded worker for larger data; filtering and selection preserve positions. A capped direction-aware scheduler traverses only actual links; unknown confidence/review are preserved rather than inferred. Mobile quality, pause/reduced motion, context fallback and GPU cleanup are explicit. There is no new server/core/credential import or cloud write. See NEURAL_GRAPH_ARCHITECTURE.md and NEURAL_GRAPH_PROGRESS.md. G01/G02 reports remain historical evidence; the old 300-node SVG display bound no longer applies.

## Implemented foundation (verification tracked separately)

- pnpm workspace: `apps/web`, `apps/api`, `apps/mcp-server`, `packages/contracts`, `packages/core`.
- Browser-safe Zod contracts; Node ESM core contains guarded SQL transactions/migration primitives.
- React/Vite/Tailwind setup shell calls same-origin `/ready`. It displays no fabricated knowledge.
- Hono factory and explicit loopback runtime. Health is process-only; readiness fails closed while setup is unfinished. Organization routes require the verified configured owner; remaining source/product routes are unavailable.
- MCP stdio server now exposes A01 automatic repository start, bounded project context and immutable checkpoint saving through a loopback API/scoped credential. It never imports core/SQL/storage. Global Codex guidance and Windows DPAPI launcher are installed; see AGENT_WORKFLOW.md.
- Local PostgreSQL 18.6 harness is independent of cloud resources. `0000_foundation.sql` creates owned atlas/atlas_private schemas. Checksum journal is restricted to the migration role; migration runs are transaction-locked and rollback on failure.
- S05 adds 39 local-only domain tables across identity/knowledge/memory/evidence/jobs/agent grants/retrieval/graph metadata. All owned by atlas_owner, RLS enabled. S06 adds scoped SQL policies/grants and private metadata helpers in 0012–0015. 72 exact default collections are inserted by setup-only owner workspace/seed services. See SCHEMA.md and AUTHORIZATION.md.
- S07 adds0016 owner metadata resolution and setup-only single-owner binding. Middleware verifies bearer signatures/issuer/expiry, matches configured owner identity and requires current enabled membership before every route transaction. Fixture adapters are forbidden in production. Actual live owner binding remains deferred.
- S08 adds runtime-validated organization DTOs, owner-only services/routes, workspace-serialized idempotent mutations, optimistic revisions and transactional child/membership/override merge. React account state clears query caches on sign-out/identity change; denied refresh hides old organization. A compact navigator/form UI persists selection in URL. Test-only entrypoints outside the production build use local PostgreSQL and signed fixture JWTs; managed Auth requests are intercepted in controlled browser tests.

Foundation evidence: 43 unit/runtime cases, 10 real database cases and desktop/mobile browser checks. The SQL harness uses a dedicated atlas_harness probe table with RLS to prove pooled identity cleanup; it does not claim the future domain RLS exists. Local Git initialized without commit/push.

## Proposed, not implemented

Staged source capture/reconciliation, deterministic ingestion, full granted task services, review/lifecycle, full retrieval/fifteen-tool MCP, Sigma graph and backup/recovery. Actual owner binding completed N03. A01 provides limited automatic project/checkpoint knowledge with real installed-MCP fresh-process acceptance; it does not complete the broader product or personal browser acceptance.

## N01 — actual Neon connection

Linked explicit owner-selected production target (docs/neon-target.json). neon.ts declares managed Auth; PostgreSQL is inherent. No hosted frontend/Function, Data API, storage or AI Gateway provisioned. CLI installed Neon agent tooling as part of requested default init.

Runtime uses existing pg over pooled TLS with a restricted atlas_api credential in ATLAS_DATABASE_URL. CLI-managed DATABASE_URL/UNPOOLED remain setup-only; API never falls back to them. Vite loads the root env directory but exposes only its public VITE_NEON_AUTH_URL alias. Auth UI is lazy-loaded.

Managed Auth SDK is isolated behind managed-sdk.mjs with a narrow declaration boundary and Zod-validated responses in client.ts. Its published declarations fail strict TypeScript 7 checks; application checks remain strict. Installed SDK injects signed JWT into getSession().data.session.token; /token dynamic action failed in real testing. Adapter uses that actual installed session hook. Server jose verifier checks exact JWKS path/origin, issuer, EdDSA and sub/exp/iat. No custom token signing or auth bypass.

GET /api/v1/setup/services performs real SQL/JWKS probes with redacted status. GET/POST /api/v1/auth/check verifies JWT and reads/writes only that identity's setup receipt through transaction-local identity and forced RLS. Table atlas_setup.auth_checks contains issuer/subject/receipt/time only; no email/password/token/knowledge. Separate public.atlas_setup_migrations journal preserves future vault migration ordering. These diagnostics do not grant vault access; /ready remains setup_required and knowledge routes remain closed.

API/worker SQL roles must not own schemas or bypass RLS. Every authenticated operation uses one same-client transaction with transaction-local identity. ATLAS never performs inference or automatically launches an agent. Existing agents submit source-backed suggestions; owner review controls canonical memory.

Full design/contracts: handoff sections 4–5. Configuration values are not proof that a dependency works; release readiness requires actual live validation.

## N02 — deployed backend infrastructure

All 17 migrations and 39 RLS tables now deployed on the exact production target after an expiring child-branch rehearsal. atlas_owner is NOLOGIN; runtime API/worker logins have no elevated flags/memberships. The direct/admin/verify-full setup command checks the linked target and matching migration-rehearsal checksum receipt. The API remains restricted/pooled; missing worker credentials are generated once without resets. N01 diagnostics retain their independent schema/journal.

neon.ts now declares private atlas-sources. AWS credentials stay server-only; core owns the pinned native path-style S3 client. Service status HEAD-probes the fixed bucket and reports Originals connected without exposing URLs/keys. Real setup verification PUT/HEAD/GET/hash/anonymous403 passed and cleaned only its synthetic object. S09 source capture/reconciliation remains future product work. The prepared owner:bind:neon command requires a genuine branch JWT plus explicit actual identity; no personal owner was initialized. See NEON_DOMAIN_SETUP_REPORT.md.





## G04 theme, volume and resolution follow-up

The original shared ATLAS shell and charcoal/sage theme supersede G03's independent navy/palette design. Browser-only graph-theme/render-quality modules centralize deterministic category colors and DPR/MSAA/segment bounds. Layout revision project-volume-v2 uses volumetric preferred anchors, hub-aware bounded relaxation and exact reuse of finite prior positions. CPU curves and GPU effects share a perpendicular seeded frame. The composer retains renderer resolution; Low has direct shader output conversion. No data/API/server boundary changed. Code and136 unit checks pass; actual rendered acceptance remains pending because browser control is disabled. See GRAPH_THEME_SPREAD_REPORT.md.
