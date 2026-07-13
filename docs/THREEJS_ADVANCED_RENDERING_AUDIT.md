# Advanced Rendering Audit — Aperture vs three.js

> **Scope.** A focused, code-verified audit of the advanced rendering surfaces
> games actually build on: custom shaders, render targets / MRT /
> render-to-texture, custom passes and GPU compute, dynamic content, masking
> and stencil workflows, and GPU feedback. Companion to
> [`THREEJS_FEATURE_AUDIT.md`](THREEJS_FEATURE_AUDIT.md), which covers the
> full feature surface at lower resolution.
>
> **Versions compared.** Aperture `0.3.0` vs three.js r184 (`super-three`
> checkout; nothing in this document depends on fork-only features).
>
> **Method.** Every Aperture claim was verified in package source and the
> examples/e2e harnesses; every three.js claim was verified in its `src/` and
> `examples/jsm/` trees. Because these use cases are exactly where developers
> hit the API directly, each capability is rated not just by existence but by
> **which tier it is reachable from**.
>
> **Aperture tiers.**
>
> | Tier          | Meaning                                                                                      |
> | ------------- | -------------------------------------------------------------------------------------------- |
> | **App**       | Supported authoring surface: `aperture.config.ts` assets, worker-system `spawn`/`material.*` |
> | **Low-level** | Achievable by hand-wiring `@aperture-engine/webgpu` + raw `GPUDevice` objects                |
> | **Internal**  | Code exists but has no user-reachable entry point                                            |
> | **Absent**    | No code path at all                                                                          |
>
> **three.js paths.** `WebGL` = classic `WebGLRenderer` (GLSL,
> `ShaderMaterial`). `WebGPU` = `WebGPURenderer` (TSL/NodeMaterial), which
> runs on a WebGPU backend or a WebGL2 fallback backend; features marked
> **WebGPU-backend-only** (compute atomics, storage textures, indirect
> draw/dispatch, render bundles) do not work on that fallback.

---

## 1. Executive summary

**Custom shaders are the widest gap, and most of it is policy, not absence of
code.** three.js gives games three escalating tiers — `ShaderMaterial`,
`onBeforeCompile` chunk patching, and the TSL node system where custom
materials automatically inherit lighting, shadows, skinning, morphs, and
instancing. Aperture deliberately ships one narrow, data-only custom-WGSL
route (`DECISIONS.md` 0010–0012, 0016): uniforms, textures, samplers,
read-only storage buffers (parity plan A2), and per-instance attributes work
end-to-end from the app facade with live uniform updates that never rebuild
pipelines (`RuntimeUniform`, `DECISIONS.md` 0022), and custom materials can
now opt into the renderer-owned lit contract (`lighting: "lit"`, parity plan
A1 — packed lights, directional shadow, IBL, fog via `aperture*` WGSL
helpers), declare multiple color targets (`colorTargets`, parity plan B3), and
sample the scene depth read-only (`source: "scene-depth"`, parity plan B4 —
the binding-layout variants now cover depth/unfilterable/comparison/
multisampled/cube, closing the float/2D/filtering hard-coding). Remaining
custom-shader gap: no skinning/morph inputs.

**Render-to-texture is solid plumbing with a young authoring story.**
Per-camera `renderTargetId`, MSAA + resolve, handle-stable resize/reuse (the
`render-target-*`/`mixed-*` example matrix proves the lifecycles), and
readback all work, and B1 added facade allocation + camera pairing +
sampled-target wiring (`this.renderTargets.register`, `spawn.camera({
renderTarget })`, `material.texture` against the target id — the minimap
recipe is now app-tier), B2 added cube targets with a scheduled capture
camera feeding IBL (`dimension: "cube"`, the reflective-probe recipe), and
B3 added the single-pass MRT authoring surface (`colorTargets`, the gbuffer
recipe). Still missing: 3D/array targets and mirror/portal helpers. three.js
has MRT (`count > 1` / `MRTNode`), cube/3D/array targets, `CubeCamera`,
`Reflector`, and grab-pass nodes.

**Custom passes are Aperture's real escape hatch — with real limits.**
`addRenderPass`/`addComputePass` are genuinely on the app facade and the
frame graph schedules them by declared reads/writes; the compute path is
fully general (own pipelines, storage buffers, readback), B3 lets render
passes write facade render targets (clear/load intent, MRT attachments,
cross-frame ping-pong) as well as scene-color, and C1 closes the compute→draw
bridge — a compute pass writes a writable `BufferAsset` that an instanced
custom material consumes the same frame as a storage binding AND a
buffer-backed instance stream, frame-graph-ordered compute-before-draw (the
counterpart of three.js TSL `storage().toAttribute()` compute-to-vertex
plumbing), and C2 exposes GPU-driven indirect draws — a user render pass records
`ctx.drawIndirect` / `drawIndexedIndirect` against a compute-written argument
buffer, and the GPU-authoritative drawn instance count is read back into the
frame report. Remaining limit: pass bodies are raw WebGPU rather than data.
three.js counters with `EffectComposer` (WebGL) and TSL compute with atomics,
storage textures, and indirect draws (WebGPU backend).

**Confirmed absent in Aperture across this whole domain:**
3D/array render targets (decals shipped as parity plan D4; cube render targets
shipped as parity plan B2; MRT authoring and user-pass target writes shipped as
parity plan B3; custom-material scene-depth access shipped as parity plan B4; the
compute→draw / compute-to-vertex bridge shipped as parity plan C1; the GPU-driven
indirect-draw user surface shipped as parity plan C2; per-camera and per-material
clipping planes shipped as parity plan D2; runtime CPU-bytes + canvas/video
texture updates shipped as parity plan D3 — 2D only, cube/3D-array dynamic targets
still absent; the first-class dynamic mesh update API — partial `meshes.update()`
uploads through the existing update-range plan with a frame-report byte counter —
shipped as parity plan D5). §9 now scores **Aperture ✅ 19 / 🟡 1 / ❌ 0 of 20
concrete game scenarios — no ❌ remains**: decals (scenario #17) shipped as parity
plan D4 (a dedicated instanced decal pass projecting depth-biased quads onto opaque
geometry with an oldest-first live-decal cap surfaced in the frame report), and CPU
cloth (scenario #16) shipped as parity plan D5 (a first-class
`meshes.update(handle, { streams, updateRanges })` partial-upload surface whose
per-frame report byte counter proves the uploads stay partial, not a full
re-realization — shipped as `examples/cloth-flag`), leaving only one 🟡 (planar
mirror #7). §10 ranks the gap closures by how much game-dev surface each unlocks.

---

## 2. Custom shaders

### 2.1 Authoring model

| Aspect            | three.js                                                                                                   | Aperture                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Entry surface     | `ShaderMaterial`/`RawShaderMaterial` (WebGL); TSL `NodeMaterial` + `Fn()`/`wgslFn`/`glslFn` (WebGPU)       | `CustomWgslMaterialAsset`: data-only WGSL source asset + typed binding declarations (`material.customWgsl`)             |
| Escalation tiers  | Stock material → `onBeforeCompile` patch → full custom → node graph                                        | Stock material → runtime param patch → full custom WGSL (no intermediate patching tier)                                 |
| Partial overrides | `onBeforeCompile` chunk replacement; TSL slots (`colorNode`, `normalNode`, `positionNode`, `depthNode`, …) | None — custom WGSL replaces the whole vertex+fragment program                                                           |
| Live GPU objects  | Materials own programs/uniforms directly                                                                   | Forbidden in ECS (`customMaterialSource.liveRendererObject` diagnostic); renderer realizes assets (`DECISIONS.md` 0016) |
| Cache identity    | `customProgramCacheKey()` (manual for `onBeforeCompile`); auto-derived for node materials                  | Hash-derived pipeline key: source + render state + instance layout + binding visibility + uniform schema                |

Aperture's asset route is in `packages/render/src/materials/types.ts`
(`CustomWgslMaterialAsset`), realized by
`packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts`, and
authored from systems via `material.customWgsl` / `material.uniform` /
`material.texture` / `material.sampler` / `shader.asset|inlineWgsl`
(`packages/app/src/systems/spawn/descriptors.ts`). Worked example:
`examples/custom-material.*`; recipe: `docs/recipes/custom-wgsl-material.md`.

### 2.2 Data surface (bindings)

| Binding kind             | three.js                                                              | Aperture                                                                                                                                                                                                                                    | Verdict            |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Uniforms (typed)         | `uniforms` (WebGL), `uniform()` nodes                                 | ✅ App — typed fields (f32/i32/u32/vec2-4/color/mat4), std140-packed                                                                                                                                                                        | Parity             |
| Textures + samplers      | Texture uniforms; `texture()` nodes                                   | ✅ App — binding-layout variants (`sampleType` float/unfilterable/depth/sint/uint, `viewDimension` 2d/cube, `multisampled`, sampler `filtering`/`non-filtering`/`comparison`) close the old float/2D/filtering hard-coding (parity plan B4) | Parity             |
| UBO groups               | `uniformsGroups` (WebGL), uniform nodes                               | ✅ App (one uniform buffer per declared binding)                                                                                                                                                                                            | Parity             |
| Storage buffers          | `storage()`/`StorageBufferNode`, `instancedArray()` (WebGPU)          | ✅ App — `material.storage()` binds read-only `BufferAsset` sources; keyed `RuntimeBuffer` packets stream updates (A2)                                                                                                                      | Parity (read-only) |
| Per-instance attributes  | `InstancedBufferAttribute`; instance nodes                            | ✅ App — `instanceAttributes` layout + `InstanceData` component (named values, `@location(6+)`)                                                                                                                                             | Parity             |
| Per-object scalar params | `material.clone()` per object; `userData()`/`reference()` nodes       | ✅ App — `RuntimeUniform` keyed packets: `queue.writeBuffer` updates, **zero pipeline rebuilds**                                                                                                                                            | Aperture cleaner   |
| Scene depth              | `depthTexture` sampling; `viewportDepthTexture`/`linearDepth` nodes   | ✅ App — `source: "scene-depth"` binds the frame's stored depth read-only to any transparent custom material (MSAA-aware); post effects and user passes read it too (parity plan B4)                                                        | Parity             |
| Scene color (grab)       | `viewportSharedTexture`, `backdropNode`; transmission grab (internal) | ❌ Not bindable by custom materials (transmission grab is internal to standard materials)                                                                                                                                                   | Gap                |

The renderer's fixed bind contract for custom materials
(`docs/AUTHORING.md`): `@group(0)` view uniform (viewProjection + camera
position), `@group(1)` storage array of world transforms indexed by
`instance_index`, `@group(2)` user bindings, `@group(3)` renderer-owned —
formerly reserved, now realized as the versioned lit contract for
`lighting: "lit"` materials (parity plan A1, `DECISIONS.md` 0024); depth
access remains a future hook (B4).

### 2.3 Vertex stage & geometry integration

| Capability                   | three.js                                                                                     | Aperture                                                                                                                                                              | Verdict |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Vertex displacement          | ✅ both paths (`positionNode` on WebGPU)                                                     | ✅ user owns the vertex entry point                                                                                                                                   | Parity  |
| Available attributes         | Any geometry attribute                                                                       | Fixed: position/normal/uv (+ declared instance attrs); no tangent/color/uv1 in custom WGSL                                                                            | Partial |
| Skinning in custom shaders   | ✅ `#include` chunks (WebGL); automatic `SkinningNode` (WebGPU)                              | ❌ no joint/weight/palette bindings for custom pipelines                                                                                                              | Gap     |
| Morphs in custom shaders     | ✅ chunks / automatic `MorphNode`                                                            | ❌                                                                                                                                                                    | Gap     |
| Shadow-casting displaced geo | ✅ `customDepthMaterial`/`customDistanceMaterial` (WebGL); `castShadowPositionNode` (WebGPU) | ✅ `entryPoints.shadowVertex` compiles a per-material depth-only caster from the same WGSL module (parity plan A4)                                                    | Parity  |
| Specialization constants     | `defines` (WebGL); node graph branches (WebGPU)                                              | 🟡 `pipelineKey.features/specialization` differentiate cached pipelines but are not fed to the module as WGSL overrides                                               | Partial |
| Render state                 | Full material state incl. stencil                                                            | ✅ alpha modes, cull, depth (test/write/compare/bias), blend presets, colorWriteMask, and per-material stencil (write/func/ref/masks/ops, all kinds — parity plan D1) | Parity  |
| MRT outputs                  | GLSL3 `layout(location=N)` outs; `mrtNode`                                                   | ❌ exactly one color target per custom pipeline                                                                                                                       | Gap     |

### 2.4 Lighting integration for custom materials

three.js: `lights: true` + `UniformsLib.lights` merge (WebGL) or — far
stronger — TSL materials that get lights, shadows, IBL, and fog composed
automatically, plus custom `LightingModel` subclasses for bespoke BRDFs.

Aperture: an **opt-in lit contract** (parity plan A1, `DECISIONS.md` 0024).
`material.customWgsl({ lighting: "lit", ... })` makes the renderer bind a
versioned `@group(3)` (packed light buffers, directional shadow receiver
resources, IBL irradiance/PMREM/BRDF-LUT, fog params — the SAME
renderer-owned resources StandardMaterial consumes, with fallbacks when a
frame lacks them) and prepend a WGSL header exposing `aperture*` helpers
with StandardMaterial math parity (`apertureEvaluateLightSurface`,
`apertureDirectionalShadow`, `apertureSampleIbl*`, `apertureApplyFog`; see
`docs/LIGHT_SHADER_WGSL_CONTRACT.md`). "Custom but lit" effects — terrain
splatting under sunlight, stylized lit water, custom car paint — are now
authorable as data (`examples/lit-custom-material.*` proves A/B parity
against a StandardMaterial reference sphere). Differences vs three.js: the
lighting model is fixed Lambert+GGX helpers, not pluggable `LightingModel`
subclasses; v1 exposes a single directional shadow receiver (3x3 PCF),
diffuse-only rect-area lights, and no clustered local-light indices —
extensions arrive behind a contract version bump. Unlit remains the default;
a material that never opts in still renders unlit with no diagnostic.

### 2.5 Iteration speed

three.js: `material.needsUpdate` recompile (WebGL); `NodeMaterialObserver`
auto-refreshes uniforms vs rebuilds (WebGPU); no source hot-reload in core.
Aperture: shader source is a versioned asset — re-registering changed WGSL
recompiles via a new hash key; the Vite plugin provides system-graph HMR but
no dedicated WGSL hot-reload; `RuntimeUniform` covers the parameter-tuning
loop without any recompile. Verdict: roughly even, different shapes; neither
has true shader HMR.

---

## 3. Render targets, MRT & render-to-texture

### 3.1 Render target capabilities

| Capability                  | three.js                                                         | Aperture                                                                                                                                                                                                               | Verdict            |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Offscreen color+depth       | ✅ `RenderTarget` (both renderers)                               | ✅ Low-level: `createWebGpuAppRenderTargetAsset` + ECS `Camera.renderTargetId`                                                                                                                                         | Parity (tier gap)  |
| App-facade allocation       | ✅ `new WebGLRenderTarget(w, h)` is the API                      | ✅ B1: `this.renderTargets.register({ id, width, height, ... })` + `spawn.camera({ renderTarget })`; handle-stable `resize`                                                                                            | Parity             |
| Single-pass MRT             | ✅ `count > 1` + GLSL3 outs (WebGL); `MRTNode`/`setMRT` (WebGPU) | ✅ B3: `material.customWgsl({ colorTargets })` — N declared targets (formats + write masks) validated against fragment outputs, extras ride facade render targets                                                      | Parity             |
| Float / half targets        | ✅ `type: FloatType/HalfFloatType`                               | ✅ any creatable format incl. `rgba16float` (the HDR path uses one)                                                                                                                                                    | Parity             |
| MSAA + resolve              | ✅ `samples` + auto resolve                                      | ✅ Low-level (`resolveTarget` first-class; `msaa` app option); proven by the `render-target-msaa*` matrix                                                                                                              | Parity             |
| Resize / reuse lifecycles   | `setSize`, dispose                                               | ✅ handle-stable resize, cross-frame reuse, dual-size, sub-rect crops — the `render-target-*`/`mixed-*` e2e matrix exists precisely to prove these                                                                     | Parity+ tested     |
| Cube / 3D / array targets   | ✅ `WebGLCubeRenderTarget`, `RenderTarget3D`, array targets      | 🟡 B2: cube targets (`dimension: "cube"` + cube-capture camera, IBL consumption); 3D and array targets remain unsupported                                                                                              | Partial (cube ✅)  |
| Depth texture attach+sample | ✅ `renderTarget.depthTexture`, depth nodes                      | 🟡 B4: custom materials sample the scene depth read-only (`source: "scene-depth"`, transparent-only) and user passes read the built-in `"depth"`; sampling a user render target's OWN depth buffer remains unsupported | Partial (scene ✅) |
| Sample RT in a material     | ✅ `rt.texture` as any map                                       | ✅ B1 app tier: texture handles resolve to the facade target's realized color texture (`renderTargets.colorTexture(id)` → `material.texture`)                                                                          | App-tier           |
| Mipmapped RTs               | ✅ `generateMipmaps`                                             | ❌ mip generation is internal; not exposed for user targets                                                                                                                                                            | Gap                |
| Readback                    | ✅ `readRenderTargetPixels(Async)` incl. per-MRT-attachment      | ✅ frame-boundary readback samples + readback helpers, diagnostics-integrated                                                                                                                                          | Parity             |
| Partial texture copies      | ✅ `copyTextureToTexture` with src region/mip                    | ❌ no user surface                                                                                                                                                                                                     | Gap                |

### 3.2 Camera-to-texture recipes

| Use case                  | three.js                                                             | Aperture today                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimap / security camera | RT + second camera + HUD quad — routine                              | ✅ buildable on the facade (B1): `renderTargets.register` + `spawn.camera({ renderTarget })` + a custom-WGSL HUD quad sampling via `material.texture` — shipped as `examples/minimap`                                                                                                            |
| Planar mirror             | `Reflector` addon (WebGL) / `ReflectorNode` (WebGPU)                 | 🟡 per-material **stencil masking** (parity plan D1) constrains the reflection to the mirror shape and **clipping planes now exist** (parity plan D2) for the oblique frustum; still no turnkey `Reflector` helper, so a hand-wired mirror only                                                  |
| Portals                   | Stencil recipes + RTs                                                | ✅ per-material stencil (write/func/ref/masks/ops) enables the stencil-portal / masked-reveal recipe (parity plan D1, `examples/stencil-portal`), combinable with B1 render targets for portal content                                                                                           |
| Dynamic env probe         | `CubeCamera` → cube RT                                               | ✅ B2: cube render target + capture camera (`capture: { every: N }` / on-demand `renderTargets.capture`) prefiltered into IBL via `renderTargetSource` — shipped as `examples/reflective-probe`                                                                                                  |
| Refraction / heat haze    | `viewportSharedTexture` grab + `backdropNode`; physical transmission | 🟡 transmission grab pass fires automatically for transmissive **standard** materials; not available to custom WGSL; note transmission params are authorable only via glTF or low-level assets — the app-facade `material.standard()` builder exposes just baseColor/roughness/metallic/emissive |
| Ping-pong (feedback FX)   | `GPUComputationRenderer`, `AfterimagePass`, manual                   | 🟡 feasible low-level by alternating two targets; no helper; user render passes can't write them (§4)                                                                                                                                                                                            |

---

## 4. Custom passes & GPU compute

| Capability               | three.js                                                                                                                                                                            | Aperture                                                                                                                                                                                                                                    | Verdict               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Custom full-screen pass  | ✅ `ShaderPass` (WebGL); `RenderPipeline.outputNode` graphs (WebGPU)                                                                                                                | 🟡 user render passes draw **onto scene-color with LOAD** only; declared writes to other targets are diagnosed, not honored — no ping-pong, so nontrivial grading chains are constrained                                                    | Gap                   |
| Pass scheduling          | Linear composer chain; node graph                                                                                                                                                   | ✅ frame-graph node with declared `reads`/`writes` (+`before`/`after`); requires `useFrameGraph` (default on)                                                                                                                               | Aperture cleaner      |
| Pass inputs              | Depth via `depthTexture`; `PassNode` gives viewZ/linearDepth/velocity/MRT taps                                                                                                      | ✅ `ctx.view("scene-color")`, `ctx.view("depth")`, own buffers/textures via `ctx.bindings`                                                                                                                                                  | Partial parity        |
| Authoring level          | Materials/nodes (data)                                                                                                                                                              | Raw WebGPU in `encode(ctx)` — user builds pipelines/bind groups against the real device                                                                                                                                                     | three.js higher-level |
| General compute          | `renderer.compute()` + `ComputeNode`; atomics/barriers/workgroup memory/subgroups (WebGPU-backend-only); transform-feedback emulation on fallback; `GPUComputationRenderer` (WebGL) | ✅ `addComputePass` is fully general: own compute pipelines, storage buffers, `dispatchWorkgroups`, buffer readback (histogram example does exactly this)                                                                                   | Parity (tier gap)     |
| Compute → rendering      | ✅ `storage().toAttribute()` feeds `positionNode`; storage textures; `geometryNode`                                                                                                 | 🟡 custom materials bind read-only storage buffers (A2), but no plumbing yet from compute output into those buffers or mesh/instance streams (C1)                                                                                           | Gap                   |
| Indirect draw / dispatch | ✅ WebGPU backend: `IndirectStorageBufferAttribute`, `BatchedMesh` indirect, `dispatchWorkgroupsIndirect`                                                                           | ✅ App (draw) — user render passes record `ctx.drawIndirect` / `drawIndexedIndirect` against a compute-written argument buffer; drawn count read back into the frame report (parity plan C2). `dispatchWorkgroupsIndirect` remains internal | Parity (draw)         |
| Render bundles           | `BundleGroup` (WebGPU-backend-only)                                                                                                                                                 | Internal render-bundle support in the draw layer; not a user surface                                                                                                                                                                        | —                     |
| Built-in post stack      | Composer passes / TSL display nodes (large library)                                                                                                                                 | Ordered built-in effect array (FXAA/bloom/SSAO/SSR/TAA/DoF/tonemap + outline/motion-blur/LUT from parity plan E4); not user-extensible as data                                                                                              | See feature audit §13 |

The takeaway: Aperture's compute escape hatch is real and app-reachable, but
the **bridge back into rendering** (compute-written vertex/instance/indirect
data) is missing, which is precisely the bridge GPU-driven game techniques
(crowds, cloth, foliage, culling) need.

---

## 5. Dynamic content

| Capability                       | three.js                                                                          | Aperture                                                                                                                                                                                                                                                                                                                                              | Verdict            |
| -------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Per-frame CPU mesh deform        | ✅ mutate array + `needsUpdate` + `updateRanges` (partial uploads), `usage` hints | ✅ D5: `meshes.update(handle, { streams, updateRanges })` streams the named byte windows to the existing GPU buffers via the update-range plan — no asset re-registration; a `dynamicMeshUploads` frame-report byte counter proves the uploads are partial, invalid ranges diagnose (`examples/cloth-flag`)                                           | Parity             |
| Procedural mesh regen            | Replace geometry                                                                  | Re-register mesh asset (full re-upload)                                                                                                                                                                                                                                                                                                               | Parity             |
| Built-in material param tuning   | Set property (auto uniform refresh)                                               | ✅ `patchStandardMaterial` / material-mutation route — no variant recompiles                                                                                                                                                                                                                                                                          | Parity             |
| PBR extension params via app API | ✅ all `MeshPhysicalMaterial` props settable directly                             | ✅ `material.standard()` exposes the full extension factor set + renderState; `materials.set` patches the same fields (parity plan A3)                                                                                                                                                                                                                | Parity             |
| Video / canvas textures          | ✅ `VideoTexture`, `CanvasTexture`, `HTMLTexture`, `VideoFrameTexture`            | 🟡 `app.updateDynamicTextureFromExternalImage` imports an `HTMLVideoElement` / `VideoFrame` / canvas / `ImageBitmap` via `copyExternalImageToTexture` (parity plan D3); the path is HTMLVideoElement-typed but the e2e proves it with a canvas standing in for video (SwiftShader/headless has no video decode)                                       | Partial            |
| Data texture runtime updates     | ✅ `DataTexture` + `needsUpdate`, partial copies                                  | ✅ `app.registerDynamicTexture` / `this.textures.register` + `app.updateDynamicTexture` — full-image AND sub-rect CPU `writeTexture` updates with an update-rate/bytes frame report (parity plan D3)                                                                                                                                                  | Parity             |
| Decals                           | ✅ `DecalGeometry`                                                                | ✅ D4: `Decal` component + `spawn.decal(...)` project a depth-biased quad onto opaque geometry through a dedicated instanced decal pass (no z-fighting), with an oldest-first live-decal cap surfaced in the frame report; 🟡 flat-surface projector (not mesh-conforming) — a deferred box-projector is the follow-up                                | ✅ (box projector) |
| Sprite/atlas animation           | Sprite + offset/repeat; `SpriteSheetUV` node                                      | ✅ sprite atlas frames + particle texture-sheet animation                                                                                                                                                                                                                                                                                             | Parity             |
| Fat lines & point clouds         | `Line2` / `LineMaterial` (fat-lines addon); `Points` + `PointsMaterial`           | ✅ E1: dedicated `Line` / `Points` instanced subsystems — screen-space-width lines with world-continuous dashes + round caps/joins, and camera-facing points with pixel/world size + perspective attenuation + per-point color; shared pipelines, byte-identical when unused (`examples/fat-lines`, `examples/point-cloud`); 🟡 line joins round-only | Parity             |

---

## 6. Masking, stencil, clipping

three.js: full per-material stencil state (write/func/ref/masks/ops) enabling
portal, mask, and outline recipes; clipping planes globally and per material
(WebGL) plus `ClippingGroup` (WebGPU renderer); `MaskPass` for composer
stencil masking.

Aperture: **per-material stencil state is supported** (parity plan D1) —
`renderState.stencil` (write/func/ref/masks/ops) on every material kind, the
three.js `stencilWrite`/`stencilFunc`/`stencilRef`/`stencilFuncMask`/
`stencilWriteMask`/`stencilFail`/`stencilZFail`/`stencilZPass` surface. The
depth-stencil attachment is selected automatically (`depth24plus-stencil8` on
frames that use stencil, depth-only otherwise), and true stencil portals
(`examples/stencil-portal`) and stencil-outline highlighting
(`examples/stencil-outline`) now work. **Clipping planes are also supported**
(parity plan D2) — per-camera (`camera.clipPlanes`, the three.js
`renderer.clippingPlanes` analog) and per-material (`renderState.clipPlanes`,
`Material.clippingPlanes`) world-space planes that UNION and cap at 8, mapping
three.js's global + per-material clipping and `ClippingGroup`. WebGPU core has no
`clip_distances` builtin, so clipping is a per-fragment `discard` injected into
the built-in mesh shaders, driven by a per-view clip-plane uniform; a primitive
cutaway (`examples/clipping-cutaway`) demonstrates the cut. Combined with
`colorWriteMask`, full depth-state control, `RenderOrder`, per-camera
`RenderLayer` masks and viewport/scissor, and depth-tested overlay user passes,
this domain reaches parity except for a `MaskPass`-style composer stage and a
turnkey `Reflector` mirror helper.

---

## 7. GPU feedback & profiling

| Capability        | three.js                                                            | Aperture                                                                                                  | Verdict                       |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Draw/tri counters | `renderer.info`                                                     | ✅ JSON frame reports: draws per family, passes, dependency readiness, diagnostics                        | Aperture deeper               |
| GPU timestamps    | `resolveTimestampsAsync` (both WebGPURenderer backends)             | ✅ `gpuTimings` option / `?gpuTimings` flag, per-pass timestamps in reports (`examples/gpu-profiler`)     | Parity                        |
| Occlusion queries | WebGPURenderer only: `object.occlusionTest` + `renderer.isOccluded` | ✅ occlusion queries with feedback + fallback reasons in the frame report (`examples/occlusion-feedback`) | Parity+                       |
| Pixel readback    | `readRenderTargetPixels(Async)`                                     | ✅ readback samples wired into reports and e2e assertions                                                 | Parity                        |
| Inspector tooling | Inspector UI, browser devtools extension                            | Headless render bundles, golden baselines, MCP `frame_capture`/`render_*` tools                           | Different shapes, both strong |

This is the one advanced area where Aperture is consistently at or above
three.js — the diagnostics-first architecture pays off exactly here.

---

## 8. Where each engine is strong (advanced-surface verdict)

**three.js advantages (this domain):** the entire custom-shading spectrum
(especially TSL's automatic lighting/skinning/shadow composition and
`wgslFn`/`glslFn` escape hatches), MRT, cube/3D/array targets and
`CubeCamera`, grab-pass nodes, node-graph stencil/clipping composition
(`ClippingGroup`), video/canvas/data textures, indirect COMPUTE dispatch
(`dispatchWorkgroupsIndirect`), and a huge library of ready passes and helper
objects (Aperture has since closed compute→vertex plumbing (C1), the indirect-DRAW
user surface (C2), per-material stencil (D1), per-camera/per-material clipping
planes (D2), projected decals (D4), and dedicated fat-line + point-cloud
subsystems (E1)).

**Aperture advantages (this domain):** `RuntimeUniform` zero-rebuild live
parameters with record/replay-safe command flow; frame-graph-scheduled user
passes with declared dependencies; a fully general compute pass surface on
the app facade; deterministic, worker-safe authoring of all of the above as
data; occlusion/timestamp/readback feedback integrated into structured frame
reports; and an e2e-tested render-target lifecycle matrix (resize/reuse/MSAA
permutations) that three.js has no equivalent of.

---

## 9. Game-dev scenario scorecard

✅ works on a supported surface · 🟡 achievable with hand-wiring or real
limits · ❌ not achievable today.

| #   | Scenario                                              | three.js | Aperture | Aperture notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Unlit stylized shader (scrolling UVs, force field)    | ✅       | ✅       | Custom WGSL + `RuntimeUniform` time/params — the showcase water shader is exactly this; can now also opt into scene lighting (A1)                                                                                                                                                                                                                                                                                                                                                                |
| 2   | Dissolve effect (noise mask + threshold)              | ✅       | ✅       | Mask texture + alphaMode `mask` + runtime threshold; the surviving surface can be lit via the A1 contract                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | Lit custom shader (terrain splat, stylized lit water) | ✅       | ✅       | `lighting: "lit"` binds the group(3) lit contract; `aperture*` helpers reproduce the StandardMaterial response (parity plan A1)                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Vertex-animated foliage/flags (wind)                  | ✅       | ✅       | Displacement works and `entryPoints.shadowVertex` mirrors it into the shadow map (parity plan A4); skinning in custom shaders remains #5's gap                                                                                                                                                                                                                                                                                                                                                   |
| 5   | Custom shader on skinned characters                   | ✅       | ❌       | No skin/morph inputs in custom pipelines                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | Minimap / security-camera monitor                     | ✅       | ✅       | Facade route (parity plan B1): `renderTargets.register` + `spawn.camera({ renderTarget })` + `material.texture` HUD quad (`examples/minimap`)                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Planar mirror                                         | ✅       | 🟡       | Per-material stencil masking (parity plan D1) clips the reflection to the mirror shape AND per-camera/per-material clipping planes (parity plan D2) now cover the oblique frustum; remaining gap is a turnkey `Reflector` helper / shipped oblique-mirror example                                                                                                                                                                                                                                |
| 8   | Stencil portal / masked reveal                        | ✅       | ✅       | Per-material stencil (write/func/ref/masks/ops, all kinds) with automatic depth-stencil format selection (parity plan D1, `examples/stencil-portal` + `examples/stencil-outline`)                                                                                                                                                                                                                                                                                                                |
| 9   | Dynamic reflection probe (cube capture)               | ✅       | ✅       | Cube render targets + scheduled capture camera + IBL prefilter of the captured cube (parity plan B2, `examples/reflective-probe`)                                                                                                                                                                                                                                                                                                                                                                |
| 10  | Refraction / heat haze (grab pass)                    | ✅       | ✅       | Automatic transmission grab; params authorable on `material.standard()` (parity plan A3); custom-WGSL grab access remains #12's domain                                                                                                                                                                                                                                                                                                                                                           |
| 11  | Custom g-buffer / MRT technique                       | ✅       | ✅       | `colorTargets` MRT declaration on custom materials + user-pass resolve (parity plan B3, `examples/gbuffer`)                                                                                                                                                                                                                                                                                                                                                                                      |
| 12  | Full-screen color grade / custom post chain           | ✅       | ✅       | User passes write facade targets (ping-pong chains) or scene-color (parity plan B3); built-in post list itself remains non-extensible                                                                                                                                                                                                                                                                                                                                                            |
| 13  | GPU particle/VFX sim (custom compute)                 | ✅\*     | ✅       | Compute→draw bridge shipped (parity plan C1): a compute pass writes a writable `BufferAsset` an instanced custom material consumes the same frame with zero CPU copies (`examples/boids`); the built-in Shuriken system also covers most VFX needs                                                                                                                                                                                                                                               |
| 14  | GPU crowd (compute skinning + instanced draw)         | ✅\*     | ✅       | Compute→instance plumbing shipped (parity plan C1): the writable buffer feeds both a `material.storage(...)` binding AND a buffer-backed instance stream (`instanceBuffer`), frame-graph-ordered compute-before-draw — the GPU crowd = boids + a built-in/custom instanced material via the instance stream                                                                                                                                                                                      |
| 15  | GPU-driven culling / indirect draw                    | ✅\*     | ✅       | Indirect-draw user surface shipped (parity plan C2): a user render pass records `ctx.drawIndirect` / `drawIndexedIndirect` against a compute-written argument buffer; the GPU-authoritative drawn count surfaces in the frame report (`examples/gpu-culling`)                                                                                                                                                                                                                                    |
| 16  | CPU cloth/jelly (per-frame vertex upload)             | ✅       | ✅       | D5: `meshes.update(handle, { streams, updateRanges })` partial-uploads the changed byte windows through the existing update-range plan (no asset re-registration); the `dynamicMeshUploads` frame-report byte counter proves the uploads stay partial, and invalid ranges diagnose (`examples/cloth-flag`)                                                                                                                                                                                       |
| 17  | Decals (bullet holes, blood)                          | ✅       | ✅       | Parity plan D4: a `Decal` component + `spawn.decal(...)` project depth-biased quads onto opaque geometry through a dedicated instanced decal pass (no z-fighting), with an oldest-first live-decal cap + eviction surfaced in the frame report; the `decals` example is FPS bullet holes hitting the cap. 🟡 flat-surface projector, not mesh-conforming (deferred box-projector is the follow-up)                                                                                               |
| 18  | In-world video/canvas screen (TV, scoreboard)         | ✅       | ✅       | Runtime dynamic + video/canvas texture updates (parity plan D3): `app.updateDynamicTexture` (CPU bytes, full + sub-rect) and `app.updateDynamicTextureFromExternalImage` (HTMLVideoElement / VideoFrame / canvas / ImageBitmap); the `runtime-texture` example ships a canvas scoreboard, a canvas-animated TV, and a CPU-bytes ticker with pixel-change e2e. (Video via a real `HTMLVideoElement` is import-path-ready but proven with a canvas standing in — SwiftShader has no video decode.) |
| 19  | Soft particles / depth-fade VFX                       | 🟡       | ✅       | three.js: manual depth sampling. Aperture: built into the particle renderer AND B4 lets any transparent custom material sample scene depth read-only (`source: "scene-depth"`, MSAA-aware) — the `forcefield` example                                                                                                                                                                                                                                                                            |
| 20  | Occlusion-driven gameplay (lens flare, AI visibility) | 🟡       | ✅       | three.js WebGPURenderer only; Aperture reports feedback with fallback reasons                                                                                                                                                                                                                                                                                                                                                                                                                    |

\* WebGPU backend required; the WebGL2 fallback loses atomics, storage
textures, and indirect.

Score (of 20): three.js ✅ 16 / 🟡 2 / ❌ 0 (2 backend-caveated); Aperture
✅ 18 / 🟡 2 / ❌ 0 — **there is no remaining ❌**. Scenario #17 (decals) flips
to ✅ with parity plan D4: a dedicated instanced decal pass projects
depth-biased quads onto opaque geometry (no z-fighting) with an oldest-first
live-decal cap + eviction surfaced in the frame report, shipped with the
`decals` bullet-hole example. The compute→rendering bridge shipped as parity
plan C1, the GPU-driven indirect-draw user surface as parity plan C2,
per-material stencil (scenario #8 → ✅) as parity plan D1, per-camera/per-material
clipping planes as parity plan D2, runtime dynamic + video/canvas texture
updates (scenario #18 → ✅) as parity plan D3, and the first-class dynamic mesh
update API (scenario #16 → ✅) as parity plan D5. The one remaining 🟡 is scenario
#7 (planar mirror — clipping planes now exist so the oblique-frustum blocker is
gone, but a turnkey `Reflector` helper and a shipped oblique-mirror example are
still missing).

---

## 10. Gap closures ranked by unlocked game-dev value

> These closures are turned into a phased, acceptance-criteria-driven
> roadmap in [`THREEJS_PARITY_PLAN.md`](THREEJS_PARITY_PLAN.md).

Ordered by how many §9 scenarios each unblocks, weighted by how central they
are to shipping games; constraints from `docs/DECISIONS.md` noted so closures
stay inside the architecture.

1. **Lighting/shadow/IBL contract for custom WGSL** (unblocks #3, upgrades
   #1/#2/#4). The reserved `@group(3)` is the designed extension point; a
   read-only "lit surface" bind contract keeps materials data-only.
   _Shipped_ — `lighting: "lit"` (parity plan A1, `DECISIONS.md` 0024).
2. **Storage-buffer bindings for custom materials + compute→draw plumbing**
   (unblocks #13/#14, enables #15). The binding type and validation already
   exist; the missing piece is a renderer-independent buffer source asset
   (already named as the blocker in `docs/RENDER_ASSET_PREPARATION.md`).
3. **Render-target authoring on the app facade + sampled-target wiring**
   (unblocks #6, halves #7/#12): facade allocation, camera pairing, and a
   documented sample-the-target route; cube targets would then unlock #9.
   _Shipped_ — facade allocation (`this.renderTargets.register`), camera
   pairing (`spawn.camera({ renderTarget })`), handle-stable resize, and
   sampled-target wiring landed as parity plan B1 (2D targets); cube targets
   with a scheduled capture camera and IBL consumption landed as parity plan
   B2 (unblocking #9). 3D/array targets and cube-as-material-texture binding
   remain open.
4. **MRT authoring surface** (unblocks #11, strengthens #12): the attachment
   planner and an internal second attachment already exist; expose color
   target count on custom materials/passes and let user passes write
   declared targets (also enables ping-pong).
   _Shipped_ — `colorTargets` declarations on custom WGSL materials and
   user-pass facade-target writes with ping-pong landed as parity plan B3
   (`examples/gbuffer`).
5. **Expose existing PBR extension params on `material.standard()`**
   (upgrades #10): pure API plumbing — the renderer already ships
   transmission/clearcoat/sheen/iridescence.
6. **Custom shadow-caster displacement hook** (upgrades #4): a per-material
   caster vertex entry point, the analog of `customDepthMaterial` /
   `castShadowPositionNode`. _Shipped_ — `entryPoints.shadowVertex` (parity
   plan A4).
7. **Runtime texture updates** (unblocks #18, helps #17): _Shipped_ — parity
   plan D3. A `copy-dst` dynamic texture asset (`this.textures.register` /
   `app.registerDynamicTexture`) with `app.updateDynamicTexture` (CPU
   `writeTexture`, full + sub-rect) and
   `app.updateDynamicTextureFromExternalImage` (HTMLVideoElement / VideoFrame /
   canvas / ImageBitmap `copyExternalImageToTexture`); update rate + bytes in the
   frame report; `examples/runtime-texture`. Real-video playback is
   import-path-ready but demonstrated with a canvas (SwiftShader has no decoder).
8. **Stencil state in the material/render contract** (unblocks #8, halves
   #7): _Shipped_ — parity plan D1. `renderState.stencil` (write/func/ref/
   masks/ops) on all material kinds; the depth-stencil attachment format is
   selected automatically per frame; `examples/stencil-portal` +
   `examples/stencil-outline`.
9. **Depth-texture binding for custom materials** (upgrades #19 for custom
   VFX, enables intersection effects). _Shipped_ — `source: "scene-depth"`
   read-only binding + the depth/unfilterable/comparison/multisampled/cube
   layout variants (parity plan B4).
10. **Skinning/morph inputs for custom pipelines** (unblocks #5) — the
    heaviest lift; palettes and morph buffers exist for built-ins.
11. **Decal system** (unblocks #17). _Shipped_ — parity plan D4: a `Decal`
    component + `spawn.decal(...)` render depth-biased projected quads onto
    opaque geometry through a dedicated instanced decal pass (no z-fighting),
    with an oldest-first live-decal cap + eviction surfaced in the frame report
    (`examples/decals`, FPS bullet holes). 🟡 flat-surface projector — a
    deferred box-projector (world-position reconstruction from scene depth) is
    the mesh-conforming follow-up.
12. **Indirect-draw user surface** (completes #15) — smallest audience,
    biggest ceiling; the command layer already emits indirect draws
    internally. _Shipped_ — `ctx.drawIndirect` / `ctx.drawIndexedIndirect` on
    user render passes, consuming a compute-written argument buffer, with the
    GPU-authoritative drawn count read back into the frame report (parity plan
    C2, `examples/gpu-culling`).
13. **First-class dynamic mesh API** (unblocks #16). _Shipped_ — parity plan
    D5: `meshes.update(handle, { streams, updateRanges })` partial-uploads the
    changed byte windows through the existing update-range plan (same-layout
    GPU-buffer reuse + `queue.writeBuffer` per range) with no asset
    re-registration; unchanged streams/index are skipped, invalid ranges emit
    structured `meshUpdate.*` diagnostics, and a `dynamicMeshUploads` frame-report
    byte counter proves the uploads stay partial (`examples/cloth-flag`).
