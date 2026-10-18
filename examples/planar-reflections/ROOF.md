# Fitted barrel-tile courses

`src/roof.ts` is a pure geometry recipe for one planar roof face or one cap run.
It returns public `mesh.polygons()` descriptors grouped by material variant and
bounded chunk, plus the individual closed tile faces for inspection. Supply the
roof geometry; assign materials and spawn the results through your ECS system.
The helper owns no building layout, renderer state, materials or entities.

```ts
import { roofFaceTileBatches, roofCapTileBatches } from "./roof.ts";

const tile = { width: 0.28, length: 0.46, thickness: 0.025, overlap: 0.1 };
const batches = roofFaceTileBatches({
  seed: 37,
  materialCount: 3,
  tile,
  columnPitch: 0.27,
  face: {
    origin: [0, 2, 1], // center of the eave
    across: [1, 0, 0],
    uphill: [0, 0.6, -0.8],
    boundary: [
      [-1.5, 0],
      [1.5, 0],
      [0, 1.8],
    ],
  },
});
for (const batch of batches) {
  this.spawn.mesh({
    key: `roof.front.${batch.batch}.${batch.chunk}`,
    mesh: batch.mesh,
    material: tileMaterials[batch.batch]!,
    castShadow: true,
    receiveShadow: true,
  });
}

// A separate wider cap covers one shared hip. Derive endpoints from the same
// roof vertices as both adjoining faces, then offset them deliberately outward.
const caps = roofCapTileBatches({
  seed: 38,
  materialCount: 3,
  tile: { ...tile, width: 0.36 },
  start: [-1.5, 2.06, 1],
  end: [0, 3.14, -0.44],
  up: [0, 1, 0],
});
// Spawn each cap batch with its own key prefix in the same way.
```

## Author the roof plane explicitly

`across` and `uphill` must be perpendicular, nonzero directions; their lengths
are normalized. Their cross product is the outward roof normal. Looking at the
front of a roof, orient `across` along its eave so that this normal points into
the air. `origin` and all emitted vertices are in the caller's mesh coordinate
space. Avoid adding another midpoint/rotation transform to endpoint-authored
geometry.

`boundary` contains 3–16 corners in across/uphill **distances**, rather than
fractions. It must be strictly convex, without repeated or collinear corners;
either winding is accepted. Use triangles for hip ends, trapezoids beside a
ridge, and rectangles for simple slopes. Split a concave or bent roof into
separate faces. Columns are anchored at multiples of `columnPitch` around
across-distance zero. Courses start at the boundary's smallest uphill distance.

Each tile is a closed faceted crescent with a narrower uphill tail. Every
surface is clipped against the actual roof boundary; the new cut receives an
outward closing face. This fits slanted hips without stopping whole tiles at
one conservative centerline limit or leaving overlong corners beyond the bed.
`minimumFragment` omits fragments narrower than that fraction of tile width or
shorter than that fraction of tile length (default 4%). Fit caps over these
small boundary fragments. The helper does not invent adjacent roof faces or
automatically choose a hip-cover radius.

## Make courses visible in geometry

Merely breaking an extrusion into short coplanar pieces leaves the same visible
surface. Random colors then read as patches on a long rib, and coincident laps
can produce dark seams. A roof tile needs a real downhill lip.

Here `pitch = length - overlap`. The tile's base lift decreases linearly from
`clearance + lipRise` at its downhill lip to `clearance` at its uphill tail.
Two aligned courses therefore have a constant base separation of
`lipRise * pitch / length` throughout their overlap. The default is 1.6 times
shell thickness; values at or below 1.05 times thickness are rejected. This
gives a readable edge without accumulating height toward the roof apex.
The default 12% taper also makes the covering lip wider than the underlying
tail. Courses remain parallel along the roof slope.

Start with 15–25% length overlap, 6 arc facets, a tile length around 1.5–2 times
its width, and two to five related terracotta colors. `columnPitch` can range
from 90–125% of width; keep it near or just below width for continuous cover.
Large spacing deliberately exposes the roof bed. Width taper can also reveal
narrow channels, so use a continuous bed beneath the tile shell. Provide the
bed separately with the same face boundary and correct outward winding.

At the final image resolution, the exposed course length should occupy enough
pixels to show a lip and its small shadow. Inspect at least the hero and side
views: verify the eave thickness, individual courses, hip coverage and apex
closure. Material noise, AO and shadow bias cannot repair coplanar surfaces.

## Caps, determinism and bounds

Cap runs use the same stepped tile geometry. Their axis follows `start` to
`end`; `up` is projected perpendicular to that axis. An up vector parallel to
the axis is invalid. The run clips exactly at both endpoints. Choose a cap
width and outward offset that cover the neighboring face cuts; excessive
offset makes the cap float. Adjacent cap runs at a ridge or apex still need a
deliberate terminal piece. Caps do not boolean-union themselves or infer
roof intersections.

The seed drives only material assignment through a local 32-bit LCG. No global
or scene random stream is consumed, and geometry never jitters away from its
shared boundaries. Same inputs and seed reproduce the descriptors exactly.
Changing the boundary/grid can change the material sequence because every
candidate advances it. A maximum of 20,000 candidate cells bounds each call.
Material groups split into chunks below the public polygon facade's face and
vertex limits. Use both `batch` and `chunk` in entity keys, and split large
spatially separated roofs into separate calls for useful culling.

Validation rejects invalid dimensions, coplanar lap settings, malformed
boundaries, invalid bases and collapsed Float32 edges. Keep coordinates near
the origin relative to tile size, and avoid microscopic fragments. The public
polygon builder performs final Float32 planarity and triangulation validation.
Closedness alone does not establish outward winding: check reversed edge pairs,
positive signed volume, and normals on the hollow underside as well as the top.
The retained CPU control in
`benchmarks/visual-parity-20261018/evidence/roof-authoring-control/` exercises
those checks and preserves an unchanged-scene comparison. CPU checks establish
geometry integrity; renders establish the visual result.
