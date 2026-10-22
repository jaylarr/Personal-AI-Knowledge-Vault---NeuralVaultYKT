# Issues

## I-016 — P02 personal working memory (Resolved locally; rollout pending, 2026-10-22)

Implemented selective owner capture, explicit personal grants, separate source-review receipts, candidate/suppression controls, skill references/packages and personal UI. Strict/build/bundle and all final unit/local/MCP/browser suites pass. Prior latency, CSP-fixture and installer failures are retained with corrections in PERSONAL_MEMORY_IMPLEMENTATION_REPORT.md. No old timeout/graph threshold was relaxed. Native transcript support remains version/host scoped; actual installed client/grants, historical application, fresh-chat acceptance and another host remain G01–G04. Installed config.toml differs from the older planning snapshot and was not edited by this execution; recheck it before rollout.

## I-015 — F01–F06 local core remediation (Resolved locally, 2026-10-20)

Corrected redundant history/receipt fsync writes, trace output/byte admission, small-catalog watcher activation and cold directory identities, submission supersession/rejection aggregation, stale source Markdown, terminal job/task fencing, pipeline-aware chunks, durable knowledge retrieval/activity, owner-managed capture credentials, conversation file input and safe non-UUID graph focus. Regressions retain scope/revocation, current evidence, admission and direct-edit protection. No dependency/contract/cloud/client configuration changes.

Final verification: 171/171 unit, 29/29 local (23 overlap unit), 2/2 MCP/process, 14/14 domain-browser, 21/21 local-browser; types/lint/format/build and 11 bundle-boundary checks pass. Lint reports 69 warnings/17 infos. All 51 original and 44 current visible Markdown hashes plus source-brief SHA256 remain unchanged. CORE_FLAWS_REMEDIATION_REPORT.md records exact scope, logs and limits.

Initial Windows sandbox hard-link/junction failures required normal filesystem execution. A cold `.atlas` event caused cache rebuilds until validated parent identities were remembered. Pagination timed out in earlier runs; explicit fixture watcher cleanup and lazy domain materialization are retained, and final suites pass with unchanged timeouts. First full browser run passed20/21 with High/effective-DPR2 at29.5 FPS versus the existing30 FPS threshold; isolated Auto selected Medium/effective-DPR1.5 and passed51.4 FPS, and the final full suite passed21/21. Different tiers and earlier failures remain visible; no uniform High/DPR2 performance claim is made. No graph renderer/test threshold was changed.

## I-014 — L01 local migration and graph verification (Resolved)

Removed an approval-rejected credential query/export; safer read-only knowledge-only migration passed. Authorized NTFS execution resolved sandbox hard-link denial. Strict SVG/React/a11y lint fixes retained all checks. Browser tests corrected full-text-reference and async-bootstrap assumptions. Visual QA caught tiny/offscreen mobile graph; readable viewport/pan/resize recentering and visible-node regression pass. Excluded Vault from Biome after it reformatted generated snapshot JSON whitespace; deep data equality and restored exact-byte hashes verified before redundant staging cleanup. No source Markdown loss or cloud write/delete. See LOCAL_VAULT_REPORT.md.

## I-013 — A01 workflow integration (Resolved)

First fixture reused a UUID parameter for text subject; separate binding fixed it. Sandbox blocked Git temp initialization; authorized unit execution passed. One automatic startup approval review timed out; its permitted retry succeeded. Type-only import warnings were fixed. Initial UI exposed a manual project form ahead of knowledge; default forms are now closed and final controlled browser checks/screenshots pass. No unresolved application test/build failure. Known upstream Auth peer/deprecation warnings remain; see AGENT_WORKFLOW_REPORT.md for exact evidence and scope.

## I-001 — External integration gates (Open, expected)

Dedicated Neon project/Auth/storage, live migrations/owner identity and actual MCP client registration are not configured or authorized in the local implementation phase. Continue independent local work. Do not reuse unrelated projects or claim live success.

2026-10-17 update: owner supplied and authorized misty-fire-28366774 / production PostgreSQL/Auth. N01 integration now verified; remaining gates are full domain migrations/owner binding, source storage and actual MCP client setup.

## I-002 — Restricted tool access (Resolved for C0)

Ordinary registry requests returned ENOTFOUND; Docker pipe access returned permission denied in sandbox. Escalated read-only checks succeeded. Use scoped permitted commands; distinguish these from application defects. Preserve failed evidence in TEST_REPORT.

pnpm also needed its installed store outside the sandbox. Permitted installs/checks succeeded; no application permissions were weakened. Relevant: workspace install and infra/compose.test.yml.

## I-003 — Prerelease managed Auth SDK (Pending S07)

Pinned `@neondatabase/auth@0.6.0-beta` is prerelease. Isolate adapter and verify actual branch JWT/sign-in before release. Do not substitute a fake session for real Auth.

2026-10-17: live JWT/login tests passed with explicit runtime adapter. Published declarations and upstream peer warnings remain a dependency limitation; full owner-bound domain release remains pending. See NEON_SETUP_REPORT.

## I-004 — Toolchain configuration (Resolved)

Initial install refused esbuild because pnpm 11 ignores legacy onlyBuiltDependencies. Replaced it with allowBuilds.esbuild=true; frozen install passed. Initial TypeScript check lacked Node ambient names; explicitly configured types without disabling strict checks. Biome migration's none preset was corrected to recommended; lint is clean. Relevant: pnpm-workspace.yaml, tsconfig.base.json, biome.json.

## I-005 — Browser test startup path (Resolved)

Playwright resolved its server command from the tests directory, producing tests/apps/api/dist/index.js MODULE_NOT_FOUND. Set explicit project-root cwd in tests/playwright.config.ts; actual built app subsequently loaded and navigation/viewport checks passed.

## I-006 — 200% zoom header overflow (Resolved)

Mobile browser zoom caused the breadcrumb to exceed its available width. Allowed breadcrumb wrapping and flexible header height while retaining the local indicator. Targeted keyboard/zoom test now passes; desktop/mobile screenshots inspected. Relevant: global.css, foundation.spec.ts.

## I-007 — S05 fixture UUID typing (Resolved)

Initial domain tests failed before exercising constraints because one bound parameter was inferred as both UUID and text. Explicit uuid and uuid::text casts corrected fixture inserts. Final 30 SQL tests pass; no permission/check disabled. Relevant: tests/integration/domain-schema.test.ts.

## I-008 — S05 positive domain permissions (Resolved locally in S06)

S06 adds scoped SQL grants/policies verified under actual non-owner logins. Owner binding/HTTP services and production domain migration remain pending. Current N01 Auth/SQL diagnostics continue independently. Relevant: migrations 0012–0015, AUTHORIZATION.md.

## I-009 — S06 SQL parameter and fixture typing (Resolved)

Initial helper migration used a version parameter that collided with the integer source_versions.version column (uuid=integer). Renamed parameters explicitly before successful application. Strict TypeScript inferred a UUID template literal for a fixture default; annotated the string parameter. Revocation fixture initially violated the existing read/process dependency; revoke/restore all dependent permissions. No constraint or RLS check was weakened.

## I-010 — Processing batch whole-version exposure (Resolved locally)

Review found that a purpose-only grant could select a whole source-version payload containing text beyond the assigned chunks. Appended 0015 removes that path while retaining exact task chunk reads and ordinary authorized source reads. The regression selects all version columns and expects zero rows for the processing-only principal. Trace testing also clarified that still-authorized item/revision metadata can remain after a version switch; quarantine/revocation removes it. No trace stores source text.

## I-011 — S07/S08 strict input/fixture integration (Resolved)

First compilation required async union-return callbacks and explicit optional undefined types under strict TS. First DB run61 cases had one fixture UUID/text binding failure; explicit UUID casts fixed the fixture and INSERT SELECT merge parameters. Old setup-only tests expected503 for unauthenticated domain routes; updated them to assert the stronger401 auth boundary. No authorization bypass introduced.

## I-012 — Controlled browser harness and bundle split (Resolved)

First owner browser harness failed to resolve @hono/node-server from the root tooling package; declared the same exact2.1.5 dev dependency and updated lockfile. Static SDK imports initially defeated lazy loading and produced a563kB chunk; moved SDK/client and workspace loading behind dynamic imports. Final main bundle299.06kB and build warnings gone. Two controlled owner browser tests pass. npm start initially found occupied4317; inspected/verified the ATLAS node entrypoint, stopped only that preview process and restarted on the same port. No alternate port or startup service installed.
