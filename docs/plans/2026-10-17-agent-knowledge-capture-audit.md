# Agent knowledge capture audit

Date: 2026-10-17, Asia/Taipei. Planning evidence only; no vault note was edited, reclassified, moved or deleted by this audit.

Vault: `C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT\Vault`.

## What was observed

At initial inspection there were 12 content files: 3 project pages, 1 collection catalog and 8 agent notes, totaling 5,958 body characters. During planning another project agent added a debug-plan handoff. The final checked snapshot at 12:32 Asia/Taipei has 13 content files and 9 agent notes, totaling 6,950 body characters: four `progress`, three `handoff`, and two `decision`. Seven of nine notes are activity/handoffs. The two decision notes also mix durable owner choices with implementation and testing details. There is no owner-context folder, preference/constraint record contract, or explicit supersession of old knowledge. Counts are a dated snapshot; agents are actively writing.

`createLocalVault.context` selects the current project's notes by newest `created_at`, applies an optional literal query and returns whole records until its budget is exhausted. It does not distinguish durable knowledge from activity, include owner preferences across projects, or resolve contradictory decisions. The ATLAS project therefore retrieves both former Neon setup claims and the later local-storage decision as separate notes. The latter text explains the change, but the service does not enforce that relationship.

The current save instructions explicitly request decisions, lessons, **verified progress and handoffs**. The schema validates structure, lengths and recognizable secrets; it does not extract durable knowledge from an agent's prose. This explains why otherwise compliant agents produce completion reports.

## Inspected notes and proposed disposition

Paths below are relative to `Vault/`. Hashes are SHA-256 of the original file bytes at inspection. They are preservation evidence, not authorization to overwrite a changed file.

| Original note / ID | Observed content | Proposed treatment during later implementation |
| --- | --- | --- |
| `Projects/personal-ai-knowledge-vault-neuralvaultykt-6b650cd7/Notes/atlas-agent-first-workflow-on-this-windows-pc-81a53782.md` / `81a53782-af09-46e0-b6c0-1bc722b2ef37` | Useful owner choice about automatic project context/capture, mixed with A01 implementation/tests | Preserve unchanged. Link a new owner workflow record to it; corroborate the preference with current human-supplied ATLAS instructions. |
| `Projects/personal-ai-knowledge-vault-neuralvaultykt-6b650cd7/Notes/automatic-project-knowledge-completed-a01-cbc161b3.md` / `cbc161b3-bbaf-44d8-a95e-054921218115` | Historical completion report describing former Neon persistence | Preserve as legacy activity. Never use it as the current storage architecture. |
| `Projects/personal-ai-knowledge-vault-neuralvaultykt-6b650cd7/Notes/local-markdown-vault-is-the-source-of-truth-b73c59e0.md` / `b73c59e0-4636-4585-bbdf-145106f7dda2` | Durable local-file owner decision mixed with migration/tests | Preserve unchanged. Distill local storage as a scoped preference/constraint, supported by the actual owner instructions. |
| `Projects/personal-ai-knowledge-vault-neuralvaultykt-6b650cd7/Notes/local-vault-and-file-graph-verified-369ee6a5.md` / `369ee6a5-cea0-4119-adab-3fabbe16c3e9` | Detailed milestone handoff and verification | Preserve as activity. Keep implementation/test evidence in the project reports instead of copying it into new preference records. |
| `Projects/personal-ai-knowledge-vault-neuralvaultykt-6b650cd7/Notes/connected-local-workflow-and-incomplete-scan-protection-verified-ca7c016a.md` / `ca7c016a-88b4-4de5-a338-4fb3ed938c7c` | Completion/verification note with a potentially useful concurrency lesson | Preserve as activity. A later verified lesson can state the NTFS lock condition, remedy and applicability, linking the code/test evidence; do not reproduce all test totals. |
| `Projects/professional-portfolio-53d7ac8f/Notes/hide-homepage-project-descriptions-on-mobile-c9061b36.md` / `c9061b36-e055-4a06-9732-7ef94f449e69` | Report of a project-specific mobile description rule | Preserve. Candidate project fact until the current portfolio CSS is checked. It does not establish a universal owner preference to hide descriptions. |
| `Projects/professional-portfolio-53d7ac8f/Notes/plain-homepage-project-and-automation-cards-7edfe2ea.md` / `7edfe2ea-c201-47aa-a23f-a51851cd2010` | Reports removing scenery, perspective, glow and media zoom | Preserve. Distill together with the next note as a project-specific visual fact, with explicit scope and evidence status. No unsupported claim that the owner dislikes all animation or decorative design. |
| `Projects/professional-portfolio-53d7ac8f/Notes/remove-screenshot-frames-from-homepage-cards-690796c0.md` / `690796c0-8cfd-4496-8105-a64e1b5e7a04` | Reports a later frameless screenshot treatment | Preserve. This later report refines the earlier neutral-border treatment. A single resulting project fact should describe frameless screenshots and cite both reports, rather than returning two competing current styles. |
| `Projects/professional-portfolio-53d7ac8f/Notes/loading-and-homepage-scrolling-debug-plan-6ca986ab.md` / `6ca986ab-e221-413b-beae-a0a897c9f161` | Arrived during this audit: mixes observed loader/scroll diagnostics, a suspected cause and proposed unimplemented fixes | Preserve as activity. Link the actual debug plan on demand; do not promote its likely cause or planned fixes to a current verified fact or owner preference. |

| Note ID prefix | Original SHA-256 |
| --- | --- |
| `81a53782` | `9529a49e3bf2e22b1aebc7af678c32db0b5c470deca87b21df85df2211ee22ac` |
| `cbc161b3` | `a241e9b44f8498ed497e40e19024e58170e67728569498411999c54e2e22a1ae` |
| `b73c59e0` | `cb9802614686d60ce4266c655dcbe0b4e0ee8a7e21614d8ed17646dab83fbbd3` |
| `369ee6a5` | `5165300a7e28e35f974ad2871eaff3435561af24dc9a32662b53d2afa6fc748a` |
| `ca7c016a` | `5fc3c04764c675e7451a4e417a80967adb98b223f08d8ff78e68b5733272c3cf` |
| `c9061b36` | `b4f83bf26808339edc7fa9ce9dd3cc408121219308d84e2ee001dfa257683670` |
| `7edfe2ea` | `f9f5634927a9d59b7c10923b0d365fb81a87d5263267ba6a54b5f3eea531d2f3` |
| `690796c0` | `dc5d163903862bd288dc19811627bfb01f07e9a650ee0525b4834eea1a1ea8e4` |
| `6ca986ab` | `1b1e21fdb3beb414417b65e476e0110a1fc6156fee8d50f1dc66671f13667e52` |

## What Obsidian actually provides

Checked official documentation on 2026-10-17:

- [Data storage](https://obsidian.md/help/data-storage): a vault is a local folder of Markdown files; external edits refresh automatically. Obsidian also maintains local settings and a rebuildable metadata cache. The files remain the source data.
- [Properties](https://obsidian.md/help/properties): YAML frontmatter provides typed text, lists, numbers, checkboxes and dates. The Properties editor does not support nested properties; nested YAML can be viewed in source mode. New ATLAS knowledge should therefore use flat scalar/list properties while retaining support for older nested provenance.
- [Internal links](https://obsidian.md/help/links): notes can use wikilinks and Markdown links, with vault-root folder paths and forward slashes. Links in YAML properties need quoting.
- [Backlinks](https://obsidian.md/help/plugins/backlinks): linked mentions identify notes referring to a note; unlinked mentions are textual occurrences. Textual similarity alone is not an explicit relationship.
- [Graph](https://obsidian.md/help/plugins/graph): nodes represent notes; edges represent internal links. Graph filters can distinguish subsets. A graph cannot establish whether a preference is accurate or broadly applicable.
- [Templates](https://obsidian.md/help/plugins/templates): templates insert predefined note text/properties. They do not determine which parts of an agent's work are worth remembering.

The conclusion that ATLAS needs a capture policy, scopes, evidence and retrieval rules is this audit's design inference. These are not requirements prescribed by Obsidian, and no single mandatory Obsidian knowledge methodology is claimed. No Obsidian plugin installation or configuration was performed.

## Baseline checks and concurrent work

- `pnpm lint`: passed at initial inspection, 109 files.
- Targeted existing tests: `pnpm exec vitest run --config tests/vitest.unit.config.ts tests/unit/local-vault.test.ts tests/unit/agent-workflow.test.ts` — 23 passed across 2 files, 6.73s. Fixtures only; no knowledge migration or cloud tests.
- First `pnpm typecheck`: failed because `LocalApp.tsx` imported a not-yet-present `KnowledgeGraph.js`. During read-only inspection, `KnowledgeGraph.tsx`, `graph-space.ts` and graph styling appeared; the project is being changed concurrently. A subsequent typecheck passed. Preserve this new graph work and recheck at execution start.
- `master` is an unborn branch: no `HEAD` commit exists and the application files are untracked. Git cannot restore this baseline. Never use reset/clean as recovery.
- No browser/build/cloud acceptance was rerun for a feature that has not been implemented. Prior L01 results remain historical evidence.
- The initial eight original hashes were checked again at 12:32 and remained unchanged. The ninth newly arrived note was read and hashed separately. Read-only current portfolio CSS inspection confirmed the mobile description rule and distinguished screenshot treatment from the still-bordered/rounded parent cards; no browser verification or portfolio change was performed.

## Proposed capture examples

These are illustrative planning text, not new saved memories.

**Owner workflow preference, supported by the owner's current instructions:** Agents should find/create the current repository's project and capture useful knowledge automatically, without project setup forms. Scope: work using this Windows ATLAS vault. Reason: reduce repeated manual context entry. Boundary: this does not authorize unrelated deployment, credential changes or external writes.

**Portfolio project fact, currently supported by historical agent reports:** Homepage Selected Projects and Automation cards were reported as using plain screenshots with no scenery and, after the follow-up, no decorative frames. Keep this scoped to that portfolio's homepage; verify its current CSS before treating it as a current fact. Do not infer a global aesthetic preference or a motive that was never stated.

**Technical lesson, subject to current code/test verification:** Concurrent NTFS lock creation may report `EPERM` while a prior lock is pending deletion. Bounded retries can handle that transient state without stealing a live lock. Applicability: the ATLAS Windows file writer. Evidence: `packages/core/src/local-vault.ts` and its concurrency tests. Exact build durations and cumulative test counts do not belong in the lesson.
