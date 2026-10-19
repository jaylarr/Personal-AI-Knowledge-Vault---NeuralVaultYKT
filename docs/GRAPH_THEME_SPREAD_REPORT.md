# G04 — Original theme and volumetric graph

Implementation date: 2026-10-17. Local code implemented; rendered acceptance remains pending.

2026-10-18 update: controlled Edge acceptance now passes19 functional cases and2 isolated performance cases, including touch, picking/orbit, focus/trace preservation, actual one/two-hop data expansion, saved camera/type filters and malformed-state fallback.500 nodes/1000 edges atDPR1: ready2513ms/layout568ms/orbit60.3FPS,p95 16.8ms. AtDPR2 Auto High: ready2120ms/orbit30.7FPS,p95 50.3ms,effective DPR2.5000-node stress: ready5329ms/layout2214ms/orbit60.4FPS, propagation46.5FPS. Device: i7-8650U/UHD620/Edge155. These supersede the pending controlled checks below; actual browser access later returned: source controls, the preserved reader and the rendered WebGL graph were inspected. Expanded selection/provenance/Open file worked. A stale AX fallback message was superseded by fresh DOM/full-page screenshot evidence. See LOCAL_RELEASE_CHECKLIST.md and .artifacts/local-completion/graph/. This is not a full personal-release claim.

## Changes

The graph inherits the existing labelled sidebar, header, page heading, Refresh files action, fonts and responsive navigation. Its controls, inspector, reader and canvas now use the original charcoal/sage family. Other routes retain their original appearance; global additions are color aliases only. The independent violet-palette setting is removed; other stored preferences remain readable.

The layout places project categories throughout a rotated Fibonacci sphere and members around their actual project hub. Bounded anchor attraction, differentiated weak springs, collision sampling and a minimum hub radius preserve the volume instead of collapsing every relationship toward a 3.5-unit spring length. Existing positions stay fixed on incremental additions and view changes. The versioned layout payload includes node type/explicit positions; no layout or fabricated relationship is written to Markdown.

Curves share a seeded perpendicular basis between CPU geometry and GPU displacement, removing the previous directional bias. Camera fitting uses both horizontal and vertical field of view, preserves orbit direction, and extends the far plane for wider volumes.

High/Medium/Low cap DPR at 2/1.5/1, with 24/16/10 edge segments and supported 4/2/0 render-target samples. The composer keeps the renderer's actual resolution and uses a supported half-float target, falling back to unsigned-byte without bloom. Low renders directly with shader output conversion. Point edges/rings use derivative smoothing. Buffer/composer dimensions and samples are exposed as bounded DOM diagnostics for acceptance tests. Existing batched geometry, native controls and explicit scene lifecycle remain.

## Evidence

- Strict typecheck: passed after final changes.
- Unit suite: **136 passed in 13 files**, 38.87 seconds. Includes ten new distribution/curve/DPR cases, 32- and 200-member stars across three category seeds, two linked project volumes, deterministic order, stable incremental positions, finite curve bases and geometry contracts.
- Initial sandbox baseline: typecheck passed; unit suite had 33 permission-related failures in existing Windows file-store/agent fixtures. The permitted suite outside the sandbox passed, without changing those checks or storage code.
- Lint: passed with 18 CSS specificity warnings and one existing fragment informational diagnostic. No lint error or disabled rule.
- Format check: passed, 136 files.
- Build: passed, 11.16 seconds. The existing lazy GPU chunk size advisory remains (about 930 kB minified); it is not a new performance measurement.
- Browser bundle guard: passed, eight bundles, no server-only markers.
- Existing loopback preview: permitted HTTP checks returned 200 for `/health` and `/graph` on `127.0.0.1:4317`. A launcher attempt safely refused the occupied port; no other process was stopped or alternate port opened. Sandboxed HTTP checks were unable to access the listener and are not evidence that it was down.
- Original source brief SHA256 remains `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`.
- Task-owned recovery copies and prior evidence: `.artifacts/g04-baseline/`. Current command evidence: `.artifacts/g04-{typecheck,unit,lint,format,build,bundle}.txt`.

## Pending acceptance

CUA reports **Local browser use is disabled in Work settings**. No alternate browser automation was used to bypass that setting. The new seven browser cases in `tests/local-browser/graph-theme-resolution.spec.ts` are written and typechecked, but have not run. Existing local-browser and compatibility browser suites were not rerun for G04.

Still required: actual desktop/tablet/300–390px visual comparison, normal/expanded and inspector/file-reader inspection, held orbit/touch/picking regression, DPR1/DPR2 renderer/composer measurements, quality-cycle/context cleanup, sparse real-vault inspection and 100/500/1500/5000-node FPS/p95/load measurements. Previous G03 screenshots and benchmarks remain historical; they do not verify G04. In particular, no new smoothness/FPS or rendered anti-aliasing claim is made.

G04 remains In Progress until these browser checks and any resulting fixes are complete. Resume with the saved plan's S06–S07, build before browser tests, keep timed benchmarks separate from other tests, and inspect screenshots before acceptance. No backend/cloud/credentials/business-note changes, new dependency, public deployment, startup installation, commit or push occurred.
