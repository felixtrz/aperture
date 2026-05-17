# GLB Scene And Node Traversal Diagnostics Plan - 2026-05-17

## Scope

Plan the smallest renderer-independent scene/node traversal report that can
follow GLB mesh primitive source mapping and precede ECS authoring commands.

This is a planning slice only. It must not mutate an ECS world, create entities,
register assets, decode mesh buffers, create render snapshots, or touch WebGPU.

Reference anchors:

- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md`
- `docs/ARCHITECTURE.md`
- Aperture `LocalTransform`, `Parent`, `WorldTransform`, and `Name`
  component contracts in `packages/simulation/src/transform/components.ts`
- Bevy glTF node asset loading, scene root creation, node recursion, and cycle
  checks in `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- Bevy glTF scene helpers in
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`

Common reference pattern: Bevy creates labeled node assets, checks cycles, then
spawns scene-world entities from selected scene roots. Aperture should keep the
same stage separation, but the first output should be a serializable traversal
and diagnostics report. ECS replay comes later.

## Required Separation

Keep scene traversal layered:

```text
GLB bytes / glTF JSON
  -> root validation
  -> mesh primitive mapping report
  -> scene/node traversal report
  -> ECS authoring command report
  -> replay commands into EcsWorld
  -> transform resolution
  -> render extraction
```

The traversal report may name future entity keys and component-shaped transform
payloads, but it must not store EliCS `Entity` values or call world mutation
APIs.

## Scene Selection

Proposed input:

```ts
interface GltfSceneTraversalOptions {
  readonly root: unknown;
  readonly sceneIndex?: number;
  readonly keyPrefix?: string;
}
```

Selection rules:

1. If `sceneIndex` is provided, use it after validating it is a non-negative
   integer and exists in `scenes[]`.
2. Otherwise, if root `scene` is a valid non-negative integer and exists in
   `scenes[]`, use it.
3. Otherwise, if `scenes[]` has exactly one scene, use index `0`.
4. Otherwise, emit a diagnostic and return no traversal nodes.

This keeps default-scene behavior deterministic while avoiding silent selection
when a file contains multiple scenes but no valid default.

Scene root entity key:

```text
<keyPrefix>:scene:<sceneIndex>
```

Default `keyPrefix` is `gltf`, producing `gltf:scene:0`.

## Node And Entity Keys

Use import-local keys, not `Entity` instances:

```ts
type GltfTraversalEntityKey = `gltf:scene:${number}` | `gltf:node:${number}`;
```

Primitive renderable keys remain owned by the later ECS authoring plan:

```text
gltf:mesh:<meshIndex>:primitive:<primitiveIndex>
```

The traversal report should identify which mesh index a node references, but it
should not create primitive renderable child entries yet. Primitive renderable
commands require mesh handle readiness and material handle resolution.

## Traversal Report Shape

Proposed helper:

```ts
createGltfSceneTraversalReport(input): GltfSceneTraversalReport
```

Report:

```ts
interface GltfSceneTraversalReport {
  readonly valid: boolean;
  readonly sceneIndex: number | null;
  readonly sceneEntityKey: string | null;
  readonly rootNodeKeys: readonly string[];
  readonly nodes: readonly GltfTraversedNode[];
  readonly diagnostics: readonly GltfSceneTraversalDiagnostic[];
}

interface GltfTraversedNode {
  readonly nodeIndex: number;
  readonly entityKey: string;
  readonly parentEntityKey: string;
  readonly depth: number;
  readonly label: string;
  readonly localTransform: GltfNodeLocalTransform | null;
  readonly meshIndex: number | null;
  readonly childNodeIndices: readonly number[];
}
```

`parentEntityKey` should be the selected scene root key for root nodes and the
parent node key for child nodes. `depth` should be deterministic traversal depth
from the selected scene root.

## Traversal Rules

Validate before returning node entries:

- `scenes` must be an array when scene traversal is requested.
- Selected scene must be an object.
- Selected scene `nodes` must be an array when present.
- Root node indices must be non-negative integers in range.
- `nodes` must be an array when node traversal is requested.
- Each traversed node must be an object.
- Node `children`, when present, must be an array of valid node indices.
- Detect cycles with a recursion stack, not only a global visited set.
- Detect duplicate parentage in the selected scene and report it before ECS
  command planning. A glTF node should not become two authoritative ECS nodes
  through accidental shared traversal without an explicit instancing policy.

Traversal order should be depth-first and preserve glTF array order within each
scene root and node `children` array. This gives stable command and diagnostic
ordering for tests and agent-readable reports.

## Transform Mapping

Initial node transform payload:

```ts
type GltfNodeLocalTransform =
  | {
      readonly kind: "trs";
      readonly translation: readonly [number, number, number];
      readonly rotation: readonly [number, number, number, number];
      readonly scale: readonly [number, number, number];
    }
  | {
      readonly kind: "matrix";
      readonly matrix: readonly [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      readonly decomposed: false;
    };
```

TRS mapping should use Aperture's existing conventions:

- `translation`: default `[0, 0, 0]`.
- `rotation`: default `[0, 0, 0, 1]`, quaternion order `[x, y, z, w]`.
- `scale`: default `[1, 1, 1]`.

The first traversal helper should validate numeric tuple shapes but does not
need to build `ComponentInitialData`. That belongs in the ECS authoring command
report.

Matrix transforms should not be silently decomposed until Aperture has a tested
matrix decomposition helper. For the first traversal report, preserve the
16-number matrix payload and emit `gltfScene.unsupportedMatrixDecomposition`
when a later ECS command would require TRS component data. A future task can
add tested decomposition for affine matrices and diagnostics for shear,
non-finite values, and non-decomposable transforms.

glTF forbids using both `matrix` and any TRS field on the same node. The
traversal helper should emit `gltfScene.malformedTransform` for mixed or
malformed transform fields.

## Diagnostics

Diagnostics should be JSON-safe and source-indexed:

- `gltfScene.malformedScenes`
- `gltfScene.invalidSceneIndex`
- `gltfScene.malformedScene`
- `gltfScene.malformedSceneNodes`
- `gltfScene.malformedNodes`
- `gltfScene.invalidNodeIndex`
- `gltfScene.malformedNode`
- `gltfScene.malformedChildren`
- `gltfScene.nodeCycle`
- `gltfScene.nodeMultipleParents`
- `gltfScene.malformedTransform`
- `gltfScene.unsupportedMatrixDecomposition`

Each diagnostic should include where possible:

- `sceneIndex`
- `nodeIndex`
- `parentNodeIndex`
- `childNodeIndex`
- `entityKey`
- `field`
- `value`
- `path`

Cycle diagnostics should include a compact node-index path such as
`[0, 2, 4, 0]` so agents can identify the bad relationship without inspecting
the original JSON.

## ECS Authoring Boundary

The traversal report should be consumable by the later ECS authoring command
planner:

- Scene root becomes a `createEntity` command with `Name`, root
  `LocalTransform`, `Parent(null)`, and `WorldTransform` initial data.
- Each traversed node becomes a `createEntity` command with `Name`,
  `LocalTransform`, `Parent`, `WorldTransform`, and default `Visibility`.
- Mesh primitive renderable child commands are added only after mesh primitive
  handles and material handles can both be resolved.

The traversal report itself must not include:

- EliCS `Entity` references.
- `ComponentInitialData` objects tied to registered component definitions.
- Renderer objects.
- Asset registry writes.
- WebGPU handles.

## Non-Goals

- No ECS world mutation.
- No primitive renderable entity planning.
- No mesh, material, texture, or sampler registration.
- No accessor/buffer decoding.
- No camera, light, animation, skin, morph target, or variant authoring.
- No coordinate-system conversion beyond preserving source transform data.
- No render extraction or WebGPU preparation.

## Follow-Up Slices

1. Implement `createGltfSceneTraversalReport` with scene selection, traversal,
   cycle diagnostics, and transform payload validation.
2. Add JSON fixture tests for stable traversal and diagnostic output.
3. Add a tested matrix decomposition helper or explicitly block matrix-based ECS
   authoring until decomposition is implemented.
4. Implement ECS authoring command planning only after mesh primitive mapping,
   material registration, scene traversal, and transform mapping have passing
   tests.
