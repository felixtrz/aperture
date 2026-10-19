# Share roof, wall and overhang boundaries

`src/roof-envelope.ts` is a pure example recipe for a straight ridge with two
planar slopes. It returns public polygon descriptors for a closed roof bed and
a separate closed wall solid, plus tile frames and construction features. The
caller owns materials, entities, placement and any openings or decorative trim.

```ts
import { roofEnvelope } from "./roof-envelope.ts";

const envelope = roofEnvelope({
  roofX: [-3, 2.4],
  wallX: [-2.7, 2.2],
  wallZ: [-1.8, 1.6],
  // [z, y]: back eave, ridge, front eave; these define the bed's TOP.
  profile: [
    [-2.2, 2.1],
    [0.35, 3.8],
    [1.9, 2.5],
  ],
  baseY: 0,
  thickness: 0.12,
});

this.spawn.mesh({
  key: "building.wall",
  mesh: envelope.wall.mesh,
  material: wallMaterial,
  castShadow: true,
  receiveShadow: true,
});
this.spawn.mesh({
  key: "building.roof",
  mesh: envelope.roof.mesh,
  material: roofMaterial,
  castShadow: true,
  receiveShadow: true,
});
```

All values are in the caller's local frame. Place both solids under the same ECS
assembly transform when moving or rotating the building. Do not add separate
midpoint/rotation transforms to the returned endpoint-authored geometry.

## One envelope, explicit thickness

The profile defines the top surface. `thickness` shifts that surface vertically
downward; it is **not normal thickness**. The normal separation is smaller on a
steeper slope. Wall tops are the intersections of this underside with `wallZ`,
including the ridge, so they cannot keep an independently entered gable pitch.

`roofX` and `wallX` set roof and support spans along the ridge. `wallZ` sets the
back/front supports inside the eaves. The bed's continuous underside forms the
sloped soffit across each overhang; eave fascia and gable end faces close the
roof solid. No separate clearance is inserted between wall and roof. The two
closed components share intentional internal contact surfaces; they are not
boolean-unioned into one mesh.

Edit the profile to change pitch, ridge location or eave heights. Edit spans to
change width/depth or overhang. Recompute the entire envelope after an edit;
keeping an old wall beside a new roof breaks the shared-boundary contract. This
recipe does not generate hips, dormers, openings, a whole building or tile caps.

## Tile frames, caps and inspection

`tileFaces.back` and `.front` feed the existing
[`roofFaceTileBatches`](ROOF.md) recipe directly. Their origins and boundaries lie
on the bed top. Across directions intentionally differ between slopes so
`across × uphill` faces outward. Fit the tile grid and verge trim as described in
that guide; a closed bed alone does not finish exposed tile cuts.

`ridge.start` and `.end` describe the **bed ridge**. Choose a cap's covering width
and outward offset from the actual tile shell; the recipe does not infer those
values. Excessive offset makes a cap float. Do not treat a bed path as proof that
the cap covers neighboring courses or closes its terminals.

Each solid exposes `faces` with semantic names and local outlines. `landmarks`
names wall support/ridge intersections and roof eave corners. These points come
from the same construction as the meshes and can feed
[local camera inspection](../../docs/CAMERA_LOCAL_INSPECTION.md) under the
assembly's current ECS transform. They do not establish visibility or supply
reference target pixels automatically.

## Supported inputs and checks

Spans and `[z,y]` points must be dense finite pairs within ±1,000,000. The ridge
must be above both eaves and strictly inside both wall supports; supports may
coincide with roof endpoints/eaves. Wall tops must lie above `baseY`. Unknown
fields, including a redundant pitch override, are rejected.

This example rejects numerically fragile geometry conservatively. Let `scale`
be the maximum of 1, absolute input coordinates and positive spans. Positive
spans, slope runs/rises, thickness, ridge-to-wall runs and wall height must exceed
`64 × 32 × 2⁻²³ × scale`. Keep geometry near its local origin and use ECS transforms
for world placement. This input guard is not a guarantee of Float32 accuracy
throughout the whole admitted domain; inspect actual constructed geometry for
unusual magnitudes or proportions.

The retained geometry study checks symmetric/asymmetric roofs, independent span
and rise edits, small/steep cases and translated coordinates. Its independent
oracle checks emitted wall/roof planes, exact oriented closure and analytic
volumes, including actual Float32 triangles. Missing fascia, reversed underside,
lowered/stale walls and incorrect thickness/frame mutants must fail. Final
visual quality still requires side and three-quarter inspection with the
intended materials, tiles, caps and lighting.
