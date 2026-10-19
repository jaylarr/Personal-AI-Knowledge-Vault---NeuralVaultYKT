# Active implementation index

Authoritative plan: [Revision 2 handoff](plans/2026-10-16-atlas-implementation-plan.md).

The owner authorized proceeding with local implementation on 2026-10-16. S01–S05 are locally verified; N01 Neon PostgreSQL/Auth diagnostics are live-tested; next is S06 permission policies. Work proceeds in the documented dependency order, with S21 before S15. Do not attempt advanced features before their prerequisites.

No separate AI API is required. Existing agents organize authorized sources through MCP; deterministic local services persist and retrieve knowledge. Missing agents leave tasks awaiting processing.

External setup E01–E03 remains pending: dedicated Neon project, branch/Auth/storage/role provisioning, live migrations, owner binding and actual MCP client registration. There is no authorization to use unrelated existing projects, publish, install startup services or commit/push.

2026-10-17 override: N01 request explicitly selected org-floral-darkness-38230607 / misty-fire-28366774 / production with PostgreSQL/Auth. Those services are deployed, wired and live-tested; see NEON_SETUP_REPORT.md and neon-target.json. This replaces the new-project/atlas-dev proposal for this setup only. It does not mark full vault schemas/owner binding/storage/MCP gates complete.

See [TASKS](TASKS.md), [PROGRESS](PROGRESS.md), [DECISIONS](DECISIONS.md), [TEST_REPORT](TEST_REPORT.md) and [SESSION_LOG](SESSION_LOG.md) for execution evidence. The original handoff is preserved; this index and execution records distinguish planned behavior from implemented behavior.

Execution refinements: added `0000_foundation.sql` for owned schemas before S05 domain migrations; used pnpm 11 `allowBuilds` instead of removed legacy settings. Future feature-specific commands are added with their actual implementations rather than introducing empty/passing placeholder scripts. MCP workspace currently contains its strict configuration parser only. No knowledge functionality or personal-release readiness is implied by C0.

S05 adds 0009–0011 integrity migrations after 0001–0008: immutable history/evidence/cycles/task identity, normalized checksum and preserved superseded submissions. 0007 currently only enables RLS and denies application grants; S06 must add a new appended policy migration to preserve the verified local checksum history. Domain SQL is tested locally and is not deployed to Neon. See SCHEMA.md for code-point offset convention and verification.
