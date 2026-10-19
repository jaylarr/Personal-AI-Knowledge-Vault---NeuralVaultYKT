# Setup

## Current local workspace — 2026-10-18

Normal operation uses `Vault/` without a cloud database or sign-in. Run `pnpm build`, then use the protected launcher or `pnpm start` on loopback4317. Restart an already-running API after building; reconnect MCP processes to discover the eighteen tools. The launcher refuses occupied ports. No startup installation is performed.

The owner workspace provides capture, sources/history, review, agent permissions, organization, search, activity and backup. Sources default to personal access. Grant a named agent the current source version explicitly before processing. Editing creates a new immutable version and invalidates old processing grants. Restore creates a separate rehearsal folder with old credentials disabled. See BACKUP.md and LOCAL_COMPLETION_REPORT.md.

Local acceptance commands: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm verify:bundle`, `pnpm test:unit`, `pnpm test:local`, `pnpm test:mcp`, `pnpm test:domain-browser`. Run `pnpm test:performance` separately for meaningful timing. Windows link/process fixtures need normal local permissions. The historical SQL/Auth setup below is preserved evidence, not a local runtime requirement.

## Current local foundation

Run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm start`. Browse `http://localhost:4317`. `pnpm dev` starts the shared-package watcher, local API and Vite on `http://localhost:5173`. No startup service is installed. Stop manual processes with Ctrl+C.

No .env file is required to view setup. `.env.example` lists server-only values; copying it does not create resources or make the installation ready. Do not put administrative database credentials into API configuration.

## Isolated database checks

Run `pnpm db:test:start`. The preparation script creates random test-only credentials in ignored `.local/test.env`, preserving existing configuration. Compose uses only project atlas-tests and loopback port 55432; stop preserves its task-specific volume. Bootstrap creates non-owner API/worker roles without logging passwords. Then run `pnpm db:migrate:local` and `pnpm test:db`.

Local unit/database fixtures never read `.env.local` or fall back to Neon. N02 now provides `pnpm neon:setup:domain production` (also db:migrate:neon) with exact-target and matching-rehearsal checks; all current domain migrations are deployed. The separately authorized N01 setup runner uses only the recorded production target and its isolated setup migration.

Verification: `pnpm test:unit` (61 cases), `pnpm test:db` (63 cases), `pnpm test:security` (33 of those SQL/HTTP cases), `pnpm test:e2e` (6 offline cases on 4318), `pnpm test:owner-browser` (2 controlled owner cases on 4319), and `pnpm verify:bundle`. Browser checks use installed Microsoft Edge headlessly. Run DB/security/owner-browser suites sequentially: their disposable local fixtures reset the same atlas_test schema data. The owner browser fixture reads only the public Auth URL from .env.local to intercept the SDK's requests; all database URLs come exclusively from .local/test.env with exact local-target checks. Its signed JWTs and test-only entrypoint never reach production.

`pnpm test:neon` is the separately invoked real integration test on the running4317 app; it contacts production and uses a synthetic @example.invalid identity. Existing branch settings were previously inspected as having no signup/sign-in email delivery. Live test network traces/videos are disabled; synthetic test credentials stay only in ignored .local/neon-test-user.json. Live tests were not rerun for S07/S08.

## Configured Neon installation (N01)

Owner-selected project misty-fire-28366774 / production supersedes the earlier new-project/atlas-dev proposal. `neon init` linked it; `neon deploy` confirmed Postgres/Auth match neon.ts and pulled five values into ignored .env.local. No browser CLI sign-in was required. PowerShell services argument must be quoted: `--services 'postgres,auth'`.

`pnpm neon:configure` checks .neon against docs/neon-target.json, creates or verifies a restricted atlas_api login, preserves the CLI-managed admin connection values and writes ATLAS_DATABASE_URL plus VITE_NEON_AUTH_URL to .env.local. Never reset existing role passwords silently. `pnpm neon:migrate:setup` checks the exact direct endpoint and target identity and applies only database/setup/0001_neon_connection_checks.sql with checksum history in public.atlas_setup_migrations. Repeat runs verify history without changes. After `neon deploy`/`neon env pull`, rerun neon:configure if application aliases are missing; do not commit the env file.

Build: `npm run build`. Start: `npm start`; open http://localhost:4317. The service status should say PostgreSQL: connected / Auth: connected. Create your own account or sign in, then use Test database connection. This proves identity and your own diagnostic receipt; it does not automatically make that account vault owner.

Remaining: explicitly bind the actual owner after the domain schema/policies exist, implement knowledge features, private source storage/worker and actual scoped MCP registration. No separate AI API key is required. Sign-out clears browser session/cache; already-issued JWTs remain valid until expiration.

## Owner binding and local organization (S07/S08)

The setup-only core bindOwner service requires a verified identity and setup transaction, creates the owner workspace and 72 seeds atomically, and refuses an existing different/disabled owner. No public signup becomes vault owner automatically. The runtime requires ATLAS_OWNER_ISSUER and ATLAS_OWNER_SUBJECT to match both the signed JWT and an enabled database owner membership. Do not use the test account as the real owner.

`pnpm owner:bind:local` is intentionally local-test-only. It reads .local/test.env for the guarded target and requires the configured Auth base/JWKS, explicit owner issuer/subject and a verified owner JWT supplied transiently as ATLAS_OWNER_TOKEN in the setup process environment. It never prints or persists the token and cannot migrate/bind Neon. This command has not been run for a real owner. Tests call the core service with synthetic signed/verified fixtures in the disposable local database.

Once actual domain/owner setup is complete, signed-in owners see persistent projects and nested collections. Until then the actual preview stays in setup mode. Owner-dependent/cloud steps are set aside in DEFERRED_SETUP.md; C1 is not complete. There is no invitation, first-visitor enrollment, public object access, AI API or agent launcher.



## N02 — completed live database/Auth/private storage

The owner's follow-up request authorized domain schema/roles/private storage on the linked ATLAS production branch. All 17 migrations and 39 RLS tables are deployed after an expiring child rehearsal; atlas_api/atlas_worker credentials remain restricted and ignored. neon.ts declares private atlas-sources, and its branch AWS_* variables are wired into the server-side SDK. The running app reports PostgreSQL, Auth and Originals connected. Actual PUT/HEAD/GET/hash and anonymous403 were verified. See NEON_DOMAIN_SETUP_REPORT.md.

Commands: pnpm neon:setup:domain rehearsal, then pnpm neon:setup:domain production; pnpm neon:verify:storage. Production refuses a missing/mismatched rehearsal receipt, and repeated matching runs verify checksums without changes. The generic migrate.ts neon runner remains disabled; use the checked setup command. Local test suites still accept only atlas_test. The expiring child branch is recorded in docs/neon-target.json; the local link remains production.

Personal owner binding is the only setup identity still deferred. pnpm owner:bind:neon is prepared and requires explicit ATLAS_OWNER_ISSUER/ATLAS_OWNER_SUBJECT plus a transient ATLAS_OWNER_TOKEN from the real managed Auth session. It verifies the exact branch token, binds the owner, saves only issuer/subject to ignored .env.local and requires an API restart. It has not been run for a real owner, never picks a test/first-visitor account, and never stores the JWT. No further account information is requested during independent work. /ready stays503 until actual owner/product readiness; this does not mean Neon services are disconnected.

N03: the actual personal account is now bound. Setup used its fresh genuine-JWT connection-check receipt joined to managed Auth, selected explicitly by the administrator after the user's Done. The administrator-only command is node --import tsx scripts/bind-owner.ts neon-receipt <explicit-email>; it refuses missing/ambiguous/stale/wrong/synthetic proof and never accepts a receipt body from HTTP. Direct fresh-JWT binding remains supported separately. No password/token is needed in chat. Actual owner metadata is saved and the API restarted; refresh/sign in in the browser used for login. /ready remains an overall unreleased-product signal, not the owner-binding indicator.
