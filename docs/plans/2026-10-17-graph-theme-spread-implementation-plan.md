# G04 — Original ATLAS theme, clearer rendering and a wider 3D knowledge graph

Date: 2026-10-17, Asia/Taipei.

**Handoff: READY for local implementation.** Intended executor: the same Codex model at Light reasoning. No material product question remains. Browser acceptance requires working browser access; it was disabled in Work settings during this planning pass. Do not call the visual checkpoint complete until it can actually be performed.

Project root: `C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT`.

Inspected Git state: unborn `master`; `git rev-parse --verify HEAD` reports no revision. The application, documentation and tests are untracked pre-existing work, including the substantial G03 WebGL implementation. There is no clean committed baseline to reset to. Do not use Git reset/clean, overwrite the tree or remove G03.

Planning scope: inspect and write this handoff only. This planning invocation did not edit application code, tests, settings, manifests, credentials or live data. The owner's latest request supersedes the navy/cyan/violet visual direction in the earlier neural graph specification. It retains the working WebGL graph and its interactions.

## Progress checklist

- [x] S01 — Establish the exact baseline and task-owned recovery copies.
- [x] S02 — Restore the original shell and charcoal/sage component styling.
- [x] S03 — Replace collapsing layout forces with bounded volumetric placement.
- [x] S04 — Remove directional bias from curves and fit the wider volume correctly.
- [x] S05 — Raise actual render resolution and anti-aliasing without losing responsiveness.
- [ ] S06 — Add meaningful geometry, theme, resolution and interaction regressions.
- [ ] S07 — Run visual/performance acceptance and record the finished evidence.

Execution checkpoint: S01–S05 implemented; 136 unit cases and strict/build checks pass. S06 browser regressions are added/typechecked but unrun. S07 remains pending because local browser control is disabled in Work settings. Checked implementation steps are not a claim of rendered acceptance. See `docs/GRAPH_THEME_SPREAD_REPORT.md`.

## Goal and observable outcome

The owner likes the graph's UI functionality, but the graph currently looks like a separate product. Workspace, All notes and Vault folder use the original charcoal surfaces, muted sage accents, Geist typography, labelled navigation and shared header. `/graph` replaces those with a 64px icon rail, shorter header, navy panels and bright blue controls. Restore the original shared design on the graph route; do not retheme the other pages to match the graph.

The constellation also needs to feel like an open three-dimensional network. Notes from a project currently compress into a narrow strand. Spread each project's notes around its hub in X, Y and Z, keep related files understandable, and preserve every real relationship. A graph containing one project and 32 notes should occupy a substantial, irregular volume around that project, rather than forming a line pointing away from it.

Improve clarity through actual renderer/composer resolution, anti-aliasing and smoother curves. Larger blurry glow, extra decorative particles and fabricated nodes are not substitutes for resolution or spacing.

## Requirements and boundaries

### Must have

1. `/graph`, `/`, `/inbox` and `/setup` share the original sidebar/header/typography, charcoal surfaces and sage action states at the same viewport.
2. Preserve a spacious graph workspace, compact search/filter/settings controls, expanded mode, readable labels and a responsive inspector.
3. Deterministic project volumes with notes distributed on both sides of each project hub and across all three axes. Real cross-project links remain visible without pulling every group into a common strand.
4. Stable positions during hover, selection, search, category filtering, ordinary polling, pause and quality changes. New notes appear near their actual category/linked neighbors without shifting all existing files.
5. High quality renders at device pixel ratio up to 2; medium up to 1.5; low at 1. The composer must preserve the renderer's actual resolution. Add supported MSAA to the graph render target.
6. Keep continuous held-pointer orbit, touch/pinch, pan, wheel/keyboard zoom, picking, focus, fit/reset, pulses/zaps, keyboard list access, pause/reduced motion and context recovery usable.
7. Verify actual rendering at DPR 1 and 2, desktop/tablet/mobile widths, sparse real data and representative synthetic density. Record performance rather than asserting it from architecture.

### Must preserve

- Local Markdown and the existing `/api/v1/local/vault` snapshot contract; Knowledge/Activity/All files semantics and URL `view`/`note` deep links.
- Titles, summaries, tags, file reader, source paths, original provenance, candidate/active state and unknown relationship review/confidence.
- Browser-only data contracts; no core/SQL/server secret imports in web.
- React state/GPU state separation, batched points/edges/ribbons, bounded worker settling, source/target direction and pulse scheduler limits.
- Existing same-origin CSP and local font files, exact pinned dependencies, strict TypeScript with `skipLibCheck: false`.
- Existing normal page copy and all pre-existing unrelated workspace edits.

### Must not have

- A redesign of the other routes, new UI framework/font, dependency upgrades, WebGPU migration, individual mesh spheres or per-node DOM labels.
- Synthetic production edges or notes, relabelled review/evidence, backend/schema/auth/cloud changes, public exposure, startup services, commits or pushes.
- A layout that appears wider only because the camera zoomed in, a permanent simulation running while orbiting, or increased DPR without bounds.
- Per-frame React camera state, per-input animation cancellation, new timers per edge, disabled validation/tests or forced clicks that hide a real overlay defect.

### Don'ts specific to this repository

- Do not replace `graph.css` with global selectors that change `/`, `/inbox` or `/setup`.
- Do not hide the original navigation labels on the graph route or remove mobile navigation to recover canvas room.
- Do not retain the current one-size `3.5` edge rest length, increase only the initialization cube, and assume the strand problem is fixed. The relaxation forces must preserve that spread.
- Do not keep the `JSON.parse(layoutKey) as typeof graph` cast: the current abbreviated layout payload omits `type`, although hub-aware placement needs it.
- Do not reuse the G03 position cache across a new layout revision; do not invalidate it for every keystroke or selected node.
- Do not reintroduce the primitive-object replacement lifecycle issue already fixed in `GraphScene`: attachment/disposal currently live together in its effect.
- Do not call old tests/screenshots or the saved benchmark a verification of G04.

## Context and inspected evidence

Instructions read: root `AGENTS.md`, `Vault/AGENTS.md`, `docs/PROGRESS.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`, latest `docs/SESSION_LOG.md`, Revision 2 handoff, neural graph architecture/progress/specification, implementation-plan skill/plan-format and ui-skills reference sections 2–3 and responsive guidance. Current owner instructions override the earlier neural specification's palette and shell recommendations. Root instructions require task status/evidence, preserve the historical source brief and keep this work local.

Stack: React 19.3.1, React Router 7.18.4, R3F 9.4.0, Three/@types/three 0.180.0, Vite 8.3.4, TypeScript 7.0.2, pnpm 11.25.0, local Geist 400/500/600 and IBM Plex Mono 400, Vitest 5.0.5, Playwright 1.64.1 with installed Edge. No new dependency is needed.

### Source map

| Verified path | Anchor | Current responsibility and finding | Planned action |
|---|---|---|---|
| `apps/web/src/styles/global.css` | `:root`, `.sidebar`, `.topbar`, mobile media queries, `.local-workspace button` | Original theme; 232px sidebar /205px below1100px; mobile navigation below680px | Add aliases for existing colors only; preserve existing computed appearance |
| `apps/web/src/styles/graph.css` | leading `.graph-workspace` blocks | Hides labels/identity and replaces shell dimensions/colors | Remove graph-specific shell redesign; restyle graph internals with original tokens |
| `apps/web/src/app/LocalApp.tsx` | `isGraph`, `.main-heading`, `KnowledgeGraph`, `.graph-file-panel` | Shared shell and real file data already exist; heading is hidden by graph CSS | Reuse shell; show existing heading/Refresh files; keep one view control and reader |
| `apps/web/src/app/KnowledgeGraph.tsx` | `readSettings`, `quality`, `layoutKey`, `prior`, `fit`, `reset` | Layout input strips node type; cached positions; independent quality/legacy palette settings | Typed layout input/revision cache; remove palette option; central quality policy |
| `apps/web/src/app/neural/model.ts` | `palette`, `adaptVault` | Project title is category; every imported edge retains actual source/target | Muted stable category color lookup only; adapter/data semantics stay unchanged |
| `apps/web/src/app/neural/layout.ts` | `layoutGraph`, `curvePoint`, `bounds` | Category centers largely on an XZ ring; attraction to one center; every edge pulled to3.5; globally biased bend normal | Volumetric category/node anchors, differentiated weak springs, unbiased seeded curve basis |
| `apps/web/src/app/neural/layout.worker.ts` | request handler | Uses the same pure layout for >200 nodes | Keep worker boundary; type it with the new small layout input |
| `apps/web/src/app/neural/geometry.ts` | `createScene`, `edgeNormal`, `fillRibbons` | One Points/LineSegments batch; segments16/12/7; duplicate biased normal math | Shared curve frame; smoother bounded segments; stable sage/slate colors |
| `apps/web/src/app/neural/GraphCanvas.tsx` | `CameraRig`, `GraphCanvas` | DPR1–1.5, antialias false, fixed background; FOV55; approximate fit; native OrbitControls | Full quality policy, theme background and correct fit/far plane |
| `apps/web/src/app/neural/GraphPostProcessing.tsx` | composer construction and resize effect | Entire frame is capped to DPR1/high or0.75/medium; no MSAA | Full-resolution composer with a supported multisampled half-float target |
| `apps/web/src/app/neural/shaders.ts` | point fragment, edge/ribbon vertex | Radial points; additive glow; noise displacement shared by edge and pulse | Keep shader design; smooth pixel edges and use shared curve frame/uniforms |
| `apps/web/src/app/neural/GraphScene.tsx` | objects memo, scene attachment/disposal, labels, uniforms | Current working lifecycle, picking and mutable GPU updates | Preserve lifecycle; pass theme/quality consistently; add bounded diagnostics |
| `apps/web/src/app/neural/GraphPanels.tsx` | settings panel | `warm`/Violet palette switch persists | Remove this independent palette choice while retaining other preferences |
| `tests/unit/neural-graph.test.ts` | geometry/layout/effects cases | Existing determinism/cache/anchor/buffer tests; hard-coded high16 segments | Preserve contracts, add distribution tests and reference new quality constants |
| `tests/local-browser/graph-*.spec.ts`, `neural-picking.spec.ts`, `vault.spec.ts` | interaction/reader scenarios | Covers real controls, sparse/dense data, reader, evidence and fallback | Extend without weakening existing behavior assertions |
| `tests/local-browser/neural-performance.spec.ts` | profile benchmark, resource case |100/500/1500/5000 fixtures; rAF/resource measurements | Add actual drawing-buffer/composer dimensions, DPR2 and final timings |

### What is observed versus proposed

- Original theme values are read from current CSS. `.artifacts/foundation-1440x900.png` confirms the historical original shell visually; its cloud/setup content is historical, not current local product state.
- `.artifacts/local-browser/neural-benchmark-500.png` shows the separate navy graph UI and compressed directional structures in the existing synthetic graph. It is sample evidence, not real vault content.
- Source establishes the uniform short spring, low composer resolution and missing anti-aliasing. These are concrete causes to address; final perceived improvement still needs rendered inspection.
- During G03 earlier in this session:126 unit tests and6 offline compatibility browser cases passed; a full local browser run passed11 of12 before a stress loading timeout. A later isolated2-case performance/resource run passed with an explicit stress-only loading budget. Typecheck/build passed after the subsequent data memoization change. The final all-suite rerun after that change was **not executed**: automatic approval review failed because its usage limit was reached. No G04 tests have run.
- The saved benchmark predates the last data memoization change. On Intel i7-8650U / Intel UHD620, Edge155,1440×900,DPR1:500 nodes/1000 edges measured60.6 idle,59.9 orbit,58.3 repeated-trace FPS;5000/10000 measured56.7,59.6,32.2 with150ms trace p95. Do not call those final G04 results. File: `.artifacts/local-browser/neural-benchmarks.json`.
- Current browser control reports **Local browser use is disabled in Work settings**. It was not bypassed. A fresh executor must restore/use authorized browser access for final visual acceptance; source work can start meanwhile.
- Git has no commit. No new baseline command was needed for this planning-only deliverable. The executor must snapshot current files and rerun appropriate local checks rather than assume the older counts still apply.

## Chosen design and exact contracts

### A. Original theme and shared shell

Use the existing ATLAS charcoal/sage family. Add these **aliases of existing values** to the existing `:root` in `global.css`; do not change the existing declarations or unrelated selectors:

| Token | Value | Existing visual role |
|---|---|---|
| `--atlas-bg` | `#111315` | page/canvas background |
| `--atlas-sidebar` | `#151719` | shared navigation |
| `--atlas-surface` | `#15191b` | panels/file surfaces |
| `--atlas-surface-raised` | `#171b1d` | raised local surface |
| `--atlas-control` | `#23292c` | buttons |
| `--atlas-border` | `#303437` | panels |
| `--atlas-control-border` | `#3a4246` | controls |
| `--atlas-text` | `#e6e8e9` | main text |
| `--atlas-muted` | `#aeb8be` | secondary text |
| `--atlas-accent` | `#c5d8aa` | sage graph/action accent |
| `--atlas-active-bg` | `#252e22` | selected local item |
| `--atlas-focus` | `#b7cba2` | existing focus ring |

`graph.css` consumes these tokens. Restore the original shell by deleting graph-specific sidebar width, hidden identity/nav text, topbar height/background, body width and mobile sidebar-hiding overrides. The shared global media queries own shell behavior again. Keep the `graph-workspace` class solely for scoped content layout.

Show `LocalApp`'s existing `.main-heading` and `Refresh files` control on `/graph`. Retain their copy. Keep the existing Knowledge view select inside the graph and hide only the duplicate outside fieldset on the graph route. Retain the vault-location/footer hiding on this specialized route to keep the visualization dominant; those remain available on the normal file/folder pages. Inside the graph toolbar replace the repeated visible heading with the file/connection count, while retaining an accessible region name. Expanded mode can display `Knowledge graph` as its own compact heading.

Normal graph: one8px rounded,1px bordered surface, width100% of the shared main content. Height `clamp(480px, calc(100dvh - 270px), 860px)` above680px; below680px use `clamp(440px, 65dvh, 680px)` with normal document scrolling. The original page header/navigation can scroll on short/mobile windows; do not clip them. Expanded mode stays fixed/inset0/100dvh and uses the same colors, fonts and controls.

Sidebar/header: inherit232/205px and66px desktop rules; below680px keep the existing full-width brand and horizontally scrollable labelled navigation. Internal graph inspector becomes a bottom sheet at800px, retaining current40–43% height and its own scrolling. At desktop >=1100px keep inspector360px; from801–1099px320px; recompute canvas space accordingly. Maintain44px touch controls and no page overflow at300/320/390px. Search can wrap to a second toolbar row; no overlapping header/inspector/settings. The file reader must be inset24px from the viewport at desktop and10px mobile, rather than keeping the old84px rail-dependent left inset.

Typography: keep locally loaded Geist400/500/600; body13–14px, metadata11–12px, inspector title20px/500/1.3. Keep IBM Plex Mono only for existing metadata/path roles. Avoid adding spacing/case styles to copy that currently lacks them.

For WebGL use a new browser-safe `neural/graph-theme.ts` exporting a readonly `GRAPH_THEME` with `background`, `fog`, `particle`, `selection` and `palette`. Pin background/fog to`#111315`, particle`#65706a`, selection`#c5d8aa`, palette to`["#c5d8aa","#afbfc9","#b4c3b2","#c3c7b5","#a7b9b7","#b9b4aa"]`. These are proposed subdued category colors inside the original family. Export `categoryColor(categoryId: string): string`, indexing by existing `hash(categoryId) % palette.length`, not current visible-category order. Use it in geometry, search dots and category filters. Stable IDs/category names remain unchanged.

Remove `warm` from `GraphSettings`, defaults, `readSettings`, panel toggles and scene memo dependencies. Ignore a legacy stored `warm` key; retain all other valid saved preferences and the `atlas-neural-settings` key. Remove only the independent Violet palette control. Change `createScene(graph,index,positions,quality,warm)` to`createScene(graph,index,positions,quality)`; update GraphScene and every unit-test call. Do not turn this request into a global theme toggle.

### B. Volumetric layout and stable data flow

Keep a pure synchronous layout shared with the worker. No new physics library.

In `layout.ts` add these types, importing `NeuralNode`/`NeuralEdge` as types from`model.ts`:

```ts
export type LayoutNode = Pick<NeuralNode, "id" | "categoryId" | "importance" | "type"> & {
  position?: Vec3;
};
export type LayoutInput = {
  nodes: LayoutNode[];
  edges: Pick<NeuralEdge, "id" | "source" | "target" | "type" | "directed" | "strength">[];
};
export const LAYOUT_REVISION = "project-volume-v2";
export type LayoutCache = { revision: string; positions: Layout };
// Keep the exported result and optional prior-position argument.
export function layoutGraph(graph: LayoutInput, prior: Layout = {}): Layout;
```

This is a proposed contract excerpt, not an implementation. `NeuralGraph` is structurally compatible with this smaller input, so existing pure tests can pass full graphs. Update `KnowledgeGraph.layoutKey` to include `type` and any supplied position; parse as `LayoutInput`, not`typeof graph`. Worker requests remain `{graph,prior}` but change graph's type to`LayoutInput`. On layout revision mismatch discard only the in-memory layout cache, not graph data/settings. Merge results into the same-revision cache so returning from Activity/Knowledge filtering restores coordinates. Return positions only for current input nodes. Continue worker termination/cancel guards.

Implement the following explicit algorithm, with all arrays/maps built in stable sorted order:

1. Sort nodes by ID, edges by ID and categories by name. Group nodes by category. Choose the lexicographically first `type === "project"` node in a category as its hub; if none exists, use a virtual anchor only, without creating a rendered node or edge. Other nodes in that category are members.
2. For category member count`m`, use local radius`r = max(7, 2.4 * cbrt(max(1,m)))`. Across categories use anchor radius`R = (maxLocalRadius + 4) * cbrt(categoryCount)`; a single category uses center`[0,0,0]`.
3. Distribute category anchors using a Fibonacci sphere (all axes), not an XZ ring: `y = 1 - 2*(i+0.5)/count`, `angle = i*2.399963229728653`, `xz = sqrt(max(0,1-y*y))`, direction`[xz*cos(angle),y,xz*sin(angle)]`. Apply one fixed oblique rotation to this category-anchor volume; do not rotate it over time.
4. Inside each category, distribute member directions with the same Fibonacci construction using the sorted member index/count. Apply a deterministic category rotation (yaw`random(category+":yaw")*2π`, pitch`(random(category+":pitch")-0.5)*π`). Each member gets irregular radius`r * (0.65 + 0.35*cbrt(random(id+":radius")))`; add a tangential perturbation capped at`0.08*r`. This avoids a perfect shell while retaining balanced directions. The hub starts at the category center. Save each newly initialized member's resulting point as its preferred anchor.
5. Existing finite prior coordinates and explicit finite supplied coordinates win and stay fixed. A brand-new node in an established category starts within that category's volume, using a seeded offset around the centroid of actual already-positioned same-category neighbors when available. Clamp that initial offset to the category radius; do not move all cached nodes to accommodate it. A new isolated category uses its seeded category anchor.
6. Keep bounded relaxation:65 iterations up to400 nodes,36 through1500,18 above1500; existing cell size2, deterministic24-candidate cap and rotating bucket sampling. Avoid any all-pairs loop. Keep project hubs pinned to their initial category center unless they had an explicit/prior coordinate, which also remains fixed.
7. Replace attraction to the category center with weak attraction to each member's preferred anchor: add`(anchor-position)*0.025` per iteration. Preserve the minimum separation radii already used (2.2 for hubs,1.25 for ordinary nodes). Cap each iteration's total new-node displacement to0.25 world units.
8. Give actual `part_of` edges a rest length equal to that member's initialized distance from its hub, clamped to`[0.6*r,1.1*r]`. Never pull those members toward3.5. For other same-category edges use rest length`max(5,0.8*r)` and weak spring coefficient0.004*strength; cross-category edges use`max(8,0.85*initialEndpointDistance)` and coefficient0.002*strength. Use symmetric endpoint updates only for movable nodes; direction still affects propagation, not physical attraction. Clamp spring scalar to[-0.015,0.015].
9. For movable members in a category with a hub, keep radial distance at least0.45*r at the end of each step, moving outward along their seeded direction if the vector is zero. This prevents spring-induced collapse. It is a visual layout constraint, not a new graph relationship.
10. Return the settled coordinates and freeze them. Selection/filter/search/pause/quality never re-run this settling. Polling content edits must retain existing coordinates. Do not serialize the full graph on every camera frame or unrelated UI update; preserve the G03 data memoization.

Coordinates are presentation only; never persist layout changes into Markdown. Empty/single/disconnected graphs must remain finite. The exact tuning above is the initial chosen design; if a checkpoint fails, diagnose that force within this model before changing values. Do not replace it with random positions or a continuous simulation.

### C. Curves and camera

Current `edgeNormal` and `curvePoint` independently use`[-dy+0.1, dx+0.2, dz*0.13]`, which introduces a shared directional bias and is not generally perpendicular to the edge. Add one shared pure helper in`layout.ts`, and remove the duplicate construction from`geometry.ts`:

`curveFrame(a: Vec3, b: Vec3, seed: string): { normal: Vec3; binormal: Vec3; length: number }`.

Exact algorithm: normalize`d=b-a`; choose reference`[0,1,0]` when`abs(d.y)<0.9`, otherwise`[1,0,0]`; calculate normalized cross(d,reference) and cross(d,normal). Rotate this perpendicular basis by`random(seed+":bend")*2π`. For length<1e-6 return a finite fixed basis and length0. Use the rotated normal in both CPU geometry and the shader's `aNormal` attribute. `curvePoint` must return exact copies of a/b at t0/1; between them add a main sine envelope`sin(πt)*length*(0.025+0.035*random(seed))` along normal and a secondary`sin(πt)*sin(2πt+phase)*0.25*mainAmplitude` along binormal. Preserve the same path for base edges, pulse heads/trails and zaps; do not curve each system independently.

Keep FOV55, damping0.06, rotate0.45, zoom0.7 and650ms transitions. Compute fit distance using the limiting field of view, rather than increasing zoom to fake spread:

```ts
// Proposed complete mathematical expression inside CameraRig's fit/reset branch.
const verticalHalf = (55 * Math.PI) / 360;
const aspect = Math.max(0.1, size.width / Math.max(1, size.height));
const horizontalHalf = Math.atan(Math.tan(verticalHalf) * aspect);
const limitingHalf = Math.min(verticalHalf, horizontalHalf);
const distance = Math.max(10, radius / Math.sin(limitingHalf) * 1.12);
```

Use the command's radius when present. Fit to bounding sphere, retain the user's current orientation; reset alone restores the established default orientation. Fit against the actual resized graph stage with the inspector open. Keep focus/reveal/zoom semantics distinct. Import `PerspectiveCamera` from `three` and narrow with `camera instanceof PerspectiveCamera` before setting its `far` to`max(500, distance + radius*4)` for fit/reset and calling `updateProjectionMatrix()`. Keep OrbitControls maximum distance compatible; otherwise a wider graph can clip at narrow aspect ratios. Existing picking and labels project the same coordinates through this camera.

### D. Actual resolution and anti-aliasing

Add `neural/render-quality.ts`, exporting `RenderQuality = "high" | "medium" | "low"`, a readonly profile table and `resolveDpr(quality, deviceDpr)`:

| Profile | DPR cap | Requested target samples | Edge segments | Bloom |
|---|---:|---:|---:|---|
| high |2|4|24|enabled, existing strength/radius controls |
| medium |1.5|2|16|enabled; native bloom mip chain handles blur downsampling |
| low |1|0|10|off |

`resolveDpr` returns`min(profile.dprCap, max(1, finiteDeviceDpr))`, using1 for missing/nonfinite DPR. Do not supersample DPR1 devices beyond1 by default. This is higher resolution on high-DPI displays and anti-aliased/smoother geometry at DPR1.

Pass the effective quality to `GraphCanvas` instead of the current `low` boolean; update its sole KnowledgeGraph caller. Use the profile DPR for Canvas. Keep the renderer stable while quality changes; do not key/remount Canvas by quality or reset its camera. Preserve the existing adaptive downgrade and mobile/large-data Automatic behavior. Explicit High remains available on mobile. No new quality preference key is needed.

In `GraphPostProcessing`, build `WebGLRenderTarget(1,1,{type:HalfFloatType,samples:min(profile.samples,gl.capabilities.maxSamples),depthBuffer:true,stencilBuffer:false})` and pass it to `new EffectComposer(gl,target)` for high/medium. These APIs were verified in the locally installed Three0.180 source. If half-float color rendering is unavailable, use `UnsignedByteType` and supported samples with bloom disabled; keep a useful graph and record that downgrade. Do not create a blank fallback merely because an optional quality feature is unsupported.

The resize effect must set composer pixel ratio to`gl.getPixelRatio()` and CSS size to`size.width,size.height`; remove the high1/medium0.75 cap, which currently downsamples the whole network. Listen to the R3F viewport DPR as a dependency too, not just CSS size/quality, so a display/DPR change at unchanged width updates the targets. Bloom may downsample its own internal mips, but not the base scene/output. Use RenderPass → optional UnrealBloomPass → OutputPass once. Low quality can keep the existing direct render path, with matching scene background and verified color appearance. Do not double-apply color conversion in custom shaders and OutputPass.

Dispose composer-owned targets/passes exactly once at replacement/unmount. Preserve `gl.info` bookkeeping and GraphScene's explicit scene attachment/disposal. Use renderer context antialiasing for the direct low path only if measurements justify the cost; high/medium MSAA must work on the offscreen target, where default-canvas antialiasing alone does not help.

Use a pixel-derivative smooth edge on the circular point mask (WebGL2 fragment `fwidth(r)` with a small floor) and the selected ring; keep a bright small core, restrained halo and readable ring. Do not inflate the existing point sizes or increase bloom to compensate for blur. Source/target coordinates and event timing are unchanged. Do not add more stars or extra draw calls for apparent detail.

Expose bounded read-only diagnostics on `.neural-graph`: effective DPR, drawing-buffer width/height, composer target width/height and samples, alongside existing frame/resource attributes. Update once per resize/profile change, not by setting React state every frame. These enable tests to detect full-frame downsampling without brittle image-only assertions.

## File change map

| Step | Target | Operation / stable anchor | Change |
|---|---|---|---|
|S01|`docs/TASKS.md`, `docs/PROGRESS.md`|modify Current children/status|Mark G04 In Progress; G03 has prior incomplete final acceptance, do not rewrite it as completed |
|S02|`apps/web/src/styles/global.css`|modify `:root` only|Original-value token aliases, no other-route redesign |
|S02|`apps/web/src/styles/graph.css`|modify shell, graph internals/media queries/reader|Remove separate shell, charcoal/sage graph components, responsive containment |
|S02|`apps/web/src/app/LocalApp.tsx`|modify shared heading/graph reader placement only if required|Keep one heading/view control and original Refresh files; preserve memoized data |
|S02|`apps/web/src/app/neural/graph-theme.ts`|create|Theme constants and stable categoryColor |
|S02|`model.ts`, `geometry.ts`, `GraphScene.tsx`, `GraphPanels.tsx`, `KnowledgeGraph.tsx` under the existing neural/app folders|modify palette/warm dependencies/call sites|Remove independent palette; use original family consistently |
|S03|`neural/layout.ts`, `neural/layout.worker.ts`, `KnowledgeGraph.tsx`|modify layout input/cache/solver|Typed bounded volumetric placement and revised-cache handling |
|S04|`neural/layout.ts`, `neural/geometry.ts`|modify curvePoint/edgeNormal/fillRibbons|One seeded perpendicular curve basis |
|S04|`neural/GraphCanvas.tsx`|modify CameraRig fit/reset branch|Limiting-FOV fit, far plane, inspector resizing |
|S05|`neural/render-quality.ts`|create|Shared quality/profile constants and safe DPR resolver |
|S05|`neural/GraphCanvas.tsx`, `neural/GraphPostProcessing.tsx`, `neural/GraphScene.tsx`, `neural/geometry.ts`, `neural/shaders.ts`, `KnowledgeGraph.tsx`|modify quality/rendering anchors|Full-resolution MSAA pipeline, smoother batches, diagnostics and matching callers |
|S06|`tests/unit/neural-graph.test.ts`|modify existing suite|Distribution/curve invariants, stable cache and revised segment counts/signatures |
|S06|`tests/local-browser/graph-theme-resolution.spec.ts`|create|Route theme equality, DPR1/2, responsive shell and output-buffer checks |
|S06|`tests/local-browser/graph-navigation.spec.ts`, `neural-picking.spec.ts`, `neural-performance.spec.ts`, `neural-helpers.ts`|modify only affected assertions/fixture support|Retain interaction thresholds; same-project spread fixture and final measurements |
|S07|`docs/NEURAL_GRAPH_PROGRESS.md`, `docs/NEURAL_GRAPH_ARCHITECTURE.md`, `docs/TASKS.md`, `docs/PROGRESS.md`, `docs/SESSION_LOG.md`|modify status/current architecture|Actual outcomes/limitations; do not change old reports into new evidence |
|S07|`docs/GRAPH_THEME_SPREAD_REPORT.md`|create|Before/after visual evidence and measured final results |

All `neural/` paths above are relative to`apps/web/src/app/`. No manifests/lockfiles, backend resources or Vault records need changes.

## Ordered execution steps

### S01 — Preflight and task isolation

- **Depends on:** none; a direct implementation request after this planning handoff.
- **Target:** root instructions, source map, current task status and task-owned file copies.
- **Preflight:** confirm the named files/symbols and exact package versions; re-read current AGENTS/mandatory docs. Inspect the working tree and any concurrent changes. The absence of HEAD is expected.
- **Action:** create ignored `.artifacts/g04-baseline/` copies of only files this task will edit, preserving their relative paths. Preserve the current benchmark/screenshots outside `.artifacts/local-browser/`, which Playwright clears. Mark G04 In Progress in project task docs. Record source brief hash and initial relevant checks.
- **Verify:** from the exact project root run`pnpm typecheck`, `pnpm format:check`, `pnpm test:unit`; inspect existing commands before running any unfamiliar harness. Record pre-existing graph CSS warnings and the large lazy graph chunk advisory as warnings, not failing G04 regressions. Do not run database/cloud checks for this UI task.
- **If it fails:** diagnose a task-relevant baseline defect; preserve evidence and distinguish it from new work. If a command is blocked by automatic approval review, report the exact reason and stop that dependent check; do not bypass the review or silently call it passed.

### S02 — Restore the shared ATLAS design

- **Depends on:** S01.
- **Target:** original-theme tokens, graph shell CSS, internal components/theme constants, palette callers.
- **Preflight:** find the original values and current graph overrides listed above; compare with normal local routes, not only the historical setup screenshot.
- **Action:** implement design A and all matching warm/createScene call-site changes. Keep the graph in the original shell, make the existing heading visible, preserve the original refresh action, maintain one view selector. Remove the old icon-rail-dependent reader inset and mobile navigation hiding.
- **Expected result:** visiting Knowledge graph changes the selected nav item and content, while brand, sidebar/header dimensions, font, background and active-state family remain familiar. Search/settings/inspector still work.
- **Verify:**`pnpm typecheck`; targeted theme test or actual page comparison at1440×900,1024×768,768×844,390×844 and320×740. Check original routes for unintended visual changes. At200% text, allow normal vertical flow and control wrapping.
- **If it fails:** fix scoped cascade/containment or missing call sites. Do not modify other-page styles to make a comparison pass. Stop if the original shell has materially changed since planning.

### S03 — Give project notes a real 3D volume

- **Depends on:** S01; can follow S02 immediately.
- **Target:** `layout.ts`, worker input type and KnowledgeGraph layout key/cache.
- **Preflight:** verify adapter node types and membership edges still match current contracts; verify the synchronous and worker paths use the same function.
- **Action:** implement design B exactly. Keep ordinary graph data out of the worker payload beyond the typed layout fields. Preserve finite cached coordinates and settle only new coordinates. Clear only prior-layout coordinates on revision mismatch.
- **Expected result:** one-project notes form a wide irregular cloud around its hub; multi-project groups have depth and balanced directions. Category/search state does not rearrange the map.
- **Verify:** add deterministic fixtures with a hub+32 notes, two hubs+32 notes each, a hub+200 notes and real membership-only edges. For each32+ member group require at least5 of8 occupied hub-relative octants, `min(axisSpan)/max(axisSpan) >= 0.35`, centroid offset from hub `<0.4*localRadius`, and median hub/member distance `>=0.55*localRadius`. These measure spread rather than merely repeating the construction. Verify order-independent nodes/edges, empty/single, finite bounds, cache exact reuse and incremental additions. Repeat with several category names/seeds.
- **If it fails:** identify whether seeding, center attraction, membership springs or cross-links collapsed the cloud. Adjust only the diagnosed force within the selected model and record why. Do not lower the distribution assertions merely to accept a filament. Keep >200 node settling in the worker.

### S04 — Match organic connections and framing to the volume

- **Depends on:** S03.
- **Target:** curveFrame/curvePoint, geometry normals and CameraRig.
- **Action:** implement design C; share the path basis across inactive lines, traveling heads/trails and zaps. Use actual stage dimensions and bounding sphere for fit; retain orientation during fit and normal selection.
- **Expected result:** connections bend in varied perpendicular directions with exact endpoints; the wider graph fits in its available space without new clipping or a camera zoom masquerading as layout spread.
- **Verify:** unit checks for exact endpoints, zero-length finite output, length-preserving orthonormal frame, seeded reproducibility and perpendicular displacement. Browser: fit/reset after orbit at least180°, resize with inspector open, zoom near/far, double focus, held drag originating on a node and20+ intermediate camera samples. Existing >12 distinct held-drag samples remain required.
- **If it fails:** fix the single shared curve/camera transform. Do not offset pulse geometry independently or re-layout nodes to fit the viewport.

### S05 — Improve clarity through the whole rendering pipeline

- **Depends on:** S02/S04.
- **Target:** quality policy, Canvas props, native composer targets, geometry segmentation, shaders and diagnostics.
- **Preflight:** recheck installed Three `EffectComposer`, `RenderTarget` and `WebGLCapabilities` APIs if versions differ. `samples` and `maxSamples` exist in0.180.0. Do not install the previously rejected postprocessing wrapper or weaken types.
- **Action:** implement design D with matching call sites. Feed theme background/fog/particle colors into WebGL. Replace hard-coded segment counts with the policy; preserve shared material/buffer counts and bounded active effects. Quality changes must neither blank the graph nor move the camera.
- **Expected result:** fine circular points and smooth connections, legible selected ring, full-resolution graph with controlled bloom. Low remains usable and Automatic preserves performance safeguards.
- **Verify:** typecheck/build; unit DPR-clamp/profile/geometry-buffer invariants; browser context at DPR2 checks drawing-buffer and composer dimensions to within1px of CSS dimensions*effectiveDpr; High no longer flattens to DPR1 and Medium no longer renders the whole scene at0.75. Check actual supported MSAA, quality toggling and resource stability.
- **If it fails:** inspect target size/DPR, shader mask, color conversion or unsupported format. Use the specified bounded format/sample fallback. Do not increase DPR above2, blur the scene or disable meaningful resource checks to hide a defect.

### S06 — Preserve interaction and cover the reported regressions

- **Depends on:** S02–S05.
- **Target:** existing unit/local-browser suites and new theme/resolution scenario.
- **Action:** keep real-file fixture and pulse/reader assertions; add a named synthetic same-project fixture solely within tests. Update high segment-count assertions to the policy value, not an arbitrary new literal. Create a new browser context per DPR/resolution profile so tests do not inherit saved quality settings. Capture overview and selected-neighborhood views separately.
- **Expected result:** test evidence detects both inconsistent theme and narrow project strands, while retaining G03 navigation, pulse, evidence and fallback coverage.
- **Verify:** run commands below in dependency order, awaiting each completion. Do not build while a browser benchmark is reading the distribution directory. Do not run the unit suite concurrently with timed browser benchmarks on this modest PC.
- **If it fails:** diagnose the failing invariant. A new layout can change screenshots/coordinates, but node IDs, real counts/directions, evidence and accessible actions must still be correct. Preserve those assertions.

### S07 — Visual/performance checkpoint and handoff

- **Depends on:** S06 and available browser access for final visual acceptance.
- **Target:** actual loopback graph plus controlled fixtures; project reports/status.
- **Action:** inspect normal/expanded graph and at least one other original-theme route at matching sizes. Compare with the saved source evidence, then measure the profiles. Save screenshots and JSON under`.artifacts/g04/`; report paths and synthetic versus actual data clearly. Record any tuning, warnings and device limits. Update this checklist and task reports only with observed outcomes.
- **Expected result:** one coherent ATLAS interface and an open, crisp 3D graph with preserved controls and bounded resources.
- **Verify:** all applicable matrix rows pass. If browser access remains disabled, finish independent source/unit work but leave S07 and task completion pending; give the exact missing verification/access rather than claiming the visual result was checked.
- **If it fails:** revert or repair only the task-owned renderer/layout/style changes using S01 copies. Preserve other user work. No external operation is needed to finish this scope.

## Commands for the executor

Use PowerShell, working directory shown. Run separately, inspect each exit/result before continuing:

```powershell
Set-Location -LiteralPath 'C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT'
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm verify:bundle
pnpm test:unit
pnpm exec playwright test --config tests/playwright.local.config.ts
pnpm test:e2e
Get-FileHash -LiteralPath 'docs/plans/2026-10-16-atlas-source-brief.md' -Algorithm SHA256
```

These are existing inspected scripts; the source brief hash must remain`BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`. Local browser fixture4320 and offline compatibility fixture4318 are independent of the actual local app4317. Do not load cloud environment files for tests. pnpm/temp Git/link/browser execution can require permitted execution on this Windows machine; honor the tool's actual approval outcome. The earlier approval-review usage failure is not permission to bypass checks.

## Acceptance and verification matrix

| Requirement/scenario | Setup/input | Check | Expected result |
|---|---|---|---|
|Shared design|`/`, `/inbox`, `/setup`, `/graph` at1440/1024px|Computed styles + actual screenshots|Same sidebar/header dimensions, font family and charcoal/sage states; graph selected nav remains labelled |
|Original pages preserved|Before/after same normal routes|Visual comparison|No unintended copy/layout/color change outside added nonvisual aliases |
|Mobile navigation|768,680,390,320px|Keyboard/touch and bounds|Original nav remains accessible; internal graph panels reflow; no document horizontal overflow |
|Short pane/expanded mode|300×565 normal and expanded|44px targets, Escape/focus and stage bounds|Original shell may scroll; expanded scene usable with visible close/navigation controls |
|Text enlargement|390px,200% root text or browser zoom|Search/settings/reader/inspector|No clipped required actions or forced whole-page horizontal scroll |
|Per-project spread|Hub+32, hub+200,2×32 members|Octants/span/centroid/median-radius tests + overview screenshots|Balanced irregular3D volume, no one-direction member strand |
|Stable positions|Selection/search/category filter/polling/quality|Compare node world positions and layout request count|Exact existing coordinates retained; no relayout from UI-only state |
|Incremental files|Add one linked file; repeat/reorder input|Unit/fixture|Existing nodes fixed; new file near proper volume; no synthetic relation added |
|Curve correctness|Horizontal/vertical/oblique/zero-length edges|Unit frame/anchor checks + pulse view|Finite seeded curves; endpoints exact; pulse remains on displayed connection |
|Higher resolution|DPR1 and2, High/Medium/Low|CSS/buffer/target diagnostics + screenshot|DPR clamp applied; composer matches renderer; supported MSAA; no whole-frame0.75 downsample |
|Shader appearance|Near/far zoom, selected ring, active pulse|Actual render|Circular crisp cores, fine smooth curves, restrained sage/slate glow, no rectangular-looking halos |
|Navigation regression|Held drag20+ samples, node-origin drag, wheel/pan/pinch|Existing browser tests|>12 distinct held positions before release; drag does not select; zoom and pointer capture work |
|Search/inspector/evidence|Actual/synthetic notes and candidate records|Existing local-browser tests|Correct exact-title result; sources/review remain accurate; Open file and copy work |
|Failure/motion|Empty/single/disconnected/noWebGL/context loss/reduced|Existing + extended tests|Helpful searchable fallback and recovery; no unwanted animated effects under reduced motion |
|Resource stability|Repeated trace and3× low/high replacements|Counters before/after settle|No sustained growth in geometries/textures/programs; no blank graph; bounded80 pulses/10 zaps |
|Performance|100/500/1500/5000 atDPR1, plus500 atDPR2|Existing90-frame measurements + actual interaction|Record quality/FPS/p95/load/device. Aim>=50FPS at500 Auto DPR1 and>=30FPS appropriate Auto tier atDPR2; no new long trace stalls. If below, tune only quality costs within specified caps and disclose measured limit |
|Source/data boundary|Bundle scan + source hash + same-origin test|`verify:bundle`, hash, existing request test|No server imports/secrets/external data writes; source brief unchanged |

Performance thresholds are acceptance targets to measure, not claims already met. No requirement to force High on5000 nodes or guarantee a result on untested hardware.

## Recovery and deterministic stop conditions

- Task owns only the listed browser files/tests/report changes and new theme/quality helpers. Restore individual hunks from S01 copies if necessary; do not discard the pre-existing G03 implementation or concurrent changes.
- Line-number drift is harmless when symbols/contracts match. Stop dependent edits for materially changed renderer/data contracts, missing original theme definitions, different package major versions, or a contradictory current owner direction.
- A baseline test failure must be diagnosed and labelled. Stop a phase that repeatedly fails without a task-scoped explanation; do not switch frameworks or edit backend data to get green tests.
- Missing browser access blocks final rendered acceptance, not source planning or independent local code work. Approval-review usage failure blocks the rejected command; report it accurately without a bypass.
- No deploy/publish/credential/database operation is in this plan. The old cloud authorization entries do not broaden this graph task.
- Do not save a routine completion log to Vault. This plan/report are the source of execution history; any later durable subject needs its own reusable claim and evidence under the existing capture rules.

## Copy-ready executor prompt

```text
Execute the READY local plan at Light reasoning:
C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT\docs\plans\2026-10-17-graph-theme-spread-implementation-plan.md

Project root:
C:\Users\user\Desktop\Personal AI-Knowledge Vault - NeuralVaultYKT

Read the full plan, root AGENTS.md, Vault/AGENTS.md, mandatory progress/tasks/architecture/latest-session docs first. Honor current user instructions. The outcome is the original ATLAS charcoal/sage design on the existing WebGL graph, wider deterministic project volumes in all three axes, and a sharper full-resolution rendering pipeline. Preserve real file/link data, evidence states, navigation, pulse behavior and the working G03 lifecycle.

Start with S01: inspect current symbols/versions/untracked user work and create task-owned baseline copies. There is no HEAD commit to reset to. Then execute S02–S07 in dependency order, maintaining the checklist. Use the plan's chosen theme values, typed layout payload, bounded force rules, shared curve frame, quality profiles and verification matrix. No new dependencies or backend/cloud changes are required. Do not retheme other pages to match the graph.

Run the prescribed checkpoints sequentially and distinguish old evidence from fresh results. Do not build concurrently with browser measurements. Source tests cannot establish visual acceptance. If browser control is disabled or automatic approval review rejects a command, report the exact missing check and reason without bypassing it. Keep final visual completion pending until actual rendering can be verified. Stop dependent work if contracts differ materially, authorization is insufficient, required input is missing or a checkpoint cannot be resolved within the specified scope.

Do not deploy, publish, send, migrate, provision credentials, install startup services, commit or push. Finish with the changed files, observed type/lint/format/build/unit/browser/performance results, screenshot/report paths, remaining limitations and any incomplete step. Do not claim completion from edits alone.
```
