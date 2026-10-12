# @aperture-engine/render

Renderer-independent ECS authoring, assets, extraction, and the per-frame `RenderSnapshot` contract for the Aperture engine.

## Install

```sh
pnpm add @aperture-engine/render
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) WebGPU game engine and is normally used alongside the other `@aperture-engine/*` packages (it depends on `@aperture-engine/simulation` for the ECS world and asset registry).

## What it does

`@aperture-engine/render` defines the authoring side of Aperture's render pipeline without depending on any specific GPU backend. You attach plain ECS components (`Mesh`, `Material`, `Camera`, `Light`, `Sprite`, UI nodes, particle emitters, audio emitters, and more) to entities, then extract a backend-agnostic `RenderSnapshot` for the frame. A separate renderer package consumes that snapshot to issue WebGPU work. The package also bundles glTF/GLB asset loading, KTX2/Draco/Meshopt/HDR decoders, material and mesh contracts, MSDF text atlases, and snapshot encoding/diagnostics.

## Usage

```ts
import { createWorld, AssetRegistry } from "@aperture-engine/simulation";
import {
  registerRenderAuthoringComponents,
  extractRenderSnapshot,
  Camera,
  Mesh,
  Material,
  createCamera,
} from "@aperture-engine/render";

const world = createWorld();
const assets = new AssetRegistry();

// Register the render authoring components on the world.
registerRenderAuthoringComponents(world);

// Author a camera and a mesh entity.
world.createEntity().addComponent(Camera, createCamera());
world
  .createEntity()
  .addComponent(Mesh, { meshId: "my-mesh" })
  .addComponent(Material, { materialId: "my-material" });

// Produce the per-frame RenderSnapshot a renderer can consume.
const snapshot = extractRenderSnapshot(world, assets, { frame: 0 });
```

## Static mesh assembly

Keep repeated objects as ECS entities sharing mesh/material handles so the renderer
can instance them. For a static prop assembled from distinct transformed pieces,
`bakeMeshAssetTransform()` makes an owned source asset that can feed the existing
`mergeMeshAssetsForBatch()` helper:

```ts
import {
  bakeMeshAssetTransform,
  createBoxMeshAsset,
  mergeMeshAssetsForBatch,
} from "@aperture-engine/render";
import { createMeshHandle } from "@aperture-engine/simulation";

const box = createBoxMeshAsset();
const baked = bakeMeshAssetTransform({
  mesh: box,
  // Column-major: scale [2,1,1], translate [3,0,0].
  transform: [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1],
});
if (!baked.valid || baked.mesh === null) {
  throw new Error(JSON.stringify(baked.diagnostics));
}
const batch = mergeMeshAssetsForBatch({
  sources: [
    { handle: createMeshHandle("piece-a"), mesh: box },
    { handle: createMeshHandle("piece-b"), mesh: baked.mesh },
  ],
});
if (!batch.valid || batch.mesh === null) {
  throw new Error(JSON.stringify(batch.diagnostics));
}
// Register batch.mesh as a normal mesh asset; retain batch.ranges for source mapping.
```

Baking transforms source-local positions, applies the normalized inverse transpose
to normals, orthogonalizes tangents, corrects mirrored winding/handedness, and
recomputes bounds from stored float32 positions. It preserves index format/count,
stream layout, passive UV/color bytes, material slots and submesh ranges. All output
buffers and metadata are separate copies; old partial-update ranges are removed
because this is a new full-upload asset. Compatible baked sources merge through the
existing helper's layout/material checks and index rebasing.
Merging preserves submesh/material ranges; combining buffers alone does not
guarantee a single draw call.

The supported scope is static `triangle-list` meshes with one `float32x3` POSITION,
optional `float32x3` NORMAL, and optional `float32x4` TANGENT (requiring NORMAL).
Interleaved or separate Float32Array/Uint16Array/Uint8Array streams and subarray byte
offsets are supported. Declared TEXCOORD_0/1 and COLOR_0 attributes in existing mesh
formats are copied; deformation semantics, overlapping attribute storage and
SharedArrayBuffer inputs are rejected. Mirrored shared/overlapping submesh triplets
are reversed once; ranges overlapping different triplet boundaries are rejected.
Matrices must have 16 finite column-major values, an exact affine last row
`[0,0,0,1]`, and a numerically resolvable nonsingular linear part. Nonfinite float32
outputs and collapsed active triangles fail with a field path and diagnostic.
`MESH_BAKE_TRANSFORM_LIMITS` bounds vertices (2 million), indices/active corners
(6 million), source view bytes (128 MiB), streams (16), attributes per stream (16),
submeshes (4096) and material slots (4096); split larger source assets before baking.

`createTriangleListMeshAsset()` and `mesh.triangleList()` also accept tuple arrays
or packed `Float32Array` positions/normals (xyz) and UVs (uv). Explicit normals retain
indexed vertices; omitting normals produces flat face normals and expands corners.
Add `tangents` as xyzw tuples or a packed float32 array with explicit normals to
retain an authored normal-map basis. Tangent xyz is normalized and orthogonalized;
w must be +1 or -1. Tangents use a separate 16-byte stream. Without tangents, the
existing 32-byte POSITION/NORMAL/UV layout and output bytes remain unchanged. Packed
inputs are copied from their view, including nonzero byte offsets; shared packed
storage is unsupported. Keep duplicated positions at UV seams where distinct UVs
or tangent handedness require distinct vertices.

## Entry points

This package exposes the following subpaths in its `exports` map:

- `@aperture-engine/render` — the full public API (assets, materials, mesh, rendering, text).
- `@aperture-engine/render/test-support` — extra helpers for inspecting snapshots, prepared resources, and the material queue in tests.

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT licensed.
