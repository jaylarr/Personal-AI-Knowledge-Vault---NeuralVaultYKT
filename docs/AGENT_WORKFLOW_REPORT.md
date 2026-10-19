# A01 — automatic Codex project knowledge

2026-10-17, Asia/Taipei. Completed for this focused workflow.

The owner asked Codex to create missing ATLAS projects and retain useful project knowledge automatically. Implemented and installed the scoped API/MCP connection and global instructions. No separate AI API/key is required.

## Changes

- Three MCP tools: atlas_start_project, atlas_project_context and atlas_save_checkpoint. Repository matching normalizes SSH/HTTPS remotes, shares local worktree identity, and falls back to the canonical folder. Only an identity digest/name reach the loopback API.
- Migration 0017 creates repository bindings, immutable agent checkpoints and private retry receipts. Creation/binding/grants are atomic; revoked grants and archived projects are not restored. Every checkpoint retains agent/time/evidence/verification. Duplicate content reuses a record; every retry alias is checked for conflicting content.
- A dedicated limited Codex identity has read/manage_projects/capture_checkpoint operations. Credential expiry: 2027-01-15. Raw credentials use Windows DPAPI locally and SHA256 server-side. MCP has no database/S3 client or admin credentials. Known secret patterns/evidence paths are rejected before storage.
- Global Codex AGENTS guidance and MCP atlas registration installed, preserving the n8n instructions and seven existing servers. Re-running enrollment/installation preserved existing identity/configuration. The fixed-loopback API starts on demand; no Windows startup service/task or AI launcher.
- Project view shows “Saved by your agents.” Manual forms open only when requested. Plain text rendering keeps stored Markdown/HTML inert.

## Actual verification

| Command | Outcome |
| --- | --- |
| pnpm test:unit | 8 files / 76 tests passed, 4.67s |
| pnpm test:db | 5 files / 73 tests passed, 36.80s; isolated local PostgreSQL only |
| pnpm test:owner-browser | 2 controlled signed-owner browser tests passed; final 12.7s |
| npm run build | Exit 0; 2345 modules; Vite 2.35s |
| pnpm typecheck / lint / format:check | Passed; strict TS/skipLibCheck=false; final lint 98 / format 97 files |
| pnpm verify:bundle | 5 browser JS bundles; no server-only markers |
| pnpm neon:setup:domain rehearsal | 1 new migration; checksums/isolation/private credential denial passed; 42 owned RLS tables |
| pnpm neon:setup:domain production | Matching rehearsal required; 1 new migration; 42 owned RLS tables / restricted API/worker verified |
| scripts/setup-codex-agent.ts | Limited identity enrolled and Windows-protected. Rerun preserved enrollment. |
| scripts/install-codex-workflow.ps1 | Global registration/instructions installed. Rerun passed without duplication. |
| scripts/atlas-launch.ps1 -Action start | Started previously stopped API on demand and registered this actual repository in Neon |
| scripts/verify-codex-workflow.ts | Installed MCP discovery/save/retry/fresh-process retrieval passed |

151 distinct automated cases passed: 76 unit +73 local SQL/HTTP/process +2 controlled browser. The separate installed-MCP acceptance script also passed. Older offline-browser/Auth/storage results are historical, not relabeled as rerun.

```text
PASS: installed Windows launcher exposes all 3 MCP tools from an unrelated working directory.
PASS: real Neon project registration + checkpoint save + duplicate retry.
PASS: a fresh MCP process finds the same project and retrieves the persisted checkpoint.
```

Live target: org-floral-darkness-38230607 / misty-fire-28366774 / production br-withered-recipe-azwll09c. All 18 migrations recorded. Rehearsal br-little-wave-az86ax08 expires 2026-10-18T04:00:00Z. No other Neon project changed. Actual ATLAS repository project: 6b650cd7-c14c-47f5-b41b-31aaf9ef48bc; first workflow checkpoint: 81a53782-af09-46e0-b6c0-1bc722b2ef37. Secret-free receipts are ignored under .local/.

Cases cover concurrent ensure, real agent provenance, save/read under non-owner login, content/retry deduplication and conflicts, immutability, human owner visibility, missing capabilities, another agent's known-UUID denial, secret rejection, revoked grants, archive preservation, workspace context and expired/revoked credentials. A real SDK client verifies local process replacement as well.

Controlled browser desktop1440px/mobile390px screenshots were inspected; 320px reflow, enlarged text/reduced motion, sign-out clearing and disabled-owner cache hiding pass. Auth responses are intercepted for signed local fixtures: this is not personal browser acceptance. Evidence: .artifacts/owner-browser/agent-knowledge-desktop.png and agent-knowledge-mobile.png.

## Corrected failures and limits

- First test-container approval review timed out; its single retry succeeded. Sandbox denied temporary Git initialization; the authorized unit run passed. A standalone sandbox loopback diagnostic was denied; the authorized integration suite is the actual DB evidence.
- First new SQL suite failed before feature checks on a fixture parameter inferred as UUID and text; separate bindings fixed it. All 73 passed afterward. No RLS/check weakened. Three type-import lint warnings were corrected.
- Exact MCP SDK 2.3.1 pins installed. Existing Neon Auth upstream better-call/TypeScript peer mismatches remain: pnpm peers check exits1. Deprecated email-package and Playwright color-environment warnings remain. Strict build/runtime integration pass; no unresolved test failure.
- First visual pass exposed the manual form ahead of saved knowledge. Forms are now closed by default; final screenshots/tests confirm the agent-first view.
- The current chat did not hot-load the new tool inventory. Installed MCP/fresh-process retrieval and CLI fallback are verified; autonomous tool selection in a fresh full Codex chat is not observed. Global instructions load per Codex run; other agent products need their own connection/instructions. This is an instruction-driven workflow, not a filesystem watcher or guaranteed model compliance.
- Checkpoints are small project-scoped SQL records, separate from canonical memories and S09 file originals/object reconciliation. Full ingestion/review/fifteen-tool MCP and remaining S09–S30 features stay pending. Overall /ready retains the incomplete-product gate. Personal browser acceptance remains unverified.
- Context is bounded recent/literal matching; oversized records are omitted with truncated=true. Remote identity changes, or moving a non-remote project, can require later binding reconciliation. Expiry/revocation is respected, not automatically overridden.

Source brief SHA256 unchanged: BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A. Secrets/ciphertext/receipts/screenshots remain ignored. Local test database stopped after checks with volume preserved; app remains on loopback. No public deployment, commit or push.
