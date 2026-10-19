# Owner-dependent setup — deferred, not blocking local implementation

L01 now supersedes normal cloud storage/Auth gates: local Vault/ and the file graph are working without a Neon account session/database. The cloud binding/browser acceptance items below describe the previous architecture and do not block the local workflow. Historical cloud data/resources remain preserved. Current evidence: LOCAL_VAULT_REPORT.md.

Current 2026-10-17 status: N02 infrastructure, N03 actual owner binding and A01 global Codex/MCP project-checkpoint integration are complete. Personal browser acceptance and broader vault features remain pending. Historical pending rows below are superseded by these updates; synthetic fixtures never select the owner.

| Deferred item | Prepared work | Remaining evidence / input |
| --- | --- | --- |
| Actual vault owner | Completed N03: genuine-JWT receipt/managed profile matched and exact identity bound | Binding is complete; personal browser acceptance remains separate. No synthetic/first visitor enrollment. |
| Domain schema on Neon | Completed through A01:18 migrations/42 RLS tables/restricted roles after rehearsal | Future migrations still require a matching rehearsal receipt. |
| Live owner acceptance / C1 | Local signed JWT + real PostgreSQL + browser flow, separate-process persistence | Real bound owner signs in, reloads, edits persistent organization and signs out on the actual branch. N01 Auth diagnostics alone do not satisfy C1. |
| Private originals storage / E01–E02 | Completed N02 infrastructure: private atlas-sources, app health probe, real PUT/HEAD/GET byte-exact test and anonymous403 | Source capture/staged reconciliation/editor remain S09/S10 product work; bucket provisioning is complete. |
| MCP client registration / E03 | A01 complete: scoped identity, 3 stdio tools, global instructions/registration and real Neon fresh-MCP-process retrieval | Full fifteen-tool product/fresh autonomous Codex chat acceptance remains future work. No AI launcher installed. |

Live infrastructure evidence is in NEON_DOMAIN_SETUP_REPORT.md. Continue source/product implementation; actual owner binding/C1 remains deferred without asking for details now. Keep this list current as later services become reviewable.


## N03 update — actual owner binding completed

The owner completed the instructed sign-in and Test database connection flow, then requested continuation (Done). Inspection found one newly verified non-synthetic account. Setup explicitly selected that account and joined its managed Auth profile to the server-written genuine-JWT receipt on this exact branch. A maximum10-minute, unambiguous matching proof was required; no password/token was requested or read. The administrative setup command, not a public/first-visitor route, bound the account and seeded72 collections atomically.

Binding is no longer deferred. Owner issuer/subject metadata is in ignored .env.local. Restricted atlas_api resolves exactly one own workspace/72 collections and rejects an unrelated identity. API restarted with binding. The connected in-app browser is signed out; actual personal workspace UI acceptance remains pending refresh/sign-in in the user's browser. Historical pending-binding rows above are superseded by this update. No test account promoted; no credentials or raw JWT stored.
