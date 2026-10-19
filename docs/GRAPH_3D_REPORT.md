# G01 — 3D knowledge graph

Follow-up G02: owner reported G01 dragging/orbit was not usable. Camera scheduling, pointer handling, stable framing and expanded/wheel navigation have been corrected and verified with held-pointer regressions. See GRAPH_NAVIGATION_FIX_REPORT.md; the G01 checks below remain historical and do not establish current interaction acceptance.

Owner request: 2026-10-17, Asia/Taipei. Local implementation; actual vault files and links remain authoritative.

## Implementation

Replaced the flat, horizontally scrolled SVG map with an interactive perspective projection of genuine XYZ coordinates. Project hubs and spherical note clusters use deterministic geometry; rotation changes depth, scale and relative positions. SVG renders depth-sorted shaded spheres, subtle halos, a projected reference plane, solid project edges and dashed explicit links. No new dependency, WebGL requirement, AI service or cloud write was introduced.

The graph now comes first on its page. Existing folder instructions, file list, search, selected-file reader and URL selection remain. Colors follow ATLAS charcoal, sage and cool gray. The ui-skills SaaS/dashboard family informs the compact framing and hierarchy. Existing local Geist 400/500/600 and IBM Plex Mono 400 are retained: graph title 14px/500, node labels 11px/400 or 500, controls 12px, metadata 9–11px. Labels avoid other labels, and full titles are available through focus/selection and the reader.

Controls include orbit/pan modes, rotation buttons, zoom, reset, titles and optional auto orbit (off by default). Camera changes use frame-rate-independent exponential easing (65ms time constant), then stop requesting frames. Reduced motion settles changes immediately and disables auto orbit. Optional orbit pauses for hover/focus/drag and stops updating offscreen or in hidden tabs. Observers, listeners and frames clean up on unmount. Touch uses its native implicit pointer capture; mouse dragging uses explicit capture. Touch controls are at least 44px and group into two rows on 320px screens. Focused nodes accept arrow keys, +/− and Home; Enter selects their real file.

## Verification

- `pnpm build`: passed, 2350 modules, 2.28s final build. Browser entry 323.26kB / 101.88kB gzip; no renderer package was added.
- `pnpm test:unit`: 97 passed across 10 files. Four new geometry cases cover deterministic 300-node layouts, empty/single/orphan files, perspective/rotation and responsive framing.
- Strict types, lint, formatting and browser/server bundle boundary checks: passed after the final toolbar fix.
- Browser suite: 6 passed together in29.2s after the final toolbar fix. Cases cover orbit/pan/zoom/reset/focus, reduced motion, continued multi-step touch drag, pinch zoom, native control taps/selection, empty and dense 300-node maps, direct Markdown refresh/reload, search, 320/390px overflow/control bounds and 200% root font size. Existing request isolation check observes zero external browser requests and zero page errors.
- Real local vault inspected in the Codex browser at desktop and 390px, with actual file counts changing as other local work saved notes. Controlled desktop, 320/390px, touch and dense screenshots are under `.artifacts/local-browser/`.
- Source brief SHA256 remains `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`.

## Failures and limits

Initial sandbox tests could not create NTFS hard links/junctions or temporary Git repositories. The authorized local test suites passed with permitted filesystem execution; no application storage protection was removed. Initial lint/format issues were corrected without rule suppression. Dense fixture retrieval initially lacked the local session cookie; it now establishes a normal browser session first.

Touch testing exposed bubbled lost-pointer-capture events when replacing native touch capture; corrected by retaining implicit capture and handling only the viewport's own lost capture. Raw CDP touch gestures followed by synthetic native taps also intermittently produced pointer down/up without a browser click. Gesture tests and native tap tests now use separate contexts; keyboard reset is verified after the raw gesture. The rapid mixed-input sequence is not claimed to pass. Physical iOS/Android touch hardware, screen-reader acceptance and sustained 300-node frame-rate profiling were not performed. The root-font enlargement check is not a claim of real browser 200% zoom.

This is a local visual/layout upgrade with the existing 300-node display bound. It does not implement semantic inference, edge editing, new storage, public hosting or backup/restore. Historical cloud integration evidence remains historical.

