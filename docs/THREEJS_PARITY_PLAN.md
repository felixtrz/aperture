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

Status: implemented (2026-07-13). Notes and deviations: the authoring surface
landed as the worker-side context facade `this.renderTargets.register({ id,
width, height, format?, msaa?, depth?, sampleable? })` (mirroring A2's
`this.buffers.register`) rather than an `aperture.config.ts` `asset.*` entry —
targets are runtime-authored assets like buffers, and the mirror carries the
data-only `RenderTargetAsset` to the renderer, which realizes and owns the
GPU texture keyed by handle + version. `mips` was NOT included (mip
generation is not exposed for user targets; audit §3.1 row unchanged);
`depth: false` validates as unsupported (the app frame path always attaches
its renderer-owned per-target depth buffer); `msaa: 4` is honored through
the app-level MSAA machinery (per-target MSAA color + resolve into the
sampleable color texture) and diagnoses
`webGpuApp.renderTargetMsaaUnavailable` when the app was not created with
`{ msaa: 4 }` — pipelines are compiled once per app sample count, so
per-target sample counts that differ from the app's are out of scope. AC2:
camera pairing works through the existing `Camera.renderTargetId` plus a new
`spawn.camera({ renderTarget })` convenience; `material.texture` (and sprite
`textureId`) bindings resolve texture handles to the facade target's
realized color texture under the same id (texture source assets keep
precedence); `renderTargets.resize` republishes the same handle (version
bump → renderer destroys and recreates; fake-device tests assert the
destroy/create counters). The low-level `render-target-*` e2e matrix is
unchanged and green; app-facade lifecycle coverage lives in
`test/webgpu/app-render-target-realization.test.ts` (initial/reuse/resize/
MSAA-resolve wiring) rather than duplicated e2e twins. AC3:
`examples/minimap` (overhead ortho camera → facade target → screen-space
custom-WGSL HUD quad via textureLoad) with pixel assertions
(landmark-vs-adjacent distinctness + motion between captures) instead of a
golden baseline, consistent with A1/A2/A4. AC4: diagnostics shipped as
`renderTargetAsset.*` (validation) plus `webGpuApp.renderTargetNotSampleable`
(sampling without TEXTURE_BINDING), `webGpuApp.renderTargetMsaaUnavailable`,
and `webGpuApp.renderTargetCreationFailed`; "MSAA target sampled without
resolve" cannot occur by construction — sampling always sees the resolved
single-sample color texture. Ordering: views render in ascending camera
priority, so the offscreen camera must have a lower priority than its
consumers for same-frame sampling (documented in AUTHORING.md; the forward
frame graph preserves this order via its insertion-index tiebreak).

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

Status: implemented (2026-07-13). AC1: `renderTargets.register({ id, size,
dimension: "cube" })` extends the B1 facade asset (square-only validation;
`msaa: 4` rejected on cubes); a camera paired with a cube target becomes a
capture camera — extraction emits six 90° square face views per scheduled
capture (`ViewPacket.renderTargetFace`, packed-encoding version 15→16), the
realizer creates one 6-layer cube texture with per-face attachment views plus
a cube sampling view, and each face renders as its own frame-boundary pass
(face-aware submission keys keep per-face clear/load semantics). Face view
ids fold the face into the stable render id's generation byte, so ids can
never collide across live cameras. Faces are world-axis aligned at the
camera position (rotation ignored, like three.js CubeCamera) and use proper
(winding-preserving) rotations, so the captured cube stores the X-mirrored
environment; the PMREM/irradiance kernels compensate with a `sourceFlipX`
shader variant — the three.js `flipEnvMap` convention. IBL consumption goes
through `prepareWebGpuAppEnvironmentAssets` `renderTargetSource` (the repo's
existing IBL tier): the realized cube feeds the prefilter directly, each
completed capture bumps a persistent capture generation that re-versions the
derived resource keys (re-prefilter + eviction of superseded textures), and
the environment asset stays not-ready until the first capture. AC2:
`examples/reflective-probe` (mirror sphere + orbiting unlit boxes captured
every 4 frames; ibl-equirect example structure) with
`test/e2e/reflective-probe.spec.ts` asserting exact capture cadence from the
frame report, per-capture generation increments, reflection motion across
captures, first-capture red-dominance, and background stability — readback
pixel assertions instead of a golden baseline, consistent with A1/A2/B1.
AC3: `Camera.captureEvery` (0 = on-demand; first sight always primes) +
one-shot `Camera.captureRequestFrame` stamps honored exactly once via the
persistent extraction cache; `this.renderTargets.capture(id)` arms every
paired camera; frame report gains per-face `renderTargets[].face` entries
and `renderTargetCaptures` (faces + cumulative generation). Deviations:
(1) "usable as a cube texture binding" is IBL-only — custom-material texture
bindings are hard-coded 2d (`webGpuApp.renderTargetCubeBindingUnsupported`
diagnoses direct sampling), as the plan's B2 context sanctioned; (2)
"usable as environmentMapId" is at the renderer tier
(`prepareWebGpuAppEnvironmentAssets`), matching where ALL environment-map
consumption lives today — the app facade has no environment-map surface;
(3) golden baseline replaced by readback pixel assertions (repo pattern);
(4) capture frames render through the legacy multi-submit route (not the
single-encoder graph) because per-target view uniforms are selected by
rewriting the shared view-uniform buffer between submissions — a pre-existing
app-route limitation (every pass reads packed record 0) that B2 fixes ONLY on
frames containing cube-capture faces to keep all other frames byte-identical;
built-in material routes are wired, custom-WGSL draws inside captured layers
keep the first view record (documented in AUTHORING.md); (5) cube targets
reject `msaa: 4` rather than resolving per face.

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

Status: implemented (2026-07-13). AC1: `material.customWgsl({ colorTargets })`
declares N targets — index = fragment `@location`, target 0 is the pass color
(`"swapchain"` sentinel), extras pair facade render targets (B1 assets) with
per-target `format` and `writeMask` (`all|rgb|alpha|none`). Fragment outputs
are validated against the declaration at preparation
(`customMaterialSource.colorTargetMismatch`), never as a device error; the
`color-targets:` pipeline-key segment participates only when declared, so
undeclared materials keep byte-identical keys (locked by a hardcoded
pre-change key literal in tests). Realization checks (registered/2d/
single-sample/format- and size-matched extras, no `{ msaa: 4 }` app) surface
as `webGpuApp.customWgslColorTarget*` diagnostics; extra targets clear to
transparent black at pass start and always store. AC2: user render passes
write facade render targets — `writes` attach the realized textures in
declaration order with per-write clear/load intent (always stored, no depth
attachment); reads resolve to realized sampleable views with frame-graph
ordering edges; ping-pong between two persistent user targets works across
frames (unit-tested on the forward graph). Mixing scene-color with target
writes, size mismatches, and unavailable targets skip the pass loudly
(`webgpu.userPass.renderWrite*`). AC3: `examples/gbuffer` — one MRT material
writes albedo/world-normal/object-ID to three facade targets, a user pass
resolves them into three scene-color bands; `test/e2e/gbuffer.spec.ts`
asserts graph pass order (G-buffer camera node before resolve), user-pass
execution counts, per-target draw calls, and five screenshot pixel samples
(albedo, encoded +Z normal, and three ID bands). AC4: write cycles among
user passes are rejected at frame-graph compile with the cycle diagnostic
surfaced into the render report; the legacy route reports user passes as
skipped exactly as before (covered by unit tests). Deviations: (1) "golden
baseline" replaced by screenshot pixel-sample assertions (repo pattern,
matching A1/B1/B2); (2) MRT draw targets are facade render targets rather
than anonymous transient textures — persistent, resizable, and samplable
assets are the repo's render-target model (transient textures remain
internal to the frame graph); (3) MRT materials require the
single-custom-material route — frames mixing MRT materials with built-in
families are rejected with `webGpuApp.customWgslColorTargetsRouteUnsupported`
(the mixed route's shared pass model can't host per-material attachment
sets); (4) scene-color user passes keep their previous LOAD-over-scene
semantics unchanged.

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

Status: implemented (2026-07-13). AC1: a custom-WGSL texture binding gains a
renderer-owned `source: "scene-depth"` (data-only, DECISIONS 0016) that binds
the frame's stored scene depth read-only, plus the binding-layout variants that
close the pre-B4 float/2d/filtering hard-coding: texture `sampleType`
(`float | unfilterable-float | depth | sint | uint`), `viewDimension`
(`2d | cube`), `multisampled`, and sampler `samplerType`
(`filtering | non-filtering | comparison`, backed by a new `SamplerAsset.compare`).
Each variant enters the bind-group layout AND the pipeline key ONLY when set to
a non-default value, so pre-B4 materials keep byte-identical keys (locked by a
hardcoded pre-change key literal in tests, mirroring
`custom-wgsl-color-targets.test.ts`). "Post-opaque phase enforced by queue
validation" is realized as material-source validation
(`customMaterialSource.sceneDepthRequiresTransparent`): a scene-depth binding
requires `alphaMode: "blend"` — the render queue derives the transparent phase
from `alphaMode`, so a blend material always runs after the opaque pass wrote +
stored depth. The `:scene-depth` render-pipeline-cache-key marker (mirroring
`:soft-particles`) lets frame-boundary assembly detect a scene-depth submission
and attach the depth READ-ONLY (a texture cannot be a writable attachment and a
sampled binding in one pass). AC2: `examples/forcefield` — an opaque wall +
a transparent slab whose custom material samples scene depth to glow at the
intersection; `test/e2e/forcefield.spec.ts` asserts (readback-free screenshot
sampling, repo pattern) that the RED glow appears only where the wall sits just
behind the slab (near) and not over the far background, isolating the
depth-driven fade; a second `test(...)` drives `forcefield-msaa.html` (msaa 8,
`multisampled: true`, `texture_depth_multisampled_2d`) through the MSAA-aware
read-only-depth submission, matching how `render-to-texture.spec.ts` splits MSAA
variants into their own `test(...)` blocks. AC3: advanced-audit scenario #19
flipped 🟡→✅, the §2.2 textures/samplers + depth-attach-sample rows updated, the
§9 tally, §1 executive summary, and the §10 ranked list adjusted. Deviations:
(1) rather than PEEL the scene-depth draw out of a shared pass (fragile with an
elided command stream), the example + mechanism render the depth-sampling
material through its OWN swapchain camera (a later submission of the same
target) — this reuses the multi-submission machinery that composites + resolves
(incl. MSAA store-for-later-load) correctly and is the repo-shaped "one draw per
pass" model; the frame-boundary code detects a scene-depth submission and forces
a read-only depth LOAD of the earlier submission's depth (deliberately crossing
layer masks — the whole point is to read another layer's depth). (2) A latent
pre-existing bug was fixed as part of this: the depth-attachment planner emitted
`depthLoadOp`/`depthStoreOp` alongside `depthReadOnly: true`, which WebGPU
forbids and silently failed every read-only-depth pass (soft particles hit it
too but had no e2e); a read-only attachment now carries only the view +
`depthReadOnly`. (3) "golden baseline" replaced by screenshot pixel-sample
assertions (repo pattern, matching A1/B1/B2/B3). (4) The user-pass half of B4
was already done (user passes read the built-in `"depth"` resource — verified by
the existing `custom-graph-pass` e2e), so B4 adds only the custom-material half.
(5) The comparison-sampler option is genuinely usable end-to-end
(`SamplerAsset.compare` → GPU descriptor) but the forcefield uses `textureLoad`
(no sampler), so the comparison layout variant is exercised by unit tests.

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

Status: implemented (2026-07-13). AC1: `BufferAsset` gains a writable
`usage: "storage"` (the A2 `"read-only-storage"` stays the default,
byte-identical). The WebGPU backend realizes ONE GPU buffer per handle@version
(`STORAGE | VERTEX | COPY_DST | COPY_SRC`) and shares that identical buffer,
zero-copy, across every consumer via the existing `customWgslStorageBuffers`
cache (`resolveAppBufferAssetResource`): (a) a `material.storage(...)` binding
reads it, (b) a NEW `material.customWgsl({ instanceBuffer: { buffer,
attributes } })` sources the slot-1 `stepMode: "instance"` vertex stream
(`@location(6+)`) directly from it (no per-entity `InstanceData` packet, no CPU
pack — the draw builder's slot-1 append now keys off the RESOLVED pipeline key
and a `bufferBacked` marker so it needs no packet), and the main-thread
`app.addComputePass(...)` WRITES it — `ctx.buffer(id)` now resolves the realized
GPUBuffer (previously a `() => undefined` stub on both graph routes).
Compute-before-draw ordering: the forward scene node declares a READ on every
writable-buffer id the frame's draws consume, so a compute pass writing the same
id gets the frame graph's writer-before-reader edge (a mutual read/write is
rejected as `frameGraph.cyclicDependency`, surfaced on the frame — no new edge
machinery, the B3 pattern). AC2: `examples/boids` (worker registers the seeded
writable buffer + spawns 160 instanced boids; main thread owns the flocking
compute pipeline) with `test/e2e/boids.spec.ts` asserting 160 mesh draws
collapsing into one instanced draw, a motion readback proving the positions
change on the GPU between two frames, and compute-before-draw from the graph
report. AC3: advanced-audit scenarios #13 and #14 → ✅. Deviations: (1) the
buffer-backed instance source landed as a material-source `instanceBuffer`
declaration (one shared buffer for the whole instanced draw) rather than on the
per-entity `InstanceData` component — a GPU instance stream is inherently one
shared buffer indexed by `firstInstance + instanceIndex`, not per-entity CPU
values; a material sources its instance stream from EITHER `instanceAttributes`
(CPU) OR `instanceBuffer` (GPU), never both (`customMaterialSource.invalidInstanceBuffer`).
(2) Determinism is resolved as CPU/ECS-authoritative: the boids SIM is GPU-side
(float positions differ per adapter and are NEVER hashed); the "60-frame
determinism with a fixed seed" is proven by `test/determinism/boids-authoring.test.ts`
(two fresh headless runs produce identical seed bytes + instanced authoring over
60 frames) and the e2e's stable compute-before-draw schedule. No new snapshot
packet family was needed (the writable buffer flows through the existing
data-only asset mirror), so the committed determinism fixtures are unchanged.
(3) Material storage bindings stay read-only (`access: "read"`); "writable" is
the buffer's realization usage, written by the compute pass, not a read-write
material binding. (4) The buffer-backed instance stream is one instance buffer
per frame (the pre-existing single-shared-instance-buffer draw limitation).
Pipeline-key stability: the buffer-backed stream participates only via the
existing `instance-attributes:<layoutKey>` segment (absent → `:none`) and the
buffer SOURCE never enters the key, so every pre-C1 material keeps a
byte-identical pipeline key (`test/materials/custom-wgsl-instance-buffer.test.ts`
pins the literal).

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

Status: implemented (2026-07-13). AC1: the user-pass render sink gains
`ctx.drawIndirect(indirectBuffer, indirectOffset)` and
`ctx.drawIndexedIndirect(...)` (render-only, like `ctx.draw`), recording the
existing `drawIndirect` / `drawIndexedIndirect` `RenderPassCommand` kinds fed to
the single-encoder executor. `indirectBuffer` is a realized GPU buffer — a
compute-written writable `BufferAsset` region resolved via `ctx.buffer(id)`
(C1's resolver) — and writable buffers now realize with `INDIRECT` added
(`STORAGE | VERTEX | COPY_DST | COPY_SRC | INDIRECT`; read-only buffers stay
`STORAGE | COPY_DST` byte-identical, pinned by the usage-flags test). A headless
core (`render/draw/user-indirect-draw-commands.ts`) validates each recorded
indirect draw and DROPS a degraded one with a structured
`IndirectDrawFallbackReason` (extending the internal `indirect-draw-commands`
reason/diagnostic families with `indirect-buffer-unresolved` /
`indirect-offset-misaligned` / `indirect-readback-unavailable` /
`indirect-readback-failed`) instead of encoding a device error — surfaced both in
a new per-pass report (`renderTargets[*].graph.userPasses[i].indirectDraws`) and
a frame-wide aggregate `report.userIndirectDraws`, plus a frame warning.
AC2: `examples/gpu-culling` — a compute pass culls a small instance row against a
CPU-driven threshold, compacts survivors, and writes the survivor count into the
indirect-argument buffer's `instanceCount` field; a single `ctx.drawIndirect(...)`
consumes it. The drawn count is GPU-authoritative, so the forward-graph route
reads it back off the argument buffer after the frame submit and reports it as
`report.userIndirectDraws.drawnInstanceCount`; `test/e2e/gpu-culling.spec.ts`
asserts that lowering the cull threshold reduces that reported count.
AC3: advanced-audit scenario #15 → ✅. Deviations: (1) the drawn-count READBACK
runs on the forward-graph route only (its assembler is async); the post route
validates + drops degraded indirect draws and reports fallback reasons but leaves
`drawnInstanceCount` null (its assembler is synchronous). (2) A user pass's
`encode(ctx)` runs when the frame graph is (re)built and its recorded commands are
REPLAYED on later frames, so a per-frame CPU input (the cull threshold) is
uploaded to a params uniform from an animation-frame loop in the example, not from
inside `encode`. (3) A hand-built indirect-draw pipeline must match the route's
attachment sample count; the example opts out of MSAA (`render.sampleCount: 1`) so
its single-sampled pipeline matches the forward route (a mismatch invalidates the
whole command submit).

- AC1: The user-pass render sink gains `drawIndirect`/`drawIndexedIndirect`
  taking a `BufferAsset` region; the internal `indirect-draw-commands`
  fallback reasons surface in the frame report when the path degrades.
- AC2: Example: compute-driven culling writing indirect args (visible
  instance count) consumed by an indirect draw; e2e asserts that occluded
  instances reduce the drawn count via the frame report.
- AC3: Advanced-audit scenario #15 → ✅.

### C3. Compute ergonomics: data-described kernels — **M** (optional polish)

Status: implemented (2026-07-13). Architectural choice: the **app-facade
command** route (the plan explicitly blesses it over worker-authored dispatch as
also satisfying AC1). `app.addComputeKernelPass({ name, kernel, workgroups })`
internally wraps the EXISTING `addComputePass` user-pass machinery but builds the
pipeline + bind group from the data description, so the user writes zero
`GPUDevice` code. Rationale: `addComputePass` is already a main-thread app-facade
call whose `encode(ctx)` runs on the FrameGraph routes with device access
(exactly like boids/gpu-culling); mirroring the worker→snapshot→realize material
pipeline would have required a new snapshot packet family + a determinism-fixture
refresh for zero behavioural gain on an "optional polish" item. The app-facade
route is strictly less invasive: no snapshot field, no determinism change, and it
reuses C1's shared buffer cache + the material texture/sampler/uniform wiring
verbatim. AC1: a `ComputeKernelAsset` (render pkg, data-only DECISIONS 0016) is
the compute sibling of `CustomWgslMaterialAsset` — a `CustomWgslShaderRef` + a
compute `entryPoint` + a typed `bindings` array reusing the SAME
`CustomWgslBindingDeclaration` union. `validateComputeKernelAsset` mirrors the
material validator (structured `computeKernel.*` codes); `CustomWgslShaderStage`
gains `"compute"` (material binding validation still restricts visibility to
vertex/fragment, so material pipeline keys stay byte-identical — a type widening
with no runtime effect on existing materials). The WebGPU realizer
(`realizeComputeKernelDispatch`) builds the `layout: "auto"` compute pipeline
(cached per resolved-source + entry point) and resolves each binding through the
EXISTING wiring — storage via C1's `resolveAppBufferAssetResource` (shared GPU
buffer, zero-copy), uniform via a std140 packer, texture/sampler via the app
caches — then `createBindGroup` from `getBindGroupLayout(0)`. Wired into BOTH the
forward-graph and post-effect-graph user-pass resolvers. A kernel's writable
storage outputs are auto-declared as pass writes (writer-before-reader ordering).
AC2: `examples/luminance-histogram` computes a single-threaded luminance histogram
TWO ways from one input pixel buffer — a RAW `addComputePass` dispatch (hand-built
pipeline + bind group) and a DATA-DESCRIBED `addComputeKernelPass` dispatch — into
two storage buffers; `test/e2e/luminance-histogram.spec.ts` reads both back and
asserts they are byte-identical (each histogram also sums to the pixel count, so
it is a real, non-degenerate result). Deviations: (1) app-facade command instead
of worker-authored dispatch (recorded above). (2) No audit-scenario flip — this is
optional polish; no scenario newly qualifies (the compute-ergonomics surface is a
DX improvement over C1/C2, not a new rendering capability). (3) Kernel bindings
are bound to `@group(0)` (compute has no view/transform groups); the realizer uses
`layout: "auto"`, so binding `visibility` is accepted (must be `["compute"]`) but
not consumed. (4) The example uses a single-threaded dispatch (no atomics) so the
result is deterministic under SwiftShader; the raw and kernel shaders are the same
source, so the equality assertion isolates the dispatch PLUMBING (data-described
pipeline/bind-group construction binds the right buffers in the right order).

- AC1: A `computeKernel` asset (WGSL source + typed bindings, same shape as
  custom materials) can be dispatched from a system command without touching
  `GPUDevice`; the raw `encode(ctx)` path remains for full control.
- AC2: The luminance-histogram example gains a data-described twin with
  identical output (readback equality assertion).

---

## Phase 4 — Scene & content dynamics

### D1. Stencil support — **M**

Status: implemented (2026-07-13). AC1: `renderState.stencil`
(readMask/writeMask/reference + per-face compare + fail/depthFail/pass ops) is a
new optional sub-state on ALL material kinds (built-in standard/unlit/matcap/
debug-normal AND custom WGSL), built ergonomically with `createStencilState`
(three.js-shaped input). PRESENCE is the enable gate: it appends a single sorted
`stencil:<readMask>:<writeMask>:<reference>:<front…>:<back…>` FEATURE token to
the material pipeline key (the trailing `alphaMode|cullMode|depthCompare|blend`
segment is untouched), so the backend reconstructs the full stencil state from
the key exactly as it does `depth-bias`/`front-face`. `unsupportedFeatures`
drops `"stencil"` (now `"custom-shader"` only). AC2: `examples/stencil-portal`
(a mask stamps a portal region, content is revealed where stencil == ref) and
`examples/stencil-outline` (a base writes stencil, a scaled copy draws where
stencil != ref); `test/e2e/stencil-portal.spec.ts` +
`test/e2e/stencil-outline.spec.ts` assert the masked/outlined result by pixel
samples (green-center/dark-corner, blue-center/orange-halo). Advanced-audit #8 →
✅ and #7 → 🟡. AC3: the stencil state rides the pipeline-key string (which the
snapshot already transports, so no packed-encoding change and no SAB fallback is
triggered — material assets are not part of the SAB packed transport per 0022);
`material.stencilRequiresStencilFormat` (WebGPU) and `material.invalidStencilState`
(render validation) diagnose stencil-on-a-format-without-stencil and out-of-range
masks/reference.

**Depth-stencil-format decision (the hard one): approach B at FRAME granularity.**
WebGPU requires a pipeline's `depthStencil.format` to match the pass's depth
attachment. Rather than always using `depth24plus-stencil8` (approach A — changes
every existing pipeline/test/golden and must prove inertness), the frame's scene
depth attachment is selected as `depth24plus-stencil8` ONLY when a material in
the frame enables stencil, and `depth24plus` otherwise. The format is computed
once per frame from the snapshot's mesh-draw pipeline keys
(`webGpuAppSceneDepthFormat`) and threaded via `resourceCache.sceneDepthFormat`
to the depth attachment, the mesh/background/overlay pipelines, and the
render-bundle descriptor — so every pipeline in every pass of the frame agrees,
frame granularity (not per-view) removing any intra-frame mismatch risk (C2's
lesson). Non-stencil frames keep `depth24plus`, so pipeline keys, golden pixels,
and determinism fixtures are byte-identical (proven: the full vitest suite incl.
`test/determinism` passes unchanged, and a hardcoded pre-change key literal is
pinned in `test/materials/stencil-state.test.ts`). The stencil `reference` is
dynamic (`setStencilReference` on pipeline bind, derived from the key); because a
render-bundle encoder cannot set it, stencil frames take the direct-encoder path
(bundles skipped). Deviations: (1) `colorWriteMask` is still not plumbed to
built-in materials, so the portal mask uses the "content overwrites the mask's
color in the stencil region" technique rather than disabled color writes.
(2) The diagnostic-refuse-to-build safety net (`material.stencilRequiresStencilFormat`)
is unreachable in normal operation because the per-frame format selection
guarantees a stencil material always lands on a stencil-capable attachment; it is
wired into the standard descriptor + unit-tested as a defensive contract.

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

Status: implemented (2026-07-13). AC1: per-camera clip planes via a camera
`clipPlanes` authoring surface (`spawn.camera({ camera: { clipPlanes } })` /
`withCamera({ clipPlanes })`, which attaches a `CameraClipPlanes` companion
component) AND optional per-material planes via `renderState.clipPlanes`; the two
UNION (camera first) and are capped at `MAX_CLIP_PLANES = 8` (`resolveClipPlanes`
in `packages/render/src/rendering/clip-planes.ts`). Planes are world-space
`(nx, ny, nz, d)` with three.js `THREE.Plane` semantics — a fragment is KEPT
where `dot(worldPos, (nx,ny,nz)) + d >= 0` and discarded otherwise. **Discard,
not `clip_distances`:** WebGPU core WGSL has no `clip_distances` builtin (it is an
optional feature absent on SwiftShader), so the universal implementation is a
per-fragment `discard` loop injected into the built-in mesh shaders
(`injectCameraClipPlanesWgsl`), not the "clip distances where available" split the
original AC sketched — the discard path is the ONLY path. Overflow is diagnosed
loud-over-silent: `camera.clipPlanesExceedLimit` (extraction) and
`material.clipPlanesExceedLimit` (material validation), both cataloged. AC2:
`examples/clipping-cutaway` — an orthographic camera carries a `(1,0,0,0)` plane
that cuts a SYMMETRIC box in half; the kept half stays opaque while the clipped
half discards to the background. `test/e2e/clipping-cutaway.spec.ts` asserts the
cut by pixel samples (bright box on the kept side, dark background on the clipped
side of the symmetric box, proving the asymmetry is the plane's doing) plus that
the frame compiled the `clip` pipeline token and the view carries one plane.

**group(0) / view-uniform contract decision.** The clip block lives in the
per-view uniform at `@group(0) @binding(0)`, APPENDED after the fog block:
`clipPlaneCount: vec4f` at float offset 44 (x = active count as f32, matching the
fog-`mode` convention; yzw pad for std140), then `clipPlanes: array<vec4f, 8>` at
offset 48, growing the packed view-uniform stride from 44 to 80 floats. Every
pre-existing offset (viewProjection 0–15, cameraPosition 16–19,
previousViewProjection 20–35, fogColor 36–39, fogParams 40–43) is UNCHANGED.
Consequences: (1) clipping is applied ONLY to the four built-in material families
(unlit/matcap/standard/debug-normal) via automatic shader rewrite — the rewrite
extends the shader's `ViewProjectionUniform` struct and injects the discard loop
in `fs_main`, gated frame-wide by a `clip` pipeline-key feature token appended by
`withClipPlanePipelineKeys` when ANY view in the frame clips. (2) Custom-WGSL
materials are NOT auto-clipped: they keep declaring the smaller view struct and
read valid data because the grown buffer is a strict superset (WGSL permits the
bound uniform buffer to exceed the declared struct); to opt in, a custom material
must declare the extended view struct (reaching the clip block at offset 44/48)
and implement the discard loop in its own fragment entry. (3) Per-camera semantics
hold even though the token is frame-wide because the plane DATA is per-view: a
draw rendered into a non-clipping view reads `clipPlaneCount == 0` and discards
nothing.

**Byte-identity / no-clip inertness.** Zero planes in ⇒ zero planes out: a
camera/material with no clip planes produces the same pipeline keys, shader
source, and pipelines as before D2. `withClipPlanePipelineKeys` returns the
snapshot untouched when no view clips; `withInjectedClipPlanes(shader, false)`
returns the exact same module; the packed view codec omits the `clipPlanes` field
entirely for a non-clip view so it decodes deep-equal to its pre-D2 shape (mirrors
the `renderTargetFace` sentinel). Pinned pre-change literals guard the no-clip
paths in `test/webgpu/clip-plane-shader.test.ts` and `test/rendering/clip-planes.test.ts`.

**Determinism fixtures did NOT shift.** The packed SAB encoding version bumped to
17 and `VIEW_PACKET_WORDS` grew 37 → 70 (words 37 = count, 38–69 = 8 vec4 planes),
but the determinism fixtures hash the EXTRACTED `RenderSnapshot` projection (frame,
report counts, draws, transforms, viewMatrices, bounds, light/view counts), not
the packed SAB bytes or the encoding version — and neither the replay nor boids
scene uses clip planes, so no view carries a `clipPlanes` field. `test/determinism`
passes with NO fixture refresh (confirmed by running it green before any refresh).

AC3 (transport): the clip planes ride the SAB packed view record (codec version
17); a view with no planes round-trips byte-identically (the field is absent).

Deviations from the original AC sketch: (1) discard-only, no `clip_distances`
branch (justified above). (2) The AC2 example is a primitive box cutaway, not a
glTF building interior — a closed primitive cutaway is the intended lighter-weight
proof and keeps the SwiftShader e2e tiny. (3) Scenario #7 (planar mirror) stays
🟡: the oblique-clip mirror example was not shipped; clipping now EXISTS (the last
missing ingredient), so #7 is unblocked but not yet demonstrated end-to-end.

- AC1: Per-camera (and optional per-material) clip planes, implemented via
  WGSL clip distances where available with a discard fallback; count limit
  documented and diagnosed.
- AC2: Example: cutaway view of a glTF building interior; golden baseline.
  Feature-audit §4 clipping row → ✅; combined with B1/B2 + D1, planar
  mirror (scenario #7) → ✅ via an oblique-clip mirror example.

### D3. Runtime texture updates (dynamic + video) — **M**

Status: implemented (2026-07-13). AC1 (CPU bytes): `app.updateDynamicTexture(id,
{ data, bytesPerRow?, rowsPerImage?, dataOffset?, region? })` applies a full-image
OR sub-rect CPU update via `queue.writeTexture`; the origin/extent, `bytesPerRow`
(>= row minimum), and byte length are validated up front so a bad update returns a
structured diagnostic instead of a raw WebGPU error. AC2 (video/canvas):
`app.updateDynamicTextureFromExternalImage(id, { source, flipY?, sourceOrigin?,
region? })` imports an `HTMLVideoElement` / `VideoFrame` / canvas / `ImageBitmap`
via `queue.copyExternalImageToTexture`. Update rate (count) + bytes uploaded appear
in the frame report's new `dynamicTextures` section (per-frame + cumulative +
per-texture; present only when a dynamic texture exists, so unrelated reports stay
byte-identical). AC3: `examples/runtime-texture` — an in-scene video wall: ONE
dynamic texture atlas (three stacked 64×64 regions) sampled by one screen-space
custom-WGSL quad, whose scoreboard + TV regions are canvas-uploaded via
`copyExternalImageToTexture` (sub-rect destination origins) and whose ticker
region is CPU-bytes-uploaded via `writeTexture` (full-region + a smaller sub-rect
band). `test/e2e/runtime-texture.spec.ts` asserts wall pixels CHANGE between two
captures and that the report counters (external-image + CPU-bytes updates) are
non-zero with zero failures. Advanced-audit scenario #18 → ✅.

**Registration site (extraction constraint).** A material's texture handle is
validated at EXTRACTION (in the worker) against the worker asset registry, so a
sampled dynamic texture must be registered there: `this.textures.register(...)`
(new `@aperture-engine/app` facade mirroring `this.buffers.register`) declares it
as DOM-free metadata and mirrors it to the renderer. `app.registerDynamicTexture(...)`
(main-thread) remains for textures sampled outside the extracted-material path.
The example consolidates to ONE atlas texture + ONE custom material because the
multi-distinct-custom-material frame route is a separate, out-of-scope concern —
one material keeps the frame on the proven single/mixed custom-WGSL draw path, and
a texture atlas with sub-rect destination origins is the natural shape anyway.

**Worker/DOM architecture decision + rationale.** The ECS simulation runs in a
worker; the DOM (video, canvas, ImageBitmap) is main-thread only. So D3 is an
**app-facade feature on the main thread**, mirroring C3's `addComputeKernelPass`
and B1's render-target facade — NOT a worker-authored snapshot packet. A dynamic
texture is a real `TextureAsset` that `app.registerDynamicTexture(...)` registers
on the renderer's source-asset registry with `copy-dst` (and, for `externalImage`,
`render-attachment`) usage; a worker-authored material samples it by
`createTextureHandle(id)` exactly like a facade render target (extraction never
gates on the texture, so the draw appears once the main thread registers it). The
CPU-bytes update path (AC1) uses this SAME facade rather than the RuntimeUniform
packet the AC sketched, because (a) AC2 must be app-facade regardless (DOM stays
off the worker), and one coherent slice beats two transports, and (b) the plan
blesses the app-facade route (C3 precedent) precisely to avoid packet-family /
determinism churn. The whole feature therefore touches NO worker snapshot, NO
packed-SAB encoding, and NO determinism fixtures.

**Byte-identity story.** A dynamic texture realizes byte-for-byte like any texture
with the same usage flags (`textureUsageFlags` unchanged; the realize path
unchanged), so every existing (non-dynamic) texture is unaffected — pinned by
`test/webgpu/dynamic-texture-resources.test.ts` asserting the registered asset's
usage array + format. The frame report's `dynamicTextures` field is omitted
entirely when no dynamic texture was registered, so a report from an app that does
not use the feature is byte-identical to before D3.

**Determinism outcome.** Determinism fixtures hash the extracted `RenderSnapshot`
projection, not GPU bytes. Registration happens on the main thread (not in the
snapshot) and updates are GPU-side (`writeTexture` / `copyExternalImageToTexture`),
so no fixture uses a dynamic texture and none shifts. `test/determinism` passes
GREEN with NO refresh (confirmed in the full vitest run: 3069 tests, 0 fixture
changes).

**Diagnostics.** Every failure path emits a structured, cataloged `dynamicTexture.*`
code (`invalidDescriptor`, `notRegistered`, `notRealized`, `invalidRegion`,
`invalidBytesPerRow`, `uploadDataTooSmall`, `missingSource`, `uploadUnavailable`,
`uploadFailed`) rather than a device validation error; the code list is the single
source of truth from which the diagnostic-code type is derived.

Deviations from the original AC sketch: (1) AC1 rides the app-facade command, not
a RuntimeUniform-style packet (justified above; the app-facade route was blessed by
the plan for exactly this determinism reason). (2) The example is a single
screen-space video-wall quad sampling a three-region atlas (a HUD-style video wall)
rather than three separate perspective in-world quads — one custom material keeps
the frame on the proven custom-WGSL draw path (the multi-distinct-custom-material
route is a separate concern) and the atlas is the natural shape for sub-rect
uploads; the scoreboard/TV/ticker semantics are unchanged. (3) The video row of
scenario #7-style "real HTMLVideoElement" playback is
demonstrated with a canvas standing in for the video source, because SwiftShader /
headless Chromium has no video decoder; the import path itself accepts an
`HTMLVideoElement` identically (typed + documented). Cube / 3D-array dynamic
targets remain out of scope.

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

Status: implemented (2026-07-13). AC1 (projected decals): a `Decal` authoring
component (`textureId`/`samplerId`, `width`/`height` size, `color` tint,
`opacity` fade, `depthBias`, `capacity`, `sequence`, `visible`) whose entity
WORLD transform is the projector. Extraction (`extractDecals`) gathers live
decals, folds `opacity` into the tint alpha, gates them by
Enabled/Visibility/RenderLayer against the camera-union mask, and emits
`snapshot.decals` packets. Rendering is a dedicated **decal feature realizer**
(registered alongside particles/UI so EVERY frame route gets it) driving ONE
shared instanced pipeline — the depth-biased projected-quad route, NOT
per-decal custom-WGSL. Each quad lies in the projector's local plane and is
nudged toward the camera by `depthOffset` so it wins the depth test against the
coplanar surface without z-fighting; the pipeline depth-tests `less-equal` and
never writes depth, so it composites over the scene depth the opaque pass wrote
(nearer geometry still occludes it) in the post-opaque transparent phase — no
extra pass submitted. AC2 (cap + eviction): the live-decal count is capped
oldest-first (ring buffer) at extraction — keep the newest `capacity` by
`sequence`, evict the rest — and the tally rides `snapshot.report.decals` =
`{ capacity, live, evicted, submitted }` (mirrored into the renderer's
`features.decals` with `drawn`/`textureBatches`, and a conditional
`counts.decals`). `examples/decals` fires one bullet-hole shot per frame at a
wall; `test/e2e/decals.spec.ts` asserts the report caps `live` at 6 while
`evicted` climbs to 6 over 12 shots, a surviving decal turns a wall pixel orange,
and an evicted slot returns to bare wall.

**Technique chosen + rationale.** The projected-quad route (the plan's stated
preference and the blessed fallback) drawn through a dedicated feature realizer,
NOT the deferred box-projector. Rationale: the feature-realizer subsystem
(particles/UI) is the existing first-class draw hook that runs in all frame
routes, so ONE shared instanced pipeline in the transparent phase gets decals
onto the wall in a single coherent slice with no new render pass, no read-only
scene-depth submission, and no risk of the multi-distinct-custom-WGSL-material
black-frame bug (D3). A full deferred box-projector reconstructing world
position from the scene depth buffer is the mesh-conforming follow-up.

**Byte-identity story.** The decal pass/pipeline is INERT with no decals: the
realizer returns no commands, builds no pipeline (`cache.decalPipelines` stays
empty), and reports nothing, so `features.decals` and `counts.decals` are both
omitted and no extra pass is submitted — a decal-free frame renders
byte-identically to a pre-D4 frame. Pinned by
`test/webgpu/decal-frame-resources.test.ts` (empty commands + `report`
undefined + empty pipeline cache) and the no-op pipeline-key literal.

**Determinism outcome.** Decals ride the ECS snapshot as a plain-array family
transported through the transferable path (a decal-carrying frame is added to
`hasUnsupportedSharedSnapshotPayload`, so it skips the SAB packed codec — no
codec/version change). The determinism fixtures hash the extracted
`RenderSnapshot` projection and no determinism scene declares a decal, so
`snapshot.decals`/`report.decals` are absent there and `test/determinism` passes
GREEN with NO fixture refresh (confirmed).

**Diagnostics.** Authoring validation emits `decal.invalidTexture` /
`invalidSize` / `invalidOpacity` / `invalidDepthBias` / `invalidCapacity`; the
realizer emits `decalFrame.*` (createBindGroupUnavailable, missingView,
viewBufferFailed, instanceBufferFailed, missingPipelineLayouts) — every failure
path is a structured diagnostic, never a raw WebGPU validation error. Normal
capacity overflow is NOT a diagnostic — it is the expected condition reported via
the `evicted` counter.

Deviations from the AC sketch: (1) projected-quad route (deferred reconstruction
declined for slice size, per "choose the route you can land cleanly"). (2) The
"layer mask" gates the decal per view (standard engine per-view layer filtering),
not per underlying-surface layer — per-fragment surface-layer rejection is a
deferred-route feature (🟡). (3) The projector is flat-surface (walls/floors),
not mesh-conforming, and renders the primary view's matrix (single-camera
scenes). Scenario #17 → ✅ (the last ❌ in the advanced-audit scorecard; the
tally is now ✅18/🟡2/❌0).

- AC1: A decal component (texture, size, projection transform, layer mask,
  fade) renders projected onto opaque scene geometry without z-fighting
  (depth-bias or deferred-style reconstruction — implementation's choice,
  proven by the baseline).
- AC2: Example: FPS-style bullet holes accumulating on walls with a cap +
  eviction policy asserted via report counts. Scenario #17 → ✅.

### D5. First-class dynamic mesh API — **S**

Status: implemented (2026-07-13). AC1 + AC2 landed; scenario #16 → ✅.

**AC1 — partial mesh update surface.** `meshes.update(id, { streams, index,
updateRanges })` (with a `DynamicMesh.update(...)` convenience) on
`MeshAccess` (`packages/app/src/systems/meshes.ts`) partially updates a
registered mesh's vertex/index buffers WITHOUT re-registering the asset. It
reads the currently-registered `MeshAsset`, rebuilds it reusing each stream's
backing typed array (or a caller-supplied same-size/same-type replacement),
stamps `updateRanges` on the NAMED streams (and index), and re-publishes it
(`registry.markReady` → new source version). Streams/index NOT named are
re-published with an EMPTY range list so they are skipped; a named stream
without explicit ranges re-uploads its whole buffer. This routes entirely
through the pre-existing update-range plan: `createMeshGpuUploadPlan` →
`createMeshUploadBufferDescriptors` (which already model `updateRanges`) →
`prepareMeshGpuResource`, whose same-layout reuse path
(`updateReusableMeshGpuResource` → `writeMeshBufferDataOrRanges`) does one
`queue.writeBuffer` per range against the EXISTING GPU buffer — no
`createMeshGpuBuffers`, no re-realization. The renderer machinery was already
present (trails drive it via a full `publish`); D5 adds the first-class
partial-`update()` surface, up-front validation, and the byte counter on top.

**Diagnostics.** Every invalid input is rejected with a structured `meshUpdate.*`
diagnostic and NO publish (so a bad range never becomes a raw WebGPU validation
error): `unknownHandle`, `notReady`, `emptyUpdate`, `unknownStream`,
`streamLengthMismatch` (byte length or element type differs — a partial update
cannot change the buffer size/layout), `missingIndexBuffer`,
`indexLengthMismatch`, `rangeOutOfBounds`, `rangeMisaligned` (offset/length not
4-byte aligned). Emitted as object literals with a `code:` field so the
diagnostics-catalog generator lists all nine.

**AC2 — byte counter + example.** The frame report gains a `dynamicMeshUploads`
section (`prepared-mesh-cache.ts` accumulates on the reuse-update path;
`create-webgpu-app.ts` folds it in and resets per frame, mirroring the D3
dynamic-texture counter): per-frame `frameBytes`/`frameWrites`/`frameUpdates`,
the `frameFullBytes` a full re-realization of those buffers would have cost, a
`partial` flag = `frameBytes < frameFullBytes`, and cumulative `total*`.
`examples/cloth-flag` is a small (13×10) CPU cloth banner pinned on its top row;
each frame the worker deforms the moving rows and calls `meshes.update(...)` with
one contiguous vertex window (3744 B) — the index buffer is skipped — so the
report shows `frameBytes: 3744` vs `frameFullBytes: 5456` (`partial: true`) every
frame, proving PARTIAL uploads, not full re-registration. `test/e2e/cloth-flag`
asserts the flag visibly deforms between two captures AND that the per-frame
counter stays at the partial size across many frames while `totalUpdates` climbs
(no full-buffer re-upload). Uses a built-in double-sided `material.standard`
(not custom WGSL, to avoid the known multi-custom-WGSL-black-frame bug).

**Byte-identity.** The counter increments only on the reuse-update path (a NEW
version whose layout matches an existing buffer). A static mesh hits the exact
version cache key (no write), so `dynamicMeshUploads` is omitted and a frame with
no dynamic mesh update is byte-identical to before (pinned by a webgpu unit test:
created-only + same-version → report `undefined`). Also improves the worker→main
mesh-asset mirror: an unchanged patched stream/index is now reconstructed with an
empty range list instead of `undefined` (which full-wrote every untouched buffer
each frame), making multi-buffer partial updates genuinely partial across the
boundary — the serialized patch WIRE format is unchanged.

**Determinism.** The byte counter is renderer-side (GPU write bytes) and lives on
the WebGPU frame report, NOT the extracted `RenderSnapshot`; `meshes.update`
rides the normal source-asset mirror (a plain republish) and no determinism
fixture scene uses a dynamic mesh, so `test/determinism` passes GREEN with NO
fixture refresh (confirmed).

Deviations from the AC sketch: (1) the e2e proves partial via the byte counter
being strictly below a full re-realization every frame (index skipped + pinned
row), rather than counting exactly 60 frames; the "no full-buffer re-uploads"
contract is the assertion. (2) The example uses a single interleaved
vertex stream (the layout the built-in standard material expects); separate
position/attribute streams would be a follow-up if per-attribute partial
updates are wanted.

- AC1: `meshes.update(handle, { streams, updateRanges })` from systems
  performs partial uploads through the existing update-range plan without
  re-registering the asset; invalid ranges diagnose.
- AC2: Example: CPU cloth flag deforming per frame; e2e asserts stable 60
  updates with no full-buffer re-uploads (upload byte counter in report).
  Scenario #16 → ✅.

---

## Phase 5 — Renderer breadth (main audit §22.1 items 5–7, 10–12)

### E1. Fat lines & points materials — **M**

Status: implemented (2026-07-13). AC1 (lines + points): both ship as instanced
**screen-space primitive subsystems** modeled on the sprite/decal precedent — a
`Line`/`Points` authoring component whose geometry is data (a flat typed vertex
buffer held by reference), `extractLines`/`extractPoints` that copy geometry into
new `snapshot.lineVertices` / `snapshot.pointVertices` (+ `pointColors`) transferable
families and emit `LinePacket`/`PointsPacket`, ONE shared instanced pipeline each
(`aperture/fat-line`, `aperture/point-cloud`), and dedicated `lines`/`points` feature
realizers registered alongside particles/decals/UI that draw in the post-opaque
transparent phase. **Rationale**: fat lines and points ARE instanced-quad
screen-space primitives, so a dedicated shared pipeline per subsystem (a) keeps the
mesh/point data as worker-safe data rather than baking it into a material, and (b)
avoids the known multi-distinct-custom-WGSL black-frame bug (D3) — the examples use
only these built-in subsystems, never custom WGSL. Fat lines: each polyline segment
expands on the GPU into a capsule bounding-box quad (half the screen-space `width` in
pixels perpendicular, plus half-width caps past each endpoint); a capsule SDF in the
fragment shader discards beyond half-width, yielding round caps AND round joins for
free. Width is in pixels (resolution-independent). Dashes discard on the
**world-continuous arc length** accumulated from the world-transformed vertices, so
`dashSize`/`gapSize` are world units and the pattern flows across joins. Points: each
point draws a camera-facing quad sized in pixels, or (with `sizeAttenuation`) world
units scaled by `0.5 * viewportHeight / clipW` (the three.js `PointsMaterial` model,
so nearer points are larger); round points radial-discard outside the unit disc;
optional per-point color rides `pointColors` (uniform tint folded per point when
absent). The screen-space quad-expansion math, dash arc-length, point size
attenuation, and instance packing are pure exported functions with vitest unit
coverage (`test/webgpu/line-point-geometry.test.ts`).

AC2 (examples + baselines): `examples/fat-lines` draws a dashed debug-path (a thick
cyan "staple" polyline for the screen-space width band + a dashed amber line);
`examples/point-cloud` draws a near/far attenuated white-probe pair plus a colorful
decorative cloud. `test/e2e/fat-lines.spec.ts` asserts the cyan band spans a large
fraction of the canvas height (scale-invariant proof it is far wider than a 1px line)
AND that a background gap separates the amber dashes; `test/e2e/point-cloud.spec.ts`
asserts the near probe disc covers more pixels than the far one (attenuation) and
that a point renders as a multi-pixel disc. Advanced-audit §8 line + point rows →
✅ (sub-rows 🟡 where honest — round-only joins, three.js-model attenuation).

Byte-identity + determinism: a frame with no lines/points omits every family + report
field, builds no pipeline, and submits no pass, so it is byte-identical to a pre-E1
frame (pinned by no-primitive literal tests in
`test/webgpu/line-point-frame-resources.test.ts` and
`test/rendering/lines-points-extraction.test.ts`). The families route through the
transferable transport (`hasUnsupportedSharedSnapshotPayload` +
`renderSnapshotTransferList` gain the new buffers), so the SAB packed codec is
unchanged and no determinism fixture uses lines/points — `test/determinism` is GREEN
with NO refresh. Deviations (honest): line joins/caps are round-only (no miter/bevel);
segments crossing behind the camera are not near-plane clipped (endpoint `w` clamps to
a small positive); per-vertex line colors and per-point size are follow-ups; both
pipelines project the primary view's matrix (single-camera).

- AC1: Line material with screen-space width, dashes, joins (Line2-style
  instanced quads under the hood); point material with size + attenuation.
- AC2: Examples: debug path visualization (lines) and a point-cloud viewer;
  golden baselines; feature-audit §8 rows → ✅.

### E2. Mesh LOD — **M**

Status: implemented (2026-07-13). AC1 (`Lod` component + extraction selection):
a `Lod` authoring component holds N levels (each a mesh handle + an ascending
distance threshold, held by reference as a resolved `{ meshId, distance }[]`), a
`hysteresis` band, and a deterministic `currentLevel` selection state. Level
selection runs **worker-side in extraction** (`extractLodSelection`, called once
per frame before mesh extraction) against the **primary view**: it takes the
camera→object world distance (the three.js `LOD.update` model — the object's
world-transform origin, NOT a screen-coverage metric) and picks the level with the
pure, unit-tested `selectLodLevel(distance, thresholds, currentLevel, hysteresis)`
— the highest level whose threshold the distance has cleared, with a **symmetric
hysteresis band** (switch up needs `distance >= threshold + hysteresis`, switch
down needs `distance < threshold - hysteresis`, hold between). The selected level's
mesh handle **overrides the drawn mesh** in `readMeshEntityExtractionState` (the
exact line that reads `Mesh.meshId`), so LOD needs NO renderer/webgpu change — the
existing `meshDraws` family carries a different handle per frame. **Rationale**:
overriding the handle in extraction (a) keeps selection a pure, replay-deterministic
CPU projection over authoritative ECS state, and (b) reuses the entire downstream
mesh pipeline (batching, shadows, culling) unchanged.

Hysteresis state location + rationale: the sticky `currentLevel` lives ON THE ECS
COMPONENT (deterministic world state), NOT in renderer-side memory. Extraction
rewrites it in place ONLY when the level actually changes; that `setValue` bumps the
entity version, which invalidates this entity's mesh-draw cache so the new level
mesh (and its asset signature — the resolved level id + index are folded in) is
re-resolved. Unchanged frames neither write nor churn the cache. Because the state
is ordinary deterministic ECS state, record/replay reproduces every selection
exactly. Malformed ladders (empty levels, out-of-order thresholds, missing level
mesh, negative hysteresis) emit a structured `render.lod.*` diagnostic and fall back
to the base `Mesh` handle rather than raising a device error. The per-frame tally
rides `snapshot.report.lod = { entities, levels }` (`levels[i]` = entities at level
`i`).

AC2 (example + e2e): `examples/mesh-lod` is a field of four LOD'd rocks (level 0 a
high-poly sphere, level 1 a low-poly box, one shared unlit material — NOT multiple
distinct custom-WGSL materials, avoiding the D3 black-frame bug) that the worker
dollies the camera past on a fixed near→band→far schedule. `test/e2e/mesh-lod.spec.ts`
asserts straight from `report.lod.levels`: (1) the per-level draw distribution shifts
from all-high-detail near (`[4,0]`) to all-low-detail far (`[0,4]`) — draw counts
change with distance; and (2) two band frames whose camera distances STRADDLE the raw
threshold (19 → 21 across 20) but stay inside the hysteresis band report the IDENTICAL
distribution — no popping. Both proofs are mirrored in `test/rendering` vitest
(`selectLodLevel` boundary + band coverage, per-entity `currentLevel` write-only-on-
change, report counters, and the no-LOD byte-identity literal).

Byte-identity + determinism: a frame with no `Lod` entities writes nothing, omits
`report.lod`, builds no state, and resolves every mesh handle exactly as before — so
it is byte-identical to a pre-E2 snapshot/report (pinned by a no-LOD literal test).
The new component is registered LAST so no existing component's type index shifts; no
determinism fixture declares `Lod`, and `npx vitest run test/determinism` is GREEN
with NO refresh (the LOD selection is deterministic, so a fixture using it would
replay identically — a gate scene was left as an optional follow-up).

Authoring surface: `Lod` + `createLod` + `validateLodInput`/`validateLodLevels`
(`@aperture-engine/render`), the `withLod(...)` trait (`@aperture-engine/runtime`),
and a `lod` option on `spawn.mesh(...)` (`@aperture-engine/app`) — the base `mesh` is
the fallback and each level supplies its own mesh + distance while the shared
`material` is reused (the `spawn.mesh` option was chosen over a separate `spawn.lod`
because a LOD entity IS a mesh entity — one draw, one material, swapped geometry).
Feature-audit §4 + §8 LOD rows → ✅. Deviations (honest): distance-based only (no
screen-coverage metric); selects against the primary/active view (single-camera
scenes; a multi-camera scene selects against the first view); LOD swaps the mesh
handle only (shared material), not whole sub-objects with their own materials.

- AC1: `Lod` component (levels: mesh handle + distance/screen-coverage
  threshold, hysteresis); selection runs in extraction using existing
  bounds; per-camera.
- AC2: Example: field of LOD'd rocks; e2e asserts draw counts change with
  camera distance via frame report; no popping within hysteresis band
  (two-frame report assertion).

### E3. Debug helpers / debug-draw system — **M**

Status: implemented (2026-07-13). AC1 (immediate-mode API + overlay +
no-op-in-production): a system calls `this.debugDraw.line/aabb/box/sphere/axes/
grid/frustum/bones/light(...)` every frame; each primitive lasts exactly one
frame. Every primitive tessellates into world-space **line segments** via pure,
unit-tested functions in `debug-draw-geometry.ts` (an AABB = 12 edges over 8
corners, a sphere = 3 great-circle rings, axes = 3 colored segments, a grid =
`2*(divisions+1)` segments, a frustum = 12 edges of the inverse-view-projection
NDC cube, bones = a segment per joint link). Systems accumulate into a
per-frame `DebugDrawAccumulator` (installed on world globals by
`createExtractionApp`, exposed as `this.debugDraw` on the system base and
`app.debugDraw` on the extraction app); render extraction **drains** it into a
transient `snapshot.debugLines` family (flat world positions/colors/widths) plus
a `report.debugDraw = { primitives, segments, vertices }` tally, then clears it.

Overlay + E1 backend reuse: a `debug-draw` built-in webgpu realizer packs the
segments into the **same per-segment instance layout** the E1 fat lines use and
draws them with the **same** `aperture/fat-line` pipeline
(`getOrCreateWebGpuAppLinePipeline`) — no second line rasterizer, a shared
built-in material (never custom-WGSL, so the D3 black-frame bug never applies),
in the transparent queue at a high order so helpers composite over the scene, and
inheriting the E1 pipeline's sample count + depth handling (depth-tested, no depth
write — three.js helper behavior). A debug-only frame (no meshes) renders through
the sprite/overlay-only path (extended to recognize `debugLines` as content).

No-op / byte-identity: when `config.debugDraw: false` (threaded into
`createExtractionApp({ debugDraw })`), the bound accumulator is a shared frozen
no-op — every `this.debugDraw.*` call accumulates nothing, `drain()` returns
`null`, and the frame emits no `debugLines` family, no `report.debugDraw` field,
and no overlay pass, byte-identical to a pre-E3 frame (pinned by a
disabled-vs-empty literal test). A frame that makes no debug calls is likewise
byte-identical whether debug draw is enabled or not.

AC2 (physics re-plumb): the physics debug geometry (collider wireframes / contact
normals / body-state markers / broadphase AABBs / joint frames) — previously
data-only via `this.physics.debugGeometry()` and the `physics_debug_geometry`
devtools tool, with **no render path at all** — now composites onto the **same**
overlay: `debugDraw.physics(geometry)` feeds a `PhysicsDebugGeometry` line list
through the identical sink, and a built-in app-step bridge
(`runPhysicsDebugDrawFrame`) routes `physics.debugGeometry()` through it every
frame when a `PhysicsDebug` component enables a channel. One overlay route; nothing
left on a bespoke path (the devtools query tool remains as a data accessor).

Determinism + transport: determinism scenes emit no debug primitives, so no
family/report field appears and `test/determinism` is GREEN with **no** fixture
refresh. The `debugLines` family rides the transferable transport (added to
`hasUnsupportedSharedSnapshotPayload` + `renderSnapshotTransferList`), avoiding a
packed-codec change. Failure paths emit structured `render.debugDraw.*`
diagnostics (degenerate/non-finite primitive skipped, per-frame segment cap
exceeded) rather than device errors. `examples/debug-draw` draws an AABB + sphere +
axes + grid + a physics collider wireframe every frame; its e2e asserts the exact
primitive/segment counts (1 AABB → 12 segments; 5 primitives → 89 segments),
overlay pixels over the scene, and that `?debug=off` drops both to zero.
Feature-audit §8 helper rows → ✅. Deviations (honest): `ArrowHelper` is covered by
`line` + the light-gizmo aim ray (no dedicated cone-tipped arrow); the light gizmo
is a coordinate frame + aim ray (not per-light-kind cone/sphere); the overlay is
depth-tested (three.js helper behavior), not a forced draw-over-everything pass.

- AC1: Immediate-mode debug draw API from systems (lines, AABBs, spheres,
  axes, grids, camera frusta, light gizmos, skeleton bones) rendered as an
  overlay layer, compiled out / no-op in production builds.
- AC2: Physics debug geometry re-plumbed through the same path (single
  overlay route); example + e2e report assertions on primitive counts.

### E4. Post-processing tail, prioritized subset — **L**

Status: implemented (2026-07-13). The required trio — outline, motion blur, LUT —
ships and is pixel-proven; the GTAO SSAO upgrade is deferred (decision below).
Each effect is a self-contained full-screen `WebGpuPostEffect` that slots into the
ordered post stack with per-effect frame-report diagnostics, exported from
`@aperture-engine/webgpu` and wired into the generated app via new
`render.motionBlur` / `render.lut` / `render.outline` config fields
(`boolean | {…}`), built in the order bloom → motion blur → LUT → outline. All
three are LDR-safe and — unlike bloom — do NOT force the HDR scene buffer, so the
exposure gate now keys off `render.bloom` specifically (previously any post effect
forced HDR).

AC1 (each effect slots into the ordered post array with JSON params + per-effect
report diagnostics):

- **Motion blur** (`post-motion-blur.ts`): `requiresMotionVectors` reuses the TAA
  motion-vector attachment; smears each pixel along its screen-space velocity.
  Params `intensity`/`samples`/`maxVelocity`. A route/frame with no motion vectors
  emits no commands and reports `webGpuPostPass.motionVectorTextureUnavailable`.
- **LUT color grade** (`post-lut.ts`): a 3D LUT stored as a 2D N-slice strip
  (`N*N`×`N`), trilinear `textureLoad`. Params `size`/`data`/`intensity`; omit
  `data` for an identity pass-through; a bad `data` length reports
  `webGpuPostPass.lutDataInvalid`. (The "3D-texture-lite via 2D strip" plan — real
  3D textures remain a follow-up.)
- **Outline** (`post-outline.ts` + `outline-selection-mask.ts`), AC2 below.

AC2 (outline works from an entity/selection list): the new
`app.setOutlineSelection(entities)` (accepting `RenderEntityRef`s or raw stable
ids) + the live `app.outlineSelection` set drive the selection. On a frame with a
non-empty selection AND an active outline effect, the renderer renders the
selected entities into a per-frame `r32uint` mask by **reusing the existing
ID-buffer picking pipeline** (`renderWebGpuAppOutlineSelectionMask` — the picking
ID buffer already ships), storing `1` for a visible, depth-tested selected
fragment and `0` elsewhere (occlusion via the mask pass's own depth). The mask is
threaded through `assembleWebGpuAppFrameBoundaries` →
`assembleWebGpuAppPostProcessedSwapchainTarget` into the effect's
`prepare({ selectionMask })` on BOTH the default single-encoder FrameGraph post
path AND the legacy multi-submit path (route parity), and the outline shader
edge-detects it. Empty selection ⇒ no mask ⇒ the effect degrades to an exact
identity copy, byte-identical to a non-outline frame. `report.outline =
{ selection, maskDrawCalls, ok }`. Picking supports rigid, unmorphed,
triangle-list mesh draws (skinned/morphed/non-triangle selections degrade to
identity). AC2 is proven in `test/e2e/post-tail.spec.ts`, not the city-builder
showcase: the outline app selects the target box → a warm silhouette ring appears
(1036 warm ring px), then `setOutlineSelection([])` clears it → the ring vanishes
(0 warm px, selection count → 0), and the two frames differ only by the ring.

Determinism/byte-identity: a non-outline / empty-selection frame renders no mask
and adds no report field, so `test/determinism` is GREEN with **no** fixture
refresh; SSAO is untouched so `test/e2e/ssao.spec.ts` proves the post stack is
unregressed. `examples/post-tail` shows all three effects (four side-by-side
canvases) with a pixel + report e2e (motion smear, bluer LUT, outline ring
appear/vanish). Feature-audit §13 outline/motion-blur/LUT rows → ✅ (god-rays /
SMAA / film / bokeh / adaptive-tone / SSAA remain None).

Deviation — **GTAO deferred** (see `docs/DECISIONS.md` 0027): the optional GTAO
integration upgrade for the SSAO slot is NOT shipped. A horizon-based GTAO shader
was prototyped as a strictly opt-in `quality: "gtao"` mode (byte-identical default
key), but it could not be pixel-proven end-to-end in this environment, so rather
than ship an unverified AO mode the SSAO effect is left byte-identical to pre-E4
(pinned by a default-key literal test) and GTAO is a follow-up requiring an AO
correctness golden. So the SSAO §13 "AO" row is unchanged.

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

Status: implemented (2026-07-13). AC1 (hemisphere light) + AC2 (3D / 2D-array
textures + the LUT-to-3D migration) ship and are pixel-proven; AC3 (light
probes / SH) is deferred (decision below). A scene with no hemisphere light and
no 3D/array texture is byte-identical to a pre-E5 scene — pinned by literal
tests — so `test/determinism` stays GREEN with **no** fixture refresh.

AC1 (hemisphere light): a new `LightKind.Hemisphere` — the three.js
`HemisphereLight`. `color` carries the sky color, a new `groundColor` authoring
field the ground color; the lit shader adds an ambient branch
`mix(groundColor, skyColor, saturate(0.5 + 0.5*dot(N, +Y))) * intensity`
alongside the existing ambient branch (present in BOTH the direct and clustered
light-loop variants), so an up-facing surface reads the sky and a down-facing one
the ground. Like ambient/environment the light needs no transform. **The packed
light record does NOT grow**: the codec transports the ground color through the
otherwise-unused range/innerConeAngle/outerConeAngle float slots (extraction
zeroes those for a hemisphere light so the packet round-trips byte-exact), and
the GPU float layout reuses the cone/width slots 6-8 — so `LIGHT_PACKET_WORDS`
stays 31 and every other light kind is byte-identical (pinned by a codec
round-trip + a packing literal test). `examples/hemisphere-light` lights a sphere
and an e2e proves the top reads sky-blue and the bottom reads ground-warm.

AC2 (3D + 2D-array textures): `TextureDimension` gains `"3d"` and `"2d-array"`,
and a custom-material texture binding's `viewDimension` gains them too
(`texture_3d<f32>` / `texture_2d_array<f32>`). The realizer threads the WebGPU
storage `dimension: "3d"` for volume textures (uploading every depth slice in one
`writeTexture`) and passes an explicit `"3d"`/`"2d-array"` texture VIEW for those
custom bindings; 2d/cube keep their pre-E5 descriptors byte-for-byte. The
viewDimension participates in the pipeline key ONLY when non-default (a `dim:3d`/
`dim:2d-array` token), pinned by a literal byte-identity test for the 2d case.
`examples/volume-texture-lut` samples a real `texture_3d` LUT volume from ONE
custom material (avoiding the known multi-distinct-custom-material black-render
bug) and an e2e proves the depth sampling coordinate selects the right slice.
**LUT migration:** `post-lut.ts` now uploads a real N×N×N `texture_3d<f32>` and
samples it with hardware trilinear filtering (`textureSampleLevel` + a linear
clamp-to-edge sampler and the standard half-texel scale/bias), reshaping the
existing public strip data into the volume layout at upload time so the `data`
API and example grades are unchanged. `examples/post-tail`'s LUT e2e stays GREEN.

AC3 (light probes / SH): **deferred** — see `docs/DECISIONS.md` 0028. The
hemisphere light covers the two-color ambient case and diffuse IBL the captured-
environment case; a full `LightProbe`/`SphericalHarmonics3` system (SH storage,
probe placement + blend, a bake pipeline) is a follow-up requiring an end-to-end
indirect-lighting proof, recorded explicitly so the audit's light-probe row stays
honestly ❌.

- AC1: Hemisphere light kind (sky/ground colors) packed like other lights;
  example + baseline; feature-audit §6 row → ✅.
- AC2: 3D and 2D-array texture assets (upload + sampling in custom
  materials); LUT grading (E4) migrates to a real 3D texture.
- AC3: Light probes/SH deferred to a follow-up decision — record explicitly
  in DECISIONS if rejected (avoid an implicit gap).

---

## Phase 6 — Animation, geometry, math, controls

### F1. Animation mixer v2: N-lane blending + additive — **L**

Status: implemented (2026-07-13). AC1 (N-lane weighted blend + per-lane
speed/loop + fade in/out + additive lanes + `makeAdditiveClip`, deterministic)
and AC2 (locomotion blend space + additive head-look example with a pose-readback
e2e) both ship. The v1 single-clip + one-crossfade API is preserved exactly, so
every existing mixer/driver/app test and the glb-viewer / animation-skinning
routes stay GREEN with no fixture refresh.

AC1 (N-lane mixer): `AnimationMixer` (`@aperture-engine/runtime`) gains an N-lane
action model — the three.js `AnimationAction` analog. `playLane(clipId, options)`
adds a lane (without clearing others) and returns a live `AnimationLane` handle
carrying `{ weight, speed (timeScale), loop, enabled, additive }` + fade state,
with chainable `setWeight`/`setSpeed`/`setLoop`/`fadeIn`/`fadeOut`/`seek`/`stop`.
Each `update(delta)` advances every enabled lane's time (reusing the once/repeat/
pingpong + signed-speed loop logic), applies fades to an effective weight, blends
NON-additive lanes with the existing normalized `blendAnimationClipSamples`
(quaternion hemisphere-aware), then applies additive lanes on top: translation/
scale add `weight·delta`, rotation premultiplies by `slerp(identity, delta,
weight)`, morph weights add `weight·delta`. Additive-only targets synthesize a
rest base so a head-look over an un-animated head still emits a channel.
`makeAdditiveClip(clip, { referenceClip?, referenceTime? })` (the
`AnimationUtils.makeClipAdditive` analog) converts a clip into per-keyframe deltas
(`sampled − reference`; rotation `inverse(reference) ⊗ sampled`) as a LINEAR delta
clip. All math is pure with no `Date.now()`/`Math.random()` (lane ids are a
monotonic counter), so a replay-equality unit test runs the same fixed-step
schedule twice over a three-lane blend + additive-look and asserts deep equality.

AC2 (example + e2e): `examples/locomotion-blend` is a two-bone rig whose hip
height is a speed-driven idle/walk/run blend space with an additive head-look
layer on the head bone. The worker builds the clips + `makeAdditiveClip` head-look
and drives the mixer's lanes headlessly through the ECS `AnimationDriverState`;
the main thread renders the two markers. `test/e2e/locomotion-blend.spec.ts`
drives the `speed` + `look` inputs to distinct values and asserts the sampled bone
pose at a fixed frame: low speed → idle-dominant (hip low, idle weight ≈ 1), mid
speeds → idle↔walk and walk↔run blends (hip at the weighted-average height), and
the additive head-look yaws the head bone by the same ~40° at idle AND at the
walk/run blend (independent of locomotion), with half look weight → half the yaw,
plus a same-input replay for determinism.

Honest deviations: clip channels stay TRS + morph weights (no property tracks);
lane synchronization (`syncWith`) and `AnimationAction` events (`finished`/`loop`)
are NOT implemented (feature-audit §10 mixer row notes this); IK is F2, not this
item; `makeAdditiveClip` resamples CUBICSPLINE tangents to LINEAR keyframe values.

- AC1: Mixer supports N simultaneous weighted clips (walk/run blend), per-lane
  speed/loop, fade in/out, and additive lanes (delta clips à la
  `makeClipAdditive`); deterministic under fixed seed/step (vitest replay
  equality).
- AC2: Example: locomotion blend space (idle/walk/run by speed signal) +
  additive head-look; e2e drives input and asserts pose readback at fixed
  frames; feature-audit §10 mixer row → ✅.

### F2. IK (two-bone + CCD) — **M** (needs F1)

Status: implemented (2026-07-13). AC1 ships in full. The pure solver math lives
in `@aperture-engine/math` (`ik.ts`): `solveTwoBoneIk(...)` is a law-of-cosines
two-bone solver (root/mid/end world positions + target + optional pole → new
root/mid WORLD rotations), clamping the target into the reachable annulus
`[|l1-l2|, l1+l2]` so an over/under-reach straightens toward the target with no
NaN, and placing the elbow/knee in the bend plane the pole selects;
`solveCcdChain(...)` is a tip→root cyclic-coordinate-descent N-joint solver
(shortest-arc per joint, optional `maxAngle` clamp, fixed iteration count or a
`tolerance`). Both are array-first, allocation-light, and pure (no
`Date.now()`/`Math.random()`), backed by new public
`quatConjugate`/`quatDot`/`quatSlerp`/`shortestArcQuaternion` helpers, and
unit-tested (two-bone reach / over-reach-clamp / pole-flip, CCD convergence /
unreachable-stretch, replay equality).

The fixed-step ECS system lives in `@aperture-engine/runtime` (`ik-system.ts`):
an `Ik` component holds a live `IkSolverState` (a list of two-bone/CCD
constraints) authored with `withIk({ constraints })`; because the state is held
by reference (like the F1 mixer's driver state), a worker mutates
`targetPosition`/`weight`/`enabled` per frame (e.g. from a physics raycast).
`updateIkConstraints(world)` runs in the runtime `step()` **AFTER the animation
driver + world-transform resolution and BEFORE the skinning palette**, reading
the resolved joint WORLD transforms, solving, converting the world rotations to
joint LOCAL rotations via the parent world rotations (root's parent unchanged; a
child's parent is its predecessor's freshly-solved world rotation), blending from
the animated base pose by `weight` (per-joint slerp), and writing the joint
`LocalTransform` rotation; the step then **re-resolves world transforms only when
a constraint actually wrote** so the corrected pose is same-frame. AC2's demo is
`examples/foot-placement-ik` — a leg rig (hip → knee → foot parented chain)
planted onto a tilted static ramp found by `backend.raycastFirst(...)` cast
straight down under the foot; `test/e2e/foot-placement-ik.spec.ts` asserts the
foot lands at the raycast hit height within tolerance, that moving the foot along
the ramp lands it at a new raycast-found height, that a front/back pole flips the
knee's bend direction while planting the foot identically, and a same-input replay
to a bit-identical pose. The F1 `locomotion-blend` + `animation-skinning` e2e
stay GREEN (no animation regression). Feature-audit §10 IK row → ✅.

**Byte-identity + determinism.** A constraint at `weight 0` (or `enabled: false`)
writes NOTHING and the second resolve is skipped, so a frame with no active IK is
byte-identical to a pre-F2 frame (a no-op system test asserts `solved === 0` and
untouched joint rotations). The `Ik` component is registered LAST so no existing
component's type index shifts; no determinism fixture uses IK, so
`test/determinism` is GREEN with NO refresh. Every skip path emits a structured
`aperture.runtime.ik.*` diagnostic rather than throwing.

Honest deviations: (1) no rotation/angle LIMITS or twist constraints beyond CCD's
optional per-iteration `maxAngle` clamp (three.js `CCDIKSolver` exposes per-joint
min/max Euler limits — not implemented, noted in the §10 row); (2) weight-blended
reach is exact only at `weight 1` (a partial weight is a per-joint slerp toward
the animated pose, so the effector lands short by design); (3) the solvers assume
a direct parent chain with unit joint scale; (4) the physics raycast runs in the
worker via the Rapier backend (mirroring `physics-settling`), not the app-facade
`this.physics.raycastFirst`, because the demo drives the sim headlessly through
the runtime `ExtractionApp`; (5) IK is authored through the runtime `withIk`
trait (used by the demo worker directly) — no app-facade `spawn` option was
added.

- AC1: Two-bone IK (arms/legs, pole target) and CCD chain solver as
  fixed-step systems writing joint local transforms; deterministic; foot
  placement demo using physics raycasts; e2e pose assertions.

### F3. Skinning/morph inputs for custom WGSL — **L** (needs A1; unlocks #5)

Status: implemented (2026-07-13). AC1: `material.customWgsl({ skinned: true })`
(and the `createCustomWgslMaterialAsset({ skinned })` low-level factory) opts a
custom material into the renderer-owned skinning contract. When set, the
renderer prepends `APERTURE_SKINNED_WGSL_HEADER` (versioned `v1`), which exposes
`apertureSkin(position, normal, joints0, weights0) -> ApertureSkinnedVertex`
plus `apertureSkinMatrix` / `apertureSkinPosition` / `apertureSkinDirection` —
byte-for-byte the StandardMaterial skinning WGSL, rebound to the contract's
palette symbol. A custom **vertex** entry point calls `apertureSkin(...)` to get
the skinned position + normal without touching the joint palette or the
vertex-buffer layout itself. **Deviation from the AC's `apertureSkin(position,
normal)` shorthand:** WGSL vertex attributes are per-invocation inputs, so the
helper takes the four args `(position, normal, joints0, weights0)`; the user's
vertex input struct still declares `@location(8) joints0: vec4u` +
`@location(9) weights0: vec4f` (the renderer owns the layout, not the attribute
names). **Group map** (why not a new group): the default `maxBindGroups` limit
is 4 (indices 0-3) and A1's lit contract already owns `@group(3)`, so a
`@group(4)` would exceed the limit and fail on SwiftShader/default devices.
Instead the joint palette rides an extra **binding** inside the existing
world-transforms group — `@group(1) @binding(1)` — which is exactly where the
StandardMaterial skinned path binds `skinJointMatrices`, and does not collide
with the lit `@group(3)`. So: `group(0)` view · `group(1)` world transforms
(`@binding 0`) + joint palette (`@binding 1`) · `group(2)` material bindings ·
`group(3)` A1 lit. The custom pipeline's vertex layout gains the `JOINTS_0`
(uint4 `@location(8)`) + `WEIGHTS_0` (float4 `@location(9)`) attributes — the
StandardMaterial skinned layout (stride 56), byte-identical. The palette buffer
is the SAME snapshot bones the standard skinned path consumes
(`draw.boneMatrixOffset`/`boneMatrixCount` into `snapshot.bones`); extraction
leaves `batchKey.skinned` FALSE for custom materials (that flag drives the
STANDARD skinned pipeline), so the custom route treats a draw as skinned when it
carries a bone-matrix range and binds the palette itself.

**Composes with A1**: `{ skinned: true, lighting: "lit" }` is supported — both
headers prepend (skinning first, then lighting), both feature tokens
(`skinned:v1`, `lit:v${A1}`) participate in the key, and the lit+skinned pipeline
layout swaps `group(1)` for the transforms+palette layout while staying 4 groups
(no group collision). **Byte-identity + determinism**: the `skinned:v1` token
and the header participate in the pipeline key ONLY when declared, so a
non-skinned custom material keeps byte-identical keys + vertex layout (pinned by
a literal-key test); custom-material skinning is a renderer-side pipeline concern
downstream of the RenderSnapshot, so `test/determinism` stays GREEN with no
fixture refresh. **Validation** (structured `code:` diagnostics, never a device
error): `customMaterialSource.invalidSkinned` (non-boolean),
`…skinnedReservedBindGroup` (a user `@group(1) @binding(1)`),
`…skinnedReservedSymbol` (redeclaring an `aperture*` skinning symbol), and the
frame-time `customWgslMaterial.skinnedWithoutSkinData` (a skinned material drawn
on a mesh with no valid bone-matrix range). Example + golden: instead of a
committed image (the dissolve + bend animate, which makes a fixed baseline flaky
by construction), `examples/skinned-custom-material.*` drives a procedural
2-bone skinned strip with an animated noise-dissolve fragment shader, and the
e2e proves (a) the skinned custom material renders through the app route
(`skinned:v1` in the key, 2 bones), (b) a bind pose (`bend=0`) vs a bent pose
(`bend=1`) at the SAME dissolve produce different pixels (skinning moves
vertices), and (c) the dissolve animates between presented frames.
**Honest deferral — morph deltas**: the v1 skinning contract ships skinning
cleanly; **morph-target deltas for custom materials are NOT exposed** (the
standard morph path binds three additional storage buffers + a per-instance
descriptor, disproportionate to the skinning core). A morphed custom material is
a separate future opt-in; today, author morph via a StandardMaterial or bake the
deltas into a `material.storage()` binding. Recorded in the header, AUTHORING.md,
the changeset, and scenario #5's audit note.

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
