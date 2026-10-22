# Personal working memory implementation

2026-10-22, Asia/Taipei. Status: S00–S15 completed locally; G01–G04 pending. Approved execution scope: S00–S15 of `plans/2026-10-21-personal-memory-implementation-plan.md`. G01–G04 remain separate. Evidence: `.artifacts/personal-memory-execution-2026-10-22/`.

## Result

ATLAS now has projectless personal context and evidence-backed capture; separate unconfirmed patterns, immutable corrections and stop-using controls; bounded session review with explicit saved/no-change/no-value/candidate/failure outcomes; skill metadata, curation and selected custom-source backup/isolated restore; and personal profile, skill and coverage screens. The seven dedicated MCP tools extend the existing eighteen tools to twenty-five. Existing project tools, source/review UI and real-file graph remain available.

These features are implemented locally. The existing owner listener was not restarted; normal app restart/update belongs to rollout so the new API and UI run together. No actual host has been enabled by this execution, no historical sessions were imported/distilled, and installed Codex instructions/hooks/grants were not changed. Synthetic fixture notes are confined to temporary test vaults. No routine execution history was saved as owner knowledge.

## Implementation and boundaries

- `packages/contracts/src/personal-memory.ts` defines strict browser-safe requests, host/export contracts, policy, candidates, skills and bounded context packets. No dependency was added; the lockfile stays unchanged.
- `packages/core/src/local/personal/` implements policy, explicit host grants, source adapters, independent coverage journal, acknowledged review leases, personal selection, skill references/packages and derived snapshot caching. Capture uses the actual owner/agent actor, exact source spans/hashes or owner-authenticated confirmation, stable request keys and existing immutable replacement rules. Owner inference is still performed by a connected agent; hash checks cannot prove prose meaning.
- Native JSONL reads complete lines through a bounded stream. Only supported original `UserMessage` events enter review; assistant/tool/injected material does not become owner evidence. Unsupported sources remain unsupported. A later owner revision retires unfinished older review; missing sources become unavailable. Historical references survive an unchanged prefix append, while current review leases require the exact current revision. Subagent records are excluded rather than counted as independent corroboration.
- Journal limits remain 100,000 event files/128 MiB per configured host and 32 KiB per event, outside the existing domain catalog budget. Review pages use codepoint cursors, acknowledgments, expiring leases and full-source revalidation. Completion checks actual active note IDs/digests or source-matching candidates. A no-value receipt creates no memory. Receipts are agent attestations of review, not proof of extraction completeness.
- Context defaults to eight whole subjects within the full 10,000-character envelope; callers can request up to twenty/24,000 characters. A small configured baseline precedes query matches. Relevant curated skills use metadata first; no-query context does not read every skill body. Project context is explicit. Modified Markdown is served in full rather than hidden behind a stale summary. The personal profile supports finding subjects, evidence/history, baseline pinning and suppression.
- New personal records, candidates and backed-up skill Markdown are filtered from legacy capture-only snapshots. Dedicated APIs require owner cookie or explicit personal capabilities/current host grants. Revoked/expired identities remain denied. Restore validates the coverage chain and disables personal capture and credentials; it does not reinstall clients.
- Skill discovery distinguishes discovered/curated/dismissed and owner/project custom versus third party/system. Availability/digest is rechecked. Backup copies only selected eligible files, with 500-file/20 MiB package and 2 MiB file limits, secret/path checks and an integrity manifest. Restore writes a separate new directory and does not install/execute a skill. License/reference files must be selected deliberately.
- The hook package queues only metadata after current-turn consent and never starts a model, API or agent. The installer defaults to dry-run, backs up inputs, adds its own hook groups, preserves existing JSON bytes through insertion, and updates only the uniquely delimited ATLAS instruction block. Hook trust stays with normal Codex controls. Only fake-home installation was exercised here.
- `personal-maintenance.ts` provides explicit-scope metadata previews, bounded continuation-based backfill/reconciliation and owner maintenance. An applied inventory queues review; it does not perform inference or count as review. Profile indexes are link-only/versioned and preserve edited files. Erasure preview lists known lineage/history/request receipts and warns about other copies; suppression is not physical erasure.

## Verification

Final verification:

| Check | Result | Evidence |
| --- | --- | --- |
| Strict types / lint / format / production build | Passed; lint warnings/infos disclosed below | typecheck.log, lint.log, format.log, build.log |
| Browser bundle boundary | 19 bundles, no server-only markers | bundle.log |
| Full unit | 187/187, one worker, unchanged timeouts | unit-final-serial.log |
| Local integration/domain | 31/31, one worker; 23 overlap unit domain cases | local-final-serial.log |
| MCP/protocol and isolated recovery | 3/3, fresh client processes | mcp-final.log |
| Owner/personal browser | 19/19 passed (including five personal flows) | domain-browser-final.log |
| Existing graph/local reader | 21/21 passed; original graph thresholds preserved | local-browser-final.log |
| Synthetic classifications / retained subjects / corrections | 30/30; 8 current subjects; 3 corrections preserve originals | evaluation.json |
| Performance | Passed unchanged fixture targets | performance.json, hook-performance.json |

Lint completes with zero errors, 120 warnings and 41 infos (baseline: 69 warnings/17 infos). The exact diagnostics are retained in lint.log; they are not claimed clean. The existing large Three.js chunk advisory remains. No build/bundle threshold was weakened.

Synthetic classification attestation scores 30/30 against the fixed oracle. Applying the separately submitted subjects retains all eight explicit owner concepts and resolves all three updates to their latest heads while preserving original files. Fifteen deterministic held-out retrieval/abstention queries pass. This measures submitted connected-agent judgments and fixture behavior, not real-history extraction or fresh-chat personalization. G03 remains unobserved.

Performance fixture: 1,000 synthetic main sessions, 200 owner subjects and 200 curated skill refs. Measured scan total 28,313 ms in ten continuations; maximum request 3,377 ms; warm context p95 157 ms over thirty calls. The unchanged acceptance targets are 30,000/4,000/500 ms. Hook fixture measured five subprocess calls, p95/maximum 133 ms against 1,000/2,000 ms targets. These are host-specific fixture measurements, not universal latency guarantees.

## Failed attempts and corrections

Initial Biome errors (implicit variable types, semantic fieldset and test control flow) were corrected. The fake-home installer initially hit PowerShell collection merging; explicit arrays fixed it. Existing MCP/recovery assertions were updated from eighteen to twenty-five tools. The old home-page file-search test was moved to `/files?view=all`, retaining all search/graph assertions, because `/` now intentionally opens personal context.

Early performance attempts failed: first 162,787 ms scan/24,389 ms context p95; subsequent runs are retained separately. Repeated journal parsing, filesystem ancestor walks, access notifications and checking unrelated skill bodies were reduced through validated caches, complete canonical path resolution, relevant skill lookup and bounded independent publication. Inventory pages now admit up to 100 sources within a 1.5-second read budget rather than the planned 25-source batch, amortizing fixed work without changing the acceptance targets. Slow/oversized sources remain bounded failures. The final measured result above passed.

A full regression attempt encountered timeouts while an earlier task-owned benchmark process remained alive. The benchmark result was preserved and only that exact task-owned process was stopped. The affected 25 cases passed when rerun without the old benchmark. A subsequent local run had one large-catalog timeout; complete unit/local runs then passed using one worker and unchanged per-test timeouts. Earlier logs, including failures, remain available; no existing timeouts, graph thresholds or oracle outputs were relaxed.

The enlarged-text fixture initially violated the unchanged CSP by injecting inline CSS. It now serves a same-origin fixture stylesheet and asserts actual doubled computed text size. A later shared browser run timed out in existing search/backup/PDF flows; the network trace shows pending requests rather than a fabricated successful response. An isolated seeded catalog diagnostic completed ten snapshot/catalog cycles in 28–45 ms without repeated rebuilds; no speculative cache change was made. The final clean-server run passed all 19 cases, and the separate graph/local reader run passed all 21 cases. Candidate saving now displays progress; its new browser test checks the durable response before checking the updated view. Existing per-test timeouts and graph thresholds remain unchanged.

## Preservation

All 52 baseline visible Vault Markdown hashes, the source brief SHA256 and pnpm-lock.yaml match. The installed hooks.json and global AGENTS.md match the planning snapshot. config.toml differs from that older snapshot; this execution did not edit it, and no cause is inferred. It must be rechecked before G01 rather than restored over a possible owner/app change. The dirty pre-existing F01–F06 work and original copies remain preserved in the execution baseline/before directory. No original owner record was replaced by synthetic fixture content.

The installed-client dry-run also passed without writes; actual apply/trust/grant/history steps remain pending. The final summary is verification.json, with retained logs, first-failure evidence and rendered desktop/mobile/enlarged-text screenshots in the execution directory.

## Remaining rollout checkpoints

See `PERSONAL_MEMORY_ACCEPTANCE.md`. Installed client changes/grants and enabling `windows-primary` (G01), scoped historical application (G02), actual fresh-chat behavior (G03), and a concrete additional host/export (G04) are not claimed complete. Native Codex memory remains independent. No account-wide or all-session storage guarantee is made. No cloud/model service, public exposure, startup installation, unrelated project change, commit or push occurred.
