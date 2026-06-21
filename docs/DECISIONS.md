# Decision Log

Use this file to record significant architectural decisions.

Each decision should include:

- Date
- Status
- Context
- Decision
- Consequences

## 0001 — WebGPU Only

Status: accepted

Context:

The project aims to be a modern rendering/runtime foundation, not a compatibility layer for legacy APIs.

Decision:

The renderer will target WebGPU only. WebGL fallback is out of scope.

Consequences:

- Simpler renderer architecture.
- Modern GPU concepts can be used directly.
- Some browser/device compatibility is intentionally sacrificed.
- Unsupported environments should receive clear errors.

## 0002 — ECS Is Authoritative

Status: accepted

Context:

three.js-style scene graphs create friction when paired with ECS-based application logic.

Decision:

The ECS world is the source of truth for simulation, transforms, lifecycle, and render authoring components.

Consequences:

- The renderer does not own gameplay state.
- Transform hierarchy is implemented in ECS.
- Render state is extracted from ECS.
- Public API should emphasize entities/components rather than scene objects.

## 0003 — Rendering Is a Derived View

Status: accepted

Context:

To support batching, diagnostics, and future multithreading, the renderer should not directly own or mutate app state.

Decision:

Rendering is derived from ECS state through a render extraction layer.

Consequences:

- A render snapshot/render packet model is required.
- The renderer can be optimized independently.
- Worker-thread simulation becomes possible.
- There is a clean place for validation and diagnostics.

## 0004 — No Core Mutable Scene Graph

Status: accepted

Context:

A mutable object graph would recreate the three.js impedance mismatch.

Decision:

The runtime will not expose a central `Object3D`/`Scene` style graph as the core world model.

Consequences:

- Parent-child relationships exist through ECS transform components.
- Renderables are authored as components.
- Any convenience scene-like API must compile down to ECS components.

## 0005 — Multithread-Ready Boundary

Status: accepted

Context:

Long-term performance and architecture may benefit from running simulation in a Worker while rendering on the main thread.

Decision:

The renderer must not require direct access to ECS. Communication should be possible through typed snapshots and command/event streams.

Consequences:

- Single-thread mode remains possible.
- Worker mode can be added later.
- Render snapshot design must avoid arbitrary JS object dependencies.
- SharedArrayBuffer can be introduced for hot paths later.

## 0006 — Use EliCS for ECS Foundation

Status: accepted

Context:

Aperture initially added a small custom generation-checked entity allocator as the first ECS primitive. The user then requested switching the ECS foundation to EliCS.

Research notes:

- EliCS is a TypeScript/JavaScript ECS framework for web and 3D applications.
- EliCS provides `World`, `createComponent`, `Types`, `createSystem`, component schemas, component registry, pooled/recycled entities, queries, systems, and world update lifecycle.
- EliCS documentation describes components as centralized typed storage rather than per-entity component objects, which fits Aperture's data-driven direction.
- EliCS docs and repository present it as MIT licensed.
- Implementation verified the latest stable npm version as `3.4.2`.

Decision:

Aperture will use EliCS as the ECS foundation rather than continuing to grow a custom ECS implementation, while preserving Aperture's architectural invariants:

- ECS remains authoritative.
- Rendering remains a derived view of ECS state.
- WebGPU remains the only rendering backend.
- Render extraction remains a first-class boundary.
- The renderer must not own gameplay state or require direct ECS access.

Consequences:

- Aperture installs `elics@^3.4.2` and exposes a small ECS entrypoint backed by EliCS.
- The custom `EntityAllocator` API is no longer public.
- Aperture component definitions should use EliCS schemas where practical.
- Any Aperture convenience APIs must remain thin and explicit instead of hiding a scene graph.
- Future render extraction should read from EliCS world/query state and emit serializable render snapshots.

## 0007 — WebGPU-First Array Math

Status: accepted

Context:

Aperture needs math primitives for transforms, bounds, cameras, render extraction, and WebGPU submission. three.js-style math classes are ergonomic, but they encourage per-value object identity and mutation patterns that do not fit ECS column storage, worker snapshots, or allocation-sensitive transform/render extraction systems. The user specifically asked to investigate whether `gl-matrix` or a similar array-first library would be a better fit.

Research notes:

- three.js, Babylon.js, and PlayCanvas all expose ergonomic object/class math surfaces, but their internals still need flat matrix/vector data for rendering.
- `gl-matrix@3.4.4` is MIT licensed, mature, fast, and array-first, but WebGPU projection conventions are not the default; callers must explicitly use `perspectiveZO`/`orthoZO`.
- `wgpu-matrix@3.4.2` is MIT licensed, TypeScript-based, array-first, defaults to `Float32Array`, supports destination arguments for allocation control, and is explicitly WebGPU-oriented with Z 0..1 projection defaults and WebGPU mat3 padding awareness.
- `@math.gl/core@4.1.0` is MIT licensed and ergonomic, but remains class-oriented and broader than Aperture's MVP needs.

Decision:

Aperture will use a WebGPU-first, array-based math architecture:

- `wgpu-matrix` is the preferred internal MVP math kernel.
- Aperture will wrap it behind a small owned `math` module with curated type aliases and helpers.
- ECS-facing and render-extraction math data will be arrays/tuples/numeric storage, not `Vector3`/`Matrix4` class instances.
- Public authoring helpers may accept ergonomic tuple-like inputs, but must copy values into owned ECS/resource storage.
- WebGPU projection conventions use normalized device Z range `[0, 1]` by default.
- Quaternions are stored as `[x, y, z, w]`.

Consequences:

- Transform, camera, bounds, and render extraction implementation tasks should add `wgpu-matrix` rather than implementing a custom math kernel or adopting three-style classes.
- `gl-matrix` remains the fallback if `wgpu-matrix` fails a required performance, correctness, or maintenance criterion.
- The public API can be made ergonomic through helper functions, but not by making object-oriented math classes the ECS storage model.
- Tests must lock projection depth range, transform composition order, quaternion ordering, and allocation-conscious destination usage.

## 0008 — Bevy-Inspired ECS/Render Bridge

Status: accepted

Context:

Aperture's North Star already says ECS is authoritative, rendering is derived,
assets are referenced by stable handles, GPU resources are renderer-owned, and
future worker-thread simulation must remain possible. The local Bevy checkout
provides a mature architecture that closely matches those goals:

- Mesh renderability is authored through ECS components such as a mesh handle
  component and a material handle component.
- Assets live in typed collections and are referenced from components by
  handles.
- Rendering runs in a separate render world with explicit extraction and render
  schedules.
- Render assets are extracted from source assets and prepared into GPU-ready
  resources.
- Materials are asset families that define shader, bind group, render-state,
  dependency, queueing, and pipeline specialization behavior.

Decision:

Aperture will use Bevy as the primary conceptual reference for the ECS/render
bridge and asset/material authoring model, while preserving Aperture-specific
constraints:

- TypeScript-first APIs.
- WebGPU-only backend.
- Serializable `RenderSnapshot` as the worker-friendly boundary.
- 3D-only naming; Bevy's dimensional suffixes should become unsuffixed
  Aperture components such as `Mesh` and `Material`.
- No public mutable scene graph as the source of truth.
- No mechanical copying of Bevy names, Rust trait shapes, or plugin complexity
  when a smaller TypeScript shape is clearer.

Consequences:

- The preferred render authoring API should move from a combined `MeshRenderer`
  component to separate `Mesh` and `Material` handle components.
- Because this is an early prototype, `MeshRenderer` does not need to be kept
  for backward compatibility.
- The asset layer should expose typed asset collections over the generic
  registry/status substrate.
- Renderer work should be organized around extraction, render asset preparation,
  draw queueing, phase sorting, and WebGPU submission.
- PBR work should wait for the material asset and render asset preparation
  contracts instead of being treated as a shader-only task.
- Documentation and backlog tasks should reference
  `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md` when changing render authoring,
  assets, materials, render extraction, or render-world behavior.

## 0009 — No Steady-State Render Hot-Path Allocations

Status: accepted

Context:

The render pipeline will eventually run continuously at frame cadence. As the
pipeline grows from unlit MVP rendering toward PBR, multiple views, material
specialization, and worker-friendly snapshots, accidental per-frame heap
allocation would make performance harder to reason about and could hide design
drift behind convenient report builders.

Decision:

Aperture render-pipeline APIs that are intended for frame-loop use must avoid
new heap allocation on their steady-state success path. They should write into
caller-owned scratch buffers, stable object pools, typed arrays, or preallocated
result shells. Convenience helpers may allocate when they are clearly setup,
diagnostic, test, or one-shot planning surfaces, but runtime paths need an
allocation-conscious writer API.

Consequences:

- New render queue, draw-list, command, resource, and frame runner work should
  identify which APIs are hot-path and which are diagnostic/setup-only.
- Hot-path APIs should prefer explicit scratch objects over hidden internal
  arrays, maps, or one-result-per-call objects.
- Failure diagnostics may allocate when needed, but a valid frame should not
  depend on producing fresh diagnostic wrappers.
- Before adding PBR or larger frame orchestration, audit existing per-frame
  helpers and add reusable scratch APIs where the current implementation still
  allocates.

## 0010 — Route Family Keys May Be Registry-Driven

Status: accepted

Context:

Aperture's queued material route helpers can already summarize arbitrary
material-family strings in tests, but the current source material assets and
app rendering path remain built around a closed set of built-in material kinds.
Moving directly to app-level non-built-in material rendering would blur source
asset contracts, queue route keys, WebGPU adapter registration, and diagnostics.

Decision:

Source material asset kinds remain closed until Aperture has an explicit public
custom material source API. Built-in material assets continue to use the
`MaterialKind` union.

Material route family keys may become registry-driven strings at the queue and
adapter boundary. A route family key identifies which prepared-resource and
frame-resource adapter should handle a queued draw; it does not by itself define
a valid source material asset or imply render support.

Unsupported route family keys must produce diagnostics. They must not fallback
to another material family or create hidden renderer-owned source state.

Consequences:

- Future route-family parsing may accept syntactically valid registered-family
  strings instead of only built-in names.
- WebGPU app rendering remains limited to families with registered backend
  adapters.
- Public custom material authoring still needs a separate source asset,
  validation, dependency, prepared-resource, pipeline, shader, and diagnostics
  contract.
- App-level non-built-in route migration should start with type-boundary and
  diagnostics tests before adding a real rendered family.

## 0011 — Public App-Owned Material Adapters Require Source Contracts First

Status: accepted

Context:

Aperture now has generic material route, adapter registry, app resource item,
and frame-resource contracts that can carry non-built-in family keys in tests.
Those contracts are useful for keeping the route spine generic, but they do not
define public custom material source assets. A public app facade option for
app-owned material adapters would imply that users can author, validate,
prepare, and render custom material families through the normal app path.

Decision:

Aperture will not expose public app-owned material adapter registration through
`createWebGpuApp()` or equivalent app facades until a public custom material
source asset contract has been accepted.

Generic route and adapter family keys may remain internal or test-facing
surfaces unless they are backed by explicit public contracts for:

- source material asset shape and validation;
- texture, sampler, mesh, shader, and other resource dependencies;
- render-asset preparation and unload/lifetime behavior;
- shader, bind group, render-state, and pipeline-key specialization;
- diagnostics and JSON-safe report surfaces; and
- compatibility with snapshots, worker boundaries, and renderer-owned GPU
  resources.

Consequences:

- Built-in app routes remain the only public rendered material families for
  now.
- Tests may continue using non-built-in family keys to guard generic route and
  adapter boundaries.
- Colliding or unsupported family keys must diagnose clearly and must not
  silently override built-ins, fallback to built-ins, or create hidden source
  material state.
- The next public custom material step should be a source/API design decision,
  not an app facade implementation shortcut.

## 0012 — Custom Material Source Assets Are Data-Only Family Instances

Status: accepted

Context:

Decision 0011 blocks public app-owned material adapter registration until
Aperture has an accepted public custom material source asset contract. Recent
route and adapter work proved that internal queues can carry non-built-in
family keys, but source `MaterialAsset` authoring is still intentionally
limited to built-in families. Without a source-shape decision, validation,
dependency readiness, prepared-resource adapters, and app facade policy would
continue to blur together.

The built-in material source assets already follow the desired boundary: they
are renderer-independent data referenced by stable handles, while WebGPU
resources, bind groups, pipelines, and caches are prepared by the backend.
Bevy's material/render-asset pattern provides the same conceptual split between
source asset, material family behavior, extraction, and prepared render asset.
Aperture should adapt that split as TypeScript data contracts that remain
JSON-safe and worker-boundary-friendly.

Decision:

Public custom material source assets, when implemented, will be data-only
instances of a registered material family. They will not be live adapter objects
and will not contain renderer-owned state.

The minimum public source shape must include these policy-level fields:

- a source discriminator separate from the built-in `MaterialKind` union;
- a stable, namespaced `familyKey` string that identifies the registered
  material family;
- a human-facing `label`;
- serializable render-state inputs such as alpha mode, cull mode, front face,
  depth, blend, and color write policy;
- serializable pipeline-key inputs such as declared feature flags and
  specialization values;
- data-only binding and dependency declarations for uniforms, textures,
  samplers, shaders, lights, environment inputs, or other renderer-prepared
  resources; and
- optional JSON-safe metadata that does not affect rendering unless it is also
  declared as a validated pipeline, binding, or dependency input.

Built-in material family keys remain reserved. A custom family key collision
with a built-in family or with another registered custom family is invalid and
must diagnose clearly. Unsupported family keys must diagnose rather than
fallback to a built-in family.

Custom source assets must not contain raw `GPUBuffer`, `GPUTexture`,
`GPUTextureView`, `GPUSampler`, `GPUBindGroup`, `GPUPipeline`,
`GPUShaderModule`, WebGPU descriptors that hold live objects, callbacks,
adapter instances, cache maps, mutable renderer state, or authoritative ECS/game
state. Shader and resource references must be represented by stable data keys or
asset handles, not live backend objects.

Consequences:

- Built-in `MaterialKind` can remain a closed built-in union while custom
  material source assets use a distinct public shape.
- Follow-up work should add source validation before exposing app-owned adapter
  facades or rendered custom families.
- Source validation diagnostics must be separate from route, dependency,
  preparation, frame-resource, and pipeline diagnostics.
- Render asset preparation remains renderer/backend-owned and derives GPU
  resources from source assets and dependencies.
- Future worker simulation remains possible because source assets and extracted
  route data can stay serializable.
- This decision does not implement validation, typed APIs, package exports,
  app facade options, shader loading, prepared-resource adapters, browser
  rendering, IBL, shadows, or binary GLB loading.

## 0013 — Executable StandardMaterial IBL Uses Browser-Safe Group 3

Status: accepted

Context:

StandardMaterial IBL resources are currently planned and reported as group 4
resources. That is a useful renderer-owned identity for readiness reports and
cache keys, but the browser forward path already uses bind groups 0 through 3
for view, world transforms, material resources, and lights/shadow receiver
resources. Chrome reports `maxBindGroups: 4`, so WGSL `@group(4)` would require
a fifth bind group and repeat the same browser-limit problem that forced the
shadow receiver path into a combined group 3 layout.

Decision:

Executable StandardMaterial IBL shader sampling must use a browser-safe group 3
extension for the near-term WebGPU path. Group 4 may remain the JSON-safe
planning/cache/resource identity for StandardMaterial IBL bind-group resources,
but the shader-capable pipeline variant must alias those resources into an
executable combined group 3 layout alongside direct lighting and shadow receiver
resources.

Consequences:

- The next diffuse IBL shader slice should extend the combined group 3 layout
  rather than binding WGSL `@group(4)` in Chrome.
- GLTF status may continue reporting `ibl.appFrameRoute` as group 4 planning
  readiness, but executable draw-command bind groups must remain within groups
  0 through 3 for the browser proof.
- The renderer must keep JSON reports free of raw GPU handles when bridging the
  group 4 planning resource into the executable group 3 layout.
- A future high-limit device path can add a separate fifth-bind-group variant
  only if it is explicitly gated and tested; it is not the default browser
  target.

## 0014 — Vite App Metaframework Is The Default Developer API

Status: accepted

Context:

The low-level worker/main split is architecturally correct, but it made the
first app experience start with `createWebGpuApp()`, `createExtractionApp()`,
manual asset mirroring, `stepAndExtract()`, and snapshot transport. That exposed
bootstrap wiring before ECS authoring and made Aperture look like a rendering
library rather than an ECS-first runtime.

Decision:

The default developer API is an Aperture Vite app:

- `aperture.config.ts` is the product-level declaration for mode, canvas,
  system globs, assets, render defaults, signals, input, and diagnostics.
- `@aperture-engine/vite-plugin` is the documented Vite integration.
- `@aperture-engine/app/config` owns config helpers.
- `@aperture-engine/app/systems` owns worker-safe system authoring helpers.
- `@aperture-engine/app/advanced` keeps programmatic `createApertureApp()` and
  manual stepping for tests, tools, headless mode, and generated bootstrap.
- The root `@aperture-engine/app` entry must not export the Vite plugin.

Consequences:

- First-app docs should show config plus systems, not manual worker/main wiring.
- System modules run in the simulation worker by default in browser builds.
- Main-thread generated bootstrap receives serializable system manifest
  metadata, not live system classes.
- Lower-layer runtime/render/webgpu APIs remain public advanced paths.
- The metaframework hides wiring only; ECS remains authoritative and rendering
  remains derived from extracted ECS state.

## 0015 — CPU Spatial Queries Use Native Typed-Array BVHs

Status: accepted

Context:

Aperture had bounds-only raycasts in simulation and renderer-owned ID-buffer
picking in WebGPU. Bounds were too coarse for GLB meshes, while ID-buffer
picking is screen-space and cannot serve authoritative gameplay, editor tools,
snapping, swept shape casts, closest-point queries, or volume queries. Importing
`three-mesh-bvh` directly would couple Aperture's query layer to three.js
`BufferGeometry`/`Object3D` assumptions.

The initial BVH slice considered a separate worker-like BVH build protocol. That
was the wrong default for gameplay. Game systems need synchronous raycasts and
shape queries in the same logic context as the ECS state they are querying.

Decision:

Aperture CPU spatial queries use native, renderer-independent typed-array
acceleration structures owned by the logic/simulation layer. Raycasts, shape
overlaps, swept shape casts, closest-point queries, mesh BVH traversal, refit,
and entity-bounds broad phase queries execute synchronously inside that logic
context. BVH build/update work is part of simulation asset preparation and never
creates a separate runtime BVH worker. Query APIs do not return promises.

The core accepts plain CPU mesh and bounds data. `@aperture-engine/render` may
provide thin adapters from source `MeshAsset` buffers to the spatial data
contract, but WebGPU resources, render worlds, draw queues, workers,
transferable buffers, SAB-specific BVH handoff, and browser globals must not be
query inputs.

Consequences:

- Systems can call synchronous `this.spatial.raycastFirst(...)` and
  `this.spatial.raycastAll(...)` with explicit `source`/`fallback` policy
  without making renderer state authoritative.
- WebGPU ID-buffer picking remains a visual/editor convenience, separate from
  CPU gameplay/tooling queries.
- Source mesh assets can opt into `Pickable` and `MeshQueryAcceleration`
  authoring policy without storing GPU handles in ECS components.
- Large mesh acceleration must be handled with same-thread preparation,
  readiness diagnostics, simplification, refit/rebuild policy, or explicit
  bounds/collider fallback, not with an extra BVH worker.
- Serialized BVH payloads, if retained, are cache/debug snapshots rather than a
  worker handoff contract.

## 0016 — Custom WGSL Materials Use an Aperture-Owned Data Route

Status: accepted

Context:

Decision 0012 established that custom material source assets are data-only
family instances. The implementation now exposes shader source assets, app
system builders, render-asset preparation, and a WebGPU app route for custom
WGSL. That route needs a policy boundary so it does not turn into arbitrary
app-owned renderer plugins or leak WebGPU objects into worker systems.

Decision:

The public custom material v1 is an Aperture-owned WGSL material route:

- App config may declare `asset.shader(...)` entries, and systems may access
  them through `this.assets.shader(...)`.
- Worker systems may author `material.customWgsl(...)` with `shader.asset(...)`
  or `shader.inlineWgsl(...)`, data-only render state, entry points, pipeline
  key inputs, binding declarations, dependencies, and JSON-safe metadata.
- Built-in `MaterialKind` remains a closed built-in union. Custom materials use
  the separate `sourceDiscriminator: "custom-material-source"` shape and a
  namespaced `familyKey`.
- The worker/main boundary transports WGSL as source asset text by
  handle/version or inline source in the material asset. No worker system may
  create or store `GPUShaderModule`, `GPUBuffer`, `GPUBindGroup`,
  `GPURenderPipeline`, texture views, samplers, or callback-based adapters.
- The WebGPU backend owns shader module creation, pipeline creation, uniform
  buffers, bind groups, caches, command planning, and submission.
- V1 reserves groups 0 and 1 for renderer view/transform resources, group 2 for
  declared custom material bindings, and group 3 for future renderer
  extensions.

Consequences:

- Custom WGSL can render through `createWebGpuApp()` and the normal
  worker/main source asset mirror without example-local snapshot rewriting.
- Mixed built-in/custom WGSL frames can render through the same material queue,
  frame-resource preparation, frame-boundary assembly, and submission path as
  built-ins.
- Shader compile and pipeline failures must surface as JSON-safe WebGPU/app
  diagnostics, while source-shape failures stay under
  `customMaterialSource.*`.
- Texture and sampler bindings fit the data-only source contract and are
  resolved into renderer-owned app-route resources. Storage-buffer bindings,
  lighting, environment, shader imports, and arbitrary user adapter callbacks
  remain explicit follow-up work unless they fit the same data-only source
  contract and renderer-owned GPU boundary.

## 0017 — Split-Sum Specular IBL Uses an Analytic DFG With a Validated GPU LUT

Date: 2026-05-30 (SOTA roadmap M5-T1)

Context:

Specular IBL was a hand-tuned `iblSpecularProof` term
(`prefilteredColor * fresnelSchlick(NdotV, F0) * (1 - roughness*0.5)`) with no
split-sum environment-BRDF (DFG) and no energy conservation. The roadmap M5-T1
calls for a 2-channel GGX DFG LUT sampled in the specular term. The roadmap's
own SOTA bar also states: "an analytic Karis DFGApprox is an acceptable
LUT-free alternative if the LUT proves flaky." Binding a new LUT texture at
group-3 binding 8 would have required new branches across the deeply-interlocked
shader-variant-key / bind-group-layout / pipeline-layout system (`specular-ibl`
layout keys, `usesSpecularIblProof` layout detection, the group-3 bind-group
descriptor plan, and WGSL declarations), risking regressions across the 2100+
test suite for a sub-1% fidelity difference versus the analytic fit.

Decision:

The live split-sum specular IBL term evaluates the environment BRDF
**analytically in-shader** (Karis/Lazarov `environmentBrdfApprox(roughness,
NdotV) -> (scale, bias)`), producing `specularIbl = prefilteredColor * (F0 *
scale + bias)`. This is exposed as a new `iblSpecularBrdf` shader variant that
**supersedes** `iblSpecularProof`: when the renderer is given a ready BRDF LUT
resource, the snapshot carries `iblSpecularBrdf` instead of `iblSpecularProof`,
reusing the existing specular-cube binding (group 3, binding 7) with **no new
binding or bind-group-layout shape**.

The real GPU **rg16float GGX DFG integration compute pass** is still built and
proven: `createBrdfLutComputePipeline` (Hammersley GGX importance sampling, same
structure as `pmrem-compute-pipeline.ts`) and `createBrdfIntegrationLutResource`
(one-time 256² dispatch → 2d view). Its integral is validated by a Vitest unit
test against the LUT corners via `integrateEnvironmentBrdf`, the exact CPU mirror
of the WGSL, and its readiness/size/format are reported in render-control status
(`environment.brdfLut`). The existing `iblSpecularProof` variant is left intact
as a fallback.

Consequences:

- The split-sum/energy-conserving horizon (B/F90) term is now physically based
  and pixel-proven (grazing edge brightens vs the facing center;
  `examples/ibl-brdf` + `test/e2e/ibl-brdf.spec.ts`), without destabilizing the
  variant-key/bind-group system.
- Sampling the GPU LUT at a new group-3 binding 8 (replacing the analytic
  approximation) and mirroring it into the group-4
  `standard-material-ibl-bind-group-layout.ts` descriptor metadata is a clean,
  optional follow-up; the compute pass and resource builder already exist.
- Multi-scatter energy compensation remains out of scope per the M5 SOTA bar.

## 0018 — Physics Uses Backend-Neutral ECS Contracts First

Date: 2026-06-05 (SOTA roadmap M10 foundation)

Status: accepted

Context:

Aperture is beginning the M10 physics track. The physics plan calls for a
comprehensive rigidbody/collider/event/query surface comparable to practical
Bevy ecosystem usage and PlayCanvas ergonomics, but Aperture's architecture
requires ECS authority, worker-safe snapshots, synchronous gameplay queries, and
renderer-owned WebGPU resources. The existing `SharedArrayBuffer` transport is a
render snapshot transport, not live ECS storage.

Decision:

Physics starts with a backend-neutral `@aperture-engine/physics` package that
defines serializable ECS authoring components, validation helpers, fixed-step
clock helpers, backend command/result contracts, event/query contracts, and a
test backend. Concrete engines such as Rapier, Havok, or Jolt must be adapters
behind those contracts; they must not shape durable ECS component storage or
become dependencies of render/WebGPU packages.

Rapier is the planned first production backend. The default production execution
path is same-simulation-worker physics: ECS logic, fixed-step physics, physics
writeback into ECS transforms/events, and render extraction occur in the worker
that already owns simulation. A dedicated third physics worker remains an
advanced backend mode. It must communicate with the simulation worker through
explicit command/result buffers and must not directly mutate shared ECS or render
snapshot memory.

Consequences:

- `@aperture-engine/physics` is a headless package and participates in package
  boundary checks.
- Physics authoring components stay schema-driven and JSON-safe.
- Derived physics runtime state such as backend body handles is excluded from
  default component serialization by stable component id.
- Runtime integration must add fixed-step scheduling before claiming production
  physics behavior.
- A future `@aperture-engine/physics-rapier` package should depend on physics
  contracts and Rapier, while render and WebGPU remain backend-agnostic.
- Gameplay physics queries should stay synchronous in the simulation context;
  third-worker mode may provide cached synchronous results and optional
  async/editor queries, but not default promise-based gameplay raycasts.

## 0019 — Asset-Backed Physics Colliders Use App-Owned Geometry Providers

Date: 2026-06-06 (M10 physics asset-collider slice)

Status: accepted

Context:

Aperture needs ECS-authored `convexHull`, `trimesh`, and `heightfield`
colliders to cook into real Rapier shapes while preserving package boundaries:
`@aperture-engine/physics` must stay backend-neutral, `@aperture-engine/physics-rapier`
must not import app/render asset registries, and render mesh assets remain source
assets rather than physics-owned scene graph nodes. The local Bevy reference is
useful for fixed-step scheduling and explicit mesh extraction errors, but it
does not provide built-in collider cooking. PlayCanvas does provide a direct
asset-backed mesh collider reference: render/model meshes can become Ammo
convex hulls or static triangle meshes, missing assets defer shape recreation,
and mesh triangle data is cached.

Decision:

Asset-backed physics collider cooking goes through an app-owned
`PhysicsColliderGeometryProvider`. The physics package defines only
backend-neutral triangle-mesh and heightfield geometry contracts plus structured
geometry errors. The app package adapts ready render `MeshAsset` CPU geometry
through the existing spatial mesh adapter and caches packed physics geometry by
asset version. Rapier consumes only that provider contract to cook
`convexHull`, static `trimesh`, and static `heightfield` colliders.

The V1 route deliberately rejects dynamic `trimesh`/`heightfield` bodies and
non-unit ECS scale for asset-backed colliders with explicit unsupported-feature
diagnostics. No backend silently approximates asset-backed colliders with
primitive bounds.

Consequences:

- ECS collider authoring remains the durable source of truth.
- Physics and Rapier stay free of app/render package dependencies.
- Missing, loading, invalid, degenerate, dynamically unsafe, or unsupported-scale
  asset-collider cases remain visible as structured diagnostics.
- The generated simulation-worker route can pause, edit, step, query, and diff
  provider-backed asset colliders without promoting the dedicated physics-worker
  route.
- Future work can add scale baking, async/decimated cooking, compound
  submesh-level metadata, or dedicated-worker provider transport without
  changing the durable ECS authoring shape.

## 0020 — WebXR Is a View and Input Mode Over the Existing Boundary

Date: 2026-06-06 (WebXR implementation plan Phase 0)

Status: accepted

Context:

Aperture is planning WebXR support after the current render/physics foundations.
The local review of IWSDK, PlayCanvas, and three.js shows that useful XR support
needs session lifecycle, WebGPU projection-layer targets, per-eye view matrices,
controller/hand input, hit tests, anchors, planes, meshes, depth, and fake XR
test tooling. Aperture already has worker-safe render snapshots and view
matrices, but it must not compromise the North Star by storing browser XR
objects in ECS state or by adding a scene graph or WebGL fallback.

Decision:

WebXR will be implemented as a browser presentation and input mode over the
existing ECS/render snapshot boundary:

- ECS remains authoritative for durable app state, transforms, gameplay, and
  persistent XR semantic state.
- `XRSession`, `XRFrame`, `XRView`, `XRInputSource`, `XRSpace`,
  `XRGPUBinding`, projection layers, subimages, and GPU textures remain
  browser/main-thread frame-local objects.
- The simulation worker receives only serializable XR data: session/capability
  state, poses, actions, button/axis values, hand-joint packets, hit-test
  results, anchors, planes, meshes, depth metadata, and diagnostics.
- Rendering consumes the latest simulation snapshot and applies frame-local
  per-eye XR view overrides on the main thread immediately before WebGPU
  submission.
- WebGPU XR projection-layer presentation belongs in `@aperture-engine/webgpu`;
  user-facing config, browser session helpers, input forwarding, and fake XR
  test hooks belong in browser-facing `@aperture-engine/app` entry points.
- `@aperture-engine/render`, `@aperture-engine/runtime`, and
  `@aperture-engine/simulation` may gain serializable XR metadata and helpers,
  but must not import WebXR or DOM globals.
- Core rendering remains WebGPU-only. There is no WebGL fallback for XR.

Consequences:

- The first XR rendering route should use serial per-eye rendering with
  conservative culling before adding multiview, XR MSAA, native layers, or
  late-pose-aware sorting.
- XR view metadata must remain compatible with structured-clone and
  SharedArrayBuffer snapshot transports.
- XR world-space policy must be explicit, using an ECS XR origin/player-space
  model rather than hidden renderer nodes.
- Public XR features need fake-session or agent-operable tests that can pause,
  step, inspect, and diff ECS state.
- Browser/WebXR type dependencies, if added, must stay isolated to
  browser-facing app/WebGPU code.

## 0021 — Fixed-Step Render Interpolation Is a Presentation Snapshot Rewrite

Date: 2026-06-16 (Shadow Lab fixed-step parity slice)

Status: accepted

Context:

Shadow Lab moved vehicle and camera logic from once-per-render-frame updates to
fixed-step simulation. That preserves deterministic physics ordering, but it
also means a 60 Hz fixed clock can publish the same camera or visual transform
across multiple high-refresh render frames. Physics body interpolation already
handles physics-owned `PhysicsBodyState` entities, but camera rigs, vehicle
roots, wheels, and other ECS-authored visual transforms need the same
presentation smoothness without making rendering authoritative.

Decision:

Render-facing interpolation is opt-in through an ECS `RenderInterpolation`
component. Fixed-step bookkeeping captures previous and current local transform
samples before and after user fixed-step work. The app applies interpolation
after normal render extraction and physics interpolation by rewriting only the
outgoing `RenderSnapshot` transform and view-matrix data for presentation.
Simulation systems still read and write the authoritative fixed-step ECS
transforms.

Fixed-step task ordering belongs to the runtime scheduler. App systems may
declare `fixedUpdate(context)`, which is registered with the system priority
used by normal system discovery; manual fixed-step registration remains
available for framework tasks and advanced app code.

Consequences:

- The renderer still consumes snapshots and does not own gameplay transforms.
- Camera and non-physics visual entities can be smoothed at render cadence while
  simulation remains fixed-step deterministic.
- Interpolated child hierarchies must compose presentation world matrices from
  any opted-in ancestor local samples. A non-opted child keeps its current local
  transform, but a render packet beneath an interpolated parent still inherits
  the parent's presentation pose through normal transform hierarchy composition.
- Future shared snapshot and worker transports may move the interpolation write
  closer to packed snapshot publication, but they must preserve the
  presentation-only contract.

## 0022 — App Resources Are Typed Simulation-Owned Singletons

Date: 2026-06-16 (racing library-gap resource slice)

Status: accepted

Context:

The racing experience needed to share vehicle state between vehicle physics,
camera follow, smoke particles, drift marks, and lap timing. It originally used
an app-local mutable module singleton. That worked only because the current
systems run in one generated simulation worker, but it bypassed Aperture
inspection, generated-worker summaries, future replay/diff tooling, and the
ECS-first expectation that cross-system state belongs to the simulation world
rather than arbitrary modules.

Bevy treats resources as unique singleton-like data stored in the world and
read/written by systems. Aperture needs the same concept, adapted to TypeScript
and the current EliCS/app-context boundary.

Decision:

`@aperture-engine/app/systems` exposes typed app resources through
`defineResource(...)`, `resource.*` field helpers, and `this.resources`.
Resources are installed on `ApertureSystemContext`, live with the generated
simulation worker/headless app, and are summarized in generated worker/headless
status as JSON-safe data.

Resources are simulation/app state only. They must not store GPU resources,
DOM objects, Web Audio nodes, renderer caches, or browser-only handles. Render
extraction continues to derive render snapshots from ECS components and
authoring data; resources do not become a hidden scene graph.

Consequences:

- App systems can share one-per-world state without module singletons.
- Tooling can inspect resource values through worker/headless summaries.
- Resource schemas should remain structured-clone friendly and field-typed.
- Devtools expose `resource_get` and schema-validated `resource_set` over the
  same summary contract; future tooling may add resource diffs.
- Experiences such as racing should migrate shared simulation state onto
  resources before adding higher-level particle/audio helpers.

## 0023 — Runtime Visual Parameters Flow Through Extracted Packets

Date: 2026-06-21 (procedural sky and runtime uniforms slice)

Status: accepted

Context:

The docs-site landing scene used a stack of authored mesh bands to fake a sky
gradient. That made the sky part of scene geometry, produced visible banding,
and forced runtime visual changes through material source mutation. Custom WGSL
materials also stored uniform values in source binding declarations, so
value-only updates did not have a first-class extracted runtime path.

Decision:

Visual background state and dynamic shader parameters remain ECS-authored data
that extraction turns into render snapshot packets. `ProceduralSky` is rendered
as a WebGPU fullscreen background pass with renderer-owned cached uniform
buffers, not as scene geometry. General dynamic custom WGSL values use keyed
`RuntimeUniform` packets resolved by uniform bindings with `runtimeUniformKey`.

Custom WGSL pipeline identity is based on shader source, render state, instance
layout, binding visibility, and uniform field schema. Runtime uniform values are
not part of the material source asset, prepared material pipeline key, or shader
module key. Value-only updates write cached WebGPU uniform buffers with
`queue.writeBuffer`.

Consequences:

- The renderer still consumes derived snapshots and owns GPU resources; ECS and
  app systems never store WebGPU objects.
- Background sky rendering is no longer scene geometry and can avoid banded
  material-color artifacts.
- Runtime visual value changes can happen without source asset
  re-registration, material version churn, shader module rebuilds, or pipeline
  rebuilds.
- Uniform schema/layout changes remain structural and correctly invalidate
  prepared custom WGSL material pipeline keys.
- Shared snapshot transports must either encode new packet families or fall
  back to transferable snapshots until packed encoding is extended.
