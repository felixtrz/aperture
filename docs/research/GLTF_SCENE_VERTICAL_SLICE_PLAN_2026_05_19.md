# GLTF Scene Vertical Slice Plan

Date: 2026-05-19
Task: `task-1789`
Category: `docs-tooling`

## Reference Anchors Inspected

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLTF_SCENE_VERTICAL_SLICE_PRIORITY_2026_05_19.md`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_pbr/src/gltf.rs`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_render/src/extract_instances.rs`
- `references/bevy/crates/bevy_pbr/src/light_probe/environment_map.rs`

## Borrowed Patterns

Bevy's glTF path separates source asset loading from renderability: glTF
materials become `StandardMaterial` assets, primitives become mesh assets, and
spawned entities receive mesh/material handle components rather than renderer
scene nodes. Bevy also extracts render-relevant component data into a render
world and prepares environment maps as renderer-owned image resources.

Aperture should keep the same conceptual sequence, adapted to its TypeScript
and snapshot-first architecture:

```text
glTF-derived scene data
  -> report-driven import and typed source asset registration
  -> ECS authoring commands for entities, transforms, mesh handles, material handles
  -> RenderSnapshot packets
  -> built-in material-family resource preparation
  -> queue/sort diagnostics
  -> WebGPU submission
```

## Smallest Scene Fixture

The smallest useful fixture should be an inline, uncompressed glTF-derived
scene object with one scene and one camera. It should not require binary GLB
container parsing yet; that can land after the scene contract proves the runtime
path.

Scene content:

- Three primitive mesh shapes:
  - `plane`: existing quad-style primitive with UVs and tangents for texture
    coverage.
  - `box`: indexed cube or cuboid with normals/UVs.
  - `pyramid`: indexed triangular primitive to prove non-quad topology.
- At least three nodes with distinct local transforms:
  - one translated left,
  - one translated right and rotated,
  - one scaled non-uniformly.
- At least two built-in material families:
  - `StandardMaterial` using base color plus metallic/roughness factors and one
    texture path already covered by existing glTF material fixtures.
  - `UnlitMaterial` for a clearly different queue family.
  - `DebugNormalMaterial` is optional for the first scene; use it only if it
    helps diagnose geometry without expanding user-facing scope.
- One camera authored through ECS, not through an example-only renderer object.
- One directional light plus ambient/direct-light metadata already compatible
  with the current light extraction and readiness reports.
- Environment/IBL intent metadata:
  - stable environment asset key,
  - diffuse/specular handles or placeholder keys,
  - diagnostics when the referenced environment resource is not yet prepared.
- Shadow intent metadata:
  - one directional light marked as shadow-capable,
  - explicit shadow-map size/bias intent,
  - diagnostics until the renderer has a real shadow-map pass.

The fixture should expose JSON-safe status counts for scene nodes, primitives,
source assets, ECS authoring commands, extracted draws, built-in family buckets,
IBL readiness, and shadow readiness.

## Blocker Order

1. Scene contract (`task-1790`)
   - Define a JSON-safe scene import contract that composes existing glTF asset
     mapping, mesh construction, source registration, scene traversal, and ECS
     authoring command plans.
   - Add fixture helpers for multiple primitives, multiple material families,
     camera, light, environment intent, and shadow intent.
   - Keep binary GLB parsing out of scope.

2. Built-in material rendering (`task-1791`)
   - Drive the fixture through `createWebGpuApp` or the current public browser
     app facade.
   - Register typed mesh/material/texture/sampler assets.
   - Replay ECS authoring commands into the world and verify at least three
     visible primitives with at least two built-in material families.
   - Assert JSON-safe family bucket, route, resource, and frame status.

3. IBL resource path (`task-1792`)
   - Convert environment intent into renderer-owned environment resource
     readiness, then bind/sample it when the StandardMaterial path supports it.
   - Until sampling is complete, report structured unsupported diagnostics and
     avoid silently pretending IBL is active.

4. Shadow-map path (`task-1793`)
   - Extract shadow-capable light requests from ECS-authored light/shadow data.
   - Add the first WebGPU-owned shadow-map resource/pass path.
   - Bind shadow resources to StandardMaterial or emit a structured first-step
     diagnostic until sampling is implemented.

5. Architecture audit (`task-1794`)
   - Confirm the scene path remains ECS-authoritative and snapshot-driven.
   - Confirm environment and shadow resources are renderer-owned.
   - Update tracker/backlog and add follow-up tasks for binary GLB parsing,
     resource lifetime, batching, and remaining StandardMaterial gaps.

## Explicit Deferrals

- Public custom shader/material APIs.
- Shader graphs or node materials.
- App-owned custom adapter facades.
- Real non-built-in material rendering.
- Binary GLB container loading.
- Advanced glTF extensions, animation, skinning, morph targets, Draco, Meshopt,
  KTX2/Basis, sparse accessors, and non-triangle primitive modes.
- A mutable scene graph or renderer-owned app/game state.

## Recommended Next Task

Start `task-1790`: define the glTF scene import data contract and add tests that
prove a JSON-safe multi-primitive scene contract maps into existing typed assets
and ECS authoring commands without adding renderer-owned state.
