# L01 — local Markdown vault and working file graph

2026-10-17, Asia/Taipei. Current source of truth: C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT\Vault.

The graph was previously unimplemented: every navigation path rendered the same organization/setup view. Existing data alone could not make it appear. L01 implements a real graph and switches normal knowledge storage to local files, following the owner's new requirement.

## Delivered

- A single Obsidian-style folder: Projects/<name-id>/Project.md, project Notes/*.md, Collections.md and .atlas/ for observed file history, retry receipts and the historical migration snapshot. YAML properties preserve identity, provenance and authorship; bodies remain ordinary Markdown. Direct edits/plain files appear during the four-second foreground refresh cycle.
- Project registration/context/checkpoint MCP tools now use the local file API. Direct folder access is also supported; global Codex AGENTS and Vault/AGENTS point to this folder. Routine project/knowledge creation remains automatic. No separate AI API or database is required for normal operation.
- Local app bootstrap uses no Neon account flow. The launcher no longer loads .env.local and strips cloud-related environment fields before starting the file API. Existing protected credential is used only in memory for agent writes; no credential-derived metadata was exported/persisted. The local browser uses a strict session cookie with loopback Host/Origin/Sec-Fetch checks.
- /graph displays actual project membership, [[wikilinks]], aliases, frontmatter links and relative Markdown links. Missing/ambiguous targets produce notices rather than invented nodes. Zoom, native scroll/swipe panning, keyboard pan buttons, node/file selection and a readable file list work. This is a basic file graph, not the pending semantic/entity graph.
- Exclusive atomic NTFS file publication and per-vault process locks serialize tool writes. Stable IDs, content/request deduplication, crash-retry receipts and no-overwrite behavior preserve existing/user-edited files. Observed versions are content-addressed under .atlas/history. Paths/junctions/symlinks/device names are checked; malformed/duplicate metadata is preserved and reported.

## Migration and preservation

Stopped only the verified old ATLAS cloud-mode API. Read-only repeatable-read export on the exact existing ATLAS target was taken again after stopping it. Both exports found 3 projects, 3 checkpoints and 72 collection definitions, with zero source/memory/entity/relationship records. All project IDs and exact checkpoint Markdown were verified after import. Collection definitions are preserved in readable Collections.md and in the full historical export inside Vault/.atlas/import/.

No cloud row, Auth account, bucket, project or resource was deleted/updated. Old Neon copies remain. Normal local operation performs no cloud knowledge writes/sync. The new local-storage owner decision was then saved as a real Markdown note and retrieved from an independent MCP process. Historical A01 notes remain dated evidence of the former design.

Vault/ is ignored by application Git to prevent accidentally publishing personal knowledge. It is the source of truth even though ignored; agents can use direct file paths or rg --files --hidden --no-ignore with .atlas/.obsidian excluded for discovery. No commit/push/public deployment or startup service.

## Actual checks

| Check | Result |
| --- | --- |
| pnpm test:unit | 93 tests /9 files passed,6.03s |
| Local browser suite | 2 passed,final13.1s; real local-file fixture API, external browser requests blocked; visible nodes checked after mobile resize |
| pnpm test:e2e | 6 historical foundation cases passed,9.3s; explicit cloud compatibility mode without real cloud credentials |
| npm run build | Exit0;2347 modules; final viewport-aware UI build3.00s |
| Strict types / lint / format | Passed; no rule/strictness disabled |
| Read-only import | 3 projects/3 exact checkpoint bodies/72 collection definitions verified; cloud unchanged |
| Installed local MCP | Migrated project ID retained; actual Markdown bytes confirmed; same request deduplicated; fresh process retrieved it |
| Connected chat MCP | All three actual tools succeeded: start retained original project ID, save created a local Markdown note, context retrieved the same note; file presence confirmed directly |
| Live preview | Actual in-app /graph after final continuation:12 files/11 real connections; other project notes are appearing in the same folder; no managed Auth sign-in needed |
| Source brief hash | Unchanged BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A |

Exact installed MCP output:

```text
PASS: installed MCP finds the migrated local project with its original ID.
PASS: knowledge is an exact-content local Markdown file; retry deduplicates.
PASS: a fresh MCP process retrieves the note from the same local folder, without Neon.
```

101 distinct automated cases in this turn:93 unit +2 local browser +6 historical browser. Old SQL/Auth/storage suites were not relabeled as rerun. New tests cover independent Node-process concurrency, duplicate retry aliases/conflicts, direct edits/history preservation, ordinary Markdown, links/aliases/code-fence exclusion, missing/ambiguous links, traversal/symlinks/devices, malformed/duplicate IDs, byte/secret bounds, archived projects, dead-process lock recovery and local session/origin/credential checks.

Browser checks cover graph node selection by keyboard, zoom, file search (including references), direct edits appearing automatically, reload persistence,390px/320px and enlarged text/reduced motion. Browser observed zero external origins. Offline operation follows the local-only runtime path; the whole PC's internet was not disabled. Controlled screenshots are in .artifacts/local-browser; actual imported data was separately inspected in the running in-app preview.

## Corrected failures and limits

- Final continuation verified the actual ATLAS tool now connected in this chat: atlas_start_project returned storage=local, the original project ID and local Markdown context. Rebuilt/restarted only the identity-checked ATLAS API; /health returned storage=local and agent_ready=true. Added two size/depth regressions: incomplete scans refuse automatic project/checkpoint writes, preserving files instead of risking duplicates. Initial regression assertions incorrectly assumed an empty receipt directory existed; corrected to verify that no receipt directory was created. Concurrent Windows lock acquisition also exposed an NTFS delete-pending EPERM; bounded retries now handle that state without stealing a live lock. Final93 unit cases and2 browser cases passed.
- Automatic approval review rejected the first export because it also attempted to persist a credential digest. Removed that query/output entirely. The permitted safer export is knowledge-only; no credential-derived file was created. No approval remains blocked.
- Sandbox denied NTFS hard-link publication. Authorized filesystem execution passed; production writes use the same proven atomic path. Exact YAML2.9.1 installed; existing upstream Auth peer/deprecation warnings remain historical dependencies.
- SVG/React typing, semantic-element lint and type/import issues were corrected without disabling checks. First local browser search assertion expected only a title match; full-text search correctly also matched a reference. Test now checks both results and a unique body query. Historical keyboard test now waits for runtime bootstrap before tabbing.
- Visual inspection found tiny labels, then an offscreen canvas after mobile resize. Added readable canvas dimensions, pan controls and resize recentering; the final browser test checks that nodes intersect the visible canvas at each mobile size. Final desktop/mobile screenshots were inspected.
- Code formatting initially reached the generated imported JSON, changing whitespace only. Deep comparison confirmed identical data. Excluded the entire Vault directory from Biome, restored exact original snapshot bytes and required matching hashes before redundant staging cleanup. Markdown source files were unaffected.
- Local app assumes a trusted single-user Windows session. It is not multi-user OS isolation or cloud RLS over arbitrary direct file access. Agent notes remain unverified evidence; stored content is not executed. History covers versions observed by ATLAS, not every external editor keystroke or disk failure. Back up the whole folder.
- A pre-L01 long-lived MCP server process can retain its old compiled response schema until reconnected. Fresh installed MCP processes are verified; the updated scoped helper and direct local files work for older chats. Global Codex instructions were updated without changing unrelated servers.
- Scans are bounded:2MiB/file,16MiB total,2000 notes,5000 entries/depth12; graph300 files. Notices expose truncation/problems; automatic writes fail closed when scans are incomplete. Advanced semantic memory/review, URL/binary ingestion, graph layout/filtering and scheduled backup/restore remain future work. Obsidian-compatible files/links were implemented; Obsidian itself was not launched.
