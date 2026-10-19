# Neon setup — verified 2026-10-17

This is the historical N01 PostgreSQL/Auth report. N02 subsequently deploys the full domain schema, restricted worker role and private storage; current live evidence is in NEON_DOMAIN_SETUP_REPORT.md.

Status: PostgreSQL and managed Auth are configured, wired and tested end to end. App running locally at http://localhost:4317. This is not a completed knowledge-vault release.

## Exact target

- Organization: org-floral-darkness-38230607 (Yakatzel).
- Project: misty-fire-28366774 (ATLAS - Personal).
- Branch: production / br-withered-recipe-azwll09c.
- Region: aws-ap-southeast-1, PostgreSQL 18, database neondb.
- Services: PostgreSQL and managed Better Auth only; neon.ts has auth:true. No AI Gateway, Data API, Functions, object storage or public frontend deployment.

## What changed

- Installed global neon@latest (resolved 8.7.2), reused authenticated OAuth profile; no browser sign-in needed.
- Requested default init installed Neon agent tooling, linked ignored .neon and generated neon.ts. Its first attempt failed because PowerShell split the unquoted comma argument. Retried with quoted services. Init then failed on pnpm workspace-root dependency protection; installed @neon/config@1.9.2 and @neon/env@1.6.3 explicitly at root and finished init with --no-agent-setup to reuse tooling already installed.
- neon deploy matched the existing production services and pulled DATABASE_URL, DATABASE_URL_UNPOOLED, NEON_BRANCH, NEON_AUTH_BASE_URL and NEON_AUTH_JWKS_URL into ignored .env.local.
- Created restricted atlas_api login and saved its separate pooled ATLAS_DATABASE_URL, plus public VITE_NEON_AUTH_URL alias and exact DATABASE_TARGET_ID. Runtime never falls back to CLI administrative URLs. TLS verify-full.
- Added checksummed setup-only migration and forced row policies for atlas_setup.auth_checks. Receipt fields are issuer/subject/UUID/time only. Separate public.atlas_setup_migrations journal avoids interfering with future vault migrations. No existing business knowledge was modified.
- Added real SQL/JWKS status, SDK account form/session/reload/sign-out, JWT verification and authenticated per-identity receipt API. Account does not become vault owner automatically. Knowledge routes remain closed.
- Updated docs, setup commands and offline/live regression tests. Auth UI is code-split. Full build/types/lint remain enabled.

## Command output proving operation

```text
neon deploy
→ Applying to branch production (br-withered-recipe-azwll09c)
No changes — branch production already matches the policy.
Utilized services: Postgres, Neon Auth
Pulled 5 Neon variables into .env.local

npm run build
> tsc -b packages/contracts packages/core apps/api apps/mcp-server && pnpm --filter @atlas/web build
vite v8.3.4 building client environment for production...
✓ 2336 modules transformed.
✓ built in 1.01s

npm start
> node --env-file-if-exists=.env.local apps/api/dist/index.js
ATLAS listening on http://localhost:4317

pnpm test:neon
ok 1 ... real Neon signup, session restore, sign-in/out, JWT, persistence and RLS (4.8s)
1 passed (6.5s)

pnpm test:unit
Test Files 4 passed (4)
Tests 48 passed (48)

pnpm test:db
Test Files 1 passed (1)
Tests 10 passed (10)

pnpm test:e2e
6 passed (7.2s)

pnpm neon:migrate:setup
N01 setup migration checksum verified; no changes.
```

Build exit code 0. Unit/local DB/offline browser/live integration suites exit code 0. Strict typecheck, recommended lint and formatting passed. Browser bundle boundary scan passes (server-only credentials/imports absent). Total latest suites: 65 passing tests. The one live test contains multiple real service assertions; it is not 65 live/cloud tests.

## Actual live assertions

Signup succeeded against managed Auth in initial runs. Subsequent runs reuse that synthetic identity. Final complete test verifies: correct-password sign-in; wrong-password failure; signed JWT accepted by local API; missing/invalid bearer returns 401; authenticated receipt committed to production SQL; receipt survives reload and is read through a separate real pooled connection; other/missing issuer-subject context reads no rows; profile exists in neon_auth.user; API role is non-superuser/non-BYPASSRLS; session restores on reload; sign-out clears browser state and remains signed out after reload; vault_access stays setup_required. Real desktop/mobile screenshots inspected.

Existing Auth configuration was read before testing: signup/sign-in email sending false, required verification false. No settings weakened and no emails sent. Synthetic @example.invalid test identities/diagnostic receipts remain for reproducibility; local test password is ignored in .local/neon-test-user.json, never displayed. Network traces/videos disabled for live Auth tests. Test result JSON/screenshots are ignored under .artifacts.

## Failures and limitations

- Initial unquoted services argument: CLI rejected `postgres auth`, followed by a Windows libuv assertion; retry with quoted comma string succeeded.
- pnpm workspace-root install and unapproved core-js postinstall: corrected explicit workspace dependency installation, declined optional core-js script. Existing esbuild approval retained.
- Automatic approval review temporarily could not run due to account usage limit; no rejected action was bypassed. Owner requested continuation; subsequent normal approval checks succeeded.
- SDK's published declarations reference missing types and incompatible transitive declarations with strict TS7. Contained at an explicit runtime JS adapter and small declaration contract; TS consumer validates SDK responses using Zod. No skipLibCheck or strict-mode relaxation.
- Documented dynamic token action failed in the installed 0.6.0-beta runtime. Inspected its code: getSession success hook injects signed set-auth-jwt into session.token. Adapter uses that observed path; server independently verifies signature/issuer/expiry. First live attempts timed out waiting for the unusable token action; corrected test then reached wrong-password handling, which exposed thrown SDK errors; normalized to validated error results. Final full run passed.
- Initial bundle warning over 500 kB resolved by lazy-loading AuthPanel (main ~387 kB, Auth ~153 kB). No threshold increase.
- SDK dependency warnings remain: upstream deprecated react-email subdependencies; better-call peer 2.0.2 versus requested 1.4.0 for api-key package; triplit logger advertises TS5 peer while project uses TS7. No API-key plugin/custom plugin is used. Actual build, runtime flows and strict application checks pass. Avoid claiming upstream SDK declarations or all its optional plugins are validated.
- Owner binding, full knowledge schema/RLS, ingestion worker, private source storage, review, search, graph and actual MCP registration remain future work. /ready intentionally remains 503; PostgreSQL/Auth connected does not mean the whole vault is ready. No new owner email/password was invented.
- Sign-out ends managed browser session/cache; an already-issued JWT can remain valid until expiration.
