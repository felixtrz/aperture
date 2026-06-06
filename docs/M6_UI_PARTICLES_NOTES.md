# M6 UI + Particles Plan

**Status:** implemented in this run for the required M6 scope; kept as the design record and acceptance trace.

**Workflow source:** replicated from `.claude/workflows/m6-ui-particles-plan.js`
with Codex on 2026-06-05. The Claude workflow itself was not executed by
Codex; the same phases were reproduced here: Study, Design, Integrate,
Critique, Finalize.

**Scope:** this is M6, the roadmap content-layer milestone. It builds on the
completed M3 render graph and M7 pointer interaction work. It is now mapped to the completed M6 required scope in `docs/SOTA_ROADMAP.md`; decals and volumetrics remain deferred stretch work.

## 1. Decision Summary

- M6 should start with a shared quad foundation. Sprites, UI panels/images,
  glyph quads, and GPU particle billboards all need the same packed instance
  transport and WebGPU batching shape.
- UI should be retained ECS, not immediate-mode and not DOM-backed. Layout,
  stacking, clipping, and hit regions are derived in the worker from ECS state.
- Text for M6 is basic MSDF/BMFont-compatible LTR text: atlas metrics, kerning,
  wrapping, alignment, and stable glyph runs. Complex shaping and fallback font
  systems are deferred.
- Particles should be GPU-simulated by default. ECS owns emitter authoring,
  playback intent, transforms, seeds, bounds, reset epochs, and visibility; WebGPU
  owns live particle buffers and per-emitter GPU state.
- UI interaction should feed the existing M7 pointer stream, but the hit-test
  authority must be worker-side layout data, not a main-thread render snapshot.
- Decals and volumetrics are not part of the M6 completion bar. At most, they get
  a late feasibility gate after UI and particles ship.

## 2. Reference Findings

### uikit

Reference anchors:

- `references/uikit/packages/uikit/src/components/component.ts`
- `references/uikit/packages/uikit/src/properties/schema.ts`
- `references/uikit/packages/uikit/src/properties/index.ts`
- `references/uikit/packages/uikit/src/properties/inheritance.ts`
- `references/uikit/packages/uikit/src/properties/conditional.ts`
- `references/uikit/packages/uikit/src/flex/node.ts`
- `references/uikit/packages/uikit/src/flex/yoga.ts`
- `references/uikit/packages/uikit/src/text/font.ts`
- `references/uikit/packages/uikit/src/text/layout/`
- `references/uikit/packages/uikit/src/text/render/`
- `references/uikit/packages/uikit/src/clipping.ts`
- `references/uikit/packages/uikit/src/scroll.ts`
- `references/uikit/packages/uikit/src/order.ts`
- `references/uikit/packages/uikit/src/allocation/sorted-buckets.ts`

uikit is the UI/text feature baseline: layered CSS-like properties, inheritance,
conditionals, Yoga layout, MSDF fonts through `@pmndrs/msdfonts`, text
measurement/wrapping/kerning/alignment, instanced panels/glyphs, clipping,
scrolling, input widgets, and ordered allocation.

The reusable shape is the retained layout and text model. The three.js pieces
cannot be ported directly: Object3D state, signal-driven object mutation, and
material patching must become ECS components, deterministic worker systems,
typed snapshot buffers, and native WGSL pipelines.

### three.quarks

Reference anchors:

- `references/three.quarks/packages/quarks.core/src/ParticleSystem.ts`
- `references/three.quarks/packages/quarks.core/src/ParticleEmitter.ts`
- `references/three.quarks/packages/quarks.core/src/shape/`
- `references/three.quarks/packages/quarks.core/src/behaviors/`
- `references/three.quarks/packages/quarks.core/src/functions/`
- `references/three.quarks/packages/quarks.core/src/sequencers/`
- `references/three.quarks/packages/three.quarks/src/BatchedRenderer.ts`
- `references/three.quarks/packages/three.quarks/src/materials/`

three.quarks is the authoring baseline, not the runtime architecture. It has a
CPU simulation core with duration, looping, prewarm, emission over time/distance,
bursts, point/circle/cone/donut/sphere/hemisphere/rectangle/grid/mesh emission,
random ranges, curves, gradients, over-life behaviors, forces, gravity, noise,
turbulence, orbit, trails, sub-emission, billboards, mesh particles, sprite
sheets, blend modes, soft particles, and sorting.

Aperture should keep the declarative effect model and staged feature vocabulary,
but live particles should not be JS objects. M6 uses GPU-friendly schemas,
storage buffers, deterministic integer-hash RNG, and compute passes.

### PlayCanvas

Reference anchors:

- `references/engine/src/framework/components/screen/`
- `references/engine/src/framework/components/element/`
- `references/engine/src/framework/components/layout-group/`
- `references/engine/src/framework/components/layout-child/`
- `references/engine/src/framework/components/particle-system/`
- `references/engine/src/scene/particle-system/`
- `references/engine/src/scene/shader-lib/wgsl/chunks/particle/`

PlayCanvas is useful for component shape and WebGPU particle constraints. Its UI
model covers screen-space/world-space screens, anchors, pivots, margins, groups,
images, text, masks, and layout groups. Its particle component shows practical
authoring schemas, paired min/max curves packed for GPU consumption, fixed
timestep/substep behavior, bounds, sprite-sheet animation, soft particles,
lighting options, normal maps, and sorting modes.

The key lesson is to make curve packing and capability gating explicit. Some
sorting modes force CPU decisions in PlayCanvas; M6 should avoid promising
per-particle alpha sort until there is a dedicated GPU sort design.

### Bevy UI

Reference anchors:

- `references/bevy/crates/bevy_ui/src/ui_node.rs`
- `references/bevy/crates/bevy_ui/src/layout/`
- `references/bevy/crates/bevy_ui/src/measurement.rs`
- `references/bevy/crates/bevy_ui/src/update.rs`
- `references/bevy/crates/bevy_ui/src/stack.rs`
- `references/bevy/crates/bevy_ui/src/focus.rs`
- `references/bevy/crates/bevy_ui/src/picking_backend.rs`
- `references/bevy/crates/bevy_ui_render/src/`
- `references/bevy/crates/bevy_text/src/`

Bevy is the strongest architecture anchor. UI is retained ECS. Taffy layout runs
in systems. Derived computed nodes, transforms, clips, and stack indices drive
both rendering and picking. Extraction flattens rects, images, and glyphs into a
render-world representation.

Aperture should mirror this split: ECS authoring and derived layout data in the
worker, typed RenderSnapshot packets for rendering, and identical stack/clip data
for hit testing.

### Existing Aperture Sprite Path

Reference anchors:

- `packages/runtime/src/index.ts`
- `packages/render/src/rendering/authoring-components-core.ts`
- `packages/render/src/rendering/extraction-sprites.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/runtime/src/simulation-worker.ts`
- `packages/webgpu/src/app/sprites.ts`
- `packages/webgpu/src/app/sprite-frame.ts`
- `packages/webgpu/src/render/sprites/sprite-pipeline.ts`

Sprites are the current quad-like path: ECS `Sprite` authoring extracts
`spriteDraws`, the runtime transfers snapshot data, and WebGPU renders instanced
billboards. The limitations are exactly the M6-T1 foundation work: one packet per
sprite, texture/sampler metadata too close to each draw, no shared typed quad
instance buffer, no uv rects, no atlas frames, no pivot, no rotation, no
screen-space sizing, and no cylindrical or axis-locked billboard modes.

### Existing Aperture Render Graph and Compute

Reference anchors:

- `packages/webgpu/src/render/graph/frame-graph.ts`
- `packages/webgpu/src/render/graph/frame-graph-compile.ts`
- `packages/webgpu/src/render/graph/frame-graph-execute.ts`
- `packages/webgpu/src/render/graph/frame-graph-history.ts`
- `packages/webgpu/src/render/passes/compute-pass-commands.ts`
- `packages/webgpu/src/lighting/`

M3 already provides compute pass nodes, buffer handles, direct/indirect compute
commands, draw commands, graph ordering, and generic history resources. Particle
compute can be built on this, but M6 still needs first-class persistent particle
state descriptors, reset/resize semantics, and resource lifecycle rules keyed by
stable render ids.

### Existing Aperture Interaction

Reference anchors:

- `packages/app/src/interaction/access.ts`
- `packages/app/src/interaction/system.ts`
- `packages/app/src/interaction/pointer-events.ts`

M7 pointer interaction currently raycasts 3D spatial data from the worker and
emits pointer events through `InteractionAccess`. UI cannot use main-thread
render state as the source of truth. M6 should add a worker-side 2D UI hit-test
producer that uses computed UI hit regions and stack order, then resolves whether
UI blocks or coexists with 3D picking before user-facing interaction events run.

## 3. Package Boundaries

| Area                     | Package responsibility                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECS authoring components | `@aperture-engine/render` owns `Sprite` extensions, UI components, text components, particle emitter authoring, effect asset schemas, extraction systems, and snapshot type definitions.        |
| Runtime transport        | `@aperture-engine/runtime` and `@aperture-engine/app` own worker/main transfer lists, shared-buffer snapshot reconstruction, public `withX()` helpers, and route-level orchestration.           |
| WebGPU resources         | `@aperture-engine/webgpu` owns WGSL, GPU buffers, bind groups, pipelines, graph nodes, particle live-state buffers, persistent buffer pools, atlas GPU resources, and render/compute execution. |
| Simulation               | `@aperture-engine/simulation` must remain renderer-agnostic and should not import UI, particle render assets, GPU handles, DOM, Canvas, font objects, or layout engine instances.               |
| Interaction              | `@aperture-engine/app` owns the M7 bridge, but the hit-test data is produced by worker-side ECS/layout systems in render-facing data structures.                                                |
| Tests                    | Headless extraction/layout/asset tests live near `render`; WebGPU graph/pipeline tests live near `webgpu`; Playwright route proofs live in app/examples.                                        |

## 4. Shared Quad Foundation

M6 should not overload the current sprite draw packet. It should introduce a
quad packet family:

- `QuadInstanceBuffer`: fixed-stride typed instance data for position/anchor,
  size, rotation, pivot, uv rect, color, clip id, stack/depth data, mode flags,
  atlas frame index, and source transform index.
- `QuadBatchPacket`: compact metadata for texture handle, sampler handle,
  material/pipeline variant, blend mode, coordinate space, billboard mode,
  instance range, and sort key. Texture/sampler/material keys belong here, not
  repeated per instance.
- `SpriteQuadPacket`, `UiQuadPacket`, `GlyphRunPacket`, and
  `ParticleEmitterPacket`: feature-level records that reference quad instance
  ranges or describe GPU-owned particle work that will build quad instances on
  the WebGPU side.
- Snapshot transport updates: transfer-list support, shared-buffer layout
  capacities, packet encoder/decoder changes, asset handle mapping, and
  app-side snapshot reconstruction.
- WebGPU variants: prefer a shared ABI and small pipeline variants over one
  branch-heavy mega-shader. Expected variants are world billboards, screen/UI
  quads, MSDF glyphs, and particle billboards.

The foundation must end with a visible sprite proof route. Infrastructure alone
is not a valid completed M6 slice.

## 5. Revised M6 Task Graph

| ID     | Title                                            | Packages             | Effort | Depends on  | Output                                                                                                          |
| ------ | ------------------------------------------------ | -------------------- | ------ | ----------- | --------------------------------------------------------------------------------------------------------------- |
| M6-T1a | Quad ABI, packets, and transport                 | render, runtime, app | M      | none        | Typed quad buffers cross worker/main snapshots without changing sprite visuals.                                 |
| M6-T1b | Rich sprite authoring and extraction             | render, runtime      | M      | T1a         | Sprites emit quad instances with uv rect, atlas frame, pivot, rotation, size mode, and billboard mode.          |
| M6-T1c | Batched WebGPU quad sprite pipeline              | webgpu, app          | M      | T1a, T1b    | Existing sprite route renders through batched quad ranges with Playwright pixel proof.                          |
| M6-T2  | MSDF font atlas asset and glyph layout core      | render, runtime      | M      | T1a         | BMFont/MSDF atlas metrics, basic LTR layout, kerning, wrapping, alignment, and typed glyph runs.                |
| M6-T3  | Native MSDF text WebGPU pipeline                 | webgpu, app          | L      | T1c, T2     | Screen/world text draws through MSDF WGSL with sharpness and atlas sampling proof.                              |
| M6-T4  | Retained ECS UI tree and layout extraction       | render, runtime      | L      | T1a, T2     | UI components, layout adapter, computed nodes, clips, stack order, hit regions, and snapshot packets.           |
| M6-T5  | Native UI panel/image/text render passes         | webgpu, app          | L      | T1c, T3, T4 | Screen-space HUD overlay renders panels, images, and text after scene/post with clipping and batching.          |
| M6-T6  | UI hit-test and M7 interaction bridge            | render, app          | M      | T4, T5      | Worker-side topmost UI hit regions feed M7 pointer events and can block 3D picks.                               |
| M6-T7  | Particle authoring assets and emitter extraction | render, runtime      | L      | T1a         | ECS emitter/effect schemas, curve/gradient packing, bounds, seed/reset semantics, and emitter packets.          |
| M6-T8  | Persistent GPU particle buffers                  | webgpu               | M      | T7          | Graph-managed emitter GPU state lifecycle, reset/prewarm/resize/cleanup, and a tiny compute proof.              |
| M6-T9  | GPU particle compute and quad rendering          | webgpu, app          | L      | T1c, T7, T8 | Additive/unsorted GPU particles simulate, compact/build args, and render as instanced quads.                    |
| M6-T10 | Cross-feature showcase                           | app, webgpu          | M      | T5, T6, T9  | One route combines sprites, text, UI, particles, worker snapshots, status JSON, and interaction blocking proof. |
| M6-ST1 | Decals/volumetrics feasibility note              | render, webgpu       | S      | T10         | Optional decision/proof only; not required for M6 completion.                                                   |

### M6-T1a: Quad ABI, Packets, and Transport

Done when:

- `RenderSnapshot` can carry typed quad instance buffers and batch packets by
  transfer list and shared-buffer snapshot modes.
- Packet/buffer versioning, stride, enum packing, alignment, and ownership rules
  are documented in code.
- Existing sprites still render through a compatibility path.
- Tests cover packet encoding/decoding, transfer lists, shared-buffer
  reconstruction, and boundary rules.

Reference anchor: `packages/render/src/rendering/extraction-sprites.ts` and
`packages/runtime/src/simulation-worker.ts`.

### M6-T1b: Rich Sprite Authoring and Extraction

Done when:

- `Sprite` authoring supports uv rect, atlas frame, pivot, rotation, coordinate
  mode, size mode, billboard mode, layer/order, tint, and blend-ready metadata.
- Extraction writes reusable quad buffers without allocating fresh hot-path
  object graphs per frame.
- Headless tests prove stable packing, transform usage, atlas uv selection, and
  unchanged default sprite behavior.

Reference anchor: `references/uikit/packages/uikit/src/allocation/sorted-buckets.ts`
and `packages/render/src/rendering/authoring-components-core.ts`.

### M6-T1c: Batched WebGPU Quad Sprite Pipeline

Done when:

- WebGPU renders sprites from quad instance buffers and compact batch packets.
- Pipeline variants cover the existing world billboard path plus the M6 sprite
  modes needed by UI and particles later.
- A route proves atlas uv rects, rotation, pivot, screen-space sizing, and at
  least one non-default billboard mode with Playwright pixel assertions.

Reference anchor: `packages/webgpu/src/render/sprites/sprite-pipeline.ts`.

### M6-T2: MSDF Font Atlas Asset and Glyph Layout Core

Done when:

- A renderer-independent `MsdfFontAtlasAsset` accepts explicit BMFont/MSDF JSON
  plus atlas image handles; default font bundling remains a separate decision.
- Basic LTR text supports glyph metrics, kerning, line breaks, wrapping,
  alignment, color, and stable glyph run packing.
- Missing glyph, unsupported shaping, and atlas mismatch errors are actionable.
- Headless tests cover metrics, kerning, wrapping, alignment, and snapshot glyph
  ranges.

Reference anchor: `references/uikit/packages/uikit/src/text/font.ts`.

### M6-T3: Native MSDF Text WebGPU Pipeline

Done when:

- WebGPU loads MSDF atlas resources and renders glyph runs through native WGSL.
- The shader handles screen-pixel range, DPI scale, alpha smoothing, tint, and
  color-space expectations explicitly.
- A route proves sharp text at two scales and different background colors with
  Playwright pixel checks.

Reference anchor: `references/uikit/packages/uikit/src/text/render/`.

### M6-T4: Retained ECS UI Tree and Layout Extraction

Done when:

- UI authoring includes `UiScreen`, `UiNode`, `UiPanel`, `UiImage`, `UiText`,
  `UiHitTarget`, and `UiScroll` or clearly staged equivalents.
- The retained tree either reuses the existing ECS hierarchy relation or defines
  one renderer-independent relation with explicit serialization/extraction
  rules.
- Layout uses an adapter-isolated Taffy-compatible solver or a documented
  minimal fallback; dependency choice is justified before adding a runtime dep.
- Derived computed nodes, clips, stack indices, and hit regions are produced in
  worker-side systems.
- Snapshot data mirrors layout/render data but is not the authority for
  interaction.

Reference anchor: `references/bevy/crates/bevy_ui/src/layout/` and
`references/bevy/crates/bevy_ui/src/stack.rs`.

### M6-T5: Native UI Panel/Image/Text Render Passes

Done when:

- Screen-space UI renders after scene/post processing and before present, with
  explicit color/MSAA/target rules.
- Panels, images, and text share the quad foundation but use appropriate pipeline
  variants.
- Clipping, stack order, batching, atlas sampling, and UI opacity are covered.
- A HUD route proves nonblank panel/image/text pixels and stable order with
  Playwright.

Reference anchor: `references/bevy/crates/bevy_ui_render/src/`.

### M6-T6: UI Hit-Test and M7 Interaction Bridge

Done when:

- Worker-side UI hit regions use the same computed stack and clipping data as
  rendering.
- UI hit testing resolves topmost target before or alongside 3D spatial picking
  without making main-thread render state authoritative.
- `InteractionAccess` can report hover/down/up/click/drag for UI entities and
  block 3D hits when configured.
- Scroll/focus are scoped explicitly: either minimal pointer-wheel/focus support
  lands here or the public API marks them deferred.
- A route proves a UI button click and blocked 3D pick behind the UI.

Reference anchor: `references/bevy/crates/bevy_ui/src/picking_backend.rs` and
`packages/app/src/interaction/system.ts`.

### M6-T7: Particle Authoring Assets and Emitter Extraction

Done when:

- ECS authoring covers emitter playback, seed, reset epoch, simulation space,
  bounds, visibility/layer/order, capacity, emission rate, bursts, start ranges,
  curves/gradients, sprite atlas frame animation, and blend mode.
- Live particles do not appear in ECS or snapshots.
- Curve/gradient tables are GPU-packable and validated with clear errors.
- Extraction emits stable `ParticleEmitterPacket` records keyed by render id,
  effect handle/version, capacity, reset epoch, transform, bounds, atlas, and
  curve table handles.
- Tests cover effect validation, curve packing, seeded emission inputs, snapshot
  packets, and stale/changed effect metadata.

Reference anchor: `references/three.quarks/packages/quarks.core/src/ParticleSystem.ts`.

### M6-T8: Persistent GPU Particle Buffers

Done when:

- WebGPU has a first-class `ParticleEmitterGpuState` lifecycle keyed by stable
  render id plus effect/version/capacity/reset epoch.
- State handles stale emitter cleanup, capacity resize, effect invalidation,
  reset/prewarm, bounds/culling metadata, and resource eviction.
- Graph persistent/history buffers can be compute-written and render-read in the
  same frame with explicit usage and ordering.
- A tiny compute proof writes deterministic test data into a quad-readable buffer
  and exposes status JSON.

Reference anchor: `packages/webgpu/src/render/graph/frame-graph-history.ts`.

### M6-T9: GPU Particle Compute and Quad Rendering

Done when:

- Compute passes implement reset/prewarm, simulate/emit, alive/dead accounting,
  optional compaction, and indirect draw argument generation where supported.
- RNG uses deterministic integer hashing by emitter seed, particle id, spawn
  index, and frame step; exact cross-adapter floating-point equality is not an
  acceptance criterion.
- M6 defaults to additive or otherwise unsorted particles with per-emitter order.
  Per-particle alpha sort is deferred.
- Particle rendering consumes the shared quad pipeline, atlas frames, color/size
  curves, and blend metadata.
- A route renders a high-count GPU particle effect with status counts and
  Playwright non-clear pixel assertions.

Reference anchor: `references/engine/src/scene/shader-lib/wgsl/chunks/particle/`.

### M6-T10: Cross-Feature Showcase

Done when:

- One app route combines a sprite atlas, MSDF text, UI panels/images/text,
  simulated pointer interaction, and GPU particles.
- Worker/main snapshot mode remains compatible with the route.
- Status JSON reports UI node/glyph/quad counts, particle emitter count, live
  particle count, and interaction target.
- Playwright proves UI/text/particles are visible and UI interaction blocks a 3D
  pick behind the overlay.
- Boundary, build, targeted tests, and route tests pass.

Reference anchor: `docs/NORTH_STAR.md` and `docs/MEDIUM_LONG_TERM_GOALS.md`.

## 6. UI Architecture Details

- Public authoring should be component-first and helper-friendly, matching
  existing `withCamera`, `withLight`, and `withSprite` patterns.
- `UiClassList` and richer style inheritance can be staged, but M6 should avoid
  building a full CSS engine unless the vertical slice needs it.
- Layout dependency choice is a decision point. Taffy is the preferred conceptual
  model because Bevy validates it in ECS, but any runtime dependency must be
  worker-safe, synchronous enough for frame layout, deterministic, and justified
  under the repo's minimal-dependency rule.
- Computed UI data should be derived and non-authoritative like world transforms:
  useful for extraction and hit testing, not a persisted gameplay source.
- Per-camera UI targets, screen scale modes, anchors, pivots, z-index, clipping
  propagation, and input blocking are M6-relevant. World-space UI can be a staged
  follow-up unless it fits cleanly after screen-space proof.

## 7. Particle Architecture Details

- Particle effect schemas should describe what the GPU will execute. They should
  not mirror three.quarks object graphs one-to-one.
- Use fixed GPU layouts for curves, gradients, emitter parameters, counters, and
  particle state. Keep validation strict so unsupported authoring choices fail
  clearly.
- Playback time ownership belongs to ECS/extraction inputs; live particle
  position, velocity, age, random state, and alive/dead lists belong to WebGPU.
- Default M6 sorting policy is additive/unsorted with per-emitter ordering.
  Per-particle sorting, soft particles, trails, sub-emission, and mesh particles
  should not block the first GPU particle proof.
- Bounds and culling must be represented early, even if M6 starts with conservative
  bounds. Unbounded GPU emitters should be explicit.

## 8. Proof Routes and Validation

- `quad-sprites`: richer sprites through quad buffers, atlas uv rect, pivot,
  rotation, screen-space sizing, and non-default billboard mode.
- `msdf-text`: text atlas loading and glyph rendering at two scales with
  sharpness/pixel checks.
- `ui-hud`: screen-space panel/image/text overlay with clipping and stack order.
- `ui-interaction`: UI button click, hover/down/up/click state, and blocked 3D
  pick behind the overlay.
- `gpu-particles`: high-count GPU particle effect, status JSON, non-clear pixel
  assertions, and stable reset/prewarm behavior.
- `content-showcase`: combined route proving the systems coexist in the
  worker/main snapshot architecture.

Expected validation mix:

- Headless tests for extraction packing, glyph layout, UI layout, hit regions,
  effect validation, curve packing, and packet transport.
- WebGPU tests for persistent buffers, compute-to-render graph ordering, atlas
  binding, MSDF rendering, quad batching, and particle state lifecycle.
- Playwright route tests with canvas readback and JSON status checks.
- `pnpm run check:boundaries`, targeted builds, and relevant package tests for
  each completed slice.

## 9. Explicitly Deferred

UI features deferred from M6 completion:

- DOM input bridge, text editing, IME, selection, caret, textarea behavior.
- Complex text shaping, bidi, fallback fonts, emoji/color fonts.
- Full CSS parity, transitions, advanced conditionals, and arbitrary style
  cascading.
- 9-slice panels, masks beyond the clipping needed for M6, gradients, box
  shadows, rich borders, and SVG/video components.
- Full world-space UI unless a later M6 slice can add it without destabilizing
  the screen-space proof.

Particle features deferred from M6 completion:

- Per-particle GPU alpha sorting.
- Soft particles/depth fade.
- Trails, sub-emission, noise/turbulence/orbit behaviors beyond the first GPU
  proof, mesh particles, mesh-surface emission, lit particles, and normal maps.
- CPU particle render fallback.
- Exact floating-point deterministic equality across browser/adapter backends.

Other deferred work:

- Full decals system.
- Full volumetric fog/clouds system.
- Editor tooling for UI/effect authoring.

## 10. Open Decisions

1. Layout dependency: add a Taffy-compatible package, port a minimal solver, or
   temporarily hand-roll a constrained flex subset.
2. Default font: ship a bundled MSDF atlas, require user-provided atlases, or add
   a build-time generator.
3. Text shaping: keep M6 to BMFont-compatible LTR only or introduce a separate
   shaping pipeline later.
4. UI event depth: whether scroll/focus land in M6-T6 or are exposed as deferred
   states after click/drag blocking works.
5. UI render placement: exact postprocessing, MSAA, render target, multi-camera,
   and color encoding rules for screen-space overlays.
6. Particle curve storage: storage buffers versus sampled 1D textures for curve
   and gradient tables.
7. Particle budget policy: default max particles, resize behavior, unbounded
   emitter errors, and debug readback scope.
8. Particle sorting: additive/unsorted M6 default versus a later GPU sort
   milestone.
9. Decals/volumetrics: whether they remain post-M6 or get only a feasibility
   note after T10.

## 11. Next Implementation Slice

Recommended first slice if M6 work starts:

**M6-T1a: Quad ABI, packets, and transport.**

This is the keystone because every later UI/text/particle render path depends on
the same transferable quad buffers. Keep the slice narrow: introduce typed quad
buffers, compact batch packets, snapshot transfer/shared-buffer support, tests,
and a compatibility route where existing sprites still render. Do not add UI or
particle authoring in this slice.

After T1a, proceed to T1b/T1c so the foundation has a visible sprite proof before
text, UI, and particles build on it.
