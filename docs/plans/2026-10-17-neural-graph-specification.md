# CODEX MASTER IMPLEMENTATION SPECIFICATION
## Shader-Driven 3D Neural Constellation Knowledge Graph

**Project type:** Interactive knowledge management visualization  
**Primary reference:** https://codepen.io/ownikiyj-the-bold/full/OPyRzdQ  
**Reference source:** https://codepen.io/ownikiyj-the-bold/pen/OPyRzdQ  
**Implementation target:** Existing application, or a standalone React + TypeScript application if no repository exists  
**Primary technologies:** Three.js, React Three Fiber, GLSL, WebGL, TypeScript  
**Priority:** Visual fidelity → Functional correctness → Interaction quality → Performance → Product integration

---

# PART 1 — YOUR ROLE AND NON-NEGOTIABLE INSTRUCTIONS

You are acting as five specialists:

1. Senior Three.js and WebGL graphics engineer.
2. GLSL shader developer.
3. Creative frontend engineer specializing in interactive 3D experiences.
4. Senior UI/UX product designer.
5. Software architect responsible for performance, maintainability, and testing.

Your responsibility is to **actually design, implement, test, and refine** an interactive, shader-driven 3D knowledge graph.

This is not a request for a generic dashboard, node editor, or conventional Obsidian clone.

The desired visual result is the **Interactive Neural Network Visualization** linked above, adapted into a real knowledge graph.

## 1.1 Absolute priorities

P0 — Preserve the reference's neural visual identity.

P0 — Maintain meaningful relationships between actual knowledge items.

P0 — Implement GPU-rendered glowing nodes and animated energy connections.

P0 — Implement a visibly traveling synaptic pulse and electrical discharge effect.

P0 — Preserve existing repository functionality.

P1 — Provide smooth camera navigation, selection, search, and information inspection.

P1 — Make the graph suitable for thousands of nodes through appropriate performance strategies.

P1 — Produce a coherent, professional UI.

P2 — Add advanced exploration features after the fundamentals are stable.

## 1.2 Strict instructions

**DO:**
- Inspect the reference's actual source code before implementing.
- Identify which rendering methods and effects create its visual appearance.
- Reproduce its aesthetic and motion language as closely as practical.
- Use original, modular implementation code and respect applicable source licenses.
- Treat all numeric settings in this specification as initial design targets that must be visually tested.
- Preserve existing project architecture where possible.
- Record implementation decisions and actual testing results.
- Complete and validate each phase before proceeding.
- Use actual browser rendering to verify shaders and layout.

**DO NOT:**
- Build a generic force-directed graph and call it complete.
- Replace shader-driven glowing nodes with ordinary colored spheres.
- Replace animated connections with basic static lines.
- Substitute CSS box-shadow effects for GPU glow.
- Invent relationships between knowledge items merely to improve the appearance.
- Introduce random graph positions on every render.
- Replace an existing backend or database unnecessarily.
- Rebuild unrelated parts of an existing application.
- Claim that functionality is complete without testing it.
- Hide incomplete features behind visual effects.
- Introduce unnecessary libraries or unrelated features.

If any requirement conflicts with the actual repository, document the conflict, select the least disruptive technical solution, and explain the reasoning.

---

# PART 2 — UNDERSTAND THE ACTUAL PRODUCT

## 2.1 Product background

I am developing a personal knowledge management system intended to preserve knowledge for both human users and AI agents.

Its purpose is to maintain reusable, interconnected knowledge about:

- Personal knowledge
- AI research
- Technology
- AI automation
- Automation projects
- Software projects
- Web applications
- UI/UX design
- Development methodology
- Programming knowledge
- Research
- Concepts
- Tools
- System architecture
- Documentation
- Experiences and ideas

The broader system may eventually provide persistent agent memory, semantic retrieval, knowledge extraction, relationship discovery, and contextual retrieval.

However, **this implementation focuses on the visualization and interaction layer**.

Do not independently implement an entire new memory system, embedding pipeline, or database unless the repository already contains the relevant infrastructure and integration is required.

## 2.2 What the graph represents

The graph consists of:

**Nodes:** Actual knowledge items, topics, documents, projects, concepts, skills, or categories.

**Edges:** Relationships between those items.

**Clusters:** Meaningful groups of related nodes.

**Visual pulses:** An animated representation of activity or exploration through connected knowledge.

**Inspector:** A readable presentation of the selected item's actual information.

The visual graph must support discovering information, not merely displaying it attractively.

## 2.3 Visual metaphor

The experience should resemble a living neural network suspended in dark three-dimensional space.

Think of:

- Neurons connected by synapses.
- Electrical signals traveling between neurons.
- An interconnected structure of organic branches.
- A softly illuminated constellation of information.
- A living structure that reacts to user interaction.

It should feel sophisticated and scientific, not magical, childish, or excessively futuristic.

---

# PART 3 — REFERENCE ANALYSIS BEFORE IMPLEMENTATION

## 3.1 Inspect the selected CodePen

Open:

https://codepen.io/ownikiyj-the-bold/pen/OPyRzdQ

Inspect its HTML, CSS, and JavaScript implementation.

Focus on understanding:

1. How the Three.js scene is initialized.
2. How the 3D network structure is generated.
3. How nodes are rendered using `THREE.Points` and `ShaderMaterial`.
4. How connections are represented using custom buffer attributes.
5. How vertex and fragment shaders animate the nodes and lines.
6. How procedural noise influences connection geometry.
7. How energy pulses illuminate the structure.
8. How additive blending and bloom produce luminosity.
9. How the camera rotates and responds to interaction.
10. How the four formation modes change network geometry.
11. How theme switching and density adjustment work.
12. How geometry, buffers, and animation uniforms are managed.

## 3.2 Required technical observation

The original reference visually resembles electrical signal transmission but uses expanding spatial pulses triggered by user interaction.

For our implementation, distinguish two systems:

**System A — Spatial energy pulse**

An expanding wave originating from a point in 3D space.

Purpose: Preserve the attractive pulse behavior of the reference.

**System B — Relationship propagation**

An energy pulse traveling across actual connected edges from one node to another.

Purpose: Represent graph connectivity and knowledge relationships.

Implement System B as the primary knowledge interaction.

System A may remain available as an optional atmospheric interaction.

Do not confuse these two effects.

## 3.3 Required visual fidelity

The finished scene must preserve the following qualities:

- Dense but distinguishable node clusters.
- Organic branching geometry.
- Fine, relatively dim connecting strands.
- Small luminous node cores.
- Soft node halos.
- Beautiful gradual color transitions.
- Smooth network movement.
- Atmospheric depth.
- Connection illumination during energy propagation.
- Cinematic but restrained bloom.

Avoid making every node a large, fully modeled 3D sphere.

Much of the reference's visual quality comes from small luminous points and fine strands, not elaborate individual objects.

---

# PART 4 — EXACT DESIGN SYSTEM

## 4.1 Overall layout

The graph must be the dominant feature.

On desktop, the 3D scene should occupy the available viewport, with UI elements layered over it.

Recommended structure:

**Top-left**
- Application identity.
- Current graph name.
- Optional compact knowledge count.

**Top-center**
- Search control.
- Hidden or expandable search results.

**Left**
- Collapsible navigation and category filters.
- Closed or visually compact by default.

**Center**
- Full three-dimensional neural graph.
- No obstructive cards placed over the central network.

**Top-right**
- View settings.
- Performance/effects preferences.
- Optional graph controls.

**Bottom-center**
- Compact camera and animation controls.

**Right**
- Inspector panel that opens when a node is selected.

The layout must feel like a graph exploration application, not a typical SaaS dashboard.

## 4.2 Layout dimensions

Use these initial desktop measurements:

| Element | Specification |
|---|---|
| Graph canvas | 100% of available viewport |
| Top overlay offset | 24 px |
| Side overlay offset | 24 px |
| Compact sidebar | 56–64 px |
| Expanded sidebar | 260–280 px |
| Inspector width | 360–400 px |
| Search maximum width | 420 px |
| Bottom toolbar height | 44–52 px |
| Standard control height | 36–40 px |
| General UI corner radius | 8–12 px |

Use an 8 px spacing system for the general interface, with 4 px increments for small components.

The central graph should remain visibly centered in the usable canvas after opening the inspector.

Do not place multiple large translucent containers around the scene.

## 4.3 Color palette

Use an original premium dark palette inspired by the reference's glowing network.

### Base surfaces

- Main background: `#03050B`
- Secondary surface: `#0B1020`
- Elevated panel: `#101726`
- Border: `#273248`
- Primary text: `#EEF3FF`
- Secondary text: `#9AA8C0`
- Muted text: `#65738C`

### Neural accents

- Electric blue: `#4C8DFF`
- Cyan: `#45D8FF`
- Violet: `#A075FF`
- Magenta: `#ED79E8`
- Teal: `#3BD5BC`
- Soft lavender: `#B2A5FF`

The scene should primarily use cyan, blue, violet, and magenta.

Allow alternative palettes through configuration.

Do not distribute every available color equally. Use subtle spatial color grouping.

## 4.4 Color usage rules

**DO:**
- Use a dark background for contrast.
- Reserve the brightest accents for selected nodes and active energy pulses.
- Use muted colors on inactive connections.
- Maintain a readable UI independent of the graph colors.
- Ensure color communicates category or relationship information.

**DO NOT:**
- Use fully saturated colors on every edge.
- Make every node equally bright.
- Use large neon borders around UI panels.
- Apply rainbow gradients across unrelated items.
- Change node category colors randomly.
- Allow bloom to wash out the network.

---

# PART 5 — THREE-DIMENSIONAL SCENE SPECIFICATION

## 5.1 Coordinate system

Use the standard Three.js coordinate system:

- X: horizontal spread.
- Y: vertical spread.
- Z: spatial depth.

Graph data should store stable positions in world coordinates.

The graph should be genuinely three-dimensional, not a 2D SVG positioned inside a perspective-looking container.

## 5.2 Camera

Use `PerspectiveCamera`.

Initial suggested values:

- Field of view: 55 degrees.
- Near clipping plane: 0.1.
- Far clipping plane: 500.
- Initial camera position: `(0, 3, 38)`.
- Initial camera target: `(0, 0, 0)`.

These are starting values for a graph fitting approximately within a 20–25-world-unit-radius volume.

Adjust automatically to the calculated graph bounding sphere.

A generic fit-distance formula for the vertical field of view is:

`distance = radius / sin(verticalFov / 2)`

Add adequate framing margin and consider aspect ratio.

Do not use a fixed camera position that fails for larger datasets.

## 5.3 Orbit interaction

Use damped orbit controls.

Initial settings:

- Damping enabled.
- Damping factor: 0.06.
- Rotation speed: 0.45.
- Zoom speed: 0.7.
- Panning enabled in exploration mode.
- Minimum camera distance: 4 world units.
- Maximum distance: based on graph bounds.
- Automatic rotation: optional, enabled only when appropriate.

Idle auto-rotation speed:

Approximately 0.03–0.08 degrees per second.

Suspend auto-rotation during:
- Pointer interaction.
- Active dragging.
- Search.
- Node inspection.
- Focus transitions.
- Reduced-motion mode.

Never automatically rotate the graph while the user is reading node details.

## 5.4 Background

Use a nearly black scene background.

Add:

- A small amount of depth fog.
- A faint ambient point field.
- Optional very subtle atmospheric noise.

Initial particle count: 300.

Particles should be:
- Small.
- Mostly transparent.
- Inactive.
- Visually subordinate to knowledge nodes.

Do not use 5,000 bright background stars by default simply because the reference does.

Keep ambient decoration separate from real knowledge objects.

## 5.5 Scene layers

Organize rendering into:

1. Background.
2. Inactive edge network.
3. Active edge network.
4. Node cores and halos.
5. Traveling pulse effects.
6. Brief electrical discharges.
7. Selection and focus effects.
8. UI labels and overlays.

Layer separation must permit independent configuration and performance scaling.

---

# PART 6 — NODE RENDERING SYSTEM

## 6.1 Rendering strategy

Use `THREE.Points` with custom GLSL shaders as the default node-rendering strategy.

Do not create one React component and one separate draw call for every node.

Store node information using `BufferGeometry` attributes.

Required attributes include:

- `position`
- `aSize`
- `aColor`
- `aImportance`
- `aSelectionState`
- `aActivity`
- `aNodeType`

If node state is stored in integer form, document its shader mapping.

Stable node IDs should be maintained in CPU-side indexed arrays and maps.

For picking, implement a separate reliable node-selection method.

## 6.2 Node geometry

Render each node as a camera-facing luminous point.

Default screen-space sizes:

| Node importance | Diameter target |
|---|---|
| Minor node | 3–5 px |
| Standard node | 5–8 px |
| Important node | 9–13 px |
| Major hub | 14–20 px |
| Selected hub | Up to 28 px |

These are visual targets, not CSS elements.

Use perspective scaling while clamping the minimum and maximum rendered size.

If a platform's GPU point-size limits prevent reliable rendering, use instanced camera-facing quads.

## 6.3 Vertex shader requirements

The vertex shader must:

1. Transform node coordinates into view space.
2. Calculate perspective-scaled point size.
3. Read importance and activity attributes.
4. Apply gentle breathing animation.
5. Increase size temporarily during pulse activation.
6. Pass node color and intensity data to the fragment shader.
7. Respect hover/selection emphasis.
8. Avoid large positional displacement.

Suggested breathing animation:

`breathing = 1.0 + 0.04 * sin(time * 0.8 + phase)`

Suggested pulse size multiplier:

`pulseScale = 1.0 + 0.30 * activity`

Use per-node phase offsets so that all nodes do not pulse simultaneously.

## 6.4 Fragment shader requirements

Use `gl_PointCoord` to calculate distance from the point center.

Recommended visual structure:

- Small bright central core.
- Smooth inner luminous region.
- Large low-opacity outer halo.

Conceptual shader functions:

`r = length(gl_PointCoord * 2.0 - 1.0)`

`core = exp(-r*r*35.0)`

`halo = pow(max(0.0, 1.0-r), 2.5)`

`intensity = core * 1.4 + halo * 0.45`

Multiply final intensity by node importance and activation state.

Use appropriate transparency, blending, and brightness management.

The node should look like a tiny glowing neural point, not a solid circular button.

## 6.5 Node states

Implement five states:

**Default**
- Normal subdued luminosity.
- Gentle breathing.
- Standard connections.

**Hovered**
- Approximately 1.5× core brightness.
- Slight halo expansion.
- Immediate neighbor emphasis.
- Tooltip appears.

**Selected**
- Stronger core.
- Clear selection marker.
- Active outgoing connections.
- Inspector opens.
- Camera focus is available.

**Connected**
- Approximately 1.2× normal brightness.
- Small reaction when receiving a traveling pulse.

**Dimmed**
- 10–20% normal visual emphasis.
- Still visible enough to maintain context.

Selection state must be obvious without relying on color alone.

## 6.6 Node restrictions

Do not:
- Use large emissive sphere meshes for every item.
- Play strong breathing animations on every node.
- Allow hover states to modify layout positions.
- Make labels permanently visible on every node.
- Make selected nodes flicker continuously.
- Allocate materials or geometry per node.

---

# PART 7 — CONNECTION GEOMETRY

This section is critical.

## 7.1 Primary visual requirement

Connections must resemble thin neural strands.

Their appearance should be organic, lightweight, and subtly animated.

Most links should have low luminosity.

The graph's visual hierarchy must come from its nodes, clusters, and activated pathways.

## 7.2 Edge data

Every connection must contain:

- Stable edge ID.
- Source node ID.
- Target node ID.
- Relationship type.
- Direction.
- Strength.
- Confidence/provenance where available.
- Render state.
- Geometric control data.
- Deterministic variation seed.

## 7.3 Path generation

For each edge, calculate a three-dimensional path from source to target.

Define:

`P0 = source position`

`P1 = target position`

`t ∈ [0,1]`

Begin with:

`P(t) = mix(P0, P1, t)`

Then add a small, stable organic deviation perpendicular to the direction vector.

Use a deterministic seed for each edge.

Suggested path segmentation:

- 6–8 segments for low-detail links.
- 12–16 for medium-detail links.
- 20–32 for highlighted, curved connections.

For a line-segment buffer, explicitly generate both endpoints of every segment.

Do not incorrectly treat a single sequence of sampled points as a continuous polyline when using `THREE.LineSegments`.

## 7.4 Organic movement

Use low-amplitude displacement from smooth procedural noise.

Suggested displacement:

`offset(t,time) = perpendicular * noise(seed,t,time) * amplitude * sin(PI*t)`

The `sin(PI*t)` envelope guarantees the edge remains anchored to its nodes.

Initial displacement amplitudes:

- Inactive: 0.015–0.04 world units.
- Active: 0.04–0.09 world units.
- Brief zap: up to 0.12 world units for close-range links.

Scale displacement relative to edge length when needed.

Do not let lines detach visibly from their endpoints.

## 7.5 Base edge appearance

Default inactive edges:

- Very thin.
- Low saturation.
- Approximately 0.10–0.25 opacity.
- Minimal motion.
- No constant electrical flashing.

Selected connections:

- 0.7–1.0 opacity.
- Brighter endpoints.
- Traveling energy pulse.
- Optional momentary jagged electrical discharge.

Avoid assigning glowing ribbon thickness to every edge.

## 7.6 Edge rendering implementation

Use a batch-oriented rendering approach.

For the baseline graph, use a shared buffer geometry with custom attributes and a custom shader material.

For edges requiring consistent thickness greater than one device pixel, implement a small subset as camera-facing ribbon geometry or another compatible wide-line technique.

Do not rely on `gl.lineWidth` or ordinary WebGL line thickness behaving consistently across browsers.

Do not render thousands of independent glowing tube meshes.

---

# PART 8 — ENERGY FLOW SHADER

## 8.1 Base flowing energy

The network should feel subtly active even before interaction.

Use shader-time-based illumination along connections.

Let:

- `t` be normalized position along an edge.
- `time` be elapsed animation time.
- `speed` be flow speed.
- `frequency` be the number of illumination cycles.

Concept:

`flow = 0.5 + 0.5 * sin(t*frequency - time*speed)`

Initial parameters:

- Frequency: 10–16.
- Speed: 0.4–0.8.
- Base contribution: 0.05–0.15.

This base effect must be subtle.

The line should remain visually calm unless a node or connection is actively engaged.

## 8.2 Relationship pulse

A relationship pulse must visibly move from one node to another.

Use a normalized traveling wave position:

`progress = clamp((time-startTime)/duration, 0, 1)`

At each fragment along the edge:

`distanceFromPulse = abs(t-progress)`

Suggested pulse envelope:

`pulse = exp(-pow(distanceFromPulse/width, 2.0))`

Use a pulse width of approximately 0.04–0.09 in normalized edge space.

The effect should produce:

1. A brighter leading pulse.
2. A thin illuminated line beneath it.
3. A fading luminous trail.
4. A destination-node illumination.
5. A return to normal edge brightness.

## 8.3 Pulse travel timing

Base travel duration:

400 milliseconds per medium-length connection.

Scale by edge length, with configurable minimum and maximum durations.

Suggested limits:

- Minimum: 200 ms.
- Maximum: 900 ms.

Longer edges should appear to take more time than short edges.

Do not make all pulses travel at the same visual speed regardless of length.

## 8.4 Pulse colors

Use:

- The selected node's accent color for propagation.
- A brighter near-white center.
- A soft destination glow.
- A muted trail.

Do not abruptly swap entire connection colors.

The visual signal should look like energy traveling inside the line rather than the whole line blinking.

---

# PART 9 — ELECTRICAL ZAP EFFECT

This is one of the signature effects.

## 9.1 Definition

A zap is a very brief electrical disturbance traveling along a connection.

It should resemble an electrical synapse firing.

It must be:

- Quick.
- Luminous.
- Slightly irregular.
- Directional where relevant.
- Infrequent.
- Visually connected to meaningful user or system activity.

## 9.2 Appearance

A single zap may contain:

- One primary bright electrical strand.
- 2–5 irregular bends.
- A small secondary branch on some activations.
- A bright moving tip.
- A trailing glow.
- Brief node illumination at arrival.

The effect should not resemble a large lightning bolt covering the screen.

## 9.3 Technical architecture

Create a dedicated `ZapEffectSystem`.

Its responsibilities:

1. Receive an edge ID and activation timestamp.
2. Look up the edge geometry.
3. Calculate a short-lived irregular electrical path.
4. Apply temporal flicker.
5. Render only while active.
6. Release the effect from the active-effect pool.

Use deterministic noise or seeded subdivision for jagged path geometry.

A suitable subdivision algorithm:

1. Start with two endpoints.
2. Compute the midpoint.
3. Displace the midpoint in a perpendicular direction.
4. Repeat on both halves.
5. Reduce displacement each subdivision.
6. Update the seed or deformation during active flicker.
7. Fade the effect after its lifetime.

Use screen-space or world-space clamping so the effect remains thin across different zoom levels.

## 9.4 Zap duration

Initial settings:

- Total zap duration: 120–180 ms.
- Bright attack: approximately 20 ms.
- Main discharge: approximately 50–80 ms.
- Fade-out: approximately 60 ms.

Use a smooth envelope rather than instant full-brightness on/off flashing.

## 9.5 Zap triggers

Allowed triggers:

- User selects a node.
- User initiates relationship tracing.
- A traveling pulse reaches a junction.
- A related node is activated.
- A meaningful knowledge update is received.
- A manually enabled demonstration mode.

Do not automatically zap random unrelated edges simply to make the scene look busy.

## 9.6 Concurrency limits

Suggested initial limits:

- Maximum 10 simultaneous electrical arcs.
- Maximum 4 overlapping propagation events.
- Global active-edge budget: approximately 80.
- Per-edge discharge cooldown: 500 ms.

On weaker devices, reduce these limits dynamically.

## 9.7 DO / DON'T

**DO:**
- Keep the effect attached to valid graph edges.
- Use an emissive appearance and controlled bloom.
- Restrict strong discharge effects to relevant pathways.
- Use short lifetimes.
- Provide a user option to disable zaps.
- Fully disable them under reduced-motion preferences.

**DON'T:**
- Spawn new materials on every electrical event.
- Update thousands of CPU-side vertices every frame.
- Fill the background with lightning.
- Make zaps obscure labels.
- Trigger zaps during every frame of hover.
- Allow pulse queues to grow without bounds.
- Confuse electrical animation with a real data-processing operation.

---

# PART 10 — REAL GRAPH SIGNAL PROPAGATION

## 10.1 Primary interaction

When the user selects a knowledge node:

1. Highlight the selected node.
2. Retrieve its direct connections.
3. Start an outgoing energy pulse on relevant edges.
4. Visually illuminate neighboring nodes when pulses arrive.
5. Optionally continue propagation to the next relationship level.
6. End the animation without changing graph data.

## 10.2 Graph traversal algorithm

Use breadth-first search for initial propagation.

The algorithm must operate on the actual adjacency list.

Suggested behavior:

- Default propagation depth: 2 hops.
- Maximum user-configurable depth: 3 hops.
- Visited-node tracking: required.
- Duplicate pulse prevention: required.
- Traversal based on actual graph edges.
- Direction respected for directed relationships.

Stop after configured depth or event-budget limits.

Do not infinitely cycle through graph relationships.

## 10.3 Propagation scheduling

Example:

At t = 0 ms:
- Selected node fires.

At t = 0–400 ms:
- Energy travels to first-degree neighbors.

At t = 400–800 ms:
- First-degree neighbors react and may propagate onward.

At t = 800–1200 ms:
- Second-degree neighbors react.

At completion:
- Temporary energy fades.
- Selected node and its neighborhood remain highlighted until deselected.

Actual timing should be based on edge durations and arrival events.

Use a priority/event queue instead of creating uncontrolled timers for every edge.

## 10.4 Shader synchronization

Maintain pulse events containing:

- `edgeId`
- `sourceId`
- `targetId`
- `startTime`
- `duration`
- `intensity`
- `color`
- `eventId`

Shader uniforms or instance attributes should derive pulse position from elapsed time.

Prefer a bounded active pulse buffer rather than arrays sized to every connection.

The CPU should manage relationship traversal and event scheduling.

The GPU should manage high-frequency visual interpolation.

## 10.5 Visual proof

When selecting a node, an observer must be able to follow at least one pulse moving visibly from its source to another connected node.

It is not sufficient for the entire network simply to flash or brighten simultaneously.

---

# PART 11 — GRAPH LAYOUT AND ORGANIC FORMATION

## 11.1 Default layout

Use a clustered three-dimensional layout combining:

- Force-directed node placement.
- Category attraction.
- Relationship springs.
- Collision avoidance.
- Weak centering.
- Stable seeded initialization.

The resulting graph should look like interconnected neural tissue rather than separate perfect spheres.

## 11.2 Spatial organization

Each category occupies a soft spatial region.

Within each region:

- Strongly related nodes sit closer together.
- Hub nodes generally occupy central positions.
- Less-connected nodes extend toward the outer area.
- Cross-category relationships create visible bridges.

Do not create completely disconnected spherical islands unless the actual graph contains disconnected components.

## 11.3 Layout algorithm

Use `d3-force-3d` or an equivalent deterministic simulation.

For each node, apply:

1. Link force based on connected edges.
2. Repulsive force between nearby nodes.
3. Category-centroid attraction.
4. Collision force based on approximate node importance.
5. Weak overall centering force.

Initial normalized simulation settings may include:

- Link distance: 1.5–3.5 world units.
- Repulsive strength: tuned for the node count.
- Collision distance: 0.35–0.8 units.
- Category attraction: weak to moderate.
- Simulation decay: sufficient to settle after initialization.

Tune against actual visual results rather than copying arbitrary force values unchanged.

## 11.4 Stability

The network must preserve its layout when:

- Hovering a node.
- Selecting a node.
- Opening the inspector.
- Changing node filters.
- Searching.
- Rotating the camera.
- Pausing animations.

Do not regenerate positions from random values on every render.

Store or cache stabilized positions.

When new knowledge is added, initialize new nodes near related nodes, rather than regenerating the entire universe.

## 11.5 Layout performance

Perform large layout calculations in a Web Worker.

Do not continuously run a CPU-intensive layout simulation unless the user is actively reorganizing the graph.

Default behavior:

1. Load nodes.
2. Calculate or restore layout.
3. Stabilize.
4. Freeze node positions.
5. Render continuously only as required by visual effects.

## 11.6 Alternative formations

The reference has multiple geometric formations.

Support this direction as an optional advanced visualization mode.

Suggested modes:

**Knowledge Clusters**
- Default for real knowledge.
- Meaningful semantic groupings.

**Neural Cortex**
- Organic center-outward organization.

**Neural Vortex**
- Controlled spiral arrangement.
- Visualization mode, not a semantic relationship replacement.

**Free Network**
- Standard force-directed 3D layout.

All formations must preserve the same nodes and actual edges.

Changing formation must never invent relationships or change stored knowledge.

---

# PART 12 — DATA MODEL AND KNOWLEDGE SEMANTICS

## 12.1 Graph types

Implement strong TypeScript interfaces.

Suggested node structure:

- `id: string`
- `title: string`
- `summary?: string`
- `categoryId: string`
- `type: KnowledgeNodeType`
- `tags: string[]`
- `importance: number`
- `createdAt?: string`
- `updatedAt?: string`
- `sourceIds?: string[]`
- `position?: Vector3Tuple`
- `metadata?: Record<string, unknown>`

Suggested edge structure:

- `id: string`
- `sourceId: string`
- `targetId: string`
- `type: KnowledgeRelationType`
- `strength: number`
- `confidence?: number`
- `directed: boolean`
- `provenance: manual | imported | inferred`
- `reviewStatus?: proposed | verified | rejected`
- `metadata?: Record<string, unknown>`

Use actual TypeScript unions or enums for supported node and relationship types.

Do not use `any` throughout the graph system.

## 12.2 Relationship types

Support at minimum:

- `related_to`
- `depends_on`
- `uses`
- `part_of`
- `supports`
- `contradicts`
- `references`
- `derived_from`
- `built_with`

Do not treat every relationship as equivalent.

## 12.3 Relationship semantics

Distinguish:

- Confirmed relationships.
- Imported relationships.
- AI-inferred relationships.
- Proposed relationships awaiting review.

Use subtle visual differences such as line opacity, patterns, or inspector metadata.

Do not present an AI-generated suggestion as an established factual relationship.

## 12.4 Graph validation

Before rendering:

1. Reject duplicate node IDs.
2. Reject or flag edges with nonexistent endpoints.
3. Validate normalized strength values.
4. Handle isolated nodes.
5. Handle disconnected components.
6. Deduplicate equivalent edges only when semantically appropriate.
7. Preserve directionality.
8. Build adjacency indexes.
9. Build node-ID-to-render-index maps.
10. Build edge-ID-to-render-index maps.

Graph filtering and rendering must operate on validated data.

## 12.5 Sample dataset

If no actual data source exists, create a deterministic development fixture.

Include approximately:

- 300 nodes initially.
- 500–700 meaningful sample edges.
- 8–10 knowledge categories.
- Several highly connected hubs.
- Cross-category bridges.
- Isolated nodes.
- Directed and undirected relationships.
- Different importance levels.

Example connected knowledge:

AI Agents → Retrieval-Augmented Generation → Vector Database → Embeddings.

Web Application → React → TypeScript → Supabase.

Automation → n8n → Webhooks → API Integration.

UI/UX → Interaction Design → Motion → Shader Effects.

Use believable relationships.

Mark the dataset clearly as sample data. Do not represent fabricated fixtures as the user's actual knowledge.

---

# PART 13 — INTERACTION SPECIFICATION

## 13.1 Pointer hover

On hover over a node:

1. Determine the actual node.
2. Increase its visual emphasis.
3. Highlight directly connected neighbors.
4. Emphasize their connecting edges.
5. Display a small tooltip containing the node title and category.
6. Dim unrelated elements slightly.

Hover feedback should begin promptly, ideally within 100 ms.

Do not rebuild graph geometry merely to produce hover effects.

## 13.2 Click interaction

Single-click a node:

1. Select the node.
2. Trigger a bounded relationship pulse.
3. Highlight direct connections.
4. Open the inspector.
5. Keep the node visible.
6. Preserve camera orientation initially.

Do not automatically zoom aggressively on every click.

## 13.3 Double-click interaction

Double-click:

1. Focus the selected node.
2. Smoothly adjust camera target.
3. Move the camera to a readable distance.
4. Expand or emphasize its local neighborhood.
5. Preserve spatial orientation.

Target transition duration: 500–800 ms.

Use easing such as cubic ease-in-out.

Prevent the single-click handler from accidentally triggering duplicate propagation events during double-click handling.

## 13.4 Clicking empty space

Default:

- Deselect the node.
- Close the inspector if appropriate.
- Restore graph emphasis.

Optional:

- Trigger a spatial wave like the reference demo.

Do not create new knowledge items when clicking empty space.

## 13.5 Camera dragging

Dragging rotates or pans the camera.

A drag must not be interpreted as a node click.

Use a small pointer movement threshold to distinguish click from drag, such as 5 CSS pixels.

## 13.6 Search

Provide a search input that:

- Searches titles.
- Searches tags.
- Searches summaries where available.
- Shows matching results.
- Supports keyboard navigation.
- Focuses the selected result in the graph.

When a search result is selected:

1. Find its node ID.
2. Reveal it if a temporary filter hides it.
3. Dim unrelated nodes.
4. Highlight its connections.
5. Focus the camera.
6. Open the inspector.

Do not rebuild the graph from scratch on every keystroke.

## 13.7 Category filtering

Support category selection and multi-selection.

Filtering should:

- Preserve node positions.
- Preserve actual graph data.
- Update visibility or emphasis.
- Maintain selection predictably.
- Avoid unnecessary GPU resource reconstruction.

Density controls should change visual density, not delete real knowledge.

## 13.8 Zoom behavior

Implement semantic zoom:

**Far zoom**
- Emphasize cluster shapes.
- Display only major labels or hubs.
- Reduce ambient connection detail.

**Medium zoom**
- Show standard nodes and edges.
- Highlight important relationships.
- Reveal a subset of labels.

**Near zoom**
- Show more node labels.
- Increase local relationship clarity.
- Allow precise node selection.

Use continuous transitions between levels.

Do not abruptly replace the entire graph with another layout.

## 13.9 Labels

Render labels in an accessible DOM-based overlay or a performant label system.

Rules:

- Important nodes can display labels by default.
- Ordinary nodes display labels on hover, selection, or close zoom.
- Selected nodes always have an identifiable label.
- Prevent overlapping labels where practical.
- Labels must remain legible against the dark background.
- Avoid permanent labels on all nodes.

---

# PART 14 — USER INTERFACE DESIGN

## 14.1 Visual philosophy

The 3D network is the hero element.

The UI must be quiet, restrained, and utilitarian.

Typography should be clear and professional.

Avoid oversized marketing-style headings, unnecessary descriptive copy, and decorative dashboard cards.

## 14.2 Typography

Recommended:

- Primary font: Inter.
- UI body: 13–14 px.
- Small metadata: 11–12 px.
- Section headings: 14–16 px.
- Selected node title: 18–22 px.
- Normal font weights: 400–600.

Avoid excessively spaced uppercase text.

## 14.3 Top toolbar

Provide:

- Knowledge graph title.
- Search.
- View mode.
- Settings.
- Optional knowledge count.

The toolbar must not occupy more visual space than needed.

## 14.4 Inspector panel

When selecting a node, display:

**Header**
- Knowledge title.
- Category.
- Node type.
- Close button.

**Main information**
- Summary.
- Tags.
- Important metadata.

**Relationships**
- Connected items.
- Relationship descriptions.
- Source and target direction when relevant.

**Sources**
- Actual linked notes or references.

**Actions**
- Open knowledge item.
- Focus graph neighborhood.
- Copy node reference.
- Highlight relationship path.

Only display actions that actually work.

If actual persistence/navigation is not available, use a working local demo action or omit the control rather than displaying nonfunctional buttons.

## 14.5 Bottom toolbar

Suggested actions:

- Reset camera.
- Fit graph.
- Pause/resume animation.
- Toggle connection pulses.
- Toggle labels.
- Switch layout mode.

Use compact icons with accessible labels and tooltips.

Avoid oversized floating capsules or numerous separate panels.

## 14.6 Settings

Provide controls for:

- Node brightness.
- Connection visibility.
- Bloom intensity.
- Animation speed.
- Energy pulse intensity.
- Zap effects on/off.
- Auto-rotation.
- Reduced motion.
- Performance quality.
- Theme palette.

Store appropriate user preferences locally if permitted by the application's architecture.

## 14.7 Responsive behavior

Desktop:
- Full 3D experience.
- Floating navigation.
- Right inspector.

Tablet:
- Reduced UI footprint.
- Smaller overlay controls.
- Inspector may become a drawer.

Mobile:
- Support touch orbit/zoom.
- Reduce graph density and post-processing.
- Replace persistent side panels with overlays.
- Use a bottom-sheet inspector.
- Provide easier tap targets.
- Offer a simplified graph mode if performance is inadequate.

Do not merely shrink the desktop UI.

---

# PART 15 — RENDERING AND SOFTWARE ARCHITECTURE

## 15.1 Preferred stack

Use:

- React.
- TypeScript, strict mode.
- Vite if creating a standalone project.
- Three.js.
- React Three Fiber where compatible.
- Drei for camera helpers where appropriate.
- Custom GLSL shaders.
- `@react-three/postprocessing`.
- Zustand for UI and graph interaction state.
- `d3-force-3d` for layout.
- Web Workers for expensive layout operations.
- Vitest for unit tests.
- Playwright for browser interaction tests.

Before installing dependencies, inspect the project's installed versions.

Avoid unstable version combinations.

Important compatibility rule:

Prefer a stable React Three Fiber/Three.js combination that supports WebGL and GLSL ShaderMaterial reliably.

If the selected React Three Fiber version uses a WebGPU-first rendering architecture, explicitly choose its compatible WebGL legacy path for GLSL rather than assuming the shader API is interchangeable.

Do not introduce WebGPU or a shader-language migration unless it is deliberately planned and tested.

## 15.2 Proposed project structure

Adapt to the existing repository rather than forcing a new layout.

Suggested structure:

src/
- components/
  - knowledge-graph/
    - KnowledgeGraph.tsx
    - GraphCanvas.tsx
    - GraphScene.tsx
    - GraphCameraController.tsx
    - GraphNodes.tsx
    - GraphEdges.tsx
    - GraphBackground.tsx
    - GraphLabels.tsx
    - GraphInteractionController.tsx
    - GraphPostProcessing.tsx
    - overlays/
      - GraphToolbar.tsx
      - GraphSearch.tsx
      - GraphFilters.tsx
      - GraphInspector.tsx
      - GraphSettings.tsx
      - GraphLegend.tsx
- graph/
  - types.ts
  - graphAdapter.ts
  - graphValidation.ts
  - graphIndex.ts
  - graphLayout.ts
  - graphSelection.ts
  - graphSearch.ts
  - graphVisibility.ts
  - graphCamera.ts
  - graphStore.ts
  - graphConfig.ts
  - mockGraph.ts
- graph/workers/
  - layout.worker.ts
- graph/effects/
  - PulseScheduler.ts
  - RelationshipPropagation.ts
  - ZapEffectSystem.ts
  - EffectPool.ts
- graph/geometry/
  - nodeBuffers.ts
  - edgeBuffers.ts
  - edgeCurves.ts
  - picking.ts
- shaders/
  - node.vert.glsl
  - node.frag.glsl
  - edge.vert.glsl
  - edge.frag.glsl
  - pulse.vert.glsl
  - pulse.frag.glsl
  - zap.vert.glsl
  - zap.frag.glsl
  - noise.glsl
- hooks/
  - useGraphData.ts
  - useGraphSelection.ts
  - useGraphSettings.ts
- styles/
  - graph.css
- tests/
  - graphValidation.test.ts
  - graphLayout.test.ts
  - graphPropagation.test.ts
  - graphSearch.test.ts
  - graphInteractions.spec.ts

This structure is a proposed separation of responsibilities, not a mandate to create dozens of unnecessary files.

## 15.3 Rendering pipeline

Follow this order:

1. Retrieve validated graph data.
2. Build graph indexes.
3. Calculate or restore node positions.
4. Build GPU-friendly node buffers.
5. Build GPU-friendly edge buffers.
6. Initialize the Three.js scene.
7. Load shader materials.
8. Render the base network.
9. Update shader uniforms every frame.
10. Render active pulses and zap overlays.
11. Apply controlled post-processing.
12. Render HTML-based interface overlays.

## 15.4 State separation

Separate:

**Application state**
- Search.
- Filters.
- Inspector state.
- Selected node.
- Settings.

**Graph data**
- Nodes.
- Edges.
- Relationship indexes.

**GPU state**
- Geometry.
- Shader uniforms.
- Active pulses.
- Camera state.
- Animation time.

Do not place every animation frame's data in React state.

Use refs, mutable buffers, and shader uniforms for high-frequency rendering changes.

---

# PART 16 — GPU PERFORMANCE AND RESOURCE MANAGEMENT

## 16.1 Initial performance targets

Use the following test datasets:

| Profile | Nodes | Edges |
|---|---:|---:|
| Small | 100 | 200 |
| Standard | 500 | 1,000 |
| Large | 1,500 | 3,000 |
| Stress | 5,000 | 10,000 |

These are test targets, not guarantees.

Aim for:

- Approximately 60 FPS on capable desktop hardware at standard size.
- At least 30 FPS on moderate supported devices at their appropriate quality settings.
- Responsive pointer interaction.
- No sustained main-thread blocking during layout.
- Bounded GPU resource usage.

Record actual hardware and results when benchmarking.

Do not claim performance requirements have been met without measurement.

## 16.2 Rendering optimizations

Implement:

- Batched points.
- Batched edges.
- Shared shader materials.
- Minimal draw calls.
- Typed geometry buffers.
- Uniform-driven animations.
- Stable object references.
- Cached adjacency maps.
- Controlled post-processing resolution.
- Adaptive quality settings.

## 16.3 Device pixel ratio

Initial desktop cap: `min(devicePixelRatio, 1.5)`.

Initial low-quality/mobile cap: `1.0`.

Adjust based on measured performance.

## 16.4 Adaptive quality

Provide three quality levels:

**High**
- Full selected-node glow.
- Standard ambient effects.
- Bloom.
- Full pulse animation.
- Zap branches.
- Higher particle budget.

**Medium**
- Reduced ambient effects.
- Simplified edge geometry.
- Bloom with lower resolution.
- Reduced zap concurrency.

**Low**
- Minimal background particles.
- Reduced bloom or bloom disabled.
- No secondary zap branching.
- Lower-detail edges.
- Limited automatic animations.

## 16.5 Cleanup

On component unmount or graph replacement:

- Dispose unused buffer geometries.
- Dispose custom materials.
- Release post-processing resources.
- Remove registered event listeners.
- Cancel outstanding transitions.
- Terminate unused workers.
- Clear active effects.
- Avoid leaking renderer resources.

Graph updates must not continuously create additional WebGL objects.

## 16.6 Visibility

Pause unnecessary rendering when the application is hidden.

Suspend idle animation when it is not needed.

Consider demand-based rendering when no shader effects or camera motion are active.

Respect battery and device constraints.

---

# PART 17 — ACCESSIBILITY AND FALLBACKS

## 17.1 Motion preferences

Detect `prefers-reduced-motion`.

When enabled:

- Disable auto-rotation.
- Disable electric flicker.
- Disable traveling zaps.
- Disable ambient camera drift.
- Reduce node breathing.
- Replace animated propagation with static relationship highlighting.
- Keep the graph fully usable.

## 17.2 Keyboard accessibility

Provide keyboard support for:

- Search focus.
- Selecting search results.
- Opening node details.
- Closing the inspector.
- Resetting view.
- Navigating relationships through the inspector.
- Activating toolbar controls.

A keyboard-accessible list/search interface must exist even when direct spatial node navigation is difficult.

## 17.3 WebGL failures

If WebGL is unavailable or the graphics context is lost:

- Show a useful fallback state.
- Avoid a blank black screen.
- Provide at least an accessible list of knowledge nodes.
- Allow searching and opening knowledge details where data is available.

Do not crash the entire application.

## 17.4 Loading states

Display a restrained loading state while:

- Fetching data.
- Calculating large graph layouts.
- Preparing shaders.

Avoid long forced introductory animations that delay access to knowledge.

---

# PART 18 — IMPLEMENTATION PHASES

Follow these phases in order.

Every phase requires implementation, testing, documentation, and validation before advancing.

## PHASE 0 — REPOSITORY AUDIT AND BASELINE

### Tasks

0.1 Inspect the repository structure.

0.2 Identify the frontend framework and installed versions.

0.3 Identify existing graph components.

0.4 Identify existing knowledge-data services.

0.5 Identify styling conventions.

0.6 Identify routing and state management.

0.7 Check whether a graph view already exists.

0.8 Run existing build and test commands.

0.9 Record current functionality and visual state.

0.10 Inspect the external reference's design and rendering implementation.

0.11 Create a compatibility-aware technical plan.

0.12 Record files likely to be modified.

### Deliverables

- `docs/NEURAL_GRAPH_ARCHITECTURE.md`
- `docs/NEURAL_GRAPH_PROGRESS.md`
- Initial repository audit and implementation decisions.

### Acceptance criteria

- Existing project can be built, or existing issues are documented.
- Rendering stack is selected.
- Data integration boundaries are identified.
- No existing functionality has been unnecessarily removed.

**Do not proceed to Phase 1 until the architecture and existing-project constraints are documented.**

---

## PHASE 1 — RENDER THE BASE 3D SCENE

### Tasks

1.1 Create the graph canvas.

1.2 Initialize Three.js with a compatible renderer.

1.3 Configure perspective camera.

1.4 Configure orbit controls.

1.5 Add near-black background.

1.6 Add restrained fog.

1.7 Render basic test points.

1.8 Add a minimal ambient particle field.

1.9 Implement resize handling.

1.10 Implement reset and fit-camera functionality.

1.11 Test scene cleanup and remounting.

### Acceptance criteria

- Canvas fills intended viewport.
- Camera orbit works smoothly.
- Zoom works smoothly.
- Graph area resizes without distortion.
- No WebGL errors.
- Background remains visually restrained.
- Scene resources are disposed correctly.

---

## PHASE 2 — IMPLEMENT GRAPH DATA AND POSITIONING

### Tasks

2.1 Define node and edge types.

2.2 Implement data validation.

2.3 Generate deterministic sample data.

2.4 Build adjacency indexes.

2.5 Implement category grouping.

2.6 Implement initial 3D layout.

2.7 Implement collision and spacing logic.

2.8 Stabilize layout.

2.9 Store stable positions.

2.10 Implement graph bounding-box calculation.

2.11 Fit camera automatically.

2.12 Move expensive layout calculation into a worker when necessary.

### Acceptance criteria

- Nodes form meaningful spatial clusters.
- Actual connections remain accurate.
- Isolated nodes do not crash rendering.
- Layout remains stable during ordinary interactions.
- Sample data is reproducible.
- No invented production relationships are introduced.

---

## PHASE 3 — BUILD GPU NODE SHADERS

### Tasks

3.1 Create node buffer geometry.

3.2 Add per-node shader attributes.

3.3 Create custom vertex shader.

3.4 Implement perspective scaling.

3.5 Implement fragment shader.

3.6 Implement glowing core.

3.7 Implement outer halo.

3.8 Implement subtle breathing.

3.9 Implement importance scaling.

3.10 Implement selection/hover intensity.

3.11 Add initial bloom.

3.12 Test across various zoom levels.

### Acceptance criteria

- Nodes visually resemble the reference.
- Core and halo are distinguishable.
- Node size scales naturally with camera distance.
- Important nodes are distinguishable.
- No sharp square point artifacts.
- No uncontrolled brightness.
- Hundreds of nodes render through efficient shared geometry.

---

## PHASE 4 — BUILD ORGANIC CONNECTIONS

### Tasks

4.1 Create validated edge buffers.

4.2 Calculate stable edge curves.

4.3 Generate connection segment geometry.

4.4 Implement base connection shader.

4.5 Implement subtle shader-based flow.

4.6 Add low-amplitude procedural movement.

4.7 Ensure stable endpoints.

4.8 Apply category/relationship colors.

4.9 Implement opacity-based hierarchy.

4.10 Implement selection-based edge emphasis.

4.11 Test dense graph visibility.

### Acceptance criteria

- Connections look fine and organic.
- No edge endpoint detachment.
- No unintended visible segment gaps.
- No constant aggressive lightning.
- Related nodes appear structurally connected.
- The graph resembles an interconnected neural network.

---

## PHASE 5 — IMPLEMENT RELATIONSHIP PULSES

### Tasks

5.1 Create the pulse-event data model.

5.2 Build the event scheduler.

5.3 Build graph traversal functionality.

5.4 Implement GPU pulse position interpolation.

5.5 Implement luminous pulse core.

5.6 Implement fading trail.

5.7 Implement node-arrival reaction.

5.8 Implement second-degree propagation.

5.9 Enforce propagation depth.

5.10 Implement duplicate-event prevention.

5.11 Implement cancellation.

5.12 Implement pause/resume behavior.

### Acceptance criteria

- A pulse visibly travels along the correct edge.
- Destination node reacts on arrival.
- Follow-on signals use actual adjacency.
- Cycles do not cause infinite propagation.
- Event counts remain bounded.
- Selection and graph data remain intact.

---

## PHASE 6 — IMPLEMENT ELECTRICAL ZAPS

### Tasks

6.1 Create electrical arc renderer.

6.2 Generate controlled jagged geometry.

6.3 Implement temporal noise.

6.4 Implement attack/sustain/fade envelope.

6.5 Integrate electrical glow with bloom.

6.6 Trigger arcs during meaningful activity.

6.7 Add optional branching.

6.8 Implement effect pooling.

6.9 Enforce concurrency and cooldown limits.

6.10 Add disable-zaps preference.

6.11 Respect reduced motion.

6.12 Test under repeated rapid interaction.

### Acceptance criteria

- Zaps resemble brief electrical transmissions.
- Effects follow actual connections.
- Arcs are not oversized.
- Glow is not washed out.
- No persistent flickering.
- Performance remains acceptable during repeated pulses.
- Disabling zaps removes the effects completely.

---

## PHASE 7 — IMPLEMENT INTERACTIONS AND CAMERA FOCUS

### Tasks

7.1 Implement node picking.

7.2 Implement hover state.

7.3 Implement selection state.

7.4 Implement neighbor highlighting.

7.5 Implement unrelated-node dimming.

7.6 Implement click/drag differentiation.

7.7 Implement double-click focus.

7.8 Implement camera interpolation.

7.9 Implement deselection.

7.10 Implement reset camera.

7.11 Implement viewport-aware framing.

7.12 Test navigation repeatedly.

### Acceptance criteria

- Correct node is selected.
- Hover works with dense nearby nodes.
- Click does not conflict with orbit controls.
- Camera transitions do not jump.
- Inspector opening does not hide the selected node.
- Selected state remains consistent after filtering.

---

## PHASE 8 — IMPLEMENT THE PRODUCT UI

### Tasks

8.1 Implement compact overlay header.

8.2 Implement searchable knowledge list.

8.3 Implement category filters.

8.4 Implement graph controls.

8.5 Implement selection inspector.

8.6 Implement relationship list.

8.7 Implement source/reference display.

8.8 Implement animation settings.

8.9 Implement quality controls.

8.10 Implement label visibility rules.

8.11 Add keyboard interactions.

8.12 Test desktop and responsive behavior.

### Acceptance criteria

- Graph remains dominant.
- UI is visually minimal.
- Search works.
- Filters work.
- Inspector displays actual graph data.
- Buttons perform real actions.
- Interactions are accessible.
- No unnecessary oversized panels.

---

## PHASE 9 — CONNECT TO EXISTING KNOWLEDGE DATA

### Tasks

9.1 Inspect actual knowledge storage.

9.2 Identify the existing data-fetching layer.

9.3 Implement a graph adapter.

9.4 Map existing knowledge records into nodes.

9.5 Map actual relationships into edges.

9.6 Validate relation endpoints.

9.7 Handle empty datasets.

9.8 Handle missing or incomplete metadata.

9.9 Preserve relationship provenance.

9.10 Replace the fixture with real data when the adapter is available.

9.11 Preserve the fixture as a development/testing option.

9.12 Verify the graph shows the correct knowledge records.

### Acceptance criteria

- Graph reflects actual stored data.
- No data is mutated by visualization alone.
- Existing authentication and access controls remain intact.
- Empty states work.
- Invalid relationship data is handled safely.
- Actual knowledge content is not fabricated.

If no backend exists, finish the frontend adapter boundary and fixture-based implementation rather than inventing a backend.

---

## PHASE 10 — PERFORMANCE OPTIMIZATION

### Tasks

10.1 Inspect draw-call count.

10.2 Inspect GPU buffer sizes.

10.3 Benchmark 100-node dataset.

10.4 Benchmark 500-node dataset.

10.5 Benchmark 1,500-node dataset.

10.6 Benchmark 5,000-node stress dataset.

10.7 Measure FPS during idle.

10.8 Measure FPS during orbit.

10.9 Measure FPS during propagation.

10.10 Measure FPS during repeated zaps.

10.11 Detect memory leaks.

10.12 Tune adaptive quality profiles.

10.13 Test reduced-motion mode.

10.14 Test renderer/context recovery.

### Acceptance criteria

- No unbounded resource growth.
- No avoidable geometry reconstruction during hover.
- No unnecessary React rerenders every frame.
- No unbounded active pulse queues.
- Layout does not freeze the UI.
- Effects degrade gracefully when hardware is constrained.

---

## PHASE 11 — FINAL VISUAL REFINEMENT

This phase is not optional.

### Tasks

11.1 Compare the rendered application against the selected CodePen.

11.2 Match the overall network density and organic character.

11.3 Refine point size and glow falloff.

11.4 Refine edge opacity and flow.

11.5 Refine bloom intensity.

11.6 Refine spatial depth.

11.7 Refine selection and pulse timing.

11.8 Refine electrical discharge geometry.

11.9 Refine camera smoothness.

11.10 Refine UI typography and spacing.

11.11 Check mobile and tablet layout.

11.12 Check error and fallback states.

11.13 Capture final screenshots and test results.

11.14 Record remaining limitations honestly.

### Acceptance criteria

The final experience must:

- Immediately resemble a neural network.
- Have visually appealing, shader-rendered glowing nodes.
- Have fine organic neural connections.
- Include genuinely traveling relationship pulses.
- Include carefully controlled electrical zap effects.
- Support smooth 3D rotation and inspection.
- Represent actual knowledge categories and relationships.
- Remain readable and navigable.
- Feel like a complete product rather than a WebGL showcase.

---

# PART 19 — REQUIRED TEST PLAN

Implement automated tests where meaningful and manual/browser-based tests for rendering behavior.

## Functional tests

- Node IDs are unique.
- Invalid edges are rejected or reported.
- Directed edges preserve direction.
- Adjacency indexes are correct.
- Graph search returns correct results.
- Filters do not delete knowledge.
- BFS traversal respects hop limits.
- Cycles terminate safely.
- Duplicate propagation is prevented.
- Selecting another node cancels or replaces prior selection effects consistently.

## Visual tests

- Node cores remain visible on dark background.
- Bloom does not wash out dense clusters.
- Lines remain connected to their endpoints.
- Zaps stay anchored to actual edges.
- Selecting a node dims unrelated nodes correctly.
- Pulse arrival is visually observable.
- Labels do not excessively overlap.
- Inspector does not cover the selected node.

## Interaction tests

- Mouse orbit.
- Mouse zoom.
- Trackpad navigation.
- Touch orbit.
- Touch zoom.
- Node hover.
- Node click.
- Double-click focus.
- Search selection.
- Inspector open/close.
- Camera reset.
- Pause and resume.

## Failure tests

- Zero nodes.
- One node.
- No edges.
- Disconnected graph.
- Very dense graph.
- Rapid repeated clicking.
- Browser window resize.
- Context loss.
- Slow data loading.
- Unsupported WebGL.
- Reduced-motion enabled.

Do not mark browser visuals as verified merely because TypeScript compiles.

---

# PART 20 — STRICT ANTI-PATTERNS

## Visual anti-patterns

Never:
- Use random particle clouds as a substitute for structured knowledge.
- Make all lines equally thick.
- Apply maximum bloom to every object.
- Use giant glowing buttons for nodes.
- Make all categories equally saturated.
- Add decorative text panels without a functional purpose.
- Add excessive gradients to interface panels.
- Introduce arbitrary 3D floating cards.
- Use unrelated stock illustrations.
- Prioritize spectacular effects over meaningful data.

## Engineering anti-patterns

Never:
- Allocate a new shader material per node.
- Allocate new geometries every frame.
- Run expensive force simulation on the main thread indefinitely.
- Call React state setters on every animation frame.
- Use a separate unbounded timeout for every propagation event.
- Depend on unsupported WebGL line-width behavior.
- Rebuild the entire graph on each search input change.
- Use randomization without a stable seed.
- Lose node selection when rendering buffers change.
- Silently overwrite existing application architecture.

## Product anti-patterns

Never:
- Fabricate relationship data.
- Imply AI-inferred connections are verified.
- Build nonfunctional buttons.
- Make users rotate a complex 3D structure just to access basic information.
- Obscure knowledge titles during selection.
- Force users to watch elaborate animations before accessing their notes.
- Allow graph navigation to be the only method of retrieving information.

---

# PART 21 — IMPLEMENTATION TRACKING

Create and maintain:

`docs/NEURAL_GRAPH_PROGRESS.md`

Use the following structure:

## Current phase

Phase number, title, and status.

## Completed tasks

Actual completed tasks, not planned intentions.

## In-progress tasks

Tasks currently being implemented.

## Pending tasks

Tasks required before the next milestone.

## Changed files

List of files created or modified.

## Implementation decisions

Record major technical decisions and their reasoning.

## Issues and blockers

Describe:
- The issue.
- Root cause if identified.
- Affected feature.
- Attempted resolution.
- Remaining work.

## Verification

Record:
- Build status.
- Unit test status.
- Browser test status.
- Visual verification status.
- Performance observations.

## Next actions

Concrete actions required to continue.

Update this file after each phase and whenever an important implementation decision changes.

Do not simply mark every phase complete at the end without evidence.

---

# PART 22 — EXECUTION PROCESS

Follow this exact process:

**Step 1 — Inspect**

Read the existing project and the selected reference.

**Step 2 — Plan**

Create a repository-specific architecture and task sequence.

**Step 3 — Establish baseline**

Confirm the application builds before changing anything.

**Step 4 — Implement foundation**

Create graph canvas, camera, and typed graph data.

**Step 5 — Match the reference visually**

Implement shader-rendered nodes and connections before building secondary UI features.

**Step 6 — Implement animated transmission**

Build traveling pulses and zap effects.

**Step 7 — Implement knowledge interactions**

Build selection, navigation, searching, filtering, and inspection.

**Step 8 — Integrate real data**

Connect to existing knowledge services without unnecessary backend changes.

**Step 9 — Optimize**

Benchmark and reduce unnecessary rendering work.

**Step 10 — Review**

Compare appearance, interactions, and performance against requirements.

**Step 11 — Document**

Record all completed work, tests, decisions, and remaining limitations.

Proceed through phases sequentially without seeking confirmation for ordinary non-destructive implementation decisions.

Do not execute destructive migrations, delete user data, or replace unrelated application modules without explicit approval.

---

# PART 23 — DEFINITION OF DONE

The implementation is complete only if the following conditions are satisfied:

### Visual

- [ ] The network resembles the selected neural visualization reference.
- [ ] Nodes use custom GPU-rendered glow.
- [ ] Connections look organic and fine.
- [ ] Background is dark and atmospheric.
- [ ] Bloom is controlled.
- [ ] Different node importance levels are apparent.

### Animation

- [ ] Base connections have subtle visual energy.
- [ ] Signals visibly move along actual edges.
- [ ] Destination nodes react.
- [ ] Electrical zaps occur during meaningful interactions.
- [ ] Animations can be paused.
- [ ] Reduced-motion settings are respected.

### Functionality

- [ ] Real graph data structures are supported.
- [ ] Node selection works.
- [ ] Search works.
- [ ] Category filtering works.
- [ ] Camera focus works.
- [ ] Inspector displays meaningful information.
- [ ] Relationships are accurate.
- [ ] Existing knowledge infrastructure is preserved.

### Quality

- [ ] No major shader compilation errors.
- [ ] No avoidable memory leaks.
- [ ] No unbounded effect queues.
- [ ] No obvious interaction lag on the standard dataset.
- [ ] No regression in unrelated application functionality.
- [ ] Responsive or fallback experience exists.
- [ ] Implementation progress is documented.

---

# FINAL INSTRUCTION TO CODEX

The selected CodePen is the primary visual reference. Its neural structure, shader-generated glow, fine lines, depth, camera behavior, and energy illumination are the intended aesthetic.

The additional electrical zaps must enhance that aesthetic without replacing it.

**The biggest mistake you could make is creating a technically functional 3D force graph that does not resemble the neural reference.**

Therefore, prioritize visual fidelity early. Prove the shader and connection systems first, then add knowledge-management functionality.

The intended result is:

**A premium, shader-driven, interactive 3D neural knowledge universe in which real information is represented by glowing nodes, connected through organic synaptic pathways, and explored through visibly traveling energy signals.**

Build it carefully, in phases, with documented progress and verified outcomes.

Do not stop at producing a plan. Implement the application in the available repository, subject to the preservation and safety constraints above.