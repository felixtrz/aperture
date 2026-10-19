# Optional coplanar overlap inspection

`inspectCoplanarMeshOverlaps` and `aperture inspect coplanar` inspect selected
static mesh draws for positive-area coplanar triangle overlaps. This is an
on-demand CPU diagnostic for possible surface conflicts. It does not change
assets, transforms, extraction, rendering, or scene acceptance. Intentional
layers can produce findings.

For pixel extrema of actual selected vertices in an existing bundle, use
[projected bounds inspection](PROJECTED_BOUNDS_INSPECTION.md). It shares the
static range decoder and keeps degenerate vertex extrema; its result describes
unclipped geometry with unknown visibility.

The inspector consumes the extracted draw ranges and resolved world matrices.
ECS remains authoritative: parent rotation, nonuniform scale, reflection, and
affine shear are already represented in those matrices. The inspector never
reconstructs a second transform hierarchy.

## Offline CLI

Save a job beside an existing portable snapshot bundle:

```json
{
  "bundle": "scene.bundle.json",
  "scope": { "meshIds": ["foundation.mesh", "door.mesh"] },
  "tolerances": {
    "distance": 0.000001,
    "relativeDistance": 0.0000001,
    "angleRadians": 0.00001,
    "minArea": 0
  },
  "limits": {
    "maxDraws": 64,
    "maxTriangles": 50000,
    "maxTrianglePairs": 1000000,
    "maxFindings": 200
  }
}
```

```sh
aperture inspect coplanar inspection.json --out overlaps.json
```

The bundle path is relative to the job. `--out` is relative to the command's
working directory; its parent directory must exist. JSON is always printed to
stdout. An optional report is written atomically and must differ from the input
job and bundle. No application code, GPU, browser, or live session is started.
The command reuses the public bundle normalization, preflight, snapshot decode,
and typed source-asset decode paths.

Exit code 0 means a report was produced, including reports with findings or
partial coverage. Exit code 1 indicates invalid input or I/O failure. Read
`coverage` and `diagnostics`; an empty finding array alone is insufficient.
Incomplete bundle preflight produces `bundle-preflight` diagnostics and partial
coverage while supported available geometry is still inspected.

Scope must be explicit. Use exact `meshIds`, exact entity references such as
`"entities": [{ "index": 7, "generation": 0 }]`, or both. Their union selects
draws. Alternatively use `"scope": { "all": true }`, without other selectors.
Unknown selectors report partial coverage. An optional numeric `viewId` filters
each draw against that view's layer mask; two draws need not share a layer bit
with each other if both belong to the chosen view. Omitting `viewId` compares
all selected extracted draws regardless of layers.

## Public render API

```ts
import {
  inspectCoplanarMeshOverlaps,
  type MeshAsset,
  type SourceMaterialAsset,
} from "@aperture-engine/render";

const report = inspectCoplanarMeshOverlaps({
  snapshot: app.extract(1),
  scope: { meshIds: ["foundation.mesh", "door.mesh"] },
  resolveMesh: (handle) =>
    app.context.assetsRegistry.get<"mesh", MeshAsset>(handle)?.asset ??
    undefined,
  resolveMaterial: (handle) =>
    app.context.assetsRegistry.get<"material", SourceMaterialAsset>(handle)
      ?.asset ?? undefined,
});
```

The API is pure with respect to its snapshot and resolved assets. Call it after
the desired simulation update and extraction, or pass an already decoded
snapshot and source-asset maps. It adds no per-frame work unless called.

## Geometry and tolerances

Only distinct selected draws are compared. Their selected triangle-list
submeshes and packet range overrides are respected, including indexed ranges
and interleaved `float32x3` POSITION streams. Inactive source submeshes are not
inspected. Indexed draws use the renderer's base-vertex-zero convention.

Vertices are transformed using the actual Float32 snapshot matrix coefficients,
with CPU Number arithmetic. Normals come from triangle geometry. Opposite
winding is allowed. Both triangles must lie within the effective plane-distance
tolerance of each other's plane, and their unoriented normals must satisfy the
angular tolerance. Convex clipping in a translated dominant-axis projection
then measures the positive intersection area in world units squared. Shared
edges and shared vertices have zero area and are excluded. Plane tolerance does
not inflate the clipping half-planes into artificial overlap strips.

| Option             | Default | Meaning                                                |
| ------------------ | ------: | ------------------------------------------------------ |
| `distance`         |  `1e-6` | Absolute world-space plane distance                    |
| `relativeDistance` |  `1e-7` | Multiplied by the larger triangle's longest edge       |
| `angleRadians`     |  `1e-5` | Maximum angle between unoriented planes, from 0 to π/2 |
| `minArea`          |     `0` | Findings must exceed this world-space area             |

The effective distance is the larger absolute or relative distance. These are
geometric thresholds, not renderer depth-buffer tolerances. Near-coplanar
findings report a polygon on the first triangle's plane; their area is a
projected potential conflict, not an exact intersection between separated
surfaces. A floating-point area floor also applies. Numerically unresolved
geometry, large translations that lose local detail, or overflowing derived
tolerances report partial coverage rather than a clean negative result. Loose
distance tolerances do not disable the independent precision checks.

## Coverage, limits, and visibility

The `aperture.coplanar-overlaps.v1` report includes effective settings, counts,
diagnostics, and findings. Each finding identifies both entity generations,
render IDs, mesh/material IDs, submesh indices, source triangle offsets, and
material render state. It records world-space polygon witnesses, area, measured
plane separation, normal dot product, and effective distance tolerance. Triangle
offsets address the original index sequence or nonindexed vertex sequence.

`coverage: "complete"` means all selected supported extracted draw pairs were
examined within the requested limits. `"empty"` means fewer than two eligible
draws and no diagnostics. `"partial"` means some coverage was unavailable,
unsupported, uncertain, or truncated. Complete coverage is scoped to these
draws and geometric thresholds; it does not certify an image or the whole scene.

Preparation and comparison have deterministic limits. Defaults are 64 draws,
50,000 attempted triangles, 1,000,000 candidate triangle pairs, and 200 findings.
Draws are ordered by entity index and generation, render ID, submesh, and asset ID. Draw
and triangle AABBs reject separated geometry before clipping. Triangle-pair work
counts include AABB-rejected pairs. A draw exceeding the remaining triangle
budget stops preparation; attempted triangles still count when a later invalid
index prevents that draw's inspection. Finding truncation is reported when an
additional finding exists beyond the limit. Memory is proportional to prepared
triangles and retained findings; worst-case pair work is quadratic within the
explicit cap. V1 adds no dependency or persistent spatial cache.

Visibility is always `"unknown"`. Material state is evidence, not a visibility
verdict: camera-facing tests, frustum/near-plane clipping, material culling,
alpha masks, textures, depth bias, blending, occlusion, rasterization, and MSAA
are not evaluated. Opposing faces and intentional coplanar layers may therefore
be reported. A view filter only selects layers. Extracted snapshots can already
omit culled entities; omitted geometry cannot be recovered from this report.

V1 skips missing assets, unsupported positions/topologies, invalid ranges or
matrices, custom vertex shaders, standard-material deformation, skinning,
morphing, and instance-attribute packets, with diagnostics. It does not inspect
self-overlap within one draw, lines, sprites, particles, or shadow-only packets.
Degenerate triangles are skipped and make coverage partial. Findings are per
triangle pair; overlapping findings are not merged into a union, so summing
their areas can double-count stacked geometry. The tool neither fixes nor
rejects scenes automatically.
