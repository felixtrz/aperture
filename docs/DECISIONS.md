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

## 0008 — Extraction-Based ECS/Render Bridge

Status: accepted

Context:

Aperture's North Star already says ECS is authoritative, rendering is derived,
assets are referenced by stable handles, GPU resources are renderer-owned, and
future worker-thread simulation must remain possible. The bridge between ECS and
the renderer needs an explicit, consistent shape to satisfy those goals:

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

Aperture adopts an extraction-based ECS/render bridge and asset/material
authoring model with these constraints:

- TypeScript-first APIs.
- WebGPU-only backend.
- Serializable `RenderSnapshot` as the worker-friendly boundary.
- 3D-only naming; render authoring components are unsuffixed, such as `Mesh`
  and `Material`.
- No public mutable scene graph as the source of truth.
- Prefer the smallest clear TypeScript shape over mechanical naming or trait
  complexity.

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
resources, bind groups, pipelines, and caches are prepared by the backend. The
same conceptual split applies between source asset, material family behavior,
extraction, and prepared render asset. Aperture expresses that split as
TypeScript data contracts that remain JSON-safe and worker-boundary-friendly.

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

Date: 2026-05-30

Context:

Specular IBL was a hand-tuned `iblSpecularProof` term
(`prefilteredColor * fresnelSchlick(NdotV, F0) * (1 - roughness*0.5)`) with no
split-sum environment-BRDF (DFG) and no energy conservation. The target is a
2-channel GGX DFG LUT sampled in the specular term, with an analytic Karis
DFGApprox as an acceptable LUT-free alternative if the LUT proves flaky.
Binding a new LUT texture at
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
- Multi-scatter energy compensation remains out of scope for this slice.

## 0018 — Physics Uses Backend-Neutral ECS Contracts First

Date: 2026-06-05

Status: accepted

Context:

Aperture is beginning the physics track. The physics plan calls for a
comprehensive, ergonomic rigidbody/collider/event/query surface, but Aperture's
architecture requires ECS authority, worker-safe snapshots, synchronous gameplay
queries, and renderer-owned WebGPU resources. The existing `SharedArrayBuffer`
transport is a render snapshot transport, not live ECS storage.

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

Date: 2026-06-06

Status: accepted

Context:

Aperture needs ECS-authored `convexHull`, `trimesh`, and `heightfield`
colliders to cook into real Rapier shapes while preserving package boundaries:
`@aperture-engine/physics` must stay backend-neutral, `@aperture-engine/physics-rapier`
must not import app/render asset registries, and render mesh assets remain source
assets rather than physics-owned scene graph nodes. The natural approach is to
let render/model meshes become convex hulls or static triangle meshes, defer
shape recreation while assets are missing, and cache mesh triangle data.

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

## 0020 — Fixed-Step Render Interpolation Is a Presentation Snapshot Rewrite

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

## 0021 — App Resources Are Typed Simulation-Owned Singletons

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

Aperture needs unique singleton-like data stored in the world and read/written
by systems, adapted to TypeScript and the current EliCS/app-context boundary.

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

## 0022 — Runtime Visual Parameters Flow Through Extracted Packets

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

## 0023 — WebXR Is Out of Scope; IWSDK Owns the Immersive Story

Date: 2026-07-12

Status: accepted

Context:

Aperture ships no WebXR support of any kind — no sessions, reference spaces,
controller or hand input. Feature comparisons against three.js (whose WebXR
stack, especially in the `super-three` fork, is the web-XR reference) read
that absence as the largest capability gap unless the intent is recorded.
The maintainer also builds IWSDK, a dedicated WebXR framework, and two
overlapping immersive runtimes from the same author would confuse positioning
and compete with each other. Technically, XR pose/input loops are main-thread
browser APIs, which sits awkwardly with Aperture's worker-authoritative
simulation boundary.

Decision:

WebXR (VR/AR sessions, XR input, XR compositor integration) is a deliberate
non-goal for Aperture. Immersive use cases are IWSDK's domain; Aperture stays
a flat-screen WebGPU runtime and does not grow an XR surface.

Consequences:

- No `navigator.xr`, session management, or XR input code anywhere in
  `packages/`.
- Feature audits must count XR absence as a rejection, not an omission (see
  `docs/THREEJS_FEATURE_AUDIT.md` §14).
- XR-shaped feature requests should be redirected to IWSDK rather than
  accepted into Aperture.
- If that positioning ever changes, this decision must be revisited first,
  including how an XR loop would cross the worker-authoritative simulation
  boundary.

## 0024 — Custom WGSL Lit Contract Is a Versioned Renderer-Owned @group(3)

Date: 2026-07-13

Status: accepted

Context:

Custom WGSL materials rendered unlit only: groups 0-2 carried the view
uniform, world transforms, and user bindings, and group(3) was reserved.
Making custom materials "real game materials" (parity plan A1, three.js
scenario "custom shader receiving scene lighting/shadows/IBL") requires the
renderer to hand shaders its lighting data without breaking the data-only
material policy (0010-0012) or letting app code touch GPU resources. Custom
pipelines also compiled with `layout: "auto"`, and auto bind-group layouts
are exclusive to their pipeline — a renderer-owned lighting bind group cannot
be shared across materials that way. Finally, whatever layout ships will be
cached into pipeline keys, so it must be able to evolve without silently
colliding with pipelines built against an older layout.

Decision:

`CustomWgslMaterialAsset` gains an opt-in `lighting: "unlit" | "lit"` field
(default `"unlit"`). When `"lit"`:

- The renderer owns `@group(3)` with a FIXED v1 layout (packed light
  storage buffers + params uniform + directional shadow matrices/map/
  comparison sampler + IBL irradiance/specular/BRDF-LUT textures + sampler),
  defined renderer-independently in `@aperture-engine/render`
  (`APERTURE_LIT_BINDING_METADATA`, documented in
  `docs/LIGHT_SHADER_WGSL_CONTRACT.md`). Bindings without a frame resource
  bind renderer-owned fallbacks (zeroed buffer, 1x1 black textures) so one
  layout works every frame; `apertureLitParams` counts/flags are the
  authoritative presence signal.
- The renderer PREPENDS `APERTURE_LIT_WGSL_HEADER` (group(3) declarations +
  `aperture*` helper functions with StandardMaterial math parity) to the
  material's WGSL module; user source declaring `@group(3)` is rejected
  (`customMaterialSource.litReservedBindGroup`).
- Lit pipelines compile against an EXPLICIT pipeline layout so the single
  renderer-owned group(3) bind group is shared across all lit custom
  materials and cached across frames; unlit materials keep `layout: "auto"`
  byte-for-byte.
- The contract is versioned: `lit:v<APERTURE_LIT_CONTRACT_VERSION>`
  participates in the material pipeline key and the extraction pipeline-key
  features ONLY when lit. A future layout change bumps the version, which
  rekeys every lit pipeline (no cache collisions) while absent/`"unlit"`
  materials keep byte-identical keys forever.

Consequences:

- Custom materials can consume lights/shadows/IBL/fog with zero app-side GPU
  wiring, and the bound resources are the SAME renderer-owned objects the
  StandardMaterial path uses (packed light buffers, auto-shadow receiver
  resources, environment IBL textures) — no duplicate resource ownership.
- The v1 surface is a deliberate subset: single directional shadow receiver
  (all filter modes evaluate as 3x3 PCF), diffuse-only rect-area
  approximation, fragment-stage helpers only. Extending it (cascade
  selection, clustered local lights, LTC area lights, vertex-stage access)
  means a v2 header + layout behind a version bump.
- Lit custom materials pay the fixed group(3) bind cost even when a frame
  has no lights/shadows/environment (fallback resources keep the pipeline
  layout stable); unlit materials pay nothing.
- The render package owns the contract constants; the WebGPU backend derives
  its layout from the same table, and a unit test pins the packing-stride
  equality so the two packages cannot drift.

## 0025 — One Realized GPU Buffer Per BufferAsset Handle@Version, Shared Across Consumers

Date: 2026-07-13

Status: accepted

Context:

Compute→draw plumbing (parity plan C1) requires a compute pass to WRITE a
buffer that the SAME frame's draw READS — as a `material.storage(...)` binding
AND as a buffer-backed instance-attribute stream — with zero CPU copies. Assets
are data-only (0016): the ECS/worker carries a `BufferAsset` handle, never a
live GPU object, and the WebGPU backend owns the realized `GPUBuffer`. For the
hand-off to be zero-copy, all three consumers plus the compute writer must bind
the IDENTICAL `GPUBuffer` object; two realizations of the same handle would
silently decouple the compute output from the draw input. The compute pass is
main-thread raw WebGPU (`app.addComputePass`) while the storage binding + the
instance stream are realized deep in the forward frame routes, so the sharing
point cannot be a single call site.

Decision:

The WebGPU backend realizes exactly ONE `GPUBuffer` per `BufferAsset`
handle@version, cached in the app resource cache (`customWgslStorageBuffers`)
keyed by `assetHandleKey(handle)@version`. Every consumer — the
`material.storage(...)` binding, the buffer-backed instance stream, and the
compute pass's `ctx.buffer(id)` resolver — resolves through the same
get-or-create (`resolveAppBufferAssetResource`); the first caller in a frame
realizes it, the rest reuse the identical object.

- A `usage: "storage"` (writable) `BufferAsset` is realized with
  `STORAGE | VERTEX | COPY_DST | COPY_SRC` so one buffer serves as a storage
  binding, an instance vertex stream, a compute read_write target, and a
  readback source. `usage: "read-only-storage"` (the default) keeps its pre-C1
  `STORAGE | COPY_DST` flags byte-for-byte.
- Ordering is a pure graph-handle-string match: the compute pass declares
  `writes: [{ handle: id }]` and the forward scene node declares `reads: [id]`
  for every writable buffer its draws consume, so the frame graph's
  writer-before-reader edge (0022's frame-graph model) orders
  compute-before-draw. The graph handle id is the buffer's registered string id
  (the same id the compute pass names), NOT the versioned cache key.
- Lifetime is the realizer's: the buffer lives across frames (one per
  handle@version); re-registering the handle bumps the version and realizes a
  fresh buffer (the old one is evicted like any versioned source resource). GPU
  float contents are renderer-owned and never round-trip to the ECS.

Consequences:

- The compute output and the draw input are guaranteed to be the same bytes
  with zero copies, on both the single-custom and mixed forward routes.
- The buffer id shares the frame-graph resource namespace with facade render
  targets; buffer ids must not collide with render-target ids (documented in
  AUTHORING.md).
- GPU-computed buffer contents are non-deterministic across adapters; they are
  never part of a determinism hash. Determinism is the CPU/ECS authoring
  (seed bytes, entity counts, dispatch schedule), which flows through the
  existing data-only asset mirror — no new snapshot packet family, so C1 does
  not refresh the determinism fixtures.

## 0026 — Per-Material Stencil State; Per-Frame Depth-Stencil Format Selection

Date: 2026-07-13

Status: accepted

Context:

Stencil was the one render state the material contract explicitly marked
unsupported (`unsupportedFeatures: "stencil"`), blocking portal/mask/outline
recipes (advanced-audit scenarios #7, #8). Adding it runs into a hard WebGPU
constraint: a render pipeline's `depthStencil.format` must EXACTLY match the
render pass's depth attachment format. The app's scene depth attachment is a
depth-only `depth24plus`; enabling stencil for even one material forces that
pass's depth attachment to a stencil-capable `depth24plus-stencil8`, and THEN
every pipeline drawing into the pass must declare the same format — the same
"all pipelines in a pass must agree" rule MSAA sample counts hit (C2). The
render state is transported to the backend by the material pipeline KEY (the
backend reconstructs alphaMode/cull/depth/blend/frontFace from the key string,
as it already does for `depth-bias`/`front-face`), not by shipping the material
asset, so byte-identity of that key for non-stencil materials is the bar every
prior parity item met.

Decision:

Stencil is a per-material `renderState.stencil` sub-state (write/func/ref/
masks/ops on ALL material kinds, built-in and custom WGSL); `unsupportedFeatures`
drops `"stencil"`. It is transported and made byte-safe exactly like the other
render state:

- PRESENCE of `renderState.stencil` is the enable gate. It appends a single
  sorted `stencil:<readMask>:<writeMask>:<reference>:<front…>:<back…>` FEATURE
  token to the material pipeline key (the trailing
  `alphaMode|cullMode|depthCompare|blend` segment is untouched, so the backend's
  `parts.length - 4` parse is unchanged). Absent stencil ⇒ no token ⇒
  byte-identical key, no depth-stencil format upgrade, unchanged determinism
  fixtures and golden pixels.
- **Depth-stencil format is selected per FRAME, not per material or per view
  (approach B, frame granularity).** When ANY material in a frame enables
  stencil, the whole frame's scene depth attachment becomes
  `depth24plus-stencil8` and every scene pipeline in the frame declares it;
  frames with no stencil keep `depth24plus`. Frame granularity (over per-view)
  guarantees every pipeline in every pass of the frame agrees on the format with
  zero risk of an intra-frame mismatch, while still keeping non-stencil frames
  untouched. The chosen format is computed once per frame from the snapshot's
  mesh-draw pipeline keys and threaded through the resource cache to the depth
  attachment, the mesh/background/overlay pipelines, and the render-bundle
  descriptor. This was chosen over "always `depth24plus-stencil8`" (approach A)
  because A changes the depth format for every existing pipeline, test, and
  golden and would have to prove behavioural inertness across all of them; B
  preserves byte-identity by construction and only pays the format change on
  frames that actually use stencil.
- The stencil `reference` is dynamic (WebGPU sets it with
  `setStencilReference`, not in the pipeline). The backend applies it on
  pipeline bind, derived from the pipeline key. Because a render-bundle encoder
  cannot set the stencil reference, stencil frames take the direct-encoder path
  (render bundles are skipped for them).
- A stencil-capable attachment requires the stencil aspect's load/store ops (or
  read-only) on the render pass; the backend mirrors the depth aspect's ops onto
  the stencil aspect only when the format carries stencil, clearing stencil to 0
  alongside a depth clear.

Consequences:

- Portal/mask/outline recipes work with per-material stencil; advanced-audit
  scenario #8 (stencil portal) qualifies and #7 (planar mirror) is partially
  unblocked (stencil masking now available; still no Reflector/clipping planes).
- Non-stencil materials and frames are byte-identical: the pipeline key gains no
  token, the depth format stays `depth24plus`, and the determinism fixtures do
  not shift.
- Declaring stencil against a depth-only target raises the cataloged
  `material.stencilRequiresStencilFormat` diagnostic and the pipeline is refused
  (loud-over-silent) rather than emitting a WebGPU device error. Out-of-range
  masks/reference raise `material.invalidStencilState` in material validation.
- `colorWriteMask` is still not plumbed to built-in materials, so a stencil-only
  MASK draw uses the "content overwrites the mask's color in the stencil region"
  technique in the shipped portal example rather than disabled color writes.

## 0027 — GTAO Deferred; SSAO Stays Byte-Identical Through E4

Date: 2026-07-13

Status: accepted

Context:

Parity plan E4 (the post-processing tail) scoped, alongside the required outline

- motion-blur + LUT trio, an OPTIONAL upgrade of the SSAO slot from the shipped
  spiral SSAO to a horizon-based GTAO (ground-truth ambient occlusion) integration
  (Jimenez et al. 2016 — per-slice horizon search + visible-cone integral). A GTAO
  shader was prototyped as a strictly opt-in `quality: "gtao"` mode: it left the
  default `quality: "ssao"` pipeline key and generated WGSL byte-identical (pinned
  by a literal-key test) and shared the SSAO effect's bindings, so it could not
  perturb any existing SSAO frame. But GTAO is subtle — the view-space position/
  normal reconstruction from depth, the slice-plane projection, and the cone
  integral are all easy to get subtly wrong — and its output could not be
  pixel-proven end-to-end in this environment (SwiftShader e2e; no GTAO example or
  golden existed, and building a correctness golden for horizon-based AO is a
  project in itself). Shipping an AO mode that "produces some darkening" without a
  correctness proof would over-claim.

Decision:

GTAO is **deferred**, not shipped. The SSAO effect (`post-ssao.ts`) is reverted
to its exact pre-E4 behavior — no `quality`/`slice*` options, no
`gtaoPostEffectWgsl`, default pipeline key and shader unchanged — and a
default-pipeline-key literal test pins that byte-identity so a future SSAO edit
is loud. E4 ships only the required, pixel-proven trio (outline, motion blur,
LUT). GTAO is recorded here and in the plan §E4 status block as a follow-up.

Consequences:

- The shipped SSAO post effect is byte-identical to pre-E4; no SSAO example,
  golden, determinism fixture, or e2e moves, and `test/e2e/ssao.spec.ts` proves
  the post stack is unregressed.
- No `quality`/GTAO surface is exposed on `createWebGpuSsaoPostEffect` or the
  public/test-support exports, so there is no half-finished API to support.
- A future GTAO follow-up must land WITH an end-to-end AO correctness proof (a
  contact-shadow pixel golden or a reference-AO comparison), not just a distinct
  pipeline key — the byte-identity-when-off bar alone is necessary but not
  sufficient to call an AO integration "working".
