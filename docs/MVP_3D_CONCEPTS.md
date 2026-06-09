# MVP 3D Concept Map

This document maps the 3D primitive surface Aperture needs before more runtime implementation proceeds.

The goal is not to clone three.js, Babylon.js, or PlayCanvas. The goal is to understand their practical coverage and define an MVP surface that binds cleanly to Aperture's ECS-first architecture.

## Reference Checkouts

Local reference clones are persisted outside this repository to avoid vendoring large external codebases:

- three.js: `references/three.js`, branch `dev`, commit `2ccd00a`
- Babylon.js: `/Users/felixz/Projects/aperture-reference-libs/Babylon.js`, branch `master`, commit `67395c0`
- PlayCanvas engine: `references/engine`, branch `main`, commit `c3cd1f9`
- Bevy: `./references/bevy`, branch `main`, commit `370be1b02`
- gl-matrix: `/Users/felixz/Projects/aperture-reference-libs/gl-matrix`, commit `accefb6`
- wgpu-matrix: `/Users/felixz/Projects/aperture-reference-libs/wgpu-matrix`, commit `3dba901`

Primary inspected areas:

- three.js: `src/core`, `src/math`, `src/geometries`, `src/objects`, `src/materials`, `src/textures`, `src/cameras`, `src/lights`, `src/loaders`, `src/animation`, `src/renderers/webgpu`, and example loaders.
- Babylon.js: `packages/dev/core/src/Meshes`, `Materials`, `Cameras`, `Lights`, `Culling`, `Collisions`, `Animations`, `Bones`, `Morph`, `Engines/WebGPU`, `FrameGraph`, and `packages/dev/loaders/src`.
- PlayCanvas: `src/framework/components`, `src/framework/asset`, `src/framework/handlers`, `src/framework/parsers`, `src/scene`, `src/scene/geometry`, `src/scene/materials`, `src/scene/renderer`, `src/scene/lighting`, `src/scene/animation`, `src/scene/particle-system`, and `src/core/shape`.
- Bevy: `crates/bevy_ecs`, `crates/bevy_asset`, `crates/bevy_mesh`, `crates/bevy_pbr`, `crates/bevy_render`, `crates/bevy_material`, `crates/bevy_camera`, `crates/bevy_light`, and `crates/bevy_transform`.

Bevy is the primary architectural anchor for the ECS/render bridge. The other
engines remain coverage references for practical runtime features, but Bevy is
the closest match for how Aperture should connect ECS authoring, assets,
materials, extraction, render-world preparation, and draw queueing. See
`docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`.

## MVP Boundary

The Aperture MVP should prove this vertical slice:

1. Author a small world through ECS components.
2. Resolve transforms and hierarchy in ECS.
3. Reference mesh, material, texture, and camera data through stable handles.
4. Extract flat render snapshots from ECS state.
5. Render simple mesh scenes through WebGPU only.
6. Provide diagnostics when an entity does not render.

MVP should include:

- ECS-backed entity/component authoring using EliCS.
- Math types and helpers needed for transforms, bounds, rays, cameras, and color.
- Transform hierarchy: local transform, parent, resolved world transform.
- Mesh data model: vertex/index buffers, attributes, submeshes, bounds, primitive builders for common shapes.
- Render authoring components: mesh renderer, camera, visibility, layer, name/debug metadata.
- Asset handles and registries for meshes, materials, textures, samplers, and imported scenes.
- Material schema for unlit and a basic metallic-roughness material subset.
- Texture and sampler descriptors.
- Perspective and orthographic cameras.
- Directional, point, spot, and ambient/environment light authoring components, with shadows deferred until after basic lighting.
- Render packet and render snapshot schemas.
- WebGPU device/context setup, render pass setup, basic shader pipeline, and mesh draw submission.
- Initial asset loading path for a simple GLB/glTF subset.
- Initial ray and bounds types for future picking and visibility diagnostics.
- Frame/render-packet diagnostics.

MVP should defer:

- Full editor tooling.
- Full scene graph-style object API.
- Full PBR/physical material coverage.
- Shadows beyond architecture-compatible component/schema design.
- Particle systems.
- Audio.
- Physics simulation.
- WebXR.
- Node materials / shader graph.
- Complex post-processing.
- Complex animation state machines.
- Complex asset cooking.
- WebGL fallback.

## Final MVP Feature Contract

The planning gate is complete when implementation work follows this contract instead of adding isolated engine pieces.

Required MVP concepts:

- EliCS-backed ECS world, entities, components, resources, systems, frame-local events, and deterministic commands.
- Array-first math module using `wgpu-matrix` behind Aperture-owned helpers for vectors, quaternions, matrices, colors, rays, bounds, planes, and frustums.
- ECS-owned transforms: `LocalTransform`, `Parent`, `WorldTransform`, optional hierarchy index, cycle rejection, and deterministic transform resolution.
- ECS render authoring components: `Enabled`, `Visibility`, `RenderLayer`, `RenderOrder`, `Name`, `DebugMetadata`, `Mesh`, `Material`, `Camera`, `Light`, `Pickable`, `Collider`, and future-compatible animation/collider schemas.
- Stable handles and typed asset collections backed by registries for meshes, materials, textures, samplers, render targets, scenes/prefabs, animation clips, skins, morph target sets, and environment maps.
- Mesh assets with vertex streams, required `POSITION`, optional normal/tangent/UV/color/skin/morph fields, index buffers, submeshes, material slots, bounds, and primitive builders for box, plane, sphere, cylinder, cone, capsule, and torus.
- Material assets for unlit, glTF-style metallic-roughness, and debug normals, plus texture/sampler descriptors and explicit render state.
- Perspective and orthographic cameras, normalized viewport/scissor, clear state, layer masks, priority sorting, and fixed-size 2D render-target descriptors.
- Ambient/environment, directional, point, and spot light schemas with flat extraction packets; shadow authoring schema can exist before shadow rendering.
- `RenderSnapshot` extraction containing view packets, mesh draw packets, light packets, environment packets, shadow requests, bounds, skin/morph packet slots, diagnostics, and report data.
- Renderer-owned `RenderWorld` for prepared assets, draw queues, phase items, WebGPU device/context, GPU buffers/textures/samplers, render targets, pipelines, bind groups, pass descriptors, command encoders, timing, and cache metrics.
- Input/picking schemas for frame-local input events, rays, pick queries/reports, and bounds picking without coupling to renderer-owned scene state.
- First-class diagnostics and reports for assets, extraction, visibility, material/pipeline compatibility, WebGPU availability/device state, and skipped renderables.

Explicitly deferred concepts:

- Public `Object3D`/scene-graph API as the source of truth.
- WebGL fallback.
- Full physical/PBR material extensions, shader graphs, arbitrary custom shader chunks, and advanced transparency.
- Runtime shadow rendering beyond MVP-compatible schema and extraction.
- Particle systems, audio, editor tooling, visual scripting, and broad UI tooling.
- Full animation state graphs, blend trees, IK, root motion, retargeting, and baked vertex animation.
- Full physics simulation, constraints, character controllers, mesh-collider cooking, and contact manifolds.
- WebXR session/rendering/input implementation, though packet and input schemas must not block it.
- Complex asset cooking, compression paths, non-glTF importers, KTX2/Basis/Draco/Meshopt, sparse accessors, and advanced glTF extensions.
- Post-processing graphs, MRT-heavy workflows, cube/array/3D render targets, and clustered/shadow atlas implementations.

ECS component/resource list:

- Core: `Enabled`, `Name`, `DebugMetadata`, optional `Tags`.
- Transform: `LocalTransform`, `Parent`, `WorldTransform`, optional `HierarchyIndex` resource.
- Rendering: `Mesh`, `Material`, `Camera`, `Visibility`, `RenderLayer`, `RenderOrder`, `Light`, `ShadowCaster`, `ShadowReceiver`.
- Interaction/future physics: `Pickable`, `Collider`, `RigidBody` boundary schema.
- Animation/deformation: `AnimationPlayer`, `SkinnedMeshBinding`, `MorphWeights`.
- Resources: `AssetRegistry`, `EnvironmentLighting`, `InputFrame`, `CommandBuffer`, `EventQueue`, `RenderSnapshot` output, `FrameReport`.

Asset, material, and render packet list:

- Asset handles: `AssetHandle<T>`, `MeshHandle`, `MaterialHandle`, `TextureHandle`, `SamplerHandle`, `RenderTargetHandle`, `SceneHandle`, `AnimationClipHandle`, `SkinHandle`, `MorphTargetSetHandle`, `EnvironmentMapHandle`.
- Asset descriptors: `MeshAsset`, `MaterialAsset`, `TextureAsset`, `SamplerAsset`, `RenderTargetAsset`, `SceneAsset`/`PrefabAsset`, `AnimationClipAsset`, `SkinAsset`, `MorphTargetSetAsset`.
- Render descriptors: `RenderSnapshot`, `ViewPacket`, `MeshDrawPacket`, `LightPacket`, `EnvironmentPacket`, `ShadowRequestPacket`, `BoundsPacket`, `SkinPalettePacket`, `MorphWeightsPacket`, `RenderSortKey`, `BatchCompatibilityKey`, `RenderSnapshotReport`.

Validation and diagnostics list:

- Component schema validation should reject non-serializable or renderer-owned values.
- Transform validation should cover cycles, destroyed parents, root/child composition, reparenting, and matrix packing.
- Asset validation should cover missing, loading, failed, unsupported, malformed, and incompatible handles.
- Mesh validation should cover missing `POSITION`, invalid vertex/index ranges, invalid submeshes, missing bounds, unsupported topology, and material-slot mismatches.
- Material validation should cover missing textures/samplers, invalid alpha/cull/depth/blend fields, unsupported feature bits, color-space mismatches, and invalid pipeline key inputs.
- Camera validation should cover missing transforms, invalid projection fields, invalid viewport/scissor, zero layer masks, invalid render targets, and unsupported sample counts.
- Extraction diagnostics should cover disabled/invisible entities, layer mismatch, frustum culling, missing world transforms, missing assets, unsupported packet combinations, and stable skip reasons.
- WebGPU diagnostics should cover unavailable adapters/devices, device loss, context configuration failures, unsupported formats/sample counts, pipeline creation failures, and resource cache metrics.
- Reports should be agent-readable and include entity IDs, asset handles, packet IDs, view IDs, diagnostic codes, and counts by category.

Examples that prove MVP completeness:

- Static cubes: create multiple ECS entities with `LocalTransform`, `Mesh`, `Material`, one camera, and one directional light; extraction emits deterministic packets and WebGPU renders distinct transforms.
- Missing asset diagnostics: author a renderable with a missing mesh/material handle; extraction emits skip diagnostics and a report without renderer crashes.
- Camera/layer filtering: two cameras and two layers produce separate `ViewPacket` data and only matching draw packets per view.
- Primitive builder path: create a box or sphere mesh asset through an Aperture builder, register it, render it, and inspect its bounds.
- Material path: switch an entity between unlit and metallic-roughness material handles and observe pipeline-key/report changes.
- Input/picking path: build a ray from a view packet and run bounds picking against extracted bounds without querying renderer scene objects.

## Reference Coverage Matrix

### Core World Model

Reference engines:

- three.js centers authoring on `Object3D`, `Scene`, `Group`, and subclasses such as `Mesh`, `Camera`, `Light`, `Line`, `Points`, `Sprite`, `SkinnedMesh`, and `InstancedMesh`.
- Babylon.js centers authoring on `Node`, `TransformNode`, `AbstractMesh`, `Mesh`, `Camera`, `Light`, and `Scene`.
- PlayCanvas has `Entity` plus component systems such as `render`, `camera`, `light`, `anim`, `collision`, `rigid-body`, `sprite`, and `particle-system`.

Aperture binding:

- ECS entities are the authoritative object identity.
- No public `Object3D` or central mutable scene graph should be introduced.
- Common object flags become data components:
  - `Name`
  - `Enabled`
  - `Visibility`
  - `RenderLayer`
  - `DebugMetadata`
  - optional `Tags`
- Parent-child relationships belong to ECS transform components.
- Renderer-facing identity should be stable render IDs derived during extraction, not renderer-owned object instances.

### Math And Spatial Primitives

Reference engines all provide vectors, quaternions, matrices, colors, rays, planes, boxes, spheres, and frustums.

Detailed transform and spatial coverage for task-0017 lives in `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md`.

Math library decision:

- Aperture should use `wgpu-matrix` as the internal MVP math kernel, wrapped behind an Aperture-owned `math` module.
- `gl-matrix` remains the fallback option if `wgpu-matrix` cannot satisfy a required invariant.
- three.js, Babylon.js, and PlayCanvas math APIs are references for coverage and ergonomics only; their object-oriented math classes should not be used as Aperture's internal representation.
- See `docs/research/MATH_LIBRARY_DECISION.md` and `docs/DECISIONS.md#0007--webgpu-first-array-math`.

Aperture MVP needs:

- `Vec2`, `Vec3`, `Vec4`
- `Quat`
- `Mat3`, `Mat4`
- `Color`
- `Ray`
- `Plane`
- `Aabb`
- `BoundingSphere`
- `Frustum`
- helpers for compose/decompose, inverse, multiply, transform point/vector, projection matrices, and bounds transforms.

Aperture binding:

- Math values used in ECS components must be serializable, array-first, and backed by EliCS-compatible storage.
- Hot-path render extraction should use `Float32Array` views or tightly packed numeric storage, with tuple inputs copied at authoring boundaries.
- GPU resource objects must not appear in ECS math or component data.
- Public ergonomics should come from small Aperture helpers, not from storing `Vector3`/`Matrix4` class instances.

### Transform And Hierarchy

Reference engines:

- three.js `Object3D` has local `position`, `rotation`, `quaternion`, `scale`, local matrix, world matrix, visible flag, layers, frustum culling, render order, and user data.
- Babylon.js `TransformNode` has position, rotation, rotation quaternion, scaling, world matrix computation, parent links, billboard behavior, and metadata.
- PlayCanvas separates `GraphNode` transform hierarchy from framework components attached to entities.

Aperture MVP needs:

- `LocalTransform`: translation, rotation quaternion, scale.
- `WorldTransform`: resolved world matrix plus optional world translation/rotation/scale cache.
- `Parent`: parent entity reference.
- Optional derived `Children` or hierarchy index resource for efficient traversal.
- Dirty propagation or deterministic full transform update for initial MVP.
- Tests for root, child, reparenting, destroy-parent behavior, and cycle rejection.

Aperture binding:

- Transform resolution is an ECS system.
- Renderer only consumes `WorldTransform` through render extraction.
- Renderer must never walk or own the transform hierarchy.
- `WorldTransform.matrix` should be represented in EliCS as four `Vec4` column fields (`col0` through `col3`) rather than an object-valued matrix field.

### Mesh And Geometry

Reference engines:

- three.js has `BufferGeometry`, `BufferAttribute`, groups/draw ranges, bounds, morph attributes, and geometry builders for box, sphere, plane, cylinder, cone, capsule, torus, tube, polyhedra, shape/extrude/lathe, wireframe, and edges.
- Babylon.js has `Geometry`, `VertexData`, `SubMesh`, `MeshBuilder`, builders for box, sphere, cylinder, capsule, ground, plane, torus, torus knot, tube, lines, ribbon, polygon, text, instances, thin instances, LOD, simplification, skeleton, and morph support.
- PlayCanvas has `Mesh`, `MeshInstance`, `Model`, primitive geometry builders for box, sphere, plane, cylinder, cone, capsule, torus, morphs, skinning, batching, and render components.

Detailed mesh, geometry, primitive builder, instancing, LOD, morph, and skinning coverage for task-0018 lives in `docs/research/MESH_GEOMETRY_COVERAGE.md`.

Aperture MVP needs:

- `MeshHandle` and `MeshAsset`.
- Mesh descriptor with vertex streams, Aperture-owned vertex formats, optional `uint16`/`uint32` index buffer, submeshes, local bounds, and diagnostics.
- Required `POSITION` attribute for renderable meshes.
- Optional MVP/later attributes:
  - `NORMAL`
  - `TANGENT`
  - `TEXCOORD_0`
  - `TEXCOORD_1`
  - `COLOR_0`
  - `JOINTS_0`
  - `WEIGHTS_0`
  - `JOINTS_1`
  - `WEIGHTS_1`
- Submesh / primitive ranges with stable submesh slot and material slot index.
- Bounds: local AABB and bounding sphere.
- MVP primitive builders:
  - box
  - plane
  - sphere
  - cylinder
  - cone
  - capsule
  - torus
- Lines and points are represented in topology/schema design but may follow after triangle mesh rendering and line/point materials.
- Morph target and skinning fields should be represented in asset schemas early, even if render support is deferred.

Aperture binding:

- ECS stores only `MeshHandle` and material slot handles.
- Mesh CPU data belongs to asset/resource registries.
- GPU buffers belong to the WebGPU backend/render world.
- Primitive builders return `MeshAsset` descriptors, not scene objects or renderer-owned instances.
- Render extraction emits one draw packet per visible submesh with mesh handle, submesh slot, material handle, world transform offset, visibility/layer metadata, bounds, sort key, and stable render ID.
- MVP instancing compatibility is based on mesh, submesh, material, vertex layout, topology, layer, render state, and no active skin/morph state.

### Materials, Textures, And Render State

Detailed coverage: [`docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`](research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md).

Reference engines:

- three.js has base `Material` state for side/culling, opacity, transparency, blending, alpha test, depth test/write, stencil, color write, polygon offset, tone mapping, and shader customization; material families include basic, standard, physical, matcap, normal, toon, line, points, sprite, shader, depth, distance, and shadow.
- Babylon.js has `Material`, `StandardMaterial`, `PBRMaterial`, shader language selection including WGSL, alpha/transparency modes, depth and stencil state, culling, wireframe, material plugins, node materials, and many texture channels.
- PlayCanvas has `Material`, `StandardMaterial`, `LitMaterial`, `ShaderMaterial`, blend/depth/stencil/cull state, shader chunks, GLSL/WGSL shader descriptions, and standard material parameter validation.

Aperture MVP needs:

- `MaterialHandle` and `MaterialAsset`.
- `TextureHandle` and `SamplerHandle`.
- Material kinds:
  - `UnlitMaterial`
  - `MatcapMaterial` or equivalent normal/view-based matcap material
  - `StandardMaterial` metallic-roughness subset aligned with glTF
  - `DebugNormalMaterial` or equivalent diagnostic shader
- Common fields:
  - base color factor / texture
  - emissive factor / texture
  - metallic factor / roughness factor / metallic-roughness texture
  - normal texture and scale
  - occlusion texture and strength
  - alpha mode: opaque, mask, blend
  - alpha cutoff
  - double sided / cull mode
  - depth test/write
  - blend mode
  - render queue / transparency bucket
- Texture descriptors:
  - dimension
  - format
  - color space
  - mip usage
  - usage flags
- Sampler descriptors:
  - min/mag/mipmap filters
  - address modes
  - anisotropy later
- Pipeline key inputs:
  - shader family
  - material feature bits
  - mesh vertex layout and topology
  - instancing / skinning / morph flags from extraction
  - cull, depth, blend, and color-write state
  - render target formats and sample count

Aperture binding:

- ECS render components reference material handles.
- Material data lives in a registry and remains data-driven.
- Renderer resolves material data into pipeline keys, bind groups, and diagnostics.
- Material schemas must be serializable and inspectable.
- Material validation emits structured diagnostics for missing handles, unsupported texture formats/dimensions, color-space mismatches, invalid alpha cutoffs, unsupported stencil/custom shader requests, and unsupported pipeline feature combinations.
- Defer physical material extensions, shader graph/chunk/plugin systems, arbitrary GLSL, advanced transparency, render-target/video/procedural textures, texture arrays/3D textures, stencil workflows, and line/point/sprite/depth-only material families. A simple Lambert/Phong-style material may be considered later, but it should not outrank matcap or the StandardMaterial proof path.

### Cameras, Views, Layers, And Render Targets

Detailed coverage: [`docs/research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md`](research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md).

Reference engines:

- three.js has perspective, orthographic, array, stereo, and cube cameras.
- Babylon.js has camera classes for free, target, arc rotate, follow, fly, universal, gamepad/touch/device orientation, stereoscopic, VR, and geospatial scenarios.
- PlayCanvas camera components expose projection, clear options, layers, priority, render target/post effects, and camera shader parameters.

Aperture MVP needs:

- `Camera` component with:
  - enabled flag
  - projection kind: perspective or orthographic
  - near/far
  - vertical FOV or orthographic vertical size
  - aspect behavior: auto or explicit number
  - normalized viewport and optional normalized scissor
  - clear color/depth/stencil load-clear choices
  - layer mask
  - render order/priority
  - optional render target handle
- `RenderTargetHandle` and `RenderTargetAsset` for default canvas and fixed-size 2D targets.
- Camera extraction to render snapshot.
- Projection and view matrix computation from `WorldTransform`.
- `ViewPacket` data containing camera entity, priority, layer mask, view/projection/view-projection matrices, viewport, scissor, clear state, and optional render target.
- Tests for projection matrix generation, camera ordering, layer filtering, clear state, render target validation, and extracted view packets.

Aperture binding:

- Camera entities are normal ECS entities.
- Extract all enabled cameras, sort by priority ascending, and break ties by stable entity id.
- A future `PrimaryCamera`/`ActiveCamera` resource can exist for API convenience, but rendering should consume sorted `ViewPacket[]`.
- Render targets are handles; GPU textures remain renderer-owned.
- Camera controls, post effects, XR/stereo/cube cameras, custom projection callbacks, advanced camera stacks, and MRT/cube/array/3D render targets are deferred.
- Camera extraction emits structured diagnostics for missing `WorldTransform`, invalid projection fields, invalid viewport/scissor, zero layer masks, missing render targets, unsupported sample counts, and unsupported MVP features.

### Lighting, Environment, And Shadows

Detailed coverage: [`docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`](research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md).

Reference engines:

- three.js exposes ambient, hemisphere, directional, point, spot, rect area, light probes, and shadow variants.
- Babylon.js exposes directional, point, spot, hemispheric, area/rect, clustered light containers, IES, LTC, shadow generators, and cascaded shadows.
- PlayCanvas supports directional/omni/spot lights, layers, clustered lighting, cookies, shadows, lightmaps, and environment/skybox lighting.

Aperture MVP needs:

- `Light` component with kinds:
  - ambient/environment
  - directional
  - point
  - spot
- Light fields:
  - color
  - intensity
  - range
  - inner/outer spot angle
  - layer mask
- `EnvironmentLighting` resource for ambient color, skybox handle, future filtered radiance map handle, optional irradiance SH data, intensity, rotation, and layer mask.
- `ShadowCaster`, `ShadowReceiver`, and `LightShadowSettings` schema design, but implementation can follow after basic lighting.
- Flat extraction packet shapes:
  - `LightPacket` for ambient, directional, point, and spot light data.
  - `EnvironmentPacket` for skybox/IBL inputs.
  - `ShadowRequestPacket` for future shadow-pass planning.
- Structured diagnostics for missing transforms, invalid ranges/cones, zero masks, unsupported shadow requests, and missing environment handles.

Aperture binding:

- Light components live in ECS.
- Directional and spot direction plus point/spot position are derived from `WorldTransform` during extraction.
- Extraction emits flat light, environment, and shadow request packets.
- Renderer may maintain clustered/light buffer state, shadow atlases, shadow cameras, and environment bind groups, but never owns light authoring state.
- MVP should include ambient/environment, directional, point, and spot schemas and extraction; basic shader lighting and actual shadow rendering can follow in staged renderer work.

### Visibility, Culling, Sorting, Instancing, And LOD

Reference engines:

- three.js has layers, visible flags, frustum culling flags, render order, `InstancedMesh`, `BatchedMesh`, and LOD.
- Babylon.js has `isVisible`, `visibility`, rendering groups, submeshes, instances, thin instances, LOD, bounding info, octrees, and culling helpers.
- PlayCanvas has render layers, mesh instance visibility, batching, clustered lighting, render actions, world clusters, and render pass sorting.

Aperture MVP needs:

- `Visibility`
- `RenderLayer`
- `RenderOrder`
- `Bounds`
- CPU frustum culling system or extraction-time culling decision.
- Stable sort keys for opaque and transparent queues.
- Instancing design using a shared mesh/material key and per-instance transform data.
- LOD design can be deferred but should not conflict with render packet shape.

Aperture binding:

- Culling should be derived from ECS + camera state and reflected in extraction diagnostics.
- Render extraction should emit skipped-renderable reasons, not silently drop entities.

### Assets, Loading, Serialization, And Scenes

Detailed coverage: [`docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`](research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md).

Reference engines:

- three.js has core loaders plus many example loaders, with `GLTFLoader`, `KTX2Loader`, `DRACOLoader`, HDR/EXR, OBJ, FBX, STL, USD, SVG, font, and texture loaders.
- Babylon.js has a loader package with glTF 1/2, OBJ, STL, BVH, SPLAT, validation, material adapters, and many legacy compatibility paths.
- PlayCanvas has asset registries, handlers for model/render/material/texture/cubemap/container/animation, GLB parsers, Draco, KTX/KTX2, basis, scene/template/hierarchy handlers, and material parsers.

Aperture MVP needs:

- Stable `AssetHandle<T>` model.
- Asset registry with status: registered, loading, ready, failed.
- Asset kinds:
  - mesh
  - material
  - texture
  - sampler
  - scene/prefab
  - animation clip
- `SceneAsset` / prefab import shape that stores ECS authoring commands and dependencies, not live renderer or scene graph objects.
- GLB/glTF 2.0 subset:
  - nodes to ECS entities
  - meshes/submeshes
  - materials metallic-roughness subset
  - textures/samplers/images
  - cameras
  - triangle primitives first; line/point modes later
  - lights extension later
  - skins, morphs, and animation playback later
- Clear asset validation errors.
- Agent-readable asset manifest/report.
- Explicit MVP exclusions for glTF 1.0, Draco/Meshopt compression, KTX/KTX2/Basis/WebP/AVIF textures, sparse accessors, non-triangle primitives, advanced glTF extensions, and non-glTF loader formats. Non-glTF 3D import formats should stay out of scope unless a later decision changes the import strategy.

Aperture binding:

- ECS components hold handles.
- Asset import creates handles and optional ECS authoring commands.
- Renderer resolves ready handles into GPU resources.
- Failed/missing handles produce diagnostics during extraction.
- Import should return an `AssetImportReport` with root scene handle, produced asset handles, ECS authoring commands, manifest counts/dependencies, unsupported feature list, and diagnostics.
- Scene/prefab instantiation replays commands with remapped entity IDs; it must not share mutable entity or transform state across instances.

### Animation, Skinning, And Morph Targets

Detailed coverage: [`docs/research/ANIMATION_SKINNING_MORPH_COVERAGE.md`](research/ANIMATION_SKINNING_MORPH_COVERAGE.md).

Reference engines:

- three.js has animation clips, keyframe tracks by value type, mixers/actions, skeletons, bones, skinned meshes, and morph target bindings.
- Babylon.js has animations, animation groups, easing, runtime animation, skeletons/bones, IK helpers, morph target managers, and baked vertex animation.
- PlayCanvas has legacy animation, anim state graphs, animation components, skeletons, skin instances, morphs, morph targets, and animation handlers.

Aperture MVP needs:

- Design now, implement after basic render slice:
  - `AnimationClipHandle`
  - transform keyframe data
  - animation player component
  - skin asset schema
  - morph target asset schema
- `AnimationPlayer` component with clip handle, playing flag, time, speed, loop mode, and weight.
- `SkinnedMeshBinding` and `MorphWeights` component shapes for future extraction.
- `SkinPalettePacket` and `MorphWeightsPacket` extraction shapes.
- For first rendering MVP, support static meshes and reserve packet fields for skinning/morphing without implementing full animation.
- Defer state graphs, blend trees, animation layers/masks, IK, root motion, baked vertex animation, GPU morph texture packing, and retargeting.

Aperture binding:

- Transform animation systems write ECS `LocalTransform` component values before transform resolution.
- Skin palettes are derived during extraction from ECS `WorldTransform` values plus `SkinAsset` inverse bind matrices.
- Morph animation writes `MorphWeights`; extraction copies weights into flat render data.
- Renderer consumes resolved transforms, skin/morph handles, and extracted pose packets, but never owns animation, skeleton, or morph authoring state.

### Interaction, Picking, Bounds, And Physics Boundary

Detailed coverage: [`docs/research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md`](research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md).

Reference engines:

- three.js exposes `Raycaster`, ray/math intersections, layers, and per-object raycast hooks.
- Babylon.js has scene picking, ray picking, bounding info, picking info, collisions, and physics integrations.
- PlayCanvas has ray/bounding shapes, picker IDs, collision components, rigid-body components, triggers, and input components.

Aperture MVP needs:

- `Ray`, `Aabb`, `BoundingSphere`, and intersection helpers for bounds picking, frustum/debug checks, and later collider queries.
- `Pickable` component with enabled flag, layer mask, pick mode, and deterministic priority.
- `PickQuery`, `PickHit`, and `PickReport` shapes with serializable diagnostics.
- CPU bounds picking against ECS/extraction-derived bounds.
- `Collider` component schema covering box, sphere, capsule, mesh, and compound shapes, with simulation deferred.
- `RigidBody` component boundary for later static, kinematic, and dynamic physics integration.
- Frame-local input event and command stream design for pointer, keyboard, wheel, touch, gamepad, and later XR controller input.
- Render-packet or bounds report data enough to support future CPU/GPU picking.
- Explicit diagnostics for missing transforms, missing bounds, invalid rays, zero layer masks, unsupported mesh picking, invalid collider shapes, missing physics backend, and missing XR pose data.

Aperture binding:

- Picking reads extracted or ECS-derived bounds; it must not require renderer-owned scene graph state.
- Render picking IDs, if added later, are renderer resources derived from render packets and mapped back to ECS entity IDs.
- Visual picking, collider queries, and physics raycasts may share report shapes, but their source backends and diagnostics stay distinguishable.
- Physics backend objects live in a physics-world resource, not in durable ECS components.
- Physics, when added, writes ECS components/events through systems at defined schedule points.
- Input events are frame-local resources/events; gameplay systems convert them into explicit commands that mutate ECS state deterministically.
- XR controller rays should reuse `Ray`, `PickQuery`, and pointer-style input events with `pointerType: "xr"`.

### Diagnostics And Agent Introspection

Detailed render-boundary coverage: [`docs/research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md`](research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md).

Reference engines have mature debug/helpers/tools, but often as engine-specific object helpers.

Aperture MVP needs diagnostics as data:

- `FrameReport`
- `RenderSnapshotReport`
- `RenderPacket` / `MeshDrawPacket` diagnostics
- `RenderWorld` resource lifecycle report
- skipped renderable diagnostics
- missing asset diagnostics
- material/pipeline compatibility diagnostics
- visibility explanation
- entity/component inspection helpers
- WebGPU adapter/device/context diagnostics

Aperture binding:

- Diagnostics should reference ECS entity IDs, asset handles, and render packet IDs.
- Diagnostics should be serializable enough for worker-mode and agent consumption.
- Render extraction produces `RenderSnapshot` data containing view packets, mesh draw packets, light packets, environment packets, shadow requests, bounds, pose data, diagnostics, and a snapshot report.
- Renderer-owned `RenderWorld` caches GPU resources, pipelines, bind groups, render targets, command encoders, and device state derived from snapshots and asset registries.
- `RenderWorld` must not own ECS components, authoritative transforms, scene graph nodes, gameplay input, physics, animation, or material authoring state.
- Snapshot packet fields must be handles, numeric IDs, flags, packed arrays, and serializable diagnostics; they must not contain WebGPU objects, DOM objects, closures, or ECS storage references.
- Render sorting should be deterministic: opaque/alpha-test packets group by view, queue, layer, pipeline/material/mesh compatibility, front-to-back depth, then stable packet ID; transparent packets sort back-to-front with the same stable tie-breaking.
- Frame reports should count candidate renderables, emitted draw packets, skipped packets, views, lights, shadow requests, draw calls, cache hits/misses, GPU resources created, and diagnostics by code.

## Concept Coverage Tasks

The backlog should now prioritize reference coverage tasks before implementation. Each coverage task should update this document or a focused companion document with:

- three.js references.
- Babylon.js references.
- PlayCanvas references.
- Aperture ECS component/resource mapping.
- MVP vs later classification.
- Acceptance tests or validation examples that future implementation tasks can use.

Implementation tasks should resume only after the MVP concept map has enough coverage that agents are not inventing architecture one small feature at a time.
