# K01 durable knowledge capture — completed

2026-10-17, Asia/Taipei. Local source of truth: `Vault/`. Approved handoff: `docs/plans/2026-10-17-agent-knowledge-quality-implementation-plan.md`.

## Result

Agents now have a capture policy and structured local records for preferences, constraints, decisions, lessons and stable project facts. Each subject has a stable key, owner/project scope, applicability, evidence basis and supported exceptions/rationale. Normal capture may result in no save. Routine implementation/build logs stay in project reports; legacy notes remain available as activity.

Default project context returns current owner preferences/constraints plus that project's knowledge, with concise marked projections and paths to full Markdown. `detail=full` returns complete bodies; direct edits also return full current bodies with a source-changed warning. Candidates, conflicting heads, superseded claims, archived records and other-project facts do not enter default knowledge context. Explicit `context_mode=activity` retrieves legacy history. The budget applies to serialized selected notes; envelope/warnings add overhead. Retrieval is lexical, not semantic/vector search.

Corrections create immutable linked versions using the prior ID and actual file digest. Same-request retries recover/reuse records; same concepts deduplicate across agent identities and owner captures originating in different projects. Conflicts/cycles/missing version targets are reported instead of resolved by timestamp. New frontmatter contains only flat scalar/list properties; old nested provenance still reads. Plain Markdown/direct edits remain supported, and Templates is excluded from scanning.

The app provides Knowledge, Activity and All files views with URL-persistent selection, semantic/evidence labels and full note detail. Original project/file links and G01/G02 3D graph mechanics remain. Actual local preview was refreshed after the API restart and the real owner knowledge-quality record was inspected, including conditions, exceptions, evidence and body. The initial stale browser cookie correctly required the documented page refresh after the API restart; refreshed reads succeeded.

## Existing data and extracted subjects

Fifteen original content files were hashed before execution. All remained byte-identical after capture and replay. This includes the nine planning-audit notes and later files already present at execution. No originals were moved, deleted, rewritten or relabeled on disk. The obsolete Neon handoffs remain historical activity. No cloud operation was performed.

Seven subjects were created/reused:

| Scope/key | Meaning / evidence |
| --- | --- |
| Owner / workflow.automatic-projects | Automatic ATLAS project/context management without manual setup forms; explicit owner request |
| Owner / workflow.local-knowledge | One local Markdown folder; later cloud sync needs an explicit request |
| Owner / workflow.atlas-reasoning | Existing agents reason; no separate model service for this knowledge workflow |
| Owner / workflow.knowledge-quality | Useful scoped context about preferences/constraints and reusable learning, without copied requests/completion logs |
| Portfolio / homepage.cards.visual-style | Current shared component/CSS has plain screenshot media without frame rules; parent cards remain a separate bordered/rounded surface |
| Portfolio / homepage.cards.mobile-descriptions | Current shared stylesheet hides descriptions only under max-width639px; not a universal preference |
| ATLAS / storage.windows-lock-contention | Windows NTFS delete-pending EPERM and bounded live-lock-safe retries |

Portfolio identity was checked against the existing normalized repository digest; its current component/CSS were read only. These are scoped source-code observations, not a fresh visual audit of that project or proof of a global aesthetic preference. The Windows lesson links current implementation/concurrency tests. Actual record paths/IDs are in ignored `.local/knowledge-distillation-receipt.json`; readable records are in Owner/Knowledge and each project's Knowledge folder.

`scripts/distill-local-knowledge.ts` defaults to dry-run, validates original hashes and uses stable requests. Two apply runs returned the same seven IDs. The real installed-MCP check reused the knowledge-quality seed, rather than adding synthetic acceptance notes to the personal vault.

## Verification

| Check | Observed result |
| --- | --- |
| Unit suite | 116 passed /11 files; final10.81s, including19 new knowledge cases |
| Local browser suite | 9 passed /41.5s; knowledge/activity/all, direct edits, search, keyboard, mobile/reduced motion, existing3D/orbit/pan/zoom/touch/expanded graph checks |
| Historical offline browser suite | 6 passed /22.3s; no live Neon/Auth/storage access |
| Total automated cases | 131 distinct:116+9+6 |
| Strict typecheck | Passed |
| Lint / formatting | Passed,119 lint/118 format files at verification |
| npm run build | Passed,2351 modules; final build5.77s (Tailwind/Rolldown informational timing notice) |
| Browser bundle boundary | 5 JS bundles checked; no server-only markers |
| Distillation/replay | 7 subjects, stable IDs;15 original content files unchanged |
| Real installed local MCP | Original project identity retained; exact Markdown/retry; fresh-process summary/full retrieval passed |
| Global instruction install | One revised ATLAS block; unrelated global instructions compared byte-for-byte outside the block; unrelated MCP servers retained |

Actual fresh-process SDK output:

```text
PASS: installed MCP finds the migrated local project with its original ID.
PASS: durable knowledge is exact local Markdown; retry deduplicates.
PASS: a fresh MCP process retrieves scoped summaries and full detail, excluding activity.
```

Receipt: `.local/knowledge-roundtrip.json`. The existing protected Windows launcher was used from an unrelated working directory; no credential was exported/printed. Local API health returned storage=local and agent_ready=true after an identity-checked restart. Browser fixtures blocked external origins in the direct-edit case and observed none. Runtime knowledge does not require internet; the whole PC was not disconnected.

## Corrected failures and limits

- Initial typecheck caught a type-only Zod import used as a runtime value. Fixed the import. Refined tool schemas use the installed Zod safeExtend API.
- Semantic markup/style checks required a fieldset/legend and scoped class selectors. Fixed those without disabling rules. A concurrently introduced graph-navigation test needed an explicit final-sample guard and fixture counts reflecting the added activity/candidate files; its interaction assertions remain intact.
- The first116-case run passed115 but an existing independent-process test exceeded its5-second runner deadline. A later run hit the existing Git identity fixture's same deadline. Runner workers are now bounded to2; subprocess test deadlines match their own native-operation bounds. Explicit competing-process/concept assertions were preserved. Final suite passed116/116; no assertion was removed to mask a functional failure.
- Build/test logs and source references are operational evidence here, not new automatic vault completion notes. No extra summary checkpoint was created for merely finishing this milestone.
- Structural validation cannot prove faithful interpretation of human intent. Historical/inferred claims remain candidates; a source-code fact is not human confirmation of a preference. Direct filesystem access remains governed by Windows permissions; this is not per-agent OS isolation.
- Existing long-lived MCP processes can retain old tool schemas. Fresh installed processes are verified; the updated scoped helper/direct-file template supports older chats. Other agent hosts require their own configuration.
- Advanced semantic memory/review, embeddings, broader ingestion and backup/restore products remain separate work. No new dependency, model API, cloud write, startup service, deployment, commit or push.

Instruction precedence was checked using the OpenAI Docs skill and [official AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md): global guidance is layered with project instructions, while an override takes precedence at its level. No global override was present. The installer preserved unrelated instruction text exactly and took a fresh K01 backup before installation.
