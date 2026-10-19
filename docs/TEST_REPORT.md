# Test report

## 2026-10-17 — K01 durable knowledge

131 observed distinct cases:116 unit (11 files/10.81s),9 local browser (41.5s),6 offline compatibility browser (22.3s). Build/strict types/lint/format/bundle pass; installed fresh-MCP summary/full retrieval, exact Markdown/retry,7 stable seed IDs and15 unchanged original content files verified. The19 new knowledge cases cover scope, evidence/candidates, immutable correction, conflict/cycles, digests/direct edits, cross-agent retry, lexical/budget behavior and protected local HTTP. New behavior/failed attempts/limits are in KNOWLEDGE_QUALITY_REPORT.md; historical cloud suites were not rerun.


## 2026-10-17 — L01 local folder and real graph

101 distinct cases passed:93 unit (6.03s),2 local browser(final13.1s),6 historical compatibility browser(9.3s). Build2347 modules/3.00s; strict types/lint/format/bundle pass. Installed local MCP saves actual Markdown/deduplicates/reads after process replacement;3 projects/3 original notes/72 collection definitions preserved from read-only final export. Actual local preview inspected; browser test blocks external origins and confirms none requested. Local API smoke: no env-file load, zero external established connections at observation. Old SQL/Auth/storage suites are not claimed as rerun. Exact limits/failures and screenshot evidence: LOCAL_VAULT_REPORT.md.

## 2026-10-17 — A01 automatic project/checkpoint workflow

151 automated cases passed:76 unit (8 files/4.67s),73 local SQL/HTTP/MCP (5 files/36.80s),2 controlled signed-owner browser (final12.7s). npm run build exit0 (2345 modules/2.35s); strict types/lint/format/browser-bundle checks pass. Real installed-MCP discovery/save/retry/fresh-process retrieval on authorized Neon production also passed. Migration0017 passed rehearsal then production;42 owned RLS tables/18 migrations. Exact output, first-run failures and evidence boundaries are in AGENT_WORKFLOW_REPORT.md. Older offline/Auth/storage evidence is not claimed as rerun.

## 2026-10-16 — Initial preflight

| Check | Observed result |
| --- | --- |
| Root inspection | Only two planning Markdown files; no code/Git/local AGENTS |
| Node / pnpm | 24.18.0 / 11.25.0 |
| Normal registry lookup | ENOTFOUND (sandbox network); not an app failure |
| Normal Docker daemon check | Pipe permission denied (sandbox) |
| Permitted registry metadata | hono 4.13.13 / react 19.3.1 / typescript 7.0.2 available |
| Permitted Docker daemon check | 29.6.1 |
| Application checks | Pending installation |

Plan-only checks from the previous phase are not application test evidence. Live Neon/Auth/storage/MCP integration has not run.

## 2026-10-16–17 — C0 local foundation

| Command / observation | Result |
| --- | --- |
| First pnpm install | Failed on unapproved esbuild build script; pnpm 11 allowBuilds fix applied |
| pnpm install --frozen-lockfile | Passed; approved esbuild postinstall; lockfile policy verification passed |
| Initial pnpm typecheck | Failed on missing Node ambient types; corrected explicit server types |
| pnpm typecheck (corrected) | Passed, including scripts/tests; strict + skipLibCheck=false |
| pnpm lint | Passed with explicit recommended preset, no warnings |
| pnpm format:check | Passed |
| pnpm build | Passed all server packages and Vite production bundle |
| pnpm test:unit | 43 passed in 3 files; config, host/origin/body limits, error redaction, safe static serving, occupied port and migration gates |
| pnpm db:test:start | Passed; isolated loopback container healthy; restricted API/worker roles verified |
| pnpm db:migrate:local | Applied 0000_foundation.sql; repeated run verified history and made no changes |
| pnpm test:db | 10 passed in 1 file against PostgreSQL 18.6; actual non-owner roles, checksum tampering, migration rollback, context reuse/rollback, forged writes and worker denial |
| First pnpm test:e2e | Failed to start because server cwd resolved under tests; corrected cwd |
| Second pnpm test:e2e | 5 passed, 1 failed (mobile 200% zoom overflow) |
| pnpm test:e2e --grep keyboard after CSS fix | 1 passed; skip link/focus and zoom no longer overflow |
| Screenshot inspection | Desktop 1440×900, mobile 390×844 and 200% zoom inspected; reflow/list wrapping visible |
| pnpm list -r --depth 0 | Exact direct versions verified, 34 packages across 6 workspace projects |
| Source brief SHA256 | Unchanged: BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A |

Browser artifacts are ignored under `.artifacts/`: foundation-1440x900.png, foundation-390x844.png, foundation-320x740.png, foundation-1280x600.png, foundation-200-percent.png. Screenshots are local setup evidence only. No live Auth/cloud/object/MCP acceptance, domain-policy certification, full accessibility audit or production readiness is claimed. Final combined browser/check records appended below after execution.

### Final C0 observations, 2026-10-17

- Final `pnpm test:e2e`: 6/6 passed (14.6s), actual built local API/SPA in headless Edge. All supported viewport checks and keyboard/200% zoom case passed together.
- Final `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: passed. Recommended lint: 44 files, no warnings.
- `pnpm verify:bundle`: passed, one production JavaScript bundle checked; no server credential/import markers found.
- Local role bootstrap replay: passed; existing restricted roles preserved and owner NOLOGIN flags verified.
- `git check-ignore .local/test.env apps/web/dist/index.html`: both ignored; source brief checksum unchanged. Git initialized, no commit/push.
- Total across foundation suites: 59 passed (43 unit/runtime + 10 actual local DB + 6 browser).
- Local database stopped after verification without deleting its volume. No cloud or actual MCP client changes.

## 2026-10-17 — N01 real Neon integration

See [NEON_SETUP_REPORT](NEON_SETUP_REPORT.md) for exact target, failures, output excerpts and limitations. npm run build passed (2336 modules, 1.01s); npm start listening at localhost:4317. Real Auth/SQL test passed: 1/1 (6.5s), containing signup evidence, sign-in/out/reload, wrong-password, JWT/invalid token, committed receipt persistence, actual Auth profile and cross-identity RLS checks. Unit 48/48; local PostgreSQL 10/10; offline browser 6/6 (7.2s), now separate port 4318. Latest suite totals 65. Strict typecheck/recommended lint/format passed. SDK declaration/token-action/throw handling and init/approval interruptions are preserved in the setup report; no live evidence fabricated from offline fixtures. Full vault readiness remains pending.

## 2026-10-17 — S05 normalized domain persistence

| Check | Actual result |
| --- | --- |
| First local schema run | 0001–0009 applied successfully; later 0010/0011 applied through test harness |
| Initial SQL tests | 17 failed / 11 passed: shared fixture reused UUID parameters as text; fixed explicit casts, no schema relaxation |
| Corrected first suite | 28 passed; expanded replay/provenance checks then added |
| Final pnpm test:db | 30 passed in 2 files, 10.86s (20 domain + 10 existing foundation) |
| pnpm test:unit | 52 passed in 5 files, 1.57s (4 new contract tests) |
| Clean schema replay | All 12 migration files replayed from empty namespaces inside rollback-only local transaction; 39 tables, no SECURITY DEFINER functions |
| Seed verification | Exact brief comparison; 9 families + 63 children = 72 collections; renamed/archived/moved seeds retained on rerun |
| npm run build | Passed; 2339 modules, Vite 1.20s |
| pnpm typecheck / pnpm lint | Passed; recommended lint 64 files, no warnings |
| pnpm format:check | Passed, 63 files |
| pnpm verify:bundle | Passed, 2 browser JS bundles, no server-only markers |
| pnpm db:migrate:local replay | History checksums verified; no changes |
| Source brief SHA256 | Unchanged BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A |

82 tests passed during this milestone. Previous N01/offline browser outcomes are historical; no browser/UI behavior changed and those suites were not rerun for S05. Domain table access was default-denied at S05; subsequent S06 evidence follows. No actual knowledge or owner binding added to production. Local test volume retained.

## 2026-10-17 — S06 SQL authorization

| Check | Observed result |
| --- | --- |
| pnpm test:db | 52 passed in 3 files, 11.60s: 22 authorization + 20 domain + 10 foundation |
| pnpm test:security | 22 passed in 1 file, 1.67s; actual authorization suite, subset of the 52 DB cases |
| pnpm test:unit | 52 passed in 5 files, 1.63s |
| npm run build | Exit 0; 2339 modules, Vite built in 1.26s |
| pnpm typecheck / lint / format:check | Exit 0; strict TS, lint 66 files, formatting 65 files |
| pnpm verify:bundle | Exit 0; 2 browser JavaScript bundles, no server-only markers |
| Migration replay | All 16 files 0000–0015 replayed from empty namespaces in rollback-only local transaction; existing volume preserved |
| pnpm db:migrate:local | Migration history verified; no changes |
| Source brief SHA256 | Unchanged BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A |

104 distinct tests passed this milestone. The security command reruns 22 of those tests, not 22 additional cases. SQL fixtures use actual atlas_api/atlas_worker logins, two owners/workspaces/projects/agents and all five scopes. They cover a cross-workspace colliding UUID, private evidence derivatives/history, graph endpoints, scoped counts/tags/collections/search/traces, missing/malformed context and pooled rollback reuse, pending-only proposals, credential expiry/revocation, disabled owner/agent, exact processing batch, grant expiry/revocation, stale task revision/lease, forged submission actor, worker-only claim/heartbeat/finish, wrong job/source/token, no approval/ACL access, and cancellation/version changes inside an open worker transaction. Catalog assertions verify private helper owner, fixed empty search_path, no PUBLIC execution and NOLOGIN/non-superuser/non-BYPASSRLS owner role.

Failures retained: first helper migration failed uuid=integer due to a version parameter/column collision; renamed parameters before application. First strict TS run inferred an overly narrow UUID template type for a test helper; annotated string. Initial authorization run was 47/48 because revocation fixture violated the existing read/process grant check; fixed dependent permissions. Expanded suite initially expected a source's metadata-only trace to disappear after a version pointer change; clarified the intended still-authorized metadata behavior. Review found whole-source-version access under a processing batch; appended 0015 and verified SELECT * returns no version rows while assigned chunks remain readable. No production permission/constraint was relaxed to pass a test.

No UI or HTTP domain behavior changed. N01 live Neon/browser results above remain historical and were not rerun for S06. No Neon domain migration, owner enrollment, real MCP client, worker scheduler, task service or concurrency acceptance is claimed. Local test container stopped after verification with volume retained; existing manual preview is preserved.

## 2026-10-17 — S07 local owner access and S08 organization

| Command / check | Observed result |
| --- | --- |
| pnpm test:db | 63 passed in 4 files, 15.72s: 11 new owner/HTTP/process cases plus 52 existing |
| pnpm test:security | 33 passed in 2 files, 4.95s; subset of the 63 DB cases |
| pnpm test:unit | 52 passed in 5 files, 1.69s |
| pnpm test:e2e | 6 offline foundation cases passed, 7.8s; temporary4318 server |
| pnpm test:owner-browser | 2 controlled owner cases passed, 8.5s; temporary4319 server |
| npm run build | Exit 0; 2343 modules; Vite 1.27s; no chunk/import warning |
| pnpm typecheck / lint / format:check | Passed; strict TS, 79 linted files, 78 formatted source files |
| pnpm verify:bundle | 5 browser JS bundles; no server-only markers |
| Migration verification | All 17 files 0000–0016 replayed cleanly in rollback-only local transaction; db:migrate:local reports history verified/no changes |
| Preview restart | Existing ATLAS process verified and replaced; npm start: ATLAS listening on http://localhost:4317 |
| Refreshed preview | GET /health200; unauthenticated /api/v1/me401; /ready503 while live setup is incomplete |
| Source brief SHA256 | Unchanged BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A |

123 distinct tests passed:63 DB+52 unit+8 browser. test:security repeats 33 DB tests and is not added again. New cases verify single-owner idempotent binding/refusal of another owner,72 seeds, configured owner-only resolution, signed JWT wrong-key/issuer/expiry/future-iat/missing-sub denial, disabled user/membership revocation, no-store, strict actor-field rejection, production fixture rejection, idempotency replay/conflict, bounds/missing keys, stale edits and one winner under concurrent updates, nested rename/move/archive/cycles/duplicates, merge collision mapping and rollback, canonical identity/manual lock preservation and contradictory manual exclusion rejection. Two separate Node processes/pools prove committed project persistence across process replacement.

Controlled browser tests use the actual built UI and real local API/Postgres with signed synthetic JWTs; managed Auth responses are intercepted, not real sign-ins. Create/edit/reload project, create collection, URL selection restore, desktop1440px/mobile390px/320px reflow, enlarged text, reduced motion, sign-out clearing and disabled-owner cached-data hiding pass. Desktop/mobile PNGs in .artifacts/owner-browser were inspected visually. No real owner credentials, Auth signup/email or Neon domain writes occurred. N01 actual Auth evidence remains historical; S07 actual owner/live C1 is deferred, not completed.

Failures and corrections: first compile needed async union callbacks/optional undefined typing. Initial new SQL suite was60/61 due fixture UUID/text inference; fixed UUID casts in fixture and merge SELECT parameters. Three old unit assertions expected503 instead of the new unauthenticated401 denial; updated to the intended HTTP boundary. Browser harness initially lacked a declared root Node server dependency; pinned the existing2.1.5 package. Static client imports initially defeated lazy loading and produced a large chunk; dynamic loading restored separate bundles. Initial npm start correctly refused occupied4317; inspected/verified and restarted only the existing ATLAS process. Existing upstream peer/deprecation and Playwright NO_COLOR/FORCE_COLOR warnings remain; no unresolved test/build failure.

Local test container stopped with volume preserved. App preview remains running manually (session19087). No startup installation, commit/push, cloud domain migration, actual owner promotion, bucket or MCP client activation. See DEFERRED_SETUP.md for owner-dependent steps put aside without questions.


## 2026-10-17 — N02 completed Neon domain/storage setup

See NEON_DOMAIN_SETUP_REPORT.md for exact target, command output, fixes and limitations. All 17 migrations/39 owned RLS tables applied on an expiring child branch, tested under actual non-owner logins, then applied to ATLAS production. Repeated production setup reports zero changes/checksums verified. Private atlas-sources deployed; real PUT/HEAD/GET/byte-hash metadata and anonymous403 passed twice; only each task-created object cleaned. Runtime status: database=connected, auth=connected, storage=connected, vault=setup_required.

Observed checks: 61 unit,63 local DB,6 offline browser,2 controlled owner browser and1 real Neon Auth/SQL integration test (133 distinct). npm run build passed (2343 modules/3.53s); strict types/lint/format/bundle boundary passed. Real Auth account was the existing synthetic verification account, never a bound owner. Actual personal owner/C1 and S09 source capture remain pending; Neon infrastructure setup is complete. No tests pointed the disposable DB fixture at cloud. Source brief hash unchanged. Existing warnings and resolved initial target-type/lint/sandbox issues are retained in the N02 report.

## N03 — actual personal owner binding

The user's recently completed genuine-JWT connection check produced a unique fresh non-synthetic receipt. Administrator-only explicit account selection required a matching managed Auth profile/issuer/subject, one row and <=10-minute age. Binding succeeded on the exact production target. Restricted atlas_api verification:1 own workspace,72 seeded collections, unrelated owner identity denied. Manual API restart loaded owner configuration; unauthenticated requests remain protected.

70 unit tests pass (7 files,2.66s), including9 receipt-boundary cases: valid proof; missing/ambiguous rows; wrong issuer/profile/email; expired/future proof; synthetic refusal. Strict types passed after correcting an initial parameterized fixture-table typing error. No schema/runtime auth code changed, so previous63 SQL/real Auth/browser/storage results were not relabeled as rerun. Connected in-app tab is signed out; actual personal workspace UI acceptance is still unverified. No password/JWT captured or stored.
