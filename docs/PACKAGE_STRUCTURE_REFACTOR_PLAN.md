# Package Structure Refactor Plan

Date: 2026-05-27
Status: in progress

## Implementation Progress

- Track 1 is implemented. `packages/webgpu/src/webgpu/` was removed as an
  implementation folder; WebGPU backend files now live under domain folders
  such as `app/`, `gpu/`, `materials/`, `lighting/`, `shadows/`, `post/`,
  `render/`, `resources/`, `output/`, and `picking/`.
- The public package root still preserves the previous broad export surface for
  now. Track 9 remains responsible for tightening those exports after internal
  imports and tests no longer depend on broad barrels.
- Track 2 has started. Render-target asset creation/validation/diagnostics now
  live in `packages/webgpu/src/app/render-target.ts`, and canvas backing
  dimension resolution lives in `packages/webgpu/src/app/canvas.ts`.
- Frame-boundary target planning now lives in
  `packages/webgpu/src/app/frame-target.ts`, covering swapchain/offscreen view
  targets, per-target submission keys, and viewport/scissor rectangle
  normalization.
- Render and pick report assembly now lives in
  `packages/webgpu/src/app/report.ts`, covering JSON-safe report conversion,
  render report construction, depth-attachment summaries, resource-reuse
  summary helpers, and submitted-work waiting.
- Source asset facade preparation now lives in
  `packages/webgpu/src/app/source-assets.ts`, covering snapshot mesh/material
  facade updates and resource-reuse summary synchronization.
- Low-level app picking helpers now live in
  `packages/webgpu/src/app/picking.ts`, covering pick-pixel normalization,
  pick-pass error scopes, shared bind group creation, and ID-buffer pick
  pipeline caching.
- Material dependency diagnostics now live in
  `packages/webgpu/src/app/material-dependencies.ts`, covering snapshot
  dependency diagnostics and JSON-safe app diagnostic creation.
- Pipeline layout resolution now lives in
  `packages/webgpu/src/app/pipeline-layouts.ts`, covering cached layout
  lookup and built-in material family layout construction.
- Resource cache and frame scratch construction now live in
  `packages/webgpu/src/app/resource-cache.ts`, covering app resource cache
  types, post-pass cache state, frame scratch buffers, and cache factory setup.
- Snapshot defaults and frame update metadata now live in
  `packages/webgpu/src/app/snapshot.ts`, covering empty render snapshots and
  render snapshot change-set/update-schedule creation.
- Draw resource set planning now lives in
  `packages/webgpu/src/app/draw-resource-set.ts`, while the existing public
  root export remains available through `app.ts`.
- Standard material app pipeline-key routing now lives in
  `packages/webgpu/src/materials/standard/standard-app-pipeline-keys.ts`,
  covering shadow, IBL, and clustered-local-light feature key rewriting.
- App depth/MSAA attachment helpers now live in
  `packages/webgpu/src/app/attachments.ts`, covering per-target depth texture
  reuse, MSAA color texture reuse, and MSAA report assembly while preserving
  the existing public `WebGpuAppMsaaReport` export through `app.ts`.
- App GPU readback helpers now live in
  `packages/webgpu/src/app/gpu-readback.ts`, covering timestamp query
  readback, occlusion query readback, occlusion feedback updates, and GPU
  timing diagnostics summary merging.
- StandardMaterial transmission-grab resource setup now lives in
  `packages/webgpu/src/app/transmission-grab.ts`, covering scene-color
  post-pass texture reuse, sampler creation/reuse, transmission resource
  diagnostics, grab-pass assembly, transmission draw filtering, and grab-pass
  report creation for queued app frames.
- Frame-boundary support helpers now live in
  `packages/webgpu/src/app/frame-boundary-support.ts`, covering indirect draw
  preparation, occlusion-query resource allocation, render-bundle command keys,
  render-bundle report assembly, and static-snapshot render-bundle heuristics.
- Occlusion command filtering and culling report helpers now live in
  `packages/webgpu/src/app/occlusion-culling.ts`, covering culling report
  accumulation, skipped-draw filtering, occlusion-query command stripping, and
  query-index normalization.
- View command filtering helpers now live in
  `packages/webgpu/src/app/view-commands.ts`, covering per-view command
  visibility, pending render-pass state coalescing, draw-command detection, and
  draw counting.
- Queued built-in support helpers now live in
  `packages/webgpu/src/app/queued-built-in-support.ts`, covering queued-frame
  diagnostics summaries, standard-material route checks, transmission route
  checks, instance-tint resource collection, and StandardMaterial area-light
  LTC resource resolution.
- App skybox command helpers now live in
  `packages/webgpu/src/app/skybox.ts`, covering skybox selection, pipeline
  caching, view uniform packing, default sampler creation, bind group creation,
  and command emission.
- App sprite frame helpers now live in
  `packages/webgpu/src/app/sprites.ts`, covering sprite pipeline caching,
  sprite buffer packing, default sampler creation, texture/sampler resource
  preparation, bind group creation, and sprite draw command emission.
- Multi-unlit app resource helpers now live in
  `packages/webgpu/src/app/multi-unlit.ts`, covering multi-material unlit
  resource-set detection, frame-resource preparation, and reuse accounting.
- Queued built-in frame-resource preparation now lives in
  `packages/webgpu/src/app/queued-frame-resources.ts`, covering queued resource
  preparation, frame-resource option construction, pipeline plan results, and
  queued bind-group reuse accounting.
- App motion-vector helpers now live in
  `packages/webgpu/src/app/motion-vectors.ts`, covering scene motion-vector
  eligibility, previous object-transform GPU resources, motion-vector reports,
  and view-projection history for post passes.
- App post-processing assembly now lives in
  `packages/webgpu/src/app/post-processing.ts`, covering swapchain scene
  offscreen capture, post-effect pass/graph assembly, post readbacks, and
  post-effect submission reports.
- Full app picking orchestration now lives in
  `packages/webgpu/src/app/picking-frame.ts`, covering ID-buffer pick resource
  preparation, pick-frame planning, pick pass assembly/readback, and app-owned
  pipeline/layout callbacks.
- App pipeline resource creation now lives in
  `packages/webgpu/src/app/pipeline-resources.ts`, covering built-in material
  render-pipeline cache keys, creation, reuse accounting, and the public
  `WebGpuAppPipelineResourceResult` type re-export.
- Queued built-in app adapters now live in
  `packages/webgpu/src/app/queued-built-in-adapters.ts`, covering built-in
  material texture-resource preparation, frame-resource adapter registration,
  and adapter validation.
- App frame-boundary assembly now lives in
  `packages/webgpu/src/app/frame-boundaries.ts`, covering render target
  submission planning, per-view command filtering, skybox insertion, occlusion
  queries, GPU timings, MSAA/depth target setup, post-processing handoff,
  transmission grab passes, and render-bundle reporting.
- Sprite-only app frame rendering now lives in
  `packages/webgpu/src/app/sprite-frame.ts`, covering sprite-only view packing,
  sprite pipeline/resource preparation, frame-boundary delegation, submitted
  work waiting, readback mapping, and sprite-only render report assembly.
- Queued built-in app frame rendering now lives in
  `packages/webgpu/src/app/queued-built-in-frame.ts`, covering built-in
  material frame preparation, material queue rewriting, render-frame planning,
  sprite overlay preparation, indirect draw preparation, frame-boundary
  delegation, motion-vector history, GPU timing and occlusion readback, and
  queued render report assembly.
- App frame-loop routing now lives in
  `packages/webgpu/src/app/frame-loop.ts`, covering snapshot validation,
  standard-material route key rewriting, local-light cookie preparation,
  material dependency checks, sprite-only routing, queued built-in routing, and
  the remaining non-queued fallback frame path.
- App creation/startup now lives in
  `packages/webgpu/src/app/create-webgpu-app.ts`, covering WebGPU
  initialization, app resource-cache creation, snapshot transport startup,
  worker snapshot/error subscription handling, diagnostics snapshots, picking
  delegation, render delegation, source asset facade pruning, and environment
  resource cache registration.
- StandardMaterial shader feature contracts now live in
  `packages/webgpu/src/materials/standard/standard-shader-features.ts`,
  covering shader variant constants, the `StandardTextureShaderFeatures`
  contract, MVP lighting-model metadata, texture feature naming, fog/generic
  feature predicates, and variant-key selection.
- StandardMaterial shader sampling injectors now live in
  `packages/webgpu/src/materials/standard/standard-shader-sampling.ts`,
  covering clearcoat, sheen, iridescence, transmission, fog, clustered-local
  light, shadow-map, point-shadow, multi-shadow, diffuse IBL, and specular IBL
  proof WGSL patching.
- StandardMaterial shader sampling injectors are further split into
  `standard-shader-extension-sampling.ts` for PBR extension/fog WGSL patching
  and `standard-shader-light-sampling.ts` for clustered-local-light WGSL
  patching, with `standard-shader-sampling.ts` kept as the existing import-path
  barrel.
- StandardMaterial shadow and IBL shader sampling injectors now live in
  `standard-shader-shadow-sampling.ts` for directional, point, and multi-shadow
  WGSL patching, and `standard-shader-ibl-sampling.ts` for diffuse/specular IBL
  WGSL patching.
- StandardMaterial base WGSL source now lives in
  `packages/webgpu/src/materials/standard/standard-shader-source.ts`, while
  `standard-shader.ts` re-exports the source and focuses on metadata, variant
  WGSL assembly, and shader module descriptors.
- StandardMaterial shader variant helpers now live in
  `packages/webgpu/src/materials/standard/standard-shader-variant.ts`,
  covering texture variant comments, UV routing, WGSL declaration assembly,
  binding metadata, compact clustered-local multi-shadow detection, and shader
  label selection.
- StandardMaterial shader variant helpers are further split into focused
  utility, declaration, binding, and label modules, with
  `standard-shader-variant.ts` kept as the import-path barrel.
- StandardMaterial vertex buffer layout constants, dynamic mesh-layout parsing,
  and skinning attribute format selection now live in
  `packages/webgpu/src/materials/standard/standard-vertex-layout.ts`, while
  `standard-pipeline.ts` focuses on shader creation, render-state descriptors,
  pipeline creation, and diagnostics.
- StandardMaterial prepared texture dependency contracts and cache-key helpers
  now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-dependencies.ts`,
  while `prepared-standard-material-cache.ts` preserves the previous public
  exports and focuses on prepared material resource creation and reuse.
- StandardMaterial prepared material classification predicates now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-classification.ts`,
  covering scalar, single-texture-family, and occlusion/emissive material shape
  checks used by prepared resource routing.
- StandardMaterial prepared resource contracts now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-types.ts`,
  covering prepared resource records, diagnostics, prepare options, and prepare
  results while `prepared-standard-material-cache.ts` remains the resource
  creation implementation.
- StandardMaterial prepared scalar cache creation, scalar material preparation,
  and shared prepared cache-key helpers now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-scalar.ts`
  and
  `packages/webgpu/src/materials/standard/prepared-standard-material-cache-helpers.ts`,
  while `prepared-standard-material-cache.ts` preserves the previous import
  surface and focuses on textured material preparation.
- StandardMaterial frame local-light cluster resource helpers now live in
  `packages/webgpu/src/materials/standard/standard-frame-local-light-resources.ts`,
  covering clustered-local-light pipeline-key checks, local-light cluster GPU
  resource creation, and supported point/spot shadow resource extraction.
- StandardMaterial frame base GPU resource builders now live in
  `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts`,
  covering mesh, view-uniform, world-transform, instance-tint, skinning,
  morph-target, and material uniform buffer resource creation.
- StandardMaterial app prepared mesh/material routing now lives in
  `packages/webgpu/src/materials/standard/standard-app-prepared-resources.ts`,
  while `standard-app-frame-resources.ts` focuses on frame-resource cache
  routing, dynamic buffer updates, resource creation, and reuse accounting.
- StandardMaterial light/shadow bind-group descriptor entry helpers now live in
  `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-entries.ts`,
  covering area-light LTC, clustered local-light, local-light cookie, and
  shadow receiver descriptor entries.
- StandardMaterial light/shadow bind-group layout keys and descriptor builders
  now live in
  `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-constants.ts`
  and
  `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-layouts.ts`,
  while the previous bind-group module re-exports the public layout surface.
- StandardMaterial shadow bind-group report JSON conversion now lives in
  `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-report.ts`,
  while the shadow bind-group module focuses on sampler, descriptor, layout,
  and resource creation.
- Track 4 has started. Clustered local-light cookie resource preparation now
  keeps the stable public entry point in
  `packages/webgpu/src/lighting/local-light-cookie-resources.ts`, with
  candidates, matrix buffers, texture atlas/array resources, sampler defaults,
  and shared contracts split into focused `local-light-cookie-*` lighting
  modules.
- Clustered local-light constants, contracts, layer-mask helpers, shadow/cookie
  metadata, GPU buffer allocation, and report shaping now live in focused
  `packages/webgpu/src/lighting/local-light-cluster-*` modules, while
  `local-light-clusters.ts` remains the stable descriptor-building entry point.
- IBL texture resource creation now keeps the stable public entry point in
  `packages/webgpu/src/lighting/ibl-texture-resource.ts`, with diffuse
  allocation, specular PMREM allocation, JSON report projection, shared
  utilities, and contracts split into focused `ibl-texture-resource-*` modules.
- Track 5 has started. Render extraction frustum/culling helpers now live in
  `packages/render/src/rendering/extraction-culling.ts`, while
  `extraction.ts` keeps the public snapshot extraction entry point and
  high-level extraction orchestration.
- Render extraction material readiness, texture/sampler/environment asset
  validation, and shared diagnostic helpers now live in
  `packages/render/src/rendering/extraction-asset-validation.ts` and
  `packages/render/src/rendering/extraction-diagnostics.ts`.
- Render extraction authoring input readers and asset-handle parsing now live
  in `packages/render/src/rendering/extraction-inputs.ts`, keeping
  `extraction.ts` focused on snapshot orchestration and packet assembly.
- Render extraction light/environment/shadow packet assembly now lives in
  `packages/render/src/rendering/extraction-lights.ts`, with shared sorted
  entity and transform-matrix helpers split into `extraction-entities.ts` and
  `extraction-matrices.ts`.
- Render extraction sprite, skybox, and fog packet assembly now live in
  `packages/render/src/rendering/extraction-sprites.ts`,
  `packages/render/src/rendering/extraction-skyboxes.ts`, and
  `packages/render/src/rendering/extraction-fogs.ts`.
- Render extraction mesh draw assembly, mesh extraction cache state, mesh layout
  key helpers, skin/morph/instance extraction helpers, and material-slot
  resolution now live in `packages/render/src/rendering/extraction-meshes.ts`,
  leaving `extraction.ts` as the snapshot/view orchestration entry point.
- Render extraction mesh bounds and mesh layout key helpers now live in
  `packages/render/src/rendering/extraction-mesh-bounds.ts` and
  `packages/render/src/rendering/extraction-mesh-layout.ts`.
- Render extraction mesh cache state/replay helpers now live in
  `packages/render/src/rendering/extraction-mesh-cache.ts`, with shared vector
  packing in `packages/render/src/rendering/extraction-packing.ts`.
- Render extraction skinning and morph-target extraction helpers now live in
  `packages/render/src/rendering/extraction-mesh-deformation.ts`.
- Render extraction per-instance packet helpers and material-slot/material
  pipeline feature helpers now live in
  `packages/render/src/rendering/extraction-mesh-instances.ts` and
  `packages/render/src/rendering/extraction-mesh-materials.ts`.
- Render asset custom WGSL material preparation, validation, and prepared
  descriptor construction now live in
  `packages/render/src/assets/custom-wgsl-material-preparation.ts`, while
  `preparation.ts` re-exports the same public API names.
- GLB URI fetch/cache/external-buffer/external-image fetching and same-origin
  URL helpers now live in `packages/render/src/assets/glb-uri-fetch.ts`,
  keeping URI fetch/error handling outside `glb-uri-loader.ts`.
- GLB image source resolution, decode caching, MIME/type helpers, decoded
  image merging, and image-data resolver helpers now live in
  `packages/render/src/assets/glb-uri-images.ts`, leaving `glb-uri-loader.ts`
  as a compact URI load orchestration entry point.
- glTF URI image source resolution, decode caching, decoded-image resolver
  helpers, and shared URI/MIME/byte utilities now live in
  `packages/render/src/assets/gltf-uri-images.ts` and
  `packages/render/src/assets/gltf-uri-shared.ts`.
- glTF URI fetch/cache, JSON parsing, external buffer/image fetch, same-origin
  URL validation, and external byte merge helpers now live in
  `packages/render/src/assets/gltf-uri-fetch.ts`, leaving
  `gltf-uri-loader.ts` as a compact URI load orchestration entry point.
- glTF texture async byte loading, browser/canvas image decode, data-URI
  decoding, and shared texture validation helpers now live in
  `packages/render/src/materials/gltf-texture-loading.ts` and
  `packages/render/src/materials/gltf-texture-utils.ts`, while
  `gltf-texture.ts` preserves the public exports and focuses on texture
  mapping/report assembly.
- glTF texture report JSON projection now lives in
  `packages/render/src/materials/gltf-texture-report.ts`, leaving
  `gltf-texture.ts` below the current hotspot threshold.
- glTF material texture binding orchestration remains in
  `packages/render/src/materials/gltf-material-textures.ts`, with texture-info
  validation, `KHR_texture_transform` mapping, and texture-binding resolver
  diagnostic normalization split into focused `gltf-material-texture-*`
  modules.
- glTF mesh generated tangent math and tangent-generation diagnostics now live
  in `packages/render/src/assets/gltf-mesh-tangents.ts`, leaving
  `gltf-mesh-asset-construction.ts` focused on mesh asset assembly.
- glTF report-driven import JSON projection, meshopt buffer-view decoding,
  Draco primitive decoding, and GLB buffer-source resolution now live in
  focused `gltf-report-driven-import-*` asset modules, leaving
  `gltf-report-driven-import.ts` as the import/report orchestration facade.
- Render authoring types/enums, component definitions, creation helpers, and
  validation helpers now live in focused `authoring-*` rendering modules,
  leaving `authoring.ts` as the stable public facade and component registration
  entry point.
- Packed render snapshot packet registry management and per-packet binary
  codecs now live in `snapshot-packed-registry.ts` and
  `snapshot-packed-codecs.ts`, leaving `snapshot-packed-encoding.ts` focused on
  header validation plus high-level encode/decode orchestration.
- glTF texture decoded-image resolver normalization now lives in
  `packages/render/src/materials/gltf-texture-resolution.ts`, keeping
  `gltf-texture.ts` focused on texture/source/sampler mapping and asset report
  assembly.
- glTF mesh primitive compression checks and Draco compressed primitive mapping
  now live in `packages/render/src/assets/gltf-mesh-primitive-compression.ts`,
  with shared primitive guard/diagnostic helpers in
  `gltf-mesh-primitive-utils.ts`.
- Shared procedural mesh primitive builder types, bounds calculation, vertex
  interleaving, and numeric helpers now live in
  `packages/render/src/mesh/primitives-builders.ts`, leaving
  `primitives.ts` focused on public shape factory functions and shape-specific
  assembly.
- glTF mesh vertex stream orchestration remains in
  `packages/render/src/assets/gltf-mesh-asset-vertex-streams.ts`, with
  source-view reuse, packed attribute writing, decoded format support, and
  shared stream source types split into focused `gltf-mesh-asset-*stream*` and
  `gltf-mesh-asset-vertex-formats.ts` modules.
- Transform, instance-tint, and instance-attribute packing guard/lookup
  helpers now live in `packages/render/src/rendering/transform-pack-guards.ts`,
  keeping `transform-pack.ts` focused on scratch/result allocation and packing
  writers.
- glTF accessor validation public contracts, semantic format expectations,
  buffer/bufferView bounds checks, diagnostic attachment, and shared field
  guards now live in focused `gltf-accessor-validation-*` asset modules,
  keeping `gltf-accessor-validation.ts` as the validation/report facade.
- glTF accessor decoding contracts, output shape/typed-array helpers,
  source-view/strided decoding, and report JSON projection now live in focused
  `gltf-accessor-decoding-*` asset modules, keeping
  `gltf-accessor-decoding.ts` as the primitive decode orchestration facade.
- Render asset preparation contracts, generic preparation/unload flow, prepared
  asset store state, mesh metadata preparation, and material metadata
  preparation now live in focused `preparation-*` asset modules, keeping
  `preparation.ts` as the stable public facade.
- glTF material mapping contracts, scalar/vector field mapping, render-state
  mapping, material extension diagnostics, and report JSON cloning now live in
  focused `gltf-material-*` material modules, keeping `gltf-material.ts` as the
  material assembly facade.
- glTF scene traversal contracts, scene selection, local transform decoding,
  traversal report JSON cloning, and shared traversal guards now live in
  focused `gltf-scene-traversal-*` asset modules, keeping
  `gltf-scene-traversal.ts` as the scene traversal orchestration facade.
- glTF texture mapping contracts, texture source/image selection, sampler
  mapping, texture asset/report construction, and result shaping now live in
  focused `gltf-texture-*` material modules, keeping `gltf-texture.ts` as the
  sync/async texture mapping facade.
- StandardMaterial texture readiness contracts, expectation tables,
  transform/format helpers, and report JSON projection now live in focused
  `standard-texture-readiness-*` material modules, keeping
  `standard-texture-readiness.ts` as the registry inspection facade.
- GLB URI image decode cache/transcoder selection, image source/byte
  resolution, and decoded-image merge/concurrency helpers now live in focused
  `glb-uri-image-*` asset modules, keeping `glb-uri-images.ts` as the decode
  orchestration facade.
- GLB URI byte fetching, fetch-cache reuse, and context-aware fetch/read/HTTP
  diagnostics now live in `packages/render/src/assets/glb-uri-fetch-bytes.ts`,
  keeping `glb-uri-fetch.ts` focused on external buffer/image fetch
  orchestration, URL resolution, and byte merging.
- glTF URI image source/byte resolution, decode cache/transcoder selection,
  and decoded-image resolver/concurrency helpers now live in focused
  `gltf-uri-image-*` asset modules, keeping `gltf-uri-images.ts` as the decode
  orchestration facade.
- glTF URI byte fetching, fetch-cache reuse, and context-aware fetch/read/HTTP
  diagnostics now live in `packages/render/src/assets/gltf-uri-fetch-bytes.ts`,
  keeping `gltf-uri-fetch.ts` focused on JSON parsing, external buffer/image
  fetch orchestration, URL resolution, and byte merging.
- glTF ECS authoring command-plan public contracts and JSON/report projection
  now live in focused `gltf-ecs-authoring-command-plan-*` asset modules,
  keeping `gltf-ecs-authoring-command-plan.ts` focused on command planning and
  orchestration.
- glTF ECS authoring entity command helpers, local/world transform defaults,
  skipped-node diagnostics, primitive mesh/material readiness, and primitive
  command construction now live in focused
  `gltf-ecs-authoring-command-plan-entities.ts` and
  `gltf-ecs-authoring-command-plan-primitives.ts`, leaving the command-plan
  facade as compact traversal orchestration.
- glTF source asset registration public contracts, report JSON projection,
  material dependency discovery, planned-handle helpers, and skipped/duplicate
  diagnostics now live in focused `gltf-source-registration-*` asset modules,
  leaving `gltf-source-registration.ts` focused on texture/sampler/material
  registry writes.
- glTF mesh primitive mapping public contracts, report JSON projection, and
  attribute/index reference mapping now live in focused
  `gltf-mesh-primitive-*` asset modules, leaving
  `gltf-mesh-primitive.ts` focused on root validation, primitive selection,
  topology checks, compression routing, and planned mesh assembly.
- Transform packing public contracts, mutable scratch state, capacity growth,
  and reusable offset pools now live in `transform-pack-types.ts` and
  `transform-pack-scratch.ts`, leaving `transform-pack.ts` focused on current,
  previous, tint, and custom instance-attribute packing algorithms.
- Transform packing previous-transform history helpers and instance vertex
  buffer packing helpers now live in `transform-pack-history.ts` and
  `transform-pack-instances.ts`, leaving `transform-pack.ts` as the stable
  public facade for transform packing.
- Packed snapshot primitive numeric/enum/entity/vector/handle codec helpers now
  live in `snapshot-packed-codec-utils.ts`, leaving
  `snapshot-packed-codecs.ts` focused on packet-specific read/write layouts.
- glTF ECS command replay public contracts and report JSON/result shaping now
  live in focused `gltf-ecs-command-replay-*` asset modules, leaving
  `gltf-ecs-command-replay.ts` focused on component registration, entity
  creation, component replay orchestration, and report creation.
- Render queue public contracts, reusable scratch/pool allocation, and
  sort/coalescing/static-batch policy now live in focused
  `render-queue-*` rendering modules, leaving `render-queue.ts` focused on
  queue planning from draw readiness plus packed transforms.
- Procedural primitive mesh line-list and cone/cylinder frustum construction
  now live in `primitives-line-list.ts` and `primitives-frustum.ts`, leaving
  `primitives.ts` focused on the remaining public box, plane, sphere, capsule,
  and torus factories.
- Static mesh merge public contracts, shared validation/data helpers, and
  merged-bounds calculation now live in focused `mesh-merge-*` rendering
  modules, leaving `mesh-merge.ts` focused on batch merge orchestration and
  merged stream/index/submesh assembly.
- Material queue public contracts, scratch/pool allocation, deterministic
  ordering, family parsing, and phase/family summary generation now live in
  focused `material-queue-*` rendering modules, leaving `material-queue.ts`
  focused on snapshot-to-queue planning and missing-resource diagnostics.
- glTF scene import contract public types and JSON report projection now live
  in focused `gltf-scene-import-contract-*` asset modules, leaving
  `gltf-scene-import-contract.ts` focused on composing mapping, traversal,
  material resolution, ECS command planning, summary, and diagnostics.
- glTF asset mapping public types, JSON report projection, texture-slot
  discovery, planned handle keys, sampler-source lookup, and texture diagnostic
  conversion now live in focused `gltf-asset-mapping-*` asset modules, leaving
  `gltf-asset-mapping.ts` focused on root validation plus texture/sampler/
  material mapping orchestration.
- glTF mesh asset construction public contracts, JSON report projection,
  attribute collection, diagnostic/key helpers, index/bounds validation, and
  morph/skinning schema derivation now live in focused
  `gltf-mesh-asset-construction-*` asset modules, leaving
  `gltf-mesh-asset-construction.ts` focused on primitive-to-mesh assembly
  orchestration.
- glTF report-driven import public contracts and mesh import pipeline
  composition now live in focused `gltf-report-driven-import-*` asset modules,
  leaving `gltf-report-driven-import.ts` focused on root/asset/scene
  orchestration and GLB handoff.
- View uniform packing public contracts/constants and scratch/pool helpers now
  live in `view-pack-types.ts` and `view-pack-scratch.ts`, leaving
  `view-pack.ts` focused on view uniform validation and packing.
- Mesh extraction submesh/material draw assembly now lives in
  `extraction-mesh-submeshes.ts`, leaving `extraction-meshes.ts` focused on
  entity traversal, cache reuse/writeback, culling, and per-entity mesh data
  extraction.
- GLB container public contracts/constants, diagnostic builders, and byte/JSON
  helpers now live in focused `glb-container-*` asset modules, leaving
  `glb-container.ts` focused on `parseGlbContainer` orchestration.
- Radiance HDR RGBE public contracts, parser/pixel decoding, and URI fetch
  handling now live in focused `hdr-rgbe-*` asset modules, leaving
  `hdr-rgbe-loader.ts` as the stable public facade.
- Remaining procedural primitive mesh factories now live in focused
  `primitives-box-plane.ts`, `primitives-sphere.ts`, and
  `primitives-rings.ts` modules, leaving `primitives.ts` as the stable public
  primitive factory facade.
- glTF accessor primitive traversal, attribute/index reference validation,
  accessor range checks, and primitive-plan assembly now live in
  `gltf-accessor-validation-primitives.ts`, leaving
  `gltf-accessor-validation.ts` focused on root validation and public report
  APIs.
- KTX2 public contracts, constants, container parsing, shared byte/feature
  utilities, and Basis Universal transcoder glue now live in focused
  `ktx2-*` asset modules, leaving `ktx2-decoder.ts` as the public decode and
  compression-support facade.
- Draco public contracts, WASM/JS module loading, decoded mesh extraction, and
  glTF accessor adaptation now live in focused `draco-*` asset modules, leaving
  `draco-decoder.ts` as the stable public decoder facade.
- glTF URI JSON parsing, external buffer/image fetch orchestration, same-origin
  URL validation, and provided/fetched byte merge helpers now live in focused
  `gltf-uri-*` asset modules, leaving `gltf-uri-fetch.ts` as the stable public
  fetch facade.
- GLB URI external buffer/image fetch orchestration, same-origin URL
  validation, empty external result helpers, and provided/fetched byte merge
  helpers now live in focused `glb-uri-*` asset modules, leaving
  `glb-uri-fetch.ts` as the stable public fetch facade.
- glTF ECS command replay component application, value validation, skip
  diagnostics, and tuple guards now live in
  `gltf-ecs-command-replay-components.ts`, leaving
  `gltf-ecs-command-replay.ts` focused on component registration, entity
  creation, replay orchestration, and report creation.
- StandardMaterial texture readiness material traversal, dependency readiness
  checks, ready-texture slot assembly, color-space/semantic diagnostics, and
  texCoord diagnostics now live in focused `standard-texture-readiness-*`
  material modules, leaving `standard-texture-readiness.ts` as the public
  registry guard and report entry point.
- glTF material unlit/standard asset construction, scalar/vector field
  mapping, texture binding routing, transmission render-state adjustment, and
  unsupported extension-field diagnostics now live in
  `gltf-material-builders.ts`, leaving `gltf-material.ts` focused on material
  root validation, extension source discovery, and report orchestration.
- KTX2 Basis Universal JS/WASM module loading, glue factory evaluation,
  transcode target selection, texture row packing math, and DFD transfer
  inspection now live in focused `ktx2-basis-*` asset modules, leaving
  `ktx2-basis-transcoder.ts` focused on KTX2 validation and level-0 transcode
  orchestration.
- Render extraction StandardMaterial readiness diagnostics, TEXCOORD_1 mesh
  dependency checks, unlit texture dependency checks, and generic texture/
  sampler/environment-map asset-state validation now live in focused
  `extraction-*-validation.ts` rendering modules, leaving
  `extraction-asset-validation.ts` as the stable import facade.
- Static mesh merge source layout collection, compatibility diagnostics,
  vertex/index buffer assembly, and merged submesh range construction now live
  in focused `mesh-merge-*` rendering modules, leaving `mesh-merge.ts` focused
  on batch merge orchestration and final mesh report assembly.
- Snapshot view-uniform scratch writing plus camera-position,
  previous-view-projection, matrix range, and fog uniform writers now live in
  focused `view-pack-*` rendering modules, leaving `view-pack.ts` focused on
  allocation-based view uniform packing and public exports.
- GLB URI public loader contracts, cache/report option types, external image
  status types, and optional Draco/meshopt decoder resolution now live in
  focused `glb-uri-loader-*` asset modules, leaving `glb-uri-loader.ts` focused
  on URI fetch, external byte/image resolution, source loader handoff, and final
  report assembly.

## Purpose

Refactor the internal source layout of the Aperture packages so module
structure matches runtime architecture, ownership boundaries, and render
pipeline stages.

This is not a proposal to split the workspace into more npm packages. The
current package boundaries are still aligned with the architecture:

- `@aperture-engine/simulation`: headless ECS, math, assets, transforms,
  diagnostics, and spatial queries.
- `@aperture-engine/render`: renderer-independent authoring contracts,
  extraction, snapshots, render-world data, mesh/material assets, and render
  diagnostics.
- `@aperture-engine/webgpu`: WebGPU backend, browser app facade, GPU resources,
  render passes, pipelines, command encoding, and submission.
- `@aperture-engine/app`: developer-facing config, systems, generated browser
  and worker bootstrap, input, assets, and runtime ergonomics.
- `@aperture-engine/vite-plugin`: config discovery, system discovery, generated
  virtual modules, and dev-session build integration.
- `@aperture-engine/cli`: app creation, managed browser/dev sessions, MCP
  tools, runtime tools, and reference/RAG tooling.
- `@aperture-engine/runtime`: focused headless simulation and extraction
  facades.

The problem is inside several packages, especially `webgpu`: folders are too
flat, filename prefixes are acting as fake directories, and some root exports
make internal renderer machinery look public.

## Current State

Initial observed package source file counts before Track 1:

- `packages/webgpu/src`: 223 files, almost all under `src/webgpu`.
- `packages/render/src`: 88 files, already split into broad domains.
- `packages/simulation/src`: 25 files, already reasonably organized.
- `packages/app/src`: 15 files, but several files are large and mix concerns.
- `packages/cli/src`: 8 files, with very large command/reference modules.
- `packages/vite-plugin/src`: 1 large `index.ts`.
- `packages/runtime/src`: 4 small facade files.

Largest pressure points:

- `packages/webgpu/src/app/app.ts`: app startup, frame loop, presentation,
  asset mirroring, diagnostics, transport, picking, and resource setup are all
  mixed together.
- `packages/webgpu/src/materials/standard/standard-shader.ts`: shader chunks, feature
  flags, variant assembly, and validation are mixed in one file.
- `packages/webgpu/src/materials/standard/prepared-standard-material-cache.ts`,
  `local-light-cookie-resources.ts`, `renderer-frame-summary.ts`,
  `local-light-clusters.ts`, and `standard-frame-resources.ts` are all large
  enough to deserve clearer ownership.
- `packages/app/src/systems.ts`, `worker.ts`, `browser.ts`, and
  `input-state.ts` are broad modules that now cover multiple public and runtime
  concerns.
- `packages/cli/src/cli.ts` and `reference.ts` are large modules that combine
  command wiring, implementation, and data/tooling logic.
- `packages/vite-plugin/src/index.ts` combines plugin creation, config
  analysis, system discovery, virtual modules, and generated type output.

The `webgpu` package also has obvious filename-prefix clusters:

- `standard-*`
- `shadow-*`
- `queued-*`
- `prepared-*`
- `render-*`
- `frame-*`
- `unlit-*`
- `matcap-*`
- `debug-normal-*`
- `post-*`
- `ibl-*`

Those prefixes should become real folders.

## Goals

- Keep package boundaries aligned with the North Star architecture.
- Make source folders mirror ownership and frame-pipeline stages.
- Make WebGPU internals easier to navigate without creating a renderer-owned
  scene graph.
- Keep ECS/render extraction and worker-ready snapshot boundaries explicit.
- Make public exports intentional rather than accidental barrel exports of
  internal implementation details.
- Keep the migration mostly mechanical at first so behavior does not change
  while files move.
- Reduce the size and responsibility of the largest modules after the
  mechanical move is stable.

## Non-Goals

- No new npm package split in this refactor.
- No WebGL fallback.
- No mutable scene graph or renderer-owned gameplay state.
- No broad render-pipeline redesign during the file move.
- No API churn unless it is part of explicit export hygiene.
- No unrelated formatting churn outside moved/touched files.

## Target Shape: `packages/webgpu`

The redundant `src/webgpu/` nesting is removed by Track 1. The package root should
be `packages/webgpu/src`, with subfolders by backend responsibility:

```text
packages/webgpu/src/
  index.ts
  app/
    create-webgpu-app.ts
    frame-loop.ts
    presentation.ts
    canvas.ts
    resize.ts
    source-assets.ts
    snapshot-transport.ts
    diagnostics.ts
    picking.ts
  gpu/
    adapter.ts
    device.ts
    canvas-context.ts
    buffers.ts
    textures.ts
    samplers.ts
    bind-groups.ts
    pipelines.ts
    commands.ts
    timing.ts
  resources/
    keys.ts
    lifecycle.ts
    summaries.ts
    prepared-meshes.ts
    prepared-materials.ts
    textures.ts
    samplers.ts
    caches.ts
  render/
    frame.ts
    queues/
    passes/
      main.ts
      shadows.ts
      post.ts
      readback.ts
      picking.ts
    draw-commands.ts
    bundles.ts
  materials/
    core/
    standard/
      shader.ts
      shader-chunks.ts
      features.ts
      pipeline.ts
      bind-groups.ts
      buffers.ts
      textures.ts
      ibl.ts
      shadows.ts
      skinning.ts
      morphing.ts
    unlit/
    matcap/
    debug-normal/
    custom-wgsl/
  lighting/
    packing.ts
    clusters.ts
    environment.ts
    area-lights.ts
    cookies.ts
  shadows/
    core.ts
    directional.ts
    point.ts
    spot.ts
    atlas.ts
  post/
    bloom.ts
    ssao.ts
    ssr.ts
    dof.ts
    taa.ts
    fxaa.ts
  output/
    color-space.ts
    tonemap.ts
  diagnostics/
  test-support/
```

### WebGPU Migration Notes

- Move files by prefix/domain first with no logic changes.
- Keep temporary compatibility barrels only inside the package while imports
  are being migrated.
- Prefer explicit internal imports from the new folders over one large
  `webgpu/index.ts` barrel.
- Split `app.ts` after the mechanical move into startup, presentation,
  frame-loop, asset mirroring, diagnostics, picking, and transport modules.
- Split `standard-shader.ts` after the mechanical move into chunks, feature
  flags, variant assembly, validation, and material-family integration.
- Move `standard-*`, `unlit-*`, `matcap-*`, and `debug-normal-*` into material
  family folders.
- Move `shadow-*`, `point-shadow-*`, `spot-shadow-*`, and
  `directional-shadow-*` into `shadows/`.
- Move `post-*` into `post/`.
- Move `queued-*` and `prepared-*` into queue/resource preparation folders.

## Target Shape: `packages/render`

`render` already has useful top-level domains, but the asset and rendering
folders should be deepened around importer, preparation, and snapshot concerns:

```text
packages/render/src/
  index.ts
  assets/
    registry/
    loaders/
      glb.ts
      gltf.ts
      hdr.ts
      ktx2.ts
      draco.ts
      meshopt.ts
    gltf/
      parsing.ts
      decoding.ts
      scene-import.ts
      ecs-authoring.ts
      material-import.ts
      diagnostics.ts
    preparation/
  materials/
    core/
    families/
      unlit/
      matcap/
      standard/
      debug-normal/
      custom-wgsl/
    gltf/
    dependencies/
  mesh/
    primitives/
    geometry/
    bounds/
  rendering/
    extraction/
    snapshot/
    render-world/
    queues/
    preparation/
    diagnostics/
```

The goal is to keep `render` renderer-independent while making it obvious
which modules describe authoring assets, imported data, extracted snapshots,
and prepared render-world contracts.

## Target Shape: `packages/app`

`app` should stay the developer-facing facade, but its internals should separate
public authoring contracts from generated browser/worker runtime code:

```text
packages/app/src/
  index.ts
  config/
    define-config.ts
    assets.ts
    input.ts
    render.ts
    diagnostics.ts
  systems/
    create-system.ts
    context.ts
    spawn.ts
    assets.ts
    materials.ts
    meshes.ts
    resources.ts
  input/
    resource.ts
    keyboard.ts
    gamepad.ts
    pointer.ts
    actions.ts
    protocol.ts
  assets/
    manifest.ts
    mirror.ts
    preload.ts
  generated/
    browser/
    worker/
    commands/
    devtools/
  runtime/
    advanced.ts
    headless.ts
  tooling/
    entity-lookup.ts
    spatial-queries.ts
```

Root and subpath exports should stay focused:

- `@aperture-engine/app`
- `@aperture-engine/app/config`
- `@aperture-engine/app/systems`
- `@aperture-engine/app/advanced`
- `@aperture-engine/app/browser`
- `@aperture-engine/app/worker`
- `@aperture-engine/app/vite`

Internal generated/runtime modules should not leak through the root export.

## Target Shape: `packages/vite-plugin`

Split the single large plugin module into focused build-time concerns:

```text
packages/vite-plugin/src/
  index.ts
  plugin.ts
  config.ts
  system-discovery.ts
  descriptor-analysis.ts
  virtual-modules.ts
  generated-action-types.ts
  asset-manifest.ts
  dev-session.ts
  diagnostics.ts
```

This should make automatic system registration, system priority extraction,
generated input action types, virtual browser/worker modules, and dev-session
metadata independently testable.

## Target Shape: `packages/cli`

Split CLI command wiring from command implementation and reusable tool
transports:

```text
packages/cli/src/
  index.ts
  bin/
  commands/
    create.ts
    dev.ts
    tool.ts
    mcp.ts
    reference.ts
  templates/
    minimal/
    glb-viewer/
    game/
  dev-session/
    session-file.ts
    managed-browser.ts
    transport.ts
    lifecycle.ts
  mcp/
    server.ts
    tools.ts
    schemas.ts
  browser-tools/
    input.ts
    camera.ts
    ecs.ts
    render.ts
    screenshot.ts
  reference/
    ingest.ts
    index.ts
    query.ts
    assets.ts
    filters.ts
```

The command modules should parse CLI arguments and delegate to reusable
implementations. MCP tools and CLI tools should continue sharing the same
backend contracts.

## Target Shape: `packages/simulation` And `packages/runtime`

`simulation` is already relatively well organized. Keep it mostly stable, with
only targeted refinements:

- Preserve `assets/`, `diagnostics/`, `ecs/`, `math/`, `spatial/`, and
  `transform/`.
- Consider splitting `spatial/mesh-bvh.ts` only when a real maintenance or
  testability issue requires it.
- Do not import render, WebGPU, browser APIs, or app-generated runtime modules.

`runtime` should stay small:

- Keep it as focused headless simulation/extraction facade code.
- Do not turn it into a new umbrella package.
- Do not reintroduce the retired `core` package role.

## Export Hygiene

The current `@aperture-engine/webgpu` root and internal barrel exports expose
too much backend machinery. After imports are stable:

- Curate public root exports to intentional app facade and low-level contracts.
- Move implementation-only exports behind internal paths or remove them from
  package export maps.
- Keep test-only helpers under `test-support/` or package-private imports.
- Avoid broad `export *` barrels that make every internal file de facto public.
- Preserve explicitly documented public entry points while the project is still
  prelaunch.

Candidate public WebGPU exports:

- `createWebGpuApp`
- public app/browser diagnostics types
- intentional WebGPU app options
- intentional low-level material/custom-WGSL contracts, if documented

Candidate internal-only exports:

- pipeline cache details
- bind group builders
- per-family prepared resource caches
- pass encoders
- draw command planners
- shader assembly helpers
- queue/package internals

## Implementation Tracks

### Track 1: Mechanical WebGPU Move

Create the target folder structure under `packages/webgpu/src`, move files by
domain/prefix, and update internal imports without changing behavior.

Acceptance criteria:

- `packages/webgpu/src/webgpu/` is removed or reduced to a temporary
  compatibility barrel with no implementation files.
- Existing WebGPU tests and examples pass with no intended behavior changes.
- `pnpm --filter @aperture-engine/webgpu run typecheck` passes.
- `pnpm --filter @aperture-engine/webgpu run build` passes.
- Targeted WebGPU/render Playwright coverage for at least the primary examples
  still passes.
- `git diff --stat` shows mostly file moves and import updates.

### Track 2: Split WebGPU App Orchestration

Split the large WebGPU app module into focused app, presentation, frame-loop,
diagnostics, picking, asset, and transport modules.

Acceptance criteria:

- App startup, frame loop, canvas/presentation, source asset mirroring,
  snapshot transport, diagnostics, and picking each live in focused modules.
- Public `createWebGpuApp(...)` behavior and types remain stable.
- Generated Vite apps still render through the same worker/main boundary.
- Browser diagnostics still report canvas, render, asset, input, and frame
  status.
- Existing app, developer API, and managed-browser tests pass.

### Track 3: Split Material Families

Move material-family implementation into dedicated folders and split the
standard shader into smaller ownership units.

Acceptance criteria:

- `standard`, `unlit`, `matcap`, `debug-normal`, and `custom-wgsl` have
  separate WebGPU material-family folders.
- StandardMaterial shader chunks, feature flags, variant assembly, pipeline
  setup, bind group resources, textures, IBL, shadows, skinning, and morphing
  are separately navigable.
- Built-in material examples render unchanged.
- Custom WGSL examples and tests still pass.
- Material diagnostics and queue-family reports are unchanged except for
  intentional wording updates.

### Track 4: Split Shadows, Lighting, Post, And Output

Move render-stage subsystems into dedicated domains.

Acceptance criteria:

- Shadow resources and passes live under `shadows/`.
- Clustered/local/environment lighting resources live under `lighting/`.
- Bloom, SSAO, SSR, DOF, TAA, FXAA, and related passes live under `post/`.
- Tonemap and color-space code lives under `output/`.
- Existing shadow, lighting, post-effect, and tonemap examples pass.
- Render-pipeline diagnostics retain the same JSON-safe shape.

### Track 5: Render Package Deepening

Deepen `packages/render/src` around glTF import, material families, render
snapshot/extraction, render-world contracts, and asset preparation.

Acceptance criteria:

- glTF parsing/import/authorship code is grouped by responsibility.
- Render extraction and render snapshot code are separated from render-world
  preparation contracts.
- Renderer-independent material-family source contracts remain free of WebGPU
  imports.
- Existing render package tests pass.
- Existing app examples still use public render/app contracts, not internal
  import paths.

### Track 6: App Package Split

Split developer config/systems APIs, input state, assets, generated runtime,
and tooling helpers into focused folders.

Acceptance criteria:

- `config`, `systems`, `input`, `assets`, `generated`, `runtime`, and `tooling`
  concerns are separated.
- Existing subpath exports remain stable.
- The root app export remains browser-safe and does not expose generated worker
  internals by accident.
- Generated action types, input actions, browser forwarding, and worker input
  processing still pass targeted tests.
- Playground and create templates typecheck and build.

### Track 7: Vite Plugin Split

Split the Vite plugin into plugin wiring, config loading, system discovery,
descriptor analysis, virtual modules, generated action types, asset manifests,
dev-session metadata, and diagnostics.

Acceptance criteria:

- `packages/vite-plugin/src/index.ts` is a small public entry point.
- System discovery and generated action type logic are independently tested.
- System priority extraction remains deterministic and documented.
- Generated browser and worker virtual modules are unchanged in behavior.
- Create-template, developer API, and app type-generation tests pass.

### Track 8: CLI Split

Split CLI commands, templates, dev-session transport, MCP tools, browser tools,
and reference/RAG tooling into focused modules.

Acceptance criteria:

- `packages/cli/src/cli.ts` contains command registration/wiring only, or is
  small enough to review comfortably.
- `create`, `dev`, `tool`, `mcp`, and `reference` command implementation lives
  in command modules.
- CLI tools and MCP tools continue to share one backend implementation.
- Create templates still pass install, typecheck, build, managed-browser, and
  browser smoke validation in temporary projects.
- MCP and CLI runtime-tool end-to-end tests pass.
- Reference/RAG tests pass, and ingestion filters remain explicit about
  developer-facing API sources.

### Track 9: Public Export Tightening

Once internal imports use the new folder structure, tighten package root exports
and package `exports` maps to expose only intentional public surfaces.

Acceptance criteria:

- `@aperture-engine/webgpu` root no longer exports every internal backend file.
- Public exports are documented or intentionally test-covered.
- Internal tests use `test-support/` or package-internal paths rather than
  public barrels.
- Package-boundary checks pass.
- Existing examples and generated apps import only public APIs.
- TypeScript consumers receive actionable errors for removed accidental
  internals if they attempt to import them.

## Suggested Order

1. Do a no-behavior-change WebGPU mechanical move first.
2. Split WebGPU app orchestration while examples still provide coverage.
3. Split material families, starting with `standard`.
4. Split shadows, lighting, post, and output modules.
5. Deepen `render` package folders around importer/extraction/preparation.
6. Split `app` internals after the current input/config APIs stabilize.
7. Split `vite-plugin` so generated app behavior is independently testable.
8. Split `cli` command/tool/reference modules.
9. Tighten public exports after internal imports are no longer barrel-dependent.

## Global Acceptance Criteria

- No package-level architecture boundary regresses:
  - `simulation` does not import render, WebGPU, app, browser APIs, or Vite.
  - `render` does not import WebGPU, app runtime, browser APIs, or Vite.
  - `webgpu` owns GPU resources and does not become authoritative gameplay
    state.
  - `app` remains the developer facade over lower packages and generated
    browser/worker bootstrap.
  - `vite-plugin` remains build-time only.
  - `cli` remains tooling/runtime orchestration and does not become required
    runtime state.
- No hidden scene graph is introduced.
- Worker-targeted system modules remain worker-safe.
- Existing examples continue to run through public APIs.
- Existing generated app workflow still works from `aperture.config.ts`,
  automatic system discovery, and generated browser/worker virtual modules.
- `pnpm run typecheck` passes.
- `pnpm run typecheck:test` passes.
- `pnpm run check:boundaries` passes.
- `pnpm run check:examples` passes.
- Relevant package builds pass after each track.
- Targeted unit and Playwright tests pass for every moved domain.
- Any full-suite failures that remain are documented as pre-existing and not
  caused by the refactor.
- Public docs are updated when an export path or package entry point changes.

## Risks And Mitigations

- Risk: Large mechanical moves make review difficult.
  Mitigation: Commit by coherent track and keep the first track import-only.

- Risk: Broad barrels hide accidental public API.
  Mitigation: Migrate internal imports first, then tighten exports in a separate
  track with package-boundary tests.

- Risk: WebGPU files have circular dependencies that are easier to miss after
  moves.
  Mitigation: run package typecheck/build after each small move group and keep
  temporary barrels only during migration.

- Risk: Examples import internals.
  Mitigation: include `check:examples`, package-boundary checks, and targeted
  browser tests in every track that changes exports.

- Risk: Refactor work stalls after broad folders are created.
  Mitigation: do not create empty architecture-only folders except as part of
  moving real files into them.
