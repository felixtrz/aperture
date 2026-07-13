# three.js Parity Plan — Gap Closure Roadmap

Status: proposed (2026-07-12). Implementation-gated; each phase lands only
when its acceptance criteria pass in `pnpm run check` and the e2e suite.

Sources: [`THREEJS_FEATURE_AUDIT.md`](THREEJS_FEATURE_AUDIT.md) §22 and
[`THREEJS_ADVANCED_RENDERING_AUDIT.md`](THREEJS_ADVANCED_RENDERING_AUDIT.md)
§9–§10. This plan turns every engineering-closable gap from both audits into
a work item with explicit acceptance criteria (AC), a size, and dependencies,
sequenced into six phases.

## Ground rules

**Out of scope (deliberate non-goals — do not plan against these).**
WebXR (IWSDK's domain, `DECISIONS.md 0023`); WebGL fallback (0001); a mutable
scene graph (0002/0004); class-based math (0007); an open live-object
renderer plugin model (0010–0012, 0016); three-mesh-bvh (0015). A visual
editor and "ecosystem size" are strategic questions, not gap-closure work
items, and are excluded.

**Invariants every item must respect.** Assets and materials stay data-only
(no live GPU objects in ECS); everything flows ECS → extraction →
`RenderSnapshot` → render world; no steady-state hot-path allocations
(0009); worker-safe and deterministic; snapshot transports either encode new
packet families or fall back to transferable (0022 consequence). Items that
change a renderer contract add or amend a `DECISIONS.md` entry in the same
change.

**Global definition of done (applies to every item, in addition to its ACs).**

- `pnpm run check` green (boundaries, typecheck, lint, format, vitest, docs
  build, diagnostics catalog).
- New diagnostics registered and `pnpm run check:diagnostics` regenerated.
- A browser example under `examples/` plus a Playwright e2e spec (golden
  baseline where the deliverable is pixels; report/diagnostic assertions
  otherwise).
- Docs updated (`AUTHORING.md` or relevant doc + recipe when it is an
  authoring surface).
- A changeset describing affected packages.
- The relevant scorecard cell(s) in the two audit docs updated in the same
  PR (the audits are the living parity record).

**Sizes.** S = one focused PR. M = 2–4 PRs. L = a multi-slice effort with its
own tracking section. XL = requires a short design doc before slicing.

---

## Phase map

| Phase | Theme                               | Items                   | Scenario flips (advanced audit §9)      |
| ----- | ----------------------------------- | ----------------------- | --------------------------------------- |
| 1     | Lit, data-rich custom materials     | A1 A2 A3 A4             | #3 ✅, #10 ✅, #4 🟡→✅, #1/#2 hardened |
| 2     | Render targets, MRT, user passes    | B1 B2 B3 B4             | #6 ✅, #11 ✅, #12 ✅, #9 ✅            |
| 3     | GPU-driven rendering                | C1 C2 C3                | #13 ✅, #14 ✅, #15 ✅                  |
| 4     | Scene & content dynamics            | D1 D2 D3 D4 D5          | #7 ✅, #8 ✅, #16 ✅, #17 ✅, #18 ✅    |
| 5     | Renderer breadth                    | E1 E2 E3 E4 E5          | main audit gaps 5–7, 10–12              |
| 6     | Animation, geometry, math, controls | F1 F2 F3 G1 G2 G3 H1 H2 | main audit gaps 3–4, 8, 13; #5 ✅       |

Target end state: advanced-audit scorecard moves from ✅4/🟡7/❌9 to
✅18/🟡2/❌0 (the two 🟡s being backend-caveated compute scenarios, same as
three.js).

---

## Phase 1 — Lit, data-rich custom materials

The single highest-leverage phase: it converts the custom-WGSL route from
"unlit quads" to "real game materials" without changing the data-only policy.

### A1. Lit-surface bind contract for custom WGSL (`@group(3)`) — **L**

Status: implemented (2026-07-13). Notes: the opt-in field is
`lighting: "lit"` on `material.customWgsl(...)`; the renderer PREPENDS the
contract header (`APERTURE_LIT_WGSL_HEADER`) instead of the user including
it, and rejects user `@group(3)` declarations. V1 exposes the documented
subset (packed lights + params, single directional shadow receiver with 3x3
PCF, IBL irradiance/PMREM/BRDF-LUT, fog); clustered indices and LTC area
lights stay behind a future contract version (`lit:v1` pipeline-key segment,
DECISIONS.md 0024). AC2's example is `examples/lit-custom-material` (lit
striped sphere + StandardMaterial reference sphere + shadow-receiving
ground; the shadow lands in the main view rather than a second camera view)
with pixel assertions instead of a golden baseline, mirroring the A2/A4
notes. AC3 achieved the STRONG form via readback pairs in the e2e: the
custom sphere implements the exact Lambert+GGX response through
`apertureEvaluateLightSurface`, and 18 mirrored pixel pairs on the two
spheres' surfaces asserted a MEDIAN per-channel diff ≤ 14/255 (measured 9,
with 10/18 pairs ≤ 9 and 5 byte-identical; the tail is the procedural
stripe band that makes the surface visibly custom). AC4's per-frame
allocation guard is structural (persistent light-buffer scratch +
dirty-window `queue.writeBuffer`, bind group reused across frames with
cache counters) rather than a wall-clock bench, per the test reliability
conventions.

Give custom materials an opt-in, renderer-owned lit contract on the reserved
bind group: packed lights, clustered indices, shadow atlas + comparison
sampler, IBL resources, and fog params, plus a WGSL contract header the user
includes (mirroring `docs/LIGHT_SHADER_WGSL_CONTRACT.md`).

- AC1: `material.customWgsl({ lighting: "lit" })` (name TBD) causes the
  renderer to bind the group(3) lit contract; the shader can call provided
  `apertureEvaluateLights(...)`/`apertureSampleIbl(...)` helpers without any
  app-side GPU wiring.
- AC2: New `examples/lit-custom-material` renders a custom splat/water
  surface lit by the same rig as `spinning-cube` (ambient + directional +
  environment); e2e golden baseline passes; the surface visibly receives a
  point-light shadow in a second camera view.
- AC3: A/B readback test: a custom material implementing the standard BRDF
  via the contract matches `StandardMaterial` output within an agreed
  per-channel tolerance on a shared scene (extend the shadow-lab or e2e
  readback diff harness).
- AC4: Unlit custom materials are byte-identical in pipeline key and
  behavior (existing `custom-material` e2e untouched); no new per-frame
  allocations (bench guard per `DECISIONS.md 0009`).
- AC5: `docs/AUTHORING.md` drops the "lighting/environment integration is
  deferred" caveat; new `DECISIONS.md` entry specifies the group(3) contract
  and its versioning; advanced-audit scenario #3 → ✅.

### A2. Storage-buffer bindings for custom materials — **M** (blocks C2)

Status: implemented (2026-07-12). Notes: `material.storage(name, { binding,
visibility?, buffer, runtimeBufferKey? })` takes a `BufferHandle` (registered
via `this.buffers.register(...)`) rather than a raw `bufferId` string;
`vec3f` element schemas are rejected with a stride-explaining diagnostic
(std430 16-byte array stride) in favor of `vec4f`; the AC3 e2e asserts draw
counts, the runtime-buffer packet count, non-clear pixels, and pixel motion
between presented frames instead of a golden baseline (wind animation makes a
fixed baseline flaky by construction).

Ship the renderer-independent buffer source asset already named as the
blocker in `docs/RENDER_ASSET_PREPARATION.md`, and a `material.storage()`
builder.

- AC1: A `BufferAsset` (typed element schema, usage, initial data) registers
  like any asset; `material.storage(name, { binding, bufferId })` binds it
  read-only in group(2); validation rejects live GPU objects exactly like
  other sources.
- AC2: `customWgslAppFrameResources.unsupportedBindingKind` no longer fires
  for storage bindings; a new diagnostic covers missing/mis-sized buffers.
- AC3: Example: instanced grass whose per-blade bend params live in a
  storage buffer authored from a worker system; e2e asserts draw counts and
  a golden baseline.
- AC4: Buffer updates follow the RuntimeUniform pattern (keyed packets,
  `queue.writeBuffer`, zero pipeline rebuilds) for dynamic ranges; update
  latency covered by a vitest on the packet path.

### A3. Expose existing PBR extension params on `material.standard()` — **S**

Status: implemented (2026-07-12).

Pure API plumbing; the renderer already ships these.

- AC1: `material.standard()` accepts transmission/thickness/ior/attenuation,
  clearcoat (+roughness), sheen (color+roughness), iridescence
  (factor/ior/thickness range), occlusion strength, normal scale — matching
  `StandardMaterialAsset` fields; typecheck exposes them in the generated
  config types.
- AC2: `examples/transmission` gains an app-facade variant (no low-level
  asset construction) producing the same golden baseline.
- AC3: `patchStandardMaterial` accepts the same fields at runtime without
  shader-variant recompiles (assert via pipeline-cache counters in the frame
  report).
- AC4: Advanced-audit scenario #10 → ✅; feature-audit §5.2 note updated.

### A4. Custom shadow-caster displacement hook — **M**

Status: implemented (2026-07-12). Notes: the caster bind contract mirrors the
shared position-only caster's group(0) (binding 0 = the pass's light
view-projection uniform, binding 1 = caster world transforms indexed by
`instance_index`) so the existing per-pass matrix bind groups are reused;
group(1) is bound empty and group(2) carries the material's own bindings
resolved to the same GPU resources as the main pass. The AC2 e2e asserts the
shadow region's pixel motion between two presented-frame samples plus a
dark-vs-lit ground margin instead of a golden baseline (the wave animation
makes a fixed baseline flaky by construction, mirroring the A2 note).

The analog of three.js `customDepthMaterial`/`castShadowPositionNode`: an
optional caster vertex entry point in the custom material asset, used by the
shadow caster pipeline for that mesh.

- AC1: `entryPoints.shadowVertex` (optional) compiles into a per-material
  caster pipeline; absent → today's shared position-only pipeline (zero
  regression, verified by unchanged shadow e2e baselines).
- AC2: Example: wind-displaced flag whose shadow silhouette moves with the
  displacement; golden baseline + a readback assertion that the shadow
  region shifts between two fixed sim times (deterministic seed).
- AC3: Pipeline key incorporates the caster entry point; caster pipelines
  are cached per material (cache counter asserted).
- AC4: Advanced-audit scenario #4 → ✅.

---

## Phase 2 — Render targets, MRT, and user-pass completion

### B1. Render-target authoring on the app facade — **M**

- AC1: `asset.renderTarget({ width, height, format, msaa?, depth?, mips? })`
  in `aperture.config.ts` (and a worker-side creator) allocates the texture
  renderer-side; no `device.createTexture` in user code.
- AC2: A camera pairs with it via existing `renderTargetId`; a
  `material.texture` binding can reference the target's color texture
  handle; resize keeps the handle stable (mirroring the proven low-level
  lifecycle matrix — the existing `render-target-*` e2e suite gains
  app-facade twins for initial/resize/reuse/MSAA).
- AC3: New `examples/minimap`: overhead camera → target → HUD quad, all
  app-facade; e2e golden baseline. Advanced-audit scenario #6 → ✅.
- AC4: Diagnostics for usage mismatches (sampling a target that lacks
  `TEXTURE_BINDING`, MSAA target sampled without resolve) with catalog
  entries.

### B2. Cube render targets + scene capture camera — **M** (needs B1)

- AC1: `asset.renderTarget({ dimension: "cube", size })` + a capture camera
  mode that renders 6 faces; result usable as `environmentMapId` and as a
  cube texture binding.
- AC2: Example: reflective sphere in a moving scene using a periodically
  re-captured probe; e2e asserts the probe re-render count and a golden
  baseline. Advanced-audit scenario #9 → ✅.
- AC3: Capture cost is opt-in and scheduled (every-N-frames / on-demand
  command), asserted via frame-report pass counts.

### B3. MRT authoring + user-pass target writes — **L**

Expose what the attachment planner already supports internally.

- AC1: Custom materials may declare N color targets (formats + write masks);
  fragment entry points with multiple `@location` outputs validate against
  the declaration; mismatches produce a structured diagnostic, not a device
  error.
- AC2: User render passes may write their declared targets: the frame graph
  honors `writes` to user-created transient/persistent textures (removing
  the "scene-color only" restriction and its diagnostic); ping-pong between
  two user targets works across frames.
- AC3: Example: custom G-buffer (albedo + normal + custom ID) resolved by a
  user pass into scene color; e2e golden baseline + graph-pass count
  assertions. Advanced-audit scenario #11 → ✅, #12 → ✅.
- AC4: Frame-graph compile rejects write cycles with a diagnostic; the
  legacy non-frame-graph route reports user MRT passes as skipped exactly as
  it does today for user passes.

### B4. Depth access for custom materials + user passes — **M**

- AC1: `material.texture` can bind the scene depth (read-only, post-opaque
  phase enforced by queue validation) with a comparison-capable sampler
  option; texture binding layouts gain depth/unfilterable/comparison
  variants (closing the "float/2D/filtering only" hard-coding).
- AC2: Example: custom soft-edge intersection effect (forcefield) fading
  against scene depth; golden baseline; MSAA path uses the existing
  MSAA-aware depth sampling and is covered by an MSAA variant spec.
- AC3: Advanced-audit scenario #19 note upgraded (custom materials can depth
  fade); binding-layout table in the advanced audit §2.2 updated.

---

## Phase 3 — GPU-driven rendering

### C1. Compute→draw plumbing — **L** (needs A2)

- AC1: A compute pass may declare a `BufferAsset` as writable; the same
  buffer is consumable the same frame as (a) a custom-material storage
  binding and (b) an instance-attribute stream (`InstanceData` gains a
  buffer-backed source), with frame-graph ordering guaranteeing
  compute-before-draw.
- AC2: Example: GPU boids — compute updates positions in a storage buffer;
  instanced custom material renders them with zero CPU copies; e2e asserts
  entity/instance counts, a motion readback between two frames, and 60-frame
  determinism with a fixed seed.
- AC3: Advanced-audit scenario #13 → ✅ and #14 → ✅ (crowd = boids + A1 lit
  or built-in material via instance stream).

### C2. Indirect draw user surface — **M** (needs C1)

- AC1: The user-pass render sink gains `drawIndirect`/`drawIndexedIndirect`
  taking a `BufferAsset` region; the internal `indirect-draw-commands`
  fallback reasons surface in the frame report when the path degrades.
- AC2: Example: compute-driven culling writing indirect args (visible
  instance count) consumed by an indirect draw; e2e asserts that occluded
  instances reduce the drawn count via the frame report.
- AC3: Advanced-audit scenario #15 → ✅.

### C3. Compute ergonomics: data-described kernels — **M** (optional polish)

Reduce the raw-WebGPU surface area of `addComputePass` for common cases.

- AC1: A `computeKernel` asset (WGSL source + typed bindings, same shape as
  custom materials) can be dispatched from a system command without touching
  `GPUDevice`; the raw `encode(ctx)` path remains for full control.
- AC2: The luminance-histogram example gains a data-described twin with
  identical output (readback equality assertion).

---

## Phase 4 — Scene & content dynamics

### D1. Stencil support — **M**

Flips the one render state explicitly marked unsupported. Requires a
`DECISIONS.md` amendment (it documents a contract change).

- AC1: `renderState.stencil` (write/func/ref/masks/ops) on all material
  kinds; depth-stencil formats selected automatically when any material in a
  view uses stencil; `unsupportedFeatures` drops `"stencil"`.
- AC2: Examples: stencil portal (masked scene view) and stencil outline;
  golden baselines for both. Advanced-audit scenarios #8 → ✅ and #7 → 🟡.
- AC3: Snapshot/packet encoding covers the new state; SAB transport either
  encodes it or falls back per 0022; validation diagnostics for
  stencil-on-format-without-stencil.

### D2. Clipping planes — **M**

- AC1: Per-camera (and optional per-material) clip planes, implemented via
  WGSL clip distances where available with a discard fallback; count limit
  documented and diagnosed.
- AC2: Example: cutaway view of a glTF building interior; golden baseline.
  Feature-audit §4 clipping row → ✅; combined with B1/B2 + D1, planar
  mirror (scenario #7) → ✅ via an oblique-clip mirror example.

### D3. Runtime texture updates (dynamic + video) — **M**

- AC1: A `dynamic-texture` asset accepts CPU-side updates (full and
  sub-rect) via a keyed command (RuntimeUniform-style packets;
  `queue.writeTexture` renderer-side); update rate and bytes appear in the
  frame report.
- AC2: Video: main-thread `HTMLVideoElement`/`VideoFrame` import path
  (renderer-side only, worker never touches DOM) exposed as a texture
  handle; frame-accurate updates asserted by readback of a known test
  pattern.
- AC3: Example: in-world scoreboard (canvas-sourced) + TV (video-sourced);
  e2e asserts pixel change between frames. Advanced-audit scenario #18 → ✅.

### D4. Decals — **M** (needs D1 or B3; prefer projected-decal route)

- AC1: A decal component (texture, size, projection transform, layer mask,
  fade) renders projected onto opaque scene geometry without z-fighting
  (depth-bias or deferred-style reconstruction — implementation's choice,
  proven by the baseline).
- AC2: Example: FPS-style bullet holes accumulating on walls with a cap +
  eviction policy asserted via report counts. Scenario #17 → ✅.

### D5. First-class dynamic mesh API — **S**

- AC1: `meshes.update(handle, { streams, updateRanges })` from systems
  performs partial uploads through the existing update-range plan without
  re-registering the asset; invalid ranges diagnose.
- AC2: Example: CPU cloth flag deforming per frame; e2e asserts stable 60
  updates with no full-buffer re-uploads (upload byte counter in report).
  Scenario #16 → ✅.

---

## Phase 5 — Renderer breadth (main audit §22.1 items 5–7, 10–12)

### E1. Fat lines & points materials — **M**

- AC1: Line material with screen-space width, dashes, joins (Line2-style
  instanced quads under the hood); point material with size + attenuation.
- AC2: Examples: debug path visualization (lines) and a point-cloud viewer;
  golden baselines; feature-audit §8 rows → ✅.

### E2. Mesh LOD — **M**

- AC1: `Lod` component (levels: mesh handle + distance/screen-coverage
  threshold, hysteresis); selection runs in extraction using existing
  bounds; per-camera.
- AC2: Example: field of LOD'd rocks; e2e asserts draw counts change with
  camera distance via frame report; no popping within hysteresis band
  (two-frame report assertion).

### E3. Debug helpers / debug-draw system — **M**

- AC1: Immediate-mode debug draw API from systems (lines, AABBs, spheres,
  axes, grids, camera frusta, light gizmos, skeleton bones) rendered as an
  overlay layer, compiled out / no-op in production builds.
- AC2: Physics debug geometry re-plumbed through the same path (single
  overlay route); example + e2e report assertions on primitive counts.

### E4. Post-processing tail, prioritized subset — **L**

Order: outline (ID-buffer-based — the picking ID buffer already exists),
motion blur (motion vectors already exist for TAA), LUT color grading
(3D-texture-lite via 2D strip until 3D textures land), GTAO upgrade for the
SSAO slot.

- AC1 (per effect): effect slots into the ordered post array with JSON
  params; example + golden baseline; frame-report per-effect diagnostics
  like existing effects.
- AC2: Outline works from a `Pickable`/entity list (select an entity in the
  city-builder showcase → outline appears; asserted in its MCP-parity e2e).

### E5. Additional lights & texture types — **M**

- AC1: Hemisphere light kind (sky/ground colors) packed like other lights;
  example + baseline; feature-audit §6 row → ✅.
- AC2: 3D and 2D-array texture assets (upload + sampling in custom
  materials); LUT grading (E4) migrates to a real 3D texture.
- AC3: Light probes/SH deferred to a follow-up decision — record explicitly
  in DECISIONS if rejected (avoid an implicit gap).

---

## Phase 6 — Animation, geometry, math, controls

### F1. Animation mixer v2: N-lane blending + additive — **L**

- AC1: Mixer supports N simultaneous weighted clips (walk/run blend), per-lane
  speed/loop, fade in/out, and additive lanes (delta clips à la
  `makeClipAdditive`); deterministic under fixed seed/step (vitest replay
  equality).
- AC2: Example: locomotion blend space (idle/walk/run by speed signal) +
  additive head-look; e2e drives input and asserts pose readback at fixed
  frames; feature-audit §10 mixer row → ✅.

### F2. IK (two-bone + CCD) — **M** (needs F1)

- AC1: Two-bone IK (arms/legs, pole target) and CCD chain solver as
  fixed-step systems writing joint local transforms; deterministic; foot
  placement demo using physics raycasts; e2e pose assertions.

### F3. Skinning/morph inputs for custom WGSL — **L** (needs A1; unlocks #5)

- AC1: Opt-in `skinned: true` on custom materials binds the existing joint
  palettes + weights/joints attributes (and morph deltas) with a contract
  header helper `apertureSkin(position, normal)`; example: custom-shaded
  character with dissolve; golden baseline; scenario #5 → ✅.

### G1. Geometry primitives round-out — **S**

- AC1: circle/ring, torus knot, platonic solids (via one polyhedron
  builder), rounded box; all emit the standard interleaved layout + bounds;
  vitest golden vertex-count/normal checks; feature-audit §7 count updated.

### G2. Curves + extrude/lathe/tube — **M** (feeds G1, E1, camera rails)

- AC1: Math package (or a new `geometry` module) gains curve primitives
  (line/quadratic/cubic Bézier, Catmull-Rom, arc) with `getPoint/getTangent/
getLength`; deterministic, allocation-light, array-first API (respecting
  0007).
- AC2: extrude (with Earcut-style triangulation), lathe, tube builders
  produce meshes with correct normals/uvs/bounds; example: procedural
  racetrack tube; e2e baseline.

### G3. Math utilities — **S**

Status: implemented (2026-07-12).

- AC1: `Triangle` ops (closest point, barycentric, area), `Line3` ops,
  spherical↔cartesian helpers, easing pack (standard Penner set) — all
  kernel-style functions over arrays, benched, no classes (0007).

### H1. Camera controllers round-out — **M**

- AC1: Pointer-lock FPS controller (packaged from the FPS showcase pattern),
  pan/map controller, arcball; all ECS-authoritative and headless-safe like
  existing controllers; per-controller example + e2e input-driven pose
  assertions.

### H2. Transform gizmo completion — **M**

- AC1: Rotate + scale gizmos joining the translate gizmo, with snapping;
  driven through the same interaction frame; e2e drag tests assert
  component deltas.

---

## Explicitly deferred (recorded, not planned)

- **Non-glTF importers and exporters** (main audit gap 2). The depth-over-
  breadth bet stands: close glTF corner gaps instead — sparse accessors,
  `KHR_materials_specular`, `KHR_materials_emissive_strength`, anisotropy
  (S–M each, slot into Phase 1 alongside A3). A glTF **exporter** (scene
  document → GLB) is worthwhile but strategic — decide separately; record
  the decision either way in `DECISIONS.md`.
- **Light probes / SH ambience** — revisit after E5; record if rejected.
- **Text/extruded font geometry** — MSDF covers UI/world text; extruded 3D
  type is niche; revisit after G2 (extrude makes it cheap).
- **Visual editor** — out of scope here; the agent/MCP tooling is the
  current bet.

## Sequencing rationale & dependency spine

A2 → C1 → C2 is the storage-buffer spine; A1 → F3 is the lit-contract spine;
B1 → B2/B3 → D4 is the render-target spine; D1 unlocks both #8 and half of
#7, with D2 finishing mirrors. Phases 1–3 are renderer-core and should land
before breadth work (Phases 5–6) so new features (decals, outline, LOD)
build on the final contracts rather than being retrofitted.

## Tracking

Each item lands with its audit-scorecard flip in the same PR, so
`THREEJS_FEATURE_AUDIT.md` §3/§22 and `THREEJS_ADVANCED_RENDERING_AUDIT.md`
§9 remain the single source of truth for parity status. When an item's
design deviates from this plan, amend this document in the same change
(status header → `amended`, with a dated note), mirroring how
`FEATURE_PACKAGES_HARDENING_PLAN.md` tracked its phases to `implemented`.
