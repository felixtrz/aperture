# GLB Primitive Material Resolution Handoff Plan - 2026-05-17

## Scope

Plan the renderer-independent handoff that resolves glTF primitive `material`
indices to Aperture material handles for later ECS authoring commands.

This is a planning slice only. It must not mutate an asset registry, create a
default material, author ECS entities, decode meshes or images, create render
snapshots, or touch WebGPU.

Reference anchors:

- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration.ts`
- Bevy glTF primitive material labeling and default material-style separation in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- three.js `GLTFLoader.loadMesh` default-material behavior in
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`

Common reference pattern: primitives resolve material references during mesh or
scene instantiation, but source material assets are loaded and identified
separately. Aperture should adapt this by producing a material-resolution report
that later ECS authoring can consume, rather than creating materials or entities
inside the resolver.

## Required Separation

Keep primitive material resolution layered:

```text
GLB material/texture mapping report
  -> source asset registry registration report
  -> mesh primitive mapping report
  -> primitive material resolution report
  -> ECS authoring command report
```

The material-resolution report should answer: "Which material handle should this
primitive use, and why is it unavailable if it cannot be resolved?"

It should not answer by mutating registry state.

## Proposed Helper

Add a helper later under `packages/render/src/assets`:

```ts
createGltfPrimitiveMaterialResolutionReport(input):
  GltfPrimitiveMaterialResolutionReport
```

Inputs:

- `primitiveReport`: `GltfMeshPrimitiveMappingReport`.
- `registrationReport`: `GltfSourceAssetRegistrationReport`.
- `availableMaterialHandleKeys`: caller-provided full material handle keys that
  already exist outside the current registration report.
- `defaultMaterialHandleKey`: optional full material handle key to use for
  primitives with no glTF `material` index.
- `keyPrefix`: optional prefix used by the GLB material mapper, defaulting to
  `gltf`.

The helper should not import or receive `AssetRegistry` directly unless a later
task proves that an inspection-only registry adapter is clearer. The first
contract can stay report-driven and serializable.

## Handle Resolution Rules

For a primitive with `materialIndex: n`:

1. Compute the expected material handle key:
   `material:<keyPrefix>:material:<n>`.
2. If `registrationReport.written` includes that key as a material, resolve it.
3. Else if `availableMaterialHandleKeys` includes that key, resolve it.
4. Else if `registrationReport.skipped` contains that key:
   - `duplicateAssetKey` is resolvable only when
     `availableMaterialHandleKeys` includes the key.
   - `invalidPlannedAsset`, `missingDependency`, or `rootInvalid` are errors.
5. Else emit `gltfPrimitiveMaterial.unregisteredMaterial`.

For a primitive with no glTF `material` index:

1. If `defaultMaterialHandleKey` is provided and listed in
   `availableMaterialHandleKeys` or `registrationReport.written`, resolve it.
2. If the default handle key is provided but unavailable, emit
   `gltfPrimitiveMaterial.defaultMaterialUnavailable`.
3. If no default handle key is provided, emit
   `gltfPrimitiveMaterial.defaultMaterialRequired`.

The resolver must not create or register the default material. The caller should
provide a real default material handle through an earlier source-asset setup
step. This avoids hidden registry mutation and keeps default material policy
testable.

## Report Shape

```ts
interface GltfPrimitiveMaterialResolutionReport {
  readonly valid: boolean;
  readonly resolved: readonly GltfResolvedPrimitiveMaterial[];
  readonly unresolved: readonly GltfUnresolvedPrimitiveMaterial[];
  readonly diagnostics: readonly GltfPrimitiveMaterialResolutionDiagnostic[];
}

interface GltfResolvedPrimitiveMaterial {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey: string;
  readonly source: "registered" | "available" | "default";
}
```

Unresolved entries should include the primitive source indices, planned mesh
handle key, expected material handle key when derivable, reason code, and
diagnostics.

## Diagnostics

Diagnostics should be JSON-safe and include primitive and material context:

- `gltfPrimitiveMaterial.missingMaterialPlan`
- `gltfPrimitiveMaterial.unregisteredMaterial`
- `gltfPrimitiveMaterial.skippedMaterial`
- `gltfPrimitiveMaterial.duplicateMaterialUnavailable`
- `gltfPrimitiveMaterial.failedMaterialDependency`
- `gltfPrimitiveMaterial.defaultMaterialRequired`
- `gltfPrimitiveMaterial.defaultMaterialUnavailable`

Diagnostic fields should include where possible:

- `meshHandleKey`
- `meshIndex`
- `primitiveIndex`
- `materialIndex`
- `materialHandleKey`
- `registrationReason`
- `dependencyKey`
- `source`

Skipped registration reasons should be preserved from
`GltfSourceAssetRegistrationReport`, especially `duplicateAssetKey`,
`invalidPlannedAsset`, `missingDependency`, and `rootInvalid`.

## ECS Authoring Boundary

The later ECS authoring command report should consume only resolved material
handle keys:

- Primitive renderable entity gets `Material.materialId` from the resolved
  handle id.
- It should not inspect glTF material JSON directly.
- It should not register fallback/default materials.
- It should emit ECS authoring diagnostics for any unresolved primitive material
  rather than creating a renderable with a fake material.

This keeps material source mapping, registry readiness, primitive resolution,
and ECS authoring as separate inspectable stages.

## Non-Goals

- No asset registry writes.
- No default material construction.
- No mesh accessor decoding.
- No image decoding or URI fetching.
- No ECS world mutation or `Entity` references.
- No render extraction or render snapshots.
- No WebGPU resource preparation.
- No material variant support.

## Follow-Up Slices

1. Implement primitive material resolution once scene traversal and accessor
   validation reports have stable tests.
2. Add JSON fixture tests for registered, duplicate/pre-existing, skipped,
   missing, and default-material cases.
3. Add an audit before wiring primitive material resolution into ECS authoring
   command planning.
