# ATLAS / NeuralVaultYKT — implementation handoff

Date: 2026-10-16, Asia/Taipei. Intended executor: Codex at Light / low reasoning.

Execution amendment L01, 2026-10-17: owner now requires a single local Obsidian-style Markdown folder as the source of truth, directly usable by agents. This supersedes cloud knowledge persistence and normal Neon/Auth/storage dependency. Preserve existing cloud history without deletion; migrate owned knowledge read-only. Basic file graph is accelerated alongside local project/context/capture tools. Follow LOCAL_VAULT_DESIGN.md/PROGRESS/TASKS for current architecture; do not resume cloud-centric S09–S30 implementation automatically. Full ingestion/review/semantic graph/backups need to follow the local-file design. No separate AI API.

Execution amendment A01, 2026-10-17: the owner explicitly prioritizes automatic project registration, context loading and project checkpoint capture by existing Codex agents, with global AGENTS guidance and actual scoped MCP registration on this Windows PC. Implement a small early vertical slice on the already authorized Neon production target after rehearsal. Checkpoints are immutable agent-recorded Markdown/provenance stored transactionally in PostgreSQL; they are distinct from S09 file originals, canonical memories and later review. Do not claim S09–S23 complete from this slice. Instructions and tools should remove routine project/note forms from the owner's workflow. See docs/AGENT_WORKFLOW.md and TASKS A01 for implementation evidence and scope. Original planning status below is historical; N01–N03/A01 execution authorizations supersede it where applicable.

Revision 2, confirmed by the owner: existing connected agents perform knowledge organization; ATLAS supplies storage, permissions, review and retrieval. No separate AI API is required. The first release uses keyword/alias/graph search. Notes wait in the Inbox until an authorized agent processes them.

**READY for local implementation after a separate execution request. Revision 2: agent-driven knowledge processing, with no separate AI API. Neon provisioning and actual client integration remain PENDING AUTHORIZATION.** This planning session creates documentation only. No application, database, cloud resource, credential, or integration was created or modified.

Project root: `C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT`.

Inspected revision: none; the directory was empty and was not a Git repository. There were no application files, dependencies, tests, local instructions, or existing user changes to preserve before these planning files were saved. Reinspect this fact before implementation.

Read this document first. The preserved [source brief](2026-10-16-atlas-source-brief.md) provides the full product specification. The decisions below refine that brief and incorporate the owner's newer answers. A fresh executor does not need the original chat.

## 1. Owner decisions and readiness

The owner explicitly selected:

1. Personal use on this Windows PC, with **Neon PostgreSQL and local MCP**.
2. **Codex or another capable, explicitly connected agent performs the AI work through MCP. No separate OpenAI/AI-provider API, API key, model service, or AI billing integration is required.** This supersedes the earlier provider selection.
3. A **new dedicated ATLAS Neon project in Singapore**, rather than either existing project.

These answers override the original brief's Supabase and separate AI-provider requirements. Do not install Supabase or AI-provider SDKs, provision Supabase, use Supabase Auth/Storage, or copy auth.uid() policies into Neon SQL. Keep PostgreSQL full-text/trigram search, source provenance, RLS and the human workspace. Vector/embedding/hybrid search is outside P0; do not install pgvector or invent embedding vectors. The source brief remains unchanged as historical evidence; this revision is authoritative for execution.

Chosen cloud design: new Neon project `ATLAS`, region `aws-ap-southeast-1`, PostgreSQL 18, database `neondb` with application schema `atlas`, managed Neon Auth, private Neon Object Storage bucket `atlas-sources`. This is a proposed resource specification, not an existing resource identity. Project, branch, endpoint, and auth URLs must be recorded after authorized provisioning; never invent their IDs.

Use `main` for the eventual personal vault and `atlas-dev` for initial hosted validation with fictional data. Local automated database tests use a dedicated Docker PostgreSQL instance. Existing Neon projects `Tech-Trends` and `Sinta Wedding` are outside this task; do not use their data, branches, credentials, or endpoints.

| Boundary | Ready now? | Executor action |
| --- | --- | --- |
| Documentation, scaffolding, local code, local database tests | Yes, once implementation is requested | Follow S01–S30; execute available local checks |
| Provision new Neon project/Auth/bucket/roles/branch | No authorization in this planning turn | Prepare E01 resource specification; execute only after an explicit execution request covers these external writes |
| Apply migrations to a Neon branch | Depends on E01 and explicit target authorization | Follow E02; use the recorded dedicated project/branch only |
| Separate AI-provider API requests | Excluded | No SDK, API key, provider configuration, cost reservation ledger, embedding calls, or automatic model service |
| Connect the owner's actual Codex client | Server can be built/tested locally | Prepare configuration; obtain authorization before changing the owner's client settings or granting its credential access |
| Hosted web app, remote MCP, public exposure | Outside first release | Separate future design and authorization |

No unanswered product decision prevents starting the local phase. Live credentials, owner identity, and actual provisioned resource IDs are setup inputs, not values the executor may guess. Neon Auth's published SDK is currently prerelease (`0.6.0-beta`, no stable version found); pin it, isolate it in one adapter, and treat live auth validation as a required release gate. Do not call the finished system production-ready solely because local checks pass.

### Progress checklist

All implementation steps are unstarted. Planning inspection is complete; the source brief's entire Phase 0 is **not** complete because scaffolding and checks remain undone.

- [ ] S01–S04: project records, toolchain, runtime configuration, migration/test harness.
- [ ] S05–S08: schema, isolation, authentication, projects and collections.
- [ ] S09–S13: originals, editing/imports, sensitive-content controls, chunks, safe URLs.
- [ ] S14, then S21, then S15–S17: deterministic jobs, early agent credentials, processing-task protocol, submitted organization, memory review.
- [ ] S18–S20: approved summaries/aliases, lexical + stored-graph retrieval, quality evaluation.
- [ ] S22–S23: fifteen MCP tools, project-local agent instructions, fresh-session organization/retrieval round trip. S21 runs earlier.
- [ ] S24–S27: actual graph data, stable graph UI, responsive workspace, trace/change views.
- [ ] S28–S30: export/recovery, hardening, verified personal release.
- [ ] E01–E03: authorized Neon setup, migration validation, actual agent/client checks with fictional data and no separate AI API.
- [ ] P1 backlog: extended integrations, only after the P0 release gate and a separate scope selection.

## 2. Observable goal and product boundaries

Today there is no application. The first complete release must let the owner sign in, create a project, save/import documentation, retain the original and its versions, let AI propose classifications and source-backed memories, review those proposals, search current knowledge, and explore its stored relationships.

The decisive acceptance scenario is a fictional `clinic-management-demo` project: an authorized local MCP client retrieves a compact architecture/constraints packet, proposes an evidence-backed new decision, the owner approves it, all client/API/worker processes restart, and a new client session retrieves the approved decision. Private personal notes and another project's data never appear. A real Codex fresh-chat demonstration is additionally required before claiming Codex integration works.

### Must have

- One owner per application installation; multiple projects and collections within the owner's workspace. Preserve workspace/user columns and prove isolation with a second synthetic owner in tests. No team invitations or billing UI.
- Persistent, portable originals and Markdown export; many-to-many collection membership without copied documents.
- Five memory types (`semantic`, `procedural`, `episodic`, `project`, `core`), four progressive retrieval levels, evidence, history, temporal validity, supersession, and review.
- Agent-driven classification of owner-authorized content: agents submit estimates/suggestions through MCP, manual corrections win, and queued sources remain Awaiting agent while no agent is processing them.
- Scoped full-text/exact/trigram search, approved aliases and stored graph expansion, concise context under an explicit token budget, and a truthful lexical search label. No embeddings are needed for P0.
- Six named read tools, three proposal tools and six processing-task tools (fifteen total), server-managed agent identities, revocation and least privilege.
- Functional graph backed by persisted items and relationships; a usable search/list alternative.
- Dark, compact three-region desktop workspace; functional mobile views, keyboard access, reduced motion, and adequate contrast.
- Durable deterministic ingestion jobs, resumable agent processing tasks, source preservation on failure, data export/recovery and accurate development records. ATLAS never silently launches an agent or model service.

### Must preserve

- The product copy, nine seed collection families and their listed children, and anti-generic design direction in source-brief sections 2 and 10.
- Current repository state if it changes after this inspection. These two planning artifacts are evidence, not generated application output.
- Manual collection exclusions, explicit grants, source versions, verification history, old decisions, and actual test outcomes.
- This Windows project location. Do not relocate it into the automation workspace; this is a personal application, not an n8n workflow project.

### Must not have

- Mock classification/search results presented as real agent work, invented graph edges, silent promotion of agent statements to verified facts, or claims of permanent internal model memory.
- Indiscriminate conversation capture, broad repository crawling, sharing quarantined/private source text with an agent without an explicit processing grant, or collection membership used as permission.
- Supabase, a browser database connection, public source buckets, Neo4j/Redis/vector services, LangChain, Graphiti/Mem0 dependencies, custom neural compression, or a generic chat dashboard in P0.
- Public deployment, remote MCP transport, n8n instance changes, workflow execution, real clinic/client data, Git push/commit, Windows startup registration, or persistent background installation without a separately authorized scope.

### Don'ts specific to this build

- Do not use a Neon administrative connection for normal API requests or hand a database URL to MCP clients.
- Do not assume a JWT subject is a UUID; Neon identity subjects are opaque strings.
- Do not set request identity on a pooled SQL connection outside the same explicit transaction as its queries.
- Do not rank all data and then filter permissions; apply authorization before candidate selection, counts, graph expansion, and caching.
- Do not let editable retrieved text act as server instructions, executable code, tool configuration, or an authorization source.
- Do not smuggle a provider SDK, local LLM, embedding endpoint or paid agent-launching service back into P0. If semantic vector search is later requested, design it as a separate scope.
- Do not mark the graph, AI organizer, auth, or client integration complete using only typechecking or synthetic fixtures.

## 3. Inspected context and evidence

| Verified file/resource | Anchor | Evidence | Planned action |
| --- | --- | --- | --- |
| Project root above | Original inspection and Revision 2 directory listing | Originally empty; now only two Markdown planning artifacts; no app or Git repository | Create application only during execution |
| `docs/plans/2026-10-16-atlas-source-brief.md` | Sections 1–21 | Exact copy of 2,190-line supplied attachment | Preserve; apply Neon and agent-driven/no-AI-API overrides from section 1 of this plan |
| Original attachment | `C:\Users\user\.codex\attachments\2fe53131-7b91-4da5-ad48-39a292a0760c\Pasted text.txt` | SHA-256 `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A` | No edits; fresh chats can use preserved copy |
| [Shared conversation](https://chatgpt.com/share/6ad233c2-5000-83ec-bfc7-4c0ea9d5210d) | User message about apps, automations, research, and sorting by agent | Read in browser; confirms memory-first product and concise user-facing copy | Context incorporated here; no dependency on future link access |
| `C:\Users\user\.agents\skills\implementation-plan\SKILL.md` and `references/plan-format.md` | Scope; numbered steps; readiness | Planning-only invocation | Implementation waits for a new execution request |
| `C:\Users\user\Desktop\PROGRAMMING\AUTOMATIONS\Automation Context Mapping\AGENTS.md` | Source-of-truth, credentials, n8n env restrictions | Read for the future n8n import boundary | At P1 n8n work, reread it, `Documentation/`, `Skills/INDEX.md`, and matching official skills |
| Neon project listing, read-only | Names and region | Existing projects are unrelated; owner chose a new dedicated project | No existing project was inspected internally or changed |

Relevant skills were read: implementation-plan; Neon overview, PostgreSQL, branch lifecycle, Auth and its managed-auth reference, Object Storage; official OpenAI documentation guidance. Supabase guidance was reviewed before the owner's Neon override; it is not the implementation stack.

### Observed baseline

Commands ran from the project root unless otherwise stated:

| Check | Observed result |
| --- | --- |
| `Get-ChildItem -Force`; `rg --files -g AGENTS.md` | No project files / no local AGENTS.md |
| `git status --short` | Not a Git repository; no branch or commit |
| `node --version` / `npm --version` / `pnpm --version` | `v24.18.0` / `11.16.0` / `11.25.0` |
| `git --version` | `2.55.0.windows.2` |
| `docker --version`; read-only engine check | Docker `29.6.1`; daemon responded when allowed access |
| `Get-Command neon` | No Neon CLI on PATH was found |
| Registry metadata | Exact versions and relevant engines/peers verified; no packages installed |
| Application build/tests | Not run: no application or test suite exists |
| Live SQL, Auth, bucket, MCP | Not run; no target configured and this turn is planning-only. Separate provider integration is excluded. |

Initial sandboxed registry/Docker checks lacked network/pipe access; permitted read-only checks then succeeded. Do not report these access restrictions as application failures. Node executable is `C:\Program Files\nodejs\node.exe`.

## 4. Chosen architecture

Use a small pnpm workspace, retaining the supplied React/Vite direction. Local Node processes make a separate hosted API or Neon Function unnecessary for the first release.

```text
Browser: React + Vite + Tiptap + Sigma
  | Neon managed Auth -> short-lived user bearer token
  | /api/v1 requests with bearer token
  v
Local Hono API (127.0.0.1:4317)
  -> verified human or agent principal -> domain services -> RLS-protected pg queries
  -> original-source store -> private Neon S3 bucket
  -> deterministic jobs -> local worker -> normalize/chunk/lexical-index sources
  -> organization tasks -> Awaiting agent in Inbox

Existing Codex / another connected agent (owner-approved task)
  -> local stdio MCP -> claim/read selected source -> infer/classify/summarize
  -> submit structured suggestions -> backend validates -> owner review -> Neon

Local stdio MCP -> authenticated loopback API -> same domain services
Neon stores originals metadata, chunks, memories, grants, jobs, tasks, relationships, traces
```

In development Vite uses `http://localhost:5173`, proxies `/api` to `127.0.0.1:4317`, and uses a strict port. The API and worker are separate processes. In the personal release the API also serves the built SPA; the browser opens `http://localhost:4317`. Bind servers to loopback, validate Host/Origin, and do not create tunnels or firewall exceptions.

Browser business data always passes through the local API. Neon Data API is not enabled. Neon Auth handles identity; application permissions remain separate. Originals use private Neon Object Storage and API-proxied downloads. The API must be running on this PC for local MCP; a deterministic worker runs only while local ingestion/indexing work exists. A capable agent must be active, connected and authorized to classify/extract/summarize sources. Merely adding a note does not start Codex or contact a model. Idle tasks remain Awaiting agent and resume through a later authorized session. Neon/cloud access still requires Internet. Existing agents use their own normal usage/access; ATLAS neither controls their subscription limits nor promises free agent usage.

### New source layout

All paths below are relative to the explicit project root. They are **proposed new files**, not inspected implementation anchors.

```text
apps/web/src/{app,auth,components,features,lib,styles}/
apps/api/src/{index.ts,app.ts,worker.ts,config.ts,middleware,routes}/
apps/mcp-server/src/{index.ts,api-client.ts,tools.ts,config.ts}/
packages/contracts/src/{index.ts,common.ts,knowledge.ts,memory.ts,retrieval.ts,agents.ts,organization.ts,graph.ts}/
packages/core/src/{db,auth,knowledge,memory,retrieval,agents,organization,graph,jobs,storage,security}/
database/migrations/{0001_identity.sql,0002_knowledge.sql,0003_memory_graph.sql,
  0004_jobs_organization.sql,0005_retrieval.sql,0006_agent_access.sql,0007_policies.sql,0008_indexes.sql}
database/seeds/collections.json
scripts/{migrate.ts,seed-demo.ts,bind-owner.ts,check-target.ts,start-mcp.ps1}
skills/atlas-knowledge/{SKILL.md,references/mcp-workflow.md}
tests/{unit,integration,mcp,e2e,evaluation,fixtures}/
tests/{vitest.unit.config.ts,vitest.db.config.ts,vitest.mcp.config.ts,playwright.config.ts}
infra/compose.test.yml
neon.ts
docs/{IMPLEMENTATION_PLAN,TASKS,PROGRESS,DECISIONS,ISSUES,SESSION_LOG,TEST_REPORT,
  ARCHITECTURE,API_REFERENCE,SECURITY,SETUP,BACKUP,DEPENDENCIES}.md
AGENTS.md
README.md
.env.example
.gitignore
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
biome.json
```

`@atlas/contracts` contains Zod schemas/types only and is browser-safe. `@atlas/core` contains server domain logic, SQL repositories and adapters; the web app must never import it. Hono routes and MCP handlers are adapters. MCP calls API endpoints; it imports no database/storage credential or model client. Do not create empty knowledge/memory/retrieval packages.

### Dependency pins for S02

Registry versions verified 2026-10-16. Engine/peer ranges appear compatible with Node 24.18.0 and React 19.3.1; installation, compilation, and runtime compatibility remain untested. Use exact versions and a committed lockfile when committing is authorized. Recheck publication/peers if implementation occurs later; a major API mismatch requires replanning, not silent upgrades.

| Group | Exact packages |
| --- | --- |
| Web foundation | `react@19.3.1`, `react-dom@19.3.1`, `vite@8.3.4`, `@vitejs/plugin-react@6.1.2`, `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `react-router-dom@7.18.4`, `@tanstack/react-query@5.104.3`, `lucide-react@1.58.0` |
| Editor | `@tiptap/core@3.32.0`, `@tiptap/pm@3.32.0`, `@tiptap/react@3.32.0`, `@tiptap/starter-kit@3.32.0`, `@tiptap/markdown@3.32.0`, `dompurify@3.4.17` |
| Graph | `sigma@4.0.3`, `graphology@0.26.0`, `graphology-types@0.24.8`, `graphology-layout-forceatlas2@0.10.1` |
| API/domain | `hono@4.13.13`, `@hono/node-server@2.1.5`, `@hono/zod-validator@0.9.1`, `zod@4.6.7`, `pg@8.23.1`, `jose@6.2.12` |
| Neon adapters | `@neondatabase/auth@0.6.0-beta` (published prerelease), `@aws-sdk/client-s3@3.1152.0`; no optional Next peer needed |
| MCP | `@modelcontextprotocol/server@2.3.1`; test client `@modelcontextprotocol/client@2.3.1`; no AI-provider SDK |
| Safe URL parsing | `undici@8.12.2`, `ipaddr.js@2.5.0`, `@mozilla/readability@0.6.0`, `linkedom@0.18.13` |
| Fonts | `@fontsource/geist@5.3.0`, `@fontsource/ibm-plex-mono@5.3.0` (OFL-1.1; retain notices) |
| Tooling/tests | `typescript@7.0.2`, `tsx@4.23.15`, `@biomejs/biome@2.5.15`, `vitest@5.0.5`, `@playwright/test@1.64.1`, `@axe-core/playwright@4.14.0`, `concurrently@10.0.6` |
| Types | `@types/node@24.19.2`, `@types/react@19.3.0`, `@types/react-dom@19.3.0`, `@types/pg@8.23.1` |
| Neon tooling, only for authorized setup | `neon@8.7.2`, `@neon/config@1.9.2` |
| Local database fixture | Official `postgres:18-bookworm`; resolve/record immutable image digest and patch version during S04. PostgreSQL 18 compatibility is the contract; pgvector is not needed. |

Install editor/graph/URL/MCP dependencies in their owning packages when that step begins. Do not add everything to the root runtime dependencies. Biome replaces separate lint/format packages. DOMPurify has its own types; do not install deprecated `@types/dompurify`. The optional Babel/compiler peers of the Vite plugin and optional canvas/native peers are not needed for the chosen configuration.

## 5. Configuration, identity, and data contracts

This section chooses contracts; all code/algorithms are **proposed and untested**.

### 5.1 Configuration and operational limits

Root .env.local is gitignored and loaded by server commands using Node --env-file=.env.local. Vite exposes only VITE_ names. MCP receives only a scoped agent token and loopback API URL. No process uses an AI API key or provider SDK.

| Name | Owner / rule |
| --- | --- |
| DATABASE_URL | API atlas_api role, pooled Neon URL; no elevated role |
| WORKER_DATABASE_URL | Deterministic worker atlas_worker role, pooled Neon URL |
| DATABASE_URL_UNPOOLED | Direct migration/backup connection only; never API configuration |
| DATABASE_TARGET_ID | Actual recorded project/branch/database target; migrations require exact match |
| NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL | Actual selected branch values, including full Auth path |
| VITE_NEON_AUTH_URL | Public Auth URL matching the API's selected branch |
| ATLAS_OWNER_ISSUER, ATLAS_OWNER_SUBJECT | Explicit verified owner binding; no first-visitor ownership |
| AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION | API/worker only; dedicated private atlas-sources bucket |
| API_HOST, API_PORT | 127.0.0.1, 4317; fail rather than silently switch ports |
| ATLAS_API_URL, ATLAS_AGENT_TOKEN | MCP launcher only; loopback URL and revocable scoped credential |

No OPENAI_API_KEY, AI_PROVIDER, model selection, AI spending ledger or embedding configuration exists. The agent host's model, subscription, token usage and availability belong to that host; ATLAS must not claim to control or accurately meter them.

The user's no-env rule applies to n8n workflows, not this Node/Vite app. No P0 n8n workflow is built.

Limits: text/Markdown/note payloads 2 MiB; URL body 2 MiB after decompression; chunk target 400/max 800 conservative token units; organization batch max 20 chunks; submission max 256 KiB with max 20 memories, 20 entities, 40 relationships, 30 classifications and 30 tags; search 25/default and 100/max; retrieval token budget 256–8,192/default 2,048; task lease 15 minutes, renewal cannot extend past 60 minutes from first claim or grant expiry; explicit processing grant 24 hours/default and 7 days/max; graph initial 500 nodes/2,000 edges, max response 1,000/4,000, expansion depth 1/default and 2/max. These are proposed limits, not measured performance claims.

### 5.2 Human and agent principals

`Principal = { kind:'human', userId:UUID, issuer:string, subject:string } | { kind:'agent', agentId:UUID, credentialId:UUID, workspaceId:UUID }`. Only authenticated middleware creates one. Request bodies never supply a trusted principal, workspace membership, owner identity, or actor ID.

The web Auth adapter uses Neon's documented `createAuthClient` and `BetterAuthReactAdapter()`. Obtain `authClient.token()` and send `data.token` as a bearer token; do not use a Supabase adapter. API JWT verification uses `jose`, the configured branch JWKS, expected issuer `new URL(NEON_AUTH_BASE_URL).origin`, EdDSA, required `sub`/`exp`, and expiration checks. Resolve `(issuer, subject)` to an application user; require the configured owner binding and current enabled user/membership. Never trust profile metadata for roles. Do not invent an audience claim; enforce a configured audience only if the actual branch token contract contains one. Sign-out clears client tokens/query caches; already-issued JWT expiry is not instantaneous remote revocation. API-side disabled user/membership checks immediately revoke vault access.

Agent credentials: generate 32 cryptographically random bytes; render as `atlas_` plus base64url. Store only SHA-256 digest, a short display prefix, credential/agent IDs, issued/expires/revoked timestamps, and allowed operations. A random high-entropy API token does not need password-style hashing. Check digest, agent status, expiry, and grants on **every request**, including reads, graph, evidence, and source expansion. Return the raw credential once to the owner; redact it everywhere else. No positive authorization cache in P0.

For Windows client storage, provide a reviewed PowerShell launcher using an owner-entered SecureString exported with DPAPI (`Export-Clixml`) to ignored `.local/atlas-agent-token.clixml`; decrypt transiently inside the launcher and pass only to the child MCP process's `ATLAS_AGENT_TOKEN` environment. Do not write raw credentials into TOML, command arguments, logs, the repo, or this plan. Plaintext necessarily exists in process memory/environment while running; DPAPI protects the saved local file, not a compromised running owner account.

### 5.3 Exact access semantics

All item reads require the matching workspace and nondeleted item. Humans require current workspace membership; the installation restricts access to the bound owner. Agent reads additionally require an active credential and `read` operation plus the item rule below. Project assignment never implicitly includes global/personal knowledge.

| Item scope | Agent visibility |
| --- | --- |
| `personal` | Denied. Owner explicitly changes scope and reviews evidence before sharing |
| `global_development` | Explicit global-development scope grant |
| `project` | Explicit read grant for that exact project |
| `agent_private` | Matching owner agent plus explicit scope grant; never another agent |
| `shared_agents` | Explicit item grant naming that agent |

General proposal tools require propose plus a compatible target scope/project. Processing tools require process_knowledge and either existing source read+process rights or an explicit owner-issued processing_grant for the selected version and agent. A processing grant can permit reading a personal source solely through task endpoints; it never changes its ordinary scope or grants private-memory retrieval. Agents cannot approve, edit canonical memories, broaden access, register agents, modify grants, export the workspace, or invoke owner operations.

Source versions/chunks inherit their source item's scope. A derived memory's audience must be a subset of every supporting source audience. A relationship requires readable edge, both endpoints, and evidence. An entity is canonical within its access partition, never across private/project/shared boundaries. Prevent hidden titles, counts, citations, endpoints, or semantic similarities from leaking through graph/search/review/trace APIs.

Compute access partitions from scope and exact audience: `personal:<ownerUserId>`, `global:<workspaceId>`, `project:<projectId>`, `agent:<agentId>`, or `shared:<SHA256 of sorted unique granted agent UUIDs>`. Shared-audience changes create/reconcile the corresponding canonical entity partition transactionally; do not retain a globally canonical private label or reuse an old shared-audience key after grants change.

Privatizing, archiving, or revoking access to source evidence must atomically restrict or mark dependent memories/relationships unavailable. Widening a memory requires explicit authorized widening of its evidence sources too. Manual source text intentionally shared by the owner is still untrusted content.

### 5.4 SQL schema and constraints

Use schemas `atlas` for domain tables and `atlas_private` for credentials, membership/grants and narrow authorization helpers. Do not expose either through a browser Data API. Use explicit column projections and parameterized `pg` queries; no ORM is required for this SQL-heavy MVP.

All workspace-owned rows below the workspace root carry `workspace_id UUID NOT NULL`, timestamps and actor provenance where relevant. `app_users` and the migration journal are installation-level records; the workspace root owns itself by ID. Use UUID IDs. Mutable resources that accept expected_revision (including workspaces/projects/collections/settings/agents/reviews/items) carry `revision int NOT NULL DEFAULT 1` and increment it atomically; immutable evidence/version rows never change. Foreign keys between workspace-owned rows include workspace ID (`UNIQUE(workspace_id,id)` and composite FKs), preventing cross-workspace references even if application validation is bypassed. Subtype item IDs refer to the same `knowledge_items.id`; enforce matching kind. The following table is a minimum schema contract, not optional entities:

| Table | Required fields / constraints beyond common columns |
| --- | --- |
| `app_users` | `id`, `issuer`, `subject`, `disabled_at`; unique `(issuer,subject)`; opaque subject text |
| `workspaces` | `id`, `owner_user_id`, `name`, `deleted_at` |
| `workspace_settings` | workspace_id PK, revision, auto_classify=true, default_agent_processing=false, optional default_processor_agent_id, log_raw_queries=false; no provider/model/billing settings |
| `atlas_private.workspace_members` | `(workspace_id,user_id)` PK, role `owner`; no invitations P0 |
| `projects` | id, slug, name, description, archived_at, default_agent_processing=false, optional default_processor_agent_id; unique active workspace slug; processing defaults cannot override personal-source sharing |
| `collections` | `id`, `parent_id`, `normalized_name`, `name`, `archived_at`, `merged_into_id`; prevent parent cycles; unique active sibling normalized name |
| `knowledge_items` | `id`, `kind:source|memory|entity|relationship`, `title`, `scope`, `project_id?`, `owner_agent_id?`, `access_partition`, `revision int`, `deleted_at`, `created_by_user_id?`, `created_by_agent_id?`; scope-dependent checks |
| `collection_items` | `(workspace_id,collection_id,item_id)` PK; `origin:manual|ai`, `confidence?`, `locked bool`; one item, many memberships |
| `classification_overrides` | `(workspace_id,source_id,collection_id)` PK, `decision:include|exclude`, actor; exclusions persist after removing a membership |
| `sources` | id item FK, input_type note/text/markdown/url, current_version_id, content_revision int default 1, processing_state capturing/indexing/awaiting_agent/claimed/review_pending/organized/failed, sensitivity clear/quarantined/released_for_agent, url; deletion/access owned by parent item; processing permissions live in explicit grants |
| `source_versions` | `id`, `source_id`, `version int`, `raw_sha256`, `normalized_sha256`, `object_key`, `byte_count`, `media_type`, `markdown`, `normalized_text`, `editor_json?`, `source_timestamp?`, `origin_uri?`, `repository_commit?`; immutable; unique source/version |
| `source_chunks` | `id`, `source_id`, `version_id`, `sequence`, `text`, `heading_path text[]`, `start_offset`, `end_offset`, `sha256`, `estimated_tokens`; unique version/sequence; offsets reference normalized version text |
| `memories` | `id` item FK, `type`, `subject_key`, `structured_content jsonb`, `summary`, `status`, `claim_kind`, `confidence?`, `verified_by_user_id?`, `verified_at?`, `last_validated_at?`, `valid_from`, `valid_to?`, `superseded_by_id?`, `requires_revalidation bool`, `critical bool`, `retrieval_level:core|project|detail` |
| `memory_versions` | `id`, `memory_id`, `version`, complete prior content/status snapshot and actor/reason; unique memory/version |
| `memory_evidence` | `id`, `memory_id`, `source_version_id`, `chunk_id?`, `start_offset`, `end_offset`, `quote_sha256`; verify quoted span; no orphan evidence deletion |
| `entities` | id item FK, canonical_key, entity_type, aliases, status proposed/active/archived, approved_by_user_id/approved_at; unique active workspace/access_partition/canonical_key; aliases are proposed until reviewed |
| `entity_evidence` | Same immutable version/span/quote-hash contract as memory evidence; required for extracted entities, used in audience intersection |
| `memory_entities` | `(workspace_id,memory_id,entity_id)` PK; scoped FKs |
| `relationships` | `id` item FK, `from_item_id`, `to_item_id`, `type`, `status`, `claim_kind`, `confidence?`, `valid_from`, `valid_to?`; reject self-links and exact active duplicates |
| `relationship_evidence` | Same span/version contract as memory evidence, linked to relationship |
| `tags`, `knowledge_tags` | Normalized unique workspace tag; `(workspace_id,item_id,tag_id)` join |
| `ingestion_jobs` | id, kind normalize/chunk/lexical_index/reconcile_original/materialize_memory, source_version_id or item_id+expected_revision, status, stage, attempt_count, available_at, lease_token, lease_expires_at, heartbeat_at, cancel_requested_at, idempotency_key, last_error_code, timestamps; unique workspace/idempotency key; deterministic local work only |
| `job_results` | Job, stage, input hash, deterministic pipeline version, validated result JSON; unique job/stage/input hash; avoid rerunning completed stages |
| `review_queue` | id, kind classification/entity/memory/relationship/decision/collection_suggestion/duplicate/summary, target IDs, origin_submission_id/candidate_id optional, validated payload, status pending/approved/rejected, revision, reviewer/reason; unique submission/candidate identity; direct proposals use their own idempotent request identity |
| `agents` | `id`, name, description, type, `disabled_at`; created/managed by owner |
| `atlas_private.agent_credentials` | Digest/prefix and timestamps described above; no raw token |
| `atlas_private.agent_project_grants` | (workspace_id,agent_id,project_id) PK, read, propose, process_knowledge=false; owner explicitly enables processing |
| `atlas_private.agent_scope_grants` | (workspace_id,agent_id,scope) PK, read, propose, process_knowledge=false |
| `atlas_private.item_agent_grants` | (workspace_id,item_id,agent_id) PK, read, propose, process_knowledge=false |
| `search_documents` | id, authorized item FK, optional chunk FK, text/identifier text, approved aliases, generated tsvector using simple config, normalizer_version; source/chunk or memory-revision freshness; unique origin/version |
| `retrieval_traces`, `retrieval_trace_items` | Principal IDs, query hash, filters, selected item IDs/revisions/ranks, token measure, latency, fallback flags; no raw query/source content by default |
| `activity_events` | actor_kind `human|agent|worker`, corresponding user/agent/job ID, action, target ID, redacted metadata, correlation ID; append-only |
| `organization_tasks` | id, source_version_id, expected_source_revision, contract_version=1, batch_index, chunk_ids (max 20), allowed_collection_ids, assigned_agent_id optional, state awaiting_agent/claimed/submitted/completed/cancelled/superseded, lease_digest, lease_expires_at, first_claimed_at, claimed_by_agent_id, submission_id, last_error_code, revision; unique live source-version/contract/batch identity |
| `atlas_private.processing_grants` | workspace/source-version/agent IDs, allowed_collection_ids, granted_by_user_id, expires_at, revoked_at; selected-version batches read/claim/submit only, no general retrieval/canonical write permission; one current named private processor per version; replacing it revokes/fences the previous grant/claims |
| `organization_submissions` | id, task_id, agent_id from verified principal, idempotency_key, payload_sha256, validated structured payload, reported_client/model optional and explicitly unverified, created candidate IDs; unique agent/task/idempotency key |
| `graph_layouts` | `(workspace_id,user_id,view_key)` PK, positions by item ID, camera, filters, graph revision; owner-only |
| `idempotency_requests` | Principal, route, key, request hash, response reference; unique principal/route/key; differing payload returns conflict |
| `schema_migrations` | Filename/version, checksum, applied timestamp; migration runner only |

Relationship types: `USES`, `DEPENDS_ON`, `IMPLEMENTS`, `BELONGS_TO`, `RELATED_TO`, `REPLACES`, `RESOLVES`, `DOCUMENTS`, `REFERENCES`. Explicit structural links, such as collection membership or evidence, may appear as graph edges only when backed by a persisted join row and labeled as structural. Extracted semantic relationships always start as proposals. Keyword co-occurrence is never a verified relation.

### 5.5 RLS and SQL execution

Create NOLOGIN ownership role `atlas_owner`; API login `atlas_api` and worker login `atlas_worker` must have no `BYPASSRLS`, no schema ownership, and no inherited administrative role. Credential values are generated/saved only during authorized setup, never in migration SQL.

Enable RLS on all domain tables. Application transactions set a trusted principal via parameterized `set_config(..., true)` for `app.principal_kind`, `app.user_id`, `app.agent_id`, and `app.workspace_id`, then query within that transaction. Missing/invalid context denies access. Commit/rollback returns a connection with no identity. Use the same checked-out `pg` client for BEGIN, context, queries, and COMMIT/ROLLBACK; release in `finally`. Every route, graph query, worker stage, and trace operation uses this wrapper.

Purpose-scoped agent task transactions set app.processing_task_id and app.processing_lease_digest only after verified credential/task/grant checks. Add private can_process_task helper validating agent, batch, version, expiry, sensitivity and live lease. Processing grants do not alter ordinary can_read_item: dedicated source/version/chunk SELECT policies allow only the selected task source and batch when that purpose context is present; generic routes never set it. Proposal INSERT policies for task submissions require source-derived scope, actual actor, proposed status and valid task context. Policy-permitted collection additions use the owner's stored auto_classify decision and cannot override manual exclusions. Test that source history/other chunks/general memory remain denied.

The worker-only wrapper instead sets `app.principal_kind='worker'`, workspace, job ID, source version ID and lease token from a successful claim. Its policies validate those values against the stored live lease and constrain the accessible source/derived rows. Never manufacture a human or agent principal for a worker. Activity written by a worker uses actor_kind worker and the job ID, not a forged user ID.

Private ACL tables deny direct API/worker reads. Narrow `atlas_private` SECURITY DEFINER helpers owned by NOLOGIN `atlas_owner` may read membership/grant metadata and item/evidence linkage metadata; fully qualify names, set `search_path=''`, revoke EXECUTE from PUBLIC, and grant only required application roles. They accept transaction principal context and return booleans or minimum authenticated identity/job IDs, never source/memory content or credential digests. The table owner can bypass its own RLS solely inside these reviewed helpers, preventing recursive RLS evaluation; application logins cannot assume that owner role. Record this deliberate limited privilege boundary in SECURITY.md; do not add SECURITY DEFINER to search or general CRUD, or add FORCE ROW LEVEL SECURITY in a way that makes these helpers recursively call themselves.

Create separate helpers: `current_member(workspace_id)`, `can_read_item(item_id)`, `can_write_item(item_id,action)`, `authenticate_agent(token_digest)` (API-only), and claim/heartbeat/finish functions (worker-only). `can_read_item` reads raw metadata under its limited definer context: check current workspace/principal/scope and item existence first; a source requires its own access; memory/entity additionally require every supporting source audience; relationship additionally requires both endpoints and every evidence source. Relationship endpoints may be source/memory/entity, never relationship, keeping these dependency checks acyclic. Empty/invalid supporting evidence for an agent-visible derived fact fails closed. Do not call a normal RLS repository from inside this helper. Content queries remain SECURITY INVOKER and independently apply current/temporal/freshness filters. Tests must exercise missing context, direct helper invocation and recursive-policy regressions.

Use source/item predicates in all child-table SELECT/INSERT/UPDATE/DELETE policies, with explicit USING and WITH CHECK. Worker grants permit claiming jobs and writing derived candidates/chunks/index data for the job's workspace/source version; they do not approve memories, grant access, or read agent credential digests. API agents can insert proposals through a constrained service transaction only; canonical memory updates are human-only. Test SQL policies under actual non-owner application roles.

### 5.6 Source preservation, idempotency and agent sharing

Reserve source/version IDs and a pending object record transactionally. Upload exact original bytes to a new immutable private key workspace/<workspaceId>/sources/<sourceId>/versions/<versionId>/original.<txt|md|html>. Verify upload/hash, then finalize version and enqueue deterministic normalization/chunk/index jobs in one SQL transaction. SQL and S3 are not one transaction: failure remains pending for reconciliation; never acknowledge a complete import before it is recoverable. Retried imports reuse idempotency identity. Reconcile only recorded task-created keys, never bulk-delete a bucket.

Raw SHA-256 preserves byte identity; normalized hash is separate. Deduplicate by workspace + access partition and reveal existing ID only to a reader. Edits require expected_revision and create immutable new versions; concurrent changes return 409. Preserve code/identifiers. Normalized offsets are not raw byte offsets.

Scan source text for private-key blocks/common tokens/secret assignments before it is delivered to any processing agent. Flagged source is saved privately and quarantined; reads for processing/claim/submission are blocked. Owner redacts to a new version or explicitly releases selected content. Scanner output is a review aid, not proof of absence of secrets. No raw matches/source snippets in logs.

Personal source defaults remain personal and not shared for processing. Owner chooses a named agent, the exact source version, permitted classification collection IDs and expiry, with UI explaining that selected content will enter that agent's session. Default collection candidates are the generic seed taxonomy; custom private collection names require explicit selection. Private classification never makes the resulting private memories generally retrievable by that agent. Revocation blocks future task operations and fences leases; already-read session content cannot be retracted.

### 5.7 Deterministic jobs, agent classification and memory lifecycle

Local ingestion jobs normalize/chunk/index/reconcile; they never perform model inference or launch agent sessions. States: queued -> processing -> completed/failed/cancelled, transient retries return to queued with available_at. Claim via FOR UPDATE SKIP LOCKED; default one worker/max two; 120-second fenced lease with 30-second heartbeat; retry delays 5/30/120 seconds and max four total attempts. All stage writes validate job lease and current source revision. Cancellation fences late writes. An idle worker exits; application startup/new jobs resume durable work without permanent frequent Neon polling.

Job idempotency key: SHA-256 of workspace + source version or item/revision + deterministic pipeline version + operation. Save successful stage results. Organization tasks are a separate durable queue claimed by connected agents, not by the ingestion worker.

Classification confidence is agent-reported/model-estimated, never objective: >=0.85 may add an existing collection only when owner auto_classify is enabled; 0.60–<0.85 review; <0.60 Inbox. Manual include/exclude overrides win. Agents may suggest new collections, never create them autonomously. Inferences/relations/memories remain proposed even if confidence is high.

The organization submission schema distinguishes explicit_fact, inference, recommendation, opinion, unverified_claim, historical and decision. Every candidate carries actual source/version/chunk offsets and quote hash; invented IDs/spans are rejected. Client/model names may be recorded as unverified reported metadata, not trusted provenance. Agent identity comes only from its authenticated credential.

Memory lifecycle: `proposed -> verified -> active`; owner approval verifies evidence and activates atomically, recording both events. `proposed -> rejected`; `verified|active -> archived`; `active -> superseded` only alongside an explicitly approved replacement. Restoring archive requires review; rejected items are not silently revived. Default agent retrieval uses active, nondeleted, nonstale memories where `valid_from <= now` and `valid_to` is null or future. Historical queries are owner-visible or explicitly requested and permitted, always labeled historical.

Supersession locks old/new rows, validates same workspace/subject/access compatibility, checks expected revisions, sets old `valid_to` and `superseded_by_id`, activates the new item, and writes snapshots/audit in one transaction. Conflicting concurrent approvals return 409. A revised source flags linked old-version memories/relationships `requires_revalidation=true`; exclude them from authoritative context and expose an owner review warning. Exact duplicate facts can merge evidence after review; near duplicates/contradictions never auto-merge or auto-supersede.

### 5.8 Lexical + stored-graph retrieval and context budgeting

Core signature: retrieve(principal, request, transport): Promise<ContextPacket>. Inputs: workspace_id; query 1–2,000 chars; optional project_id/collection_id/memory_types/date range; detail minimal/balanced/detailed; token_budget 256–8,192/default 2,048; include_history=false; graph depth 0–2. Validate dates and all filters against current permissions.

ContextPacket: schema_version=1, trace_id, mode='lexical_graph', items[{id,type,title,summary,status,critical,source_refs}], warnings, has_more, continuation, budget{requested,used,measure}. Source refs include immutable version/chunk ID, heading and normalized offsets, never hidden source titles/handles. No vector scores or semantic/hybrid labels.

Proposed explicit algorithm:

1. Authenticate; open the same scoped SQL transaction; enforce RLS, item/evidence access, freshness and temporal status before candidate LIMIT/count/rank.
2. Fetch <=100 lexical candidates using tsvector(simple), exact identifier matching and trigram matching for paths/symbols/table names. Search only current approved memory summaries/aliases and allowed current source chunks. Trigram means textual similarity, not semantic similarity.
3. Rank exact identifier matches first, then full-text rank descending, approved alias matches, current verified status, updated_at descending and UUID for deterministic ties. Use curated importance only as a documented tie-breaker; never bury an exact identifier under a generic popular topic.
4. Add permitted curated core and selected-project critical constraints. Expand only approved persisted relationships, depth <=2 and <=20 extra items, reauthorizing every edge/endpoint. Deduplicate canonical item IDs/evidence. Exclude superseded/stale facts by default.
5. Assemble complete items from stored summaries/facts. No model/generation/embedding call occurs on the search or context path. A connected agent may make additional keyword/alias queries using its own reasoning; the API remains deterministic.
6. Pack critical items first. Conservative measure: ceil(UTF8 byte length of final serialized HTTP/tool content * 1.10)+64, labeled utf8_conservative_estimate_v1. Include citations/metadata/escaping/wrappers; recompute metadata to stability. This is not exact tokenizer or entire client prompt usage.
7. If required constraints cannot fit, return a bounded BUDGET_INSUFFICIENT packet with explicit critical-omission warning and an authorized continuation/larger-budget suggestion. Do not return misleading incomplete context or split code/constraints mid-item. If the fixed envelope cannot fit, report its documented minimum.
8. Add complete noncritical items while the final response fits; omissions have has_more/continuation. A continuation is short-lived, principal/filter-bound and reauthorizes on every use, including source expansion.
9. Record selected IDs/revisions/ranks, conservative measure and latency. Raw query text is off by default; later trace views recheck permissions and redact revoked/deleted records. Prefer no retrieval cache in P0.

Keyword/alias/graph retrieval is the deliberate first-release search scope. Original source access and evidence remain available when a keyword result is insufficient. Do not claim embedding-based semantic search or measured token savings. Vector/embedding search needs a separately requested future design, not a hidden P0 API dependency.

### 5.9 Agent-driven organization contract

ATLAS defines schemas and controlled tools; the already-running agent supplies the reasoning. The backend never calls an AI provider, runs a local model, launches Codex/Claude, or treats source instructions as executable workflow.

Owner flow:
1. Save/import source; deterministic ingestion preserves/normalizes/chunks/indexes it.
2. Owner selects a registered processor and explicitly grants processing of the exact immutable source version, or enables processing for an already-readable selected project/scope.
3. Create organization_tasks partitioned into <=20-chunk batches. Unique identity: workspace/source_version/contract_version/batch_index. A large document becomes multiple resumable batches, not a fabricated complete summary from its first page.
4. Inbox shows Awaiting agent until an authorized connected agent claims work. Merely opening the app does not start an agent. A private source remains personal in ordinary retrieval.

Task expected_source_revision pins sources.content_revision, which increments only when a new content version becomes current. Collection/tag/review metadata updates may increment the item's ordinary revision but never invalidate sibling batches of unchanged content. Task checks compare both current_version_id and content_revision; content changes supersede all remaining old-version batches. Project/scope defaults may assign only already-readable, explicitly process-enabled content; they never bypass personal grants or quarantine.

Agent protocol:
- Credential has process_knowledge capability. Normal project/scope processing also requires read + process_knowledge grant. A private-source exception requires owner-issued processing_grant for that exact source version and named agent, with explicit expiry; it grants no general personal-memory retrieval.
- list_knowledge_tasks returns only eligible metadata. claim_knowledge_task atomically changes awaiting_agent to claimed and issues a random lease token, storing only its digest. Task source revision/batch/contract are fixed.
- read_processing_source returns only the claimed batch's authorized chunks/ranges through a dedicated purpose-scoped endpoint; it cannot list source versions, fetch other sources, retrieve private memories, or widen sharing. Every read validates current token, processing grant, task lease, source revision and sensitivity.
- Agent reads the source as untrusted data, infers collections/tags/entities/relations/memories/summaries, then submits bounded structured candidates with exact evidence. It may renew within 60 minutes/grant expiry; otherwise release and let a later session resume.
- submit_knowledge_organization validates claim/grants/current revision, contract, limits, batch coverage, referenced chunk IDs, exact spans/hashes, candidate IDs and scope intersection. Track delivered chunk IDs; submission declares coverage and must cover the assigned batch. Delivery/coverage is not proof the model understood or verified every claim.
- Transactionally persist one organization_submissions row and its review candidates, apply only policy-permitted high-confidence collection additions, retain manual overrides, then state=submitted. Missing/malformed/invented evidence returns a bounded error without canonical writes or task loss.
- Submission idempotency key is agent/task/key with payload hash: exact replay returns original candidate IDs; different payload returns 409. Recheck revocation before replay; idempotency never restores revoked access. Review decisions eventually move task to completed.
- Expired/released claims return to awaiting_agent; revocation immediately blocks future reads/renew/submit; source version replacement marks old tasks superseded and rejects late submissions. Already delivered agent context cannot be recalled by revocation.
- Aggregate source state: failed deterministic capture first; otherwise claimed if a live batch claim exists; otherwise awaiting_agent if any unsubmitted eligible batch remains; otherwise review_pending if candidates need owner decisions; otherwise organized. Never report the whole source organized from partial batch coverage.

Structured submission fields (contracts/organization.ts): contract_version=1; source_version_id; expected_source_revision; coverage_chunk_ids; classifications[{collection_id,confidence,reason}]; tags[{name}]; entities[{candidate_id,canonical_key,title,entity_type,aliases,evidence,claim_kind,confidence}]; relationships[{candidate_id,from_ref,to_ref,type,evidence,claim_kind,confidence}]; memories[{candidate_id,type,title,subject_key,summary,structured_content,evidence,claim_kind,confidence}]; source_summary optional. Each evidence references a delivered batch chunk/version with start/end/quote_sha256. Endpoint refs are either permitted existing item UUID or a unique local candidate_id; resolve local refs transactionally. Source summary is a reviewable candidate, never silently verified. Actor/scope/critical/core flags come from server/owner policy, not arbitrary agent claims.

The owner can process manually, grant a specific source batch/version, or leave it queued indefinitely. Agent host usage and subscription limits remain external. No AI spending dashboard/API key setup exists. Token budgets for returning compact context remain part of the backend.

### 5.10 HTTP routes and MCP schemas

All domain responses are runtime-validated. JSON naming is snake_case; TypeScript service names may use camelCase with explicit mapping. Errors are `{error:{code,message,request_id,details?}}`; no secrets/SQL/source content. Use 400 validation, 401 invalid/missing credentials, 403 disallowed operation, 404 inaccessible individual resource, 409 stale revision/idempotency conflict, 413 size, 415 unsupported type, 429 local rate limits, 503 missing dependencies. Do not distinguish hidden from nonexistent item IDs. Missing agents or processing permissions must never turn a successfully saved original into a failed source write.

| Routes under `/api/v1` | Contract / consumers |
| --- | --- |
| `GET /me`, `GET /agent/session` | Verified current identity; agent session returns its workspace ID and allowed operation metadata, no secrets; MCP uses it to resolve the credential-bound workspace |
| `GET/POST /workspaces`; `GET/PATCH /workspaces/:id` | Owner-only workspace list/create/settings; creation assigns owner and seed collections atomically |
| `GET/POST /workspaces/:id/projects`; `GET/PATCH /projects/:id`; `POST /projects/:id/archive` | Validated name/slug/description; update has expected_revision; archive preserves records |
| `GET/POST /workspaces/:id/collections`; `PATCH /collections/:id`; `POST /collections/:id/{move,merge,archive}` | Owner-only organization; move prevents cycles; merge target same workspace; transaction rehomes memberships/children with conflicts resolved deterministically |
| `GET /workspaces/:id/knowledge` | Typed source/memory list; filters, cursor and page limit; no raw full content |
| `POST /workspaces/:id/sources` | Note/pasted text JSON or multipart text/Markdown; title, input_type, project_id?, scope default personal, collection_ids, content/file; Idempotency-Key required; finalized saved source + job state |
| `GET/PATCH /sources/:id`; `GET /sources/:id/versions`; `GET /sources/:id/content` | Exact version/source metadata; PATCH new immutable version with expected_revision; content supports normalized range/chunks or original bytes with explicit mode and access check |
| `POST /workspaces/:id/imports/url` | URL, title?, project/scope/collections; validated fetch, original snapshot and job; idempotent |
| `POST /sources/:id/processing-grants`; `POST /processing-grants/:id/revoke`; `POST /sources/:id/{release-for-agent,archive,restore}` | Human-only selected version+agent+expiry+allowed collections; explicit sensitivity release/redaction; revoke fences claims; archive/restore preserve evidence/access |
| `PUT /sources/:id/collections/:collectionId` | Human include/exclude override with expected revision; never lose exclusions |
| `GET /workspaces/:id/jobs`; `POST /jobs/:id/{retry,cancel}` | Human-visible deterministic job state; retries respect current version and fenced lease; agent tasks use separate routes |
| `GET /workspaces/:id/reviews`; `POST /reviews/:id/{approve,reject}` | Owner-only review; expected_revision, reason?, replacement_memory_id?; approved transaction validates scope/evidence and lifecycle |
| `GET /memories/:id`; `GET /memories/:id/history` | Full authorized memory/evidence; history labeled, budgeted for agent consumers |
| `POST /retrieval/search`; `POST /retrieval/project-context`; `POST /retrieval/related`; `GET /retrieval/recent` | Shared retrieval services; workspace/project filters verified; common context budget/packet; project-context accepts a UUID or workspace-unique project slug |
| `POST /proposals/{memory,relationship,decision}` | Human or permitted agent; Idempotency-Key and evidence required; always pending; returns proposal ID/status only |
| `GET/POST /workspaces/:id/agents`; `PATCH /agents/:id`; `PUT /agents/:id/grants`; `POST /agents/:id/credentials`; `POST /credentials/:id/revoke` | Owner-only; explicit projects/scopes/operations; raw credential shown once; active status/revision recorded |
| `GET /workspaces/:id/graph`; `GET /graph/:itemId/neighbors`; `GET/PUT /workspaces/:id/layouts/:viewKey` | Typed graph, bounded authorized expansion, owner layouts; API graph data independent of Sigma attributes |
| `GET /workspaces/:id/activity`; `GET /traces/:id` | Redacted activity and authorized trace IDs; currently inaccessible items redacted |
| `GET/PATCH /workspaces/:id/settings` | Owner auto-classification policy and optional project/scope processor defaults; no AI API key/model/spending settings; no secret values |
| `POST /workspaces/:id/export`; `POST /items/:id/archive`; `POST /items/:id/restore` | Owner-only recoverable operations and portable export; permanent purge is a separately confirmed action |
| `GET /workspaces/:id/organization/tasks`; `POST /organization/tasks/:taskId/{claim,renew,release,submit}`; `GET /organization/tasks/:taskId/source` | Purpose-scoped agent list/claim/read/renew/release/submit; exact version/batch/grant/lease; server-derived actor; submitted candidates only; owner can inspect/reassign/cancel through separate owner controls |
| `POST /organization/tasks/:taskId/{reassign,cancel}` | Owner-only expected_revision + new assigned_agent_id/reason; revoke/fence previous claim, preserve submitted candidate history; no agent may reassign itself or another agent |

Common input limits: title/name 1–160 trimmed chars; project slug `[a-z0-9][a-z0-9-]{0,79}`; unknown fields rejected; UUIDs validated; collection IDs unique and same workspace; max 30 tags/collection assignments per item; memory summary 1–2,000 chars and structured content bounded to 16 KiB. Evidence list 1–20 spans for a proposal. Batch create is P1. Collection merges use explicit target_id and child-name conflict mapping, not a guessed automatic deletion of duplicate subtrees.

MCP tools derive workspace and identity from `GET /agent/session`; arguments cannot override agent/workspace identity. Each tool passes through the same API authorization every call. All context/source/processing-read tools use token_budget default 2,048/range 256–8,192, and return one JSON text content block to avoid duplicating the packet in both text and structured output.

| Tool | Exact arguments, additional to optional token_budget | API target |
| --- | --- | --- |
| `search_knowledge` | `query`, `project_id?`, `collection_id?`, `memory_types?`, `detail?`, `continuation?` | POST retrieval/search |
| `get_project_context` | `project` (UUID or workspace-unique slug), `detail?`, `observed_repository_commit?` | POST retrieval/project-context; caller-supplied commit is observation metadata, never authority or access |
| `get_memory` | `memory_id`, `include_history=false` | GET memories/:id; optional authorized history |
| `get_related_knowledge` | `item_id`, `depth=1` (1–2), `relationship_types?` | POST retrieval/related |
| `read_source` | `source_id`, `version_id?`, either `chunk_ids?` (max 10) or `range?:{start,end}` | GET sources/:id/content; version, quote and offsets preserved; normalized text ranges, original download separate |
| `get_recent_changes` | `project_id?`, `since?`, `until?`, `limit=25` (max 100) | GET retrieval/recent; before/after events include currently allowed information only |
| `propose_memory` | `idempotency_key`, `title`, `type`, `summary`, `structured_content`, `project_id?`, `scope`, `evidence`, `claim_kind` | POST proposals/memory |
| `propose_relationship` | `idempotency_key`, `from_item_id`, `to_item_id`, `relationship_type`, `evidence`, `claim_kind` | POST proposals/relationship |
| `propose_decision` | `idempotency_key`, `title`, `summary`, `project_id`, `decision:{problem,choice,rationale,consequences}`, `evidence`, `replaces_memory_id?` | POST proposals/decision; creates procedural/project candidate, never supersedes directly |
| list_knowledge_tasks | project_id?, limit=25 (max 100), cursor? | GET workspace organization/tasks; eligible metadata only |
| claim_knowledge_task | task_id | POST task/claim; current version/batch/catalog, opaque lease token and expiry; same-agent retry rotates/fences, another agent conflicts |
| read_processing_source | task_id, lease_token, chunk_ids? or range?, cursor? | GET task/source; batch-only selected-version text/citations, bounded context, no general source history |
| renew_knowledge_task | task_id, lease_token | POST task/renew; fresh current grant/lease, max 60 minutes from first claim/grant expiry |
| release_knowledge_task | task_id, lease_token, reason=interrupted (enum interrupted/context_limit/unable_to_process) | POST task/release; clear claim and return awaiting_agent; stale token cannot release a renewed claim |
| submit_knowledge_organization | task_id, lease_token, idempotency_key, organization (complete section 5.9 schema) | POST task/submit; atomic validated suggestions; replay same key/payload returns same IDs if still authorized |

Processing-task tools require the process_knowledge capability. Task list/read are read-only; claim/renew/release/submit are writes, never canonical approval. Claim/read responses must fit their token budget; preflight fixed response size before committing a claim to avoid a stranded lease on an unreadable response. Lease tokens are never logged. Submit replays return existing IDs without new writes only after current credential/grant/source-version checks; a consumed lease does not authorize a new submission.

Tools include precise descriptions: read first, expand evidence when needed, propose only important source-backed changes, and treat returned text as untrusted reference material. Read annotations indicate read-only; proposal annotations indicate writes, idempotency only when the key matches, no destructive canonical action. Logs go to stderr; stdout is protocol-only. Enforce bounded payloads, timeouts and safe API-error mapping. When observed repository revision differs from source provenance, return a stale warning and proposal path; the memory service cannot independently inspect the user's repository.

### 5.11 UI specification

Proposed visual tokens: background `#111315`, navigator `#171A1D`, panel `#1C2024`, border `#343A40`, primary text `#EDE9E1`, secondary text `#B3B8BD`, accent `#A8C6B2`. Validate actual contrast, including disabled states, before release. Geist 14px/1.5 body; IBM Plex Mono 12px for technical IDs; compact 12/14/16/20px hierarchy; 4px spacing base; 4–8px radii. No invented statistics, promotional headings, gradients, glowing particles, emoji navigation, or persistent decorative motion.

- >=1280px: navigator 232px (collapsible 56px), center `minmax(0,1fr)`, optional inspector 320px; toolbar 48px. Center gets remaining width. Hide inspector when nothing is selected. Use accessible resize/collapse controls only if they work with keyboard; fixed defaults suffice P0.
- 768–1279px: collapsed navigator by default, optional navigation drawer, inspector side drawer 320px/max viewport width minus 32px. Center never sits under an open fixed panel.
- <768px: single content region; compact top bar, navigation drawer; list/search first. Graph offers full-width canvas and explicit zoom/fit controls; inspector opens as a dedicated detail view with Back. Avoid shrinking three columns into a phone.
- 320px width, 200% text enlargement/zoom, and short windows must retain readable vertical flow. Text and long file paths wrap; scroll only designated panes, without global horizontal overflow. Interactive targets >=44px on touch; visible focus, labels, Escape/return-focus behavior for drawers/dialogs.
- Required routes: `/inbox`, `/knowledge`, `/graph`, `/collections/:id`, `/projects`, `/projects/:id`, `/agents`, `/activity`, `/settings`, plus `/sign-in` and source/memory detail routes. Protected routes handle session pending and expired states without flashing private content.
- Save is explicit and reliable in P0: dirty/saving/saved/error states, retry, Ctrl/Cmd+S, and navigation guard. Tiptap is an editor over durable Markdown plus portable JSON; raw imports are immutable. Unsupported Markdown constructs remain available in a source/raw view, rather than being silently discarded by the editor.
- Inbox distinguishes indexing, Awaiting agent, claimed, partial batches, pending review, quarantined and failed states. Show Choose agent/Grant processing when needed, short actions and expandable detail. Confidence says Agent estimate, never certainty. There is no provider/API-key/billing setup screen. Source/memory inspector shows evidence, status, timestamps, collections/tags, scope and accessible agents, with full details expandable.
- Graph nodes identify persisted source/memory/entity IDs. Size = documented degree in the authorized displayed graph, clamped 4–12px. Node color represents kind with a compact legend; status also has text/shape cues. Active edges are solid; proposed edges visible to owner only when toggled and clearly distinguished. No visual edge without a persisted relationship or join-row identity.
- Explore and Focus are P0; basic Changes is P0 using actual activity. Retrieval Trace appears only after stored traces exist. Advanced animated tracing, clustering, temporal playback and spatial whiteboards are P1/P2.
- Pan/zoom, selection, hover/neighbor emphasis, project/collection/type filters, node search, fit/reset, bounded neighbor expansion, and stable saved layout are required. Seed new-node positions deterministically from sorted IDs on a circle, never all `(0,0)`. Run ForceAtlas2 in a worker for a bounded settling interval (max 2 seconds); reuse positions; stop on settle and release worker/renderer on unmount. Reduced motion uses final settled coordinates without visible simulation or animated camera.
- Accessible graph alternative: searchable list and keyboard-operable neighbor/evidence list share selected item and filters. If WebGL is unavailable, show that list plus explanation; do not leave a blank canvas.

## 6. File/resource change map

All targets are new unless a later executor inspection finds user work. Stable anchors below are the proposed exported symbols or document headings to create.

| Steps | Target files/resources | Anchor / required action | Requirements |
| --- | --- | --- | --- |
| S01 | Root AGENTS.md; all mandatory docs | Execution cycle, current state, task IDs, evidence-only completion | Continuation/tracking |
| S02–S03 | Root manifests/config; web/API/MCP and package entrypoints | Workspace exports, validated config, app factory, health/readiness | Functional foundation |
| S04–S06 | `database/migrations/`; `scripts/migrate.ts`; `packages/core/src/db/`; test harness | Checksummed migrations, transaction context, grants/RLS | Persistence/isolation |
| S07–S08 | `apps/web/src/auth/`; `apps/api/src/middleware/`; project/collection routes/services | Auth adapter, verifiedPrincipal, scoped CRUD | Auth/organization |
| S09–S13 | `core/storage/`, `core/knowledge/`, `core/security/`; source/import routes; editor/Inbox | SourceStore, finalizeSourceVersion, sensitivity scan, chunkSource, fetchSafeUrl | Original preservation/capture |
| S14–S16 + early S21 | core/jobs/, core/organization/, API worker/task routes; contracts/organization.ts; Inbox | deterministic claimJob; claim/read/submit organization task; validated agent suggestions; no model service | Durable agent-driven organization |
| S17 | `core/memory/`; memory/review routes; memory UI | approveProposal, supersedeMemory, markEvidenceStale | Trust/history |
| S18–S20 | core/retrieval/; summary/alias materialization; retrieval routes/evaluations | approved search documents, retrieve, packContext, regression fixtures | Relevant compact context without embeddings |
| S21–S23 | `core/agents/`; agent routes/UI; MCP app; MCP tests; SETUP.md | createCredential, revokeCredential, registered tools, two fresh clients | Scoped agent memory |
| S24–S27 | `core/graph/`; graph/routes/layout UI; responsive shell; activity/traces | buildAuthorizedGraph, GraphCanvas, ContextInspector, trace loader | Accurate graph/usable UI |
| S28 | Export/archive/restore services; BACKUP.md; restore verification | Portable export, evidence-safe archive, complete restoration | Ownership/recovery |
| S29–S30 | Security/performance/E2E/evaluation checks; release docs | P0 acceptance checklist and observed report | Verified release |
| E01–E02 | New dedicated Neon project/branch/Auth/private bucket/roles | Actual IDs recorded; no existing project reused | Live backend |
| E03 | Owner-selected existing Codex/compatible client and minimally scoped credential | Actual source-organization + fresh-session memory round trip; no AI API key | Real integration proof |

## 7. Execution protocol and commands

Use PowerShell. All commands below run from the project root unless explicitly stated. They are planned commands, not observed passing checks. Do not chain them with shell separators. Before invoking any new script, inspect its contents and confirm it cannot touch an external target unexpectedly.

S02 creates these root scripts (using exact package versions in section 4):

| Script | Required behavior |
| --- | --- |
| `pnpm typecheck` | Strict typecheck all workspaces, topological dependency builds where needed |
| `pnpm lint` / `pnpm format:check` | Biome checks without modifying files |
| `pnpm build` | Build contracts/core/API/MCP and web in dependency order |
| `pnpm dev` | Build shared packages, run watched local API and Vite; API supervises worker |
| `pnpm start` | Built API + served SPA; explicit manual local start, no OS startup registration |
| `pnpm test:unit` | Vitest unit suite; no network/database writes |
| `pnpm test:db` | Integration suite using dedicated disposable local test DB, actual non-owner roles |
| `pnpm test:mcp` | Build prerequisite then spawned SDK client/server contract suite against local fixture API |
| `pnpm test:e2e` | Playwright against local fixture application; separate live scenario documented |
| `pnpm test:evaluation` | Deterministic retrieval fixtures; output real metrics under gitignored `.artifacts/` |
| `pnpm test:security` | Isolation, malformed upload/URL, injection, credentials, stale-context tests |
| `pnpm test:performance` | Explicit synthetic dataset profiling; no live/real knowledge mutation |
| `pnpm db:migrate:local` | Checksummed SQL runner; rejects non-loopback URL and wrong test DB |
| `pnpm db:migrate:neon` | Requires recorded authorized project/branch target and direct URL; cannot silently fall back |
| `pnpm db:test:start` / `pnpm db:test:stop` | Start/stop only the named `atlas-tests` Compose project, without volume deletion |
| `pnpm seed:demo` | Idempotent fictional fixture only, after exact local/dev target guard |
| `pnpm owner:bind` | Explicit known issuer/subject binding through setup/admin connection; no first-request takeover |

Tracking cycle for each substantial task: read AGENTS + PROGRESS + TASKS + ARCHITECTURE + recent SESSION_LOG; mark task In Progress; make focused changes; run its checkpoint; record command, observed count/result, limitations, issues and file/resource changes; mark Completed only on verification. Use statuses Pending / In Progress / Blocked / Completed / Failed Verification.

`docs/IMPLEMENTATION_PLAN.md` becomes the active index pointing to this handoff and current scope changes. `TASKS.md` holds each S-step plus granular child IDs, priority, dependencies, acceptance, files and evidence. `PROGRESS.md` holds current phase/milestone/task, verified functionality, blockers, next tasks, last update and test status. Architecture separates implemented from proposed. Decisions include problem/options/choice/reason/tradeoffs/date/impact. Keep issue history and append session/test records; never fabricate counts or delete a prior failed result.

## 8. Ordered implementation steps

### Phase 0 — verified scaffold

#### S01 — Establish resumable project records

- **Depends on:** a separate local implementation request; no code prerequisites.
- **Target/anchor:** root `AGENTS.md` execution cycle; required docs in section 4; `docs/TASKS.md` S01–S30/E01–E03.
- **Preflight:** re-list root, inspect any new instructions/user files, preserve these planning artifacts. Confirm the owner still wants this exact root and Neon stack.
- **Action:** create project instructions from this plan's actual constraints, source-brief tracking sections, and commands; create truthful initial tracking records and backlog. Record owner choices, SDK prerelease and live gates. Record ADRs for local Hono, Neon/Auth/private storage, SQL/RLS, reviewed memory, lexical/stored-graph retrieval, agent task grants and source-first deterministic jobs. Initialize Git only if implementation authorization covers local repository setup; do not commit/push automatically.
- **Expected result:** another chat can find the current task without history; all implementation tasks remain pending until verified.
- **Verify:** inspect links and records; exact source-brief hash still matches; no old feature marked complete.
- **If it fails:** correct documentation/path discrepancies only; stop before scaffolding over newly discovered code.

#### S02 — Create exact pinned workspaces and checks

- **Depends on:** S01.
- **Target/anchor:** root/package manifests, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, workspace exports and test configs.
- **Preflight:** Node 24 and pnpm available; review current registry/peers and optional peers against section 4. Do not require Next.js because Neon Auth has an optional Next peer.
- **Action:** create the three apps and two meaningful packages. Configure strict TypeScript, ESM server outputs, browser-safe contracts, Tailwind Vite integration, formatting/linting and scripted checks from section 7. Install the currently needed exact pins and lockfile using pnpm. Add meaningful boot/contract validation tests; no empty tests that merely make a script green. Record actual peer/compiler issues in DEPENDENCIES.md.
- **Expected result:** a minimal typed web shell and health-capable API compile; MCP entrypoint compiles when added in S22; all existing package scripts have real behavior.
- **Verify:** `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm test:unit`. Check resolved versions with `pnpm list -r --depth 0`.
- **If it fails:** diagnose exact pin/peer/import/compiler mismatch; fix task-owned configuration. Do not disable strict checks, downgrade randomly, or add a major framework to satisfy an optional peer. A real major incompatibility returns for a scoped plan adjustment.

#### S03 — Add fail-closed configuration and loopback runtime

- **Depends on:** S02.
- **Target/anchor:** API `config.ts`, `app.ts` (`createApp`), `index.ts`; web `lib/api.ts`; MCP `config.ts`; `.env.example`, `.gitignore`, README.
- **Preflight:** no real secrets exist in tracked files; root/port choices match section 4.
- **Action:** validate per-process database/auth/storage configuration; no AI-provider configuration or dependency exists. Health gives process liveness; readiness gives redacted missing dependency codes. Require target identity for migrations, loopback for MCP API, exact origins/hosts, safe errors, request IDs, request size limits and abort timeouts. Browser SDK receives public Auth URL only. Create sign-in/setup-needed shell without mock knowledge. Serve SPA only from the built directory; safe path resolution and route fallback.
- **Expected result:** local shell can explain missing setup; protected domain operations return 503/401 rather than fabricated data. Starting never provisions cloud resources.
- **Verify:** unit tests for invalid URLs, secret redaction, wrong Host/Origin, missing DB/auth/storage, and occupied port. `pnpm build`; inspect browser bundle for server-only modules/secret variable names.
- **If it fails:** repair config/process separation; stop if a server secret reaches the web bundle.

#### S04 — Create isolated PostgreSQL and migration harness

- **Depends on:** S02–S03.
- **Target/anchor:** `infra/compose.test.yml`; `scripts/migrate.ts`, `scripts/check-target.ts`; `core/db/pool.ts`, `core/db/transaction.ts`; DB test config/fixtures.
- **Preflight:** read-only Docker engine check succeeds; chosen test port (55432) is free; no existing `atlas-tests` data is assumed disposable.
- **Action:** use the official PostgreSQL 18 image resolved to a recorded immutable digest, loopback port, named task-specific volume and generated local secret saved only in ignored test config. Implement migration runner with direct connection, transaction lock, immutable checksum journal and stop-on-error; retry only connection startup. Local target guard requires loopback + database `atlas_test`; Neon runner requires explicit recorded endpoint/project/branch guard. Build same-client transaction/rollback/finally wrapper and fixture reset limited to explicitly disposable test schema/data.
- **Expected result:** migrations can be replayed safely; requests cannot carry principal state between pooled clients.
- **Verify:** `pnpm db:test:start`, `pnpm db:migrate:local`, repeat migration (no changes), `pnpm test:db`. A deliberately changed applied checksum is rejected. No Neon connection is used.
- **If it fails:** inspect container health/ports and migration transaction; preserve volume. Do not delete arbitrary Docker resources or point tests at an existing Neon project.

**Checkpoint C0:** build/typecheck/lint/unit and harness smoke pass with real counts. Update docs. Local scaffold may be complete while cloud/auth setup remains pending; do not call Phase 1 complete.

### Phase 1 — persistence and access foundation

#### S05 — Implement normalized domain schema and seed collections

- **Depends on:** S04.
- **Target/anchor:** migrations 0001–0006 and 0008; `contracts/*`; `database/seeds/collections.json`; core repositories.
- **Preflight:** schema does not yet contain application tables; all relationships in section 5.4 have a creation order, including later ALTER FKs for current-version/supersession cycles.
- **Action:** create the minimum tables/contracts, composite ownership FKs, lifecycle/check constraints, append-only version history, full-text/trigram extension support, task/agent indexes and unique keys. Use `pgcrypto` only if needed; UUIDs may be generated by Node crypto. Seed all nine root collection families and their exact children from source brief section 2 through an idempotent owner workspace-creation service; no real notes seed. Add SQL-level tests for cross-workspace FKs, cycles, active duplicates and invalid states.
- **Expected result:** relational persistence covers every P0 domain; seed reruns do not duplicate or rename user collections.
- **Verify:** clean local migration replay, `pnpm test:db`, `pnpm typecheck`. Query schema constraints and intended indexes as evidence; verify two collection memberships reference one item ID.
- **If it fails:** repair the unshipped migration, recreate only disposable test data through the guarded harness, rerun. Once a migration reaches an authorized live branch, append a new corrective migration instead of rewriting history.

#### S06 — Enforce principal transactions, grants and RLS

- **Depends on:** S05.
- **Target/anchor:** `0007_policies.sql`; `core/auth/authorization.ts`, `core/db/transaction.ts`; isolation tests.
- **Preflight:** domain ownership/path checks are represented in schema; API/worker are non-owner roles.
- **Action:** implement exact access rules from 5.3/5.5. Separate private ACL helper privileges from data CRUD. Add internal `JobContext={workspaceId,jobId,sourceVersionId,leaseToken}` and `withJobContext` for worker-only policies; it is not a public human/agent Principal and is never accepted from HTTP. Every worker mutation proves its fenced lease. Require consistent ACL/evidence intersection for derivatives, graph and traces. Apply policy tests using real `atlas_api`/`atlas_worker` logins with two owners, two projects, two agents and five scopes.
- **Expected result:** inaccessible data is denied at SQL and API layers; missing context denies; revoked source grants cannot leak through memories/graphs.
- **Verify:** `pnpm test:db` plus `pnpm test:security` when script exists. Test sequential reuse of one pooled connection across owners/agents, rollback leakage, forged workspace/FK, private child reads, worker approval attempts and direct private ACL reads.
- **If it fails:** stop dependent feature work and fix the smallest access policy/role/context defect; never bypass RLS to make a test pass.

#### S07 — Implement real managed Auth and owner binding

- **Depends on:** S03, S05–S06; E01–E02 for live validation.
- **Target/anchor:** web `auth/client.ts`, `auth/AuthProvider.tsx`, sign-in view; API `middleware/identity.ts`; core `auth/neon.ts`; `scripts/bind-owner.ts`.
- **Preflight:** selected branch Auth Base URL/JWKS are actual setup values. Confirm installed prerelease SDK exports/types still match official React/JWT docs; no working identity provider exists to preserve.
- **Action:** implement owner email/password login, pending/error/reload/sign-out flows via managed SDK; JWT verification and enabled owner/membership resolution per 5.2. No social/OAuth/invites UI P0. Owner enrollment/binding is a setup step performed by the owner; do not trigger auth emails unattended. Synthetic JWT/JWKS fixtures use a test-only verifier supplied by app factory; production mode rejects the fixture adapter.
- **Expected result:** authorized owner sees own data; valid unrelated Neon user gets no vault access; unauthenticated endpoints fail independently of page routing.
- **Verify:** local signed-JWT tests cover wrong issuer/signature/expiry/subject, disabled owner, session clearing and private-page cache. After E01/E02, manually verify sign-in, reload, sign-out and protected API access using real Auth. Record fixture and live results separately.
- **If it fails:** inspect exact SDK method/URL/cookie/trusted-origin issue. Do not switch to another auth platform or weaken JWT verification; leave live gate pending while independent local work continues.

#### S08 — Implement projects, collections and minimal navigation

- **Depends on:** S05–S07 (local fixture route validation may precede live Auth).
- **Target/anchor:** API project/collection routes; core `projects.ts`, `collections.ts`; web projects/collections/navigator; workspace bootstrap.
- **Preflight:** one owner workspace and deterministic seed metadata exist in the test fixture.
- **Action:** build create/edit/archive projects and create/rename/nest/move/archive/merge collections. Merge is one transaction, preserving item IDs/manual flags and child trees; require conflict mapping for normalized child-name collisions. Prevent moving beneath a descendant; archive does not delete sources. Create compact shell with real empty/loading/error states and route-state ownership.
- **Expected result:** organization persists after reload and process restart; changing collections does not alter access grants.
- **Verify:** `pnpm test:db`, relevant E2E create/edit/reload/merge/cycle tests; inspect database counts for single-document membership. `pnpm build`.
- **If it fails:** diagnose route -> schema -> service transaction; fix localized behavior. Do not rebuild UI or flatten collection trees to bypass invariants.

**Checkpoint C1:** persistent organization and isolation pass locally; live owner Auth and Neon persistence are required to label the actual application foundation complete.

### Phase 2 — dependable knowledge capture

#### S09 — Preserve original sources with immutable versions

- **Depends on:** S05–S08; E01/E02 for actual S3.
- **Target/anchor:** `core/storage/source-store.ts`, `core/storage/neon-s3.ts`, `core/knowledge/sources.ts`; source routes; source-version tests.
- **Preflight:** private bucket name/branch endpoint are explicit; no public source access or raw object key is trusted from a client.
- **Action:** define SourceStore `putOriginal/getOriginal/headOriginal` and S3 adapter with SigV4, `forcePathStyle:true`, checksum metadata and immutable generated keys. Implement staged SQL/object finalization and reconciliation from 5.6; SQL/S3 are not one atomic transaction. All downloads pass current source authorization before S3, with safe Content-Disposition. Test adapter stores originals only in temporary test filesystem and is unavailable in release mode.
- **Expected result:** acknowledged captures have recoverable original bytes; repeated uploads are idempotent; object or SQL failure cannot lose the original silently.
- **Verify:** DB + temporary-store tests inject failure at reserve/upload/finalize and restart reconciliation; byte-for-byte hash comparison. E02 live S3 put/get/head verifies actual Neon behavior separately.
- **If it fails:** reconcile only recorded task-created keys and pending records; do not delete a bucket or mark pending writes successful.

#### S10 — Add note editor, text/Markdown imports and Inbox

- **Depends on:** S09.
- **Target/anchor:** web `features/editor/KnowledgeEditor.tsx`, `features/inbox/InboxPage.tsx`; `contracts/knowledge.ts`; source routes/services.
- **Preflight:** content-size/type/revision rules and original preservation are active.
- **Action:** Tiptap StarterKit+Markdown with explicit save/Ctrl+S/unsaved guard; store durable Markdown and editor JSON, preserving raw uploads separately. Import UTF-8 text/Markdown and pasted docs; reject null-byte/binary disguised input, unsupported files, unsafe filename paths and >2 MiB. Escape raw source display; sanitize allowed HTML/paste, strip unsafe URL schemes, no remote images by default. Implement source detail/version history, collection assignments and Inbox state.
- **Expected result:** usable personal library without AI; import/export/edit do not erase unsupported original syntax.
- **Verify:** unit Markdown round-trip fixtures (code fences/paths/tables/links), E2E save/reload/version/concurrent-edit 409, dirty navigation, malicious HTML and exact duplicate import; `pnpm build`.
- **If it fails:** preserve raw original and unsaved draft; show retry/compare rather than overwrite. Limit supported editor schema explicitly instead of discarding input.

#### S11 — Gate sensitive content and explicit source sharing

- **Depends on:** S09–S10.
- **Target/anchor:** core/security/secret-scan.ts; source sensitivity/processing-grant routes; Inbox sharing controls; SECURITY.md.
- **Preflight:** sources default personal; deterministic capture/search requires no agent; no provider module/config exists.
- **Action:** scan/quarantine each source version before agent delivery; implement redaction/new-version or explicit selected-version release. Owner sees agent, exact source/version, expiry and allowed collection catalog before granting. Personal processing-only access never implies general personal memory/source retrieval. Server checks sensitivity at claim/read/renew/submit, not only when grant is created. Source edits revoke/supersede old-version tasks.
- **Expected result:** flagged content remains safely stored for owner; an ungranted agent receives no task metadata, source text or secret snippets.
- **Verify:** synthetic secret/private-key fixture; cross-version grant, standard search vs task-only read, expiry/revocation/source-edit races; log redaction. No real secrets and no model network calls.
- **If it fails:** block agent delivery/submission, preserve capture/indexing, repair the missing authorization check before continuing task tools.

#### S12 — Build structural chunks and exact lexical retrieval

- **Depends on:** S05–S06, S09–S11.
- **Target/anchor:** `core/knowledge/chunk.ts`, `core/retrieval/lexical.ts`; search document repositories and indexes; search UI.
- **Preflight:** normalized immutable source text, structural path and offset contracts match 5.4.
- **Action:** chunk by headings/paragraphs/code blocks with 400 target/800 maximum conservative tokens; split oversized blocks on line boundaries and record continuity. Use at most 50-token overlap at adjacent paragraphs, with explicit span mapping. Preserve identifiers and code; use FTS `simple` plus exact/substr trigram path/symbol matching. Reindex only current nondeleted eligible source versions; private originals are searchable by owner even when no agent is connected.
- **Expected result:** exact identifiers and relevant source passages are found without a provider; citations point to actual immutable spans.
- **Verify:** unit offsets reconstruct original normalized slices; integration retrieval of `/api/v1`, `patient_id`, SQL names, Unicode and zero-results; current-version and permission filtering before ranking. `pnpm test:unit`, `pnpm test:db`.
- **If it fails:** repair span/index freshness; do not “fix” relevance by returning unauthorized or superseded text.

#### S13 — Implement bounded safe URL import

- **Depends on:** S09–S12.
- **Target/anchor:** `core/security/safe-url.ts`, `core/knowledge/url-import.ts`; URL route and capture UI.
- **Preflight:** URL feature has no credentials/cookie injection, browser automation, or authenticated scraping.
- **Action:** accept HTTPS only/port 443, no credentials/fragments/custom headers; normalize URL. Reject localhost, IP literals, private/reserved/link-local/multicast IPv4 and IPv6 (including IPv4-mapped), metadata hosts and invalid IDNs. Resolve all DNS results, reject any unsafe address, pin the connection to the validated public IP using a scoped Undici dispatcher while preserving TLS hostname verification; revalidate each redirect (max 3) and forbid HTTPS downgrade. Timeout 10 seconds, stream/decompressed cap 2 MiB, max 3 imports concurrently, supported HTML/text/Markdown only. Snapshot original response, use nonexecuting Readability/linkedom extraction, no embedded resource fetching. Blocked/paywalled/dynamic pages return a short actionable failure with paste/manual import alternative; no bypass.
- **Expected result:** public documentation capture preserves URL/fetch time/bytes while local services and metadata endpoints cannot be fetched.
- **Verify:** controlled network/DNS fixture tests for redirect-to-private, mixed DNS answers, rebinding, IPv6, oversized/compressed body, timeout, script markup and hostile headers. Optional authorized public-doc smoke; it is not required for offline tests.
- **If it fails:** keep URL import disabled with an explicit message until the security tests pass; continue text/Markdown capture. Never replace the pinned client with ordinary unvalidated fetch.

**Checkpoint C2:** owner can capture, edit, search, archive/restore and export originals without an active agent. Awaiting agent never blocks ordinary captures. Actual Neon persistence remains a live gate.

### Phase 3 — durable organization and trustworthy memories

#### S14 — Implement deterministic ingestion jobs and local worker recovery

- **Depends on:** S06, S09–S12.
- **Target/anchor:** core/jobs/{claim,runner,stages}.ts; API worker.ts/supervisor; job routes/UI.
- **Preflight:** local jobs normalize/chunk/index/reconcile only; worker has no provider SDK, agent token, agent launcher or canonical approval right.
- **Action:** implement durable SKIP LOCKED claims, fenced leases, stage results, bounded retries/cancel/restart behavior from 5.7. API starts a separate deterministic worker on startup/new work; worker drains/waits for bounded retries and exits after 30 seconds idle. Unexpected exit schedules lease recovery. Chunks/indexes finalize before organization batches become claimable. No recurring model work or continuous idle cloud polling.
- **Expected result:** source capture/search survives crashes without duplicate chunks/index records, independently of active agents.
- **Verify:** real local DB tests kill after claim/stage/commit boundary, run two claimers, cancel, replace source and expire lease. One canonical stage output; stale worker rejected. Assert no agent/model process launches or provider calls.
- **If it fails:** repair transactional/fencing logic; preserve source/pending object/job records; never replace durability with an in-memory queue.

#### S15 — Add durable agent-processing tasks and version-scoped grants

- **Depends on:** S11, S14 and early S21 (registry/credential/processing capability).
- **Target/anchor:** contracts/organization.ts; core/organization/{tasks,claims,grants}.ts; organization routes/Inbox.
- **Preflight:** deterministic chunks exist; source sharing and registered agent auth are enforced; general reads still deny personal sources.
- **Action:** create <=20-chunk tasks with immutable version/revision/batch/catalog and contract_version=1. Implement eligible list, atomic claim, purpose-scoped batch read, renew, release, expiry/reclaim, supersession and revocation. Private tasks need owner version+agent grant; project tasks require read+process rights. Same-agent claim retry may rotate lease token and fence the old token, never reset first_claimed_at or extend past its cap; another agent gets conflict. Store token digest only. Keep complete source/version access outside task routes denied.
- **Expected result:** Inbox truthfully waits while no authorized active agent exists; later sessions resume; processing-only access cannot browse personal memory.
- **Verify:** state-machine/concurrent-claim tests; wrong agent/source/version/chunk/catalog, lease expiry, token rotation, source edit, grant revoke between read/submit, and regular read_source denial despite task access. Real local DB tests with scoped roles.
- **If it fails:** stop task delivery/submission, preserve pending sources/tasks, fix the scoped context/policy. Do not add an AI API or auto-start an agent.

#### S16 — Validate agent organization submissions and apply permitted metadata

- **Depends on:** S12, S15, S21.
- **Target/anchor:** contracts/organization.ts; core/organization/{schemas,submit,evidence}.ts; source/classification/review repositories; Inbox review UI.
- **Preflight:** authenticated claimed task, exact delivered batch, unexpired processing rights, immutable source version and owner policy.
- **Action:** implement complete 5.9 input schema, limits, coverage, evidence/hash validation, candidate-local refs and scope intersection. Validate the whole payload before transactionally creating submission/review records; no half-applied invalid payload. Exact idempotent replay returns same candidate IDs if current authorization remains valid; changed payload conflicts. Apply only permitted high-confidence existing collection membership, never manual overrides/new collection creation. Persist entity/relationship/memory candidates as proposed. Optional source_summary becomes a semantic memory candidate with structured_content.record_kind=source_batch_summary, batch_index and full batch coverage; it is never a hidden whole-document verified summary.
- **Expected result:** a capable existing agent can organize saved sources with controlled persisted suggestions and honest provenance; no server-side inference.
- **Verify:** deterministic submitted-payload fixtures: fabricated evidence/IDs, incomplete coverage, revoked grants, current-version race, invalid candidate refs, inferred fact, manual negative override, same-key replay/different payload, two submissions and transactional rollback. Actual agent output is tested later at E03.
- **If it fails:** retain the task/source and return bounded validation feedback. Reject invalid submissions rather than auto-correcting factual content with another model.

#### S17 — Implement review, evidence, lifecycle and supersession

- **Depends on:** S06, S16.
- **Target/anchor:** core/memory/{review,lifecycle,evidence,consolidate}.ts; review/memory routes/UI; entity/relationship approval.
- **Preflight:** proposed candidates are traceable to agent/submission/version/spans, and only owner may approve.
- **Action:** implement all five memory types and lifecycle states, evidence checks, history, approve/activate, reject/archive, explicit supersession and stale-source revalidation. Review batch summaries and entity aliases before they enter authoritative search. Processing-only grants cannot approve private summaries or turn them into ordinary agent-readable memory. Curated core/critical flags remain owner-only. Exact duplicate merges preserve canonical ID/history/evidence and scope intersection. Recompute task/source progress from all batch/review states.
- **Expected result:** current owner-approved memory is authoritative; proposed/inferred/stale/historical information is clearly labeled and never silently promoted.
- **Verify:** transition table, invalid evidence rollback, simultaneous supersessions, private/source sharing, partial-batch source state, archive/restore, duplicate merge, source changes and agent approval denial. Unit/DB/E2E.
- **If it fails:** roll back approval, preserve pending review/version history and report Failed Verification; no rewriting old facts to hide conflict.

**Checkpoint C3:** deterministic ingestion and processing-task grants/leases/submission/review pass; early S21 is complete. Organization output from fixtures is controlled protocol evidence; real agent organization remains required at E03. No model service is installed.

### Phase 4 — relevant, budgeted retrieval

#### S18 — Materialize approved summaries, aliases and lexical search documents

- **Depends on:** S12, S17.
- **Target/anchor:** core/retrieval/{materialize,aliases,refresh}.ts; deterministic materialize_memory jobs; search_documents indexes.
- **Preflight:** current active reviewed memories/entities/aliases and original source chunks are available; no vector columns/extension/provider config.
- **Action:** materialize only active nonstale summaries/structured facts and approved aliases into lexical search documents. Source overview concatenates approved batch summaries in source order with explicit missing-batch indicators; do not synthesize unsupported bridging claims. Project context composes approved project/core memories deterministically. Invalidate/rebuild only affected documents after approval/supersession/source edit/archive; expected revision/fencing prevents stale materialization. Index FTS/simple identifiers and trigram text.
- **Expected result:** compact reviewed context and useful aliases can be searched without embedding/model calls; all text retains source/evidence/version pointers.
- **Verify:** approval/pending alias visibility, stale materialization race, incomplete batch summaries, exact symbols/aliases, source deletion/revocation, supersession and deterministic rebuild/restart. Unit/DB; no network model dependency.
- **If it fails:** preserve original/approved memory, mark affected derived search document stale and rebuild deterministically; never generate fake vectors or call a provider.

#### S19 — Implement lexical/graph context retrieval and token budgets

- **Depends on:** S06, S12, S17–S18.
- **Target/anchor:** `core/retrieval/{retrieve,rank,context,budget,continuation}.ts`; retrieval routes/UI; `contracts/retrieval.ts`.
- **Preflight:** accessible-candidate SQL, actual RLS and current evidence predicates exist; source-only vs memory-context result behavior is explicit.
- **Action:** implement 5.8 deterministic rank algorithm, lexical exact identifiers, project/core constraints, authorized graph expansion, active/temporal/stale filtering and byte-conservative output packing. Budget every read expansion, including get_memory/read_source/recent, not only search. Return no misleading partial context if required constraints cannot fit. Principal-bound continuation rechecks grants/current state. Store redacted traces, disable raw-query content by default, and partition any cache by principal/current grant revision/normalizer/filter; prefer no retrieval cache in P0.
- **Expected result:** meaningful current evidence-backed context, truthful lexical/graph mode, bounded output and progressive source expansion without hidden disclosures.
- **Verify:** unit/property tests for budget boundaries, escaping/Unicode, metadata overhead, oversized single critical item, noncritical omissions, stale continuation, exact code symbol, current vs superseded fact, hidden source citation and revoked permissions between query/expansion. `pnpm test:unit`, `pnpm test:db`.
- **If it fails:** reduce candidate/expansion work or fix rank/budget logic while preserving completeness/authorization. Never truncate a critical constraint silently or filter authorization after ranking.

#### S20 — Establish memory quality regression fixtures

- **Depends on:** S17–S19.
- **Target/anchor:** `tests/fixtures/clinic-management-demo/`; `tests/evaluation/`; evaluation report and TEST_REPORT.md.
- **Preflight:** fictional data only, corpus/evidence labels are versioned, fixture reset cannot target real vault.
- **Action:** create at least 20 labeled queries covering architecture, exact identifiers, approved aliases, conventions, decision rationale, resolved automation issue, UI guidance, unrelated project, stale fact, private knowledge, context-budget constraints and original evidence. Include 100/1,000/5,000 synthetic nodes for later measurement. Compare retrieved facts/evidence against labels and full-document baseline; report recall@5, evidence coverage, critical constraint coverage, stale/private leakage, latency and token estimate. Actual agent answer correctness is checked in E03 using its existing session; no separate API evaluation runner. Token estimates and any supported tokenizer/client measurements are labeled separately.
- **Expected result:** reproducible evidence catches retrieval regressions; no claim of token savings based only on a small mock corpus.
- **Verify:** `pnpm test:evaluation`: required facts appear top five for >=90% of eligible labeled retrieval queries; critical-constraint coverage 100% when response is successful; unauthorized/stale default leaks zero; invalid budget produces explicit failure. Publish actual fixture size and results locally.
- **If it fails:** inspect missed query/evidence and fix extraction/index/ranking only within contract; preserve failed report. Do not change labels solely to improve scores.

**Checkpoint C4:** deterministic compact retrieval passes correctness/isolation/token-budget thresholds. Real agent organization and fresh-session use remain separately verified at E03.

### Phase 5 — agent memory round trip

#### S21 — Establish agent identities, credentials and processing rights early

- **Depends on:** S06–S08, S14.
- **Execution order:** run before S15; this registry/credential step is deliberately pulled forward from the agent-integration phase.
- **Target/anchor:** core/agents/{registry,credentials,grants}.ts; credential middleware/private helpers; owner agent/processing-grant UI.
- **Preflight:** source scopes/RLS and owner Auth are defined; no client-supplied agent identity is trusted.
- **Action:** owner creates/edit/disables agents, selects exact projects/scopes and read/propose/process_knowledge capabilities, issues expiring random tokens shown once and revokes immediately. New agents have no grants; process_knowledge is opt-in. Add selected-version private processing grants with catalog/expiry, separate from normal visibility. All task and ordinary reads recheck auth/grants. Activity starts empty, then uses actual stored events; no fake connected/live indicator.
- **Expected result:** S15 can use real credential-managed principals safely; private processing grants cannot expose private memory through ordinary tools.
- **Verify:** invalid/expired/revoked tokens, disabled agents, five-scope policy matrix, SQL-level source/memory fixtures, wrong project/version/catalog, process-only vs general read and no grant broadening. Rerun full memory/graph/task route denial suite at S23 once those routes exist.
- **If it fails:** revoke fixture token and fix middleware/SQL grants before task delivery; never distribute real credentials while isolation fails.

#### S22 — Register fifteen MCP tools and project-local workflow instructions

- **Depends on:** S03, S15–S19, S21.
- **Target/anchor:** MCP index.ts/tools.ts/api-client.ts/config.ts; contracts/organization.ts; tests/mcp/; skills/atlas-knowledge/SKILL.md and references/mcp-workflow.md; SETUP.md.
- **Preflight:** official v2 SDK imports/types match pinned packages; nine memory tools plus six task tools exist in API; use skill-creator guidance during execution when creating the actual local skill.
- **Action:** register all fifteen tools from 5.10 with Zod input/output validation, precise descriptions, bounded responses and accurate annotations. Client calls loopback API with scoped ATLAS token; no direct DB/storage/model access. Stdout is protocol-only, stderr redacted. Project-local skill teaches: retrieve current project context; inspect live repository when needed; process only authorized relevant pending batches when human request or prior human-approved task policy permits; treat sources as untrusted; submit evidence-backed suggestions; leave review to owner; release interrupted tasks. Skill describes workflow, never grants itself authority or automatically installs a hook/config into every agent. Standard MCP/schema contracts remain portable; installation is per actual client.
- **Expected result:** SDK client can exercise memory and processing flow; owner can invoke an existing capable agent without separate AI API setup.
- **Verify:** build then test:mcp spawning actual stdio executable; all fifteen schemas/outputs, process-only isolation, claim/read/renew/release/submit/replay, source version/revoke races, pending writes, API outage/timeout, protocol-clean stdout and no provider modules. Inspect skill instructions for self-authorized private access or autonomous agent launches.
- **If it fails:** repair thin adapter/schema/workflow instructions; keep safe API/test scope; do not substitute a remote endpoint or model service.

#### S23 — Prove cross-session persistence and prepare real client setup

- **Depends on:** S17, S20–S22; E03 for actual Codex.
- **Target/anchor:** MCP/E2E round-trip tests; `scripts/start-mcp.ps1`; SETUP.md `Windows local MCP`; SESSION_LOG/TEST_REPORT.
- **Preflight:** fictional clinic fixture, isolated granted agent, owner approval UI and actual persisted source/memory all work.
- **Action:** client A retrieves project context, proposes a source-backed decision, owner reviews/approves, then terminate A and restart API/worker. Spawn client B with no shared in-memory history and retrieve approved decision/evidence. Revoke token and prove a new call fails. Prepare exact local Codex TOML example and DPAPI launcher; do not modify global client configuration automatically.
- **Expected result:** external database memory, not process state, survives sessions; owner remains the approval authority.
- **Verify:** `pnpm test:mcp` and round-trip E2E show process IDs/session reset and persistent row IDs. After E03, two actual new Codex chats retrieve/propose/approve/retrieve and deny after revocation; record observed tool outputs without private content/tokens.
- **If it fails:** locate missing persistence/approval/grant state; preserve proposal evidence. Report SDK-client success separately if actual Codex remains blocked.

**Checkpoint C5:** controlled fresh-process round trip passes. The core goal additionally requires real Neon plus actual existing-agent organization and fresh-client retrieval at E03; no AI API integration is required.

### Phase 6 — accurate graph and compact workspace

#### S24 — Add authorized graph DTOs and layout persistence

- **Depends on:** S06, S17, S19, S21.
- **Target/anchor:** `contracts/graph.ts`; `core/graph/{query,layout}.ts`; graph/layout API routes.
- **Preflight:** all graph edges can cite a persisted relationship or join-row ID; partial scopes and deleted/revoked evidence are represented.
- **Action:** return `GraphDTO={nodes:[{id,kind,title,status,degree,updated_at}],edges:[{id,from,to,type,status,evidence_refs,origin}],truncated,next_cursor?,revision}` under bounds in 5.1. Every node/edge/count reuses authorization; counts describe authorized returned graph only. Global means selected workspace's accessible graph, not all data. Local means bounded neighbors of selected authorized item. Persist user/view positions/camera/filter state in graph_layouts; new items get deterministic positions; reset is explicit and owner-only.
- **Expected result:** no invisible endpoints, random links, full-content overfetch, or client-library storage coupling.
- **Verify:** API tests compare edge IDs/endpoints with persisted rows, count permissions, truncation/cursor behavior, archived/changed evidence, node existence and layout save/reload. `pnpm test:db`, `pnpm typecheck`.
- **If it fails:** fix query authorization/DTO data; do not compensate with client-side filtering or invented fallback edges.

#### S25 — Implement Sigma 4 graph lifecycle and interactions

- **Depends on:** S24.
- **Target/anchor:** web `features/graph/{GraphCanvas,useGraphLayout,GraphToolbar,GraphLegend}.tsx`; graph styles.
- **Preflight:** direct Graphology/Sigma APIs match installed v4 docs; use a React lifecycle wrapper, not an unverified third-party React binding. No v3 reducers/settings copied blindly.
- **Action:** import Graphology and Sigma, load DTO attributes, size a real container, create/kill renderer in a scoped effect, retain positions, run bounded ForceAtlas2 worker, and update data incrementally without restarting physics on inspector/filter-only UI state. Implement pan/zoom/select/hover/neighbors/local-global/filter/search/fit/reset/expansion and real legend. Inspector and accessible list share selection by stable item ID. Handle WebGL failure with list fallback.
- **Expected result:** graph settles, selections reveal actual evidence, returning preserves layout, unmount releases workers/listeners/WebGL resources.
- **Verify:** browser visual interaction at 1440x900 and 1366x768, reload positions, filters/search/fit, rapid route/unmount cycles, reduced motion and WebGL-disabled scenario. Record screenshots and actual API-backed graph. `pnpm test:e2e` plus targeted browser inspection.
- **If it fails:** isolate renderer lifecycle/worker/camera issue; retain list and DTO. Do not replace real data with static decorative graph or suppress errors.

#### S26 — Complete responsive three-region UI and accessibility

- **Depends on:** S08–S10, S17, S21, S25.
- **Target/anchor:** web `app/`, `components/{Navigator,ContextInspector,Drawer,EmptyState}.tsx`, page features, `styles/tokens.css`.
- **Preflight:** working data/services precede design polish; preserve source labels/navigation and chosen tokens from 5.11.
- **Action:** implement required routes and three-region layout, progressive inspector detail, compact rows, searchable collections/projects/agents, useful empty/loading/error/save states and short actionable copy. Include accurate source/state/access metadata. Drawers trap focus and return it; selection accessible by keyboard; mobile uses single-column and dedicated details. Font licenses retained. Apply contrast, reduced-motion, touch, keyboard and screen-reader rules from 5.11.
- **Expected result:** owner can capture/search/review/manage grants on phones and desktop; no critical function requires the graph.
- **Verify:** browser checks at 1440x900, 1366x768, 1024x768, 768x1024, 390x844 and 320x740, plus short 1280x600 and 200% text/zoom; keyboard-only capture/search/review, focus return, no horizontal overflow, reduced motion and rendered contrast. `pnpm test:e2e` + axe; save representative screenshots under ignored artifacts.
- **If it fails:** fix affected breakpoint/component/state only; avoid reducing text to unreadable sizes or clipping content to remove scrolling.

#### S27 — Show real changes and basic retrieval traces

- **Depends on:** S19, S24–S26.
- **Target/anchor:** web activity/graph modes and inspector; trace API authorization.
- **Preflight:** traces contain persisted selected IDs/revisions and activity events, no invented live-agent state.
- **Action:** implement Explore/Focus/Changes and an on-demand trace overlay for an existing trace ID. Highlight only recorded currently accessible items/edges and explain missing/revoked records. Show budget estimate/rank/evidence when available. Use explicit refresh after owner actions and on-demand activity loading; do not add continuous idle polling/realtime/cloud cron merely for animation. Advanced live tracing remains P1.
- **Expected result:** visual activity explains actual saved retrieval/change evidence without implying the model is currently thinking or connected.
- **Verify:** trace selection before/after revocation/archive, no-trace empty state, pending proposals only visible to owner, selected revision labeling; browser confirmation and integration authorization test.
- **If it fails:** omit unavailable overlay with clear state; fix trace contract instead of generating plausible-looking paths.

**Checkpoint C6:** real graph/list/inspector and required responsive/accessibility checks pass; record measured dataset sizes and known limitations.

### Phase 8 before Phase 7 — ownership, hardening and P0 release

The source brief lists extended integrations before hardening. For this build, finish P0 hardening/recovery before optional P1 imports. This is a sequencing clarification, not a claim that all future features are built.

#### S28 — Implement portable export, archive/restore and backup verification

- **Depends on:** S09–S10, S17, S21, S24.
- **Target/anchor:** `core/knowledge/{export,archive,restore}.ts`; owner routes/UI; BACKUP.md; export/restore tests.
- **Preflight:** original keys/checksums and evidence/version references are complete; inaccessible sources cannot be exported by agents.
- **Action:** owner export produces versioned manifest JSON, Markdown content, original bytes and relationship/evidence metadata, with safe filenames and checksums. Exclude tokens, hashes usable as credentials, service secrets and managed Auth password/session data. Archive is recoverable and propagates visibility/staleness; restore retains IDs/history and requires revalidation as needed. Provide direct Postgres metadata dump plus object manifest/bytes backup procedure and encrypted storage guidance. Test restoration to a separately authorized disposable database/store; branch restore alone is not a verified complete application backup.
- **Expected result:** owner owns portable knowledge and can recover both metadata and original bytes. Permanent deletion is a distinct confirmed operation with impacted evidence/dependencies shown; do not run it as part of this step.
- **Verify:** fixture export/restore compares counts, IDs, raw hashes, Markdown, version/evidence links, scoped visibility and missing-file detection; fresh-process retrieval after restore. Record restore duration and actual target, with credentials redacted.
- **If it fails:** preserve backups and original data, identify missing component; do not overwrite the working vault or claim recoverability from an untested dump.

#### S29 — Complete security, quality and performance gates

- **Depends on:** S13, S20, S23, S26–S28.
- **Target/anchor:** unit/DB/MCP/E2E/security/evaluation/performance suites; SECURITY.md; TEST_REPORT.md; CI definition only if a repository host is later chosen.
- **Preflight:** critical tests are real and test/real targets are separated; no credential or source contents in logs/build outputs.
- **Action:** run required matrix in section 10; test interrupted agents, abandoned/replayed submissions and deterministic worker lease crashes, prompt injection, URL/upload safety, owner/agent isolation, source-evidence leaks, revocation and no automatic approval. Profile 100/1,000/5,000 synthetic nodes with bounded graph responses; record hardware/browser/active node count/query plan/warm vs cold Neon latency. Use local performance targets in section 10; diagnose failed checkpoints, do not claim a broad security certification. Add minimal CI commands only after host/CI scope is selected; local checks are mandatory regardless.
- **Expected result:** known release-blocking defects resolved, measured behavior documented, failures and live limitations honest.
- **Verify:** run checks once in prescribed dependency order after final changes; rerun only affected failed/changed checks. Final build, deterministic isolation/evaluation and actual browser behavior must agree.
- **If it fails:** record Failed Verification with reproducible evidence; fix within task or stop the dependent release. Do not weaken tests, hide warnings or widen permissions.

#### S30 — Validate the personal release and hand over

- **Depends on:** S28–S29 and E01–E03.
- **Target/anchor:** README, SETUP, ARCHITECTURE, API_REFERENCE, SECURITY, BACKUP; task/progress/session/test records; P0 checklist.
- **Preflight:** actual dedicated Neon IDs/branch and owner/agent setup are recorded; live checks demonstrate capabilities claimed. `main` cutover/migrations require its own explicit authorization; dev evidence alone is not a personal-data release.
- **Action:** verify restart/reload/persistence and the full clinic scenario with the actual client, plus owner workflows/mobile/recovery. Document manual pnpm start, PC/network requirement, source ownership, processing grants/lease recovery, agent revocation and context token budgets. Synchronize documents with implemented state; list P1/P2 separately. If authorized, move only validated schema/config and owner-controlled setup to the dedicated main branch; never copy fixture facts into the real personal vault.
- **Expected result:** a usable verified personal memory workspace; no implied public deployment/always-on service.
- **Verify:** every P0 acceptance row in section 10 has observed evidence and no known critical security defect. If a live capability is pending, report “local implementation complete; live acceptance pending,” not “MVP complete.”
- **If it fails:** keep the prior validated branch/config, preserve data and incomplete checklist, report smallest remaining blocker.

## 9. External checkpoints — prepare first, act only within later authorization

These steps are not executed by a planning invocation. Reuse a later explicit authorization when it covers the exact action; do not repeatedly ask for an already authorized operation. If only local implementation was requested, complete the local work and leave these gates pending with concrete resources ready for review.

### E01 — Provision only the dedicated Neon backend

- **Depends on:** explicit authorization for new ATLAS cloud resources; current Neon account access; S03 config contract. Local code may proceed without it.
- **Target:** organization `Yakatzel`, observed ID `org-floral-darkness-38230607`; new project `ATLAS`; AWS Singapore `aws-ap-southeast-1`; Postgres 18; main branch `main`, database `neondb`, setup role `atlas_setup`. Use dedicated app schema `atlas` inside neondb. This organization was the only one returned by the read-only account listing; verify it again before writes.
- **Preflight:** inspect new project list for an ATLAS project created after this planning snapshot. If a previous attempt is uncertain, reconcile by exact project/creation time instead of creating another. Confirm region services and current free-plan limits. Do not downgrade IP/private-network protections on any existing project to enable Auth.
- **Action:** prefer authenticated Neon CLI if available; otherwise use the already connected official Neon connector. Installing project-local CLI tooling is separate from provisioning. With authorized creation, use the verified create_project contract: name ATLAS, explicit org/region/PG version, branch name main/database neondb/role atlas_setup, compute min 0.25 CU/max 1 CU if supported, autosuspend configured explicitly. Record returned project/default-branch/endpoint IDs. Create normal branch `atlas-dev` from this new empty main, not from another project's data. Record actual branch/compute IDs. Branch-scoped Auth and storage are enabled on atlas-dev first; main is configured at S30 only when its cutover is authorized.
- **Proposed complete `neon.ts`, not deployed:**

```typescript
import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  auth: true,
  buckets: {
    'atlas-sources': { access: 'private' },
  },
});
```

- **Action continued:** inspect installed CLI `--help`; link/check out the exact new project/atlas-dev branch without overwriting existing env values. Review `neon config plan` before the authorized apply. No Data API, Functions, gateway, public bucket, logical replication or remote app deployment. Store actual connection/Auth/S3 settings in ignored config through secure tool/file handling, never output connection strings to chat. Confirm private bucket and actual database name; Auth URL path must refer to the same database/branch. The setup connection is reserved for migrations/role provisioning. Generate separate app/worker login secrets locally, save securely, and grant no elevated inheritance.
- **Expected result:** dedicated, explicitly identified development backend only; existing projects unchanged.
- **Verify:** read back project region/PG version/branch IDs/config, enabled Auth/JWKS, private bucket access and role attributes without secrets. Anonymous S3 read must fail. Use minimal synthetic source bytes for storage smoke; no real private documents.
- **If it fails:** preserve resource IDs/operation evidence, stop affected service setup, continue local work. Never create a second project/account, choose a different region, broaden networking, or use an unrelated existing database as a workaround. Failed/uncertain provisioning is not authorization to clean up destructively.

### E02 — Apply migrations and prove actual Neon persistence/isolation

- **Depends on:** E01, S05–S06/S09, explicit authorization for migration to the recorded atlas-dev branch.
- **Target:** the actual E01 project/atlas-dev endpoint, database neondb, schema atlas; `atlas-sources` on the same branch.
- **Preflight:** target guard compares recorded project/branch/database with current provider metadata; migration uses direct nonpooler setup URL, API/worker use pooled restricted role URLs. Inspect migration plan/checksums; live database contains no existing personal/client data. Never log secrets while checking.
- **Action:** apply versioned migrations, which initially define non-login app role identities; activate atlas_api/atlas_worker login secrets securely through setup after grants/RLS are installed. Bind actual owner issuer/subject through explicit setup; seed collection definitions and fictional demo only. Private ACL helpers and restricted app roles must exist before enabling API data routes. Test CRUD/source versioning and original bytes through application API/storage adapter. Do not run the destructive local fixture reset against Neon. Lexical indexes are defined in migrations; no vector extension/index is installed.
- **Expected result:** actual database/Auth/source persistence works with least privilege; service role/admin paths are not normal application traffic.
- **Verify:** restart processes and reload data; test wrong user/project/agent, grants/revocation, evidence/graph child access using actual app role. Check RLS enabled, no privileged role inheritance, no plaintext credential storage, and bucket remains private. Record actual branch/project IDs and proof category without sensitive content. Use only dedicated fixture IDs for reversible archive/restore checks.
- **If it fails:** stop live validation, preserve data and migration journal, fix in local tests and append corrective migration if already applied. No `db reset`, branch reset, drop/recreate, destructive restore or public grant as routine recovery.

### E03 — Verify organization with the owner's existing agent and actual MCP client

- **Depends on:** E02 and S15–S23; authorization to register the local MCP server and grant a specific existing client source-processing access. No AI API key, provider account setup or spend cap is required by ATLAS.
- **Target:** existing owner-controlled Codex or capable compatible client on this PC, fictional atlas-dev corpus, newly issued scoped ATLAS credential.
- **Preflight:** fifteen-tool SDK tests and owner review already pass; demonstrate a task in Awaiting agent before any agent claims it. Owner approves the client configuration and exact processing source/version/agent grant. A real agent uses its own normal host access/usage; ATLAS cannot promise or meter its cost.
- **Action:** owner opens an actual agent session and invokes the project-local ATLAS workflow. Agent lists/claims a fictional source batch, reads its source, submits classifications/source-backed candidates, and leaves them reviewable. Owner approves appropriate memories, ends the session, restarts local API as needed, then opens a fresh session and retrieves the approved memory. Test a private processing-only source that never appears through ordinary search/context. Revoke the task grant/token and demonstrate immediate denial of further reads/submit. Use manual owner-opened chats; do not create/message chats or run an agent automatically without explicit instruction.
- **Expected result:** actual existing-agent organization and cross-session persistence work with no separate AI-provider integration.
- **Verify:** real fifteen-tool listing, task/agent/source/version/submission IDs, visible Inbox transitions, actual structured candidates/evidence, approval, fresh-session retrieval, unrelated/private-source denial and revocation. Record real vs controlled evidence separately; no source text or token in logs.
- **If it fails:** preserve source/task/candidate records; release or let lease expire, then resume in a later authorized session. Do not add an AI API as fallback or launch another paid/background agent. Restore only task-owned unsuccessful client config changes if necessary.

### Proposed Codex configuration, not installed

S23 creates `scripts/start-mcp.ps1`. It reads `.local/atlas-agent-token.clixml` using the owner's Windows DPAPI context, puts plaintext only in its own child process environment, validates loopback API URL, launches the built node MCP server without a window or diagnostic stdout, then clears the environment on exit. The owner creates the SecureString file manually; neither plan nor repo contains the token. Do not alter Windows execution policy to run the launcher; if policy blocks it, report that specific setup issue.

The following TOML is copy-ready syntax with actual local paths but requires the built launcher and owner configuration. It does not itself provision credentials. Preserve unrelated entries when installing into the owner's active client configuration, and verify its current official config contract first:

```toml
[mcp_servers.atlas]
command = "powershell.exe"
args = ["-NoProfile", "-NonInteractive", "-File", "C:/Users/user/Desktop/Personal AI-Knowledge Vault - NeuralVaultYKT/scripts/start-mcp.ps1"]

[mcp_servers.atlas.env]
ATLAS_API_URL = "http://127.0.0.1:4317"
```

No database/S3 credential or AI API key is included. The active client configuration path must be inspected at installation time; this plan is not permission to edit `C:\Users\user\.codex\config.toml` or another global file during local scaffolding.

## 10. Acceptance and verification matrix

Each row is required for P0 unless labeled deferred or measurement-only. Run commands from the project root. Fixture tests are necessary but do not establish actual cloud/client organization. Test evidence must identify its category: static/typecheck, deterministic fixture, local real database, live dedicated Neon, or actual agent/client/browser interaction.

| Requirement / scenario | Setup/input | Steps and check | Required outcome / regression |
| --- | --- | --- | --- |
| Starts/builds cleanly | Installed exact dependencies; valid config | S02–S04; install/typecheck/lint/format/build/unit | No type/build errors; no hidden stubs or secrets in browser bundle |
| Auth and owner restriction | Correct owner, unrelated user, invalid/expired JWT | S07/E02; auth integration + real login/reload/sign-out | Owner only; server denies directly; disabled user loses vault access |
| Persistence after restart | Saved project/note/source/memory | S08–S09/S23/E02; terminate/restart and reload | Same IDs, content, history and original hash |
| All seed collections | Fresh workspace; seed run twice | S05/S08; DB tests | Exact nine families/children from brief, no duplicates or hard limits |
| Collection CRUD/reorganization | Rename/nest/archive/merge; cycle/collision | S08; DB/E2E | Intentional conflict handling, no lost memberships/tree/history |
| One item, several collections | Assign note to three collections | S05/S08/S10; DB/E2E | One canonical item and three membership rows |
| Original and versions preserved | Raw Markdown/Unicode/code; later edit | S09–S10/E02; byte hashes and immutable version test | Original bytes unchanged; normalized citations honest |
| Reliable saves/concurrency | Concurrent expected_revision; failed network | S10; E2E | 409 compare/retry; no silent overwrite or unsaved loss |
| Upload safety | Fake binary, script HTML, path filename, >2 MiB | S10–S11; security tests | Reject/sanitize safely; no code/remote resources execute |
| Sensitive content / agent-delivery gate | Synthetic credential/private key | S11/S15; task read/submit/log tests | Saved privately; no ungranted delivery or secret snippets; source version release explicit |
| URL SSRF defense | Redirect/private/mixed DNS/rebinding/IPv6/oversize | S13; controlled security fixture | No unsafe network connection or decompression overrun; manual alternative |
| Existing agent organization actually works | Small permitted fictional source batch | S15–S16/E03; real client claim/read/submit + schema tests | Actual authenticated agent submission/classification, estimates labeled; no standalone AI API |
| Manual inclusion/exclusion wins | Owner removes AI assignment then reprocesses | S16; DB/E2E | Negative override survives and prevents re-add |
| Interrupted/absent agent never loses sources | Agent stops, lease expires, invalid payload or no client | S09/S14–S16; fault injection | Originals/results intact, Awaiting agent/retry honest, no model-service fallback |
| Durable deterministic recovery | Crash after job stage; two workers | S14; local DB/process tests | Fenced lease prevents stale writes; one chunk/index result; originals intact |
| Agent claim/submission idempotency | Two claimers, rotated lease, lost submission reply | S15–S16; concurrent DB/MCP tests | One current claim/result; same payload replay returns same IDs; changed payload/revoked grant denied |
| Structured reviewed memories | Five types, inferred/unverified candidate | S16–S17; lifecycle/E2E | Persistent typed records; inference never automatically active/verified |
| Source evidence/access | Fabricated span or newly private supporting source | S06/S17/S19; security tests | Reject invalid evidence; no summary/citation leakage after restriction |
| Current vs historical decisions | Firebase old / Neon new demo decision | S17/S19; temporal/supersession tests | New active fact by default; labeled history retained; concurrent conflict safe |
| Keyword/alias/stored-graph retrieval | Exact path/symbol, approved alias and related item | S12/S18–S20; evaluation | Accurate deterministic matches/authorized graph expansion; no vector/semantic claims or calls |
| Search materialization freshness | Source edit/approval/supersession/late worker | S18; local DB tests | Current approved revisions only; stale/partial summaries labeled or excluded |
| Retrieval quality | >=20 labeled queries with required facts | S20; test:evaluation | >=90% eligible queries contain required fact in top 5; critical coverage 100%; private/stale default leaks 0 |
| Budget completeness | Unicode/escaping, critical overflow, large source | S19; property/contract tests | Final serialized measure fits or explicit BUDGET_INSUFFICIENT; never silent critical omission |
| MCP server connection | Actual built stdio process + SDK client | S22; test:mcp | All fifteen tools callable; no stdout contamination; input/scope/lease validation enforced |
| Fresh actual Codex session | Real configured client; old chat terminated | S23/E03; two new chats | Correct preserved knowledge and approved proposal retrievable without chat history |
| Scope/credential isolation | 2 owners/projects/agents; five scope types | S06/S21–S23; test:security/E02 | All forbidden reads/proposals/sources/graphs/traces denied; counts also scoped |
| Revocation | Token revoked between requests/continuation | S21/E03; auth/continuation tests | Next operation fails, including saved handles; no cached permission |
| Proposals remain reviewable | Agent submits all three proposal kinds/replays key | S17/S22–S23; DB/MCP/E2E | One pending proposal; owner-only approval; no direct supersession |
| Real graph | Fixture/API-backed persisted nodes/edges | S24–S25; API assertions + browser | Every edge/endpoints reference real allowed records; accurate inspector |
| Stable graph interaction | Reload/select/filter/fit/reset/expand/unmount | S25; actual browser | Layout stable, worker settles/stops, no leaked handlers or blank failure canvas |
| Mobile/accessibility | Viewports/zoom/keyboard/WebGL fallback | S26; E2E/axe + visual | Readable no-overflow routes; graph alternative; focus/contrast/touch/reduced motion verified |
| Trace/change honesty | Known trace; revoke one included item | S27; DB/browser | Recorded selections only, unauthorized detail redacted, no invented live state |
| Data ownership/recovery | Export + separate-target restore | S28; fixture and authorized actual backup test | Original bytes/IDs/evidence/history restored, missing components detected, no secrets exported |
| Development records | Actual final code/checks | S01–S30; document audit | Phase/tasks/issues/results current; no untested task called Completed |
| No known critical defect | Full P0 security/functional findings | S29–S30; review all failed verification | All critical defects fixed; limitations and pending live gates explicit |
| No separate AI API dependency | Dependency/config/runtime inspection | S02–S03/S29 | No provider SDK/key/model endpoint/cost ledger; core data flows work with only Neon + local backend/client |
| Inbox waits honestly | Saved source, no agent running | S10/S14–S16/E03 | Awaiting agent, no fabricated classification, no autonomous agent launch; saving/search still work |
| Private processing-only isolation | Explicit personal-source version grant | S06/S11/S15/S21/E03 | Task can read assigned batch; ordinary search/read_source/private memory/history remain denied |
| Whole-document coverage | Source larger than 20 chunks | S15–S18; batch/review tests | Multiple resumable tasks, no organized state or whole-source summary from first batch alone |


### Prescribed final check order

Run each separately in PowerShell and inspect exit status. Tests with a missing external setup are reported pending, not passed or silently skipped.

```powershell
Set-Location -LiteralPath 'C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT'
```

```powershell
pnpm install --frozen-lockfile
```

```powershell
pnpm typecheck
```

```powershell
pnpm lint
```

```powershell
pnpm format:check
```

```powershell
pnpm build
```

```powershell
pnpm test:unit
```

```powershell
pnpm test:db
```

```powershell
pnpm test:mcp
```

```powershell
pnpm test:security
```

```powershell
pnpm test:evaluation
```

```powershell
pnpm test:e2e
```

```powershell
pnpm test:performance
```

Then perform the described browser and live checks whose authorization/setup gates are satisfied. Do not rerun a broad suite after nothing changed merely to increase test counts.

### Performance and quality measurement

Use the 100/1,000/5,000 synthetic-item corpora. Record actual CPU/RAM, OS, browser, active rendered node/edge count, database topology, query plan and warm/cold distinction. Provisional P0 targets for this PC: warm local-fixture retrieval p95 <=1,000 ms across 50 fixed queries; initial 500-node/2,000-edge graph usable within 3 seconds; layout worker stops within 2 seconds; selection/inspector responds within 200 ms; p95 pan frame <=33 ms after settling. At 5,000 stored nodes, APIs still cap responses/expand progressively and never render the entire dataset automatically. Zero leakage, complete successful critical constraints and valid budgets are hard correctness thresholds.

Neon network/cold-start and actual agent task elapsed time is measured and reported separately, not asserted to match local-fixture timing. Establish baseline first. If provisional UI/timing targets are unsuitable, document hardware/profile evidence and a reviewed revised budget before release rather than silently weakening checks. Token savings require supported tokenizer or actual client measurements plus correctness comparison; no separate provider API is needed or allowed for P0 evaluation. The conservative byte measure alone is not evidence of actual savings.

## 11. P1/P2 follow-on backlog

Do not start these automatically to fill an implementation session. Each needs its own scope selection after P0 is reliable. They are excluded from the initial MVP completion claim, but preserve the source brief's full direction.

| ID | Priority / prerequisite | Exact proposed targets and bounded next work | Verification / failure boundary |
| --- | --- | --- | --- |
| P101 | P1; S28/S29 | `core/knowledge/parsers/pdf.ts`, parser worker, upload controls; use PDF skill, pin parser, 20 MiB initial file limit, page/offset provenance and extraction time/memory limits; scanned docs explicitly unsupported until OCR chosen | Fixture encrypted/malformed/large/text PDFs; preserve original; no false OCR claims or arbitrary file execution |
| P102 | P1; S11/S16/S28 | `core/knowledge/parsers/n8n.ts`; import supplied workflow JSON as inert knowledge: names/node types/connections/version metadata, source spans and credential-reference redaction | Reread automation workspace AGENTS/Documentation/Skills INDEX and official matching skills; never import/run/publish a workflow into n8n or rewrite original exports; no `$env`/`$vars`; no credential values to AI |
| P103 | P1; S13/S28 | `core/knowledge/parsers/directory.ts`; owner-select explicit directory, read allowlisted text/Markdown only, exclude .git/dependencies/secrets/build; enforce total/item limits, no symlink/reparse-point escape | Fixture traversal/reparse/ignore/secret cases; no unattended scans outside chosen directory |
| P104 | P1; S17/S28 | `core/knowledge/parsers/conversation.ts`; supported exported conversation schema with turn timestamps/actors, user selection and review; no indiscriminate auto-recording | Authentic export fixtures, malformed/unsupported format, secret quarantine; extraction never assumes every agent assertion is fact |
| P105 | P1; S17/S20 | `core/memory/contradictions.ts`, owner comparison UI; subject/version/evidence candidates, side-by-side resolution and manual supersession | Conflicting vs compatible facts, private scope, concurrency; no AI automatic canonical replacement |
| P106 | P1; S25/S27 | Detailed trace view and optional graph clustering worker; record rank reasons/retrieval costs, aggregate only allowed nodes, profile before extra algorithms | Real trace-to-item mapping, revoked access, useful controls/legend; no generated paths or permission leaks |
| P107 | P1; S08/S16/S28 | Batch operations/collection suggestions/keyboard commands; explicit per-item validation and partial-failure report, accessible command palette | Transaction/retry/undo/keyboard tests; batch access cannot bypass item checks |
| P108 | P1; S28/S29 | Backup scheduling design and measured collection/memory analytics; counts derived from actual permitted records | Restore rehearsal and metric provenance; recurring job/automation requires explicit request, no auto scheduling |
| P201 | P2 | Native GitHub synchronization; separate repo/token/branch/permission/refresh/conflict design | Read-only before sync writes; explicit source selection and budgets |
| P202 | P2 | Remote MCP OAuth/transport and multi-agent collaboration; separate threat/hosting design | No unauthenticated endpoint or public tunnel; least privilege and actual client tests |
| P203 | P2; separate owner request required | Temporal graph playback, source refresh, lifecycle analytics, advanced compression and spatial organization | Preserve evidence/correctness; a future local embedding/model option needs explicit new scope. No AI API/semantic vectors are silently reintroduced. |

The user's n8n credential names remain relevant only if a separately authorized future workflow connection is built: Arjay - Gmail; Arjay- Sheets Credential; Arjay - Gdrive; Arjay - Docs; Arjay - Claude; Arjay - SMTP. Client workflow naming follows the automation workspace's conventions. P102 is an inert file parser and needs no live n8n credential.

## 12. Recovery and deterministic stop conditions

- Reinspect before editing. If application code, a different framework, existing auth/database, new AGENTS instructions or user changes now exist, do not overwrite them to force this greenfield plan; report the actual delta and revise the affected steps.
- Dependency line-number/export drift may be adapted only when the same verified contract remains intact. A changed Auth/MCP or organization contract, unsupported Neon service/region, or inability to create restricted roles/RLS is a material design issue, not permission to choose a replacement platform.
- Source/evidence access failure, stale-principal connection reuse, credential disclosure, missing original bytes after acknowledged save, silent loss of critical constraints, or unauthorized canonical mutation stops dependent feature/release work until fixed.
- If external target identity, current authorization, credentials or owner subject is missing, leave that E-step pending. Continue independent local implementation/tests; do not fabricate values, create a claimable database, use another project, broaden grants, or substitute test outputs for live results.
- Keep a manifest of task-owned changed/new files and actual cloud resources. Revert only task-owned edits after inspecting current changes; no `git reset --hard`, unscoped clean, recursive deletion, global process shutdown or shared Docker cleanup.
- Local test reset may affect only the explicitly disposable `atlas_test` test schema/fixture. Preserve named volumes and user data by default. Deleting a Neon branch/project, purging source objects, destructive restore, permanently deleting knowledge or removing credentials outside this task requires its specific user authorization.
- Failed migration rolls back its transaction; applied live migrations are corrected forward. Failed S3 finalization stays pending and reconciles by exact generated keys; interrupted agents retain originals/tasks/submissions and expired claims resume. Failed lexical refresh leaves source/evidence and approved memory intact. Failed graph UI retains search/list access. Failed main cutover keeps the previously validated branch/config.
- Archive/delete/restore must show affected evidence and access consequences. A database backup without source objects is incomplete; a copied Neon branch is not proof of a successfully restored application.
- Stop a checkpoint only after a diagnosed task-scoped remedy is unavailable or would exceed authorization; do not repeatedly apply unrelated patches. Record error/reproduction/target/result and the smallest required input.

## 13. Verified primary references and design rationale

Current documentation was read 2026-10-16. Recheck applicable APIs at execution time. These references support platform contracts; the data model, limits, defaults, UI values and phase sequencing in this plan are proposed engineering decisions, not vendor guarantees.

- [Neon connection methods](https://neon.com/docs/connect/choose-connection): local long-running Node can use `pg`; pooled application/direct migration separation is intentional. [Pooling](https://neon.com/docs/connect/connection-pooling) is an executor preflight reference, not a claim that the actual new project's URLs already exist.
- [Neon React Auth](https://neon.com/docs/auth/quick-start/react) and [JWT verification](https://neon.com/docs/auth/guides/plugins/jwt): managed identity, client token and branch issuer/JWKS; application permissions remain separate.
- [Neon backend overview](https://neon.com/docs/get-started/backend-overview), [storage setup](https://neon.com/docs/storage/get-started), [storage authentication](https://neon.com/docs/storage/authentication), and [S3 compatibility](https://neon.com/docs/storage/s3-compatibility): branch-specific private originals and path-style SigV4 client. Storage/Auth setup is a future authorized operation.
- [PostgreSQL 18 full-text search](https://www.postgresql.org/docs/18/textsearch.html), [pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html) and [official PostgreSQL image](https://hub.docker.com/_/postgres): deterministic lexical/trigram retrieval and isolated local database. pgvector/embeddings are excluded from P0.
- [Skills/MCP workflow guidance](https://developers.openai.com/plugins/concepts/skills) and [MCP tool boundary](https://developers.openai.com/plugins/concepts/mcp-server): existing agents supply reasoning through controlled tools; workflow instructions do not grant data authority. No OpenAI API integration is part of the revised plan.
- [MCP SDK v2 first server](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server.html) and [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli): pinned server packages, stdio tools and actual client setup gate.
- [Vite guide](https://vite.dev/guide/), [Hono Node guide](https://hono.dev/docs/getting-started/nodejs), [Tiptap Markdown installation](https://tiptap.dev/docs/editor/markdown/getting-started/installation), [Sigma quickstart](https://www.sigmajs.org/get-started/quickstart/) and [Graphology ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2.html): local typed apps, portable editing, explicit renderer lifecycle and bounded worker layout. Tiptap Markdown documentation currently labels that integration beta; immutable originals and round-trip checks are required.
- Interaction references reviewed: [Obsidian Graph view](https://obsidian.md/help/plugins/graph) for local/global views and connected highlighting; [Cosmograph](https://cosmograph.app/) for canvas space and useful filtering; [Heptabase organization](https://wiki.heptabase.com/organize-knowledge-and-projects) for compact topic/project hierarchy; [InfraNodus concept exploration](https://infranodus.com/tutorial/create-your-first-knowledge-graph) for node-to-source inspection. This plan uses its own UI tokens and stores evidence-backed relations instead of importing a product's appearance or treating co-occurrence as fact.
- Package pins/engines/peers were inspected through the public [npm registry](https://registry.npmjs.org/). There is no installed lockfile yet; metadata compatibility is not a passing installation/build test.

## 14. Copy-ready executor prompt

This prompt is a local implementation request only when the owner sends it for execution. Cloud/client writes follow the actual authorization in that execution chat.

~~~text
Implement the local P0 ATLAS / NeuralVaultYKT application from:
C:/Users/user/Desktop/Personal AI-Knowledge Vault - NeuralVaultYKT/docs/plans/2026-10-16-atlas-implementation-plan.md

Root:
C:/Users/user/Desktop/Personal AI-Knowledge Vault - NeuralVaultYKT

Use Light / low reasoning. Read the whole revised handoff, preserved source brief
and applicable AGENTS.md. Revision 2 overrides the brief: connected existing
agents do classification/extraction/summaries via MCP. No separate AI API,
provider SDK, API key, model service, AI cost ledger, embedding/vector search
or autonomous agent launcher belongs in P0. Retain the local data backend and Neon.

Reinspect current files/instructions/Git state before edits; preserve user work
and both planning artifacts. Start S01-S04/C0, then S05-S14, then early S21
(agent credentials), then S15-S20, S22-S30 in dependency order. Build persistence,
source evidence, safe task grants and correct retrieval before graph polish.

Keep TASKS/PROGRESS/DECISIONS/ISSUES/SESSION_LOG/TEST_REPORT/ARCHITECTURE and the
handoff checklist current. Mark Completed only with observed verification.
Distinguish fixture/local DB/live Neon/actual agent-client/browser evidence.

Use fictional clinic sources and the isolated local test DB. Deterministic jobs
normalize/chunk/index; organization tasks wait for an owner-authorized connected
agent. Implement fifteen MCP tools and the project-local workflow instructions.
Do not pretend that saving a note starts Codex or that task delivery proves the
agent's findings. Personal-source processing grants remain separate from normal
memory visibility. Preserve manual overrides and owner-only fact approval.

Run every applicable checkpoint. Missing cloud/client authorization blocks only
its dependent E01-E03 operations; continue independent local work. Do not create
cloud resources, migrate Neon, install global MCP settings, broaden grants,
permanently delete, publish/deploy/send, commit/push, register startup tasks, or
launch/message another agent/chat unless the current user explicitly authorizes
that action. Never use Tech-Trends or Sinta Wedding as a fallback.

Stop dependent work on material target/API drift, missing essential setup,
insufficient authority, an isolation/evidence/lease/context-budget failure, or
a checkpoint without a diagnosed scoped remedy. Preserve sources and record the
smallest blocker; never restore a provider dependency to work around it.

Finish with compact DEVELOPMENT STATUS: phase, verified tasks/features, changed
files/resources, test counts/results, issues/blockers, unfinished steps, next task.
MVP completion requires real Neon/Auth/storage, actual agent organization and
fresh-client retrieval, browser usability, security and recovery evidence.
~~~
