# Architecture

## Summary

This project is a WebGPU-only, ECS-first 3D runtime.

The core architecture is:

```text
ECS World
  -> Systems / Transform Resolution
  -> Render Extraction
  -> Render Snapshot
  -> Render World
  -> WebGPU Render Graph
  -> GPU Submission
```

The ECS world is authoritative. Rendering is a derived view of ECS state.

There is no public three.js-style mutable scene graph as the central world model.

## Package Boundaries

Aperture is organized as a pnpm workspace with package boundaries that mirror
the runtime architecture:

- `@aperture-engine/simulation`: headless ECS, assets, diagnostics, math, and
  transform ownership. It must not import render, runtime, WebGPU, or browser
  globals.
- `@aperture-engine/render`: renderer-independent authoring components, mesh
  and material asset contracts, render extraction, snapshots, render world data,
  and diagnostics. It may import simulation, but not WebGPU.
- `@aperture-engine/webgpu`: the explicit WebGPU backend and browser app
  facade. It consumes render snapshots/render-world data and owns GPU resources,
  render passes, pipelines, bind groups, command encoding, and submission.
- `@aperture-engine/app`: the default developer-facing app facade. Its
  `config`, `systems`, and `advanced` entry points are headless-safe app
  ergonomics over the lower layers. Browser-specific generated bootstrap lives
  behind the `browser` and `worker` entry points, not the root export.
- `@aperture-engine/vite-plugin`: the default Vite integration. It discovers
  `aperture.config.ts`, system globs, system descriptor metadata, and generated
  browser/worker virtual modules. It is build-time code and is intentionally not
  exported by the root `@aperture-engine/app` entry; the optional
  `@aperture-engine/app/vite` subpath re-exports it for projects that prefer the
  app namespace.
- `@aperture-engine/runtime`: headless simulation and extraction app facades.
  It composes simulation and render only; WebGPU app orchestration belongs in
  `@aperture-engine/webgpu`.

Normal app authors start with `@aperture-engine/app/config`,
`@aperture-engine/app/systems`, and `@aperture-engine/vite-plugin`. Users who
need custom GPU presentation should import `@aperture-engine/webgpu`
explicitly alongside the focused simulation, render, and runtime packages they
need.

The default browser application shape is now a Vite metaframework path:

- `aperture.config.ts` declares browser/headless mode, canvas, system globs,
  assets, render defaults, input, signals, and diagnostics.
- `vite.config.ts` installs `aperture()` from
  `@aperture-engine/vite-plugin`.
- The generated main-thread bootstrap owns presentation, input forwarding,
  diagnostics, worker startup, WebGPU submission, and resize.
- The generated worker registers discovered system modules in priority order,
  owns ECS state, resolves transforms, and extracts `RenderSnapshot` data.
- The boundary is structured-clone/transferable snapshot data plus explicit
  command messages. Main-thread code does not receive live system classes and
  does not own authoritative simulation state.

The WebGPU facade is convenience orchestration over the same
ECS/render-extraction/WebGPU boundary; it must not become a hidden scene graph or
make WebGPU state part of the authoritative ECS world. Lower-level WebGPU
helpers remain backend and test surfaces.

## Bevy-Inspired Bridge

Aperture should use Bevy as the primary conceptual reference for the
ECS-to-render bridge:

- Main/simulation ECS state is authoritative.
- An entity becomes renderable only by adding render-facing components.
- Meshes, materials, textures, samplers, and environment maps are assets
  referenced by stable handles from components.
- Render extraction copies only render-relevant ECS data into a derived render
  representation.
- Render asset preparation turns source assets into renderer-owned GPU-ready
  resources.
- Draw queueing, phase sorting, and WebGPU command submission happen after
  extraction and preparation.

Aperture keeps a serializable `RenderSnapshot` as its worker-ready boundary. A
future render world may look more like a Bevy render app internally, but it must
not become authoritative gameplay state.

## Primary Layers

### ECS / Simulation Layer

Owns:

- Entities.
- Components.
- Systems.
- Resources.
- Commands.
- Events.
- Game/app logic.
- Transform hierarchy.
- Simulation state.

The ECS layer does not own GPU resources.

### Render Extraction Layer

Reads ECS state and produces a render-facing representation.

Responsibilities:

- Query entities with renderable components.
- Read resolved world transforms.
- Apply visibility and layer filtering.
- Resolve mesh/material handles.
- Produce render packets.
- Produce render snapshots.
- Generate diagnostics for skipped/invalid renderables.

This is the key boundary that allows future worker-thread simulation.

### Render Snapshot

A compact representation of what should be rendered for a frame or state update.

Should be:

- Typed.
- Serializable.
- Stable.
- Diffable eventually.
- Suitable for worker-to-main-thread transport.
- Free of arbitrary JS object graph dependencies.

### Render World

Main-thread/render-thread representation of renderable state.

Owns:

- Render objects.
- Prepared mesh assets.
- Prepared material assets.
- Prepared texture and sampler resources.
- GPU-facing resource references.
- Draw queues / phase items.
- Material/pipeline grouping.
- Draw sorting state.
- Batching state.
- Render diagnostics.

The render world is not authoritative gameplay state.

### WebGPU Backend

Owns:

- GPU device.
- Canvas context.
- Buffers.
- Textures.
- Samplers.
- Bind groups.
- Pipelines.
- Render passes.
- Command encoding.
- Submission.

WebGPU code should be isolated from ECS logic.

### Frame Hot Path Allocation Discipline

Render-pipeline code that runs every frame should avoid steady-state heap
allocation. Per-frame stages may write into caller-owned scratch buffers,
stable pools, typed arrays, or prebuilt report shells, but they should not build
fresh arrays, maps, closures, descriptor objects, or diagnostic wrappers on the
success path.

Allocation is acceptable for setup, asset preparation, pipeline creation,
one-shot planning helpers, tests, examples, and failure diagnostics. If a helper
allocates for convenience, it should either stay outside the frame loop or be
paired with a reusable writer/scratch API for runtime use.

## Transform Ownership

Transforms belong to the ECS layer.

The renderer consumes resolved world transforms.

Suggested component split:

- `LocalTransform`
- `Parent`
- `WorldTransform`
- optional `TransformDirty`

The renderer should never compute gameplay hierarchy itself.

## Spatial Queries

CPU spatial queries belong below the WebGPU backend and execute synchronously in
the logic/simulation context. Exact mesh raycasts, mesh BVHs, BVH traversal,
closest-point queries, and entity-bounds BVHs run over renderer-independent CPU
mesh/bounds data in `@aperture-engine/simulation`, with a thin
`@aperture-engine/render` adapter for source `MeshAsset` buffers. Aperture does
not create a separate BVH worker or expose async query promises for gameplay
logic. WebGPU ID-buffer picking remains a visual/editor convenience derived from
render snapshots; it is not the authoritative gameplay query path.

## Render Authoring Components

Initial ECS-facing render components may include:

- `Mesh`
- `Material`
- `Camera`
- `Visibility`
- `RenderLayer`
- `Name`
- `DebugMetadata`
- `Light`
- `LightShadowSettings`

These are semantic app-facing components. They should not contain WebGPU-specific state.

The preferred mesh authoring direction follows Bevy conceptually, but drops the
`3d` suffix because Aperture is a 3D-only runtime: store mesh and material
handles in separate components. The early combined `MeshRenderer` component has
been removed from the active API.

- `Mesh`: stable `MeshHandle`.
- `Material`: stable material handle for the entity's primary mesh material.
- `MaterialSlots` or separate primitive entities later for multi-material meshes.

This keeps the entity as logic identity and makes renderability opt-in through
components rather than through renderer-owned objects.

Light and environment authoring follow the same ECS-owned rule as mesh and
camera authoring. Ambient and environment inputs are global and can be extracted
without a `WorldTransform`: ambient authoring emits a `LightPacket`, while
environment authoring emits an `EnvironmentPacket`. ECS environment authoring may
store only a stable environment-map asset handle; renderer-owned texture views,
samplers, bind groups, skybox state, and shader consumption remain outside ECS.
Extraction validates authored environment-map handle readiness and copies the
handle into `EnvironmentPacket.handle` when ready, or emits diagnostics and omits
only the invalid environment packet. Directional, point, and spot lights require
`WorldTransform` because extraction derives their render-facing position and
orientation from ECS transform data; missing transforms should produce
diagnostics instead of renderer-owned fallback state.

Shadow settings are also ECS-owned authoring data. Extraction may emit a flat
`ShadowRequestPacket` for supported lights or diagnostics for unsupported
requests, but shadow maps, shadow cameras, atlases, passes, and GPU resources
remain renderer-owned future work and must not be stored on ECS components.

Renderer-side light/environment resource preparation is derived from extracted
packets, not ECS. Light packet packing may produce typed arrays and buffer
descriptors from `LightPacket`s, and environment planning may produce stable
resource keys from `EnvironmentPacket.handle`. Actual light GPU buffers are
created only on the renderer side from descriptor plans with an injected WebGPU
device. The snapshot adapter derives those renderer-owned float and metadata
buffers from `RenderSnapshot` data and treats empty light snapshots as valid
no-ops. Summary reports count created light GPU buffers separately from planned
light buffers. Light bind group layout resources and descriptor plans are
derived from renderer-owned light GPU buffer resources and stable layout keys,
not ECS state; their inspection helpers omit raw buffers. Light bind group
resource creation consumes those renderer-owned layout/descriptor resources with
an injected WebGPU-like device and returns stable resource keys while omitting
raw bind group handles from JSON helpers. The snapshot composition adapter can
derive packed light buffers, renderer-owned light GPU buffers, a light bind group
layout, descriptor plan, and bind group resource from `RenderSnapshot` data
without reading ECS or making the renderer authoritative. Its summary adapter
feeds planned light buffers, created light GPU buffers, and created light bind
groups into renderer resource summary reports as inspection/readiness data. The
focused snapshot light resource summary helper returns a standard
`RenderResourceSummaryReport`, and its JSON helper delegates to the same
JSON-safe resource summary format used by broader renderer assembly reports.
Light shader binding metadata and readiness diagnostics can validate the future
light bind group contract against renderer-owned resources, but this does not
activate shader lighting. Their JSON helper is an inspection surface for
readiness sections and stable diagnostics only, and their resource-summary bridge
reports readiness failures as warnings without changing resource counts.
Environment texture binding, shader lighting consumption, skybox passes, shader
IBL consumption, and shadow maps remain deferred renderer-owned work.
Snapshot-level lighting resource plans are therefore inspection/readiness data:
they can summarize planned light-buffer bytes and environment-map requirements
from a `RenderSnapshot`, but they do not make ECS own GPU resources and do not
mean lighting shaders, skybox rendering, IBL, or shadow rendering are active.
The packed-light WGSL declaration and JSON-safe shader inspection surfaces are
documented in [`LIGHT_SHADER_WGSL_CONTRACT.md`](./LIGHT_SHADER_WGSL_CONTRACT.md).

## Assets and Handles

The ECS should reference assets through stable handles.

Examples:

- `MeshHandle`
- `MaterialHandle`
- `TextureHandle`
- `ShaderHandle`
- `AssetHandle`

GPU objects are created and owned by the renderer/asset backend, not by ECS components.

Common authoring should move toward typed asset collections over the generic
registry:

- `Assets<MeshAsset>`
- `Assets<UnlitMaterialAsset>`
- `Assets<MatcapMaterialAsset>`
- `Assets<StandardMaterialAsset>`
- `Assets<TextureAsset>`
- `Assets<SamplerAsset>`
- `Assets<WgslShaderAsset>`

The generic `AssetRegistry` can remain the manifest, status, dependency, and
diagnostic substrate. Typed collections should be the ergonomic API for adding,
updating, and looking up source assets.

Renderer-owned prepared assets should be produced by explicit render asset
adapters. A render asset adapter maps a source asset and its version/dependency
state into a prepared renderer resource such as uploaded mesh buffers, material
bind data, texture views, samplers, or pipeline keys.

Texture source assets may include uploadable texel bytes and row-layout metadata
as renderer-independent source data. That source payload is not a GPU resource:
the WebGPU backend is responsible for turning it into `GPUQueue.writeTexture`
work and prepared texture views keyed by source handle/version.

Shader source assets follow the same rule. A `WgslShaderAsset` is WGSL text plus
metadata such as label, URL, and virtual path. It is mirrored across the
worker/main source-asset channel by handle/version. The WebGPU backend is the
only layer that may create `GPUShaderModule` objects from it.

Custom WGSL material assets are source material assets with a
`sourceDiscriminator: "custom-material-source"` instead of a built-in
`MaterialKind`. They carry a namespaced `familyKey`, render state, shader ref,
entry points, pipeline-key inputs, data-only bindings, dependencies, optional
instance attributes, and JSON-safe metadata. Built-in material families remain
reserved, and unsupported custom families diagnose instead of falling back to a
built-in material.

The current renderer-owned custom WGSL app route reserves these groups:

- `group(0) binding(0)`: view uniform.
- `group(1) binding(0)`: world transform storage.
- `group(2)`: custom material bindings.
- `group(3)`: future renderer extensions.

V1 supports path-loaded or inline WGSL, renderer-owned uniform-buffer material
bindings, texture bindings, sampler bindings, existing instance-attribute
layouts, and mixed built-in/custom frames through the normal app route. Storage
binding declarations are part of the source contract and dependency readiness
path, but unsupported app-route resource creation must diagnose with JSON-safe
records until renderer-independent buffer source assets are implemented.

Texture assets also carry renderer-independent `semantic` and `colorSpace`
metadata. The current color-management contract is documented in
[`COLOR_MANAGEMENT.md`](./COLOR_MANAGEMENT.md): StandardMaterial renders in
linear RGB, base-color/emissive textures use sRGB source formats, data textures
stay linear/data, and browser StandardMaterial output tonemaps before sRGB
display encoding.

The current renderer-independent contract is documented in
[`RENDER_ASSET_PREPARATION.md`](./RENDER_ASSET_PREPARATION.md). It defines
typed prepare/unload adapters and prepared mesh/material stores without exposing
raw WebGPU handles.

## Frame Pipeline

A typical single-threaded frame:

```text
1. Input collection
2. Command processing
3. Fixed update, if needed
4. Simulation systems
5. Transform resolution
6. Render extraction
7. Render asset extraction / change collection
8. Render asset preparation
9. Draw queueing
10. Phase sorting
11. WebGPU render graph execution
12. GPU submit
13. Cleanup
```

The default browser split-thread frame:

```text
Worker:
  1. Read input command stream
  2. Run simulation
  3. Resolve transforms
  4. Extract render snapshot
  5. Publish snapshot

Main:
  1. Collect input
  2. Write input command stream
  3. Read latest complete render snapshot
  4. Apply render snapshot to render world
  5. Prepare changed render assets
  6. Queue and sort draw items
  7. Render via WebGPU
```

## Multithreading Design Direction

The renderer must never require direct access to the authoritative ECS world.

Default worker mode currently uses transferable typed-array `postMessage`
snapshots. High-scale worker mode is opt-in and builds on the shared transport
foundation now exposed by runtime and render:

- `createSharedSnapshotTransport({ maxEntities, maxViews })` allocates
  double-buffered SharedArrayBuffer storage for transforms and view matrices.
- Atomics publish complete frames through a SeqLock-style header.
- `encodeSnapshotPackets()` writes view, mesh, light, environment, shadow, and
  bounds packet metadata as fixed-stride `Uint32Array` records.
- Input command ring buffer.
- Render snapshot publication through `createWebGpuApp({
transport: "shared-array-buffer" })`.
- `postMessage` for cold-path data such as debug names, asset metadata, and errors.

Hot data candidates:

- transforms
- view matrices
- fixed-stride render packet metadata
- visibility flags
- instance data
- input samples
- frame counters

Cold data candidates:

- debug names
- asset registration
- error reports
- schema metadata
- large scene changes

## Material System

Materials should be data-driven.

A material should describe:

- shader family
- parameters
- texture handles
- render state
- feature flags

The renderer resolves materials into:

- pipeline keys
- bind groups
- uniform/storage buffer layouts
- batching compatibility

Material diagnostics should explain performance costs where possible.

Near-term material families should progress from unlit, to matcap/normal-view
preview material, to glTF-aligned StandardMaterial. A cheaper Lambert/Phong-style
material is optional later, not a prerequisite for the StandardMaterial proof
path.

## Diagnostics

Diagnostics are part of the architecture, not an afterthought.

Current renderer frame readiness report relationships are documented in [`RENDER_FRAME_READINESS.md`](./RENDER_FRAME_READINESS.md).

The runtime should eventually provide:

- `inspectEntity(entity)`
- `explainVisibility(entity)`
- `getFrameReport()`
- `getRenderPacketReport()`
- `getAssetValidationReport()`
- `getBatchingReport()`

Agents and humans should be able to understand why something rendered, failed to render, or rendered slowly.

## Agent-Friendliness

The architecture should be easy for coding agents to work with.

Prefer:

- explicit schemas
- strong TypeScript types
- small modules
- clear file ownership
- deterministic systems
- actionable errors
- stable docs
- small backlog tasks
- tests for every subsystem

Avoid:

- hidden global mutable state
- vague lifecycle hooks
- uncontrolled plugin mutation
- large unreviewed rewrites
- object graphs that cannot be serialized or inspected

## Architecture Invariants

These should not be violated without updating `docs/DECISIONS.md`:

1. ECS is the source of truth.
2. Rendering is a derived view.
3. WebGPU is the only rendering backend.
4. The renderer does not expose a central mutable scene graph.
5. Transform hierarchy belongs to ECS.
6. GPU resources belong to renderer/backend.
7. Render extraction is a first-class boundary.
8. Worker simulation remains the browser default; renderer APIs must preserve
   the snapshot/command boundary.
