# Neural graph implementation progress

2026-10-17 · G03 · In Progress

2026-10-18 continuation:19 controlled functional and2 isolated performance cases pass. Recorded data/evidence semantics, bounded one/two-hop focus, source/review navigation, persisted view settings, touch/picking, reduced motion and resource checks are connected.500-node DPR1 ready2513ms/layout568ms/orbit60.3FPS; DPR2 High orbit30.7FPS with50.3ms p95 frame time;5000-node stress orbit60.4FPS/propagation46.5FPS. Controlled desktop/mobile/enlarged workspace screenshots were inspected. Actual browser access later returned: source controls, the preserved reader and the rendered WebGL graph were inspected. Expanded selection/provenance/Open file worked. A stale AX fallback message was superseded by fresh DOM/full-page screenshot evidence. The historical phase table below is preserved; current acceptance and device limits are in LOCAL_RELEASE_CHECKLIST.md/LOCAL_COMPLETION_REPORT.md.

| Phase | Status | Evidence / next step |
|---|---|---|
| 0 Audit | Completed | Existing architecture/reference source and editor preview inspected; strict baseline/build +116 unit/9 browser passed. |
| 1 Base scene | Completed | Actual WebGL renders without shader errors; native orbit/pan/wheel/touch, resize framing and loss/retry/no-WebGL browser cases pass. |
| 2 Data/layout | Completed | Typed validation/index/search and seeded worker geometry; empty/single/300 nodes rendered; unit determinism/incremental/anchor checks pass. |
| 3 GPU nodes | Completed | Batched Points, radial core/halo shader, selection ring and controlled native bloom visually inspected. |
| 4 Organic edges | Completed | One explicit-pair LineSegments batch with seeded anchored curves/flow; real 24-file/31-link scene inspected. |
| 5 Propagation | Completed | Actual outgoing adjacency, bounded queue, GPU traveling heads/trails/arrivals; pause/reduced/cancel unit and browser checks pass. |
| 6 Zaps | Completed | Bounded pooled 160ms ribbons, seeded jitter/optional high-tier branches, cooldown/disable/reduced checks pass. |
| 7 Interaction | Completed | Continuous held orbit, pan, wheel, touch/pinch and keyboard selection pass. Camera stays outside React frame state. |
| 8 UI | Completed | Search exact-title ranking, filters, inspector/settings overlays, compact controls; 768/390/320/300px responsive checks pass. |
| 9 Real data | Completed | Original same-origin API, URL filters, evidence metadata, direct edits and reader/reload/no-external-requests cases pass. |
| 10 Performance | In Progress | Four measured profiles and quality/replacement/resource cases running. |
| 11 Visual refinement | Pending | Compare reference; inspect desktop/tablet/mobile and capture evidence. |

Files/decisions: see NEURAL_GRAPH_ARCHITECTURE.md. No backend/cloud/file-content mutations.

## Implementation checkpoints

- Baseline local browser: all 9 cases passed (37.7s). Actual CodePen editor preview visually inspected; full-page view is unavailable because its owner has not verified their email. Editor preview shows luminous points/filaments against black, comparatively stronger warm bloom and a dense generated formation.
- Base: R3F 9.4.0 / Three 0.180.0 / @types/three 0.180.0 exact pins. Camera/damping/fit/pan/touch/cleanup/context boundaries compile. Native Three composer/bloom replaces the preferred wrapper: wrapper 3.0.4 has an unresolved declaration identifier; 3.2.0 needs a newer R3F peer and untyped n8ao. Neither strict checks nor skipLibCheck were weakened. Zustand/Drei/d3 are unnecessary here: bounded local state, native controls and seeded spatial-hash relaxation serve those responsibilities.
- Typed model/layout/effects: 8 new unit tests pass. Covers invalid/duplicate data, semantic dedupe/direction/components, seeded order-independent and incremental placement, exact curve endpoints, title/tag/summary search, real-edge BFS depth/cycles/arrival order, replacement/pause/bounds and 160ms zap envelope. Fixed duplicate reverse relations in the synthetic fixture after the initial validation test exposed them.
- GPU implementation under rendered validation: one point batch, explicit line-segment endpoint pairs, Gaussian pulse ribbons and short seeded zap ribbons. No sphere objects, per-edge timeout or per-frame React camera state. Responsive overlay shell integrated with existing real data; original file reader remains available through Open file.
- Verification: 124 unit tests pass. Functional browser cases now pass after fixing selection/URL update timing, exact-title search ranking, settings/inspector stacking and local-font CSP compatibility. Broad performance run still in progress. Fonts are emitted as local files; CSP is preserved. Lazy graph loading keeps its large GPU code off non-graph routes.
- Files: KnowledgeGraph.tsx, neural/{GraphCanvas,GraphScene,GraphPanels,GraphPostProcessing,model,layout,layout.worker,effects,geometry,shaders}, graph.css, LocalApp.tsx, local browser/unit tests, exact dependency lock and local favicon/Vite asset settings. Original SVG source/tests archived in ignored .artifacts/ for comparison.


## G04 follow-up

S01–S05 implemented: original shared theme, wider deterministic project volumes, unbiased curves/camera fitting and capped full-resolution MSAA pipeline.136 unit cases, strict/build/lint/format/bundle checks pass. S06 browser additions are typechecked but unrun; S07 visual/performance acceptance remains pending because local browser use is disabled in Work settings. G03 historical results above do not establish G04 acceptance. See GRAPH_THEME_SPREAD_REPORT.md.
