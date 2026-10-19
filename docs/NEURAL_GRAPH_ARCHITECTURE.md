# Shader-driven neural graph

2026-10-17. G03 implements the owner's attached Shader-Driven 3D Neural Constellation specification. Local implementation only; existing local vault API, review state and file access remain authoritative.

## Phase 0 audit

React 19.3.1 / strict TypeScript / Vite 8.3.4. The existing graph is CPU-projected SVG with React camera updates, not WebGL. LocalApp reads the same-origin validated localSnapshot contract and polls every four seconds. No backend change is required. Existing search, file reader, filter/deep-link and source provenance must survive.

Baseline: typecheck, lint, format, build pass; 116 unit tests pass. Local browser baseline running; results recorded in progress. Original source brief remains unchanged.

Reference inspected: [CodePen source](https://codepen.io/ownikiyj-the-bold/pen/OPyRzdQ), [full view](https://codepen.io/ownikiyj-the-bold/full/OPyRzdQ). Source uses Three 0.162, Points/ShaderMaterial, additive radial point fragments, fine procedural connections, fog, OrbitControls and UnrealBloomPass. Its three expanding spatial shells affect nodes/edges by distance, rather than traversing graph adjacency. It generates decorative formations and thousands of background stars. We implement original shaders and seeded geometry, not copied source/noise routines. A license was not established; no reference code is vendored. Full-view access initially timed out; source observations are distinguished from visual inspection.

## Browser architecture

- Stable R3F 9 (React 19), Three WebGLRenderer and GLSL ShaderMaterial, not R3F 10 alpha/WebGPU. Exact registry peer compatibility checked before installation. [R3F compatibility](https://r3f.docs.pmnd.rs/getting-started/introduction).
- Typed browser-only adapter/validation/index/search/layout modules. Source membership maps to part_of; explicit file links map to references. Link origin is reported verbatim; absent semantic confidence/review are unknown, not fabricated verification.
- Worker-bounded deterministic category/link/collision layout, cached by node identities. Filtering/search/selection never rerun layout. Positions reused across polling and incremental additions.
- One Points batch, one LineSegments batch with explicit endpoint pairs, bounded pulse/ribbon/zap batches. Mutable GPU attributes/uniforms carry high-frequency state outside React.
- Single bounded BFS scheduler, actual adjacency/direction, depth 2 (max 3), visited set, replacement cancellation, pause-aware clock. Real-edge Gaussian moving heads/trails and arrivals; deterministic brief pooled zaps with cooldown. No per-edge timers.
- OrbitControls native pointer capture/damping, CSS-pixel picking, click/drag threshold, orientation-preserving focus/fit. Compact DOM controls, searchable accessible node list and inspector.
- Shared postprocessing, capped DPR, quality tiers and measured adaptive downgrade. Offscreen/hidden/paused rendering suspends idle work; full cleanup and context-loss recovery/fallback.

The graph does not invent production relationships to imitate reference density. Clearly labelled synthetic benchmark/sample data is isolated from vault persistence.

## Verification

Each phase is tracked in NEURAL_GRAPH_PROGRESS.md. Unit coverage targets data validation, deterministic layout/curves, direction/cycles/depth/cancellation, timing/pause/zap bounds and search. Browser coverage targets actual rendered WebGL, continuous mouse/touch controls, picking, UI/search/filter/reader preservation, pause/reduced motion, recovery, responsive views and bounded renderer resources. Benchmark hardware/results and visual observations are recorded separately from targets.


## G04 theme, volume and resolution follow-up

The original shared ATLAS shell and charcoal/sage theme supersede G03's independent navy/palette design. Browser-only graph-theme/render-quality modules centralize deterministic category colors and DPR/MSAA/segment bounds. Layout revision project-volume-v2 uses volumetric preferred anchors, hub-aware bounded relaxation and exact reuse of finite prior positions. CPU curves and GPU effects share a perpendicular seeded frame. The composer retains renderer resolution; Low has direct shader output conversion. No data/API/server boundary changed. Code and136 unit checks pass; actual rendered acceptance remains pending because browser control is disabled. See GRAPH_THEME_SPREAD_REPORT.md.
