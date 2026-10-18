# Connected architectural parts

Use shared boundaries and explicit endpoints for adjacent parts. A successful
triangulation validates each mesh; it cannot know whether separately authored
meshes overlap or leave unwanted gaps. Inspect the assembled silhouette as well.

## Ropes, branches and pipes

```ts
const rope = mesh.tube({
  path: [
    [0, 1, 0],
    [0.4, 0.7, 0.3],
    [0.8, 0.65, 0.6],
    [1.2, 0.9, 0.9],
  ],
  radius: 0.025,
  radialSegments: 6,
});
const branch = mesh.tube({
  path: [
    [0, 0, 0],
    [0.15, 1.1, 0.1],
    [0.6, 2, 0.25],
  ],
  radius: [0.2, 0.15, 0.06],
  radialSegments: 7,
});
```

Each bend has one shared ring, with transported orientation. Flat normals retain
the deliberate polygonal appearance. Caps close both ends by default. The path
is open (2–512 points), with 3–64 sides. A large radius at a tight bend can still
self-intersect; this is a surface constructor, not a boolean union operation.
Do not apply extra midpoint/rotation transforms to endpoint-authored geometry.

## Short barrel tiles

Build a crescent cross-section once. Extrude it from a point down the roof slope
to another point on that same slope; world +Y or the roof normal controls its roll.

```ts
const radius = 0.12,
  thickness = 0.025,
  segments = 6;
const arc = (r: number): [number, number][] =>
  Array.from({ length: segments + 1 }, (_, i) => {
    const a = (i * Math.PI) / segments;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
const outline = [...arc(radius), ...arc(radius - thickness).reverse()];
const tile = mesh.extrudeBetween({
  outline,
  start: [0, 2.4, 0],
  end: [0, 2.15, 0.5],
  up: [0, 1, 0],
});
```

Repeat short courses with a **real raised downhill lip** and an uphill tail that
fits below the next course. Splitting one extrusion into overlapping coplanar
pieces preserves a continuous rib and can produce dark seams. Color variation
cannot make those coplanar pieces read as individual tiles. All tile centerlines
on a roof face must remain parallel down its slope. Fanning every tile toward
the peak produces crossing strips and a ribbed silhouette.

For a reusable public-facade recipe, see
[`roofFaceTileBatches` and `roofCapTileBatches`](../examples/planar-reflections/ROOF.md)
and their [typed implementation](../examples/planar-reflections/src/roof.ts).
Supply a roof basis, convex boundary, tile dimensions and seed; spawn the
returned material batches as ECS meshes. The recipe tapers each tile toward
its uphill tail and decreases its normal lift from lip to tail. With
`pitch = length - overlap`, adjacent courses have a base separation of
`lipRise * pitch / length`; keep that greater than shell thickness. The height
resets for each tile, so the roof does not grow an accumulating staircase.

For a simple centerline fit on a triangular hip face parameterized by height fraction `t`, its half-width
is `span * (1 - t)`. A tile centered at horizontal `offset` fits only while
`t <= 1 - (abs(offset) + radius) / span`. Shorten its uphill endpoint to that
limit, omit cells with no positive length, and cover the hip with fitted caps.
This conservative endpoint fit can leave a wide strip beside the hip. The
recipe instead clips every tile surface to the actual slanted face boundary
and closes the cut. Fit a wider cap sequence along the shared hip endpoints,
with an explicit outward offset and a terminal piece at the apex. Keep a
continuous roof bed below the shells, and inspect cap clearance from both sides.
Do not shrink every centerline toward the apex. Inspect the eave and back edge
in a side view; hidden overlong pieces often become pale protrusions in the hero view.

## An arch with a single shared inner curve

```ts
const n = 12,
  r = 1,
  spring = 1.8,
  thickness = 0.3,
  wallTop = 3.4;
const inner: [number, number][] = Array.from({ length: n + 1 }, (_, i) => {
  const a = Math.PI - (i * Math.PI) / n;
  return [Math.cos(a) * r, spring + Math.sin(a) * r];
});
const outer = inner.map(([x, y]): [number, number] => [
  (x * (r + thickness)) / r,
  spring + ((y - spring) * (r + thickness)) / r,
]);
const wall = mesh.extrude({
  outline: [
    [-1.6, 0],
    [-r, 0],
    ...inner,
    [r, 0],
    [1.6, 0],
    [1.6, wallTop],
    [-1.6, wallTop],
  ],
  depth: 0.35,
});
const stones = Array.from({ length: n }, (_, i) =>
  mesh.extrude({
    outline: [inner[i]!, inner[i + 1]!, outer[i + 1]!, outer[i]!],
    depth: 0.18,
  }),
);
```

Place the stones with their back at the wall's front plane, plus a tiny intentional
overlap. Both surfaces use the exact same inner vertices. Sampling the opening
with 14 segments and its trim with 11 creates different chords, even when both
use the same radius; wall fragments can protrude into the opening. Use the same
principle for glazing holes and glass, wheel openings and rims, and pool walls
and coping. Give the recess actual depth and keep floors separate from raised rims.

Also check depth: thick jamb blocks must not extend deep into the wall while
duplicating its interior opening faces. Those coplanar surfaces fight in the depth
buffer and appear as small pale/dark triangular fragments. Position a decorative
trim layer in front of the wall (`trimBack = wallFront`), or cut the wall back to
give the structural stones sole ownership of the opening's interior surface.
Changing AO, shadow bias or curve resolution cannot fix duplicate surfaces.

## Nested wheels and caps

A tire with an axis-to-axis lathe profile is a capped solid. A rim or hub whose
end lies on that cap duplicates its surface; different segment counts then make
the visible overlap resemble a star. Use an annular tire profile and separate
axial surfaces instead. These dimensions are a local modeling recipe, not a
vehicle asset:

```ts
const tire = mesh.lathe({
  profile: [
    [0.24, -0.11],
    [0.34, -0.11],
    [0.41, -0.06],
    [0.41, 0.06],
    [0.34, 0.11],
    [0.24, 0.11],
    [0.24, -0.11],
  ],
  radialSegments: 14,
});
const rim = mesh.cylinder({ radius: 0.245, depth: 0.24, segments: 14 });
const hub = mesh.cylinder({ radius: 0.13, depth: 0.27, segments: 14 });
```

The tire faces end at local Y ±.11, the rim at ±.12 and the hub at ±.135. The
surfaces therefore have explicit depth and no coincident cap plane. Rotate the
whole wheel assembly together; retain these relationships when scaling it.

Before the final capture, inspect the main structures for detached pieces, gaps,
uneven courses and coplanar surfaces. Prioritize those corrections over small props.

## Faceted organic masses

Use `mesh.icosphere({ radius: 1, subdivisions: 1 })` for a closed 80-triangle
crown or rock, then vary its entity scale and rotation. The helper shares
midpoint vertices across neighboring faces, so subdivisions retain a closed
boundary. Subdivisions 0–4 produce 20–5120 triangles; keep 0–2 for small diorama
props. This avoids rebuilding a geodesic sphere in every authored scene.
