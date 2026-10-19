# G02 — usable graph navigation

2026-10-17, Asia/Taipei. Owner reported that G01 was difficult to drag/orbit and did not provide enough usable space to inspect the whole map. This report supersedes G01's interaction acceptance; historical evidence is preserved.

## Causes and corrections

- The camera canceled and restarted its animation frame on every input event. Continuous pointer updates could therefore defer visible work and continually reset easing. Input now updates one pending target/frame; held drags and wheel input commit directly on that frame, while discrete controls retain easing. Idle frames stop.
- Node links could compete with native link dragging. The viewport now captures the pointer at gesture start, suppresses native drag/text selection and dispatches a node selection only for an unmoved primary-pointer release. A drag never opens its starting file. Keyboard link activation remains available. Lost capture, cancel and release clean up the active pointers.
- Orbit previously recomputed framing from the current orientation, changing the map scale while rotating. Framing now uses a rotation-invariant projected sphere bound and is memoized by layout/viewport. Every reset-view node fits at any yaw/pitch, including underneath. Vertical orbit no longer stops at the former ±1.35 radian limit.
- Wheel zoom works directly over the map, with a wider 30–400% range. Shift-drag and middle/right-button drags pan; two-finger gestures combine pan and pinch. The normal page remains scrollable outside the map.
- Expanded mode uses the available window, keeps orbit/pan/zoom/reset visible in a 300×565 pane, isolates background interaction, traps focus, closes with Escape and restores focus/scroll state. Desktop inline canvas is taller. Labels simplify to project titles during active dragging, and unrelated selected-node dimming is suspended while moving the full graph.

Existing charcoal/sage styling, font families, data provenance and local file/link semantics are preserved. No rendering dependency, cloud operation, AI service, credential change, public exposure or startup installation was added. Concurrent K01 durable-knowledge filters are preserved; the group uses a semantic fieldset. Test fixtures explicitly distinguish Knowledge from All files.

## Actual verification

- `pnpm build`: passed, 2351 modules, 5.54s. Strict typecheck, root lint, format and browser/server bundle checks passed. Browser entry328.15kB/103.32kB gzip at this build, including the concurrently present knowledge UI.
- `pnpm test:unit --maxWorkers=1`:116/116 passed across11 files in16.51s. Includes the new invariant-framing test; all original timeouts/assertions remain. Initial fully parallel unit execution timed out three unrelated filesystem/knowledge cases under competing work; serial execution passed them unchanged.
- Local browser suite:9/9 passed together in42.3s. New regressions start a real mouse drag on a node and assert more than12 distinct rendered camera positions before release, no native drag and no file navigation. They verify wheel zoom, reset bounds, expanded-mode Escape/focus/scroll cleanup, and all visible controls inside a300×565 pane with over250px of usable canvas height.
- Dense300-node case records20 camera samples while the button is held and requires more than12 distinct rendered angles before release. This is a continuous-update regression, not a hardware60fps benchmark.
- Actual vault inspected in the in-app browser. A233×−66px node drag changed yaw by1.631rad and pitch by0.396rad. In a300×565 expanded pane an80×40px pan updated x/y by exactly80/40. Wheel input changed zoom100→124%. Whole-map reset, controls and expanded layout inspected visually. Desktop and narrow controlled screenshots are in `.artifacts/local-browser/graph-navigation-expanded.png` and `graph-navigation-pane.png`.
- Source brief SHA256 unchanged: `BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A`.

Failures retained: initial pan test used coordinates captured before the page scrolled to the mode control; it now measures the viewport before each drag. The concurrent evidence-basis test searched for a substring as an entire element; it now verifies the exact labeled evidence paragraph. Knowledge fixture changes added two files; All files graph tests now assert the six-file fixture while the Knowledge view retains its four-file expectation. No product permission/storage rule or test assertion was weakened.

Physical touch hardware, screen-reader acceptance and sustained device-specific frame-rate profiling remain unverified. The existing300-node display bound remains. This local fix does not complete the wider semantic-knowledge roadmap.
