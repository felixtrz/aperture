# Faceted foliage

`src/foliage.ts` is an example-level geometry recipe, not a tree generator. Supply
cluster centers, ellipsoid radii (`spread`), counts, leaf dimensions and a seed.
It returns one `mesh.triangleList()` descriptor for each nonempty `batch` ID.
The caller supplies materials, shadows and ECS transforms.

```ts
import { foliageBatches } from "./foliage.ts";

const batches = foliageBatches({
  seed: 37,
  leaflet: { length: 0.22, width: 0.1, thickness: 0.025 },
  clusters: [
    { center: [0, 0.4, 0], spread: [0.45, 0.3, 0.35], count: 90, batch: 0 },
    { center: [0.35, 0.6, 0], spread: [0.3, 0.4, 0.25], count: 70, batch: 1 },
  ],
});
// Spawn each batch.mesh with the material assigned to batch.batch.
```

## Match the visual scale

Large closed faceted masses work when the reference has a chunky crown silhouette
or when individual leaves project below a pixel. When the reference exposes leaf
edges, branch gaps and small light/shadow facets, replace those masses with small
leaf volumes. Keep the deliberate larger cluster arrangement: a uniformly noisy
sphere still reads as a sphere.

Start with leaves about 10–25% of a cluster's diameter, roughly 2:1 length to width,
and thickness about 10–15% of length. Dimensions are full extents. Each leaf has
six vertices and eight outward triangles: four on each side of a diamond rim.
Positive thickness closes the underside and makes shadow and reflection views
valid without double-sided cards. Check winding as well as closedness: each
face normal must point away from the leaf center, every directed edge must have
exactly one reversed neighbor, and signed volume must be positive. An inward
closed leaf can light incorrectly; closedness alone does not establish quality. The default 20% size variation changes all
three dimensions together. Avoid scaling a few large pale triangles to fill a
crown; those read as shards, catch broad highlights and hide branch structure.

Check the final camera resolution. Around 12–20 pixels of leaf length can show a
clear low-poly leaf; tiny leaves become shimmering speckles. Increase count only
until adjacent leaves read as foliage, then inspect the silhouette and gaps.
For an orthographic camera, approximate projected length as
`leafLength / orthographicHeight * imageHeight` before foreshortening.

## Preserve structure and keep cost predictable

- Place overlapping clusters around branch tips, with unequal extents. Leave
  larger gaps around the trunk and major forks; do not fill every empty region.
- `spread` places centers inside an ellipsoid. Leaves extend beyond it by up to
  half their largest dimension times `1 + sizeVariation`. Keep that fringe in
  mind near walls and pots. Cluster rotations use the same XYZ convention as
  spawn transforms and orient the center distribution. Blade tilt stays relative
  to world up: `leafTiltDegrees` defaults to 30. This avoids every cluster having
  a different apparent growth direction. All positions are baked into the batch.
- Leaf size is independent of cluster size. Use per-cluster `leaflet` overrides
  for small plants, rather than stretching thin leaf volumes into large shards.
- Reuse two to five related opaque material colors. `batch` is only a material
  grouping ID: equal IDs combine across clusters, so hundreds of leaves do not
  create hundreds of ECS entities or draw descriptors. Each leaf adds 8 triangles
  and 24 flat-shaded corners. Large batches reduce culling precision; split
  distant plants into separate calls if the scene needs spatial culling.
- The seed uses a local 32-bit LCG; fixed inputs and cluster order reproduce the
  exact geometry without consuming the scene's random stream. Changing a count
  changes the subsequent random sequence. Keep cluster order stable when
  comparing revisions.

The helper supplies neither branches nor leaf stems. It is suitable for small
stylized foliage studies; authored branch-aligned leaf pairs, animation, LOD and
botanical structure belong in a richer asset or a separate helper. CPU geometry
checks establish finite, closed, outward triangles. Render inspection is still
needed to establish visual density, contrast and silhouette quality.
