# Faceted foliage

`src/foliage.ts` provides two example-level geometry recipes. `foliageBatches`
fills authored ellipsoids; `branchFoliageBatches` attaches leaf pairs to authored
branch paths. Both return one `mesh.triangleList()` descriptor for each nonempty
`batch` ID. The caller supplies the layout, branch tubes, materials, shadows and
ECS transforms. Neither helper creates entities or a tree scene graph.

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

## Follow spreading branches

Use path attachment when the reference exposes fine shoots, paired leaves and
air between branches. An ellipsoid with more leaves still has an ellipsoid
silhouette; upright blades can also make a broadleaf crown read as needles.
Author a few uneven, tapering major branches, then smaller shoots that continue
outward. Reuse each shoot's path for its tube and leaves:

```ts
import { mesh } from "@aperture-engine/app/systems";
import { branchFoliageBatches, type LeafletBranch } from "./foliage.ts";

const shoots: LeafletBranch[] = [
  {
    path: [
      [0, 0, 0],
      [0.45, 0.35, 0],
      [1.05, 0.55, 0.1],
    ],
    pairs: 9,
    batch: 0,
    range: [0.2, 0.96],
    gaps: [[0.42, 0.56]],
    density: [0.95, 0.65],
    leafAngleDegrees: 35,
  },
  {
    path: [
      [0.45, 0.35, 0],
      [0.65, 0.7, -0.25],
      [0.85, 1, -0.35],
    ],
    pairs: 7,
    batch: 1,
    leafAngleDegrees: 30,
  },
];
const branches = shoots.map(({ path }) =>
  mesh.tube({
    path,
    radius: path.map((_, i) => 0.025 * (1 - i / path.length)),
    radialSegments: 6,
  }),
);
const leaves = branchFoliageBatches({
  seed: 37,
  leaflet: { length: 0.22, width: 0.11, thickness: 0.025 },
  branches: shoots,
  leafTiltDegrees: 40,
});
// Spawn branch and leaf descriptors with caller-owned materials and transforms.
```

- Order `path` points from base to growing tip. Leaf length follows the local
  tangent plus an outward angle, rather than world up. `leafAngleDegrees` is
  per branch (default 35); smaller angles point more strongly toward the tip.
- The default `up: [0, 1, 0]` is the preferred blade face normal at the base.
  A stable fallback handles vertical shoots; the frame then follows bends
  without introducing a world-axis flip. Override `up` to author a shoot's roll.
  `leafTiltDegrees` adds seeded blade roll, default 40 degrees. In this helper it
  means roll about blade length, while the ellipsoid helper retains its existing
  world-up tilt behavior.
- `pairs` is a candidate count: at most `2 * pairs` leaves. Sites are evenly
  distributed by arc length with small seeded spacing variation. `range` defaults
  to `[0.15, 0.95]`; ranges and `gaps` use fractions of the entire path length.
  A gap removes attachment sites, not every blade extending across its edge.
  Leave a wider interval when the final view needs a visible opening.
- A call accepts at most 1,024 branches and 20,000 candidate pairs total. Each
  path has 2–512 points and at most 512 gap intervals. Larger inputs fail with a
  range error before unbounded geometry allocation. Budget for at most 16
  triangles per candidate pair; split independent plants into separate calls.
- `density: [start, end]` gives pair retention at the ends of `range`, default
  `[1, 1]`. `[0.9, 0.6]` thins toward tips; `[0.4, 1]` exposes bases. Changing
  density or gaps alone removes complete pairs while preserving all surviving
  geometry and later branches. Changing seed, count, range or path changes layout.
- Use leaf length near one to two times the distance between pair sites as a
  starting point. A few overlapping shoots provide volume; filling every gap
  returns to a dense rounded crown. Start sparse and inspect the final camera.
  In a rendered control, blades about six times the pair spacing merged into
  flat, jagged fans at the tips, while long bare limbs dominated the silhouette.
  Add shorter side shoots along the leafy part of a limb before increasing its
  pair count. Keep the visible bare base deliberate with `range` and `gaps`.
  Wide 55–65 degree blade angles on shallow shoots also produced layered fronds.
  Ascending small shoots with 25–35 degree blade angles and 40 degree blade roll
  gave a more varied broadleaf silhouette. These are starting values; spreading
  plants may deliberately need the wider angles. Check that the final blade tips
  fit the camera after changing angle or shoot height.
- Both helpers share the closed eight-triangle blade and batching contract.
  The path helper additionally rounds positions to Float32 and rejects leaf
  collapse at that precision. Keep coordinates local to the plant and position
  the batch through its ECS transform when working far from the world origin.

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

The helpers supply neither branch meshes nor leaf stems. Path pairs attach the
blade base directly to a shoot. Animation, LOD and botanical branching structure
belong in a richer asset. CPU geometry checks establish finite, closed, outward
triangles. Render inspection is still needed to establish visual density,
contrast and silhouette quality.
