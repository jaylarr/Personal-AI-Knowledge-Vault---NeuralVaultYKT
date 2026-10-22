# Personal working memory, session coverage and reusable skills

Execution update 2026-10-22: S00–S15 completed and verified locally. G01–G04 remain pending. The planning statements below describe the original handoff. See ../PERSONAL_MEMORY_IMPLEMENTATION_REPORT.md.

Date: 2026-10-21, Asia/Taipei. Original handoff status: **READY for S00–S15 local implementation after an execution request.** G01–G03 are explicit real-world acceptance/application gates; G04 actual additional-host connection is BLOCKED pending a concrete target. Intended executor: the same Codex model at Light/low reasoning.

Project: `C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT`.
Plan: `docs/plans/2026-10-21-personal-memory-implementation-plan.md`.
Inspected branch/revision: `master`, `eba93acf1dd1855e9a827af19134ae5e8f779bb2`.

This is a planning invocation. Only this Markdown handoff and necessary evidence were written. The feature is not implemented. A later execution request is required. Local implementation can be prepared independently of the installation/history-processing gates in section 10. This plan does not authorize cloud access/writes, another AI service, another agent process, deployment, startup installation, commits or pushes.

## 1. Goal and observable outcome

The owner wants future AI sessions to understand how they work: explicit preferences, corrections, constraints and reusable procedures. They do not want comprehensive project archives, routine completion logs or low-value observations in personal context. Cover all accessible, eligible sessions on the configured host, while making every reviewed/no-change/no-value/excluded/failed outcome visible. A session need not produce a memory.

Before: current ATLAS tools require a repository, default context mixes owner/project knowledge, and save attempts do not establish that a session was reviewed. Native Codex memory is separate. A skill existing on disk does not establish its importance or its inclusion in a recoverable vault backup.

After: a projectless chat can load a compact personal context; an existing connected agent can save an explicit owner preference with source evidence, or propose an unconfirmed pattern. A deterministic scanner/hook queues eligible session revisions. The working agent reviews bounded pages and records a verified disposition. The UI shows the personal profile, skill references and scoped coverage. Project details remain available when deliberately requested. No separate AI API, embeddings or automatic AI launcher is introduced.

Example: an owner correction about when to propose a plan becomes one applicable, source-backed preference; its later correction replaces the active version. A CSS edit that reveals no reusable knowledge produces `reviewed_no_value` with no new memory. A missing session source becomes `source_unavailable`, never a guessed summary.

### Progress checklist

- [x] S00 Baseline, task tracking and scoped recovery snapshot
- [x] S01 Browser-safe personal contracts and policy
- [x] S02 Projectless owner capture and source references
- [x] S03 Personal policy, candidates and suppression records
- [x] S04 Native session adapter and independent coverage journal
- [x] S05 Review leases, evidence validation and completion
- [x] S06 Bounded owner context and profile index
- [x] S07 Skill catalog, discovery and availability
- [x] S08 Selected custom-skill source backup and restore
- [x] S09 Local API authorization and route wiring
- [x] S10 MCP and protected CLI compatibility
- [x] S11 Hook package and additive installer, fixture mode only
- [x] S12 Personal profile, skills and coverage UI
- [x] S13 Selective backfill and reconciliation commands
- [x] S14 Personalization, lifecycle and performance evaluation
- [x] S15 Full local verification, documentation and release evidence
- [ ] G01 Explicitly authorized current-PC grants/client rollout
- [ ] G02 Explicitly authorized historical corpus application
- [ ] G03 Actual fresh-chat personalization acceptance
- [ ] G04 Additional host/export integration after a concrete target is supplied

No check box means done merely because code exists. Mark partial/gated work accurately in the execution report.

## 2. Requirements and boundaries

### Must have

- R01 Personal context works without creating a Project.md or supplying `repository_path`.
- R02 Capture only useful scoped subjects. Active owner knowledge continues to require `basis=owner_explicit`, type preference/constraint and a source statement. Preserve conditions, exceptions and evidence.
- R03 Keep inferred/ambiguous patterns in a separate candidate lane. Repetition does not establish universal human intent. No automatic candidate promotion.
- R04 Record review of eligible main-session revisions with explicit outcomes, cursor/revision identity, host scope and as-of time. Tool attempts are not completion receipts.
- R05 Handle active/resumed/interrupted/compacted/forked sessions, duplicate callbacks, stale leases, crashes, missing sources and incompatible exports. Consolidate subagent work into its main chat.
- R06 Review original owner messages in bounded pages; no wholesale transcript import into Vault, no assistant reasoning/tool output used as owner intent.
- R07 Save/reuse/replace idempotently; failed or partial saves cannot count as reviewed. A later owner turn creates a new review revision.
- R08 Discover skills as metadata, load procedures only when relevant, distinguish installed/available/curated/owner-custom, and back up selected custom sources with integrity checks.
- R09 Default personal UI/context excludes project histories, candidates, receipts and traces. Preserve project tools and the real-file graph.
- R10 Correct preferences through existing immutable replacement. Dismiss/exclude/stop-using controls suppress resurfacing; distinguish these from physical erasure.
- R11 Evaluate capture precision, missed corrections, retrieval/application, updates, abstention, noise resistance and scoped operational coverage with explicit pass criteria.
- R12 Preserve loopback-only access, current expiry/revocation, project permissions, browser-safe imports, original files and existing user changes.
- R13 Support a declared additional-host/export contract without inventing account-wide coverage or silently synchronizing cloud data.

### Must preserve

Current K01 records, IDs, replacement chains, direct Markdown editing, `detail=full`, legacy activity selection, the original three MCP tools, current domain tools and their permission boundaries. Preserve G01–G04 graph behavior/theme/performance assertions, source/version/review/backup behavior, all existing docs/copy outside the necessary personal navigation changes, current DevDock hook definitions and unrelated Codex configuration byte-for-byte. Preserve the source brief hash `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`.

### Must not have

No bulk raw-chat archive, codebase summary dump, automatic personality diagnosis, unsupported owner motive, universal preference inferred from one project, model SDK/key, embedding/vector service, paid memory platform, cloud knowledge writes, automatic AI agent/thread launcher, scheduled startup service, production SQL migration or blanket access to imported personal sources. Do not use n8n, Neon, Tech-Trends or Sinta Wedding resources for this feature.

### Don'ts specific to this checkout

- Do not reset the dirty checkout or overwrite the prior F01–F06 changes.
- Do not relax `validScope()` or make `canRead(...scope=personal)` return true for every agent.
- Do not treat `capture_project_knowledge` as permission to scan personal history through a new endpoint.
- Do not put coverage events in the domain catalog: session event volume must not consume its existing 5,000 logical-item/50,000-output/64 MiB admission budget. Give the separate operational journal its own explicit bounds.
- Do not call a function that takes `vault.withLock()` while already holding that lock. `store.transaction()` and owner capture already take it.
- Do not call the existing protected API launcher from an end hook; cold startup can exceed the hook deadline. Hooks write only bounded metadata to a local spool.
- Do not use a `Stop` hook to force another model turn. Do not bypass hook trust.
- Do not make the browser scan arbitrary filesystem paths or import core/Node/SQL modules.
- Do not overwrite generated Codex memories or copy plugin-managed skills into them.

## 3. Context and verified evidence

Read `AGENTS.md`, `Vault/AGENTS.md`, current `docs/PROGRESS.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`, the latest `docs/SESSION_LOG.md`, `docs/KNOWLEDGE_CAPTURE_POLICY.md`, `docs/CODEX_GLOBAL_INSTRUCTIONS.md` and `docs/PERSONAL_MEMORY_RESEARCH_2026-10-21.md`. L01/K01 supersede historical cloud designs in the original implementation handoff. Current instructions and owner boundaries win over stored notes.

Planning baseline evidence: `.artifacts/personal-memory-plan-2026-10-21/baseline.json` contains HEAD, dirty status and hashes of 52 visible Vault Markdown files, 29 inspected files and three client configuration files. This count is a dated baseline, not a permanent expected vault size. It includes state added after the earlier research inventory.

Pre-existing dirty files: API `local-domain.ts`/`local-vault.ts`; web `LocalApp.tsx`/`local/LocalWorkspace.tsx`; docs ISSUES/PROGRESS/SESSION_LOG/TASKS; core `local-vault.ts`, local authorization/domain/retrieval/sources/tasks/transactions; domain-browser workspace and unit local-domain/local-vault tests. Untracked research/remediation docs and the October 20 remediation plan also pre-exist. Preserve these contents and future concurrent owner changes.

Stack inspected: Node 24.18.0, pnpm 11.25.0, TypeScript 7.0.2, Zod 4.6.7, YAML 2.9.1, Hono 4.13.13, MCP client/server 2.3.1, React 19.3.1, React Query 5.104.3, Router 7.18.4, Vite 8.3.4, Vitest 5.0.5, Playwright 1.64.1. Use existing dependencies; do not change the lockfile or add a dependency for this design.

### Source map

| Verified path | Anchor | Current responsibility / planned action |
| --- | --- | --- |
| `packages/contracts/src/local-knowledge.ts` | `validScope`, `localCheckpointInputSchema` | Preserve owner evidence rules; add optional typed source references compatibly |
| `packages/contracts/src/agent-workflow.ts` | `checkpointInputSchema`, `contextInputSchema` | Existing safe relative provenance and request-key limits; preserve legacy payloads |
| `packages/contracts/src/local-domain.ts` | `localOperationSchema`, `localRecordKindSchema` | Add narrow personal capabilities and candidate/skill record kinds |
| `packages/contracts/src/local-vault.ts` | `localNoteSchema`, `localContextSchema` | Preserve old shape; add optional personal-record marker; new personal packet has no required project |
| `packages/core/src/local-vault.ts` | `captureKnowledge`, `context`, `snapshot`, return object | Extract shared owner capture; preserve locking, secrets checks, history and retries |
| `packages/core/src/local-knowledge.ts` | `resolveKnowledgeHeads`, `selectKnowledgeContext` | Reuse head resolution; add separate personal selection without changing legacy defaults |
| `packages/core/src/local/transactions.ts` | `transaction`, `recordPath`, logical admission | Existing atomic domain records; add visible candidate/skill paths and include these logical records in the current cap |
| `packages/core/src/local/authorization.ts` | `currentAgent`, `createAuthorization`, input enums | Keep expiry/revocation and generic personal-source denial; add personal-only guards |
| `packages/core/src/local/domain.ts` | `createDomainService`, exports | Export new personal service factory without adding a package subpath |
| `packages/core/src/local/retrieval.ts` | `createRetrieval` | Keep general domain/K01 behavior; personal endpoints use their separate selector and suppression filter |
| `packages/core/src/local/backup.ts` | `backupLocalVault`, `restoreLocalVault` | Whole-folder copy with integrity manifest; include new personal metadata/source packages; validate journal on restore |
| `apps/api/src/local-vault.ts` | `createLocalServices`, route order, legacy auth middleware | Instantiate personal service; mount dedicated routes before the legacy catch-all/capture gate |
| `apps/api/src/local-domain.ts` | `ownerDomainRoutes`, `agentDomainRoutes` | Owner cookie and agent bearer patterns; preserve existing source endpoints |
| `apps/api/src/app.ts` | Host/Origin guards, body limits, timeouts | Existing loopback protection; new operations must fit bounded requests |
| `apps/api/src/index.ts` | local initialization and `close` | Load host config in local mode only; close new watchers if any |
| `apps/mcp-server/src/index.ts` | `createServer`, three automatic tools | Register seven additive personal tools; retain all existing tool names |
| `apps/mcp-server/src/workflow.ts` | `runtimeMode`, `post`, repository methods | Personal client uses new routes without calling `identifyRepository` |
| `apps/mcp-server/src/cli.ts`, `scripts/atlas-launch.ps1` | action dispatch | Add personal JSON dispatch; keep old action signatures and protected token handling |
| `scripts/install-codex-workflow.ps1` | ATLAS block replacement | Reference existing additive pattern; new installer must use a unique exact block and current backup |
| `apps/web/src/app/LocalApp.tsx` | `nav`, `/` capture panel, `visible` | Personal landing and new routes; retain source capture at `/capture` and old project routes |
| `apps/web/src/app/local/LocalWorkspace.tsx` | `request`, `Field`, agent controls | Reuse conventions; extend capability controls without rewriting source flows |
| `apps/web/src/styles/global.css`, `local-domain.css` | `--atlas-*`, existing breakpoints | Preserve charcoal/sage shared theme; new scoped styles use those tokens |
| `tests/unit/local-knowledge.test.ts` | owner/project lifecycle tests | Existing 18-case evidence and regression extension |
| `tests/mcp/local-domain.test.ts` | eighteen-tool assertion and process round trip | Update expected additive surface; preserve old protocol proof |
| `tests/fixtures/local-domain-server.ts`, `tests/playwright.domain.config.ts` | isolated owner fixture, loopback 4323 | Extend fixtures with synthetic personal hosts; never scan real home directories in tests |

### Observed checks and limitations

From project root, ran:

```powershell
node node_modules/vitest/vitest.mjs run --config tests/vitest.unit.config.ts tests/unit/local-knowledge.test.ts tests/unit/agent-workflow.test.ts
```

Initial default sandbox run: 5 passed/19 failed; Git initialization and hard-link publication were blocked. Retried with temporary directories inside the allowed workspace: 6 passed/18 failed, all remaining failures at hard-link publication. With normal permitted Windows filesystem execution, the same suites passed **24/24** in 5.83 seconds. Evidence: `.artifacts/personal-memory-plan-2026-10-21/baseline-focused-tests.log` and `baseline-focused-tests-permitted.log`. Do not weaken atomic writes/assertions to accommodate the sandbox.

No full build/typecheck/browser/domain/multi-host/personalization evaluation was run during planning. Prior reported suite totals are historical. Native schema inspection printed keys/types only, not owner message bodies or credentials.

Verified native shape in current available files: `session_meta` with `payload.id/source/cli_version`; user input is available as `event_msg` → `item_completed` → `item.type=UserMessage`, with `item.id`, `payload.turn_id`, `content[].type=text` and text. `response_item` user messages also contain injected AGENTS/environment/page material, so do not assume every user-role record is an owner statement. Lifecycle events include `task_complete` and `turn_aborted`. The sampled thread settings exposed no memory-contribution flag. No supported account-wide history or per-chat consent API is assumed.

### Current primary documentation

Official pages were fetched in this research session on October 21. Revalidate hook schema against the installed client immediately before rollout because transcript format is unstable. [Codex hooks](https://learn.chatgpt.com/docs/hooks), [native memories](https://learn.chatgpt.com/docs/customization/memories), [configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [skills](https://learn.chatgpt.com/docs/build-skills). The report contains the comparative sources and [LongMemEval](https://arxiv.org/html/2410.10813v2). This design borrows patterns, not platform SDKs.

## 4. Chosen architecture

Extend the local Markdown application. Existing K01 owner notes remain authoritative personal subjects. Domain transactions hold low-volume policy/settings, candidates, skill references and suppression metadata. A separate bounded operational journal holds session coverage and review leases; it is not a knowledge source and is excluded from graph/retrieval. Native sessions and installed skills remain in their canonical directories. Only selected custom skill sources are copied into the vault for backup.

New Node-only directory: `packages/core/src/local/personal/` containing `service.ts`, `policy.ts`, `sessions.ts`, `coverage.ts`, `review.ts`, `context.ts`, `skills.ts`. Export the service from `local/domain.ts`. Browser-safe schemas live in new `packages/contracts/src/personal-memory.ts`, exported from `contracts/src/index.ts`. No browser import of these Node modules.

### Storage

| Path | Meaning |
| --- | --- |
| `Vault/Owner/Knowledge/` | Existing versioned explicit owner preferences/constraints |
| `Vault/Owner/Profile.md` | New generated navigation index, not a second authoritative profile |
| `Vault/Owner/Candidates/<candidate-id>/<revision-id>.md` | New domain transaction records, never active owner knowledge |
| `Vault/Owner/Skills/<skill-id>/<revision-id>.md` | Skill reference metadata in Markdown, not executable installations |
| `Vault/Owner/SkillSources/<skill-id>/<content-sha256>/` | Explicitly selected custom source package and hash manifest |
| `Vault/.atlas/personal/coverage/<host-id>/<session-key>/<event-key>.json` | Independent immutable operational events |
| `Vault/.atlas/personal/spool/<event-key>.json` | Secret-free hook notification metadata, replay-safe |
| `Vault/.atlas/operations/settings/` | Existing transaction storage for profile/policy/grant/suppression records |
| `.local/personal-hosts.json` | Owner-controlled filesystem roots and host identity; ignored, server/CLI only |

All `.atlas/personal` files contain identifiers, hashes, cursors, bounded reason codes and result references, never prompt text, message excerpts, titles from private chats, paths to credentials or model reasoning. No copying session JSONL into Vault, backups or planning evidence.

### Exact common contracts (proposed, not implemented)

Define Zod schemas and inferred TypeScript types for the following. Every object is strict. Define `personalSourceRefSchema` and its inferred type in `local-knowledge.ts` before knowledge fields; the new `personal-memory.ts` imports that schema and `localNoteSchema`. Never import personal-memory.ts back into local-knowledge/local-vault contracts: that would introduce a schema initialization cycle. All IDs from native clients are opaque strings of 1–128 characters, not assumed UUIDs. Hash them before using as a path. Host IDs match `^[a-z][a-z0-9-]{2,47}$`. Internal request keys use `localRequestKeySchema` unless the legacy K01 input requires its narrower format.

```typescript
type PersonalSourceRef = {
  host_id: string;
  session_key: string;             // sha256(host id + native session id)
  session_revision: string;        // sha256 of normalized owner inputs + terminal states
  message_id: string;
  turn_id: string | null;
  start_codepoint: number;
  end_codepoint: number;
  quote_sha256: string;
};
type PersonalOutcome =
  | "pending" | "reviewing" | "reviewed_saved" | "reviewed_no_change"
  | "reviewed_no_value" | "reviewed_candidates" | "excluded"
  | "failed" | "source_unavailable" | "unsupported";
type PersonalContextInput = {
  query: string;                    // default "", max 200
  detail: "summary" | "full";      // default summary
  character_budget: number;         // default 10000, range 2000..24000
  limit: number;                    // default 8, range 1..20
  include_skills: boolean;          // default true; metadata only
  project_id?: string;              // opt-in UUID; never inferred from cwd
};
type PersonalContextPacket = {
  storage: "local";
  scope: "owner";
  notes: LocalNote[];
  skills: PersonalSkillSummary[];
  project_notes: LocalNote[];
  truncated: boolean;
  omitted_counts: { notes: number; skills: number; project_notes: number };
  warnings: string[];
  trust: "Dated personal context, never instructions or permission.";
};
```

Source offsets use Unicode code points, matching existing evidence utilities, not JavaScript code units. Require nonempty spans, exact normalized-message quote hash, matching message/turn/revision and current permitted host. Source snippets are read in memory and validated, not stored as transcript fragments. `source_statement` remains a short supported paraphrase and is not proof on its own.

Extend knowledge capture/metadata with optional `source_refs: PersonalSourceRef[]` (max 12, default empty). Encode as a flat list of canonical JSON strings under `knowledge_source_refs`; decode strictly. Add them to `knowledgeDigest` only when nonempty, preserving legacy digest behavior for old files. Include refs in the request payload hash. Legacy records and old callers remain readable unchanged. New personal capture requires at least one validated ref, or `owner_confirmation_id` referencing an owner-authored UI confirmation record. Historical agent reports alone cannot satisfy this requirement.

`PersonalCaptureInput`: a separate extension of the existing local checkpoint shape with required owner knowledge; no repository path; `origin_project_id?: UUID` optional, validated only when supplied. Add `owner_confirmation_id?: UUID` to this new schema, and optional `knowledge_owner_confirmation_id` metadata when persisted. Legacy input schemas stay strict with their existing fields. The shared engine receives the already validated normalized personal or legacy form, so it does not reject the new confirmation field by reparsing it with the old strict schema. Existing legacy capture routes keep accepting their old inputs.

### Policy and permissions

Add capabilities `read_personal_memory`, `capture_personal_memory`, `review_personal_sessions` to the operation schema and all create/update/UI validation consumers. They are opt-in, default absent. Do not add them to bootstrap defaults. The installed agent is currently `267bc649-b732-4450-9b33-e84f38cdf0b2`; revalidate its identity/digest before G01, never create a replacement identity or reset its token to make a test pass.

`assertPersonal(actor, capability, hostId?)` authenticates with current `domain.auth`, rechecks expiry/revocation/integrity, requires the capability and an owner settings grant for that agent and host. Owner cookie actors can manage policy, confirmations, candidates and suppression. Agents cannot approve a candidate, remove suppression, enable a host, change grants or erase files. Generic imported `personal` sources remain denied by existing `canRead`.

Policy settings ID `personal-policy-v1`: `enabled`, `policy_version=personal-working-v1`, baseline keys (max 8), session exclusion keys, project/repository exclusion digests, candidate capture toggle, selected skill IDs and host enabled flags. Default policy is disabled until G01. Default baseline keys are the four current ATLAS owner concepts; additional concepts become baseline only through an owner pin, never inferred importance. Settings ID `personal-grant-<agent-id>` stores allowed host IDs and personal capabilities; capabilities must also exist on the agent. Defaults deny. All updates require expected domain revision.

Host registry shape: `{format_version:1, hosts:[{id:"windows-primary", kind:"codex-local-jsonl", enabled:false, codex_home:"C:\\Users\\user\\.codex", skill_roots:["C:\\Users\\user\\.agents\\skills","C:\\Users\\user\\.codex\\skills"]}]}`. Fixture roots are injected through `createLocalServices` test options. Only a local owner operation may configure roots. Agents pass host IDs, never arbitrary paths. Additional configured roots require explicit owner selection.

Native memory settings are independent. Do not change their generation/use controls. The UI explicitly labels ATLAS learning consent as separate. A known native per-chat opt-out or an owner instruction forbidding retention excludes that chat. Where native eligibility flags are unavailable, record `native_consent=unknown`; do not claim native consent was verified. G01/G02 must explicitly authorize ATLAS's own host/session scope. Unknown intent discovered during review defers that material to a candidate or exclusion rather than active capture.

### Candidate, suppression and skill contracts

New record kinds `personal_candidate` and `skill_ref`; add these to the existing 5,000 logical-item admission count. `recordPath()` puts them in the Owner directories above. Add optional `personal_kind: "candidate"|"skill"|"profile_index"` to `localNoteSchema`, decoded from new metadata/record kind. No change to old note kinds or archived/history behavior.

`PersonalCandidate`: UUID, stable `concept_key` using current key syntax, title max160, proposed claim max400, applies_when max600, exceptions max6, rationale optional max600, evidence refs 1..12, basis `inference|historical_report|owner_explicit`, status `proposed|confirmed|dismissed|needs_source`, active replacement reference optional, timestamps and revision. Body is a compact explanation, not a source dump. Repeated evidence upserts the same concept with exact revision; ambiguous differently scoped concepts remain separate. Confirmation requires owner action with editable statement/conditions and creates an owner confirmation record; then captures through the same K01 owner path. An agent cannot mark `confirmed`.

Suppression settings contain a concept-key hash, optional subject IDs/source fingerprint hashes, reason code `dismissed|excluded|stop_using|privacy`, actor/time and revision; no rejected text. Exact-key suppression wins over candidate recapture, owner context, legacy project-context owner selection and general K01 retrieval. Unrelated project notes are unaffected. Removing suppression is owner-only. Do not rewrite or delete the original notes for ordinary corrections/stop-using.

`PersonalSkillSummary`: UUID, name max120, description max600, triggers max8 bounded strings, kind `owner_custom|project_custom|third_party|system|unknown`, state `discovered|curated|dismissed`, canonical locator ID, sha256, duplicate locator IDs, availability `available|missing|changed|denied|unapproved_target`, source provenance, last_checked_at and optional backup_manifest ID. Installed is not curated; curated is not an owner preference. Store full paths only in local owner-visible metadata; agent summary returns a locator ID, not unrestricted filesystem access. Read body only by verified locator ID and revalidated digest/root.

## 5. Session and coverage algorithms

### Native adapter and eligibility

Implement an adapter for the actually observed native JSONL shape. Treat it as versioned local input, not a stable API. Discover files only below configured `sessions/` and `archived_sessions/`; reject symlink/junction escapes by validating real paths, parent components and leaf identity. Do not traverse all user files, plugin caches or unrelated repositories. Read first metadata and stream newline-delimited records under a fixed snapshot byte bound. Max source file 256 MiB; larger files are `unsupported` and can later receive an explicitly selected bounded-export adapter. Max line 8 MiB; retain no partial line. Max 10,000 discovered files per host scan; return a continuation/remaining count rather than complete coverage after truncation. Process sequentially with cooperative yielding; scan at most 25 files or 4 seconds per HTTP request.

Use `event_msg.item_completed.item.type=UserMessage` as primary human-message carrier. Read text content entries only; retain message/turn IDs and original record locators in memory. A supported older `response_item` fallback must first pass explicit fixture shape/metadata checks and wrapper exclusion; never count both carriers. Exclude AGENTS/environment/page/skill injection records, tool content, assistant messages/reasoning and quoted third-party instructions. The connected reviewer still judges attribution and applicability; a `user` role alone is insufficient. Redact/reject secret-bearing segments before page delivery, and mark their exclusion counts without retaining their contents. Missing/unknown schema becomes `unsupported`, never a successful empty review.

Classify `payload.source.subagent` as subordinate; do not count it as an independent owner chat. If parent lineage is available, link its hash; otherwise label `subagent_unattributed`. Forks can inherit inputs: deduplicate within the source's message IDs, retain fork origin metadata when available, and do not count inherited text as independent confirmation. Main chats with a new owner input remain eligible.

For every main chat, derive a semantic revision from ordered `{message_id, turn_id, text_sha256, terminal_state}` entries. Terminal states come from task_complete/turn_aborted; ignore assistant/tool/token events so ATLAS's own calls do not generate endless new review revisions. Open current inputs may be captured as live evidence but are not a completed review denominator until the turn is terminal. An interrupted turn can be reviewed for its owner's instructions; do not infer successful implementation from it.

Evaluate host enabled/ATLAS scope, explicit native/owner exclusions, subagent status, input shape and source availability. Discovery never marks a session reviewed. Sensitive/ambiguous retention instructions discovered in input stop processing and exclude the affected revision. Scanner output carries counts/reason codes only.

### Independent journal

`coverage.ts` owns atomic immutable JSON events under `.atlas/personal/coverage`. Use `vault.safeExistingPath/safePath`, `vault.writeExclusive` and the same vault lock. No domain transaction registration and no graph node. Each event has `{format_version:1, entity_key, revision, previous_event_sha256, request_key, payload_sha256, actor_id, at, data}`; filename derives from SHA256(actor ID + request key). Replay with identical payload returns the same event; changed payload with the same key is 409. Within the lock, verify expected revision/previous digest, then publish exactly one complete event file. An incomplete temporary file is ignored. Resolve a unique verified chain; conflicting heads/integrity errors fail closed. No timestamp winner.

Journal limits: 100,000 event files / 128 MiB per configured host, 32 KiB per event, max 1,000 pending revision descriptors returned through paged queries, 100 rows per UI page. At a bound return `PERSONAL_JOURNAL_LIMIT` and incomplete coverage; never drop events or expand limits silently. Use verified parent/leaf identity caches and close any watchers. Do not repeat F01's write-on-read temporary-file defect. Derived read indexes may live in `.atlas/derived/personal/` and must be reconstructible.

A descriptor contains host/session/revision hashes, source locator ID, native version/origin, input counts, terminal cursor, eligibility/reason, native consent status, outcome, read-page cursor, lease info, resulting note/candidate/skill IDs and expected file digests. No raw text. Missing source is a status with an explicit reason. A later changed semantic revision creates new pending work and preserves old receipts.

### Review protocol

Claim one eligible pending revision for 15 minutes; bounded renewal extends at most 60 minutes total. Return a random lease token to the caller, persist only its digest. Authenticate agent and host at claim, page read and completion. Revoke/expire access immediately. Stale revision/cursor/lease returns 409 and leaves the latest work pending. A crash/expiry releases work without a reviewed outcome.

Pages contain at most 20 messages and 24,000 characters, with sensitive content excluded and a source-ref locator for each deliverable span. A single long owner message is split into aligned codepoint windows; no silent clipping. Store only delivered interval hashes/cursors, not page text. Every page requires an explicit acknowledgment before progression. A final no-value/no-change outcome requires all eligible intervals in the claimed revision to be acknowledged. Later source edits invalidate the claim and do not advance its cursor.

The working agent returns one of saved/no-change/no-value/candidates plus IDs and reason codes. For saved, read each returned active owner note and verify its digest/source refs match this reviewed revision; for no-change, verify at least one existing applicable note ID; candidates requires durable candidate IDs; no-value has no new subject IDs. `failed` records a bounded error code, not stack/source text. Partial saves remain recoverable: use deterministic K01 request keys `pm_<sha256(review key + concept key).slice(0,60)>`, reuse them after a crash and finish the receipt only after revalidation. Never claim all-session semantic coverage from structural validation alone; the receipt states which agent attested review and under which policy.

Do not hold journal/store locks while calling owner capture. Claim first; perform saves through their own locks; acquire the journal lock afterward to validate completed outputs using direct safe reads and commit the final disposition. This deliberately uses replay-safe recovery instead of claiming a cross-store atomic transaction that does not exist.

### Coverage display

Show an as-of time, configured host, scan-complete flag, eligible terminal revisions, reviewed total and pending/reviewing/failed/excluded/unavailable/unsupported counts. Reviewed includes saved/no-change/no-value/candidates. The numerator is reviewed eligible revisions from an intact journal; the denominator is identified eligible terminal revisions within the declared scan scope. Show unavailable/unsupported separately and never present a complete percentage when inventory/journal integrity or scanning is incomplete. Also show main-chat counts separately from revision counts. No raw file count as a personalization score.

## 6. Context, skills and UI behavior

### Context and index

`context.ts` selects active unsuppressed owner heads using existing K01 resolution. Reserve baseline first (owner-pinned keys only), then lexical query/topic matches, then curated relevant skill metadata. Explicit `project_id` may add only accessible scoped project facts after personal selection. Default `project_notes=[]`. Candidate/coverage/activity/skill-source bodies never enter the packet. Build the complete response envelope and enforce its serialized character budget, not just `notes`. No clipping individual assertions or discarding exceptions. If full content cannot fit, omit the whole item and report truncation; edited notes use current full bodies, not stale captured summaries. Keep stable ordering: baseline pin order, then score descending, type priority and stable key/ID. Empty query returns baseline and other explicit owner constraints/preferences up to limits; no generic project padding. Skills consume at most three summaries/2,000 characters, inside the same envelope budget.

Implement `personal.context(actor,input)` in the new service/context modules using `vault.snapshot()` and the already authorized policy/catalog; it never ensures a repository. Keep selection in new pure `selectPersonalContext` and avoid a circular vault-to-personal-service dependency. Add `vault.captureOwner(input, actor: LocalActor)`; reject worker actors. Extract an internal owner/project capture engine with `originProjectId: string|null`; when null, require owner scope and omit project link/origin property. Keep old `capture(projectId, input)` and `context(projectId, input)` behavior and result schema. Extend legacy `context` with an optional third `excludedOwnerKeys` argument, default empty; public API callers supply the current policy set. Extend `selectKnowledgeContext(notes, projectId, input, excludedOwnerKeys?: ReadonlySet<string>)` likewise, keeping existing low-level callers valid. The general retrieval K01 branch receives the same exclusion set from its already loaded catalog. No policy/catalog call occurs inside capture's existing lock. New captures use the actual authenticated actor: set agent_id only for an agent; owner-authored confirmations omit agent_id and retain created_by_owner_id/confirmation provenance with local_file status. Do not attribute an owner's UI edit to the installed agent. The configured-agent default remains only for legacy callers. Direct historical-file access remains possible under Windows permissions; stop-using changes default recall, not filesystem authorization.

`Owner/Profile.md` is a generated link index with `personal_kind=profile_index`, source digests and generation version. It links current subject paths; no duplicated authoritative preference prose and no overwrite of Owner/Context.md. Refresh only through an explicit app/agent operation after subject changes. If the owner edited its body since generation, preserve it and show `PROFILE_INDEX_EDITED`; the API-computed profile still works. Restore/refresh resolves superseded links from actual heads.

### Skills

Scan only approved roots. Read SKILL.md frontmatter name/description; collect actual canonical path, source digest and root provenance. Collapse identical resolved paths/digests; show same-name different-content records as variants. Do not decide importance from installed count. Mark discovered items; curate only selected skills or a verified owner's explicit preference. Default third-party/system items remain references. Missing/changed/denied/unapproved symlink targets are visible states. A skill body read is bounded to 64 KiB and requires exact verified locator/digest; return metadata plus an explicit changed-file error if stale. Reading never installs or executes the skill.

For selected `owner_custom`/`project_custom` skills, create a versioned source package under Owner/SkillSources. Require selection of files within the approved canonical skill directory; exclude `.env*`, credentials, private keys, `.git`, node_modules, caches, generated artifacts and symlink escapes. Limits: 500 files, 2 MiB per file, 20 MiB per skill package. Apply secret scanning before persistence; reject a suspect package with the file's safe relative name only. Capture license/provenance if present. Hash every source before/after copying and every destination. Restore only into a new separate inspection directory, never over an installed/plugin directory. Existing vault backup then includes the source package; a same-disk copy is not off-device disaster recovery.

### UI specification

Preserve the existing shell and `--atlas-*` colors/fonts. Add new `PersonalWorkspace.tsx` with separately lazy-loaded profile/skills/coverage/candidate panels. Routes: `/` and `/personal` profile; `/skills` catalog; `/coverage` session review status; `/personal/review` candidate decisions; `/capture` retains the existing home capture UI. Existing Sources, Review, All notes, Graph, Agents, Projects & collections, Changes, Backup and setup routes remain functional. Personal navigation leads; project tools remain accessible. Do not rewrite the graph renderer.

Personal profile order: heading and short explanation; active applicable subjects; relevant skill links; compact coverage summary with as-of/host; expandable history/source evidence. No invented stats or personality labels. The primary action is Refresh personal context; capture is automatic within authorized agent work, not an onboarding questionnaire. Each subject shows summary, applicability, exceptions, source status and previous-version links. Stop using requires an explicit owner action and explains that history remains. Candidate confirmation edits the actual proposed claim before saving; dismissal creates suppression. No confirmation dialog for ordinary agent saves of explicit preferences.

Coverage rows show latest revision state, last reviewed time, pending reason and retry/exclude controls. No raw chat title or message body in the main table. A user-requested evidence preview fetches only the permitted span and never caches transcripts in browser storage. Failed saves remain failed/pending until checked. Scan/reconcile controls show running/loading/partial/empty/error/success distinctly. Skills rows show purpose/trigger, source and availability; full instructions expand on demand, with backup and installation clearly separate.

New scoped CSS: base is one column at 320px; at min-width 768px use a list/detail split when the actual content pane is at least 720px (container query or measured available width); otherwise stack. Use existing shell breakpoint behavior at 680/1100px; do not modify its global layout to make one panel fit. Proposed panel gap/padding uses existing 14/20px conventions through scoped semantic CSS variables. Touch actions at least 44px; no horizontal overflow, long paths/keys wrap, details remain readable at 200% text enlargement. Use links/buttons, labeled inputs, `aria-live=polite` for scan status, `role=alert` for actionable failures, visible focus and keyboard-complete dialogs. Use button/filter chips for small status filters; avoid a new native select. No added decorative animation; honor reduced motion. Do not claim WCAG/contrast scores without measurement.

## 7. API and tool surface

Create `apps/api/src/local-personal.ts` exporting `ownerPersonalRoutes(personal,cookie)` and `agentPersonalRoutes(personal)`. Mount before legacy agent middleware and before `/api/*` catch-all. Owner routes require the exact local cookie and reject bearer substitution; agent routes require current bearer authentication and personal capabilities. Keep Host/Origin/Sec-Fetch protections. Do not expose filesystem roots, raw host paths or secret scanning diagnostics in general agent responses.

Close the additive legacy snapshot leak: `/api/v1/local/vault` currently returns a full snapshot to a legacy capture bearer. Filter new `personal_kind` records and their edges out of all legacy bearer snapshot responses, even if the token can use the new dedicated routes; candidate/skill-body access stays in explicitly authorized personal endpoints. Existing owner K01 records and unrelated legacy behavior are preserved. Owner cookie views may read new local files, but default graph filtering still excludes their operational noise. Add a regression proving a capture-only token cannot obtain a candidate or skill body via the old snapshot route.

For owner snapshots add optional response-only `personal_suppressed: true` on a suppressed owner note; this is not written into the original Markdown. Decode this optional field in localNoteSchema. LocalApp's default Knowledge/graph view omits these notes and their edges; explicit All files/history readers retain access to preserved originals. Dedicated personal context and legacy/general retrieval apply the same suppression rule.

| Prefix | Route | Input / behavior |
| --- | --- | --- |
| owner `/api/v1/local/personal` | GET `/profile`, `/skills`, `/coverage`, `/candidates`, `/policy` | Paged owner views, no raw chat dumps |
| same | POST `/context`, `/policy`, `/candidates/:id/decision`, `/subjects/:id/stop-using`, `/subjects/:id/confirmation` | Strict schemas, request key and expected revision for mutations |
| same | POST `/skills/scan`, `/skills/:id/curate`, `/skills/:id/backup`, `/skills/:id/restore-preview` | Configured roots and safe package handling |
| same | POST `/sessions/scan`, `/sessions/exclude`, `/sessions/retry`, `/profile/refresh`, `/erasure-preview` | Scope/consent checks; erasure preview writes no deletions |
| agent `/api/v1/agent/personal` | POST `/context` | PersonalContextInput; read_personal_memory |
| same | POST `/capture` | PersonalCaptureInput; capture_personal_memory; explicit verified refs |
| same | POST `/sessions/scan` | host_id, mode live/backfill, scan cursor, optional current-turn consent stamp; review_personal_sessions; application scope must be enabled |
| same | POST `/sessions/next` | host_id optional, request_key; claim one revision |
| same | POST `/sessions/page` | review_id, lease_token, page cursor, acknowledge_previous optional |
| same | POST `/sessions/complete` | review_id, lease_token, expected_revision, outcome, result IDs/digests, candidate proposals, bounded reason code, request_key |
| same | POST `/skills` | query default empty; optional skill_id/expected_digest/read_body=false; read_personal_memory |

Use HTTP 400 invalid evidence/input, 403 personal capability/host denied, 404 inaccessible/missing record, 409 stale revision/request/lease/source, 413 bounds, 503 integrity/unavailable/unsupported configuration. Return stable error codes, request ID and a safe message; no credential/source text. Unsupported input format becomes a coverage state rather than a successful scan. Scan pagination is required to fit existing 10-second API/12-second MCP timeouts; do not increase global timeouts for unbounded work.

Register exactly seven additive MCP tools in new `apps/mcp-server/src/personal.ts`: `atlas_personal_context`, `atlas_capture_personal_knowledge`, `atlas_personal_scan`, `atlas_personal_review_next`, `atlas_personal_review_page`, `atlas_personal_review_complete`, `atlas_personal_skills`. Use the existing `registerTool` object schema/annotation pattern and local runtime check. The scan/claim/complete/capture tools are mutations; mark hints accurately. No owner policy/grant/approval/erasure MCP tool. The resulting current surface is 25 tools; retain the original 18 names, and update their explicit-count tests to assert both the old subset and the additive seven. If other work has legitimately added tools, compare sets and revise the expected current total from actual names rather than deleting tools to force 25.

Expose `createPersonalService({vault,domain,hosts})` from core and return `context`, `capture`, `policy`, `candidates`, `sessions`, `skills`, `profile`, `close`. New `apps/mcp-server/src/personal-client.ts` owns strictly parsed route calls; never identifies/creates a repository. CLI `personal` dispatch receives one existing JSON file with `{operation,input}`; valid operations match the seven agent endpoints plus owner-only local maintenance commands exposed through an owner CLI context, not the scoped token. Keep owner maintenance in `scripts/personal-maintenance.ts` using direct local owner identity and configured roots. Extend launcher ValidateSet with `personal`; that action requires InputFile but no Repository and retains token protection/cleanup. No secrets on command lines.

## 8. File change map

All paths are relative to the explicit project root. C=create, M=modify; no deletions planned.

| Steps | File(s) | Action | Anchor / requirement |
| --- | --- | --- | --- |
| S00,S15 | docs/TASKS.md, PROGRESS.md, SESSION_LOG.md | M during execution | New P02 execution section; preserve historical entries |
| S01 | packages/contracts/src/personal-memory.ts | C | Exact personal schemas in sections 4–7 |
| S01,S02 | packages/contracts/src/index.ts, local-knowledge.ts, local-vault.ts, local-domain.ts | M | Exports, optional source refs/marker, narrow kinds/capabilities |
| S02 | packages/core/src/local-vault.ts, local-knowledge.ts | M | Projectless capture/shared engine and compatible digest/head logic |
| S03 | packages/core/src/local/personal/policy.ts | C | Owner policy/grants/suppression |
| S03,S05 | packages/core/src/local/personal/review.ts | C | Candidate decisions and review orchestration |
| S03,S07 | packages/core/src/local/transactions.ts | M | recordPath for Owner records; existing logical cap |
| S04 | packages/core/src/local/personal/sessions.ts, coverage.ts | C | Native reader and separate bounded journal |
| S06 | packages/core/src/local/personal/context.ts | C | Owner-only selector and index generation |
| S07,S08 | packages/core/src/local/personal/skills.ts | C | Skill references and selected source packages |
| S08 | packages/core/src/local/backup.ts | M | Personal journal validation and restored-host disabled behavior |
| S09 | packages/core/src/local/personal/service.ts | C | Compose services and guard boundaries |
| S09 | packages/core/src/local/domain.ts, authorization.ts | M | Exports and opt-in capabilities; keep source denial |
| S09 | apps/api/src/local-personal.ts | C | Owner/agent routes |
| S09 | apps/api/src/local-vault.ts, index.ts | M | Service construction, mount ordering, local host configuration, shutdown |
| S10 | apps/mcp-server/src/personal.ts, personal-client.ts | C | Seven registered tools and typed client |
| S10 | apps/mcp-server/src/index.ts, cli.ts; scripts/atlas-launch.ps1 | M | Add registration/dispatch without changing old signatures |
| S11 | scripts/codex-personal-hook.mjs, install-personal-workflow.ps1 | C | Pure metadata hook; dry-run installer with fixture root option |
| S11,S15 | docs/CODEX_GLOBAL_INSTRUCTIONS.md, KNOWLEDGE_CAPTURE_POLICY.md, AGENT_WORKFLOW.md | M during execution | Personal start/checkpoint/no-value workflow; current project instructions still win |
| S12 | apps/web/src/app/personal/PersonalWorkspace.tsx, PersonalProfile.tsx, PersonalSkills.tsx, PersonalCoverage.tsx, PersonalCandidates.tsx, api.ts | C | Lazy, accessible personal views and shared request parsing |
| S12 | apps/web/src/app/LocalApp.tsx, local/LocalWorkspace.tsx | M | Routes/filters and capability controls |
| S12 | apps/web/src/styles/personal.css; apps/web/src/main.tsx | C/M | Scoped shared-theme styles and import |
| S13 | scripts/personal-maintenance.ts | C | Scan/backfill/reconcile/dry-run/backup/erasure-preview CLI |
| S14 | tests/fixtures/personal/expected-cases.json, synthetic-sessions/*.jsonl, skills/ | C | Secret-free fixtures only; no copied real messages |
| S01–S14 | tests/unit/personal-memory.test.ts, personal-sessions.test.ts, personal-skills.test.ts, personal-hooks.test.ts | C | Meaningful boundary/lifecycle tests |
| S02,S06,S14 | tests/unit/local-knowledge.test.ts, local-domain.test.ts, agent-workflow.test.ts | M | Preserve current 24-case baseline and old source/capture behavior |
| S09,S14 | tests/integration/local-domain-personal.test.ts | C | Included by current test:local glob |
| S10,S14 | tests/mcp/personal-memory.test.ts; tests/mcp/local-domain.test.ts | C/M | Fresh protocol process + additive surface |
| S12,S14 | tests/domain-browser/personal.spec.ts; tests/fixtures/local-domain-server.ts | C/M | Synthetic host fixture and actual interactions |
| S14 | package.json | M | Add test:personal and evaluate:personal scripts only; no dependency/lockfile change |
| S14 | scripts/evaluate-personal-memory.ts | C | Reproducible fixture scoring; distinct agent-attested evaluation |
| S15 | docs/PERSONAL_MEMORY_IMPLEMENTATION_REPORT.md, PERSONAL_MEMORY_ACCEPTANCE.md | C | Actual results, gate status and remaining host limitations |

Actual `.local/personal-hosts.json`, installed user hooks and global AGENTS changes are G01 resources, not S00–S15 setup side effects. Owner/Profile/Candidates/Skills/SkillSources and coverage records are created through implemented services in fixtures first; real application happens only under the scoped execution gate.

## 9. Ordered execution steps

Every Verify command below runs from the project root in PowerShell. Use stable anchors if line numbers drift. Update this checklist and the execution report at each phase boundary. Application implementation is not authorized by this planning invocation.

For a focused suite after core/contract changes, first run `pnpm build:shared`, then invoke `node node_modules/vitest/vitest.mjs run --config tests/vitest.unit.config.ts` followed by the exact test paths named in the step. Create each meaningful test/fixture alongside its implementation step; S14 consolidates and evaluates them, rather than postponing all tests until then. Use `pnpm test:local` for the integration file and the existing MCP/browser scripts for their layers.

### S00 — Establish execution baseline and recovery

- Depends on: explicit local execution request; none of the runtime gates is implied.
- Targets: current instructions, this plan, tracking docs, `.artifacts/personal-memory-execution-2026-10-21/` (choose a distinct dated directory if later).
- Preflight: inspect HEAD/dirty status; compare relevant anchors to section 3. Capture hashes of all current visible Vault files and task-touched source/config files, including unrelated existing edits. Verify source brief hash.
- Action: mark P02 In Progress in TASKS before source edits; save task-owned pre-edit copies/diffs privately. Use existing verified vault backup to a new separate folder before real-data writes at G01/G02; do not start that application during fixture implementation.
- Expected/verify: baseline JSON and a file map exist; the 24 focused tests from section 3 pass with permitted native filesystem semantics. Preserve any failing sandbox attempts as evidence.
- Failure: source/permission differences get a bounded diagnosis. Do not reset files, change atomic publication or proceed past a materially changed contract without updating the plan.

### S01 — Add strict compatible contracts

- Depends on: S00. Targets: contract files from section 8, anchors in section 3.
- Preflight: current owner scope rejects inference; current response schemas require project only on legacy context.
- Action: add the exact personal types/validation described above, source refs defaults, candidate/skill record kinds, three capabilities and marker. Export from contracts index. PersonalContextPacket is new and does not make legacy project nullable. Add contract tests for invalid refs, bounds, owner inference, capability defaults and response compatibility.
- Expected/verify: `pnpm typecheck` and focused contract/personal tests pass; existing saved Markdown parses without edits. Do not create an application-wide migration.
- Failure: repair additive contract/caller disagreement in this phase; if changing old required fields seems necessary, stop and recheck the chosen separate packet design.

### S02 — Refactor owner capture without requiring a project

- Depends on: S01. Targets: `captureKnowledge`, return object, `knowledgeDigest`, decoder/encoder.
- Preflight: capture currently resolves Project.md and takes the vault lock; it has secret detection, request receipts and digest-checked replacement.
- Action: extract internal shared capture with optional origin project. Add public `captureOwner` validating owner scope, refs/confirmation and no required project; leave existing project methods intact. Use request namespace `owner:<actor-kind>:<actor-id>:<request-key>` for new owner receipts; legacy request aliases remain valid. Pass the authenticated LocalActor to the shared engine for new endpoints, retaining agent_id only for agent authors and explicit owner/confirmation provenance for UI authors; preserve legacy default attribution. Preserve history, retry and direct-edit checks.
- Expected: a new owner preference saves in Owner/Knowledge and is retrievable without adding any project. Two agents racing a replacement yield one valid head and one conflict. Old bodies/digests stay readable.
- Verify: existing 18 knowledge tests, six workflow tests and new owner capture cases; unchanged baseline hashes except deliberately new fixture files. After `pnpm build:shared`, run `node node_modules/vitest/vitest.mjs run --config tests/vitest.unit.config.ts tests/unit/local-knowledge.test.ts tests/unit/agent-workflow.test.ts tests/unit/personal-memory.test.ts`.
- Failure: stop on a deadlock, changed legacy request replay or original-file mutation. Restore only task-owned edits from S00 and diagnose locking/namespace.

### S03 — Implement owner policy, candidates and suppression

- Depends on: S01,S02. Targets: new policy/review modules, domain recordPath/kinds/admission, legacy context/general K01 filtering.
- Action: implement owner-only policy/grant updates with expected revisions; defaults disabled. Add candidate upsert/confirm/dismiss and stop-using records using existing domain transactions. Confirmation issues a source-backed owner confirmation record and then invokes shared owner capture outside the transaction lock, with deterministic replay keys. Apply suppression to new and legacy owner-context retrieval paths, including general retrieval's K01 branch; keep other project/source data untouched. Add personal-kind metadata for new visible records.
- Expected: no unconfirmed owner claim enters active knowledge; a dismissed concept does not return on rescan; stop-using hides all active versions for that concept but preserves history.
- Verify: personal policy tests plus local-domain permission/retrieval tests. Concurrent expected-revision conflict, stale note digest and denied agent confirmation all fail without changing records.
- Failure: any generic personal-source access widening or inference accepted by K01 is a stop condition. Fix the dedicated guard/candidate path, not `canRead`/`validScope`.

### S04 — Implement native discovery and coverage journal

- Depends on: S01,S03. Targets: sessions.ts/coverage.ts, synthetic session fixtures.
- Action: implement exact shape adapter, path validation, semantic revision, terminal-input classification, wrapper exclusion and bounded streaming. Add the independent event-chain journal, no-write read cache and metadata spool import. Use sequential scan continuation, retain partial input state safely and close all streams/watchers. Do not scan real home directories in tests.
- Proposed algorithm, intentionally pseudocode: `discover configured files -> validate identity -> parse complete lines within snapshot -> normalize human inputs -> classify eligibility -> hash semantic revision -> compare journal head -> append pending/unsupported/excluded event under CAS -> return cursor and incomplete flag`. Each named stage is implemented in the target module; no AI call is hidden in a helper.
- Expected: a tool-only append does not create pending review; a new owner turn does. Unknown/oversize inputs are visible unsupported work. Duplicate callbacks do not create duplicates.
- Verify: `personal-sessions.test.ts` fixtures cover the actual observed carrier, old explicitly supported carrier, duplicated carriers, injected user-role data, Unicode, incomplete tail, file mutation, subagents, forks, missing source, denial, bounds and journal conflicts. Test domain admission is unchanged when only the personal journal grows.
- Failure: stop review of the incompatible host/version, preserve files and report unsupported; do not fall back to summarizing arbitrary JSON text.

### S05 — Implement bounded review and verified completion

- Depends on: S02–S04. Targets: review orchestration/session methods.
- Action: add claim/page/ack/renew/complete state transitions and live source-ref validation. Claims/page intervals are journal metadata. Save only explicit useful subjects through captureOwner; ambiguous material becomes candidates. Completion validates refs and actual durable outputs after saves, then commits a disposition. Derive deterministic capture request keys; failed saves do not advance reviewed cursor. Expired leases requeue; policy disable/revocation is checked on every operation.
- Expected: review of every delivered page can end with zero memories; interrupted work resumes safely; a newly edited source invalidates the lease; partial saves are reused on retry.
- Verify: meaningful fault injection before/after first save and before final receipt, concurrent agents, stale digest, omission of a page, forged note IDs, changed source and token expiry. No candidate/no-value result can be recorded before all required intervals are acknowledged.
- Failure: preserve already saved valid notes, mark pending/failed and reuse deterministic keys after diagnosis. Never fabricate a successful outcome to clear the queue.

### S06 — Implement owner-only retrieval and profile index

- Depends on: S02,S03,S05. Targets: context.ts, personal.context service method, Profile.md generation, shared legacy suppression filtering.
- Action: implement section 6's full-envelope budget, baseline pinning, query ordering, whole-item omission and optional authorized project inclusion. Add read-only API-computed profile. Generate Profile.md links only through explicit refresh with expected generated-body digest; preserve edited index and Owner/Context.md.
- Expected: an unrelated projectless query still receives the selected baseline; no project knowledge arrives unless opted in; current edited-body/exception evidence survives full retrieval.
- Verify: empty/unrelated query, minimum budget, Unicode, long exceptions, edited summary, conflict/superseded heads, suppression and inaccessible optional project tests. Serialized packet length never exceeds requested budget. No Project.md appears in a projectless fixture.
- Failure: report truncation instead of clipping a preference. If baseline cannot fit, omit whole subjects with a warning; do not exceed the cap.

### S07 — Implement skill references and controlled discovery

- Depends on: S01,S03,S06. Targets: skills.ts, new skill_ref paths, personal context metadata.
- Action: scan approved roots and parse only metadata first. Canonicalize locations/digests, preserve variants, record availability and let owner curate/dismiss. Validate paths/digests again for explicit body reads; no execution/install and no automatic owner-preference attribution. Match query against names/descriptions/triggers; include at most three curated summaries within the packet cap.
- Expected: the same symlinked source appears once; same-name different-content variants remain distinguishable; missing/changed files show useful status.
- Verify: synthetic roots only, malformed YAML, missing files, non-ASCII paths, duplicate/symlink variants, root escapes, stale digest, 64 KiB body limit and off-topic query exclusion. No source body in default packet.
- Failure: preserve reference metadata and mark unavailable; never search the whole filesystem or install a replacement automatically.

### S08 — Back up selected custom skill sources

- Depends on: S07. Targets: skills.ts packaging, backup.ts, maintenance CLI hooks for later S13.
- Action: implement selected-file versioned package manifest/copy/validation with section 6 bounds and exclusions. Copy only curated owner/project-custom selections after provenance/secret checks. Extend restore validation to the personal journal and source manifests; restored host/grant automation starts disabled until rebinding. Reuse existing whole-vault backup/restore for all new files without resuming expired host jobs.
- Expected: a verified source package survives isolated vault restore; references still distinguish installed from backed-up availability. No installed skill directory is overwritten.
- Verify: temporary custom skill directory, excluded secret/env files, injected secret rejection, source changed during copy, bad hash/path, interrupted package and separate-target restore. Run the existing MCP recovery test as well.
- Failure: leave package INCOMPLETE and catalog unavailable for that version. Do not claim a pointer is a backup or a same-disk copy protects disk loss.

### S09 — Wire dedicated API and personal capabilities

- Depends on: S03–S08. Targets: local-personal.ts, createLocalServices, authorization, API initialization/close.
- Action: construct service from local vault/domain and owner host config; missing config yields disabled empty state. Mount new agent routes before legacy capture middleware and fallback; owner cookie routes remain distinct. Add narrow capability validation/UI metadata across create/update consumers, not bootstrap grant defaults. Return safe stable errors with bounded payloads. No cloud-mode personal routes.
- Expected: opted-in fixture agents can access only their personal operations/host; revoked/expired tokens fail immediately; unrelated agents still cannot read imported personal sources or raw configured roots.
- Verify: `tests/integration/local-domain-personal.test.ts` under test:local; cross-origin/host, cookie/bearer substitution, missing JSON, oversize, arbitrary path payload, revoked token and missing config. Keep current API tests passing.
- Failure: fix route ordering/guard in scope; do not broaden legacy `local.valid` to bypass a failing personal permission test.

### S10 — Add MCP and protected CLI calls

- Depends on: S09. Targets: seven new tools/client, index registration, CLI/launcher dispatch.
- Action: use shared contract schemas and local-runtime detection. Personal methods call dedicated endpoints without repository identity. CLI receives one validated existing JSON input file; preserve start/context/save and token cleanup. Add no owner approval/grant endpoint to the agent tool surface. Update existing tool-count assertion to preserve the original set plus seven.
- Expected: fresh MCP process gets personal context, claims/reviews a synthetic session, saves/records outcome and a second process retrieves it without any project. Old automatic and domain round trips continue.
- Verify: test:mcp, denial with legacy capture-only fixture token, unknown operation, nonexistent JSON, cloud runtime, inaccessible host and invalid body. Inspect stdout for protocol-only output and no credentials.
- Failure: avoid replacing the installed transport or opening alternate ports. Repair client/server payload mismatch; do not alter owner configuration yet.

### S11 — Prepare hooks and additive workflow installer

- Depends on: S04,S05,S10. Targets: standalone hook, fixture installer, instruction docs.
- Action: implement `codex-personal-hook.mjs` using built-in Node only. It reads one bounded JSON stdin, validates configured host/session identity and writes a metadata spool event atomically when ATLAS consent for the current turn is allowed. The optional consent stamp on `/sessions/scan` is `{session_key,turn_id,mode:"allow"}`; only an authenticated reviewing agent, after reading the current owner instructions, can attest it. It stores metadata only and never overrides a host/session exclusion. An allow stamp for an earlier turn is invalid for a new turn; unknown/disabled/read-only/plan contexts perform no writes. A forbidden write needs no persisted deny receipt. SessionStart emits only a static bounded instruction reminder plus trusted cache availability metadata (at most 2,000 characters); actual note prose remains context returned by the personal tool and is never elevated into developer instructions. Stop/PreCompact/Interrupt/SessionEnd only queue metadata and return legal JSON (`{}` for Stop), never a block/continuation request. Events without a current turn ID may spool only a previously consented terminal revision whose source identity/digest is unchanged; otherwise skip and let authorized reconciliation find it later. Do not echo prompt, last_assistant_message or arbitrary transcript path. Do not run the API/another agent from the hook.
- Configure SessionStart, PreCompact, Stop, Interrupt and SessionEnd. Add UserPromptSubmit only if needed to detect explicit retention opt-outs, after inspecting its actual installed schema; do not guess a `prompt` key. Consent is otherwise updated by the connected agent under current human instructions before persistence. Reconciliation covers sessions for which hooks made no writes.
- Installer defaults dry-run; parameter `-Apply` is required. Support `-CodexHome` and `-ProjectRoot` fixture paths, exact hashed own-hook identity and per-run backups. Preserve existing DevDock hook group objects/unrelated JSON settings, and only replace one uniquely delimited ATLAS global block. Fail on duplicates/global override or foreign same-name registration. Do not edit trust records in config.toml. User must review/trust new definitions through normal Codex controls.
- Update repo instruction template to load personal context on eligible chats, keep project start for project tasks, save only useful subjects, process bounded pending work opportunistically, and complete a disposition when permitted. Skip saves entirely under read-only/privacy instructions; zero saves remain normal. No automatic separate AI launch or instruction to message/create other chats.
- Verify: `personal-hooks.test.ts` launches the hook with synthetic payloads and fake Codex home, checks no secrets in spool/stdout, duplicate callbacks, legal event output, invalid paths, disabled/read-only no writes, installer idempotency and exact preservation. Target measured hook p95 under 1 second/maximum under 2 seconds on the local fixture so it fits the 3-second end/interrupt limit; performance failures block rollout, not correctness fallbacks.
- Failure: keep installed client untouched, report unsupported event/schema/trust pending. Never use a trust-bypass flag or a broad hooks-file replacement.

### S12 — Add personal-first views without breaking project tools

- Depends on: S06–S10. Targets: personal components/API/CSS, LocalApp route/nav/filter wiring, existing agent capability controls.
- Action: implement section 6 UI exactly, shared tokens and scoped styles. Move home capture rendering to /capture; make / a personal profile with existing paths intact. Default graph/context excludes personal candidate/skill/profile-index operational noise, while dedicated readers still expose the actual local files. Add candidate confirmation/edit/dismiss, stop-using, baseline pin, skill availability/backup preview and scoped coverage retry/exclude states. Every mutation refreshes relevant React Query keys and reports failure without stale-success state. Do not display coverage percentages when incomplete.
- Verify: actual browser screenshots/interactions at 320x740, 390x844, 768x1024 and 1440x900, plus 320px pane/200% text enlargement, keyboard navigation, reduced motion and measured rendered contrast. Use project-scoped Playwright/DOM measurements, not the design kit's self-test. Click every new control; confirm source capture, original graph and backups still work. All loading/empty/partial/error/retry/disabled/success/conflict states must be exercised.
- Failure: fix scoped panel CSS/state; do not change the global theme/graph renderer or hide data to make layout assertions pass.

### S13 — Implement selective backfill and deterministic reconciliation

- Depends on: S04–S11. Targets: personal-maintenance.ts, sessions/review/candidate services.
- Action: add CLI subcommands `inventory`, `backfill-preview`, `backfill-apply`, `reconcile`, `skills-scan`, `skill-backup`, `erasure-preview`. Input is an existing secret-free JSON scope file containing host IDs, selected session keys/date bounds and expected policy revision; no shell-built snippets/raw text. Dry-run is default. Apply requires `--apply` and current matching preview/scope digest. Preview only discovers/queues metadata and proposes the review order; it does not invent memories. Existing connected agent uses seven tools to review pages. Prioritize explicit correction/preference-bearing work as an agent decision, not a naive keyword signal that proves value.
- Historical native memories/old reports can locate a candidate source but cannot confirm an owner preference without its original owner input or current explicit confirmation. Backfill candidate export stores only proposed subject/evidence refs, not message pages. Rescans reuse concept keys/refs and respect suppression. Process at most five session revisions per natural agent checkpoint; leave the remaining queue visible. No cron/service/AI launcher.
- Erasure preview enumerates the selected subject lineage, local Markdown/history/request/derived copies and known backup packages plus missing-coverage warnings. It performs no deletion; actual sensitive-data purge requires a separate explicit target approval and repair plan because immutable history/backups can retain copies.
- Verify: synthetic corpus apply/replay produces identical active concepts, dismissed claims stay dismissed, missing source remains unavailable, changed preview invalidates apply, read-only command does not write a review result and crash reconciliation resumes pending work. Real history is reserved for G02.
- Failure: preserve queue and valid subjects; report exact inaccessible/unsupported scope. Never mark a whole host reviewed because a preview completed.

### S14 — Evaluate quality and fault boundaries

- Depends on: S01–S13. Targets: fixture cases, unit/integration/MCP/browser tests, evaluation script, package scripts.
- Action: add `test:personal` using existing Vitest and `evaluate:personal` invoking `node --import tsx scripts/evaluate-personal-memory.ts`. Fixture oracle is fixed before evaluating extraction. Include 30 synthetic review cases: 8 explicit general preferences/constraints, 6 scoped project-only choices, 6 routine/no-value tasks, 4 ambiguous/assistant-origin cases, 3 corrections and 3 privacy/secret exclusions. Expected outcomes and source refs are authored independently of the implementation.
- Separate deterministic storage/retrieval checks from connected-agent judgments. Export only bounded secret-free review fixtures; the current existing agent can propose classifications, which the oracle scores. Do not emulate AI extraction with test-only auto-classification code or present fixture retrieval as future-chat personalization.
- Acceptance: all 30 oracle dispositions correct; zero unsupported owner promotions, leaked secrets, resurrected suppressed claims or project-scope contamination; all 8 explicit owner subjects retained; all 3 corrections resolve to the correct head. Fifteen held-out queries must retrieve the expected current applicable subject/skill or abstain, with no extra project context by default. Report misses explicitly; do not adjust expected outputs after seeing results without an evidence-backed correction.
- Performance: metadata discovery over 1,000 synthetic main sessions <=30 seconds total via continuations; each scan request <=4 seconds; review page memory/output bounds hold; warm personal-context p95 <=500ms over 30 calls with 200 owner subjects/200 curated skill refs; no weakening old domain/graph admission or FPS thresholds. Context serialized budget and journal caps are hard assertions. These are proposed acceptance targets, not planner measurements.
- Verify: new focused suite, test:local, test:mcp, test:domain-browser; fresh process restore; interruption/race/revocation/fault matrix below. Run full unit/graph/browser regression in S15.
- Failure: diagnose false positive/missed correction/selection separately. Do not increase save counts to inflate perceived learning, lower the oracle threshold or rewrite model-facing instructions to assume unsupported facts.

### S15 — Full local gates, docs and handoff

- Depends on: S14; G01–G04 may remain separately pending.
- Targets: execution report, acceptance checklist, tracking/policy/workflow/architecture docs, this checklist.
- Action: document implemented personal contracts, opt-in permissions, independent native-memory controls, source provenance, no-value semantics, hooks/reconciliation, skill backup, suppression and erasure limitations. Replace stale claims of all-session coverage with the precise current host/time/scope. Update architecture/tracking without deleting historical evidence. Capture before/after vault/brief hashes and explain only task-owned new files/authorized index changes.
- Verify sequentially: `pnpm typecheck`; `pnpm lint`; `pnpm format:check`; `pnpm build`; `pnpm verify:bundle`; `pnpm test:unit`; `pnpm test:local`; `pnpm test:mcp`; `pnpm test:domain-browser`; `pnpm exec playwright test --config tests/playwright.local.config.ts`; `pnpm run evaluate:personal`. These are existing scripts except the explicitly added evaluation script. Do not run test:neon/test:db/production setup for this local feature. If a command exceeds a tool wait, poll its session and keep the owner informed; do not silently abandon it.
- Expected: local implementation evidence is complete; real client, historical apply, actual fresh-chat and extra-host status remain separate. Report warnings/failures/unchecked states and original-preservation evidence.
- Failure: do not mark complete from edits alone. A failing unrelated baseline is documented with separate evidence; a task regression blocks dependent rollout until fixed within scope.

## 10. Real-world gates and additional hosts

### G01 — Current-PC client rollout

- Depends on: S15 and an explicit execution instruction covering actual Codex configuration, the named agent's personal grants and enabling this host. The planning request is not that instruction.
- Exact targets: configured local Vault, `.local/personal-hosts.json`; user home `C:\Users\user\.codex\AGENTS.md` ATLAS block and hooks.json; existing agent `267bc649-b732-4450-9b33-e84f38cdf0b2` after live identity recheck; host windows-primary. Reuse protected credential through existing launcher; never print/extract it or enroll a new identity. Preserve DevDock hooks/MCP registrations.
- Action: create fresh private backup/restore proof, review install preview and authorize narrow personal capabilities/host scope through owner controls, apply additive installer, use normal `/hooks` trust workflow where supported. Do not edit Codex native memory settings. Restart only the identified ATLAS process if needed and authorized; do not kill arbitrary listeners.
- Verify actual installed desktop events, resumed thread, normal stop, interrupted turn and compaction; measure hook deadlines and queued/reviewed receipts. Test legacy instructions and DevDock activity still work. Mark CLI/IDE unobserved unless tested on this same authorized host. No claim that SessionEnd fires on merely switching chats.
- If hooks are unsupported/untrusted, retain instruction/scan fallback and label coverage automation partial. Do not bypass trust or launch another AI. Gate remains pending until exact capabilities are observed.

### G02 — Apply to selected real historical sessions

- Depends on: G01 and explicit approval of an existing backfill preview/scope: windows-primary, available main-session keys/date bounds, ATLAS retention/exclusions and maximum batch. Existing research counts are not the scope approval.
- Action: review original owner input in memory, preview candidate subjects with source locators, reuse/replace current subjects through the agent, record reviewed/no-value outcomes and keep inferred patterns unconfirmed. No raw transcripts in Vault, no automatic global preference derived from project-only instructions, no cloud writes.
- Verify coverage against the approved inventory, all saved claims source-backed, original Vault files preserved, no duplicate concepts on replay, and accurate pending/unavailable/excluded counts. Stop the affected session if privacy, attribution or retention instructions are ambiguous; do not fabricate a winner. Capture can proceed for other independent eligible sessions.

### G03 — Actual fresh-chat acceptance

- Depends on: G01; use G02-derived knowledge only if that application was authorized.
- User starts an ordinary new Codex chat (or explicitly requests an acceptance chat). Do not create/message a user-owned chat or launch a new AI process autonomously. Provide a short task that should use one real current preference and a task where project detail should be irrelevant. Observe the actual tool/context read and behavior. A fresh MCP process alone proves protocol persistence, not that an AI applied the preference.
- Verify relevant knowledge is recalled without repeating it, exceptions/current correction are respected, unsupported preferences are not asserted and project scope does not leak. Save evidence as bounded observations without a transcript dump. If not observed, mark this gate Awaiting actual fresh-chat acceptance, not Completed.

### G04 — Additional machine, alternate Codex home or selected export

- Local adapter contract is part of S04/S13: `PersonalHostAdapter` exposes `inventory(cursor)`, `readRevision(sessionKey,revision,pageCursor)` and `verifyRef(ref)`, returning the same descriptor/page/ref schemas. Ship `codex-local-jsonl` and an owner-selected export adapter, disabled until configured. Export format: `{format:"atlas-personal-session-export-v1",host_id,exported_at,sessions:[{native_session_id,source_version,role:"main",messages:[{message_id,turn_id,timestamp,text,terminal_state}]}]}`. Strict limits: 2 MiB complete export, 100 sessions, 1,000 messages per session, 64 KiB per text, valid ISO timestamps/unique message IDs and terminal_state completed/aborted/open. Reject source/role/shape ambiguities; do not convert assistant text into human input. Exclude secret/injected/assistant material, process selected input outside Vault and retain only hashes/refs/knowledge.
- Actual additional-host integration is BLOCKED pending its concrete identity/location, access method and explicit scope/consent. The smallest missing input is which other host or export the owner wants connected; this does not block local implementation. Do not invent a cloud API, read all account chats through summaries or enable remote networking.
- When supplied, add the exact host/root or selected export path through owner configuration, preview inventory, verify native shape/consent on that source and test one permitted read/save/retrieve cycle. Keep per-host coverage separate. No automatic sync or cloud service is included; an owner-selected export is an explicit import boundary, not inferred account-wide access.

## 11. Acceptance and verification matrix

| Requirement/scenario | Setup / input | Check | Expected result / regression |
| --- | --- | --- | --- |
| R01 projectless context/save | Empty fixture with owner input | MCP personal round trip, inspect Projects/ | Valid owner subject and no new Project.md |
| R02 explicit useful memory | Supported general correction with exact source span | Oracle + source hash checks | One conditional, evidence-backed owner subject |
| R03 unconfirmed pattern | Repeated ambiguous/project-only choice | Candidate + context tests | Candidate only; absent from owner context |
| R04 valid no-value | Routine task pages all acknowledged | Review complete + record inventory | reviewed_no_value, zero notes |
| R04 no-change | Existing current applicable subject | Completion resolves actual ID/digest | reviewed_no_change, no duplicate |
| R05 interrupted/resumed/fork | Synthetic lifecycle and real G01 events | Unit + actual event inspection | New revisions/queued work; no inherited corroboration |
| R05 partial file/unsupported | Truncated line, incompatible version, missing source | Native adapter tests | Pending/unsupported/unavailable, no fabricated review |
| R06 attribution | Injected AGENTS/page/skill user-role records | Independent fixture oracle | Not owner preference evidence |
| R06 secret | Secret-bearing user segment/skill file | Scan/page/package tests | No secret text persisted or delivered; bounded exclusion |
| R07 crash | Save succeeds, final receipt fails | Fault + replay | Existing note reused; no false reviewed flag |
| R07 concurrency | Two agents claim/replace same head | Lease/CAS tests | Single valid head, deterministic conflict/requeue |
| R08 skill discovery | Duplicate same path + same-name variant | Skill fixture scan | Dedup real duplicate, preserve distinct variant |
| R08 backup | Curated custom skill with resources | Whole-vault isolated restore | Hash-valid sources; installed skill untouched |
| R09 scope | Unrelated projectless query | Packet + browser inspection | Baseline owner context, zero project/history noise |
| R09 budget | Long subjects, 2,000-char budget | Serialized envelope assertion | Whole-item omission and explicit truncation |
| R10 correction | Changed owner preference | Existing/new K01 tests | Original immutable; correct current version |
| R10 suppression | Dismiss/stop using then rescan | Legacy/general/personal retrieval | No resurrection; history retained |
| R10 erasure preview | Subject with history/backup refs | Maintenance dry-run | Exact known-copy manifest, no deletion/false erase claim |
| R11 quality | Fixed 30 cases + 15 held-out queries | evaluate:personal | All specified oracle checks; observed limitations recorded |
| R11 actual application | New connected chat | G03 human-started observation | Appropriate current preference used, no invented intent |
| R12 permissions | Old capture-only/revoked/other-host token | HTTP/MCP tests | Denial; personal source RLS analogue unchanged |
| R12 installed coexistence | Existing hooks + config backup | Installer fixture + G01 | DevDock/unrelated config bytes preserved; trust normal |
| R12 source boundaries | Production browser bundle | verify:bundle | No core/SQL/secret imports |
| R13 extra host | Disabled adapter, later concrete target | Export fixtures + G04 | Separate host scope; no account-wide claim |
| Responsive/actions | Four viewports, text enlargement, keyboard | Rendered screenshots and actual clicks | Readable/operable states, no overflow or hidden features |
| Original invariants | S00 files and source brief | Hash comparison after each phase | Existing files unchanged except declared, authorized edits |
| Existing product | Full current suites incl graph/recovery | S15 commands | No relaxed thresholds or removed regression coverage |

## 12. Recovery, stop conditions and honest completion

Keep task patches and initial copies in the execution artifact directory. Revert only task-owned hunks; never `git reset --hard`, blanket checkout or recursive delete a computed path. Verify absolute targets within the intended fixture/output directory before any cleanup. On real-data failure, preserve new valid owner notes and repair by explicit replacements/replayed receipts; do not delete originals to conceal a bad capture. Disable the new host/policy and stop its review queue if necessary; leave legacy project functionality running.

Installer rollback uses its immediately preceding backups and exact own-hook identity, preserving unrelated additions since install. Restore a global file wholesale only if its current digest equals the task-installed digest; otherwise remove only the exact task block/hooks and report the concurrent change. Revocation/expiry is not repaired by reenrollment. Restore source packages into separate directories; never overwrite user/plugin skill sources.

Stop dependent work if: current root/agent/host identity differs; a source contract materially changed; a new permission or external target is required; provenance cannot be verified; an active conflict lacks a supported replacement; a journal/catalog is corrupt; source paths escape permitted roots; an actual readonly/privacy constraint prohibits capture; or a checkpoint fails without a diagnosed task-scoped remedy. Routine symbol line drift, an explicitly additive tool elsewhere, or a new unrelated vault note can be accommodated while preserving its data and refreshing baseline evidence.

Implementation completeness must distinguish: code/fixtures, actual local filesystem/API integration, installed client callbacks, historical backfill, real fresh-chat application and other-host coverage. Never label the last four complete from unit/MCP fixtures. No perfect memory or universal session coverage is promised.

## 13. Handoff audit

Completed planner review: R01–R13 map to numbered implementation and acceptance steps; the 16 local steps and four runtime gates are present; existing source anchors are verified and new files are explicitly marked. Reviewed schema initialization cycles, real actor attribution, lock ordering, strict new/legacy payloads, full-envelope budgets, inherited input attribution, snapshot permission leakage, suppression in old recall paths, no-value attestation, skill-source recovery and hook trust/deadlines. Normal-permission baseline tests passed 24/24; proposed feature checks remain unrun. Planning preserved all 52 baseline visible Markdown files, all 29 tracked inspected-file hashes, three client configuration hashes and the source-brief hash. See `.artifacts/personal-memory-plan-2026-10-21/handoff-validation.json` for final recorded validation. No unresolved design decision blocks S00–S15. G01/G02 require explicit scoped execution authorization, G03 requires an actual fresh chat and G04 requires the other host/export identity. No application test result here validates the unimplemented design.

## 14. Copy-ready executor prompt

```text
Execute the local implementation phase of C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT\docs\plans\2026-10-21-personal-memory-implementation-plan.md at Light/low reasoning, using its agreed design and exact project root C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT.

Read the entire plan, current AGENTS.md and Vault/AGENTS.md, required tracking/architecture/session documents, current owner instructions and the research report before edits. Inspect HEAD, dirty files, current contracts and existing owner data. Run S00 preflight, preserve the dirty F01–F06 implementation and all original Markdown/source-brief evidence, and mark P02 In Progress before implementation.

Follow S00–S15 in dependency order, updating the plan checklist and an execution report at each checkpoint. Use the projectless personal API, exact evidence rules, separate bounded coverage journal, explicit candidates/suppression and canonical skill references/source backups. Keep existing project tools/graph/capture protocols and permissions working. Save no routine logs as owner knowledge. Use current connected agents for inference; add no model SDK/key, embeddings, background AI launcher, scheduled startup, cloud knowledge writes or unrelated cleanup. Do not create or message other user chats autonomously.

The local phase does not include G01–G04 unless my current execution instruction explicitly covers their concrete actions and scope. Prepare their dry runs and report pending gates. Actual Codex hook/global instruction installation, narrow personal grants, real historical session application, a fresh acceptance chat and other-host setup must follow section 10; do not infer those authorizations from the plan. Never bypass hook trust or reset credentials.

Run prescribed focused and full local checks, including real rendered UI interactions. Distinguish sandbox filesystem failures from application failures without weakening atomic writes or assertions. Stop affected dependent work if a target/contract materially differs, evidence or permission is missing, a privacy/read-only instruction forbids retention, or a checkpoint cannot be repaired within scope. Preserve valid data and report the evidence rather than redesigning broadly.

Finish with changed files/resources, observed command results, original-preservation evidence, actual capture-quality/coverage scope, incomplete step IDs and pending runtime gates. Do not claim session coverage or personalization merely from successful saves, metadata inventory, a fresh MCP process or green fixtures.
```
