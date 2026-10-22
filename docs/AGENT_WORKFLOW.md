# Automatic project knowledge

Personal workflow (P02): atlas_personal_context works without a repository. atlas_personal_skills returns metadata first and requires an expected digest for bodies. Scan/review tools page inventory, claim a lease, acknowledge original owner-message pages and complete with verified references or no-value/candidate/failure outcomes. Personal capabilities and host grants are independent of project tools. See CODEX_GLOBAL_INSTRUCTIONS.md and PERSONAL_MEMORY_ACCEPTANCE.md. Native memories remain separate; tool attempts never establish complete coverage.

## Local domain tools — 2026-10-18

Fresh MCP processes expose eighteen tools. The original `atlas_start_project`, `atlas_save_checkpoint` and `atlas_project_context` retain K01 agent-recorded knowledge behavior. Project context can additionally return an optional `reviewed_context` packet when the owner explicitly gave that compatibility agent domain read access for the project. Its serialized size shares the existing character budget; insufficiency is explicit. Reviewed facts and automatic agent-recorded notes retain separate provenance. The fifteen additive tools support bounded retrieval, proposals and explicitly granted processing tasks. Tool availability grants no new permissions.

Create named agents through the owner workspace and select capabilities, scopes, project grants and expiry; store the one-time credential securely. The installed compatibility credential remains narrow. Private processing requires a grant for the current source version, a live lease, delivered chunk coverage and exact evidence. Editing the source or revoking access fences old tasks. Private processing grants do not enable general search. Owner review controls approval; confidence remains agent-reported. No model SDK/key, automatic agent process or cloud knowledge service is used. Restored vaults disable old credentials and grants; see BACKUP.md.

## Current K01 capture workflow — 2026-10-17

The three existing tool names now support optional knowledge metadata and knowledge/activity context selection. Capture reusable subjects only; routine completion logs are not the default. Owner/project scope, evidence basis, applicability, known exceptions and explicit prior-ID/file-digest replacement protect useful context. New local fields do not change the historical cloud contracts. Summary context links to full Markdown; older chats can use the updated protected helper or direct template. Read KNOWLEDGE_CAPTURE_POLICY.md, CODEX_GLOBAL_INSTRUCTIONS.md and KNOWLEDGE_QUALITY_REPORT.md. Older A01/L01 evidence below is dated history.


Current L01 amendment: normal operation now uses local Markdown under Vault/, directly accessible to agents/Obsidian. Global instructions and the three tool names are retained, backed by local file services. No normal Neon/Auth/storage requests or knowledge writes. This supersedes the historical A01 cloud details below; see LOCAL_VAULT_DESIGN.md and LOCAL_VAULT_REPORT.md. Use rg --files --hidden --no-ignore for this intentionally Git-ignored vault, excluding .atlas/.obsidian metadata when searching knowledge.

Owner request A01, 2026-10-17: agents register projects, load context and retain useful knowledge without asking the owner to fill forms. No separate model/API account is involved.

## What agents do

`atlas_start_project(repository_path)` finds/creates a project and retrieves recent checkpoints. Git SSH/HTTPS origins normalize to a credential-free identity; local worktrees use their shared Git directory; non-Git projects use the canonical directory. Only a SHA256 identity and display name reach the API. Names alone never cause adoption of unrelated projects. Moving a folder without a Git remote/shared directory changes its identity and can require a later owner-assisted binding.

`atlas_project_context` retrieves recent or literal matching checkpoints under a character budget. `atlas_save_checkpoint` records concise decisions, lessons, progress and handoffs with relative evidence paths and verification. Saves append immutable records. Request-key receipts prevent conflicts/retries; identical content deduplicates even with another request key. Existing archived projects and revoked grants are not restored by ensure.

The app's project view displays these records under “Saved by your agents.” Agent-recorded text remains historical evidence, never instructions or verified canonical memory. No automatic fact approval or broad personal/global sharing was added.

## Runtime and access

Three stdio MCP tools use the loopback API; MCP has no SQL/S3 client and never loads .env.local. A dedicated Codex agent has read/manage_projects/capture_checkpoint operations for 90 days. New repository projects get explicit project read/propose grants atomically. Existing grants are checked on every call. The credential is stored as a digest server-side and as Windows DPAPI ciphertext in ignored .local/atlas-codex-token.clixml. config.toml holds only a launcher command. The launcher starts the fixed-loopback API on demand; no AI launcher, scheduled task or Windows startup installation.

Migration 0017 adds three RLS tables: private repository bindings, public immutable checkpoints and private request receipts. Fixed-path private functions authorize narrow metadata mutations; raw private tables remain inaccessible to runtime roles. Existing project/knowledge permissions remain in force. Checkpoints are a small structured SQL feature; full source ingestion/object reconciliation remains S09.

Predictable credential/private-key patterns and secret evidence paths are rejected before persistence. This is a defense in depth filter, not complete secret detection; agents must only submit concise safe project knowledge. Stored text is rendered as plain text, never executable Markdown/HTML.

Global instructions are maintained in CODEX_GLOBAL_INSTRUCTIONS.md and installed additively in the user's Codex home. Other hosts can use the same MCP server and equivalent instructions after their own configuration; global Codex AGENTS does not configure every agent product. Updated instructions/tool discovery load in a fresh Codex run; a scoped CLI helper covers chats with older inventories.

## Recovery

When unavailable, continue useful work and save a secret-free local pending checkpoint only when local writes are allowed. Retry at a natural checkpoint and claim persistence only on success. Credential expiry/revocation requires setup attention; never auto-enroll to override revocation. Re-run setup-codex-agent.ts only during authorized setup, and preserve unrelated registrations/global instructions.

## Verification

See AGENT_WORKFLOW_REPORT.md for actual commands, outcomes, failures and remaining limits. Do not infer live behavior from unit fixtures alone.

References: [Codex global AGENTS discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [official MCP v2 server](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server).
