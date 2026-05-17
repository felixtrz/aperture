# Handoff

## Latest Run Update

Completed `task-0773` through `task-0795` and one utility
follow-up in this automation run. This advanced the WebGPU material queue route
and app-local resource helper boundary from route-only adapters through
texture/sampler preparation, frame-resource cache slots, per-family
frame-resource helpers, shared private utilities, cache-slot regression
coverage, allocation cleanup planning, direct utility coverage, and
prepared-resource handoff planning.

Highlights:

- Added `built-in-material-queue-adapter.ts`, a route-only built-in material
  adapter factory with family/type/phase validation and focused tests.
- Updated `app.ts` to compose queued built-in routing from the route-only
  factory while keeping app-owned GPU resource closures local.
- Added a route report shell regression test that triggers two failed frames and
  verifies stale family/phase/diagnostic counts do not leak.
- Extracted app texture/sampler preparation into
  `app-texture-sampler-resources.ts` with explicit assets/device/cache/reuse
  inputs.
- Added `built-in-material-app-resource-adapter.ts`, an internal shell that
  composes route adapters with caller-provided resource callbacks.
- Replaced nullable per-family frame caches with explicit cache slots, then
  extracted unlit, Matcap, and Standard app frame-resource create/reuse helpers
  into separate WebGPU modules.
- Extracted private `app-frame-resource-utils.ts` for `sameStringList` and
  `writeBufferData`.
- Tightened the three-family app reuse regression so unlit, Matcap, and
  Standard resource cache hits are verified through second-frame app reports
  without exposing cache internals.
- Added
  `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md`
  to identify remaining steady-state helper allocations and concrete cleanup
  slices.
- Added direct tests for private app frame-resource utilities while confirming
  they remain absent from the public WebGPU package surface.
- Added
  `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
  to define the staged handoff from app-local material frame resources toward a
  WebGPU-owned prepared material resource cache.
- Added plans/audits for app-local resource splitting, texture/sampler
  boundaries, frame-resource reuse, unlit/Standard boundaries, shared utilities,
  hot-path allocation cleanup, prepared material resource handoff, and the full
  frame-resource extraction sequence.
- Refilled the ready backlog with `task-0796` through `task-0801`; next
  recommended task is `task-0796`.

Validation:

- Focused Vitest runs for built-in route adapter, app resource adapter, WebGPU
  app route/reuse/cache-slot tests, and app frame-resource utility tests.
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 220 Vitest files / 1008 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
  `docs/RENDER_ASSET_PREPARATION.md`, and current WebGPU app material queue /
  frame-resource helpers.
- three.js `WebGLRenderLists` reusable render item/list pattern.
- PlayCanvas `Layer` visible opaque/transparent list and sort-mode pattern.

Known issues / follow-ups:

- The extracted frame-resource helpers still allocate descriptor/result wrappers
  on cache-hit success paths. `task-0797` through `task-0799` split that cleanup
  into descriptor scratch, light-pack scratch, and reusable success-result
  shells.
- The app facade still owns queued resource-set assembly and pipeline/layout
  selection. That is acceptable for the proof point, and `task-0795` documented
  the handoff toward render-world/prepared-material resource contracts.
  `task-0796` should audit the current path before the implementation follow-ups
  start.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/APP_*RESOURCE*2026_05_17.md`
- `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md`
- `docs/research/BUILT_IN_MATERIAL_ADAPTER_FACTORY_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/FRAME_RESOURCE_REUSE_HELPER_EXTRACTION_PLAN_2026_05_17.md`
- `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/STANDARD_APP_FRAME_RESOURCE_*2026_05_17.md`
- `docs/research/UNLIT_APP_FRAME_RESOURCE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`
- `test/webgpu/app-frame-resource-utils.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0743` through `task-0772` in this automation run. This advanced
two tracks: GLB combined fixture diagnostics and the WebGPU material queue route
reporting/adapter-helper boundary.

Highlights:

- Added combined GLB fixture JSON coverage and unresolved-material diagnostics
  coverage without crossing into render extraction or WebGPU.
- Added
  `docs/research/GLB_COMBINED_FIXTURE_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`;
  no boundary drift was found in the combined fixture diagnostics.
- Planned the generic material-family queue contract, then added/exported the
  queued material adapter registry helper with duplicate-family diagnostics and
  JSON-safe inspection helpers.
- Added `createWebGpuAppMaterialQueueRouteReport`, JSON helpers, and diagnostic
  aggregation for queued/routed/skipped counts by material family and render
  phase.
- Extracted built-in material queue family and phase diagnostics helpers, then
  updated `createWebGpuApp` to use the shared helpers without changing the
  supported family/phase matrix.
- Wired failure-only `webGpuApp.materialQueueRouteReport` diagnostics into
  queued built-in app routing. Existing specific diagnostics remain first; the
  aggregate report is appended only on route failure.
- Added successful queued unlit/matcap/StandardMaterial assertions proving route
  reports are not emitted by default on successful renders.
- Tightened route report JSON projection so omitted optional fields stay
  omitted and `null` blend presets remain explicit.
- Added a reusable material queue route report shell writer/reset API, then
  updated app failure projection to use the shell stored in queued route scratch.
- Added app coverage for `webGpuApp.materialQueueAssetMismatch` route reports
  using a crafted snapshot that keeps ECS-authored assets real while forcing a
  mismatched pipeline family.
- Planned the route-only built-in material adapter registry factory extraction.
- Added audits/plans for queued material adapter boundaries, route report
  boundaries, built-in helper boundaries, failure-only app report wiring, app
  integration, and a future reusable route report shell.
- Refilled the ready backlog with `task-0773` through `task-0777`; next
  recommended task is `task-0773 — Add built-in material route adapter factory`.

Validation:

- Focused Vitest runs passed for GLB combined fixture JSON/unresolved-material
  coverage.
- Focused Vitest runs passed for queued material adapter helpers/JSON helpers.
- Focused Vitest runs passed for material queue route reports, route report JSON
  projection, diagnostic aggregation, shell reuse, built-in material queue
  helpers, and WebGPU app route diagnostics/successful queued paths.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 217 Vitest files / 997 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, current WebGPU app
  material queue routing, route report helpers, and GLB fixture helpers.
- Bevy glTF sub-asset loading and per-node primitive scene spawning from the
  earlier GLB fixture track.
- three.js `WebGLRenderLists` reusable render item/phase bucket pattern.
- PlayCanvas `Layer` opaque/transparent culled list and sort-mode pattern.

Known issues / follow-ups:

- Route report success-path summaries are still intentionally absent. Add an
  explicit diagnostics option before exposing successful route summaries.
- Built-in adapter extraction has been started with family/phase helpers and a
  route-only registry factory plan. GPU resource preparation closures still
  belong in `app.ts`; `task-0773` should add the route-only factory first.
- Combined GLB fixture work remains pre-render: it does not run transform
  resolution, render extraction, render-world preparation, or WebGPU.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/*QUEUE*2026_05_17.md`
- `docs/research/*ROUTE*2026_05_17.md`
- `docs/research/GLB_COMBINED_FIXTURE_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `packages/render/src/assets/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-family.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-phase.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `test/assets/gltf-combined-import-*.test.ts`
- `test/assets/gltf-source-registration-orchestration*.test.ts`
- `test/webgpu/*material-queue*.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0675` through `task-0701` in this automation run. The latest
slice advanced the GLB mesh/material source pipeline from planning through
primitive mapping, scene traversal, accessor validation, typed-array decoding,
mesh source asset construction, primitive material resolution, JSON coverage,
boundary audits, and mesh handle-key normalization for upcoming registration.

Highlights:

- Added GLB mesh primitive mapping, scene traversal diagnostics, accessor/buffer
  validation, typed-array decoding, mesh source asset construction, and
  primitive material resolution helpers under `packages/render/src/assets`.
- Added JSON-safe report projections/tests for mesh primitive mapping, scene
  traversal, accessor validation, accessor decoding, mesh construction, and
  primitive material resolution.
- Added focused audits for mesh mapping, scene traversal, accessor validation,
  accessor decoding, mesh construction, and material resolution boundaries.
- Planned the next mesh source asset registration step and normalized mesh
  construction reports so `handleKey` is the planned mesh id while
  `registeredHandleKey` is the full `mesh:` handle key.
- Refilled the ready backlog with `task-0702` through `task-0706`.

Validation:

- Focused Vitest runs for each new GLB helper/test slice.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 194 Vitest files / 913 tests.

Reference files/patterns inspected:

- Bevy glTF primitive, node/scene, and sub-asset loading patterns in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`,
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`,
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`, and
  `references/bevy/crates/bevy_gltf/src/vertex_attributes.rs`.
- three.js `GLTFLoader` accessor/geometry/material/default-material loading
  patterns.
- PlayCanvas `glb-parser` accessor flattening, primitive creation, and index
  handling patterns.
- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/research/MESH_GEOMETRY_COVERAGE.md`, existing
  `MeshAsset` contracts, and source asset registration helpers.

Known issues / follow-ups:

- Next recommended task: `task-0702 — Add GLB mesh source asset registration
helper`.
- Mesh source asset construction is source-data-only; mesh assets are not yet
  registered.
- Primitive material resolution is report-driven; it does not create default
  materials or inspect the registry directly.
- ECS authoring remains blocked until mesh source asset registration and stable
  mesh/material handle resolution are both available.
- Matrix node transforms remain diagnostic/preserved data until Aperture has a
  tested matrix decomposition helper.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/*GLB*2026_05_17.md`
- `packages/render/src/assets/gltf-accessor-decoding.ts`
- `packages/render/src/assets/gltf-accessor-validation.ts`
- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/index.ts`
- `test/assets/gltf-*-json.test.ts`
- `test/assets/gltf-*.test.ts`

## Previous Run Update

Completed `task-0675` through `task-0679` in this automation run:

- `task-0675` — Added
  `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`,
  defining the smallest GLB mesh primitive mapping report, deterministic mesh
  handle ids, reference-validation vs decoding boundaries, supported
  `POSITION`/`NORMAL`/`TEXCOORD_0`/indices scope, unsupported primitive modes,
  JSON expectations, and non-goals.
- `task-0676` — Added `createGltfMeshPrimitiveMappingReport` in
  `packages/render/src/assets/gltf-mesh-primitive.ts`. The helper validates
  glTF mesh/primitive references, emits deterministic planned mesh handle keys,
  reports missing/invalid primitive data, leaves unresolved accessor data as a
  warning with `mesh: null`, and does not decode buffers or create ECS commands.
- `task-0677` — Added JSON fixture coverage for GLB mesh primitive mapping
  reports, including future `MeshAsset` summary behavior so typed arrays are not
  embedded in JSON output.
- `task-0678` — Added
  `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`,
  defining scene selection, deterministic scene/node entity keys, parent
  relationships, transform payload validation, cycle diagnostics, and matrix
  decomposition deferral before ECS authoring.
- `task-0679` — Added
  `docs/research/GLB_MESH_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`. The audit
  found no ECS/WebGPU/browser ownership drift in the new mesh mapping work.
- Refilled the ready backlog with `task-0680` through `task-0684`; next
  recommended task is `task-0680 — Add GLB scene traversal diagnostics report
skeleton`.

Validation:

- `pnpm run format:check`
- `pnpm exec vitest run test/assets/gltf-mesh-primitive.test.ts`
- `pnpm exec vitest run test/assets/gltf-mesh-primitive.test.ts test/assets/gltf-mesh-primitive-json.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed, including 184 Vitest files / 886 tests.

Reference files/patterns inspected:

- Bevy glTF primitive sub-asset loading, node asset loading, cycle checks, scene
  world spawning, and primitive topology mapping in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs` and
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`.
- Bevy scene transform helpers in
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`.
- three.js `GLTFLoader` primitive geometry loading, primitive mode handling,
  attribute/index dependency loading, and bounds behavior.
- PlayCanvas `glb-parser` mesh primitive creation, primitive mode handling, and
  index format behavior.
- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`,
  `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`,
  `docs/research/MESH_GEOMETRY_COVERAGE.md`, and
  `packages/simulation/src/transform/components.ts`.

Known issues / follow-ups:

- GLB mesh primitive mapping is reference-only for now. It does not decode
  accessors or construct ready `MeshAsset`s.
- Scene/node traversal is planned but not yet implemented.
- ECS authoring remains blocked on scene traversal diagnostics, accessor/buffer
  validation, mesh source registration, material resolution, and transform
  command planning.
- Matrix node transforms should remain diagnostic/preserved data until Aperture
  has a tested matrix decomposition helper.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/GLB_MESH_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `packages/render/src/assets/index.ts`
- `test/assets/gltf-mesh-primitive.test.ts`
- `test/assets/gltf-mesh-primitive-json.test.ts`

## Previous Run Update

Completed `task-0643` through `task-0674` in this automation run:

- `task-0643` — Added an internal queued built-in material adapter contract in
  the WebGPU app route. Texture/sampler preparation, frame-resource creation,
  and family bucket insertion now dispatch through adapters for unlit,
  MatcapMaterial, and StandardMaterial.
- `task-0644` — Tightened material dependency diagnostics so texture and sampler
  readiness include dependency kind, texture/sampler keys, and status. Standard
  extraction now blocks failed textures and missing samplers before queuing.
- `task-0645` — Audited StandardMaterial PBR texture expectations against
  glTF/three.js, PlayCanvas, and Bevy. The audit confirmed no ownership drift
  and identified sampler conversion and texture-transform preservation as the
  next GLB blockers.
- `task-0646` — Promoted WebGPU validation warning/error console guards into a
  shared E2E helper and applied it to Standard queue phase and material showcase
  browser specs.
- `task-0647` — Audited queued material adapter integration and confirmed the
  route remains `RenderSnapshot`/`MaterialQueueItem` driven with WebGPU-owned
  resources.
- `task-0648` — Extracted the queued material adapter registry into
  `packages/webgpu/src/webgpu/queued-material-adapter.ts`.
- `task-0649` — Added optional `MaterialTextureTransform` metadata, Standard
  readiness diagnostics for non-identity texture transforms, and extraction
  blocking before WebGPU preparation.
- `task-0650` — Added glTF sampler enum mapping into `SamplerAsset` source data
  with JSON-safe diagnostics for malformed wrap/filter values.
- `task-0651` — Added
  `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`, defining the
  smallest renderer-independent GLB material mapper contract.
- `task-0652` — Added `createMaterialAssetFromGltfMaterial`, a
  renderer-independent mapper from glTF-like material JSON into
  `StandardMaterialAsset` or `UnlitMaterialAsset` using caller-provided
  texture/sampler handle resolution.
- `task-0653` — Audited GLB sampler/material/texture-transform readiness.
  Fixed malformed `extensions` and `pbrMetallicRoughness` values so they now
  emit `gltfMaterial.invalidField` diagnostics instead of silently defaulting.
- `task-0654` — Added GLB material alpha/cull edge coverage and tightened
  `alphaCutoff` validation.
- `task-0655` — Extended the material texture resolver contract so
  resolver-provided diagnostics distinguish missing texture vs sampler
  dependencies.
- `task-0656` — Planned minimal GLB texture/image mapping, keeping image
  decoding, URI fetching, registry mutation, ECS authoring, and WebGPU upload
  out of scope.
- `task-0657` — Added `createTextureAssetFromGltfTexture`, a source-data helper
  for glTF texture/image/sampler metadata with caller-owned decoded image data.
- `task-0658` — Audited GLB material/texture helper boundaries; no drift found.
- `task-0659` — Added a test-only fixture that feeds texture mapping reports
  into material resolver results without registering assets.
- `task-0660` — Added `validateGltfRootForAssetMapping` for glTF 2.0 root
  validation, mapper array shape checks, and unsupported required root
  extension diagnostics.
- `task-0661` — Documented how root, texture, sampler, and material diagnostics
  compose before registry mutation.
- `task-0662` — Added JSON fixture tests for material, sampler, and texture
  helper reports.
- `task-0663` — Audited the root/material/texture helper set; no boundary drift
  found.
- `task-0664` — Planned the minimal GLB asset mapping orchestration report.
- `task-0665` — Added `createGltfAssetMappingReport`, which validates root JSON,
  maps material-referenced textures, plans deterministic source-asset handle
  keys, and maps materials through the resolver boundary.
- `task-0666` — Added orchestration report JSON tests and ensured nested texture
  payloads are summarized rather than embedded as raw bytes.
- `task-0667` — Documented orchestration report diagnostics and the later
  registry handoff point.
- `task-0668` — Audited the orchestration report boundary; no registry, ECS, or
  WebGPU drift found.
- `task-0669` — Planned the GLB source asset registry registration contract,
  including write order, duplicate-key behavior, partial failures, material
  dependency edges, handle normalization, and JSON report expectations.
- `task-0670` — Added `registerGltfSourceAssetsFromMappingReport`, which writes
  successful texture, sampler, and material source assets from a
  `GltfAssetMappingReport` into an `AssetRegistry` as ready source assets.
- `task-0671` — Added JSON fixture coverage for GLB source asset registration
  reports, including written/skipped handle keys, duplicate diagnostics, and
  raw-byte omission.
- `task-0674` — Added dependency edge coverage proving material registry entries
  depend on texture/sampler handles, pre-existing duplicates can satisfy those
  dependencies, and missing dependencies skip material registration.
- `task-0672` — Planned the GLB ECS authoring command handoff and explicitly
  blocked implementation until mesh handles, node traversal, transform mapping,
  and primitive/material resolution exist.
- `task-0673` — Audited the source asset registry handoff; no ECS, WebGPU,
  image decode, or renderer ownership drift found.

Validation:

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts test/e2e/materials-showcase.spec.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/materials/gltf-sampler.test.ts test/materials/gltf-material.test.ts test/materials/material-dependency-readiness.test.ts test/materials/standard-texture-readiness.test.ts test/rendering/extraction.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/assets/gltf-asset-mapping-json.test.ts test/assets/gltf-asset-mapping.test.ts test/assets/gltf-root.test.ts test/materials/gltf-report-json.test.ts test/materials/gltf-material-texture-integration.test.ts test/materials/gltf-texture.test.ts test/materials/gltf-material.test.ts test/materials/gltf-sampler.test.ts`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- `pnpm run build`
- `pnpm run lint`
- `pnpm exec vitest run test/assets/gltf-source-registration.test.ts test/assets/gltf-source-registration-json.test.ts test/assets/gltf-source-registration-dependencies.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run check` passed, including 182 Vitest files / 880 tests.

Reference files/patterns inspected:

- three.js `GLTFLoader` sampler, `KHR_materials_unlit`, material mapping, alpha,
  and texture-transform handling.
- PlayCanvas `glb-parser` sampler/material/texture-transform mapping.
- Bevy glTF material loading, `ImageSamplerDescriptor`, texture sampler mapping,
  material cull-mode behavior, image loading, asset-source pattern, and
  sub-asset labeling.
- three.js/PlayCanvas/Bevy dependency orchestration patterns for texture,
  sampler, material, and asset planning.
- Aperture anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/MEDIUM_LONG_TERM_GOALS.md`,
  `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`,
  `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`,
  `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`,
  `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`.

Recommended next task:

- `task-0675 — Plan minimal GLB mesh primitive source asset mapping`.

Known issues / follow-ups:

- Texture-transform metadata is preserved and diagnosed, but current material
  shaders do not render non-identity transforms.
- GLB material mapping depends on caller-provided texture/sampler handle
  resolution; texture/image asset mapping is still a future slice.
- GLB helpers must stay renderer-independent until broader asset loading,
  ECS authoring, and WebGPU preparation each have explicit contracts.
- Source asset registration is now implemented for material-referenced texture,
  sampler, and material plans, but mesh handles do not exist yet.
- ECS authoring remains blocked on mesh primitive source mapping, scene/node
  traversal diagnostics, and transform mapping.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/GLB_SAMPLER_TEXTURE_TRANSFORM_READINESS_AUDIT_2026_05_17.md`
- `docs/research/GLB_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_MATERIAL_TEXTURE_INTEGRATION_DIAGNOSTICS_2026_05_17.md`
- `docs/research/GLB_ORCHESTRATION_REPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_ORCHESTRATION_REPORT_DIAGNOSTICS_2026_05_17.md`
- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/GLB_REGISTRY_HANDOFF_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_ROOT_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_ASSET_MAPPING_ORCHESTRATION_REPORT_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_TEXTURE_IMAGE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/QUEUED_MATERIAL_ADAPTER_INTEGRATION_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-root.ts`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `test/assets/gltf-asset-mapping-json.test.ts`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/assets/gltf-root.test.ts`
- `test/assets/gltf-source-registration-dependencies.test.ts`
- `test/assets/gltf-source-registration-json.test.ts`
- `test/assets/gltf-source-registration.test.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/e2e/standard-queue-phases.spec.ts`
- `test/e2e/webgpu-status.ts`
- `test/materials/gltf-material-texture-integration.test.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/gltf-report-json.test.ts`
- `test/materials/gltf-sampler.test.ts`
- `test/materials/gltf-texture.test.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`

## Previous Run Update

Completed `task-0636`, `task-0637`, `task-0638`, `task-0639`, `task-0640`,
`task-0641`, and `task-0642` in this automation run:

- `task-0636` — Built-in WebGPU pipeline descriptor plans and browser
  descriptors now derive cull mode, depth compare/write behavior, and blend
  target state from material render-state pipeline-key tokens. Added shared
  helpers in `packages/webgpu/src/webgpu/material-render-state.ts` and exported
  them from the WebGPU package.
- `task-0637` — The WebGPU app queue route now accepts StandardMaterial
  `alpha-test` items after opaque items. Unsupported alpha-test material
  families remain diagnostic-only and JSON-safe.
- `task-0638` — The WebGPU app queue route now accepts StandardMaterial
  transparent alpha-blend items when the blend preset is `alpha` and depth
  writes are disabled. Transparent snapshot sorting now prioritizes
  back-to-front depth before pipeline/material grouping.
- `task-0639` — Added `examples/standard-queue-phases.html` and Playwright
  coverage proving opaque, alpha-test, and transparent StandardMaterial queue
  phases render through `createWebGpuApp` with deterministic pixels and
  JSON-safe frame diagnostics.
- `task-0640` — Audited the expanded phase route. The route remains
  snapshot-derived and queue-driven with WebGPU-owned resources. The audit
  found and fixed a browser WebGPU auto-layout issue: StandardMaterial light
  bind groups are now scoped per pipeline key so opaque/mask/blend pipelines do
  not reuse group-3 bind groups created from another pipeline layout.
- `task-0641` — Added a focused Playwright console guard to the Standard queue
  phase spec so WebGPU command-buffer and auto-layout validation warnings fail
  the browser test before pixel assertions.
- `task-0642` — Added
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`,
  defining the smallest internal adapter contract for generic material-family
  queue routing while keeping `RenderSnapshot` as the boundary and GPU handles
  inside `packages/webgpu`.
- Corrected the automation work-window documentation and stop-hook continuation
  reason to the actual 55-minute gate. The hook's conditional already blocked
  before minute 55; the emitted JSON reason and local agent prompts were stale.
- Updated `agent/BACKLOG.md` to make the next higher-level focus explicit:
  finish the generic renderer/material architecture spine before prioritizing
  IBL, shadows, or GLB viewer work. The backlog now estimates roughly 18-24
  focused tasks for a credible lit glTF render pipeline, plus another 6-10 if
  "complete" includes environment-lit and shadowed PBR.
- Backlog was corrected and refilled with `task-0643` through `task-0647`,
  avoiding duplicate PBR texture work already completed in earlier runs.

Validation:

- `pnpm exec vitest run test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-pipeline.test.ts test/webgpu/unlit-pipeline-descriptor.test.ts test/webgpu/unlit-pipeline.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts test/webgpu/matcap-pipeline.test.ts test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/snapshot.test.ts test/rendering/material-queue.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json` after the browser warning
  guard
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run format:check` after the generic queue contract plan
- `bash -n scripts/codex-stop-hook.sh`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed: 171 test files / 837 tests.

Reference files/patterns inspected:

- `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`.
- Bevy `references/bevy/crates/bevy_pbr/src/pbr_material.rs` and render phase
  queue/sort patterns.
- three.js `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`,
  `references/three.js/src/renderers/common/Renderer.js`, and
  `references/three.js/src/renderers/common/RenderList.js`.
- PlayCanvas `references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`
  and `references/engine/src/scene/mesh-instance.js`.
- Aperture anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `packages/render/src/rendering/material-queue.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `packages/webgpu/src/webgpu/app.ts`.

Recommended next task:

- `task-0643 — Add generic queued material resource adapter contract`.

Known issues / follow-ups:

- Non-opaque phase consumption remains intentionally limited to
  StandardMaterial. Unlit, MatcapMaterial, and DebugNormalMaterial alpha/transparent
  phases should stay diagnostic-only until each family has defined shader
  behavior and browser pixel coverage.
- Generic material-family queue routing is still future work; the current app
  route remains built-in-family specific.
- StandardMaterial PBR texture paths have prior browser coverage from earlier
  runs, but the next audit should still compare current behavior against glTF
  expectations before GLB material mapping expands.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `AGENTS.md`
- `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`
- `agent/STOP_CONDITIONS.md`
- `agent/WAKE.md`
- `examples/standard-queue-phases.html`
- `examples/standard-queue-phases.js`
- `package.json`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-render-state.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline.ts`
- `scripts/STOP_HOOK_PROMPT.md`
- `scripts/codex-stop-hook.sh`
- `test/e2e/standard-queue-phases.spec.ts`
- `test/rendering/snapshot.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-pipeline.test.ts`
- `test/webgpu/unlit-pipeline-descriptor.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0621`, `task-0626`, `task-0629`, and `task-0628` in this
automation run:

- `task-0621` — `createWebGpuApp.render()` now routes multi-resource opaque
  built-in material frames through the generic material queue instead of the
  previous pairwise/three-family mixed route branches. The optimized multi-unlit
  fallback remains for same-mesh unlit materials, while mixed unlit, Matcap, and
  StandardMaterial frames now consume queue items, prepare WebGPU-owned
  resources per family, resolve prepared mesh/material resource keys, and feed
  the existing render-frame plan.
- Added focused app coverage for a single frame containing unlit,
  MatcapMaterial, scalar StandardMaterial, and textured StandardMaterial queue
  items.
- `task-0626` — audited the queue-driven app route in
  `docs/research/QUEUE_DRIVEN_APP_ROUTING_AUDIT_2026_05_17.md`. The audit
  confirms the route stays ECS-authoritative, snapshot-derived, WebGPU-owned
  for GPU resources, JSON-safe, and free of hidden scene graph behavior.
- Added ready follow-ups `task-0628` and `task-0629` so the backlog remains
  above five ready tasks and captures queue-route scratch reuse plus explicit
  unsupported-family/phase diagnostics coverage.
- `task-0629` — Added app-level tests for unsupported material queue families
  and unsupported non-opaque queue phases. Both cases produce JSON-safe
  diagnostics and avoid WebGPU submission.
- `task-0628` — Added reusable queue-route scratch maps/arrays to
  `WebGpuAppFrameScratch` and extended the queued mixed-material app test to
  render a second frame, proving scratch reuse does not leak stale resource
  keys.
- Added ready follow-ups `task-0630` and `task-0631` to keep queue-route cleanup
  and future alpha-test/transparent phase consumption explicit.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts test/webgpu/render-frame-plan.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run check` passed: 169 test files / 813 tests.
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts` passed after
  `task-0628`/`task-0629`: 27 tests.

Reference files/patterns inspected:

- Bevy render phase queue/sort:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- three.js render list sorting:
  `references/three.js/src/renderers/common/RenderList.js`,
  `references/three.js/src/renderers/WebGLRenderer.js`.
- PlayCanvas layer/material sorting:
  `references/engine/src/scene/layer.js`,
  `references/engine/src/scene/constants.js`,
  `references/engine/src/scene/mesh-instance.js`.
- Aperture anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `docs/research/OPAQUE_MATERIAL_QUEUE_APP_ROUTING_PLAN_2026_05_17.md`,
  `packages/render/src/rendering/material-queue.ts`,
  `packages/webgpu/src/webgpu/render-frame-plan.ts`.

Recommended next task:

- `task-0624 — Add StandardMaterial normal-map shader support`.

Known issues / follow-ups:

- StandardMaterial normal maps are still diagnostic-only. `task-0624` should
  implement tangent-space sampling without regressing existing texture variants.
- Generic prepared material descriptors remain future work in `task-0625`.
- Single-family app frames still use the existing single-family/multi-unlit
  paths. `task-0630` tracks routing them through the material queue without
  cache regressions.
- Alpha-test and transparent app queue items are diagnosed, not consumed.
  `task-0631` tracks the implementation plan for phase consumption.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/QUEUE_DRIVEN_APP_ROUTING_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0617`, `task-0618`, `task-0619`, `task-0620`, `task-0622`,
and `task-0623` in this automation run:

- `task-0617` — StandardMaterial now supports metallic-roughness textures in
  WebGPU shaders and pipeline specialization. Roughness uses the green channel,
  metallic uses the blue channel, and both multiply authored scalar factors.
- `task-0618` — StandardMaterial normal maps now have renderer-independent
  tangent readiness diagnostics. Extraction blocks authored normal-map draws
  without required tangent metadata, while actual normal-map shading remains
  deferred.
- `task-0619` — Added a generic material-family queue contract in
  `@aperture-engine/render`. Queue items are plain snapshot-derived data with
  material family, pipeline/resource keys, phase, draw index, and sort data; no
  WebGPU handles are carried.
- `task-0620` — StandardMaterial now supports emissive and occlusion textures.
  Emissive textures multiply `emissiveFactor`; occlusion textures use red
  channel plus `occlusionStrength` to affect ambient/indirect contribution
  without changing direct light math.
- `task-0622` — Audited the queue/PBR texture work and recorded the result in
  `docs/research/MATERIAL_QUEUE_PBR_TEXTURE_AUDIT_2026_05_17.md`.
- `task-0623` — Added focused material queue tests proving opaque, alpha-test,
  and transparent phase ordering, including back-to-front transparent sorting
  and stable order for identical transparent keys.
- Added ready follow-up `task-0627` so the backlog remains above five ready
  tasks and captures a glTF PBR texture expectation audit before GLB material
  mapping resumes.

Validation:

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-bind-group.test.ts test/webgpu/webgpu-app.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm exec vitest run test/materials/standard-normal-map-readiness.test.ts test/rendering/extraction.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts`
- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts test/materials/standard-proof-point.test.ts test/webgpu/webgpu-app.test.ts test/rendering/material-queue.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm run check` passed after `task-0619`: 169 test files / 807 tests.
- `pnpm run check` passed after `task-0620`: 169 test files / 811 tests.
- `pnpm run test:e2e` passed after the stop-hook continuation: 142 Playwright
  tests.

Reference files/patterns inspected:

- Bevy render phase queue/sort:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- Bevy StandardMaterial/PBR texture handling:
  `references/bevy/crates/bevy_pbr/src/pbr_material.rs`,
  `references/bevy/crates/bevy_pbr/src/render/pbr_bindings.wgsl`,
  `references/bevy/crates/bevy_pbr/src/render/pbr_fragment.wgsl`.
- three.js and PlayCanvas PBR texture handling:
  `references/three.js/src/renderers/shaders/ShaderChunk/metalnessmap_fragment.glsl.js`,
  `references/three.js/src/renderers/shaders/ShaderChunk/roughnessmap_fragment.glsl.js`,
  `references/three.js/src/renderers/shaders/ShaderChunk/emissivemap_fragment.glsl.js`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/scene/materials/standard-material.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/normalMap.js`.
- Aperture audit anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`.

Recommended next task:

- `task-0621 — Integrate opaque material queue app routing`.

Task 0621 prep notes:

- The new queue contract is in `packages/render/src/rendering/material-queue.ts`
  and exported through `packages/render/src/rendering/index.ts`.
- App routing is still narrow and branch-shaped in `packages/webgpu/src/webgpu/app.ts`.
  Do not add more pairwise material-family branches. Replace opaque unlit,
  MatcapMaterial, and StandardMaterial routing with queue-driven resource
  resolution/consumption.
- Existing showcase coverage now exercises StandardMaterial base-color,
  metallic-roughness, occlusion, and emissive texture bindings through
  `createWebGpuApp`.

Known issues:

- `task-0621` is still pending. Mixed material app routing remains a temporary
  bridge until queue consumption replaces the branch-specific paths.
- StandardMaterial normal maps are still diagnostic-only. Tangent-space normal
  shading should wait for `task-0624`.
- Transparent queue sort coverage is now in place; transparent render-state
  validation and app consumption are still future work.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/MATERIAL_QUEUE_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `examples/materials-showcase.js`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-normal-map-readiness.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/index.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/materials/standard-normal-map-readiness.test.ts`
- `test/materials/standard-proof-point.test.ts`
- `test/rendering/extraction.test.ts`
- `test/rendering/material-queue.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the mixed built-in material app route and promoted the material
showcase onto the app facade:

- `task-0602` — `createWebGpuApp.render()` now supports mixed StandardMaterial
  frames with either unlit or Matcap materials when source dependencies and
  Standard lights are ready.
- `task-0603` — the app diagnostics example now covers mixed material
  dependency readiness failures and a successful mixed material render with
  JSON-safe browser status.
- `task-0604` — textured unlit materials can participate in mixed unlit/Matcap
  app frames when texture and sampler source dependencies are ready.
- `task-0606` — audited mixed material app routing and recorded the findings in
  `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`.
- `task-0607` — added the three-family mixed route for one unlit, one
  StandardMaterial, and one MatcapMaterial draw in a shared-mesh app frame.
- `task-0583` — replaced the direct WebGPU material showcase shader with an
  ECS-authored `createWebGpuApp` example using typed mesh/material/texture/
  sampler assets, camera/lights, `SpinSystem`, and app render reports.
- `task-0605` — audited the promoted showcase and recorded the findings in
  `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`.
- `task-0608` — added StandardMaterial base-color texture dependency app
  diagnostics in mixed-material frames and exposed the same path in the browser
  diagnostics example.
- `task-0609` — added renderer-independent DebugNormalMaterial preparation
  metadata with stable material/pipeline keys, JSON-safe dependency readiness,
  and render-state validation.
- `task-0610` — documented `createWebGpuApp`, ECS-authored entities, typed
  assets, and systems as the default browser application path while keeping
  direct WebGPU helpers as backend/test surfaces.
- `task-0611` — planned the first renderer-independent GLB container slice and
  explicitly deferred GLB material mapping/viewer work until StandardMaterial
  PBR and the generic material queue are ready.
- `task-0612` — audited the post-showcase material app route and confirmed the
  current pairwise/three-family helpers are still a safe narrow bridge, but
  should be replaced by a generic material-family queue after the near-term
  StandardMaterial PBR texture slices.
- `task-0613` — added a package-boundary guard script that fails if headless
  packages import `@aperture-engine/webgpu`, declare it as a dependency, or
  reference browser WebGPU globals in source files.
- `task-0614` — added DebugNormalMaterial WebGPU shader metadata and descriptor
  planning contracts, including normal-to-RGB WGSL, view/world/material binding
  metadata, pipeline cache-key planning, and JSON-safe diagnostics for invalid
  topology/layout inputs.
- `task-0615` — added StandardMaterial base-color texture rendering through a
  specialized WebGPU shader/pipeline variant, app texture/sampler preparation,
  pipeline cache-key specialization, and focused tests for resource reuse and
  group-2 texture/sampler binding. The material showcase Standard cube now uses
  a base-color texture, and Playwright verifies the textured browser path with
  real pixels.
- `task-0616` — added a renderer-independent GLB 2.0 container parser with
  JSON-safe diagnostics, JSON/BIN chunk extraction, unknown chunk warnings, and
  no WebGPU, image decoding, ECS authoring, or glTF material/scene mapping.
- Corrective detail: mixed-family frames now scope shared group-0/group-1 bind
  groups by pipeline key before render-frame resource planning. This prevents
  one material family's view/world bind group from satisfying another pipeline's
  resource key and was necessary for real browser pixels.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm run check:examples`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts test/e2e/materials-showcase.spec.ts`
- `pnpm run check` passed: 162 test files / 771 tests after `task-0608`.
- `pnpm run test:e2e` passed after `task-0608`: 142 Playwright tests.
- `pnpm exec vitest run test/materials/debug-normal-preparation.test.ts test/materials/materials.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed after `task-0609`: 163 test files / 775 tests.
- `pnpm run format:check`
- `pnpm run check:examples`
- `pnpm exec vitest run test/tooling/package-boundary-guard.test.mjs`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm exec vitest run test/webgpu/debug-normal-shader.test.ts test/webgpu/debug-normal-pipeline-descriptor.test.ts test/webgpu/material-pipeline-selection.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-bind-group.test.ts test/webgpu/webgpu-app.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run check` passed after `task-0615`: 166 test files / 786 tests.
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm run test:e2e` passed after the showcase base-color texture update: 142
  Playwright tests.
- `pnpm exec vitest run test/assets/glb-container.test.ts`
- `pnpm exec vitest run test/assets/glb-container.test.ts test/assets/render-asset-preparation.test.ts test/assets/dependencies.test.ts test/assets/registry.test.ts test/assets/typed-collections.test.ts`
- `pnpm run build`
- `pnpm run check` passed after `task-0616`: 167 test files / 791 tests.

Reference files/patterns inspected:

- Bevy material/render-asset patterns:
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_render/src/render_asset.rs`.
- Existing Aperture app/material paths:
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/materials/types.ts`,
  `packages/render/src/materials/dependency-readiness.ts`,
  `packages/render/src/materials/debug-normal-preparation.ts`.
- Promoted examples/tests:
  `examples/app-diagnostics.js`, `examples/materials-showcase.html`,
  `examples/materials-showcase.js`, `test/e2e/app-diagnostics.spec.ts`,
  `test/e2e/materials-showcase.spec.ts`, `test/webgpu/webgpu-app.test.ts`.
- Project docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`.
- GLB planning references:
  `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/framework/parsers/glb-container-parser.js`,
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`,
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.
- Post-showcase material route audit:
  `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`,
  `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`,
  `packages/webgpu/src/webgpu/app.ts`, `test/webgpu/webgpu-app.test.ts`,
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- Package-boundary guard:
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, root and package
  `package.json` manifests, and source trees for `packages/simulation`,
  `packages/render`, `packages/runtime`, and `packages/core`.
- DebugNormalMaterial shader/descriptor contracts:
  `packages/webgpu/src/webgpu/unlit-shader.ts`,
  `packages/webgpu/src/webgpu/matcap-shader.ts`,
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/render/src/materials/debug-normal-preparation.ts`,
  `references/three.js/src/materials/MeshNormalMaterial.js`,
  `references/three.js/src/renderers/shaders/ShaderLib/meshnormal.glsl.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/common/vert/normalCore.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/normalMap.js`.
- StandardMaterial base-color texture path:
  `packages/render/src/materials/standard-proof-point.ts`,
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/webgpu/src/webgpu/unlit-frame-resources.ts`,
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/three.js/src/renderers/shaders/ShaderLib/meshphysical.glsl.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/diffuse.js`.
- GLB container parser:
  `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`,
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`,
  `packages/render/src/assets/index.ts`,
  `test/assets/render-asset-preparation.test.ts`.

Recommended next task:

- `task-0617 — Render StandardMaterial metallic-roughness textures`.

Task 0617 prep notes:

- The base-color texture slice established the shader/descriptor/app pattern:
  `STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL`, `resolveStandardShaderForBatchKey`,
  `standard/group-2:material-base-color-texture@0,1,2`, and
  `prepareStandardAppTextureSamplerResources()`.
- Standard material packing and bind-group planning already collect
  `metallicRoughnessTexture` dependencies and reserve group-2 bindings 3/4, but
  `prepareStandardAppTextureSamplerResources()` currently only prepares
  `baseColorTexture`.
- `standard-pipeline-descriptor.ts` still treats `metallicRoughnessTexture` as a
  deferred feature. The next slice should move that feature to a supported
  shader/pipeline variant and keep any unsupported normal/occlusion/emissive
  paths deferred.
- Reference channel convention for glTF metallic-roughness remains roughness in
  G and metallic in B, multiplied by authored scalar factors.

Steering note:

- The user wants the backlog after the current ready queue to focus on full
  StandardMaterial PBR support first, then the proper render pipeline/material
  queue sorter. `agent/BACKLOG.md` now has a `Post-Queue Direction` section and
  `docs/MEDIUM_LONG_TERM_GOALS.md` now makes that priority explicit.
- `task-0612` added concrete follow-ups for StandardMaterial
  metallic-roughness textures, StandardMaterial normal-map/tangent diagnostics,
  and the generic material-family queue contract.
- StandardMaterial base-color texture rendering and the narrow GLB container
  parser are now supported. Next work should return to metallic-roughness and
  normal-map PBR texture support, then the generic material queue.
- Added ready follow-ups `task-0620` and `task-0621` so the queue stays above
  five ready tasks and remains pointed at PBR texture completion plus
  queue-driven app routing.

Known issues:

- Mixed material app routing is still implemented as narrow pairwise and
  three-family helpers, not a generic material-family queue. The audit found
  this safe only as a temporary bridge through the next StandardMaterial PBR
  texture slices.
- StandardMaterial remains an MVP: base-color textures are supported, but
  metallic-roughness textures, normal maps, IBL, shadows, and advanced glTF PBR
  extensions are still deferred.
- DebugNormalMaterial now has source/preparation contracts, but does not yet
  have frame resources, bind groups, or app activation.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`
- `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`
- `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`
- `examples/app-diagnostics.js`
- `examples/materials-showcase.html`
- `examples/materials-showcase.js`
- `package.json`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `packages/render/src/materials/debug-normal-preparation.ts`
- `packages/render/src/assets/glb-container.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `scripts/check-package-boundaries.mjs`
- `test/e2e/app-diagnostics.spec.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/materials/debug-normal-preparation.test.ts`
- `test/tooling/package-boundary-guard.test.mjs`
- `test/assets/glb-container.test.ts`
- `test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `test/webgpu/debug-normal-shader.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the app diagnostics and Matcap WebGPU preparation sequence:

- `task-0584` — `createWebGpuApp.render()` now prepares and caches ready unlit
  base-color texture/sampler dependencies as WebGPU-owned resources keyed by
  source handle and asset version.
- `task-0585` — app `resourceReuse` reports now include texture/sampler
  created/reused counters.
- `task-0580` — added `WebGpuAppRenderReportJsonValue`,
  `webGpuAppRenderReportToJsonValue()`, and `webGpuAppRenderReportToJson()`.
  The helper omits snapshots, raw resource handles, bind groups, command
  buffers, and browser/WebGPU objects.
- `task-0581` — added Matcap WGSL shader metadata, pipeline-family selection,
  and descriptor planning for `matcap`.
- `task-0582` — added `examples/app-diagnostics.*` plus Playwright coverage for
  mixed source-resource and material dependency readiness diagnostics.
- `task-0587` — added Matcap material uniform packing, dependency key
  extraction, buffer descriptors, and GPU material-buffer creation.
- `task-0588` — added Matcap group-2 bind group layout metadata, descriptor
  planning, resource-key creation, and bind group creation.
- `task-0589` — added Matcap render pipeline resource creation from the Matcap
  shader/descriptor contract.
- `task-0590` — added Matcap frame GPU resource assembly for mesh, view/world
  buffers, material buffer, prepared texture/sampler resources, and shared plus
  material bind groups.
- `task-0586` — audited the app diagnostics and Matcap WebGPU boundaries. No
  ECS/render ownership drift was found.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/texture-resources.test.ts test/webgpu/unlit-frame-resources.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run build`
- `pnpm exec vitest run test/webgpu/matcap-shader.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts test/webgpu/material-pipeline-selection.test.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec vitest run test/webgpu/matcap-frame-resources.test.ts test/webgpu/matcap-material-buffer.test.ts test/webgpu/matcap-bind-group.test.ts test/webgpu/matcap-pipeline.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts`
- `pnpm run check` passed: 162 test files / 757 tests.
- `pnpm run test:e2e` passed: 141 Playwright tests.

Reference files/patterns inspected:

- Bevy render asset preparation and material prepare/retry patterns:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- Three.js matcap shader/UV patterns:
  `references/three.js/src/nodes/utils/MatcapUV.js` and
  `references/three.js/src/renderers/shaders/ShaderLib/meshmatcap.glsl.js`.
- PlayCanvas/WebGPU texture and sampler resource patterns:
  `references/engine/src/platform/graphics/texture.js` and
  `references/engine/src/platform/graphics/webgpu/webgpu-texture.js`.
- Existing Aperture unlit/standard material buffer, bind group, frame resource,
  pipeline, and resource summary helpers.
- Project docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`.

Recommended next task:

- `task-0591 — Wire single-material Matcap app-facade rendering`.

Preflight notes for `task-0591`:

- The new Matcap pieces are intentionally independent:
  `matcap-material-buffer.ts`, `matcap-material-buffer-resource.ts`,
  `matcap-bind-group-layout.ts`, `matcap-bind-group.ts`,
  `matcap-pipeline.ts`, and `matcap-frame-resources.ts`.
- App activation should mirror the narrow standard/unlit app paths and reuse
  the existing source-handle/version cache for Matcap texture/sampler
  dependencies.
- Keep mixed material/source-resource frames on the existing
  `webGpuApp.additionalDrawResourceUnsupported` diagnostic until broader
  batching exists.

Known issues:

- The three-material showcase is a direct WebGPU proof/demo, not an app-facade
  multi-material implementation.
- `createWebGpuApp.render()` still supports one source mesh/material resource
  set per frame; mixed source-resource frames now fail clearly with
  `webGpuApp.additionalDrawResourceUnsupported`.
- MatcapMaterial now has WebGPU shader metadata, material buffer, bind group,
  pipeline, and frame-resource helpers, but no app-facade activation, browser
  example, or material-showcase route yet.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are still deferred.

Files touched in this update:

- `examples/app-diagnostics.html`
- `examples/app-diagnostics.js`
- `examples/index.html`
- `examples/materials-showcase.html`
- `examples/multi-entity.html`
- `examples/spinning-cube.html`
- `examples/triangle.html`
- `package.json`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-material-buffer-resource.ts`
- `packages/webgpu/src/webgpu/matcap-material-buffer.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline.ts`
- `packages/webgpu/src/webgpu/matcap-shader.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/resource-summary.ts`
- `packages/webgpu/src/webgpu/texture-resources.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/app-diagnostics.spec.ts`
- `test/webgpu/matcap-bind-group.test.ts`
- `test/webgpu/matcap-frame-resources.test.ts`
- `test/webgpu/matcap-material-buffer.test.ts`
- `test/webgpu/matcap-pipeline-descriptor.test.ts`
- `test/webgpu/matcap-pipeline.test.ts`
- `test/webgpu/matcap-shader.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/APP_DIAGNOSTICS_AND_MATCAP_METADATA_AUDIT_2026_05_16.md`

## Previous Run Update

Completed a user-requested browser demo plus six follow-up backlog tasks:

- Added `examples/materials-showcase.html` and
  `examples/materials-showcase.js`, visible at
  `http://127.0.0.1:4173/examples/materials-showcase.html`. It renders three
  spinning cubes side by side: unlit, standard PBR, and matcap. The page uses a
  focused direct WebGPU showcase shader because the high-level app facade still
  cannot bind multiple material families/resource sets in one frame.
- Fixed the PBR black-spot artifact in the showcase by using the camera
  position when computing `viewDir`.
- Fixed the built-in StandardMaterial shader path the same way: packed view
  uniforms now include `cameraPosition`, and the standard shader uses
  `view.cameraPosition.xyz - input.worldPosition`. Unlit shaders accept the
  expanded view uniform layout.
- Fixed app resource-cache reuse to store logical descriptor source byte lengths
  instead of scratch-buffer backing-array byte lengths.
- `task-0576` — `createWebGpuApp.render()` now diagnoses mixed source
  mesh/material resource sets instead of silently binding first-draw resources
  for all draws. Same-resource multi-draw frames still render.
- `task-0574` — app render failures now surface JSON-safe material dependency
  readiness when material texture/sampler source dependencies are
  missing/loading/failed.
- `task-0578` — material dependency readiness reports now have explicit JSON
  value/string helpers, and app diagnostics embed that serialized contract.
- `task-0575` — added a renderer-independent MatcapMaterial preparation
  metadata plan. It carries material key, matcap texture/sampler keys, render
  state, pipeline key, and dependency readiness JSON. This is metadata only; no
  Matcap WebGPU rendering path was activated.
- `task-0579` — audited the material showcase, expanded view-uniform layout,
  app diagnostics, mixed source-resource handling, and MatcapMaterial
  preparation metadata. No ownership drift was found. Added `task-0583` to
  promote the showcase onto built-in material/app-facade paths once
  multi-material app rendering and matcap WebGPU support exist.
- `task-0577` — checked texture/sampler reuse diagnostics. The app facade does
  not yet prepare or cache texture/sampler GPU resources from source material
  dependencies, so reuse counters would be misleading. Recorded the blocker and
  added `task-0584` for the prepared-resource cache plus `task-0585` for the
  actual reuse counters.

Validation:

- `pnpm exec vitest run test/e2e/materials-showcase.spec.ts` passed earlier in
  the run after the syntax fix and browser verification.
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/materials/matcap-preparation.test.ts test/materials/material-dependency-readiness.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run check` passed: 156 test files / 733 tests.
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts test/e2e/spinning-cube.spec.ts` passed.
- `pnpm run test:e2e` passed: 140 Playwright tests.
- In-app browser was refreshed and showed the material showcase status `ready`.
- `task-0579` was audit-only; no additional code validation was needed after the
  docs/backlog update.
- `task-0577` resolved as a documented blocker; no code validation was needed
  for the blocker note/backlog update.

Reference files/patterns inspected:

- Three.js render-list/material routing and WebGPU pipeline state patterns:
  `references/three.js/src/renderers/WebGLRenderer.js`,
  `references/three.js/src/renderers/webgpu/WebGPUBackend.js`,
  `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`.
- PlayCanvas/engine layer/material sorting, frame graph, and shader chunk
  patterns under `references/engine/src/scene` and
  `references/engine/src/platform/graphics`.
- Bevy render asset preparation and material prepare/retry patterns:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- Texture/sampler resource summary helpers and lower-level unlit textured frame
  resource tests in `packages/webgpu/src/webgpu/resource-summary.ts`,
  `packages/webgpu/src/webgpu/unlit-frame-resources.ts`, and
  `test/webgpu/unlit-frame-resources.test.ts`.
- Project docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`.

Recommended next task:

- `task-0584 — Add app-facade texture/sampler prepared-resource cache`.

Preflight notes for `task-0584`:

- The lower-level path is already ready for prepared resources:
  `createUnlitFrameGpuResources()` accepts `textures` and `samplers`, and
  `test/webgpu/unlit-frame-resources.test.ts` verifies textured bind groups.
- Extraction already blocks unready unlit texture dependencies before snapshots
  are rendered. The app facade should therefore prepare resources only for ready
  source asset dependencies on the first material in the current
  single-resource-set path.
- Use `assetHandleKey(handle)@entry.version` as the cache key pattern, matching
  existing mesh/material app-frame cache keys.
- First implementation slice can target unlit `baseColorTexture` only. Standard
  material texture sampling is still deferred in the built-in shader.
- Tests should extend `test/webgpu/webgpu-app.test.ts` with fake
  `device.createTexture`, `texture.createView`, `device.createSampler`, and
  queue upload/write events.

Known issues:

- The three-material showcase is a direct WebGPU proof/demo, not an app-facade
  multi-material implementation.
- `createWebGpuApp.render()` still supports one source mesh/material resource
  set per frame; mixed source-resource frames now fail clearly with
  `webGpuApp.additionalDrawResourceUnsupported`.
- MatcapMaterial has source asset and preparation metadata contracts, but no
  active WebGPU matcap shader/pipeline/bind-group/app path yet.
- Texture/sampler GPU resource reuse counts are still not active in app reports.
  `task-0584` must first add the prepared-resource cache, then `task-0585` can
  add the counters.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are still deferred.

Files touched in this update:

- `examples/materials-showcase.html`
- `examples/materials-showcase.js`
- `examples/index.html`
- `examples/multi-entity.html`
- `examples/spinning-cube.html`
- `examples/triangle.html`
- `examples/styles.css`
- `package.json`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/matcap-preparation.ts`
- `packages/render/src/rendering/view-pack.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/matcap-preparation.test.ts`
- `test/rendering/view-pack.test.ts`
- `test/webgpu/frame-readiness.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/unlit-frame-resources.test.ts`
- `test/webgpu/view-uniform-buffer-resource.test.ts`
- `test/webgpu/view-uniform-buffer.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `docs/research/MATERIAL_SHOWCASE_BOUNDARY_AUDIT_2026_05_16.md`
- `docs/research/APP_TEXTURE_SAMPLER_REUSE_BLOCKER_2026_05_16.md`

## Previous Run Update

Completed the stop-hook continuation sequence through the remaining ready tasks:

- `task-0567` — audited post-proof-point resource reuse and shader metadata
  boundaries.
- `task-0568` — moved the app facade onto reusable frame scratch for packing
  and planning where scratch APIs already existed.
- `task-0569` — added scratch-backed snapshot resource binding planning.
- `task-0570` — added the renderer-independent MatcapMaterial source asset
  contract and validation.
- `task-0571` — added JSON-safe app resource reuse diagnostics.
- `task-0572` — added renderer-independent material asset dependency readiness
  reports.
- `task-0573` — audited the new diagnostics and material-source boundaries.

What changed:

- Added `docs/research/POST_PROOF_POINT_BOUNDARY_AUDIT_2026_05_16.md` and
  corrected stale README text for the current early engine foundation and lit
  StandardMaterial spinning cube.
- `createWebGpuApp` now owns a reusable app-frame scratch object for packed
  view uniforms, packed transforms, render-world package planning, draw command
  descriptors, draw-list planning, render-pass resource resolution, and
  render-pass command planning.
- Added a scratch-backed writer for injected snapshot resource bindings. The
  existing convenience planner remains for tests and one-shot diagnostics.
- Added `MatcapMaterialAsset`, `createMatcapMaterialAsset()`, validation,
  pipeline-feature participation, and `assets.materials.matcap`. This is source
  asset data only; no Matcap WebGPU shader/pipeline/bind-group path was added.
- `WebGpuAppRenderReport.resourceReuse` now reports JSON-safe counts for
  pipeline hits/misses, mesh/material buffer creation and reuse, bind group
  creation and reuse, light buffer creation and reuse, and dynamic buffer
  writes. The spinning cube status includes this report.
- Added renderer-independent material asset dependency readiness reports for
  texture/sampler slots. They accept a material handle plus `AssetRegistry`,
  distinguish missing/registered/loading/failed/ready dependencies, and omit
  WebGPU resources.
- Refilled the backlog with the next audit and follow-up diagnostics/material
  tasks.
- Added `docs/research/POST_CLEANUP_DIAGNOSTICS_AUDIT_2026_05_16.md`; no
  additional architecture fixes were needed after the type-name collision fix
  caught by validation.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/render-frame-snapshot-binding-planner.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/render-frame-plan.test.ts test/webgpu/render-frame-runner.test.ts test/webgpu/render-frame-runner-diagnostics.test.ts`
- `pnpm exec vitest run test/materials/materials.test.ts test/assets/typed-collections.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/render-frame-snapshot-binding-planner.test.ts test/materials/materials.test.ts test/assets/typed-collections.test.ts`
- `pnpm exec vitest run test/materials/material-dependency-readiness.test.ts test/materials/materials.test.ts test/assets/typed-collections.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed: 155 test files / 725 tests.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed after the
  app status/reuse-report change.
- `pnpm run test:e2e` passed: 139 Playwright tests.

Reference files/patterns inspected:

- Bevy render schedules and phase queue/sort:
  - `references/bevy/crates/bevy_render/src/lib.rs`
  - `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
  - `references/bevy/crates/bevy_pbr/src/material.rs`
- Bevy render asset preparation/cache:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/crates/bevy_pbr/src/medium.rs`
- Three.js light uniform/shader update patterns:
  - `references/three.js/src/renderers/shaders/UniformsLib.js`
  - `references/three.js/src/renderers/WebGLRenderer.js`
  - `references/three.js/src/renderers/webgl/WebGLProgram.js`
- PlayCanvas/engine light/layer/render organization search under
  `references/engine/src`.
- Project docs:
  - `docs/NORTH_STAR.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md`

Recommended next task:

- `task-0574 — Surface material asset dependency readiness in app render failures`.

Known issues:

- `createWebGpuApp.render()` still has a narrow single-resource-set app facade
  path. It binds resources derived from the first draw and should now diagnose
  unsupported additional draw resource sets before a broader render-world cache
  is implemented.
- The app resource cache is intentionally narrow: it caches the current unlit or
  standard frame resource set per app path, not a multi-asset render-world cache.
- Texture/sampler GPU resource reuse counts are not active yet because the app
  facade textured-resource reuse path is still limited.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are still deferred.
- MatcapMaterial is source asset data only; no active Matcap rendering exists.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/ARCHITECTURE.md`
- `docs/LIGHT_SHADER_WGSL_CONTRACT.md`
- `docs/research/POST_CLEANUP_DIAGNOSTICS_AUDIT_2026_05_16.md`
- `docs/research/POST_PROOF_POINT_BOUNDARY_AUDIT_2026_05_16.md`
- `examples/spinning-cube.js`
- `packages/render/src/assets/collections.ts`
- `packages/render/src/materials/bindings.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/factories.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/index.ts`
- `packages/render/src/rendering/render-frame-phases.ts`
- `packages/render/src/rendering/render-queue.ts`
- `packages/render/src/rendering/view-pack.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/light-shader-metadata.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/renderer-frame-summary.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `packages/webgpu/src/webgpu/view-uniform-buffer.ts`
- `README.md`
- `test/assets/typed-collections.test.ts`
- `test/e2e/spinning-cube.spec.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/materials.test.ts`
- `test/rendering/render-frame-phases.test.ts`
- `test/rendering/view-pack.test.ts`
- `test/webgpu/light-shader-metadata.test.ts`
- `test/webgpu/render-frame-snapshot-binding-planner.test.ts`
- `test/webgpu/unlit-shader.test.ts`
- `test/webgpu/view-uniform-buffer.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the lit StandardMaterial proof-point sequence and the first resource
inspection follow-up:

- `task-0561` — direct-lit StandardMaterial WGSL and pipeline.
- `task-0562` — standard material render selection.
- `task-0563` — lit spinning cube app-facade example and Playwright E2E.
- `task-0564` — post-proof-point architecture audit.
- `task-0565` — standard material resource inspection records.

What changed:

- Added `STANDARD_MESH_WGSL` and StandardMaterial pipeline helpers for a narrow
  direct-lit metallic/roughness MVP:
  - consumes view/world transforms, StandardMaterial uniform data, normals, and
    packed light buffers.
  - supports ambient and directional lights.
  - documents texture sampling, normal maps, IBL, and shadows as deferred.
- Added material pipeline selection and draw-list routing so standard draws
  require group 3 light bind groups and never silently fall back to unlit.
- Added StandardMaterial group-2 bind group resource creation and standard frame
  GPU resources for the app facade.
- Extended `createWebGpuApp.render()` to render `standard` materials through the
  new standard pipeline/resource path while preserving the existing unlit path.
- Reworked `examples/spinning-cube.js` to use the user-facing app facade:
  typed asset collections, ECS entity spawning, camera, ambient/directional
  lights, `SpinSystem`, and `app.render()` instead of manual WebGPU setup.
- Updated the spinning-cube Playwright spec to verify a nonblank lit cube,
  animation/frame progress, and JSON-safe status.
- Completed the architecture audit:
  - `@aperture-engine/core` and `@aperture-engine/runtime` remain headless.
  - StandardMaterial source data stays renderer-independent.
  - WebGPU objects are still backend-owned.
  - No scene graph or WebGL fallback was introduced.
  - Main follow-up is app-facade hot-path allocation/resource reuse.
- Added `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md` with the
  audit findings and validation record.
- Added `task-0566` for steady-state reuse of prepared WebGPU app resources
  across frames.
- Added StandardMaterial-specific resource inspection adapters that produce the
  existing generic material inspection records for live, missing, stale, and
  pending-destroy material buffer resources without exposing raw GPU handles.

Validation:

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-pipeline.test.ts`
- `pnpm exec vitest run test/webgpu/material-pipeline-selection.test.ts test/webgpu/render-pass-draw-list.test.ts test/webgpu/standard-bind-group.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/examples/navigation.test.mjs`
- `pnpm exec vitest run test/webgpu/standard-material-resource-inspection.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed: 152 test files / 706 tests.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed.

Reference files/patterns inspected:

- PlayCanvas/engine lit material and shader organization:
  - `references/engine/src/scene/graphics/light-cube.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/pass-forward/litForwardBackend.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/pass-forward/litForwardDeclaration.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/metalnessModulate.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/lightFunctionLight.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/lightDeclaration.js`
- Three.js material/shader/render routing:
  - `references/three.js/src/materials/MeshStandardMaterial.js`
  - `references/three.js/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js`
  - `references/three.js/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js`
  - `references/three.js/src/renderers/common/RenderList.js`
  - `references/three.js/src/renderers/common/Pipelines.js`
- Bevy ECS/render/material bridge:
  - `references/bevy/crates/bevy_pbr/src/material.rs`
  - render phase/material queue patterns under `references/bevy/crates/bevy_render`
- Project docs:
  - `docs/NORTH_STAR.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`
- Existing Aperture app facade, WebGPU frame planning, light resource, unlit
  bind group, and browser E2E patterns.

Recommended next task:

- `task-0566 — Reuse WebGPU app prepared resources across frames`.

Known issues:

- `createWebGpuApp.render()` now proves the standard path but still creates
  pipelines and GPU resources per rendered frame. This is acceptable for the
  proof-point example, but it does not satisfy the frame hot-path allocation
  discipline for a steady-state runtime loop.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are intentionally deferred.
- Standard material resource inspection records now exist for material-buffer
  inspection; broader app-facade resource reuse is still pending.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md`
- `examples/spinning-cube.js`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-resource-inspection.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/spinning-cube.spec.ts`
- `test/examples/navigation.test.mjs`
- `test/materials/standard-proof-point.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/render-pass-draw-list.test.ts`
- `test/webgpu/standard-bind-group.test.ts`
- `test/webgpu/standard-material-resource-inspection.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-pipeline.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the next proof-point bridge sequence through the renderer-independent
StandardMaterial contract, then ran a focused package-boundary audit.

What changed:

- Added typed asset collections:
  - Generic `TypedAssetCollection` in `@aperture-engine/simulation`.
  - Render-facing `createRenderAssetCollections()` with `assets.meshes.add(...)`
    and `assets.materials.standard.add(...)`.
  - Material collections derive texture/sampler dependencies into
    `AssetRegistry`.
- Added renderer-independent render asset preparation:
  - `RenderAssetAdapter`.
  - `PreparedRenderAssetStore`.
  - mesh/material prepared metadata stores.
  - deterministic prepare/update/retry/remove bookkeeping.
  - docs in `docs/RENDER_ASSET_PREPARATION.md`.
- Added minimal runtime authoring helpers:
  - `app.spawn(...)` on simulation/extraction app facades.
  - `withTransform`, `withMesh`, `withMaterial`, `withCamera`, `withLight`,
    visibility/layer/metadata helpers.
  - `Spin` and `SpinSystem` for proof-point examples/tests.
- Added `createWebGpuApp` in `@aperture-engine/webgpu`:
  - Initializes WebGPU from a canvas.
  - Exposes world/assets/spawn/step/extract/render/stepAndRender.
  - Renders the existing unlit path from extracted snapshots/render-world data.
  - Does not import runtime/core.
- Added StandardMaterial proof-point contract:
  - Explicit supported/deferred feature scope.
  - Validation distinguishes deferred texture/IBL/shadow features from invalid
    scalar inputs.
  - Extraction test proves StandardMaterial produces a distinct standard
    pipeline key without raw WebGPU handles.
- Completed package-boundary audit and recorded it in
  `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`.

Validation:

- `pnpm run check` passed.
- Focused tests also passed during the run:
  - `test/assets/typed-collections.test.ts`
  - `test/assets/render-asset-preparation.test.ts`
  - `test/runtime/runtime.test.ts`
  - `test/webgpu/webgpu-app.test.ts`
  - `test/materials/standard-proof-point.test.ts`

Reference files/patterns inspected:

- Bevy `crates/bevy_asset/src/assets.rs`
- Bevy `crates/bevy_asset/src/render_asset.rs`
- Bevy `crates/bevy_render/src/render_asset.rs`
- Bevy `crates/bevy_mesh/src/components.rs`
- Existing Aperture triangle/spinning-cube WebGPU setup and frame execution
  helpers.

Recommended next task:

- `task-0560 — Prepare StandardMaterial GPU data and bind layout`.

Known issues:

- `createWebGpuApp` currently covers the existing unlit path only.
- StandardMaterial GPU buffers, bind groups, WGSL, and draw routing are still
  pending.
- The lit spinning cube example and Playwright E2E are still pending.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`
- `packages/simulation/src/assets/collections.ts`
- `packages/simulation/src/assets/index.ts`
- `packages/simulation/src/ecs/index.ts`
- `packages/render/src/assets/collections.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/index.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `packages/runtime/src/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/assets/render-asset-preparation.test.ts`
- `test/assets/typed-collections.test.ts`
- `test/materials/standard-proof-point.test.ts`
- `test/runtime/runtime.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Added medium/long-term guidance for post-proof-point work and updated
automation so stop-hook checkpoints are pushed upstream.

What changed:

- Added `docs/MEDIUM_LONG_TERM_GOALS.md` as the post-proof-point guidance doc.
- Recorded the material-family direction: `UnlitMaterial`, `MatcapMaterial`,
  `StandardMaterial`, `DebugNormalMaterial`, and optional simple lit material
  later only if it proves useful.
- Recorded the 3D import direction: focus on glTF 2.0 / GLB only; other 3D
  import formats require a later decision.
- Updated the roadmap, North Star, architecture, MVP concept map, wake prompts,
  backlog maintenance rules, and stop-hook prompt to reference the new guidance.
- Removed the older duplicate `scripts/CODEX_WAKE_PROMPT.md` and repointed the
  example autonomous runner to `agent/WAKE.md`.
- Updated `scripts/codex-stop-hook.sh` so it commits all changes and then pushes
  the current branch to its configured upstream.
- Enabled local Codex hooks in `.codex/config.toml`.

Validation:

- `pnpm run format:check` passed.
- `bash -n scripts/codex-stop-hook.sh` passed.
- `agent/STATUS.json` parses as valid JSON.

Recommended next task:

- `task-0540 — Add typed asset collection API over AssetRegistry`.

Files touched in this latest update:

- `.codex/config.toml`
- `AGENTS.md`
- `agent/BACKLOG.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `agent/WAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/MVP_3D_CONCEPTS.md`
- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `scripts/STOP_HOOK_PROMPT.md`
- `scripts/CODEX_WAKE_PROMPT.md` (removed)
- `scripts/codex-stop-hook.sh`
- `scripts/codex_next_task_sh.md`

## Previous Run Update

Retargeted the ready backlog toward the near-term proof point: a user-facing
WebGPU example that spawns ECS entities, uses typed mesh/material assets,
renders a spinning cube with a StandardMaterial MVP, and verifies the lit output
with Playwright.

What changed:

- Made `task-0540 — Add typed asset collection API over AssetRegistry` the
  recommended next task.
- Added a near-term proof-point track with explicit automation priority:
  typed assets, render asset preparation, user-facing spawn/component API,
  `createWebGpuApp` facade, StandardMaterial render contract, StandardMaterial
  WebGPU preparation, direct-lit standard shader/pipeline, render selection
  routing, lit spinning cube E2E, and post-proof-point audit.
- Rewrote `task-0543` from an API sketch into an implementation task for the
  minimal user-facing ECS spawn/component API.
- Added new tasks `task-0558` through `task-0564` for the proof-point vertical
  slice and follow-up audit.
- Moved `task-0557`, `task-0542`, and metadata-only light shader tasks behind
  the proof point unless they become direct blockers.

Recommended next task:

- `task-0540 — Add typed asset collection API over AssetRegistry`.

## Previous Run Update

Implemented the render pipeline reference follow-up sequence `task-0546`
through `task-0550`, completed `task-0551` for the first hot-path allocation
audit, added scratch-backed writers through `task-0554`, completed the
extraction/packing allocation audit in `task-0555`, and added the transform-pack
scratch writer in `task-0556`.

What changed:

- Added render-frame phase vocabulary and summary reports for apply, prepare,
  queue, resolve, command, and submit phases.
- Expanded WebGPU pipeline cache keys so they include shader family/variant,
  render targets, bind group layouts, vertex layout, primitive/depth/blend
  state, material variants, and batch compatibility fields.
- Added unlit bind group layout metadata and validation for required groups,
  duplicate bindings, missing required bindings, and resource-kind mismatches.
- Added view/pass-scoped render queue records in `@aperture-engine/render`,
  including a reusable scratch/record-pool writer for allocation-conscious
  frame-loop use.
- Added renderer resource inspection for live, missing, stale, and
  pending-destroy resources, and bridged inspection diagnostics into resource
  summaries.
- Added architecture and decision-log coverage for the new rule: no steady-state
  render hot-path allocation on successful per-frame paths.
- Added `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md` and a reusable
  draw-package writer/scratch API:
  `createRenderWorldDrawPackageScratch` and `writeRenderWorldDrawPackages`.
- Added `createRenderFramePlanScratch` / `writeRenderFramePlanFromSnapshot`,
  `createDrawCommandDescriptorScratch` / `writeDrawCommandDescriptors`, and
  `createRenderPassDrawListScratch` / `writeRenderPassDrawList`.
- Added `createResolveRenderPassResourcesScratch` /
  `writeResolveRenderPassResources` and `createRenderPassCommandScratch` /
  `writeRenderPassCommands`.
- Audited extraction, transform packing, view packing, snapshot resource
  binding plans, and `RenderWorld.applySnapshot` for remaining allocation risks.
- Added `createPackedSnapshotTransformsScratch` and
  `writePackedSnapshotTransforms`, with `floatCount` on packed transform results
  for scratch-backed buffers.

Validation completed so far:

- Focused render/WebGPU Vitest slice passed.
- `pnpm run typecheck` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check` passed.
- Focused Playwright render routes passed:
  spinning cube, primitive routing, mixed unlit pipelines, textured/multi-textured
  unlit, sampler routing, multi-entity, depth overlap, and disabled renderable
  coverage.

## Current Status

The render pipeline reference audit, its first implementation follow-ups, and
the first hot-path allocation cleanup tasks are complete.

Recent architecture state:

- The pnpm monorepo/package-boundary refactor is implemented.
- Active packages are `@aperture-engine/simulation`,
  `@aperture-engine/render`, `@aperture-engine/webgpu`,
  `@aperture-engine/runtime`, and `@aperture-engine/core`.
- The active render authoring model uses separate `Mesh` and `Material`
  components rather than `MeshRenderer`.

Latest workflow update:

- `agent/WAKE.md` now requires categorizing selected tasks before
  implementation.
- Ready backlog tasks now include category, package/write-scope, and reference
  anchor metadata.
- Reference policy is explicit:
  - ECS binding, render bridge, assets, and orchestration should anchor on
    `/Users/felixz/Projects/aperture/references/bevy`.
  - WebGPU/render-pipeline work should compare
    `/Users/felixz/Projects/aperture/references/engine` and
    `/Users/felixz/Projects/aperture/references/three.js`, then adapt the common
    patterns to Aperture.
- The backlog now includes recurring `audit-refactor` tasks to catch
  architecture drift every few implementation tasks or after boundary changes.
- The immediate backlog priority is now the lit StandardMaterial spinning cube
  proof point through user-facing ECS APIs. General render-pipeline cleanup
  remains available but should not displace the proof-point path unless it is a
  direct blocker.

Previous audit context:

- Added `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`.
- Confirmed `/Users/felixz/Projects/aperture/references/engine` is the
  PlayCanvas engine checkout and used it as the canonical PlayCanvas reference.
- Compared Aperture's current render pipeline against local Three.js and
  PlayCanvas renderer implementations.
- Documented the current Aperture pipeline:
  `RenderSnapshot -> RenderWorld.applySnapshot -> resource binding updates ->
draw readiness report -> RenderWorldDrawPackage plan -> DrawCommandDescriptor
plan -> RenderPassDrawList plan -> render pass resource resolution ->
RenderPassCommand plan -> command execution/frame report`.
- Added prioritized follow-up tasks `task-0546` through `task-0550` for render
  phases, pipeline cache keys, bind group layout metadata, view/pass queues, and
  resource lifetime/version inspection.

Reference files inspected for the audit:

- Three.js `src/renderers/common/RenderLists.js`
- Three.js `src/renderers/common/RenderList.js`
- Three.js `src/renderers/common/RenderObjects.js`
- Three.js `src/renderers/common/RenderObject.js`
- Three.js `src/renderers/common/Pipelines.js`
- Three.js `src/renderers/common/Bindings.js`
- Three.js `src/renderers/webgpu/WebGPUBackend.js`
- PlayCanvas `src/scene/frame-graph.js`
- PlayCanvas `src/scene/composition/render-action.js`
- PlayCanvas `src/scene/renderer/render-pass-forward.js`
- PlayCanvas `src/scene/renderer/forward-renderer.js`
- PlayCanvas `src/platform/graphics/bind-group-format.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-render-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-bind-group.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-draw-commands.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-graphics-device.js`

## Architecture Notes

- ECS remains authoritative.
- Rendering remains derived from extracted snapshots/render-world data.
- `@aperture-engine/simulation` imports no render/runtime/WebGPU packages.
- `@aperture-engine/render` imports simulation only.
- `@aperture-engine/runtime` imports simulation and render only.
- `@aperture-engine/core` does not import or export WebGPU.
- `@aperture-engine/webgpu` does not import runtime or core.
- WebGPU examples import `@aperture-engine/core` and
  `@aperture-engine/webgpu` explicitly.
- The renderer pipeline now has the first reference-audit follow-ups in place:
  explicit phases, expanded pipeline keys, bind group metadata, view/pass queue
  records, and resource inspection.
- Per decision 0009, future frame-loop work must distinguish hot-path writer
  APIs from allocating diagnostic/setup helpers.
- Draw package planning, view/pass queue planning, render-frame result/summary
  planning, draw command descriptors, and draw-list planning now have
  scratch-backed writer APIs. Resource resolution and command planning also now
  have scratch-backed writer APIs.
- Remaining allocation risk is earlier in the frame: snapshot extraction,
  binding-plan/update aggregation, and transform/view packing.
- Transform packing now has that scratch writer; view-uniform packing is the
  next compact packer to update.

## Files Touched

Primary implementation:

- `packages/render/src/rendering/render-queue.ts`
- `packages/render/src/rendering/draw-package.ts`
- `packages/render/src/rendering/transform-pack.ts`
- `packages/webgpu/src/webgpu/draw-command.ts`
- `packages/webgpu/src/webgpu/render-frame-phases.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `packages/webgpu/src/webgpu/render-pass-resources.ts`
- `packages/webgpu/src/webgpu/render-pass-commands.ts`
- `packages/webgpu/src/webgpu/pipeline-cache.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/resource-lifecycle.ts`
- `packages/webgpu/src/webgpu/resource-summary.ts`

Docs/bookkeeping:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md`
- `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

- Focused render/WebGPU Vitest slice passed.
- `pnpm run typecheck` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check` passed.
- Focused Playwright render routes passed.

## Known Issues

- Typed asset collections are still not implemented; callers still use
  `AssetRegistry` directly.
- Render asset preparation is still spread across render/WebGPU helpers and
  examples rather than a formal renderer-independent adapter contract.
- Runtime does not yet provide a `createWebGpuApp` facade; WebGPU examples still
  contain backend setup code.
- PBR remains blocked on typed assets, material-family contracts, and render
  asset preparation.
- View packing and resource-binding planning still need scratch-backed writers
  before a real runtime frame loop or deeper PBR work. Snapshot creation remains
  the explicit copy boundary until a reusable builder or delta transport design
  is chosen.

## Recommended Next Task

Start with `task-0540 — Add typed asset collection API over AssetRegistry`.
