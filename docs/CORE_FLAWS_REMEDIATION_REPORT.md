# Core flaws remediation — 2026-10-20

Status: Completed. Owner authorized the attached F01–F06 specification, preserved in plans/2026-10-20-core-flaws-remediation-plan.md. Every mandatory command has a passing final run. Verification below is fresh local evidence; earlier release and actual connected-client acceptance records remain separate.

## Implemented changes

- F01: create-once history/receipt writes check the safe existing path before allocating a temporary file. Exclusive publication and its concurrent EEXIST protection remain. Regression instrumentation observes temporary opens during initial capture and zero temporary opens during unchanged snapshots; history mtimes and the existing direct-edit/two-history-version regression are checked.
- F02: trace outputs remain parsed and available through domain heads, but do not consume domain output/record-byte admission totals on warm transactions or cold loading. Per-record, per-operation and existing 50,000-transaction-directory discovery limits remain; this task does not add trace retention/pruning. All catalogs enable the watcher. Fresh catalogs also remember validated parent directory identities: Windows emits directory notifications for the lock, and an unknown `.atlas` event otherwise defeats the newly enabled small-catalog cache. Unknown or changed children still invalidate; the existing direct-edit/independent-commit regression remains.
- F03: supersession resolves the replacement candidate's submission. Rejected-only outcomes return sources to captured, and source Markdown is regenerated alongside metadata. Version edits preserve terminal jobs and submitted/completed tasks while fencing queued/running jobs, awaiting/claimed tasks and live grants. Source-detail chunks use the saved pipeline version.
- F04: general retrieval merges eligible durable K01 knowledge with domain candidates before continuation and budget packing. Knowledge loading caches for at most two seconds and tracks catalog rebuilds. Ranking retains lazy domain summaries/evidence materialization and uses a set for lexical-origin lookup, avoiding work for undelivered candidates. Owner history is explicit; agent reads require a live read credential and matching project membership or owner-scoped knowledge. Project/recent filters apply; traces retain origin and file digest. Memory-only operations remain domain-only. Changes combines Markdown and domain records. Owner-managed capture credentials use current capability and revocation checks.
- F05: conversation mode shows the JSON file input. Browser and API focus accept bounded safe string IDs, including imported catalog/file IDs.
- F06: added storage/domain/HTTP/browser regressions, preserving original assertions and timeout thresholds. Fixtures explicitly close every store watcher before deleting temporary vaults, now that even small stores have watchers.

## Verification

Artifacts: `.artifacts/core-flaws-2026-10-20/`; controlled browser screenshots remain under `.artifacts/domain-browser/`.

| Command | Current observed result |
| --- | --- |
| pnpm typecheck | Passed |
| pnpm lint | Passed: 69 warnings / 17 infos, no errors |
| pnpm format:check | Passed |
| pnpm build | Passed; existing large Three.js chunk advisory retained |
| pnpm verify:bundle | Passed: 11 browser JavaScript bundles contain no server-only markers |
| pnpm test:unit | Passed: 171/171 across 19 files; final run 62.10 seconds |
| pnpm test:local | Passed: 29/29 (23 overlap the unit domain file); final run 54.49 seconds |
| pnpm test:mcp | Passed: 2/2 built MCP/process tests across 2 files; 24.86 seconds |
| pnpm test:domain-browser | Passed: 14/14, including conversation input and responsive/evidence/source/backup/PDF flows |
| pnpm exec playwright test --config tests/playwright.local.config.ts | Passed: final full run 21/21 in 2.6 minutes; first full run 20/21 and isolated rerun 1/1 retained |

The conversation screenshot was visually inspected: the selected supported-JSON mode displays the labeled File to preserve control in the existing shell.

## Failures retained and corrected

The first sandbox unit run returned 116 passed/55 failed, dominated by Windows denials of temporary-fixture hard links and a junction; dependent authentication assertions also failed after publication was denied. No filesystem protection or assertion was removed. Normal Windows filesystem execution was used for subsequent isolated fixture tests.

The first permitted full run returned 167 passed/4 failed: three timeouts and the cold small-catalog cache assertion. The cache assertion identified `unrecognized_event:.atlas`; remembering validated cold-load directory identities corrects that omission. The next two-file run passed 41/42, with the existing 121-memory pagination scenario hitting its unchanged 30-second timeout. Its isolated rerun passed in 20.68 seconds, and a full unit run then passed 171/171 in 94.99 seconds. The first local run also hit that pagination timeout (28 passed/1 failed). Explicit fixture watcher cleanup and lazy domain materialization were retained; the next local run passed 29/29 in 54.49 seconds. Logs preserve every attempt. Final full verification runs avoid concurrent heavy build/browser suites; no test timeout or assertion was relaxed.

The first full local-browser run passed 20/21. Its existing 500-node/1000-edge DPR2 Auto test measured 29.5 FPS at High quality/effective DPR2 against the unchanged 30 FPS threshold. The isolated rerun passed at 51.4 FPS after Auto selected Medium/effective DPR1.5. These are different quality tiers, not evidence of a fixed High/DPR2 performance improvement. Both secret-free measurements are preserved as `neural-dpr2-full-suite.json` and `neural-dpr2-isolated.json` in the remediation artifacts. Graph rendering code/settings/tests were not changed for this remediation.

The subsequent full local-browser run passed all 21 tests; Auto selected Medium/effective DPR1.5 and measured 51.5 FPS. Its measurement is preserved as `neural-dpr2-final.json`; a passing run does not erase the earlier borderline High/DPR2 result. Performance remains device/load/Auto-tier dependent.

## Preservation and boundaries

Before source changes, all 51 original Markdown entries in the preserved 2026-10-18 manifest matched their SHA-256 hashes. A separate current visible-Markdown baseline contains 44 files; it excludes `.atlas` history and `.obsidian`. Both baselines were verified again after implementation with zero missing/changed entries; `.artifacts/core-flaws-2026-10-20/preservation.json` records the counts and brief hash.

Preserved brief SHA-256: `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`.

No external dependencies, browser-unsafe contracts, cloud write, model service, client configuration, startup installation, commit or push. Verification used isolated loopback fixture servers; the owner's existing listener/client was not restarted. No new durable knowledge subject is needed for this routine remediation. The existing personal release/fresh connected-chat acceptance gates are not satisfied by controlled tests.
