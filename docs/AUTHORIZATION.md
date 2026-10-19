# S06 authorization — local implementation

L01 current mode is a single-user local file vault. The loopback API uses session cookies/Host-Origin checks and a protected local transport credential, while direct file access follows Windows permissions. No claim of SQL RLS restrictions over arbitrary filesystem agents is made. The cloud model below is preserved historical compatibility code; its policies were not relaxed and normal local runtime does not connect to it. See LOCAL_VAULT_DESIGN.md.

Verified against actual PostgreSQL18.6 logins in isolated atlas_test and authorized Neon production. Current A01 deploys migrations0000–0017/42 RLS tables after rehearsal; N03 actual owner binding is complete. Personal browser acceptance remains pending. No domain route accepts caller-supplied principal/JobContext. See NEON_DOMAIN_SETUP_REPORT.md and AGENT_WORKFLOW_REPORT.md.

## A01 narrow project/checkpoint capabilities

manage_projects permits atomic new-repository project/binding/grant creation only. Existing projects require the current read grant; ensure never restores revoked access or unarchives a project. capture_checkpoint plus read/propose on that registered project permits append-only agent-provenance notes. Runtime roles cannot read repository/credential/request private tables directly. Private fixed-path metadata functions validate active/unexpired credentials and owner/workspace state. Checkpoint RLS requires the current workspace and explicit project access; another agent cannot read/write a known project UUID. Owner can read the notes through normal verified identity. These capabilities do not approve canonical memories or grant personal/global scope.

Installed Codex has only read/manage_projects/capture_checkpoint, not owner/JWT/admin credentials. Raw token is DPAPI-protected; SHA256/prefix/expiry are stored server-side. MCP calls loopback HTTP only. Credential/grant revocation, expiry, missing capability, immutable notes, retries and mandatory context are verified in the73-case SQL/HTTP/MCP suite.

| Principal | Read | Mutation |
| --- | --- | --- |
| Human owner | Own enabled membership/workspace, matching verified issuer/subject | Own workspace rows with actual creator; immutable history/provenance still enforced |
| Agent | Active, unexpired credential plus explicit project/scope/item grant; personal scope denied | Pending proposals and own task submissions only; no canonical approvals or ACL edits |
| Processing purpose | Named current source version, actual claimed agent, matching unexpired task lease, allowed catalog, live grant or ordinary read+process authorization | Own submission only; assigned chunks available, full source-version payload and old memory snapshots denied |
| Worker | Actual atlas_worker session, live processing job, exact workspace/source version/lease token | Job-scoped chunks/search/results/activity and source processing state; no memory approval or credentials |

An agent's operation must be present in both its credential and relevant grant. Agent-private rows additionally require matching owning agent. Project grants require an unarchived project. Missing/malformed context denies access. Disabled owners/agents, deleted workspaces/items, revoked/expired credentials, revoked/expired processing grants and stale task revisions are checked in SQL.

Memories/entities require nonempty evidence and access to every supporting current source version. Relationships also require both endpoints. Memories/relationships must be active and temporally valid; memories requiring revalidation are hidden. Source quarantine blocks ordinary agent reading. Collections/tags/search/traces use these same item predicates before database counts or ranking. A trace contains IDs/revisions and query hash, not source text; a still-authorized source's trace metadata can remain readable after a version switch, while old evidence-derived content/search documents disappear. Prior complete memory snapshots are owner-only.

Every public child table has a restrictive workspace boundary in addition to its permissive policy. This matters because UUIDs are unique within a workspace, not globally; the tests deliberately reuse one source UUID across two owners.

Private ACL tables are never granted to API/worker. Metadata-only SECURITY DEFINER helpers use NOLOGIN atlas_owner and an empty fixed search_path with fully qualified relation/function references. They intentionally inspect private metadata outside recursive item RLS; they do not return knowledge bodies or credential digests. PUBLIC execution is revoked. Only the worker can execute queue claim/heartbeat/finish functions. The owner role is neither superuser nor BYPASSRLS; it owns the tables. Runtime roles cannot SET ROLE to it.

withPrincipal sets transaction-local identity, credential and issuer/subject and clears job/task context. withProcessingContext hashes the raw task lease and sets only a scoped purpose. withJobContext is separate from public Principal and requires the actual worker login. Context settings are a trusted backend boundary, not an authentication mechanism: future routes must derive principals from verified JWTs/credentials and never expose arbitrary SQL or accept identity settings from clients.

Worker claim uses FOR UPDATE SKIP LOCKED, a fresh token and a 120-second lease. Heartbeat and finish require matching context/token/current lease. Finishing clears the lease; bounded requeue delays are 5/30/120 seconds with four attempts maximum. Source version switches and cancellation are rechecked on later statements, including within an open transaction. Lease recovery/scheduling and deterministic processing remain S14; task claim/renew services remain S15.

Run pnpm db:test:start, pnpm test:db, pnpm test:security; stop with pnpm db:test:stop. The scripts accept only loopback atlas_test:55432 with the exact local target marker. The authorization fixture truncates only that disposable database. Passing these checks does not establish HTTP, production, concurrency, MCP or full release acceptance.

