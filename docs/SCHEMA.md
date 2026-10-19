# Domain persistence — S05

L01 supersedes this database as the normal knowledge store: Vault/ Markdown bodies/YAML properties are authoritative; .atlas/ holds local requests/history/imports. Files can be edited by agents/Obsidian and are reread directly. The schema below remains historical, preserved with old cloud data/resources. No new SQL migration is needed for normal local knowledge use.

Current A01 state:18 migrations0000–0017/42 owned RLS tables on local PostgreSQL18.6 and authorized Neon production, after child rehearsal. N03 actual owner binding is complete. N01 Auth diagnostics retain their separate atlas_setup schema/journal. See NEON_DOMAIN_SETUP_REPORT.md and AGENT_WORKFLOW_REPORT.md.

A01 adds atlas_private.project_repositories (workspace repository identity/project binding), atlas.project_checkpoints (immutable bounded Markdown, actual agent, evidence/verification, time and content digest), and atlas_private.checkpoint_requests (retry aliases with digest and checkpoint FK). No file-original/source_version or canonical-memory semantics are claimed for checkpoints. Existing composite workspace FKs/permissions remain intact.

## Implemented

39 domain tables across atlas and atlas_private. All tables are owned by NOLOGIN atlas_owner and have RLS enabled. S05 initially revoked application CRUD. S06 migrations 0012–0015 now add scoped owner/agent/worker grants and policies; private ACL tables remain inaccessible. Narrow private SECURITY DEFINER helpers are introduced only by S06. See AUTHORIZATION.md; HTTP knowledge routes still await S07 and later services.

| Migration | Persistent structures |
| --- | --- |
| 0000 (existing) | Owned atlas/atlas_private namespaces |
| 0001 | Opaque issuer/subject users, owner workspaces/membership, agents, workspace settings, projects |
| 0002 | Collections, source/memory/entity/relationship item identity, source versions/chunks, many-to-many membership, manual classification overrides, tags |
| 0003 | Typed memory/history/evidence, audience-partitioned entities, explicit relationships and evidence joins |
| 0004 | Deterministic jobs/results, version-pinned organization tasks, immutable submissions, review queue |
| 0005 | Generated simple-config lexical documents, retrieval traces/items, append-only activity, graph layouts, request idempotency |
| 0006 | Digested agent credentials, explicit project/scope/item grants and expiring named source-processing grants |
| 0007 | Initial deny-by-default RLS and revoked domain application grants |
| 0008 | PostgreSQL trigram extension, full-text/trigram indexes, filtered queue/graph/memory/activity indexes |
| 0009–0011 | Immutable history, collection/merge/supersession cycles, evidence/chunk checksums and spans, exact task catalog/batch ownership, normalized content checksums, submitted-task provenance |
| 0012–0015 | Private metadata authorization helpers, scoped policies, fenced worker lease operations and full-version denial for purpose-only task batches |

Workspace-owned joins use composite workspace/ID FKs, including agent creators. Knowledge subtypes use a generated kind plus composite FK to the matching item, preventing a source row from reusing an entity ID. Current source-version FK includes source ID and is deferred to allow transactionally finalized versions while prohibiting another source's version.

Collections use NULLS NOT DISTINCT uniqueness for active root/sibling names. Parent and merge edits serialize on the workspace root before recursive cycle checks. Source versions/chunks, memory history/evidence, entity/relationship evidence, submissions, job results and activity reject UPDATE/DELETE; archival/reconciliation happens through later lifecycle services rather than erasing provenance. Version checksum validates normalized content; raw object bytes cannot be verified until S09 implements storage.

Evidence/chunk offsets are **zero-based Unicode code points, end-exclusive, in normalized_text**. PostgreSQL substring/char_length and tests (including an astral character) agree. Future JavaScript chunking must use code-point indexing (`Array.from` or equivalent) instead of UTF-16 string offsets. SHA-256 is over UTF-8 bytes of the exact normalized span. Quoted spans must lie within the named chunk/version.

Task arrays contain 1–20 unique chunks from the exact source version, and catalog entries from the same workspace. Live batch identity is unique. Lease shape and one-hour maximum are constrained; current expiry, grant checks, claim/renew/revoke fencing and state transitions still require S15/S06 services. Submitted tasks can become cancelled/superseded while retaining their immutable submission reference. Processing grants expire within seven days and have one non-revoked named processor per version; replacing an expired/current grant must explicitly revoke it first.

## Default collections and setup service

database/seeds/collections.json contains the exact nine root families and 63 children from the original brief: **72 collections** per new workspace. No notes or knowledge examples are seeded into a real workspace.

`createOwnerWorkspace(client, input)` and `seedCollections(client, workspaceId, seeds)` are setup-only core services requiring a caller-managed transaction. They are not HTTP endpoints and do not bypass application permissions. Owner binding must be verified by S07 before exposing any creation route.

Stable seed_key identifies a default independently of its display name and parent. Reruns preserve renamed, archived and moved seeds. An existing active user-created sibling can be adopted without renaming it. Workspace locking prevents duplicate seed races. New seeds record owner provenance; adoption increments revision. Collection membership always references a single canonical item; adding it to two collections does not copy the source.

## Verification and limits

- Full migration chain replayed from empty local namespaces inside a transaction, then rolled back. Existing local fixture volume preserved.
- 30 real local SQL tests pass (20 domain + 10 foundation); 52 unit/runtime/contract tests pass. Build/types/lint/format/bundle boundary checks pass.
- SQL tests cover owner/member mismatch, cross-workspace FKs, root/child uniqueness, cycles, subtype/scope forgery, immutable versions, normalized checksum, current-version mismatch, Unicode evidence, unverified-active memory, supersession cycle, active duplicate entities/relationships, task limits/foreign chunks, grants, audit actor/immutability, lexical index and mismatched search origin.
- Fixture parameter typing initially failed (UUID reused as text); fixed explicit UUID casts. No schema permission was relaxed to pass tests.
- S06 now adds 22 real owner/agent/worker authorization tests, evidence-audience intersection, revocation/expiration and fenced writes. Full lifecycle/task services and concurrency acceptance remain S14/S15/S17 work. Earlier counts above describe the S05 milestone only.

Run `pnpm db:test:start`, `pnpm db:migrate:local`, `pnpm test:db`; stop with `pnpm db:test:stop` (volume retained). Full vault Neon migration remains gated. Do not reuse N01's setup-only migration runner for these migrations.

