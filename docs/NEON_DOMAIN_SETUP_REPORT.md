# N02 — completed live Neon backend setup

Verified 2026-10-17 (Asia/Taipei) after the owner explicitly requested completing Neon setup. This supersedes the earlier deferred database/schema/storage gate. Actual personal owner identity remains unselected; no synthetic account was promoted.

## Live target

- ATLAS - Personal / misty-fire-28366774, organization org-floral-darkness-38230607.
- production / br-withered-recipe-azwll09c, Singapore aws-ap-southeast-1, PostgreSQL18/neondb.
- All 17 checked-in migrations 0000–0016 deployed;39 atlas_owner-owned tables with RLS enabled.
- atlas_owner: NOLOGIN/non-superuser/non-BYPASSRLS. API/worker: restricted pooled logins, no elevated memberships. The migration administrator alone may assume the table-owner role.
- Existing managed Auth preserved. Private bucket atlas-sources created and confirmed access_level=private.
- Restricted worker URL and branch AWS_* storage configuration saved only in ignored .env.local; no passwords/keys printed.
- Rehearsal branch br-little-wave-az86ax08 / atlas-setup-check-20261017, parent=production. Expires 2026-10-18T04:00:00Z (October 18 noon Taipei). Local .neon link remains production.

No other project, AI Gateway/model provider, public hosting, MCP client, Windows startup, commit or push was changed. Existing platform-default credential metadata was inspected, not activated as an AI service.

## Command evidence

```text
neon branch create ... --name atlas-setup-check-20261017 ... --no-secrets
Created br-little-wave-az86ax08 with expiry.

node --import tsx scripts/setup-neon-domain.ts rehearsal
rehearsal: 17 domain migration(s) applied; checksums verified.
Rehearsal: real non-owner connections enforce workspace isolation
(1 workspace / 72 own collections), missing-context denial and private credential denial.
rehearsal: 39 atlas_owner tables have RLS; API/worker are restricted logins;
private credentials denied.

node --import tsx scripts/setup-neon-domain.ts production
production: 17 domain migration(s) applied; checksums verified.
production: 39 atlas_owner tables have RLS; API/worker are restricted logins;
private credentials denied.

neon deploy --project-id misty-fire-28366774 --branch production
Applied changes
  + bucket atlas-sources
Pulled 9 Neon variables into .env.local

neon bucket list ... --branch production
atlas-sources: access_level=private

neon config plan ... --branch production
No changes — branch production already matches the policy.

pnpm neon:setup:domain production
production: 0 domain migration(s) applied; checksums verified.
production: 39 atlas_owner tables have RLS; API/worker are restricted logins;
private credentials denied.

pnpm neon:verify:storage
Private atlas-sources: PUT / HEAD / GET passed; exact UTF-8 bytes and SHA-256
metadata match; anonymous GET denied (403).
Removed only this run's synthetic verification object.

GET http://localhost:4317/api/v1/setup/services
{"database":"connected","auth":"connected","storage":"connected",
 "vault":"setup_required"}
```

The migration command checks the linked organization/project/branch, exact direct host/database/admin login, TLS and permitted URL parameters. Production requires a checksum-matching receipt from the complete migration rehearsal. Existing passwords are preserved, missing restricted worker credentials generated once, and application logins cannot assume atlas_owner. The API does not use the admin connection. Repeated production runs verified checksums and applied zero changes.

The expiring rehearsal branch has two deliberately synthetic application owners to prove real SQL isolation. These fixtures were never inserted into production. Production tests verify missing-context/private credential denial; actual personal owner acceptance is separate.

The server-side @aws-sdk/client-s3@3.1152.0 client uses the explicit branch endpoint, private server credentials, path-style addressing and SDK SigV4. The live storage script creates one unique synthetic object, checks HEAD byte count/SHA-256 metadata, downloads and compares every byte, and requires an anonymous read to fail. Cleanup rechecks its run marker and deletes only that exact created key. The check was repeated successfully; existing objects were not listed or deleted. App service status performs HeadBucket and shows redacted Originals status. This does not implement S09's capture/reconciliation/editor features.

Reference: official [Neon S3 compatibility](https://github.com/neondatabase/website/blob/main/content/docs/storage/s3-compatibility.md). Actual behavior above was verified live.

## Final checks

| Check | Observed result |
| --- | --- |
| npm run build | Exit 0; 2343 modules; Vite 3.53s |
| pnpm typecheck/lint/format:check | Exit 0; strict TS;84 linted/83 formatted source files |
| pnpm verify:bundle |5 browser JS bundles; no server-only markers |
| pnpm test:unit |61 passed in 6 files, 3.09s; includes 9 target-guard cases |
| pnpm test:db |63 passed in 4 files, 31.49s; local target only |
| pnpm test:e2e |6 offline foundation browser tests,15.8s |
| pnpm test:owner-browser |2 controlled owner browser tests,9.2s |
| pnpm test:neon |1 real Auth/SQL test passed,8.8s (test5.8s) |
| Live storage | Real PUT/HEAD/GET, byte/hash match, anonymous403; repeated successfully |
| Source brief SHA256 | Unchanged BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A |

133 distinct tests passed. Migration/storage scripts are additional evidence, not added as invented test counts. Live Auth reused the existing synthetic account: wrong-password rejection, sign-in/out/reload, genuine JWT acceptance, invalid-token denial, committed per-identity receipt across connections, actual Auth profile and cross-identity SQL denial. No real owner was selected, email setting changed or live token/password recording enabled.

Resolved issues: initial sandbox token-refresh-lock denial, parseEnv optional-value typing, literal-array inference, a redundant Boolean lint and unsafe-finally throw. No checks were weakened. Existing upstream peer/deprecation warnings, Playwright color warnings and an informational Vite plugin-timing warning remain; no unresolved setup/build/test failure.

The real preview was refreshed and runs manually at localhost4317 (session79834); health200. The local test database is stopped afterward with its volume preserved. No startup service.

## Personal step still deferred

owner:bind:neon is prepared but has not been run: it requires an explicit owner issuer/subject and fresh JWT verified against this branch, binds the single owner and saves only owner metadata. It never persists the JWT. No first visitor/test user was chosen automatically. Thus vault=setup_required and /ready503 remain until actual owner binding and remaining product readiness. Neon infrastructure itself is connected; C1 actual-owner organization acceptance remains pending.

