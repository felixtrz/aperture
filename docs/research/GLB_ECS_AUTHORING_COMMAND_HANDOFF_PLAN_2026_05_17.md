# GLB ECS Authoring Command Handoff Plan - 2026-05-17

## Scope

Plan the smallest ECS authoring output that can follow GLB source asset
registration.

This is a planning slice only. It must not implement scene spawning, mutate an
ECS world, decode mesh accessors, register source assets, create render
snapshots, or touch WebGPU.

Reference anchors:

- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`
- `docs/ARCHITECTURE.md`
- Bevy glTF scene loading into `WorldAsset` plus node/primitive spawning
- Aperture `LocalTransform`, `Parent`, `WorldTransform`, `Name`, `Mesh`,
  `Material`, `Visibility`, and `RenderLayer` authoring components

Common reference pattern: Bevy first loads labeled glTF sub-assets and then
builds scene-world data from node and primitive relationships. PlayCanvas keeps
container resources separate from entity instantiation. Aperture should adapt
that separation by producing serializable authoring commands that can later be
replayed into an ECS world, not by creating renderer-owned scene objects.

## Required Separation

The GLB import path should remain layered:

```text
GLB bytes / glTF JSON
  -> source asset mapping report
  -> source asset registry registration
  -> ECS authoring command report
  -> replay commands into an EcsWorld
  -> transform resolution
  -> render extraction
  -> render snapshot / WebGPU preparation
```

The ECS authoring command report may reference registered handles, but it should
not register assets itself. It should also avoid direct `Entity` references so
the report stays serializable and can be replayed into different worlds or
namespaces.

## Minimal Command Shape

Use stable import-local entity keys:

```ts
type GltfEcsEntityKey =
  | `gltf:scene:${number}`
  | `gltf:node:${number}`
  | `gltf:mesh:${number}:primitive:${number}`;
```

Initial commands:

```ts
type GltfEcsAuthoringCommand =
  | { type: "createEntity"; entityKey: GltfEcsEntityKey; label?: string }
  | {
      type: "addComponent";
      entityKey: GltfEcsEntityKey;
      component:
        | "Name"
        | "LocalTransform"
        | "Parent"
        | "WorldTransform"
        | "Mesh"
        | "Material"
        | "Visibility"
        | "RenderLayer";
      value: unknown;
    };
```

The command report should include:

```ts
interface GltfEcsAuthoringCommandReport {
  readonly valid: boolean;
  readonly sceneIndex: number;
  readonly rootEntityKeys: readonly GltfEcsEntityKey[];
  readonly commands: readonly GltfEcsAuthoringCommand[];
  readonly dependencies: readonly string[];
  readonly diagnostics: readonly GltfEcsAuthoringDiagnostic[];
}
```

`dependencies` should list full asset handle keys used by command values, such
as `mesh:gltf:mesh:0:primitive:0` and `material:gltf:material:0`.

## Entity Mapping

Scene roots:

- Create one scene-root entity key per selected scene:
  `gltf:scene:<sceneIndex>`.
- Add `Name` when the glTF scene has a name; otherwise use a deterministic
  label.
- Add root `LocalTransform`, `Parent(null)`, and `WorldTransform` initial data.

Nodes:

- Create one entity key per glTF node.
- Add `Name` from glTF node name or deterministic `Node<index>`.
- Add `LocalTransform` from TRS or matrix decomposition.
- Add `Parent` pointing at the parent node entity key or scene-root key.
- Add `WorldTransform` initial data so existing transform resolution can update
  it before extraction.
- Add `Visibility` by default.

Mesh primitives:

- Do not put multiple material slots on one entity in the first slice.
- Create one renderable entity per primitive:
  `gltf:mesh:<meshIndex>:primitive:<primitiveIndex>`.
- Parent primitive entities to the owning node entity.
- Add identity `LocalTransform`, `WorldTransform`, `Visibility`, `Mesh`, and
  `Material`.
- `Mesh.meshId` and `Material.materialId` should store handle ids, matching the
  existing authoring components, not full asset objects.

This keeps the imported node as logic/transform identity while each primitive
becomes a normal Aperture renderable entity with a single mesh and material
handle.

## Registration Boundary

The command report should consume source asset registration output only as
readiness information:

- Material handles used by primitive commands must already be registered or
  listed as successful writes in the registration report.
- Mesh handles must come from a future mesh/accessor mapping report; they do not
  exist in the current GLB material/texture slice.
- Texture and sampler handles are not authored into ECS commands directly;
  materials already carry those dependencies.

The command planner should emit diagnostics instead of creating commands when a
required material or mesh handle is missing, skipped, failed, or only planned
but not registered.

## Prerequisites Before Implementation

Do not implement a GLB ECS command helper until these pieces exist:

- Scene and node traversal validation for selected glTF scenes.
- Node transform mapping, including TRS and matrix handling.
- A decision for matrix decomposition failures and coordinate-conversion scope.
- Mesh primitive source asset mapping with deterministic mesh handle ids.
- Primitive-to-material index resolution using registered material handles.
- Default material behavior for primitives without a material.
- Multi-primitive mesh policy tests.
- Diagnostics for missing scene, node, mesh, primitive, and material indices.

The current material/texture registration work is necessary but not sufficient:
without mesh/accessor mapping, a command helper would either create
non-renderable placeholder entities or hide unvalidated loader assumptions.

## Non-Goals

- No ECS world mutation.
- No direct `Entity` values in the command report.
- No mesh accessor decoding.
- No material or texture registry writes.
- No camera, light, animation, skin, morph target, or variant commands.
- No render extraction.
- No WebGPU resource creation.
- No central mutable scene graph.

## Follow-Up Slices

1. Audit the source asset registry handoff before adding ECS command planning.
2. Plan minimal GLB mesh primitive source asset mapping.
3. Implement root scene/node traversal diagnostics.
4. Implement node transform command planning after transform prerequisites are
   explicit.
5. Implement primitive renderable command planning only after mesh handles and
   material handles can both be resolved honestly.
