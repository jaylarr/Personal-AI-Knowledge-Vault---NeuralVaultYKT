# ATLAS local vault completion — implementation handoff

Date: 2026-10-18, Asia/Taipei.

Handoff status: **EXECUTION IN PROGRESS after the owner's Proceed/Continue requests.** R01 is complete. Current implementation and verification evidence is in ../LOCAL_COMPLETION_REPORT.md and ../LOCAL_RELEASE_CHECKLIST.md. The detailed instructions and acceptance requirements below are preserved; actual in-app/fresh-chat acceptance remains distinct from controlled process tests.

Target: `C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT`.

Intended executor: the same Codex model at Light reasoning, using this artifact in a fresh chat.

Scope: plan all nine remaining product areas identified in the status review, with a bounded extension roadmap. The current request authorizes creating this plan. It does not request executing it. Preserve the original Revision 2 handoff, L01/K01 decisions, G03/G04 work, source brief and existing files. This is a proposed local completion amendment; once execution is requested, use its local design in place of the old handoff's cloud-dependent remaining steps.

## 1. Outcome and completion boundary

The existing app already registers projects, saves scoped durable subjects, retrieves project knowledge, preserves observed versions, and renders real Markdown file/link data. The desired finished product also lets the owner capture source material, inspect exact evidence, optionally let an existing connected agent organize selected sources, review its suggestions, retrieve trustworthy context in a bounded response, and recover the complete vault from a verified backup.

Example acceptance journey: import a fictional project brief; edit it as a new immutable version; find an exact identifier; grant one source version to a connected agent; receive cited proposals; approve one decision; retrieve it from a fresh MCP process; change its evidence and see the stale warning; revoke the agent; export and restore to an isolated folder; retrieve the same approved decision and evidence after restoration. No model service, cloud database, public endpoint or agent launcher is involved.

Two levels of completion are required:

- **Local core release:** all P0 steps and acceptance gates below, including recovery and a real existing-client round trip. PDF support and extended integrations are explicitly labeled separately until their checks pass.
- **Extended capture completion:** the PDF/attachment child and selected inert integration children pass their own gates. Unsupported formats remain visible as stored attachments with an honest extraction status. Do not call OCR, cloud sync or live service integrations implemented.

## 2. Progress checklist and order

The checklist was created during planning. R01 is accepted; the current implementation, controlled verification and outstanding actual-client gates are tracked in ../LOCAL_RELEASE_CHECKLIST.md. Unchecked boxes are not a claim that their code is absent or that full personal release acceptance has passed.

- [x] R01: execution baseline, recovery copies and tracking rebase.
- [ ] R02: finish G04 visual/interaction/resource/performance acceptance.
- [ ] R03: browser-safe local domain contracts and compatibility projection.
- [ ] R04: append-only local transactions, journal recovery and scalable metadata discovery.
- [ ] R05: local source versions, originals and attachment storage.
- [ ] R06: owner editor, capture/import UI and real Inbox.
- [ ] R07: sensitivity, processing disclosure and secret quarantine.
- [ ] R08: deterministic normalization, chunks and exact evidence.
- [ ] R09: bounded URL importer.
- [ ] R10: recoverable deterministic ingestion queue.
- [ ] R11: local agent identities, credentials and API grants.
- [ ] R12: version-scoped processing tasks and fenced leases.
- [ ] R13: validated submissions, classification overrides and manual organization.
- [ ] R14: owner review, evidence viewer and memory lifecycle.
- [ ] R15: approved summaries, aliases and lexical documents.
- [ ] R16: bounded lexical/graph retrieval, continuation and quality fixtures.
- [ ] R17: full additive MCP tools and fresh-process/client acceptance.
- [ ] R18: richer evidence-backed graph and saved layout.
- [ ] R19: complete responsive workspace and accessibility.
- [ ] R20: real changes and retrieval traces.
- [ ] R21: portable backup/export and isolated verified restore.
- [ ] R22: security, quality and performance release gates.
- [ ] R23: personal local release acceptance and handoff.
- [ ] X01: bounded PDF extraction and attachment polish, after core recovery/security.
- [ ] X02: inert integration roadmap and independently selected parser children.

Execution order: R01 → R02; R03–R10 → R11–R14 → R15–R17 → R18–R20 → R21–R23 → X01 → selected X02 children. If browser access still prevents R02 acceptance, keep R02 incomplete and continue independent R03 work after its baseline. R18/R19/final release remain blocked on the graph checks. No subagents or parallel agent work are requested by this plan. Run timed measurements separately from builds/tests.

## 3. Requirements and boundaries

### Must have

- One local `Vault/` with useful content in ordinary Markdown, flat quoted YAML properties and vault-relative links. Originals and attachments remain local. Operational queues, receipts, indexes and credential digests may live under `.atlas/`; indexes must be rebuildable.
- Existing automatic start/context/save behavior remains usable without per-note confirmation. Imported agent suggestions use a distinct review lifecycle; do not force routine K01 captures through a new mandatory approval flow.
- Exact immutable originals, explicit version chains, provenance, optimistic revisions, idempotent retries, recoverable interrupted writes and visible partial/failed states.
- Source-backed proposals, manual organization, explicit owner review for verified memories, stale-evidence handling, archive/restore, bounded deterministic retrieval and real graph relationships.
- Meaningful Windows concurrency, crash recovery, privacy, browser, MCP process and backup restore checks. Preserve the source brief hash.

### Must preserve

- L01 local-first runtime; K01 subject keys, applicability, basis, original notes/activity separation and immutable correction rules.
- Existing repository identity normalization and project IDs; original Markdown bytes, `.atlas/history`, imports/receipts and unrelated user work.
- G03/G04 Three/R3F renderer, actual node/link meanings, shared charcoal/sage shell, labelled controls, responsive reader, reduced motion, native navigation and GPU cleanup.
- Same-origin loopback API and protected local credentials; browser code never imports core, filesystem, SQL or credentials.
- Historical Neon code/data/reports. They are preserved compatibility evidence, not a dependency for this local roadmap.

### Must not have

- AI SDK/API key, embeddings, vector database, inference worker, automatic Codex/Claude launch, billing ledger, cloud knowledge writes, sync or a new backend dependency.
- New Neon migrations/provisioning/deletion, public hosting/tunnels, Windows startup installation, global client installation changes, commits/pushes, outbound messages or live n8n execution as part of this plan.
- Fabricated source facts, inference promoted by confidence alone, timestamp-based conflict winners, silently overwritten originals or real business data seeded for tests.

### Don'ts specific to this repository

- Do not reset/clean Git: branch is `master` with no verified HEAD commit; the application is currently untracked. Make task-owned recovery copies and hashes.
- Do not reuse `scripts/export-local-vault.ts` as the new backup command: it reads historical Neon. Create a separate local-only exporter.
- Do not revive the old Sigma/SVG design or the old 300-node graph bound. Current renderer is WebGL; distinguish stored-file limits from synthetic render tests.
- Do not widen the global 2 MiB API body limit for every route to support attachments. Put an explicit streaming upload bound only on the upload route.
- Do not claim API grants or DPAPI prevent another trusted Windows process from directly reading `Vault/`. Filesystem permissions remain that boundary.
- Do not present old test totals as a fresh baseline. Do not use another browser path to bypass a disabled browser-control setting.

## 4. Inspected context and evidence

### Instructions and historical specifications

Read before executing: root `AGENTS.md`; `Vault/AGENTS.md`; `docs/PROGRESS.md`; `docs/TASKS.md`; `docs/ARCHITECTURE.md`; latest entry in `docs/SESSION_LOG.md`; `docs/KNOWLEDGE_CAPTURE_POLICY.md`; `docs/LOCAL_VAULT_DESIGN.md`; `docs/plans/2026-10-16-atlas-implementation-plan.md` Revision 2. For graph acceptance also read `docs/plans/2026-10-17-graph-theme-spread-implementation-plan.md`, `docs/GRAPH_THEME_SPREAD_REPORT.md`, `docs/NEURAL_GRAPH_PROGRESS.md` and `docs/NEURAL_GRAPH_ARCHITECTURE.md`.

Current local instructions supersede the original cloud persistence, Auth gate, SQL retrieval and Sigma choices. The older S-step task table is historical scope tracking and contains stale rows about owner binding, migrations and SVG. Rebase status during R01 without deleting evidence. N03 owner binding is already complete; legacy cloud personal-browser C1 remains deferred and is not a blocker for the local product.

### Verified source map

| Existing file / anchor | Current responsibility | Planned use |
|---|---|---|
| `packages/core/src/local-vault.ts`: `createLocalVault`, `safe`, `write`, `locked`, `snapshot`, `ensure`, `context`, `captureKnowledge` | Safe local paths, exclusive publication, lock retry, scan/history, keyed capture | Reuse semantics; share filesystem primitives; add domain-aware projection without rewriting originals |
| `packages/core/src/local-knowledge.ts`: `resolveKnowledgeHeads`, `selectKnowledgeContext` | K01 chain resolution and bounded lexical context | Preserve and extend through separate reviewed-domain adapter |
| `packages/contracts/src/local-vault.ts`: `localNoteSchema`, `localSnapshotSchema`, `localContextSchema` | Current browser/MCP DTOs | Keep compatibility; add optional fields or separate domain endpoints |
| `packages/contracts/src/local-knowledge.ts`: `knowledgeState`, `localCheckpointInputSchema` | Existing durable subject validation | Do not relabel agent-recorded knowledge as owner-verified memory |
| `packages/contracts/src/{knowledge,memory,organization}.ts` | Original browser-safe domain enums/evidence/submission shapes | Reuse compatible enums; add local contracts rather than changing cloud semantics |
| `apps/api/src/local-vault.ts`: `createLocalServices`, `localRoutes` | Local cookie + one protected agent token, snapshot and 3 project endpoints | Keep existing flow; add owner/domain/agent routers before terminal `/api/*` route |
| `apps/api/src/app.ts`: `createApp` | Host/Origin/Sec-Fetch, CSP, 2 MiB body bound, 10-second timeout | Preserve protection; scoped streaming upload policy; do not enable cloud branch |
| `apps/api/src/index.ts`: local branch | Loads `.local/vault.json`, loopback runtime | Compose local deterministic job runner only; no AI process |
| `apps/mcp-server/src/{index,workflow,repository,cli}.ts` | 3 tools, loopback calls, repository identity, launcher fallback | Add 15 domain tools; preserve current tool names and schemas |
| `apps/web/src/app/LocalApp.tsx`: `LocalApp` | 4-second snapshot refresh, Knowledge/Activity/All files, graph and reader | Extract bounded components, add domain routes and state without a shell rewrite |
| `apps/web/src/app/KnowledgeGraph.tsx`; `neural/model.ts`: `adaptVault` | Actual file/link graph adapted to WebGL | Extend model to reviewed domain records and explicit relations |
| `apps/web/src/app/neural/{layout,GraphCanvas,GraphScene,GraphPanels,GraphPostProcessing,render-quality,graph-theme}.ts*` | Worker layout, controls, shaders, quality and theme | Finish G04, preserve renderer; extend only necessary graph DTO consumers |
| `tests/fixtures/local-vault-server.ts`, `tests/playwright.local.config.ts` | Disposable local browser fixture on 4320 | Add fictional domain fixtures outside personal vault |
| `tests/local-browser/{graph-theme-resolution,neural-performance,neural-picking,vault}.spec.ts` | Graph and local UX acceptance | Run existing checks before extending |
| `scripts/atlas-launch.ps1`, `scripts/verify-local-workflow.ts` | DPAPI launcher, local-only on-demand API, real MCP verification | Preserve token/config files; add local verifier scenarios |
| `scripts/{export-local-vault,import-local-vault}.ts` | Historical one-time cloud export/import | Leave historical; do not call during normal export/restore |

Stack from manifests: Node requirement `>=24.18.0 <25`; pnpm `11.25.0`; TypeScript `7.0.2`; React `19.3.1`; React Router `7.18.4`; TanStack Query `5.104.3`; Hono `4.13.13`; Zod `4.6.7`; YAML `2.9.1`; Three `0.180.0`; R3F `9.4.0`; MCP client/server `2.3.1`; Playwright `1.64.1`; Vitest `5.0.5`. Keep existing exact pins.

Planning observations: read source/callers, scripts, manifests, task/architecture/graph reports and Git state; connected `atlas_start_project` returned the existing local repository project. No application build/test/browser suite was run in this planning turn. Latest G04 report records 136 passing unit cases and strict/build checks, but browser/rendered/performance acceptance is pending. These are historical results, not this plan's verification.

Source brief hash freshly read during planning: `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`.

Registry metadata requests failed in the sandbox with DNS resolution errors; no install was attempted. Official upstream/package pages were inspected for the proposed parser pins below. Publication/engine/declaration checks remain an execution preflight, not an invitation to install `latest` or weaken strict types.

### Scope mapping from original milestones

| Remaining area | Original scope | New steps / acceptance |
|---|---|---|
| Graph completion | G03/G04, S24/S25 | R02 and R18; real rendering + data truth |
| Source imports/editor/Inbox | S09/S10/S13, P101 | R05/R06/R09, X01 |
| Processing/privacy/evidence | S11/S12/S14 | R07/R08/R10 |
| Review lifecycle | S16/S17 | R13/R14 |
| Retrieval/quality | S18–S20 | R15/R16 |
| Full agent/MCP workflow | S21/S15/S22/S23/E03 | R11/R12/R17; local real-client acceptance |
| Workspace/accessibility | S26 | R19 |
| Activity/traces | S27 | R20 |
| Backup/security/release | S28–S30 | R21–R23 |
| Extended integrations | P102–P108/P201–P203 | X02 roadmap; explicit future scope |

## 5. Selected design

### 5.1 Local records, immutable events and derived indexes

Keep existing `Owner/Knowledge`, project `Knowledge`, `Notes`, `Project.md`, `Collections.md` and original IDs intact. Add new schema-3 domain content under project folders; personal unassigned material uses `Personal/`. Private here means denied to ordinary agent API retrieval, not hidden from local OS programs.

```text
Vault/
  Projects/<existing-project-folder>/
    Project.md
    Knowledge/                         # existing K01 records, unchanged
    Notes/                             # existing activity/plain notes, unchanged
    Sources/<source-id>/
      Source.md                        # stable source identity, immutable
      Versions/<version-id>.md          # normalized Markdown + version metadata
      Events/<event-id>.md              # head changes, archive/restore, organization
    Memories/<memory-id>/<revision-id>.md
    Entities/<entity-id>/<revision-id>.md
    Relationships/<relationship-id>/<revision-id>.md
    Reviews/<review-id>/<event-id>.md
    Attachments/<source-id>/<version-id>/original.<allowlisted-extension>
  Personal/                            # same Sources/Memories/... substructure
  .atlas/
    transactions/<transaction-id>/manifest.json
    transactions/<transaction-id>/COMMITTED.json
    operations/                        # immutable job/task/grant/agent/settings events
    derived/<pipeline-version>/        # rebuildable chunks/search/page maps
    requests/                          # retry identity and result references
    history/                           # preserve existing historical bytes
    pending/                           # recoverable incomplete records, no secrets
```

Content and content lifecycle evidence stay readable in Markdown. JSON is limited to operational envelopes, validated bounded structured fields, rebuildable indexes and binary manifests. Use quoted YAML scalars/lists with numeric/boolean primitives where required by schema, no YAML objects/aliases. Record paths use opaque UUIDs rather than raw uploaded names. All managed domain revisions have new UUIDs; a shared logical ID is not reused as `localNote.id`, preventing duplicate-ID exclusion in the current scanner. Existing project identity files and imported collection definitions remain in place; local display/organization changes are append-only events projected over those originals, not directory renames.

New version events explicitly reference prior version/head revision and digest. Resolve a unique valid chain, not the newest timestamp. Divergent heads are a conflict. A direct edit remains visible with `modified_since_capture` and invalidates dependent approvals until reviewed. A manually added schema-3 record has no owner-verification authority merely because its YAML says approved; only validated owner-route review receipts can establish app-level approval. These receipts are not cryptographic protection against a process with filesystem write access.

### 5.2 Multi-file commit protocol

Build on existing exclusive publication and per-vault cross-process lock; do not emulate a database with ad hoc mutable pointer files. Canonical domain revisions/events are append-only. One manifest and one final exclusive commit marker form a logical transaction:

1. Validate inputs and byte limits outside the lock; stage bytes in task-owned hidden files and hash them.
2. Acquire the existing vault lock. Re-read affected heads, grants, source hashes and request-key result. Reject differing expected revisions or revoked/expired rights.
3. Write an immutable manifest containing transaction ID, principal, request hash, expected head digests, output relative paths/hashes and response references. Publish new-only output files using existing safe path + exclusive hard-link semantics. Never replace a user file.
4. Fsync staged/publication handles, validate outputs, then publish `COMMITTED.json` exclusively with manifest hash. Visibility of the whole domain mutation depends on this marker; readers ignore uncommitted outputs. Return success only after a consistent read confirms the committed result. A failed response after commit can replay by request key.
5. Recovery checks recorded paths only. A transaction with all valid immutable outputs but no marker is retained pending and may resume only after rechecking expected heads/rights. A committed transaction with missing/mutated outputs is an explicit integrity error; no silent fabrication or timestamp winner. A direct user edit is preserved and exposed as a changed source, never restored automatically from a manifest.

Add internal unlocked scan helpers so operations already holding `withLock` do not recursively acquire it. Consistent domain snapshots read commits and records within one lock; do not use a partially published domain tree in the legacy `snapshot()` path. Hash immutable blob receipts on reads used for evidence or mutations. Rebuildable indexes are never authority for permissions, version heads or approval.

Canonical payload hashing sorts object keys recursively, preserves array order and uses UTF-8 JSON with finite numbers; hash the validated normalized input, including expected revisions. A request key is 16–200 ASCII characters from letters/digits/`._:-`; namespace by authenticated actor/operation. Proposed Node-only staging types: `LocalStagedRecord={path:string,bytes:Uint8Array,record_id:string,kind:string}` and `LocalOperationResult={transaction_id:string,result_refs:LocalRecordRef[],replayed:boolean}`. Add a binary-safe exclusive writer that accepts Uint8Array; keep the current string writer as a wrapper. Never convert binary originals through UTF-8 strings.

### 5.3 Proposed contracts — names and invariants

Create `packages/contracts/src/local-domain.ts` and export its browser-safe schemas/types from `index.ts`. Keep cloud contract names/limits untouched; reuse compatible `relationshipTypeSchema`, claim kinds and submission fields via explicit mapping. All new HTTP JSON uses snake_case; `.strict()` rejects unknown fields. Use UUIDs and lowercase SHA-256; ISO timestamps must include timezone. Bounded user strings are trimmed, with no HTML execution.

| Contract | Required shape / rules |
|---|---|
| `LocalActor` | Server-derived `{kind:'owner'\|'agent'\|'worker',id:string}`; never trust caller-supplied actor/approval fields |
| `LocalRecordRef` | `{id:UUID,revision_id:UUID,file_digest:SHA256}`; heads also return `revision:positive integer` |
| `LocalSource` | `{id,title,project_id:UUID\|null,input_type:'note'\|'text'\|'markdown'\|'url'\|'attachment'\|'pdf',scope:LocalScope,current_version_id,content_revision,processing_state,sensitivity,archived,collection_ids,manual_include_ids,manual_exclude_ids}` |
| `LocalScope` | `personal`, `project`, `global_development`, `agent_private`, `shared_agents`; extra project/agent/audience fields validated together; imported source default `personal` |
| `LocalSourceVersion` | `{id,source_id,version,predecessor_version_id,raw_sha256,normalized_sha256,byte_count,media_type,original_path,normalized_path,pipeline_version,origin_url?,captured_at,extraction_status}`; immutable |
| `LocalChunk` | `{id,source_id,source_version_id,sequence,heading_path,start_offset,end_offset,text_sha256,estimated_units}`; 0-based Unicode code-point offsets in normalized text, end exclusive; no raw byte/UTF-16 confusion |
| `LocalEvidence` | `{source_version_id,chunk_id?,start_offset,end_offset,quote_sha256}`; quote is exact normalized-text code-point slice encoded as UTF-8; source must be committed, readable and unchanged |
| `LocalMemory` | `{id,revision,revision_id,subject_key,type,title,summary,structured_content,claim_kind,status,evidence,scope,project_id,critical,retrieval_level,valid_from,valid_to,superseded_by_id,requires_revalidation}`; states `proposed\|verified\|active\|rejected\|archived\|superseded`; server-only approval/critical flags |
| `LocalEntity` / `LocalRelationship` | Entity canonical key/aliases within access partition; relationship `{id,from_item_id,to_item_id,type,claim_kind,evidence,status}`; no self/duplicate active edges; both endpoints and evidence readable |
| `LocalReviewDecision` | `{expected_revision,action:'approve'\|'reject'\|'archive'\|'restore'\|'supersede',reason,replacement_id?,expected_replacement_revision?}`; owner route only |
| `LocalOperation` | `{request_key,payload_sha256,actor,expected_heads,outputs,result_refs}`; exact replay returns original IDs only after fresh access checks; changed payload gives 409 |
| `LocalJob` | `{id,operation,source_version_id,pipeline_version,state,attempt_count,available_at,lease_digest,lease_expires_at,heartbeat_at,last_error_code}`; operational events, no raw error/source snippets |
| `LocalAgent` / `LocalGrant` | UUID, display metadata/status; credentials only digest/prefix/issue/expire/revoke metadata; scope/project/item operations `read\|propose\|process_knowledge\|capture_project_knowledge` |
| `LocalTask` | UUID, exact source/version/content revision, ≤20 chunk IDs, selected collection IDs, named agent/grant, state/revision, first claim/lease metadata, delivered coverage and submission reference |
| `LocalOrganizationSubmission` | Original section 5.9 fields plus new local evidence schema; server resolves actor/audience; max 256 KiB; 20 memories/20 entities/40 relationships/30 classifications/30 tags |
| `LocalContextPacket` | `{schema_version:1,trace_id,mode:'lexical_graph',items,warnings,has_more,continuation,budget:{requested,used,measure:'utf8_conservative_estimate_v1'}}`; source refs carry exact version/offset/hash; no hidden titles |
| `LocalGraphSnapshot` | `{revision,nodes,edges,warnings,has_more,continuation}`; explicit node kind/review/freshness; edge type, structural/semantic origin, evidence refs and nullable agent-reported confidence |
| `LocalBackupManifest` | `format_version:1`, creation/app/pipeline versions, vault-relative file list with byte size/hash/kind, IDs/reference summary, exclusions and completeness state; no credentials or active sessions |

Flat Markdown evidence encoding: `evidence_refs` is a quoted string list, each value `versionUUID|chunkUUID-or-empty|start|end|sha256`; parse into `LocalEvidence` and reject malformed strings. `structured_json` is one quoted, bounded canonical JSON scalar validated as data, with the meaningful explanation in the Markdown body. Human-readable `[[...]]` links accompany evidence/supersession references. Do not use a second hidden authoritative content database.

### 5.4 Defaults, limits and error behavior

P0 note/text/Markdown payload ≤2 MiB raw; normalized text ≤2 MiB; manual title ≤160 chars; summary ≤2,000 chars; structured JSON ≤16 KiB; 30 tags/memberships. Store unsupported inert attachments ≤20 MiB via a dedicated octet-stream endpoint; reject executables/scripts, HTML/SVG active previews, archives and macro formats. Allowlisted stored formats: PDF, PNG, JPEG, WebP, TXT, MD, CSV and JSON. P0 text extraction only note/TXT/MD and URL HTML/text; X01 adds PDF. CSV/JSON/images remain original-byte attachments until a selected parser exists. Never parse a file merely from its extension; validate media/signature and UTF-8 where applicable.

Existing legacy scanner limits (2 MiB/file, 16 MiB total, 2,000 notes, 5,000 entries, depth 12) remain fail-closed until measured upgrade. New domain discovery: metadata pagination 100/default, 250/max; at most 5,000 logical items, 50,000 managed files, depth 16, 64 MiB aggregate Markdown per scan, 1 GiB total originals default admission bound. Inventory errors/truncation block dependent writes/export rather than acknowledging completeness. Use lightweight metadata and lazy body reads; do not return 64 MiB in `/vault`. A future configurable limit increase needs measurement, not a silent cap removal.

Chunk target 400/max 800 conservative UTF-8 units, heading/fence/paragraph boundaries preferred. A single oversized block splits at code-point-safe newline boundaries with explicit continuation metadata. Task batch ≤20 chunks, source-range read ≤10 chunks plus budget packing. Search 25/default, 100/max; graph default ≤500 nodes/2,000 edges, expansion ≤1,000/4,000, depth 1/default/2/max. 5,000-node render benchmark is synthetic stress evidence, not a default response size.

HTTP errors preserve `{error:{code,message,request_id,details?}}`: 400 invalid, 401 session/credential missing, 403 forbidden operation, 404 absent/inaccessible individual, 409 revision/request/head conflict, 413 bound, 415 unsupported type, 429 rate/concurrency, 503 local dependency/storage failure. Validate error DTOs too. No token, SQL, original source text, private title, arbitrary path or secret scanner match in error/log output. Failed extraction does not erase an accepted original or falsely mark it organized.

### 5.5 Local permissions and owner review

Browser owner session remains the local app's same-origin HttpOnly/SameSite cookie with Host/Origin/Sec-Fetch checks. New mutation routes require that cookie and JSON content type, except bounded upload. Bearer agents never become owner because a browser cookie happens to be present. Split owner/agent routers and derive one principal explicitly. No Neon account session is required.

Preserve the installed Codex token, DPAPI file, agent ID and expiry. Import only its current token digest into the local API identity registry; never rotate/reveal it during migration. Existing three workflow tools retain repository-scoped automatic registration/context/capture plus explicitly shared owner K01 preferences/constraints. This compatibility grant does not include imported sources, task processing, verified-memory approval, owner settings or export. New sources default personal; processing requires explicit named-agent/version grant even if their project has shared K01 notes.

Additional local agents can be created in owner UI with granular grants; token returned once, then only digest/prefix stored. Do not install/configure a client automatically. Reads/claims/renewals/submissions/replays recheck credential, expiry, grant, sensitivity, source version and evidence intersection. Processing personal source content is allowed only through its purpose-scoped task endpoint; no general private-source/memory discovery. Custom private collection labels require explicit owner selection. Expiry defaults 24 hours for processing grants, max 7 days; revocation fences late writes. Previously delivered content cannot be recalled from an agent session.

Existing K01 `active` means eligible agent-recorded reusable knowledge, not owner-verified memory. New imported proposals are separate schema-3 memory records. Review does not rewrite `knowledge_basis`, fabricate owner statements or change historical originals. Verified `active` memory requires owner approval and valid current evidence. Directly edited approved body/evidence becomes stale and leaves authoritative retrieval until revalidated.

### 5.6 Ingestion, jobs and agent tasks

Capture flow: select/paste → validate/default personal → preserve exact bytes/version → commit source + queued deterministic work → normalize/secret scan/chunk/index → searchable source + Inbox state → optional explicit processing grant → Awaiting agent → existing agent claims/reads/submits → Review pending → owner decision → organized if all batches/reviews complete. Owner can organize manually without an agent. Capture success never depends on agent availability.

One deterministic worker thread runs while API is active and work exists; no persistent service or model call. Default concurrency 1. Job lease 120 seconds; heartbeat 30 seconds; retries 5/30/120 seconds, max 4 attempts; retry only transient I/O/availability errors. Deterministic invalid formats fail once. Queue survives API exit. Source/version + pipeline/operation hash is job identity; completed stage hashes are reused. Idle worker exits, new work restarts it. Shutdown checkpoints/fences work and terminates only its own worker.

Agent task lease 15 minutes; renewal ≤60 minutes since first claim and never beyond grant expiry. Store only lease digest. Same-agent claim retry rotates/fences previous lease, other-agent claim conflicts. Expired/released task returns Awaiting agent; cancelled/replaced-version task cannot accept late submissions. Submission requires all assigned batch chunk IDs declared covered and previously delivered, exact evidence hashes and current grants. Coverage proves delivery/declaration, not comprehension. Canonical facts/relationships always remain proposed until review; confidence is agent-reported. Auto-classification ≥0.85 only with explicit owner auto-classify policy for existing selected collections; manual include/exclude always wins, 0.60–<0.85 goes to review, lower remains Inbox. New collection proposals never auto-create collections.

### 5.7 Retrieval and full MCP surface

Keep the existing three `atlas_*` tools and their inputs/defaults. The old handoff's fifteen tools have different names; the finished additive surface is **18 tools**, not replacing the three with a total of fifteen. New local domain tools use the original names/arguments below, snake_case schemas, server-derived identity and one JSON text content block. Existing character-budget tools keep compatibility; reviewed-domain retrieval adds token-budget packets and an explicit supplement rather than silently swapping response shapes.

| Tool | Required/optional inputs | Route under `/api/v1/agent/domain` |
|---|---|---|
| `search_knowledge` | query; project_id?, collection_id?, memory_types?, detail?, continuation?, token_budget? | POST `/retrieval/search` |
| `get_project_context` | project UUID or unique slug; detail?, observed_repository_commit?, token_budget? | POST `/retrieval/project-context` |
| `get_memory` | memory_id; include_history=false, token_budget? | POST `/retrieval/memory` |
| `get_related_knowledge` | item_id; depth=1 (max2), relationship_types?, token_budget? | POST `/retrieval/related` |
| `read_source` | source_id; version_id?, either chunk_ids? or range?, token_budget?, continuation? | POST `/retrieval/source` |
| `get_recent_changes` | project_id?, since?, until?, limit=25 (max100), token_budget? | POST `/retrieval/recent` |
| `propose_memory` | idempotency_key, title, type, summary, structured_content, scope, evidence, claim_kind; project_id? | POST `/proposals/memory` |
| `propose_relationship` | idempotency_key, from_item_id, to_item_id, relationship_type, evidence, claim_kind | POST `/proposals/relationship` |
| `propose_decision` | idempotency_key, title, summary, project_id, decision{problem,choice,rationale,consequences}, evidence; replaces_memory_id? | POST `/proposals/decision` |
| `list_knowledge_tasks` | project_id?, limit=25, cursor? | POST `/tasks/list` |
| `claim_knowledge_task` | task_id; token_budget? | POST `/tasks/:id/claim` |
| `read_processing_source` | task_id, lease_token; chunk_ids? or range?, cursor?, token_budget? | POST `/tasks/:id/source` |
| `renew_knowledge_task` | task_id, lease_token | POST `/tasks/:id/renew` |
| `release_knowledge_task` | task_id, lease_token; reason=interrupted (interrupted/context_limit/unable_to_process) | POST `/tasks/:id/release` |
| `submit_knowledge_organization` | task_id, lease_token, idempotency_key, organization | POST `/tasks/:id/submit` |

MCP process uses API only, no core/SQL/filesystem source access except existing repository identity logic. Add `GET /api/v1/agent/domain/session` for credential-bound identity/capabilities, no workspace spoofing. Domain owner endpoints live under `/api/v1/local/domain`, never exposed as MCP approval/export/grant tools. The existing MCP `runtimeMode` cloud fallback stays isolated; new domain tools explicitly require local mode.

Retrieval order: current visibility/evidence/freshness filtering → exact identifiers/title/approved alias → deterministic lexical rank (local inverted index, no SQL) → selected project/owner critical constraints → ≤20 approved relationship neighbors at depth≤2 → whole-item packing. Tie-break score, approved status, logical ID; no recency-based truth selection. Approved summaries are stored owner-reviewed facts, not runtime generated text. K01 compatibility results retain agent-recorded labels; default `get_project_context` sections clearly distinguish owner-verified domain facts and reusable agent-recorded subjects.

New tool budget range 256–8,192/default2,048 conservative units. Measure the final serialized JSON text as `ceil(UTF8Bytes * 1.10)+64`, recomputing budget metadata until stable. This is an estimate, not exact tokenizer/client usage. Include envelope, citations, escaping, warnings and continuation. Never cut an item/code block mid-span. If critical constraints cannot fit, return a bounded `BUDGET_INSUFFICIENT` packet with omitted critical IDs only when readable. If even error envelope cannot fit, return fixed schema error without pretending it meets the requested packet budget. Continuations expire after 10 minutes, bind principal/query/filter/index revision and reauthorize every call; no permission cache. Record query hash and selected IDs/revisions/ranks, not raw queries/content.

### 5.8 UI and graph behavior

Keep existing shell, copy, fonts and charcoal/sage palette. Add Workspace, Inbox, Sources, Review, Knowledge graph, Activity, and Settings destinations only when their backing operation exists. Preserve `/inbox` legacy All files URL via a `view=all` compatibility state and make the new Inbox's Awaiting agent / Processing / Review pending / Failed tabs explicit. Existing Knowledge/Activity/All files filters remain accessible.

At widths ≥1280px use 240px navigation + flexible main (min 420px) + 340px inspector when open. At 768–1279px navigation remains compact/labelled and inspector becomes an overlay with focus return; below768px use one content column, labelled mobile navigation and a full-height detail sheet. At320/390px actions wrap and content has no document horizontal overflow; code/evidence regions can scroll internally. Use 44px touch targets, 200% text enlargement, keyboard access, visible focus, live save/error states, Escape dismissal, focus containment and reduced motion. Do not hide source evidence or essential actions to fit. Editor state is never cleared by polling; prompt before discarding an unsaved local draft on navigation. No raw HTML rendering or third-party resource fetching in preview.

Graph nodes add sources, approved memories/entities and existing project/K01 records. Structural membership/wiki/reference/evidence links are distinct from approved semantic relationships. Unknown review/confidence stays unknown; agent-reported confidence is labeled. Relationships map without inventing facts: USES→uses, DEPENDS_ON→depends_on, BELONGS_TO→part_of, REFERENCES/DOCUMENTS→references; extend the renderer `Relation` union for IMPLEMENTS/RELATED_TO/REPLACES/RESOLVES instead of silently conflating meanings. Direction preserved. Proposals appear only in an explicit owner proposal view; no inferred edge becomes verified from animation. Save layout/camera/filter state locally keyed by graph/data/layout revision; do not write view coordinates into knowledge content. Progressive expansion and accessible list fallback remain mandatory.

### 5.9 Proposed additional dependencies and primary guidance

Only add a dependency in its consuming step, with an exact pin and frozen lockfile thereafter. The following are proposed, not installed or locally typechecked:

| Pin | Purpose / consuming step | Preflight |
|---|---|---|
| `parse5@8.0.1` in `@atlas/core` | Inert HTML AST parsing for R09 | Published package version and ESM/types confirmed by primary package/source pages; smoke-test import and AST types against Node24/TS7 |
| `ipaddr.js@3.0.0` in `@atlas/core` | IPv4/IPv6 normalization/range checks for R09 | Primary repository manifest says ESM/Node≥12/types; verify exact published version/integrity before installation |
| `pdfjs-dist@6.4.299` in `@atlas/core` | Text PDF extraction in X01 | Primary npm version listing and matching upstream tag inspected; upstream Node requirement includes ≥24.15.0, compatible with project ≥24.18.0; inspect actual package declarations and built entrypoints before using |

Suggested execution commands, one at a time in consuming phase: `pnpm --filter @atlas/core add --save-exact parse5@8.0.1 ipaddr.js@3.0.0`; later `pnpm --filter @atlas/core add --save-exact pdfjs-dist@6.4.299`. Do not install native rendering dependencies just for text extraction, bypass build approval policies, use `skipLibCheck`, or substitute an unpinned latest package. If publication/types/runtime safety differs materially, block that adapter and revise its pin/design with evidence; independent core work can continue.

Primary references consulted for these choices: [parse5 documentation](https://parse5.js.org/), [parse5 package metadata](https://www.npmjs.com/package/parse5?activeTab=versions), [ipaddr.js source/usage](https://github.com/whitequark/ipaddr.js), [ipaddr.js manifest](https://raw.githubusercontent.com/whitequark/ipaddr.js/main/package.json), [PDF.js package versions](https://www.npmjs.com/package/pdfjs-dist?activeTab=versions), [PDF.js v6.4.299 engine declaration](https://raw.githubusercontent.com/mozilla/pdf.js/v6.4.299/package.json), [PDF.js v6.4.299 API source](https://raw.githubusercontent.com/mozilla/pdf.js/v6.4.299/src/display/api.js), [Node24.18 HTTPS API](https://nodejs.org/download/release/v24.18.0/docs/api/https.html). Use local installed type declarations before specifying exact call options. These support parser/network choices, not product completion claims.

## 6. File change map

All paths here are relative to the explicit project root. New paths do not yet exist unless marked existing. Add public subpath exports in `packages/core/package.json` only for Node consumers; `apps/web` imports contracts only.

| Steps | File/resource | Action and anchor | Purpose |
|---|---|---|---|
| R01, all checkpoints | Existing `docs/{TASKS,PROGRESS,ARCHITECTURE,SESSION_LOG}.md`; new `docs/LOCAL_COMPLETION_REPORT.md` | Append truthful status/rebase section, keep historical rows | Evidence and resumability |
| R02 | Existing G04 graph files/tests/report listed in §4 | Finish G04 S06/S07; scoped fixes only | Close current unverified graph work |
| R03 | New `packages/contracts/src/local-domain.ts`; existing `src/index.ts` | Add/export contracts in §5 | Browser-safe DTOs |
| R04 | New `packages/core/src/local/{files,transactions,records,catalog}.ts`; existing `local-vault.ts`, core `package.json` | Share existing safe writes/locks, commit-aware discovery/projection | Local atomicity/recovery |
| R05–R10 | New core `local/{sources,attachments,ingestion,jobs,runner}.ts`, `local/parsers/{text,url,html}.ts`, `local/security/{secret-scan,url-policy}.ts` | Version store, bounded parsing, jobs | Reliable source ingestion |
| R06–R10 | New API `local-domain.ts`, `local-upload.ts`; existing `local-vault.ts`, `app.ts`, `index.ts` | Separate owner routes and upload policy; compose local job runner | Owner access and runtime wiring |
| R06/R14/R19 | New web `app/local/{CapturePanel,SourceEditor,SourceReader,InboxView,ReviewView,AgentSettings,BackupView,LocalWorkspace}.tsx`; existing `LocalApp.tsx` | Extract without shell rewrite; typed API query/mutation hooks | Complete UI |
| R11–R14 | New core `local/{agents,authorization,tasks,submissions,reviews,lifecycle,organization}.ts`; API `local-agent-domain.ts` | Local identities/grants, tasks, review and manual controls | Trustworthy collaboration |
| R15/R16 | New core `local/{search,retrieval,budget,continuation}.ts`; API routers | Deterministic bounded retrieval | Useful agent context |
| R17 | Existing MCP `src/{index,workflow,cli}.ts`; new `src/domain.ts`; existing `docs/CODEX_GLOBAL_INSTRUCTIONS.md` | Add fifteen tools, document additive installed workflow separately | Full MCP without model API |
| R18 | Existing graph adapter/renderer consumers; new core `local/graph.ts`, web `app/local/graph-layout.ts` | Domain graph DTO, typed relation mapping, local view state | Richer true graph |
| R20 | New core `local/{activity,traces}.ts`, web `app/local/ActivityView.tsx`; local API | Redacted actual events and trace inspection | Explain real changes/retrieval |
| R21 | New core `local/{backup,restore}.ts`, scripts `backup-local-vault.ts`, `restore-local-vault.ts`, `verify-local-restore.ts`; new `docs/BACKUP.md` | Local-only export and restore; historical exporter untouched | Disk-loss recovery |
| R22/R23 | New `docs/LOCAL_RELEASE_CHECKLIST.md`, existing README/SETUP/SECURITY if present; create absent docs explicitly | Measured release report and operating guide | Personal handoff |
| X01 | New core `local/parsers/pdf.ts`, `local/pdf-worker.ts`; source reader | Bounded PDF text extraction and page map | PDF child |
| X02 | New `docs/EXTENDED_INTEGRATIONS_PLAN.md` during selected extension; parsers named in §10 | Independent inert importer children | Deferred integrations |
| R03–R23/X01 | New unit tests `tests/unit/local-{domain,transactions,sources,ingestion,agents,tasks,submissions,reviews,retrieval,graph,backup,pdf}.test.ts`; integration `tests/integration/local-domain*.test.ts`; browser `tests/local-browser/local-{capture,review,workspace,recovery}.spec.ts`; new MCP `tests/mcp/local-domain.test.ts` | Add tests with real failure/race/restore scenarios | Acceptance matrix below |
| R04/R17/R21/R22 | New `tests/vitest.local.config.ts`, `tests/vitest.mcp.config.ts`; existing package scripts/fixture | Isolated local suites, not cloud DB runner | Repeatable safe commands |

No database migration, Neon resource, n8n instance, global instruction/config file, startup task or unrelated repository is in this change map. Local installed-client acceptance uses existing configuration; if it genuinely requires a new global change, make the exact additive patch reviewable and obtain the relevant authorization rather than assuming this plan installs it.

## 7. Ordered execution steps

The blocks below are the execution contract. Algorithms and proposed contracts are design instructions, not tested implementation. Before each step, mark its status In Progress in task tracking; after it passes, record actual evidence and update this checklist. A failed dependent gate remains incomplete.

### R01 — Establish an execution baseline and rebase tracking

- **Depends on:** a later implementation request; none for reading this plan.
- **Target/preflight:** root instructions, §4 source map, Git state and mandatory tracking documents. Confirm L01 local runtime, K01 records and G04 code remain current. `git rev-parse --verify HEAD` failed during planning; do not assume a reset point exists.
- **Action:** create `.artifacts/local-completion-baseline/` with copies/hashes of only code/config/docs targeted for change. Record original vault content hashes/IDs in an ignored manifest without printing bodies; exclude protected credentials. Add a local-completion task section mapping R-steps to historical S-steps, retaining old evidence. Record planner baseline versus newly run checks separately. Do not relabel existing completed work as unimplemented because old rows are stale.
- **Expected result:** resumable current task list, recovery artifacts and known baseline without data writes.
- **Verify:** run existing `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm verify:bundle`, `pnpm test:unit` sequentially; source hash matches §4. Record permitted/sandbox failures distinctly. Do not start cloud/Docker integration checks for this local baseline.
- **If it fails:** diagnose the exact current failure; fix only a task-scoped defect or record an unrelated baseline limitation. Stop dependent changes for materially different architecture/versions, ambiguous identity or broad broken baseline. Preserve all current files.

### R02 — Close the existing G04 acceptance gap

- **Depends on:** R01; permitted browser control for rendered acceptance. R03 can proceed independently if this gate remains inaccessible.
- **Target/preflight:** existing G04 plan S06/S07, seven theme/resolution tests, neural interaction/picking/resource/performance suites and actual local graph. Preserve original theme, volumetric layout, DPR caps and native Three pipeline.
- **Action:** finish the saved G04 matrix instead of redesigning graph. Build first, run functional cases, then isolated benchmarks. Inspect desktop/tablet/300–390px normal/expanded graph, inspector/reader, held node-origin drags, touch/pinch, picking, DPR1/2 High/Medium/Low, context-loss/retry and repeated quality changes. Inspect real sparse vault separately from synthetic fixtures.
- **Expected result:** visual/interaction evidence closes G03/G04 or precisely records remaining defects.
- **Verify:** `pnpm exec playwright test --config tests/playwright.local.config.ts --grep-invert 'measured 100/500/1500/5000'`; then the measured profile test alone. Aim ≥50 FPS at500 Auto DPR1 and ≥30 FPS appropriate Auto tier atDPR2; record FPS/p95/load/device at100/500/1500/5000. Resource counts settle without sustained growth; existing80 pulse/10 zap bounds remain. Save screenshots/JSON to `.artifacts/g04/` and update the graph report only with observed outcomes.
- **If it fails:** tune only identified renderer/layout costs within existing quality bounds, retain assertions, rerun affected checks. If browser access is still disabled, record exactly that prerequisite and keep acceptance incomplete; do not launch another control path to bypass it.

### R03 — Add local domain contracts and prevent legacy projection leaks

- **Depends on:** R01.
- **Target/preflight:** new `packages/contracts/src/local-domain.ts`; existing `index.ts`, `local-vault.ts`, `local-knowledge.ts`, core `decodeNote`/`snapshot`, web query consumers. Verify exact exported cloud/local schemas before reusing enums.
- **Action:** implement §5.3 schemas, limits and errors. Keep current local DTOs compatible. Add discriminated schema-3 decoding and separate domain metadata/body responses; never let new source/review/event files fall through as generic legacy notes into `atlas_project_context`. Use revision record UUID as file identity and logical ID separately. Add a browser-safe adapter for metadata → current graph/list DTO when needed, with honest review/freshness labels. Keep unknown/malformed files preserved and visible to owner warnings.
- **Expected result:** old three tools and UI still validate; new domain content has explicit types and cannot bypass source permissions through the legacy scanner.
- **Verify:** `pnpm typecheck`; focused `tests/unit/local-domain.test.ts` for unknown fields, bad evidence/offsets, invalid scope combinations, duplicate logical revisions and schema-2 compatibility. A source containing a unique private canary never appears in legacy project context merely because it is Markdown.
- **If it fails:** correct adapters and discriminants in all callers; do not loosen schemas or silently discard provenance. A changed existing contract needs an explicit compatibility decision before continuing.

### R04 — Implement append-only transactions and consistent local discovery

- **Depends on:** R03.
- **Target/preflight:** new core `local/{files,transactions,records,catalog}.ts`; existing `safe`, `write`, `locked`, `snapshot` in `local-vault.ts`; new `tests/vitest.local.config.ts`. Existing lock retry and exclusive no-overwrite tests must remain intact.
- **Action:** extract/reuse filesystem safety and implement §5.2. Proposed service signature: `commitLocalOperation(actor, input:{request_key:string,payload:unknown,expected_heads:LocalRecordRef[],outputs:LocalStagedRecord[]}):Promise<LocalOperationResult>`; this is a design signature, not existing API. Each output uses a new relative path and SHA-256; commits reference complete files. Add `readConsistentCatalog` and explicitly internal unlocked variants to avoid nested locks. Metadata discovery separates small logical-item projection from lazy body/original reads, checks symlinks/reparse paths and refuses incomplete inventories for mutations. Apply existing live-lock ownership rules, not PID guessing or unbounded retry.
- **Expected result:** two independent writers cannot create competing acknowledged heads; interrupted uncommitted outputs never appear as complete changes.
- **Verify:** unit + new local process suite: inject failure after manifest, after each file, before/after marker and before response; kill a child writer; exact retry recovers original IDs; different payload conflicts; simultaneous same-head changes yield one success/one409; direct edits/duplicate IDs remain preserved and surfaced. Scan-limit boundary tests show `truncated` and block dependent writes/export. `pnpm test:local` is introduced here using `vitest.local.config.ts`, including only `tests/integration/local-domain*.test.ts`, environment node/maxWorkers2, no `.env.local` or cloud fixtures.
- **If it fails:** leave pending manifests intact, report recorded integrity/lock error, repair only the faulty stage. Never fabricate a commit marker, overwrite a changed file or remove another process's live lock.

### R05 — Store originals and immutable source versions

- **Depends on:** R04.
- **Target/preflight:** core `local/{sources,attachments}.ts`, API `local-domain.ts`/`local-upload.ts`, local route composition and scoped limits in `app.ts`.
- **Action:** add owner operations `POST /api/v1/local/domain/sources`, `POST /sources/:id/versions`, `GET /sources/:id`, `GET /sources/:id/content`, `POST /sources/:id/archive`, `POST /sources/:id/restore`. Version creation requires expected content revision/current file digest; all mutations use request key. Add `POST /uploads` octet-stream (20 MiB, one stream/owner at a time) returning an opaque upload receipt; source creation consumes that receipt once. Permit only §5.4 formats/signatures, safe download names and `Content-Disposition:attachment`/nosniff. Metadata title/media/project is a separate bounded JSON request; never trust upload filename/path. Apply the larger body bound only to `/api/v1/local/domain/uploads`; source JSON remains2MiB and queue responses remain within10 seconds. Commit queued source state with original hash, never wait for parsing to acknowledge recoverable capture.
- **Expected result:** originals survive retries/failures; edits produce new versions; unsupported extraction is accurately reported while inert bytes remain recoverable.
- **Verify:** real temporary-folder/API tests for byte identity, duplicate retry, changed payload, non-UTF8 text, filename traversal, symlink, oversized/chunked upload, disconnect, digest mismatch, two editors and source version replacement. Personal source content is absent from agent routes. No writes to actual vault/cloud during tests.
- **If it fails:** preserve original/pending upload, return bounded incomplete/error state, allow retry by receipt. No broad staging-directory cleanup or false complete-source response.

### R06 — Add owner capture, version editor and Inbox

- **Depends on:** R05.
- **Target/preflight:** `LocalApp.tsx`, new `app/local/{CapturePanel,SourceEditor,SourceReader,InboxView}.tsx`, typed local API hooks. Existing All files and graph reader must keep working.
- **Action:** add New note, Paste text, Import files and Import URL entry points; URL stays unavailable with an explanatory status until R09. Show selected project, default personal scope, processing off, supported format/size and clear save status. Use a plain Markdown textarea plus inert preview/reader, no new rich-text framework. Keep drafts in memory while open; unsaved-navigation confirmation is only for actual unsaved text. Editing a schema-3 source creates a version. Editing an old/plain note offers `Create editable source copy`, preserving original bytes/path and linking provenance; do not rewrite legacy YAML or counterfeit a same-ID source. Build real Inbox from source/task/review state; preserve legacy `/inbox?view=all` compatibility.
- **Expected result:** owner can capture, edit, retry and manually organize without an agent; UI never reports a capture failed merely because no agent is connected.
- **Verify:** controlled browser capture/reload/version conflict/unsaved navigation/failed upload/empty Inbox cases, including320/390px keyboard/touch and200% text. Reader shows version/original/extraction status and archive/restore actions with correct affected evidence notice.
- **If it fails:** retain unsaved draft and original version; map known conflict/error states to explicit actions. Do not auto-retry conflicting edits with a newer expected revision.

### R07 — Implement sensitivity and processing disclosure

- **Depends on:** R05/R06; basic validation/scanning helpers may be introduced earlier without enabling processing.
- **Target/preflight:** core `local/security/secret-scan.ts`, source lifecycle, local source UI and future task guard hook. Current checkpoint secret checks remain in place.
- **Action:** scan before delivering/indexing content to agent paths: private-key blocks, common token forms and credential assignments; save only match classes/positions, never matched values in logs. Flagged sources are quarantined and owner-readable. Owner may redact into a new version or explicitly release one exact version for one named processor; general retrieval still respects its scope. Present exact version, agent, collections, expiry and consequence that content enters the agent session. Keep processing off by default; no blanket access through project registration. Do not claim a clean scan proves no secrets.
- **Expected result:** capture preserves data while every downstream agent read/claim/renew/submit can enforce quarantine/version/permission consistently.
- **Verify:** fixture secret classes/false-positive release/new-version/revocation races; no source values in error/trace/log output; an agent cannot set release/owner flags in payload. Quarantined personal title/count/canary absent from generic search/context/graph.
- **If it fails:** leave delivery disabled for affected version, preserve owner access and original bytes. Fix the shared guard; do not skip scanning to make processing pass.

### R08 — Normalize, chunk and validate exact evidence

- **Depends on:** R05/R07.
- **Target/preflight:** core `local/{ingestion,sources}.ts`, `local/parsers/text.ts`; contract evidence mapping; derived cache.
- **Action:** choose pipeline version `local-text-v1`; decode UTF-8 strictly, preserve raw bytes, normalize CRLF/CR to LF only and store normalized hash/text. Do not Unicode-normalize code/identifiers. Use a new schema-3 encoder/decoder that preserves the exact body including leading/trailing whitespace; the existing `decodeNote().markdown` trims bodies and `encodeNote` appends a newline, so neither is the canonical evidence-text codec. Split by Markdown headings, paragraphs and fenced blocks within §5.4 bounds; chunk IDs deterministic from version/pipeline/sequence/span/hash (UUID-form identifiers derived consistently, not random per rebuild). Persist canonical normalized version Markdown; chunks/index are rebuildable. Centralize code-point slicing: compute boundaries using Unicode iteration (`Array.from(text)` semantics), then map to string indices for efficient large files. Evidence validator checks nonempty range, version/hash, optional chunk containment and exact UTF-8 quote hash. Source edits stale dependencies but retain old evidence history.
- **Expected result:** exact citations open/highlight the immutable normalized version with heading and offsets; original download remains byte-identical.
- **Verify:** CRLF, emoji/surrogate pairs, combining marks, code fences, long paragraph, empty source and exact-boundary tests. Rebuild chunks twice to identical IDs/hashes. Invented version/span/hash/chunk evidence fails without publishing candidates. Browser evidence reader can display stale versus current version explicitly.
- **If it fails:** stop proposal/review for that version, preserve both raw and normalized bytes, fix pipeline and use a new versioned derivation; never reinterpret an old evidence hash under a changed algorithm.

### R09 — Import bounded public URLs safely

- **Depends on:** R07/R08 and dependency preflight in §5.9.
- **Target/preflight:** core `local/parsers/{url,html}.ts`, `local/security/url-policy.ts`; owner `POST /api/v1/local/domain/import-url`; source capture UI. Use Node24 installed HTTPS types and exact pinned parsers.
- **Action:** accept owner-selected HTTPS443 only, no userinfo, IP-literal shortcut, fragment authority, local/localhost/single-label hostname or forwarded credentials/cookies. Resolve all A/AAAA answers and reject the request if any answer is not public unicast; normalize mapped IPv6 and deny private/link-local/loopback/reserved/multicast/documentation/transition ranges. Pin an approved resolved IP in the actual `https.request` lookup, preserve hostname for TLS verification/SNI/Host and validate remoteAddress; `agent:false` avoids connection reuse across destinations. Re-resolve/revalidate every redirect (max3); never preflight DNS then call unrestricted fetch. Total deadline15s, connect5s, raw and decompressed body each≤2MiB, expansion ratio≤20, content types only HTML/plain/Markdown. GET only, explicit user agent, no authenticated pages, JS execution or subresource fetches. Extract inert parse5 AST text, preferring `main`, then `article`, then body; skip script/style/nav/form/template and preserve headings/code with deterministic LF text. Store original response bytes/final URL/redirect metadata locally; HTTP failure is not an empty successful source. Download links are not silently followed as binary imports.
- **Expected result:** one explicit import yields a traceable immutable source; the ordinary offline vault makes no network requests.
- **Verify:** injected resolver/transport fixture tests for rebinding, mixed public/private answers, mapped IPv6, redirects to metadata/local hosts, invalid TLS, compression bomb, slow stream, wrong type and size. Test permitted HTTPS AST path with controlled transport; do not remove loopback protections to test the SSRF guard against localhost. At final acceptance, owner-selected public documentation can verify one real GET; source publication/POST is not involved.
- **If it fails:** return safe import error and retain only task-owned incomplete records. Block URL adapter if package/types/network policy cannot be established; do not weaken TLS/host/IP checks.

### R10 — Add durable deterministic ingestion jobs

- **Depends on:** R08/R09 (R08 text jobs can be wired while URL adapter remains gated).
- **Target/preflight:** core `local/{jobs,runner,ingestion}.ts`, API local branch startup/shutdown and source state aggregation. No AI/provider or external agent code may enter worker.
- **Action:** persist job events under `.atlas/operations`, use source-version/pipeline/operation idempotency, §5.6 leases/retries, stage results and cancellation fencing. Worker thread does parsing/chunk/index; commit validated outputs through main local service. Start on app boot when queued jobs exist and when capture queues work; exit idle without a permanent polling service. Restart resumes incomplete stages after lease expiry. Schema/version errors fail nontransiently. Owner retry/cancel routes require expected revision. Aggregate source state from all jobs/tasks/reviews; partial completion must not read organized.
- **Expected result:** application exit/restart recovers captures deterministically and ordinary capture/retrieval stays responsive.
- **Verify:** process kill mid-stage, deadline expiry, repeated enqueue, source replacement, job cancellation, two API/worker attempts and stale late result. Fresh process reads same originals/chunk IDs. A pending agent task remains Awaiting agent indefinitely without launching anything.
- **If it fails:** fence job and preserve input/stage results; show explicit failure. Do not increase concurrency or retry deterministic malformed files to hide a stalled stage.

**Checkpoint C1 — Capture without AI:** R03–R10 source/version/reader/Inbox/privacy/evidence/job tests and existing K01 compatibility pass. Owner can save/edit/find/download/archive/restore sources with zero connected inference agent. R02 may remain a documented rendered prerequisite; no feature claims beyond observed adapters.

### R11 — Add local agent identities and API grants

- **Depends on:** R04/R07/R10.
- **Target/preflight:** core `local/{agents,authorization}.ts`, API `createLocalServices`/agent middleware, owner AgentSettings. Existing installed token/ID/expiry and DPAPI file must remain untouched.
- **Action:** implement §5.5 capability/grant matrix and local credential registry. Bootstrap installed identity from already available token digest in process, preserving compatibility authorization and no imported-source grant. Add owner `GET/POST /agents`, `POST /agents/:id/{disable,credentials,grants,revoke}` under local domain. Generate32 random bytes for new tokens, return once, store only SHA-256/prefix; logs never contain raw value. No owner route accessible by agent principal. Read/grant/revoke checks use current committed registry every request, no positive cache. Access-partition keys include exact scope/project/agent/audience; derived records intersect all evidence and endpoint visibility.
- **Expected result:** multiple API identities can be scoped/revoked without pretending to restrict direct filesystem programs.
- **Verify:** two synthetic agents/two projects +personal/global/agent-private/shared scopes; expiry/disable/revoke/no-op retry and enumeration denial across search/evidence/graph/traces/task APIs. Current three workflow tools still auto-create/reuse projects and capture K01 subjects without per-note approval. New source/owner export/approval denied to compatibility token without explicit grants.
- **If it fails:** retain existing protected configuration and deny new domain access. No credential reset, blanket grant or OS isolation claim as a workaround.

### R12 — Implement exact-version processing tasks and leases

- **Depends on:** R10/R11.
- **Target/preflight:** core `local/tasks.ts`, API `local-agent-domain.ts` tasks routes and owner processing controls. Reuse local transaction protocol, not cloud SQL lease functions.
- **Action:** create batches≤20 chunks for selected immutable source/version/content revision and named agent/collection grant. Implement list/claim/source/renew/release per §5.6 and §5.7. Only list eligible task metadata; task-source route returns delivered batch chunks/ranges, no full personal history. Store coverage delivery events. Preflight budget envelope before committing a claim; never strand a newly issued lease in an unreadable response. Add owner reassign/cancel/revoke with expected revision, fencing old claim. Personal source stays absent from general source/memory APIs despite processing grant.
- **Expected result:** an already-running authorized agent can resume bounded work; version change/revocation immediately stops future operations.
- **Verify:** two claimants, same-agent rotated claim, stale renew/release,15/60-minute clock cases, grant expiry, source edit between read/submit, quarantine, process death and tiny-budget claim. Fresh process sees pending task/lease state. Use injected clocks, not long sleeps.
- **If it fails:** retain task awaiting/claimed state accurately, fence uncertain writes and allow explicit release/retry. Do not disclose whole source to avoid batch boundaries.

### R13 — Validate submissions and preserve manual organization

- **Depends on:** R12.
- **Target/preflight:** core `local/{submissions,organization}.ts`, API proposal/task-submit routes; owner manual tag/collection controls. Original `organizationBatchSchema` is reference; local evidence offsets use R08 mapping.
- **Action:** validate complete bounded payload/coverage/source revision/lease/rights at one commit. Resolve unique local candidate IDs to new immutable IDs, validate endpoints/evidence/audience and persist submission + candidates + eligible classification events in one operation. Add manual include/exclude/move/tag events with expected revision, seeded taxonomy lookup and explicit conflict handling. Implement local owner project create/edit/archive/restore and collection create/edit/move/merge routes in the same `local/organization.ts` service; the old SQL organization service is not a local persistence adapter. Keep project/repository/collection IDs and directories stable, overlay new display metadata using events, reuse imported72 definitions, reject parent cycles and require explicit child-collision mapping for merges. Manual projects may be unbound; linking a repository is an explicit owner action, never guessed by title. Existing automatic ensure must honor archived/conflicting repository identity without creating a duplicate. High-confidence automatic classification obeys stored owner policy and manual exclusions; all semantic content and new collection suggestions remain proposed. Exact idempotent replay returns same candidate IDs only while currently authorized; different hash409. Source summary is review candidate. No partial candidates on invalid evidence.
- **Expected result:** trustworthy reviewable suggestions plus owner organization; no silent canonical promotion or loss of manual intent.
- **Verify:** invalid/deceptive coverage, duplicate local IDs, private endpoint, invented span/hash, changed source, revoked replay, race with manual exclusion, partial multi-batch state and interrupted commit. Confirm one acknowledged set of IDs after retry. Owner manual organization/project/collection operations work without an agent; nested move cycles, archived ensure, explicit merge child collisions and preserved memberships/overrides pass without rewriting original catalogs.
- **If it fails:** reject the operation with bounded structured reasons and retain claim for correction within lease. Do not apply the valid-looking subset of an invalid atomic submission.

### R14 — Implement review, evidence and lifecycle

- **Depends on:** R13.
- **Target/preflight:** core `local/{reviews,lifecycle}.ts`, owner review routes, `ReviewView`/`SourceReader`; no agent approval tool.
- **Action:** show candidate content, claim kind, agent provenance, evidence quotes/currentness, affected scope and replacement target. Implement proposed→verified→active as one owner-reviewed commit recording both transitions; reject; archive; restore-to-review; supersede only alongside approved compatible replacement and expected revisions for both. Approval cannot verify missing/edited/private-incompatible evidence. Source version changes/private sharing changes make dependent active facts/relations stale/unavailable to authoritative retrieval. Keep K01 active/agent_recorded semantics separate. Direct edited candidate/active bodies warn and require revalidation; never infer approval from frontmatter alone. Link old/new records and preserve complete history.
- **Expected result:** owner explicitly controls verified memory; original capture still needs no routine per-note approval.
- **Verify:** transition table, agent approval denial, simultaneous approve/supersede, malformed quote, archive/restore/reject, direct-edit invalidation, changed evidence/private revocation and cycle prevention. Browser side-by-side evidence/keyboard/mobile actions pass. A verified field supplied in candidate JSON is rejected.
- **If it fails:** keep existing active head unchanged or affected claim unavailable, report precise conflict/staleness. Never label a proposal verified solely because assertions need it.

**Checkpoint C2 — Source-backed collaboration:** no provider process; source/batch/version/actor provenance exact; permissions, leases, atomic submissions and owner review pass. Existing K01 automatic capture remains separate and functional. API permission tests do not claim OS process isolation.

### R15 — Build approved summaries, aliases and lexical indexes

- **Depends on:** R14.
- **Target/preflight:** core `local/search.ts`, deterministic materialization job and owner review metadata. Index is derived from committed records, never source of access authority.
- **Action:** normalize lexical tokens deterministically without changing stored code/text; preserve exact path/symbol/identifier search fields. Index current permitted source chunks and active, nonstale reviewed memory summaries/approved aliases. Alias/source-summary suggestions need review before entering approved fields. Partition indexes by project/scope/audience metadata, then reauthorize candidates at query time. Record record/pipeline/hash revision; direct edits invalidate corresponding documents. Rebuild after deleting only task-owned derived index in fixtures; ordinary app can lazily rebuild missing derived data.
- **Expected result:** exact identifiers retrieve relevant sources/approved facts without embeddings or a database.
- **Verify:** punctuation/case/path/table-symbol aliases, approved versus pending alias, stale index/source replacement, private partition and rebuild equivalence. No raw secret-quarantined content in agent index responses; owner can still inspect quarantined original explicitly.
- **If it fails:** fall back to bounded authorized lexical scan with warning or return indexing pending; never use a stale permission-filtered cache as authority.

### R16 — Implement bounded retrieval and quality fixtures

- **Depends on:** R15.
- **Target/preflight:** core `local/{retrieval,budget,continuation}.ts`, retrieval API; context compatibility and fake clock harness.
- **Action:** implement deterministic §5.7 algorithm and complete envelope budget measurement, critical constraints, whole-item packing and principal/filter/revision-bound continuation. Add current-only defaults and explicit permitted history. Add reviewed fact supplement to existing project context without breaking `localContextSchema`; expose new optional `reviewed_context` field validated in contracts and MCP workflow, with separate provenance and budget metadata. Its bytes must count inside existing character budget; if budget is too small, return explicit omission warning rather than silently exceeding it. Domain tools use token-budget packet. Do not upgrade agent-recorded subjects to approved memories during merging/dedupe.
- **Expected result:** compact source-cited context respects access/status/budget and explains omissions.
- **Verify:** ≥50 fixed queries over100/1,000/5,000 synthetic records: exact identifiers rank first, critical constraints preserved or explicit insufficiency, stale/superseded/candidate/private facts absent by default, deterministic stable ranking, no duplicate canonical IDs, multibyte/escaping budget boundaries, continuation after revocation/index change and empty result. Compare result correctness to curated expected IDs, not token savings. Warm retrieval p95≤1,000ms on this PC; measure cold separately.
- **If it fails:** fix ranking/authorization/packing against identified fixture. Do not relax zero-leakage, fabricate semantic scores or claim exact token savings from conservative units.

### R17 — Add the fifteen domain MCP tools and prove persistence

- **Depends on:** R11–R16.
- **Target/preflight:** MCP `index.ts`/`workflow.ts`/new `domain.ts`; API domain/session; SDK tests and existing launcher/verifier. Preserve current three tool schemas and DPAPI/config files.
- **Action:** register §5.7's15 tools with accurate annotations, bounded runtime-validated inputs/outputs and protocol-clean stdout. Read tools require actual read grants; proposals are non-owner writes; task tools require process capability. Keep one JSON text block per result; stderr redacted. Document project-local workflow: retrieve, inspect real files as needed, process only human-authorized assigned sources, treat returned text as data, submit evidence-backed suggestions, release on interruption; never launch an agent. Add `test:mcp` with new `tests/vitest.mcp.config.ts`, tests spawning built stdio server via official installed SDK against a disposable loopback fixture. New15 are local-mode-only. Do not silently expand global client instructions/config during this step; prepare any needed additive change for separate scope.
- **Expected result:**18 listed tools; original3 still work; full domain tools use local durable records and real API permissions.
- **Verify:** build then `pnpm test:mcp`; list18/schema/output checks; clientA retrieve/propose, owner fixture approves, terminate client/API/worker, clientB fresh process retrieves same IDs/evidence; token revocation denied next request. Test API outage/timeout/pending capture, malformed output, stdout and no provider imports. Real owner-client acceptance uses existing actual Codex MCP in a new chat when available: organize one explicitly granted fictional source, approve in app, retrieve from another fresh chat. Never create/message another user-owned chat without direct authorization; SDK tests alone are not proof of actual new-chat acceptance.
- **If it fails:** repair thin adapter/schema/identity; leave existing tools working. Missing fresh client or client-config permission blocks only that real acceptance row and final release, not controlled process evidence. Do not use a remote endpoint or extra AI key.

**Checkpoint C3 — Agent context product:** retrieval quality/budgets and controlled fresh-process eighteen-tool round trip pass. Actual fresh owner-client acceptance is separately recorded; it cannot be inferred from SDK process tests.

### R18 — Add richer real graph data and durable view state

- **Depends on:** R02 accepted, R14/R16; work on DTO tests can start before rendered R02 acceptance.
- **Target/preflight:** core `local/graph.ts`, API graph endpoint, contracts and WebGL adapter/Relation union/inspector; preserve G04 scene lifecycle and styling.
- **Action:** serve bounded authorized metadata graph with explicit structural/semantic edge origins, exact relation types/direction, owner-approved review state, stale markers, evidence links and truthful unknown confidence. Include existing K01/project nodes as distinct provenance. Implement project/type/review/evidence filters, focused1/2-hop expansion and accessible list fallback; edges require visible endpoints/evidence. Use metadata nodes without eagerly shipping all source bodies. Persist browser layout/camera/filter in `localStorage` under graph+layout revision; export optional view config separately from authoritative facts. Stable IDs/positions survive view-only changes; direct additions keep prior positions. No co-occurrence edges or decorative fake statistics.
- **Expected result:** richer graph explains actual data and opens correct evidence, with current WebGL behavior retained.
- **Verify:** private endpoint/evidence denial, proposal-only view, relation mapping/direction, expansion caps, graph→source/memory reader, stale edge, saved view restart, corrupt saved state fallback and incremental placement. Run held drag/quality/resource/browser checks after adapter changes. 500node graph usable≤3s, inspector selection≤200ms, layout settles≤2s, p95 pan≤33ms; profile synthetic5000 separately.
- **If it fails:** fix affected DTO/adapter/layout path; do not fabricate relation values, restore old SVG or increase response caps to hide missing progressive loading.

### R19 — Complete responsive workspace and accessibility

- **Depends on:** R06/R14/R17/R18.
- **Target/preflight:** `LocalApp.tsx`, new `LocalWorkspace` and source/review/agent/backup views, existing `global.css`/`graph.css`. Preserve copy/design outside necessary functionality.
- **Action:** implement §5.8 layout, real navigation and typed query/mutation state. Query keys include scope/project/revision; denied/removed items are removed from detail caches immediately. Four-second foreground refresh never overwrites active drafts or steals focus; large lists use paginated metadata and selected-body loads. Add loading/empty/error/retry/permission/conflict states per operation, with no empty placeholder buttons. Use semantic forms/dialogs/headings; labels/tooltips for icons, visible focus, keyboard ordering, live feedback and reduced motion. Settings expose local agents/grants, vault/recovery and processing defaults, no API/model/billing fields.
- **Expected result:** complete owner workflows remain usable in narrow panes, enlarged text and keyboard-only operation.
- **Verify:** actual1440×900,1024×768,768×1024,390×844,320×700,300×565;200% text, reduced motion, keyboard tab/shift-tab/Escape/focus return, touch target≥44px, no clipped required action/document horizontal overflow. Inspect rendered screenshots for contrast/reader/evidence/draft preservation. Existing other routes remain coherent with graph shell.
- **If it fails:** repair local layout/state/focus behavior; do not remove content/actions, shrink text below readable size or change unrelated copy to fit.

### R20 — Show actual changes and retrieval traces

- **Depends on:** R16/R19; transaction manifests already supply mutation events from R04.
- **Target/preflight:** core `local/{activity,traces}.ts`, recent/trace endpoints, `ActivityView` and optional graph trace overlay.
- **Action:** derive activity from committed operations and observed external file changes, clearly distinguishing actor known/unknown. Trace records hold principal/query hash/filters/selected IDs+revisions/rank reasons/budget measure/elapsed time, no raw query/source content by default. Owner can open a trace on demand; agent recent changes only reveal currently readable metadata. Recheck all referenced records when viewing old events/traces; show unavailable instead of leaked titles/counts. Highlight only actual recorded accessible graph edges/items, never animate an invented agent reasoning chain. Keep existing foreground refresh; no realtime cloud service, idle event polling loop or scheduling feature.
- **Expected result:** owner sees what changed and why results were selected, bounded by current access.
- **Verify:** event count from real commits, unknown direct editor actor, revoked evidence/title redaction, historical trace with missing item, no raw query/token in file/log/API output and graph trace mapping. Raw query logging stays off with no UI implying it was captured.
- **If it fails:** disable offending trace projection, preserve audit metadata and current fact access. Do not copy private bodies into event text to make explanations easier.

### R21 — Export, back up and verify isolated restore

- **Depends on:** R04–R20; can prototype manifest/hash routines after R05, but complete recovery acceptance needs final record types.
- **Target/preflight:** new local-only core backup/restore and scripts in §6, owner BackupView, `docs/BACKUP.md`. Historical cloud exporter is not called. Actual vault remains source, never restore destination in tests.
- **Action:** use a portable directory package (manifest + relative Markdown/original/history/operational files), not a new archive dependency. Backup under an owner-selected local destination; default app export goes to ignored `.artifacts/exports/<backup-id>/` and explains same-disk limitation. Under vault lock build complete bounded inventory and hash every file; stream-copy to a new destination, rehash source/destination, finalize COMPLETE manifest only after stable successful snapshot. Exclude token/DPAPI/env/client config/active credential secrets, lock/temp files and derivable caches; preserve document history, source versions, content lifecycle, IDs/evidence/collections/manual overrides and safe grant-history metadata. Never silently omit a file or mark partial backup complete. Manifest treats credentials as disabled history; restoration cannot reactivate old sessions/grants/leases.
- **Action (restore):** validate paths/case-insensitive duplicates/reserved names/symlinks/hash/byte/count limits/manifest version before writes. Restore only into an explicitly chosen nonexistent directory, inside an approved workspace for tests. Never merge/overwrite current vault automatically. Preserve IDs/content, cancel/requeue deterministic jobs, expire agent leases and disable processing grants/credentials; reestablish real credentials separately if owner switches roots later. Default test/rehearsal target `.artifacts/restore-rehearsal/<run-id>/Vault`; fresh-process verifier uses its own fixture token/config/port, no global registration. Backup instructions explain an external/offline copy is needed for disk loss; scheduling/encryption-key storage requires separate scope. No scheduled backup job is installed here.
- **Expected result:** complete local ownership/recovery without cloud export; original vault is unchanged.
- **Verify:** `pnpm test:recovery` (introduced script pointing to `scripts/verify-local-restore.ts` after shared build) exports a fictional fixture, restores to isolated folder, compares IDs/raw bytes/Markdown/evidence/version chains/access labels, rebuilds indexes and retrieves from fresh API/MCP process. Corrupt/missing file, traversal/case collision, incomplete manifest, live lease and stale credential tests fail safely. Record bytes/duration/destination type. A real owner vault backup remains local/private and is claimed only if actually produced and checked; an off-device/disk-loss rehearsal is not implied.
- **If it fails:** retain partial package with explicit incomplete marker and original untouched; no destructive repair, original-vault overwrite or cloud branch restore substitute.

**Checkpoint C4 — Ownership:** full fixture export/isolated restore/fresh retrieval pass; no secrets/active credentials exported; original content hashes unchanged; known limitations (same disk versus off-device copy) visible.

### R22 — Run final security, quality and performance gates

- **Depends on:** R02/R17–R21 accepted; real-client row may still await actual owner interaction but must stay explicit.
- **Target/preflight:** new `docs/LOCAL_RELEASE_CHECKLIST.md`, security/evaluation fixtures, existing scripts. Tests use temporary vaults and synthetic data; never fall back to cloud URLs.
- **Action:** introduce `test:performance` for local retrieval corpus measurements plus isolated graph benchmark invocation, and `test:security:local` for local API/task/evidence/URL/recovery adversarial suites. Run standard checks in §9, then focused integration/MCP/recovery/browser/performance serially. Inspect errors/warnings and dependency declarations/bundle boundaries. Test API reboot, occupied port, read-only disk, full/admission-limit behavior, incomplete catalog, malformed YAML/duplicate IDs, NTFS lock contention, untrusted source instructions, denial enumeration, stale/revoked grants and corrupted backups. Check captures can continue when agent is absent.
- **Expected result:** release evidence covers correctness, privacy, boundedness, real rendering and recoverability; provisional speed targets are measured on this PC.
- **Verify:** §8 matrix all hard correctness rows pass; all prescribed enabled checks pass; benchmark evidence distinguishes warm/cold/synthetic/actual and hardware/profile. No critical security/data-loss defect, unexplained failing checkpoint or missing mandatory visual/client/recovery evidence. Inspect source-brief and original data hashes again.
- **If it fails:** report exact failing row, preserve evidence and fix bounded root cause. Re-run affected and dependent checks only. Do not change expected correctness or performance budgets silently; materially unsuitable target requires documented measured revision before release claim.

### R23 — Accept the personal local release and hand over

- **Depends on:** C1–C4/R22; real existing-client/browser access for full acceptance.
- **Target/preflight:** actual local app and existing installed MCP, release/operation docs. No cloud credentials or synthetic personal owner identity needed.
- **Action:** owner walkthrough: capture/version/source lookup, manual organization, explicit processing grant for one fictional source, real existing-agent submission, owner review, fresh-client retrieval, graph/evidence, revoke, process restart and backup/restore rehearsal result. Do not send messages/create another chat unless the user explicitly authorizes it; user can perform fresh-chat step directly. Update README/setup/architecture/task/progress/session/release docs with implemented local design and exact limitations. Document on-demand `pnpm start`, PC/API availability, local filesystem boundary, pending tasks, offline core versus deliberate URL fetch, restore process and P1/P2 exclusions. Zero new durable ATLAS notes is normal; routine release logs belong in reports.
- **Expected result:** a truthful verified personal local release, with implemented features versus deferred extensions distinguishable.
- **Verify:** every P0 checklist/matrix row has an observed evidence pointer and category; actual installed tools=18; existing automatic3 and fresh-process/fresh-client behavior intact. No feature marked Completed merely because code or mock tests exist. Legacy cloud C1 remains separately historical/deferred without blocking local release.
- **If it fails:** keep precise partial status and first incomplete step; report smallest required input/access without reverting working local features. Public deployment/startup/commit/push/cloud sync remain separate requests.

### X01 — Add bounded PDF extraction and attachment polish

- **Depends on:** C4/R22 and explicit execution scope including this planned extension; owner request to plan it is not installation permission by itself.
- **Target/preflight:** new `local/parsers/pdf.ts`/`local/pdf-worker.ts`, contracts/version metadata, attachment/source reader; read the available PDF skill at execution. Verify exact `pdfjs-dist@6.4.299` entrypoints/types/engine and security advisories before adding the pin. Retain strict checks.
- **Action:** text extraction only in a task-owned bounded child process, passing local Uint8Array bytes to PDF.js, no document URL/network/subresources. Disable evaluation/XFA and external font/data fetch; inspect installed API flags rather than guessing removed options. No rendering/editing/embedded attachments/action execution. Max20MiB raw,200 pages,2MiB extracted text,30-second total wall deadline; child Node heap cap256MiB plus parent-observed RSS ceiling512MiB/termination. Resource limits are guardrails, not OS sandbox guarantees. Password-protected PDFs remain unsupported with clear status, no password collection. Scanned/empty text reports OCR required; no AI/OCR. Construct normalized text/page map deterministically, retain exact original and page-to-code-point ranges for evidence. Respect original source scope/quarantine and job cancellation. Store unsupported original without false extraction success.
- **Expected result:** supported text PDFs become searchable/citable with page references; attachments remain downloadable byte-identically.
- **Verify:** known licensed/generated text/multilingual/multicolumn fixtures, scanned/encrypted/malformed/oversized/page-limit/timeout/RSS/cancel cases, no outbound request, process cleanup, stable page/quote hashes and browser evidence/attachment download. Validate text fidelity explicitly; reading order limitations are shown. Do not ship native renderer modules to browser.
- **If it fails:** preserve attachment, mark extraction failed/unsupported and keep core source workflow operational. Do not use cloud OCR, install an unpinned old PDF build or disable validation to report completion.

### X02 — Keep extended integrations as selected bounded children

- **Depends on:** R23/X01 as relevant; a later specific integration scope selection.
- **Target/preflight:** extension roadmap in §10. Do not interpret a completion-plan request as authority to connect accounts or scan unrelated directories.
- **Action:** when a child is selected, create its detailed scoped plan/tests against the stable source adapter `{bytes,media_type,origin,selected_scope}→{normalized_text,provenance,warnings}`. Preserve original bytes, generic imports and all review/evidence boundaries. No unsupported parser button shown as working. Each child updates its own status independently of the local core release.
- **Expected result:** integrations remain visible and actionable without turning P0 into an unbounded rebuild.
- **Verify:** selected child acceptance in §10 plus capture/privacy/recovery regressions; record inert file parsing separately from live service integration.
- **If it fails:** isolate unsupported format/adapter, preserve original and working core. Do not run/import/activate a workflow or transmit private data to compensate.

## 8. Acceptance and verification matrix

Each row needs actual evidence during execution. The planner has not run these checks. Fixtures use synthetic sources outside the real `Vault/`; browser visual checks use the real sparse vault only for read-only inspection.

| Requirement / scenario | Setup and check | Required result / protected regression | Steps |
|---|---|---|---|
| Existing automatic workflow | Existing3 tool schemas; fresh temporary repository/worktree identity; current knowledge subjects | Same project identity, no per-note confirmation, exact retry, correct owner/project context, no new source leakage | R03/R11/R17 |
| Atomic local capture | Crash injection at every publication boundary + two independent writers | No acknowledged partial change; no user overwrite; one valid head; retry same IDs; changed payload409 | R04/R05 |
| Incomplete/ambiguous vault | Oversize, truncated catalog, malformed YAML, duplicate ID, forked revision, broken commit | Originals preserved; explicit warning/conflict; dependent write/export blocked | R03/R04/R21 |
| Original/version preservation | Text/MD/inert attachment, same import retry, concurrent edit | Exact raw SHA/bytes retained; new immutable version; normalized hash separate; conflict not last-write-wins | R05/R06 |
| Owner capture UX | Capture/paste/upload/edit/reload, empty/failed/processing Inbox | Real persisted state; no fake organized/agent activity; drafts survive polling/failure | R06/R10/R19 |
| Quarantine/sharing | Known secret canaries, one named-agent version release, expiry/revoke | Owner access retained; no generic/task access without exact current permission; no raw matches logged | R07/R11/R12 |
| Exact source evidence | CRLF/emoji/code fence/oversized block/version replacement | Stable code-point offsets/hashes; quote opens exact immutable version; stale evidence clearly marked | R08/R14 |
| URL safety | Mixed DNS answers, rebinding, redirect, mapped IP, TLS/timeout/zip-bomb fixtures | No private request, DNS pin enforced, bounded bytes/time, no JS/subresources; failures not imported as success | R09 |
| Job durability | Kill/restart, cancel, duplicate enqueue, stale stage completion | One deterministic completed output; bounded retries; no model/agent launch; absent agent never blocks capture | R10 |
| API visibility intersection | Two agents/projects +5 scope fixtures, entity/edge/evidence/trace paths | Zero hidden titles/body/IDs/count leakage; source/endpoint rights intersect; direct OS boundary honestly documented | R11–R20 |
| Agent task correctness | Claim/race/renew/release/reassign/revoke/version-change + fake clock | Batches/coverage exact; stale lease denied; no private full-history expansion; no stranded tiny-budget claim | R12 |
| Submission atomicity | Valid proposal plus one invalid reference; same/different request replay | All candidates atomic, valid replay same IDs, revoked replay denied; manual exclusion wins | R13 |
| Review authority/lifecycle | Owner approve/reject/archive/restore/supersede, direct YAML edit and agent approval attempt | Only owner-reviewed valid evidence becomes verified; originals/history preserved; current chain unambiguous | R14 |
| Lexical retrieval correctness | Curated50 queries at100/1,000/5,000 records, approved/pending aliases | Exact identifiers first; current permitted evidence only; deterministic IDs/rank; rebuild equivalent | R15/R16 |
| Context budget | Unicode, escapes, tiny budget, many critical constraints, max source range | Complete serialized packet fits or explicit insufficiency; no misleading omitted constraint; no exact-token claim | R16 |
| Continuation | Changed index/filter/principal, expiry, revoked source | Bound to original request/current authorization; no stale-cursor disclosure or silent skipped results | R16 |
| Real MCP process | Official SDK against built stdio/API; terminate all stateful processes |18 tools; schemas validate; stdout clean; approved IDs/evidence persist; revocation/outage handled | R17 |
| Actual existing-client use | Explicit fictional source grant, actual Codex tool call, owner approval, new chat retrieval | Real client/source/submission/review IDs observed; SDK evidence separately labeled; no unsolicited chat message | R17/R23 |
| Graph appearance/function | G04 matrix; real sparse + synthetic data, normal/expanded, DPR1/2, loss/retry | Shared original theme, crisp bounded resolution, continuous drag/picking/touch, no resource growth or fake edges | R02/R18 |
| Graph semantics | Active/candidate/stale/private relations, explicit edge types/direction, focus expansion | Every edge backed by current permitted file/join/evidence; unknown confidence stays unknown; caps honored | R18 |
| Responsive/accessibility |1440/1024/768/390/320/300px,200% text, keyboard, reduced motion | Readable controls/evidence,44px touch targets, focus return, no clipped required actions or page overflow | R19 |
| Actual activity/traces | Known commit, unknown external edit, revoked historical item | Real actor or unknown, current permissions, no raw query/secret, highlight only recorded accessible IDs | R20 |
| Complete recovery | Export→new-folder restore→fresh API/MCP; corrupt/missing/path/lease fixtures | Bytes/IDs/history/evidence preserved, credentials disabled, indexes rebuilt, original vault unchanged | R21 |
| Offline/local boundary | Block external egress during ordinary capture/review/retrieval/MCP | Core works without Neon/Auth/cloud/provider requests; explicit URL import is the only selected network capture | R22 |
| Performance | Fixed corpus50 warm queries; graph500 and stress5000, measured separately | Warm retrieval p95≤1s; graph500≤3s ready/layout≤2s/picking≤200ms/pan p95≤33ms; G04 FPS targets reported | R02/R16/R18/R22 |
| PDF extension | Text/scanned/encrypted/large/malformed/time-limit fixtures, exact original download | Text/page citations correct or honest unsupported/failed status; no OCR/network/action execution | X01 |
| Release integrity | All required reports +source brief/original hashes +local fresh-client journey | No false Completed state; no cloud/startup/public/commit side effects; explicit remaining P1/P2 scope | R23 |

Hard thresholds: zero unauthorized API content disclosure; no acknowledged partial source/submission/review; exact original/evidence integrity; truthful verification state; budget correctness; no forbidden external effects. Performance thresholds are provisional acceptance targets from current plans, not observed promises. If device-specific constraints prevent a threshold, record measured profile and propose a reviewed budget change; never silently weaken a test or imply all devices were covered.

## 9. Commands, isolation and checkpoint reporting

### Existing commands — verified in current package.json, not run by this planner

Use PowerShell at the project root; issue individually and inspect each result before continuing:

```powershell
Set-Location -LiteralPath 'C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT'
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm verify:bundle
pnpm test:unit
pnpm exec playwright test --config tests/playwright.local.config.ts --grep-invert 'measured 100/500/1500/5000'
pnpm test:e2e
Get-FileHash -LiteralPath 'docs/plans/2026-10-16-atlas-source-brief.md' -Algorithm SHA256
```

Run the graph benchmark separately after build/functional tests, with no other timed work:

```powershell
pnpm exec playwright test --config tests/playwright.local.config.ts tests/local-browser/neural-performance.spec.ts --grep 'measured 100/500/1500/5000'
```

Existing offline compatibility browser fixture uses4318, owner fixture4319, local browser4320, actual app4317. Do not kill arbitrary listeners; if a test port is occupied by an unidentified process, stop that check and report it. Test runs must create temporary roots with known path prefixes and refuse the actual canonical `Vault/` path for fixture initialization/reset. Tests scrub cloud/provider environment from child processes and assert local mode/root before any write. Do not load `.env.local`, run `test:neon`, `db:migrate:neon`, historical cloud export or `neon:*` commands for this roadmap. Cloud SQL regressions are not automatically required when cloud paths are unchanged.

### Proposed scripts — add only in the consuming implementation step

These names do not exist at planning time. Add exact package.json script values below, with the listed new config/helper files; do not execute these commands before their targets exist:

| Step / script | Exact proposed package.json value | Test scope |
|---|---|---|
| R04 `test:local` | `pnpm build:shared && vitest run --config tests/vitest.local.config.ts` | New `tests/integration/local-domain*.test.ts`, node, maxWorkers2; temporary roots |
| R17 `test:mcp` | `pnpm build && vitest run --config tests/vitest.mcp.config.ts` | New `tests/mcp/**/*.test.ts`, node, maxWorkers1; process fixture4321 |
| R21 `test:recovery` | `pnpm build:shared && node --import tsx scripts/verify-local-restore.ts` | New helper; isolated restore/new-loopback process4322 |
| R22 `test:security:local` | `pnpm build:shared && vitest run --config tests/vitest.local.config.ts tests/integration/local-domain-security.test.ts` | Shared guard/visibility/task/evidence/URL/recovery negative scenarios |
| R22 `test:performance` | `pnpm build:shared && node --import tsx scripts/measure-local-retrieval.ts` | New helper;100/1,000/5,000 corpus/50 fixed warm queries; graph measured separately |

New supporting files to include in the R17/R21/R22 change map: `tests/fixtures/local-domain-mcp-server.ts`, `scripts/measure-local-retrieval.ts`, fixture assertions/clock helpers local to their tests. Respect the API Host/Origin rules using each fixture's configured port. Existing `tsconfig.tools.json` includes scripts/tests; add new source exports through existing workspace builds, not ad hoc TS transpilation exceptions.

Future local execution may need permitted pnpm/Git/temp-link/browser access on Windows. Use actual tool approval results. A rejected command or disabled browser setting is a blocked check, not a failed product assumption or permission to bypass policy. Report the specific command/check and reason; continue independent permitted work.

At C1/C2/C3/C4 and release, write `docs/LOCAL_COMPLETION_REPORT.md` with: step status; files/resources changed; exact commands and observed results; failures/fixes; screenshot/benchmark/restore pointers; synthetic versus actual evidence; remaining limitations; next unfinished step. Preserve historical reports and source hash. Update tracking without inventing test totals. Do not store these routine work logs as new durable knowledge subjects.

## 10. Extension roadmap and separate gates

The user requested a plan for everything in the status review. This section preserves extended capture/integration direction; it does not activate external accounts or broaden the local core release. Each selected child needs a concrete scoped implementation handoff after core contracts exist. X01 supplies the detailed PDF plan above; rows below remain independently selectable.

| Child / priority | Exact target and chosen bounded behavior | Acceptance and boundary |
|---|---|---|
| X02-A n8n exported JSON /P1 | New `packages/core/src/local/parsers/n8n.ts`; parse owner-supplied inert export into workflow name/node types/connections/version metadata, with credential-reference redaction and source spans | Before any n8n-specific design/execution, read `C:\Users\user\Desktop\PROGRAMMING\AUTOMATIONS\Automation Context Mapping\AGENTS.md`, Documentation, Skills/INDEX and applicable official skills. No live import/run/publish/workflow edits or env vars; no credential values. Test authentic secret-free fixtures +malformed JSON; originals unchanged |
| X02-B explicit directory import /P1 | New `local/parsers/directory.ts`; owner selects exact folder/files, preview inventory; allowlisted text/MD only, exclude secrets/.git/dependencies/build and symlink escapes | Bound items/bytes/depth; no unattended disk scan. Fixtures for ignore rules/reparse/path races/partial report; separate input-folder authorization when outside project |
| X02-C selected conversation export /P1 | New `local/parsers/conversation.ts`; only explicitly supplied supported export and selected turns, retain speaker/time/evidence, treat claims as candidates | No raw prompt/transcript retention in durable knowledge or background chat recording. Do not import unsupported arbitrary exports; verify source selection, secret quarantine and attribution |
| X02-D contradiction/duplicate comparison /P1 | New `local/contradictions.ts`, owner comparison UI; identify same-subject evidence/version conflicts and show alternatives | No automatic winner, near-duplicate merge or canonical replacement; explicit owner replacement event and race tests |
| X02-E expanded traces/batch tools /P1 | Extend `traces.ts` and owner commands; richer recorded rank reasons, batch per-item preview/result/undo when reversible | No invented reasoning path or bulk permission bypass; partial failure and manual override tests; trace complexity only after profiling |
| X02-F backup scheduling /P1 | Dedicated scheduling design only after R21 restore evidence; owner chooses path/retention/cadence/notifications | No task installed by this plan. Follow available automation tool/workflow when specifically requested; verify restore/retention and protect unrelated backups |
| X02-G GitHub/source sync /P2 | Separate read-only source-selection and later sync design, exact repo/branch/token/refresh/conflict policy | Explicit sync request and connector access; no cloud writes, account setup or commit/push inferred from local planning |
| X02-H remote MCP/multi-device /P2 | Separate hosting/OAuth/threat/privacy design, transport and filesystem access model | Public exposure and multi-user guarantees are outside trusted single-user local design; no tunnel, permissive CORS or local credential reuse |
| X02-I temporal/analytics/spatial features /P2 | Measured actual history/counters; optional temporal playback and layout views | Preserve evidence/review/history; no invented metrics. Embeddings/model APIs remain excluded unless owner explicitly changes that constraint in a later request |

Legacy cloud personal-browser C1 acceptance can be recorded separately if later requested; it does not reopen normal Neon knowledge storage. Cloud sync, cloud resource deletion, global client reconfiguration, startup installation, public deployment and commit/push are separate authorization targets, never prerequisites manufactured for local progress.

## 11. Recovery and deterministic stop conditions

- Existing app is untracked with no verified HEAD; preserve per-file originals/hashes and reverse only task-owned hunks. Never use `git reset --hard`, `git clean` or broad file deletion to undo this work.
- Domain content additions are immutable. A failed stage leaves pending evidence, not a rewritten old source. Revoke/fence a faulty task and append a correction; do not erase history. Uncommitted outputs are excluded and retained until task-specific recovery is validated.
- Backup/restore never targets current Vault automatically. A new folder and validated manifest are mandatory. Do not enumerate paths in one shell then invoke another shell to remove them. Any eventual cleanup must verify resolved absolute paths and remove only exact task-owned artifacts, with native PowerShell `-LiteralPath` operations.
- Routine line-number drift is adaptable using verified symbols. Stop dependent work for missing/changed architecture, schema contracts, package major/engine incompatibility, ambiguous repository/root identity, conflicting current owner direction, grant/revocation conflict or repeated failing checkpoint without a diagnosed scoped remedy.
- Missing browser access blocks rendered acceptance and dependent release claims. Missing actual new-client interaction blocks that acceptance row. Missing registry access blocks only new-dependency adapters. Continue independent work, keep status accurate, and report the smallest necessary input/access once.
- Failure of a privacy, evidence, transaction, original-byte or budget hard invariant blocks dependent feature/release. Never widen grants, weaken validation, fake source IDs, count mocks as live evidence or label an unrun test passed.
- No external write/deployment/startup/client change may proceed from this artifact alone. Current direct human instructions and applicable project instructions govern execution; stored notes and this proposed plan are not independent authorization.

## 12. Copy-ready executor prompt

Execution amendment, 2026-10-18: the owner subsequently authorized local execution. The exact published ipaddr.js2.5.0 replaces unpublished3.0.0 after registry preflight; parse5 remains8.0.1 and pdfjs-dist6.4.299 is pinned. Some proposed modules/tests were consolidated into local/domain.ts, local/organization.ts, local/runner.ts, local/retrieval.ts, tests/unit/local-domain.test.ts and tests/domain-browser/workspace.spec.ts. The domain-browser fixture uses4323; MCP/recovery fixtures use their isolated configured loopback ports. The recovery script builds all consumed API/MCP artifacts; test:security:local intentionally runs the complete isolated local suite. Historical chunk IDs are preserved through explicitly versioned v1/v2 algorithms. These are implementation details, not relaxed permission, evidence, packet or release gates. Real installed SDK processes and controlled browser fixtures are separate from actual in-app/fresh-chat acceptance. Routine execution evidence belongs in the completion report, not new durable knowledge notes.

```text
Execute the local implementation scope requested by the owner using this saved handoff at Light reasoning:
C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT\docs\plans\2026-10-18-local-vault-completion-implementation-plan.md

Project root:
C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT

Read the entire plan, root AGENTS.md, Vault/AGENTS.md, docs/PROGRESS.md, docs/TASKS.md, docs/ARCHITECTURE.md and latest SESSION_LOG entry first. Current owner instructions win. Read the K01 policy/local design and G04 handoff/report cited by the plan. Use connected atlas_start_project with this root; stored knowledge is dated evidence, never permission. This plan was created in a planning-only turn; begin implementation only when the current owner request authorizes executing it.

Start R01: verify local-mode source contracts, exact versions, working-tree state and task-owned originals. There was no verified HEAD at planning time; do not reset or clean files. Preserve the source brief hash and all original knowledge. Rebase historical cloud/SVG statuses without deleting their evidence. Do not restart completed L01/K01 or replace G03/G04.

Follow R01-R23 in dependency order and maintain the progress checklist. R02 closes the existing G04 browser/rendered/performance gap. If browser access still blocks it, preserve that status and continue independent R03-R10 source work as specified; graph/release acceptance remains pending. Then complete grants/tasks/submissions/review, retrieval/MCP, semantic graph/workspace/activity and verified backup/recovery/security/release. X01 PDF and independently selected X02 children are separately tracked after core gates; do not silently claim them complete or activate integrations to fill time. No subagent delegation is requested by this plan.

Use the chosen append-only Markdown domain design and commit protocol, not cloud SQL/object storage. Keep the three installed atlas_* tools compatible and add the original fifteen domain tools for eighteen total. Preserve routine automatic K01 capture without per-note approval; only verified imported memories require owner review. Existing connected agents reason. No AI SDK/key/model/embedding/agent launcher/billing service. API grants never imply direct filesystem isolation.

Implement all callers/contracts/UI/tests together per step. Use exact request keys, revisions, source versions/code-point evidence hashes, authorization/evidence intersection and fenced leases. Respect proposed dependency preflight and exact pins; never install latest or weaken strict types. Fixtures must use isolated local folders/loopback ports and no cloud URL fallback. Do not put synthetic acceptance notes into the personal vault.

Run the prescribed commands/checkpoints sequentially, distinguish baseline/historical/controlled/actual evidence and inspect rendered screenshots. Build before browser tests; benchmark separately from builds/tests. Use the specified recovery copies/immutable corrections; retain pending artifacts on failure. If an essential contract differs, a required input/access is unavailable, authorization is insufficient or a checkpoint has no task-scoped remedy, stop dependent work and report the evidence. Do not bypass a disabled browser setting or automatic approval rejection.

Do not provision/migrate/delete Neon resources, write cloud knowledge, connect/run/publish n8n, send messages/create user chats, change global client config, expose publicly, install startup/schedules, commit or push unless specifically authorized by the current user for that exact action. Actual fresh-client acceptance requires user participation or explicit chat coordination authorization; SDK tests are separate evidence.

Update project task/progress/architecture/session/report records only with observed results. Routine work logs belong in those reports; zero new durable ATLAS notes is normal. End with completed/incomplete step IDs, changed files/resources, actual verification and artifact pointers, limitations and the next unresolved gate. Do not claim the whole product complete from code changes or test counts alone.
```
