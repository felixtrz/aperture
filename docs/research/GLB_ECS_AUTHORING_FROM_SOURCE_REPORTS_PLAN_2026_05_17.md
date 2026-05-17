# GLB ECS Authoring From Source Reports Plan - 2026-05-17

## Scope

Plan the first ECS authoring command planner that can consume the source reports
now available from the GLB pipeline.

This remains a planning slice only. It must not mutate an ECS world, register
assets, create render packets, prepare render-world resources, upload WebGPU
buffers, or instantiate a scene graph.

## Reference Anchors

- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/GLB_MESH_SOURCE_ASSET_REGISTRATION_PLAN_2026_05_17.md`
- `docs/research/GLB_PRIMITIVE_MATERIAL_RESOLUTION_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/gltf-mesh-source-registration.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/simulation/src/transform/components.ts`
- `packages/render/src/rendering/authoring.ts`
- Bevy glTF scene spawning in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

The common reference pattern is: labeled mesh/material assets are prepared first,
then scene/node traversal spawns node entities and per-primitive child
renderable entities that reference those handles. Aperture should adapt that
as a serializable command report, not direct ECS mutation.

## Proposed Helper

Add a later helper under `packages/render/src/assets`:

```ts
interface GltfEcsAuthoringCommandPlanOptions {
  readonly traversalReport: GltfSceneTraversalReport;
  readonly meshRegistrationReport: GltfMeshSourceAssetRegistrationReport;
  readonly primitiveMaterialReport: GltfPrimitiveMaterialResolutionReport;
  readonly availableMeshHandleKeys?: readonly string[];
  readonly keyPrefix?: string;
}

function createGltfEcsAuthoringCommandPlan(
  options: GltfEcsAuthoringCommandPlanOptions,
): GltfEcsAuthoringCommandPlan;
```

Do not pass `AssetRegistry` or `EcsWorld` into this helper. The helper should
consume report data and caller-provided available mesh handle keys so it remains
serializable, testable, and reusable in future worker/import contexts.

## Entity Keys

Scene and node keys come from the traversal report:

```text
<keyPrefix>:scene:<sceneIndex>
<keyPrefix>:node:<nodeIndex>
```

Renderable primitive keys should be node-scoped:

```text
<keyPrefix>:node:<nodeIndex>:mesh:<meshIndex>:primitive:<primitiveIndex>
```

This updates the earlier `gltf:mesh:<meshIndex>:primitive:<primitiveIndex>`
idea. A mesh asset can be referenced by multiple glTF nodes, so a mesh-only
renderable entity key would collide or accidentally imply shared transform
state. The mesh asset handle remains shared:

```text
mesh:<keyPrefix>:mesh:<meshIndex>:primitive:<primitiveIndex>
```

## Command Shape

Commands should be serializable and avoid direct EliCS `Entity` values:

```ts
type GltfEcsAuthoringCommand =
  | {
      readonly type: "createEntity";
      readonly entityKey: string;
      readonly label: string;
    }
  | {
      readonly type: "addComponent";
      readonly entityKey: string;
      readonly component:
        | "Name"
        | "LocalTransform"
        | "Parent"
        | "WorldTransform"
        | "Mesh"
        | "Material"
        | "Visibility";
      readonly value: unknown;
    };
```

`Parent` values should use `parentEntityKey: string | null`, not an `Entity`.
The later replay helper can map entity keys to concrete ECS entities after all
`createEntity` commands have run.

`Mesh` and `Material` command values should include both the component id value
and the full handle key for diagnostics:

```ts
{ meshId: "gltf:mesh:0:primitive:0", handleKey: "mesh:gltf:mesh:0:primitive:0" }
{ materialId: "gltf:material:0", handleKey: "material:gltf:material:0" }
```

The replay step should write only `meshId` to `Mesh.meshId` and `materialId` to
`Material.materialId`, matching current component contracts.

## Report Shape

```ts
interface GltfEcsAuthoringCommandPlan {
  readonly valid: boolean;
  readonly sceneIndex: number | null;
  readonly rootEntityKeys: readonly string[];
  readonly commands: readonly GltfEcsAuthoringCommand[];
  readonly dependencies: readonly string[];
  readonly skipped: readonly GltfSkippedEcsAuthoringEntry[];
  readonly diagnostics: readonly GltfEcsAuthoringDiagnostic[];
}
```

`dependencies` should list full mesh and material handle keys used by emitted
commands. Texture and sampler dependencies should not be listed directly here
because they are already material asset dependencies.

## Command Mapping

Scene root:

- `createEntity` for `traversalReport.sceneEntityKey`.
- `Name` from the scene label when available, otherwise deterministic
  `Scene<sceneIndex>`.
- `LocalTransform` identity TRS.
- `Parent` with `parentEntityKey: null`.
- `WorldTransform` identity.
- `Visibility` default visible.

Traversed nodes:

- `createEntity` for each `GltfTraversedNode.entityKey`.
- `Name` from `node.label`.
- `Parent` with `parentEntityKey` from traversal.
- `WorldTransform` initial identity; transform resolution owns the final matrix.
- `Visibility` default visible.
- `LocalTransform` only when `node.localTransform.kind === "trs"`.

Matrix nodes:

- Emit a diagnostic and skip the node subtree until a tested matrix
  decomposition helper exists.
- Do not silently author identity transforms for matrix nodes.
- Do not create renderable primitive child commands under a skipped matrix node.

Primitive renderable children:

- For each traversed node with `meshIndex !== null`, find all resolved primitive
  materials with the same `meshIndex`.
- For each matching primitive, require a registered mesh handle key from
  `meshRegistrationReport.written` or `availableMeshHandleKeys`.
- Create a node-scoped primitive entity key.
- Add `Name`, identity `LocalTransform`, `Parent` to the owning node,
  `WorldTransform`, `Visibility`, `Mesh`, and `Material`.

## Readiness Rules

Mesh readiness:

1. A mesh handle is ready when it appears in
   `meshRegistrationReport.written[*].registeredHandleKey`.
2. A duplicate-skipped mesh is ready only when the full handle key is also in
   `availableMeshHandleKeys`.
3. Invalid or missing mesh registration entries produce diagnostics and no
   primitive renderable command.

Material readiness:

1. Use only `primitiveMaterialReport.resolved` entries for renderable commands.
2. Any matching `unresolved` primitive material emits an ECS authoring
   diagnostic and no renderable command.
3. Do not inspect glTF material JSON, source material assets, or the registry.
4. Do not create or register default materials in this stage.

Traversal readiness:

1. If `traversalReport.valid` is false, emit diagnostics and return no
   commands.
2. Nodes missing local TRS data because matrix decomposition is deferred should
   be skipped with descendants.
3. Nodes with no mesh can still produce transform/metadata commands.

## Diagnostics

Initial diagnostic codes:

- `gltfEcsAuthoring.invalidTraversalReport`
- `gltfEcsAuthoring.missingSceneRoot`
- `gltfEcsAuthoring.matrixTransformDeferred`
- `gltfEcsAuthoring.nodeSkippedByAncestor`
- `gltfEcsAuthoring.missingMeshRegistration`
- `gltfEcsAuthoring.skippedMeshRegistration`
- `gltfEcsAuthoring.unresolvedPrimitiveMaterial`
- `gltfEcsAuthoring.missingPrimitiveMaterialResolution`
- `gltfEcsAuthoring.duplicateEntityKey`

Diagnostics should include where possible:

- `sceneIndex`
- `nodeIndex`
- `entityKey`
- `parentEntityKey`
- `meshIndex`
- `primitiveIndex`
- `meshHandleKey`
- `materialHandleKey`
- source report reason codes from mesh registration or primitive material
  resolution.

## Non-Goals

- No `EcsWorld` mutation.
- No direct `Entity` values.
- No `ComponentInitialData` tied to registered component definitions.
- No asset registry writes.
- No glTF JSON traversal beyond consuming traversal reports.
- No mesh accessor decoding.
- No material or default-material creation.
- No render extraction or render snapshots.
- No WebGPU resource preparation.
- No cameras, lights, animation, skins, morph targets, variants, or scene
  instancing policy beyond the node-scoped primitive key fix above.

## Acceptance For Implementation

The implementation slice should include:

- Tests for scene root, node, and primitive command ordering.
- Tests for mesh handle readiness from written and pre-existing duplicate
  handles.
- Tests for unresolved material diagnostics.
- Tests for matrix transform deferral and subtree skipping.
- Tests proving repeated nodes referencing the same mesh produce distinct
  renderable entity keys that share the same mesh handle.
- JSON tests proving commands and diagnostics do not embed ECS entities,
  registry entries, mesh buffers, material source assets, or GPU resources.
