# Completed Tasks

Move or summarize completed backlog tasks here.

Format:

## task-id — Title

Completed: YYYY-MM-DD

Summary:

- What changed.
- Important files.
- Validation run.
- Follow-up tasks added.

## task-0001 — Initialize TypeScript package

Completed: 2026-05-15

Summary:

- Added a minimal ESM TypeScript package foundation for Aperture.
- Created `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `src/index.ts`, `test/index.test.ts`, `README.md`, `.gitignore`, and `.prettierignore`.
- Added build, test, lint, format, and format-check scripts.
- Exported placeholder project identity metadata only; no ECS or renderer implementation was started.
- Validation run: `npm install`, `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog already has enough concrete ECS foundation tasks.

## task-0002 — Add repository documentation layout

Completed: 2026-05-15

Summary:

- Verified the required docs and agent files already exist: `AGENTS.md`, `docs/NORTH_STAR.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `agent/BACKLOG.md`, `agent/HANDOFF.md`, and `agent/STATUS.json`.
- Left the existing docs and agent layout intact except for normal end-of-run updates to backlog, completed, handoff, and status files.
- Validation run: covered by the same setup validation from `task-0001`.
- Follow-up tasks added: none.

## task-0003 — Implement entity allocator

Completed: 2026-05-15

Summary:

- Added `Entity`, `EntityAllocator`, `EntityAllocatorStats`, and `entitiesEqual` as the first ECS core primitive.
- Implemented stable numeric entity IDs, generation counters, destroy/reuse behavior, stale reference detection, and allocator stats.
- Exported the entity allocator API from the public entrypoint.
- Added Vitest coverage for create, destroy, ID reuse, stale/malformed references, and handle comparison.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0016 — Adopt EliCS as the ECS foundation

Completed: 2026-05-15

Summary:

- Verified the latest stable `elics` npm version as `3.4.2` with `npm view elics version`.
- Added `elics` as a runtime dependency.
- Replaced the public custom `EntityAllocator` export with a small EliCS-backed ECS entrypoint: `createWorld`, `defineComponent`, `EcsType`, and typed ECS aliases.
- Added Vitest coverage for world creation, entity lifecycle, component registration, add/get/remove/has behavior, stale entity references resolving to `null`, and destroyed entity mutation behavior as supported by EliCS.
- Updated `docs/DECISIONS.md` to reflect the completed EliCS adoption.
- Validation run: `npm run build`, targeted `npm test -- test/ecs/world.test.ts`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0017 — Complete transform and spatial primitive coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md` with source-cited coverage for three.js `Object3D` and spatial primitives, Babylon.js `TransformNode`/culling primitives, PlayCanvas `GraphNode`/shape primitives, `wgpu-matrix`, and EliCS vector storage.
- Confirmed the accepted `wgpu-matrix` direction and specified the MVP wrapper surface for vectors, quaternions, matrices, projections, TRS composition, bounds, rays, planes, and frustums.
- Mapped `LocalTransform`, `Parent`, `WorldTransform`, `HierarchyIndex`, `Ray`, `Aabb`, `BoundingSphere`, `Plane`, and `Frustum` into Aperture's ECS-first model.
- Decided that `WorldTransform.matrix` should be represented in EliCS as four `Vec4` column fields (`col0` through `col3`) rather than an object-valued matrix field.
- Updated `docs/MVP_3D_CONCEPTS.md` to point at the detailed transform/spatial coverage and record the four-column `WorldTransform` storage direction.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0018 — Complete mesh, geometry, and primitive builder coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/MESH_GEOMETRY_COVERAGE.md` with source-cited coverage for three.js `BufferGeometry`/`BufferAttribute`, geometry builders, `Mesh`, `Line`, `Points`, `InstancedMesh`, `BatchedMesh`, `LOD`, and `SkinnedMesh`; Babylon.js `Geometry`, `VertexData`, `Mesh`, `SubMesh`, `MeshBuilder`, builder files, instances/thin instances, LOD, morph targets, and skeletons; and PlayCanvas `Mesh`, `MeshInstance`, `Model`, primitive geometry, render component, batching, skin, and morph files.
- Proposed an Aperture mesh asset schema covering vertex streams, attribute semantics, index formats, submeshes/material slots, primitive topology, local bounds, morph placeholders, skin placeholders, and instancing compatibility keys.
- Classified primitive builders into MVP, soon, and later buckets and specified the ECS binding plan for `MeshHandle`, `MeshRenderer`, material slots, bounds, and render extraction.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the mesh/builder/extraction design direction.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0019 — Complete material, texture, sampler, and render-state coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md` with source-cited coverage for three.js material/texture/render-state files, Babylon.js material/PBR/texture/WebGPU paths, and PlayCanvas material/standard/lit/shader/texture/graphics state files.
- Proposed an Aperture MVP material schema covering `UnlitMaterialAsset`, glTF-style `MetallicRoughnessMaterialAsset`, `DebugNormalMaterialAsset`, texture descriptors, sampler descriptors, alpha/cull/depth/blend defaults, pipeline-key inputs, and structured validation diagnostics.
- Explicitly deferred physical material extensions, shader graph/chunk/plugin systems, arbitrary GLSL, advanced transparency, render-target/video/procedural textures, arrays/3D textures, stencil workflows, and non-MVP material families.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record material pipeline-key and diagnostics requirements.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0020 — Complete camera, view, layer, and render target coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md` with source-cited coverage for three.js camera classes, layers, render targets, and common/WebGPU render context paths; Babylon.js camera/render target/rendering group/layer/post-process paths; and PlayCanvas camera component, layer composition, render action, render target, render pass, and WebGPU target files.
- Proposed an Aperture MVP camera/view schema covering `Camera`, perspective and orthographic projection data, normalized viewport/scissor, clear state, layer masks, priority ordering, `RenderTargetHandle`, `RenderTargetAsset`, and extracted `ViewPacket` data.
- Defined camera ordering as all enabled cameras sorted by priority and stable entity id, while allowing a future primary/active camera resource for API convenience.
- Explicitly deferred camera controls, stereo/XR/cube cameras, post effects, custom projections, advanced camera stacks, and MRT/cube/array/3D render targets.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record camera extraction, render-target, diagnostics, and ordering requirements.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0021 — Complete lighting, environment, and shadow coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md` with source-cited coverage for three.js light/shadow/environment files, Babylon.js light/shadow/clustered/environment files, and PlayCanvas light component, clustered lighting, shadow renderer, skybox, and environment files.
- Proposed an Aperture MVP lighting schema covering ambient, directional, point, and spot lights; linear color/intensity/range/cone fields; layer masks; environment lighting handles; shadow caster/receiver settings; and future shadow request data.
- Defined flat `LightPacket`, `EnvironmentPacket`, and `ShadowRequestPacket` extraction shapes, plus structured diagnostics for missing transforms, invalid light fields, zero masks, unsupported shadows, and missing environment handles.
- Classified lighting and shadow capabilities into MVP, soon, and later buckets and included future implementation acceptance tests.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record light/environment/shadow extraction boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0022 — Complete asset, loader, scene import, and handle coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md` with source-cited coverage for three.js loading manager, core loaders, `GLTFLoader`, `KTX2Loader`, `DRACOLoader`, and texture loaders; Babylon.js scene loader, asset container, glTF loader/validation/material adapters/compression paths; and PlayCanvas asset registry, handlers, GLB parsers, material parsers, texture compression paths, and scene/template handlers.
- Proposed an Aperture asset model covering typed handles, registry status lifecycle, mesh/material/texture/sampler/scene/prefab/animation asset kinds, GLB/glTF MVP subset, import reports, ECS authoring commands, missing/failed asset diagnostics, and agent-readable manifests.
- Defined explicit MVP exclusions for glTF 1.0, Draco/Meshopt compression, KTX/KTX2/Basis/WebP/AVIF texture paths, sparse accessors, non-triangle primitives, advanced glTF extensions, and non-glTF formats.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the asset/import/manifest boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0023 — Complete animation, skinning, morph, and playback coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/ANIMATION_SKINNING_MORPH_COVERAGE.md` with source-cited coverage for three.js animation clips/tracks/mixer/action/property binding/skeleton/skinned mesh/morph paths, Babylon.js animation/runtime/group/bones/skeleton/IK/morph/baked vertex animation paths, and PlayCanvas anim evaluator/controller/component/handler/skeleton/skin/morph paths.
- Proposed an Aperture animation design covering `AnimationClipAsset`, transform and morph tracks, `AnimationPlayer`, `SkinAsset`, `SkinnedMeshBinding`, `MorphTargetSetAsset`, `MorphWeights`, `SkinPalettePacket`, and `MorphWeightsPacket`.
- Defined that transform animation writes ECS `LocalTransform`, while skin palettes and morph weights are derived extraction data consumed by the renderer without making the renderer authoritative.
- Classified simple transform playback and skin/morph extraction as soon, with state graphs, blend trees, layered masks, IK, root motion, baked vertex animation, GPU morph texture packing, and retargeting deferred.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the animation/pose extraction boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass after formatting the new doc.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0024 — Complete interaction, picking, input, collision, and physics-boundary coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md` with source-cited coverage for three.js raycasting/layers/object raycast hooks/spatial math, Babylon.js picking/bounds/input/collision/physics/XR boundaries, and PlayCanvas shape helpers/picker IDs/input/collision/rigid-body/XR files.
- Proposed Aperture interaction schemas for `Ray`, `Aabb`, `BoundingSphere`, `Pickable`, `PickQuery`, `PickHit`, `PickReport`, `Collider`, `RigidBody`, and frame-local input events.
- Defined MVP, soon, and later interaction buckets, structured diagnostics, future XR controller compatibility, and implementation acceptance tests.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record interaction, picking, collider, rigid-body, input, and XR boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass after formatting the new doc.
- Follow-up tasks added: none; continuing with task-0025.

## task-0025 — Complete render extraction, render world, diagnostics, and WebGPU boundary coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md` with source-cited coverage for three.js render lists/render objects/WebGPU backend/resource caches, Babylon.js rendering groups/frame graph/WebGPU engine/pipeline and bind-group caches, and PlayCanvas layers/render actions/frame graph/WebGPU renderer resources.
- Proposed Aperture extraction schemas for `RenderSnapshot`, `ViewPacket`, `MeshDrawPacket`, light/environment/shadow/bounds packets, skip diagnostics, reports, sort keys, batching keys, and renderer resource lifecycle.
- Defined `RenderWorld` as a renderer-owned GPU cache derived from snapshots and asset registries, not an owner of ECS/game state.
- Added worker-thread compatibility notes and future implementation acceptance tests for packet serialization, sorting, diagnostics, and GPU resource ownership.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the render snapshot, render-world, diagnostics, sorting, and report boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; continuing with task-0026.

## task-0026 — Synthesize MVP feature contract and rewrite implementation backlog

Completed: 2026-05-15

Summary:

- Read the completed concept coverage set for tasks 0017-0025 and used it to finalize the MVP implementation contract in `docs/MVP_3D_CONCEPTS.md`.
- Added required MVP concepts, explicitly deferred concepts, ECS component/resource list, asset/material/render packet list, validation/diagnostics list, and proof examples.
- Rewrote `agent/BACKLOG.md` from research-gate tasks into ordered implementation slices `task-0027` through `task-0036`.
- Marked the pre-gate custom-ECS-shaped tasks `task-0004` through `task-0015` as superseded or rewritten.
- Recommended `task-0027 — Add Aperture math module foundation` as the first implementation task after the planning gate.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: ready implementation tasks `task-0027` through `task-0036`.

## task-0027 — Add Aperture math module foundation

Completed: 2026-05-15

Summary:

- Added `wgpu-matrix` as a declared runtime dependency and implemented an Aperture-owned array-first math module with vectors, quaternions, matrices, colors, rays, AABBs, spheres, planes, frustums, TRS/projection/matrix/bounds/ray helpers.
- Exported the math API from the public entrypoint.
- Added focused tests for WebGPU projection depth, TRS composition, matrix inverse/multiply, transformed bounds, and ray intersections.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item; later backlog refill added tasks `task-0037` through `task-0041`.

## task-0028 — Define transform and metadata ECS components

Completed: 2026-05-15

Summary:

- Added EliCS-backed `LocalTransform`, `Parent`, `WorldTransform`, `Enabled`, `Name`, and `DebugMetadata` components.
- Stored `WorldTransform` as four `Vec4` columns and added root/default transform helpers plus per-world component registration helpers.
- Added tests for attach/read/update/remove/query behavior and generation-checked parent references.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0029 — Implement deterministic transform resolution

Completed: 2026-05-15

Summary:

- Added `resolveWorldTransforms`, `TransformResolutionSystem`, resolution reports, and diagnostics for stale parents, missing parent transforms, cycles, and unresolved parents.
- Implemented root, child, multi-level, and reparent world-transform composition from ECS-owned local transforms.
- Added tests for system update, hierarchy composition, reparenting, missing/stale parents, and cycle behavior.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0030 — Add asset handle and registry foundation

Completed: 2026-05-15

Summary:

- Added branded asset handles and factories for mesh, material, texture, sampler, render target, scene, prefab, animation clip, skin, morph target set, and environment map.
- Added `AssetRegistry` with registered/loading/ready/failed status transitions, versions, labels, dependencies, diagnostics, handle serialization, and kind-separated lookups.
- Added tests for handle creation/comparison/serialization, status transitions, missing lookups, diagnostics, version changes, and handle-kind separation.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0031 — Define mesh asset schema and primitive builders

Completed: 2026-05-15

Summary:

- Added `MeshAsset` schema with vertex streams, attributes, index buffers, submeshes, material slots, local AABB/sphere bounds, and skin/morph placeholder fields.
- Added box and plane primitive builders with interleaved position/normal/UV data and uint16 indices.
- Added mesh validation diagnostics for missing position attributes, missing bounds, invalid ranges, unsupported topology, and missing material slots.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0032 — Define material, texture, sampler, and render-state schemas

Completed: 2026-05-15

Summary:

- Added `UnlitMaterialAsset`, `StandardMaterialAsset`, `DebugNormalMaterialAsset`, `TextureAsset`, `SamplerAsset`, render-state descriptors, sampler keys, and material pipeline-key input generation.
- Added validation diagnostics for missing texture/sampler handles, invalid alpha cutoff, unsupported features, invalid texture color space, and incompatible render states.
- Added tests for valid unlit/standard materials, stable sampler keys, invalid texture color space, and representative invalid material state.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0033 — Add render authoring ECS components

Completed: 2026-05-15

Summary:

- Added EliCS-backed `MeshRenderer`, `Camera`, `Visibility`, `RenderLayer`, `RenderOrder`, `Light`, `ShadowCaster`, and `ShadowReceiver` components.
- Added camera/light helper initializers, per-world component registration, and validation helpers for invalid camera/light fields.
- Added tests for component attach/read/update/remove/query behavior and invalid camera/light diagnostics.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0034 — Define render snapshot and packet types

Completed: 2026-05-15

Summary:

- Added `RenderSnapshot`, view/mesh/light/environment/shadow/bounds packet types, sort keys, batch compatibility keys, diagnostics, reports, and worker-compatibility comments.
- Added deterministic stable render ID, sort-key, and batch-key helpers.
- Added tests for stable render IDs, queue/depth sorting, batch keys, and structured-clone-friendly snapshot shape.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0037` covers tightening view-projection matrix extraction and diagnostics.

## task-0035 — Implement initial render extraction system

Completed: 2026-05-15

Summary:

- Added `extractRenderSnapshot` to read ECS world transforms, mesh renderers, cameras, visibility, layers, render order, and lights into snapshot packets using asset registry metadata.
- Added initial diagnostics for disabled/invisible entities, missing transforms, missing/not-ready assets, invalid meshes, zero masks, and layer mismatches.
- Added tests for successful extraction, camera ordering, layer filtering, skipped renderables, missing handles, and report counts.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0037` addresses known extraction hardening gaps.

## task-0036 — Add WebGPU support detection boundary

Completed: 2026-05-15

Summary:

- Added a WebGPU-only capability and initialization boundary with injected navigator/canvas/context-like objects.
- Distinguished missing `navigator.gpu`, adapter failure, device request failure, context failure, and device loss.
- Added tests for unsupported paths, injected success, context configuration, and device-loss promise handling.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0039` covers the first clear-pass scaffolding on top of this boundary.

## task-0037 — Harden render extraction matrices and diagnostics

Completed: 2026-05-15

Summary:

- Updated view extraction so `viewProjectionMatrixOffset` stores a real projection-view matrix.
- Added extraction diagnostics/tests for loading/failed mesh and material assets, invalid mesh submesh codes, and material slots outside the MVP `material0Id` through `material3Id` fields.
- Preserved mesh validation diagnostic codes in render diagnostics.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0045` covers render-target extraction from camera authoring data.

## task-0038 — Add render world lifecycle foundation

Completed: 2026-05-15

Summary:

- Added `RenderWorld` as an ECS-free render cache that consumes `RenderSnapshot` mesh draw packets.
- Implemented create/update/remove behavior keyed by stable render IDs with GPU-resource placeholders and duplicate render ID diagnostics.
- Added tests for lifecycle transitions, idempotent repeated snapshots, removal, and duplicate IDs.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0042` covers resource binding updates on top of this foundation.

## task-0039 — Add WebGPU canvas clear pass scaffolding

Completed: 2026-05-15

Summary:

- Added `clearWebGpuCanvas` using injected device/context-like objects to get the current texture, create a view, encode a clear render pass, finish, and submit.
- Clear color/depth/stencil values come from plain render data and the module has no ECS imports.
- Added tests for successful command ordering and failure modes for missing queue, command encoder, current texture, and texture view.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0043` covers the next WebGPU resource boundary for buffers.

## task-0040 — Add asset dependency diagnostics and manifest report

Completed: 2026-05-15

Summary:

- Added asset dependency inspection for missing, loading, failed, and circular dependency paths.
- Added an agent-readable manifest report with counts by kind/status and dependency edges.
- Added tests for ready dependency chains, missing/loading/failed dependencies, circular dependencies, and manifest summaries.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none directly; later asset loader work should build on these diagnostics.

## task-0041 — Add extraction validation for cameras and lights

Completed: 2026-05-15

Summary:

- Wired camera and light authoring validators into render extraction.
- Invalid cameras now emit diagnostics for projection fields, clip range, viewport/scissor rectangles, and zero layer masks before being skipped.
- Invalid lights now emit diagnostics for intensity, range, spot cone, and zero layer masks before being skipped.
- Added tests showing invalid cameras/lights are skipped deterministically while valid views, mesh draws, and lights still extract.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none directly; `task-0045` continues camera extraction work with render targets.

## task-0042 — Add render-world resource binding updates

Completed: 2026-05-15

Summary:

- Added `RenderWorld.updateResourceBindings` to attach, replace, and clear renderer-owned mesh/material resource keys by stable render ID.
- Binding updates now return structured success/failure results with diagnostics for missing render IDs.
- Existing bindings are preserved across matching snapshots and removed when render objects are removed.
- Added tests for attach/replace/clear behavior, missing render IDs, and snapshot preservation/removal.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0050` covers draw readiness planning from render-world resource bindings.

## task-0043 — Add WebGPU buffer creation boundary

Completed: 2026-05-15

Summary:

- Added `createWebGpuBuffer` with typed descriptors for label, size, usage, mapping, and optional initial data.
- Buffer creation uses injected device and queue-like objects and reports invalid sizes, missing `createBuffer`, missing upload support, and zero-length initial data.
- Added tests for successful creation, initial data upload ordering, invalid data, and missing device support.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0048` and `task-0049` can feed upload/packing data into this boundary later.

## task-0044 — Add shader module creation diagnostics

Completed: 2026-05-15

Summary:

- Added `createWebGpuShaderModule` with WGSL source, label, expected entry point validation, and injected `createShaderModule` support.
- Reads `compilationInfo` when available and maps warning/error/info diagnostics with line and column metadata.
- Returns compilation errors as structured failures while allowing warning-only results to succeed.
- Added tests for successful module creation, warning diagnostics, error diagnostics, missing device support, and missing entry points.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0051` covers the first built-in unlit shader source.

## task-0045 — Extract camera render target handles

Completed: 2026-05-15

Summary:

- Camera extraction now parses non-empty `renderTargetId` values with the `render-target:<id>` handle convention.
- Valid render target ids populate `ViewPacket.renderTarget`; empty ids keep canvas targeting with `renderTarget: null`.
- Invalid non-empty ids emit `render.camera.invalidRenderTargetHandle` and are treated as canvas targets without changing view ordering.
- Added tests for default canvas cameras, valid render targets, invalid ids, and stable priority ordering.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: render-target asset validation can be added when render-target assets are introduced.

## task-0046 — Add transform buffer packing from render snapshots

Completed: 2026-05-15

Summary:

- Added `packSnapshotTransforms` to pack mesh draw world matrices from `RenderSnapshot.transforms` into a contiguous `Float32Array`.
- The packer returns per-render-id source and packed offsets, reusing packed data when multiple draws share the same source transform.
- Missing or out-of-range transform offsets produce diagnostics without querying ECS.
- Added tests for stable draw order, shared transform offsets, missing transform data, and empty snapshots.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0048` and `task-0050` can consume packed transform/resource readiness data.

## task-0052 — Refactor module folder organization

Completed: 2026-05-15

Summary:

- Split broad `assets`, `mesh`, `materials`, `math`, `rendering`, and `transform` implementation buckets into focused files while preserving public barrel exports.
- Split the broad math test into projection, matrix, and bounds/ray test files so tests mirror the new module layout where most useful.
- Preserved architecture boundaries: transform logic remains ECS-owned, render extraction remains WebGPU-free, WebGPU modules remain ECS-free, and no scene graph or WebGL fallback was introduced.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none directly; this cleared the source tree for the renderer slices below.

## task-0047 — Add WebGPU render pipeline cache scaffold

Completed: 2026-05-15

Summary:

- Added `WebGpuRenderPipelineCache` with stable keys derived from shader label, color/depth formats, primitive topology, and render batch compatibility data.
- Pipeline creation is injected through a `createRenderPipeline`-like device and only occurs on cache misses.
- Results distinguish cache hits, misses, and missing `createRenderPipeline` support.
- Added tests for stable keys, reuse, format/topology differences, and missing device support.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0048 — Add mesh GPU upload planning descriptors

Completed: 2026-05-15

Summary:

- Added `createMeshGpuUploadPlan` to convert `MeshAsset` data into WebGPU-independent vertex/index upload descriptors with stable labels, byte lengths, usage hints, source views, and submesh ranges.
- Added structured diagnostics for missing vertex stream data, invalid vertex stream data, and invalid index data.
- Added tests for box and plane upload plans, stable labels, source preservation, missing stream data, and invalid index data.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0049 — Add unlit material uniform packing

Completed: 2026-05-15

Summary:

- Added `packUnlitMaterial` with documented RGBA `Float32Array` layout for unlit material uniforms.
- Returned texture and sampler dependency keys for later renderer resource binding.
- Added diagnostics for missing texture/sampler handles and unsupported material kinds.
- Added tests for default, tinted, textured, missing-binding, and unsupported material cases.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0050 — Add render-world draw readiness planning

Completed: 2026-05-15

Summary:

- Added render-world draw readiness reporting that classifies active render objects as ready or blocked by missing mesh/material resource keys.
- Ready records preserve render ID, draw packet, resource keys, and batch key; blocked records preserve render ID, packet, and missing resource reasons.
- Added diagnostics for empty render worlds, missing mesh resources, and missing material resources.
- Added tests for all-ready, partially blocked, all-blocked, and empty render-world states.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0051 — Add minimal unlit WGSL shader source module

Completed: 2026-05-15

Summary:

- Added built-in unlit mesh WGSL source as data with expected `vs_main` and `fs_main` entry point metadata.
- Added shader metadata for view-projection, world-transform, and unlit-material bindings without creating GPU objects.
- Added metadata validation diagnostics for missing label, code, entry points, and required bindings.
- Added tests that validate metadata and use the existing injected shader module helper to check entry points.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0053` through `task-0057` continue toward draw submission planning without encoding render passes yet.

## task-0053 — Add camera uniform packing from render snapshots

Completed: 2026-05-15

Summary:

- Added `packSnapshotViewUniforms` to pack `ViewPacket.viewProjectionMatrixOffset` matrices from `RenderSnapshot.viewMatrices` into contiguous camera uniform data.
- Added per-view source/packed offset records keyed by `viewId`.
- Added diagnostics for empty snapshots, duplicate view IDs, missing matrix data, and out-of-range matrix offsets.
- Added tests for one view, multiple ordered views, missing/out-of-range data, duplicates, and empty snapshots.
- Validation run: `npm run lint`, targeted view-pack tests, and `npm test` all pass during the continued run.

## task-0054 — Map mesh upload plans to buffer descriptors

Completed: 2026-05-15

Summary:

- Added `createMeshUploadBufferDescriptors` to map `MeshGpuUploadPlan` data to `WebGpuBufferDescriptor` values without creating buffers.
- Added typed default WebGPU buffer usage constants for vertex, index, uniform, and copy-destination flags.
- Preserved stable labels, byte lengths, usage flags, and source data views for later buffer creation.
- Added diagnostics for null plans, empty vertex uploads, and invalid usage flag configuration.
- Added tests for box meshes, non-indexed plane meshes, custom usage flags, null plans, empty uploads, and invalid usage flags.
- Validation run: `npm run lint`, targeted mesh buffer descriptor tests, and `npm test` all pass during the continued run.

## task-0055 — Add unlit material buffer descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitMaterialBufferDescriptor` to convert packed unlit material uniform data to `WebGpuBufferDescriptor` values.
- Preserved texture and sampler dependency keys for later bind group/resource binding work.
- Added diagnostics for null packed material input, invalid uniform data, and invalid usage flags.
- Added tests for default unlit, tinted unlit, textured dependencies, null input, invalid uniform data, and invalid usage flags.
- Validation run: `npm run lint`, targeted unlit material buffer tests, and `npm test` all pass during the continued run.

## task-0056 — Add render-world draw package planning

Completed: 2026-05-15

Summary:

- Added `planRenderWorldDrawPackages` to combine ready render-world draws with packed transform offsets into serializable draw package records.
- Draw packages preserve render ID, packet, resource keys, batch key, sort key, and packed transform offset.
- Added diagnostics for blocked draw inputs and ready draws missing packed transform offsets while preserving transform pack diagnostics.
- Added tests for ready packages, missing transforms, blocked inputs, transform diagnostics, and stable sort order.
- Validation run: `npm run lint`, targeted draw package tests, and `npm test` all pass during the continued run.

## task-0057 — Add unlit pipeline descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitPipelineDescriptorPlan` to produce `WebGpuRenderPipelineCreateDescriptor`-compatible data and cache keys from unlit shader metadata, formats, topology, and batch keys.
- Added diagnostics for missing shader metadata, missing color format, unsupported topology, and missing batch key fields.
- Added tests for descriptor shape, cache key content, format/topology differences, invalid shader metadata, missing color format, and missing batch fields.
- Validation run: `npm run lint`, targeted unlit pipeline descriptor tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0058` through `task-0062` continue renderer resource creation and frame assembly readiness.

## task-0058 — Add mesh GPU buffer creation helper

Completed: 2026-05-15

Summary:

- Added `createMeshGpuBuffers` to consume mesh buffer descriptor plans and create vertex/index resources through the injected `createWebGpuBuffer` boundary.
- Returned renderer-owned mesh, vertex, and index resource keys plus created buffer handles.
- Added diagnostics for null descriptor plans, vertex buffer creation failures, index buffer creation failures, and partial failures.
- Added tests for indexed meshes, non-indexed meshes, null plans, vertex failures, and index failures.
- Validation run: `npm run lint`, targeted mesh buffer resource tests, and `npm test` all pass during the continued run.

## task-0059 — Add unlit material uniform buffer creation helper

Completed: 2026-05-15

Summary:

- Added `createUnlitMaterialGpuBuffer` to create unlit material uniform resources through the injected `createWebGpuBuffer` boundary.
- Returned renderer-owned material buffer keys, created uniform buffer handles, and preserved texture/sampler dependency keys.
- Added diagnostics for null descriptor plans and buffer creation failure.
- Added tests for default unlit material resources, textured dependency preservation, null plans, and buffer failures.
- Validation run: `npm run lint`, targeted unlit material buffer resource tests, and `npm test` all pass during the continued run.

## task-0060 — Add renderer resource key conventions

Completed: 2026-05-15

Summary:

- Added stable renderer resource key helpers for mesh buffers, mesh vertex/index buffers, material buffers, shader modules, and render pipelines.
- Updated mesh/material buffer resource helpers to use the shared key conventions.
- Added tests for stable keys, resource-kind separation, and invalid empty ids.
- Validation run: `npm run lint`, targeted resource key/resource helper tests, and `npm test` all pass during the continued run.

## task-0061 — Add pipeline cache descriptor integration helper

Completed: 2026-05-15

Summary:

- Added `getOrCreateRenderPipelineFromPlan` to connect unlit pipeline descriptor plans to `WebGpuRenderPipelineCache`.
- Added `keyInput` to unlit pipeline descriptor plans so cache integration does not parse serialized cache keys.
- Results preserve cache hit/miss status and report null descriptor plans or missing pipeline device support.
- Added tests for cache miss creation, cache hit reuse, missing device support, and null descriptor plans.
- Validation run: `npm run lint`, targeted pipeline cache integration tests, and `npm test` all pass during the continued run.

## task-0062 — Add frame assembly readiness report

Completed: 2026-05-15

Summary:

- Added `createFrameAssemblyReadinessReport` to aggregate draw package counts, view uniform packing diagnostics, mesh/material resource creation results, and pipeline cache outcomes.
- Reports ready state, blocked count, warning/error totals, view counts, resource counts, and pipeline hit/miss counts.
- Added tests for all-ready inputs, missing mesh/material resources, pipeline failures, and empty-frame inputs.
- Validation run: `npm run lint`, targeted frame readiness tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0063` through `task-0067` continue view/shader resource helpers and resource summaries.

## task-0063 — Add view uniform buffer descriptor planning

Completed: 2026-05-15

Summary:

- Added `createViewUniformBufferDescriptor` to convert packed view uniform data into `WebGpuBufferDescriptor` values without creating buffers.
- Preserved per-view packed offset records for later resource binding.
- Added diagnostics for empty packed data, invalid usage flags, and carried view-pack diagnostics.
- Added tests for one view, multiple views, empty data, invalid usage flags, and carried diagnostics.
- Validation run: `npm run lint`, targeted view uniform buffer descriptor tests, and `npm test` all pass during the continued run.

## task-0064 — Add view uniform GPU buffer creation helper

Completed: 2026-05-15

Summary:

- Added `createViewUniformGpuBuffer` to create view uniform resources through the injected `createWebGpuBuffer` boundary.
- Added a renderer-owned view uniform resource key helper and preserved per-view offset records in created resources.
- Added diagnostics for null descriptor plans and buffer creation failure.
- Added tests for successful creation and buffer failure.
- Validation run: `npm run lint`, targeted view uniform buffer resource tests, and `npm test` all pass during the continued run.

## task-0065 — Add shader module resource helper

Completed: 2026-05-15

Summary:

- Added `createShaderModuleResource` to create shader module resources through the injected shader module helper.
- Returned renderer-owned shader module keys, module handles, and expected entry points.
- Preserved shader compilation diagnostics and added diagnostics for null descriptors and shader creation failures.
- Added tests for built-in unlit shader success, null descriptor input, missing device support, and warning diagnostics.
- Validation run: `npm run lint`, targeted shader resource tests, and `npm test` all pass during the continued run.

## task-0066 — Add material texture dependency readiness report

Completed: 2026-05-15

Summary:

- Added `checkMaterialDependencyReadiness` to validate packed material texture/sampler dependency keys against available renderer resource key sets.
- Added diagnostics for missing texture resources and missing sampler resources.
- Added tests for no-texture materials, all dependencies available, missing texture, missing sampler, and both missing.
- Validation run: `npm run lint`, targeted material dependency readiness tests, and `npm test` all pass during the continued run.

## task-0067 — Add render resource summary report

Completed: 2026-05-15

Summary:

- Added `createRenderResourceSummaryReport` to summarize mesh, material, view uniform, shader, and pipeline resources.
- Reports counts by resource kind plus warning/error totals while preserving source diagnostic codes/messages.
- Added tests for all-ready resources, partial failures, and empty resource inputs.
- Validation run: `npm run lint`, targeted resource summary tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0068` through `task-0072` continue diagnostics, batching, and inspection reports.

## task-0068 — Add diagnostic summary helpers

Completed: 2026-05-15

Summary:

- Added `summarizeDiagnostics` with total counts, severity counts, code counts, and configurable default severity.
- Exported the diagnostics helper from the public entrypoint.
- Added tests for empty diagnostics, mixed severities, repeated codes, and default severity override behavior.
- Validation run: `npm run lint`, targeted diagnostic summary tests, and `npm test` all pass during the continued run.

## task-0069 — Add draw package batching report

Completed: 2026-05-15

Summary:

- Added `createDrawPackageBatchingReport` to group draw packages by batch compatibility key.
- Reports draw count, batch count, stable groups, render IDs, and unique mesh/material resource keys.
- Added diagnostics for empty package input.
- Added tests for single batch grouping, multiple batches, feature/topology grouping, stable ordering, and empty input.
- Validation run: `npm run lint`, targeted batching report tests, and `npm test` all pass during the continued run.

## task-0070 — Add frame report data type

Completed: 2026-05-15

Summary:

- Added `createFrameReport` to combine frame assembly readiness, resource summary, and batching reports into a serializable frame report.
- Frame reports include ready state, frame id, draw count, batch count, resource counts, and diagnostic summary.
- Added tests for ready frames, blocked frames, empty frames, and diagnostic totals.
- Validation run: `npm run lint`, targeted frame report tests, and `npm test` all pass during the continued run.

## task-0071 — Add render packet inspection report

Completed: 2026-05-15

Summary:

- Added `inspectRenderSnapshot` to summarize render snapshot packet counts, transform/view matrix float counts, unique mesh/material/render-target handle keys, and diagnostics.
- Added diagnostics for empty snapshots while preserving snapshot diagnostics.
- Added tests for populated snapshots, empty snapshots, snapshot diagnostics, and handle uniqueness.
- Validation run: `npm run lint`, targeted snapshot inspection tests, and `npm test` all pass during the continued run.

## task-0072 — Add render package inspection report

Completed: 2026-05-15

Summary:

- Added `inspectRenderPackages` to summarize package count, render IDs, mesh/material resource keys, batch keys, and packed transform offsets.
- Added diagnostics for empty package input and duplicate render IDs.
- Added tests for populated packages, duplicate render IDs, and empty package input.
- Validation run: `npm run lint`, targeted package inspection tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0073` through `task-0077` continue cloneability, JSON, and summary merge helpers.

## task-0073 — Add render snapshot cloneability validation

Completed: 2026-05-15

Summary:

- Added `validateRenderSnapshotCloneability` to verify `RenderSnapshot` structured-clone compatibility with injectable clone behavior.
- Added diagnostics for clone failures and invalid `Float32Array` buffer shapes.
- Added tests for valid snapshots, injected clone failures, invalid transform buffers, and invalid view matrix buffers.
- Validation run: `npm run lint`, targeted snapshot clone tests, and `npm test` all pass during the continued run.

## task-0074 — Add frame report JSON helper

Completed: 2026-05-15

Summary:

- Added `frameReportToJsonValue` and `frameReportToJson` for stable JSON-safe frame report output.
- Preserved frame id, ready state, draw count, batch count, resource counts, and diagnostic summary.
- Added tests for JSON-safe values, blocked reports, and stable repeated string output.
- Validation run: `npm run lint`, targeted frame report JSON tests, and `npm test` all pass during the continued run.

## task-0075 — Add render snapshot diagnostic summary report

Completed: 2026-05-15

Summary:

- Added `summarizeRenderSnapshotDiagnostics` to summarize `RenderSnapshot.diagnostics` with the shared diagnostic summary helper.
- Included frame id and packet counts in the summary report.
- Added tests for snapshots without diagnostics and snapshots with mixed severity/repeated diagnostic codes.
- Validation run: `npm run lint`, targeted snapshot diagnostic tests, and `npm test` all pass during the continued run.

## task-0076 — Add render resource summary merge helper

Completed: 2026-05-15

Summary:

- Added `mergeRenderResourceSummaryReports` to aggregate multiple render resource summary reports.
- Recomputes warning/error totals from merged diagnostics instead of trusting source counts.
- Added tests for empty inputs, all-ready count summing, and diagnostics preservation/recomputed totals.
- Validation run: `npm run lint`, targeted resource summary merge tests, and `npm test` all pass during the continued run.

## task-0077 — Add draw batching summary merge helper

Completed: 2026-05-15

Summary:

- Added `mergeDrawPackageBatchingReports` to aggregate draw and batch counts across batching reports.
- Preserves diagnostics and reports contributing report count.
- Added tests for empty inputs, multiple reports, and diagnostics preservation.
- Validation run: `npm run lint`, targeted batching report merge tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0078` through `task-0082` continue bind group planning, draw descriptors, and renderer assembly reports.

## task-0078 — Add unlit bind group layout descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitBindGroupLayoutPlan` to produce data-only bind group layout descriptors for view, transform, and material bindings.
- Layout metadata matches `UNLIT_MESH_SHADER.bindings`.
- Added diagnostics for missing binding metadata and unsupported binding resource kinds.
- Added tests for descriptor shape, metadata mismatch, and unsupported resource kind.
- Validation run: `npm run lint`, targeted unlit bind group layout tests, and `npm test` all pass during the continued run.

## task-0079 — Add unlit bind group descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitBindGroupDescriptorPlan` to produce data-only bind group entries from view, transform, and material resource keys.
- Added diagnostics for missing view, transform, and material resources.
- Added tests for all resources present and all missing resource diagnostics.
- Validation run: `npm run lint`, targeted unlit bind group descriptor tests, and `npm test` all pass during the continued run.

## task-0080 — Add draw command descriptor planning

Completed: 2026-05-15

Summary:

- Added `createDrawCommandDescriptors` to create serializable draw descriptors from render packages and mesh GPU buffer resources.
- Draw descriptors include render ID, topology, mesh/material resource keys, vertex buffer keys, optional index buffer key/count, and packed transform offset.
- Added diagnostics for missing mesh resources.
- Added tests for indexed draws, non-indexed draws, missing mesh resources, and stable render ID ordering.
- Validation run: `npm run lint`, targeted draw command descriptor tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0081` through `task-0085` continue resource lifecycle, bind group cache/creation, and render-pass draw list planning.

## task-0081 — Add render resource lifecycle clear report

Completed: 2026-05-15

Summary:

- Added `createRenderResourceLifecycleReport` to diff previous/next renderer-owned resource key sets for mesh, material, view, shader, and pipeline resources.
- Reports retained, created, and removed keys by resource kind plus total counts and a `hasChanges` flag.
- Added tests for unchanged resources, added resources, removed resources, and mixed replacement.
- Validation run: targeted lifecycle tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0082 — Add renderer assembly smoke report

Completed: 2026-05-15

Summary:

- Added `createRendererAssemblySmokeReport` to combine snapshot inspection, cloneability validation, package inspection, resource summary, and frame report outputs.
- Reports section presence/readiness, summary counts, and actionable `rendererAssembly.*` diagnostics for missing or incomplete sections.
- Added tests for all sections present, missing snapshot, missing packages, and missing resources.
- Validation run: targeted smoke report tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0083 — Add bind group layout cache scaffold

Completed: 2026-05-15

Summary:

- Added `WebGpuBindGroupLayoutCache` and `createWebGpuBindGroupLayoutCacheKey` for descriptor-like bind group layout entries.
- Cache keys normalize entry order and ignore labels; layouts are created through an injected `createBindGroupLayout` boundary only on misses.
- Added tests for key stability, cache reuse, descriptor differences, and missing device support.
- Validation run: targeted bind group layout cache tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0084 — Add bind group creation helper

Completed: 2026-05-15

Summary:

- Added `createUnlitBindGroups` to create renderer-owned unlit bind group resources from descriptor plans and injected layout resources.
- Added `bindGroupResourceKey` and diagnostics for null plans, invalid descriptor plans, missing layouts, and missing `createBindGroup` support.
- Added tests for successful creation, null plans, missing layouts, and missing device support.
- Validation run: targeted unlit bind group/resource key tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0085 — Add render pass draw list planning

Completed: 2026-05-15

Summary:

- Added `planRenderPassDrawList` to combine draw command descriptors, render pipeline resources, and unlit bind group resources into ordered render-pass draw records.
- Extended draw command descriptors with a per-draw `pipelineKey`.
- Added diagnostics for missing pipeline resources and missing bind group resources.
- Added tests for all-ready draw lists, missing pipeline, missing bind group, and stable ordering.
- Validation run: targeted render pass draw list tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.
- Follow-up tasks added: `task-0086` through `task-0090` continue draw counts, render-pass resource resolution, command planning, command execution, and submission-path smoke reporting.

## task-0086 — Carry vertex draw counts into mesh GPU resources

Completed: 2026-05-15

Summary:

- Preserved vertex counts from mesh upload plans into WebGPU mesh buffer descriptor plans.
- Added vertex counts to mesh GPU vertex buffer resources, mesh GPU buffer resources, draw command descriptors, and render-pass draw list records.
- Added/updated tests for indexed meshes, non-indexed meshes, draw descriptors, resource summaries, and draw-list records.
- Validation run: targeted mesh/draw tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0087 — Add render pass resource resolver

Completed: 2026-05-15

Summary:

- Added `resolveRenderPassResources` to resolve render-pass draw list keys into pipeline handles, bind group handles, vertex buffers, and optional index buffers.
- Added diagnostics for missing pipeline handles, bind group handles, vertex buffers, and index buffers.
- Added tests for all-ready indexed draws and each missing-resource diagnostic path.
- Validation run: targeted render-pass resource tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0088 — Add render pass command planning

Completed: 2026-05-15

Summary:

- Added `planRenderPassCommands` to produce data-only pass command records for pipelines, bind groups, vertex/index buffers, and indexed/non-indexed draws.
- Added invalid index/vertex draw count diagnostics.
- Added tests for indexed commands, non-indexed commands, multiple bind groups, stable ordering, and invalid counts.
- Validation run: targeted command planning tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0089 — Add injected render pass command executor

Completed: 2026-05-15

Summary:

- Added `executeRenderPassCommands` to execute planned pass command records against an injected pass-encoder-like object.
- Reports command counts, executed/skipped counts, draw call counts, and missing-method diagnostics.
- Added tests for indexed execution, non-indexed execution, and missing encoder methods.
- Validation run: targeted command executor tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0090 — Add render pass assembly smoke report

Completed: 2026-05-15

Summary:

- Added `createRenderPassAssemblySmokeReport` to combine draw-list, resource-resolution, command-planning, and command-execution reports.
- Reports section presence/readiness, source diagnostics, and actionable `renderPassAssembly.*` diagnostics.
- Added tests for all sections ready, missing resolved resources, missing command plan, and failed execution.
- Validation run: targeted render-pass assembly smoke tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0091` through `task-0095` continue render-pass attachment planning, begin/end, command-buffer finish, queue submit, and submission smoke reporting.

## task-0091 — Add render pass attachment descriptor planning

Completed: 2026-05-15

Summary:

- Added `createRenderPassAttachmentPlan` for data-only color/depth attachment descriptors.
- Supports clear/load/store settings, clear color conversion, and optional depth clear settings.
- Added diagnostics for missing color targets, invalid clear colors, and invalid depth clear values.
- Added tests for color-only, color+depth, missing color target, invalid color clear, and invalid depth clear.
- Validation run: targeted attachment tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0092 — Add injected render pass begin/end helper

Completed: 2026-05-15

Summary:

- Added `beginPlannedRenderPass` and `endPlannedRenderPass` for injected command-encoder/pass-encoder boundaries.
- Added diagnostics for null attachment plans, missing `beginRenderPass`, and missing `end`.
- Added tests for begin success, null plans, missing begin support, end success, and missing end support.
- Validation run: targeted lifecycle tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0093 — Add frame command encoder finish helper

Completed: 2026-05-15

Summary:

- Added `finishCommandEncoder` to finish an injected command encoder into a renderer-owned command buffer resource.
- Added `commandBufferResourceKey`.
- Added diagnostics for missing `finish` support.
- Added tests for successful finish, missing finish support, and command buffer resource key generation.
- Validation run: targeted command-buffer tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0094 — Add queue submission helper

Completed: 2026-05-15

Summary:

- Added `submitCommandBuffers` for injected queue submission of renderer-owned command buffer resources.
- Reports submitted/skipped counts, command buffer keys, and diagnostics.
- Added diagnostics for missing `submit` support and empty command buffer input.
- Added tests for ordered submission, missing submit support, and empty input.
- Validation run: targeted queue submit tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0095 — Add frame submission smoke report

Completed: 2026-05-15

Summary:

- Added `createFrameSubmissionSmokeReport` to combine attachment planning, pass begin, command execution, pass end, command-buffer finish, and queue submit reports.
- Reports section presence/readiness, source diagnostics, and actionable `frameSubmission.*` diagnostics.
- Added tests for ready submission, missing attachment plan, failed begin, failed finish, and failed submit.
- Validation run: targeted frame submission smoke tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0096` through `task-0100` continue command encoder creation, texture view acquisition, frame boundary assembly, smoke reporting, and clear helper compatibility.

## task-0096 — Add command encoder creation helper

Completed: 2026-05-15

Summary:

- Added `createCommandEncoderResource` for injected command encoder creation.
- Added `commandEncoderResourceKey`.
- Added diagnostics for missing `createCommandEncoder` support.
- Added tests for successful creation, missing device support, and command encoder resource key generation.
- Validation run: targeted command encoder tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0097 — Add current texture view acquisition helper

Completed: 2026-05-15

Summary:

- Added `createCurrentTextureColorTarget` to acquire current texture views through injected context/texture-like objects.
- Returns color attachment target inputs for render-pass attachment planning.
- Added diagnostics for missing current textures and missing texture view support.
- Added tests for success, missing texture, and missing view support.
- Validation run: targeted current texture tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0098 — Add frame boundary assembly helper

Completed: 2026-05-15

Summary:

- Added `assembleFrameBoundary` to compose current texture acquisition, attachment planning, command encoder creation, pass begin, command execution, pass end, command-buffer finish, and queue submit helpers.
- Returns all intermediate reports for inspection and stops dependent steps after failed boundaries.
- Added tests for all-ready assembly and failures in texture view, begin, execution, finish, and submit.
- Validation run: targeted frame boundary tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0099 — Add frame boundary smoke report

Completed: 2026-05-15

Summary:

- Added `createFrameBoundarySmokeReport` to summarize full frame-boundary assembly section readiness.
- Reports section readiness for texture, attachments, encoder, begin, execution, end, finish, and submit.
- Added tests for all-ready, missing texture/attachments, missing encoder, failed execution, and failed submit.
- Validation run: targeted frame-boundary smoke tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0100 — Add clear helper compatibility report

Completed: 2026-05-15

Summary:

- Added `createClearCompatibilityReport` to verify frame-boundary helper coverage for clear-pass requirements.
- Reports missing texture view, command encoder, pass begin/end, command buffer finish, and queue submit capabilities.
- Added tests for all-ready compatibility, missing texture view, missing command encoder, missing queue submit, and missing pass end.
- Validation run: targeted clear compatibility tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0101` through `task-0105` continue frame-boundary diagnostics, JSON summaries, fixtures, clear parity, and aggregate validation.

## task-0101 — Add frame boundary diagnostic summary

Completed: 2026-05-15

Summary:

- Added `summarizeFrameBoundaryDiagnostics` to summarize diagnostics from the full frame-boundary assembly path.
- Uses the shared diagnostic summary helper and treats source diagnostics without severity as warnings.
- Added tests for all-ready boundaries, mixed diagnostics, and repeated diagnostic codes.
- Validation run: targeted frame-boundary diagnostics tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0102 — Add frame boundary JSON helper

Completed: 2026-05-15

Summary:

- Added `frameBoundaryReportToJsonValue` and `frameBoundaryReportToJson`.
- JSON-safe summaries omit GPU handles and include section readiness, command/submission counts, and diagnostic summary.
- Added tests for ready reports, failed reports without handle leakage, and stable repeated JSON output.
- Validation run: targeted frame-boundary JSON tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0103 — Add frame boundary fixture factory

Completed: 2026-05-15

Summary:

- Added a test-only `frameBoundaryFixture` helper for frame-boundary report fixtures.
- Consolidated duplicated local fixtures in clear compatibility and frame-boundary diagnostic tests.
- Validation run: targeted fixture-using tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0104 — Add clear helper parity report

Completed: 2026-05-15

Summary:

- Added `createClearParityReport` to compare `clearWebGpuCanvas` outcomes with clear compatibility reports.
- Reports matching success, matching failure, and mismatch diagnostics.
- Added tests for matching success, matching failure, clear-failed/boundary-ready, and clear-ready/boundary-failed cases.
- Validation run: targeted clear parity tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0105 — Add frame boundary validation aggregate

Completed: 2026-05-15

Summary:

- Added `createFrameBoundaryValidationReport` to aggregate frame-boundary smoke, clear compatibility, and diagnostic summary outputs.
- Reports overall readiness, diagnostic counts, and aggregate failure diagnostics.
- Added tests for all-ready, smoke failure, compatibility failure, and diagnostic warning/error cases.
- Validation run: targeted frame-boundary validation tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0106` through `task-0110` continue clear helper integration, clear parity JSON, diagnostic summary merging, submission metrics, and MVP frame readiness aggregation.

## task-0106 — Refactor clear helper through frame boundary helpers

Completed: 2026-05-15

Summary:

- Routed `clearWebGpuCanvas` through the injected frame-boundary helpers while preserving its public `WebGpuClearResult` contract.
- Preserved the clear pass call order: texture view, command encoder, pass begin, pass end, command buffer finish, queue submit.
- Added/updated tests for successful clear behavior and missing command encoder support.
- Validation run: targeted clear/frame-boundary tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0107 — Add clear parity JSON helper

Completed: 2026-05-15

Summary:

- Added JSON-safe clear parity report helpers: `clearParityReportToJsonValue` and `clearParityReportToJson`.
- Included clear readiness, boundary readiness, overall readiness, and diagnostics in stable output.
- Added tests for matching success, matching failure, mismatch cases, and stable repeated JSON output.
- Validation run: targeted clear parity JSON tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0108 — Add frame boundary report merge helper

Completed: 2026-05-15

Summary:

- Added `mergeFrameBoundaryDiagnosticSummaryReports` to merge frame-boundary diagnostic summary reports.
- Sums diagnostic totals and severity/code counts while tracking contributing report count.
- Added tests for empty input, multiple ready reports, mixed diagnostics, and repeated diagnostic codes.
- Validation run: targeted frame-boundary diagnostic merge tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0109 — Add command submission metrics report

Completed: 2026-05-15

Summary:

- Added `createCommandSubmissionMetricsReport` to summarize command execution, command-buffer finish, and queue submission reports.
- Reports commands, draw calls, command buffers, submitted buffers, skipped commands, and skipped submissions.
- Added diagnostics for failed execution, failed finish, and failed submit paths.
- Validation run: targeted command submission metrics tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0110 — Add MVP frame readiness aggregate

Completed: 2026-05-15

Summary:

- Added `createMvpFrameReadinessReport` to aggregate renderer assembly, render-pass assembly, frame submission, and frame-boundary validation reports.
- Reports overall readiness, key counts, and diagnostics for each non-ready major section.
- Added tests for all-ready input plus renderer assembly, render-pass, submission, and boundary validation failures.
- Validation run: targeted MVP frame readiness tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## manual-math-wgpu-matrix-migration — Migrate math layer to wgpu-matrix

Completed: 2026-05-15

Summary:

- Replaced hand-rolled vector/matrix/quaternion/projection implementation paths with `wgpu-matrix` wrappers while preserving Aperture's public math API.
- Kept WebGPU projection depth `[0, 1]`, quaternion `[x, y, z, w]`, destination reuse, and `invertMat4` null-on-singular behavior.
- Updated bounds and ray helpers to use `wgpu-matrix` vector operations where practical.
- Added constructor, TRS, matrix operation, projection, quaternion, bounds, and ray tests that compare Aperture wrappers against `wgpu-matrix`.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass after formatting touched files.
- Follow-up tasks added: `task-0111` through `task-0115` continue renderer readiness summaries and documentation.
