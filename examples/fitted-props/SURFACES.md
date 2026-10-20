# Shared openings, recesses and caps

Copy [panels.ts](src/panels.ts) beside your scene and import the helpers you need.
They return ordinary polygon faces; dimensions, materials and ECS entities remain
yours. Use the same operation for a window, recessed display or lower pool.

## A recessed window

`insetSurface(outline, opening, depth, label?)` returns `surround`, `reveals`
and `inset`. The outline's winding defines outward. Positive depth moves the
inset inward along that normal. The mouth is a real hole in the surround;
the reveals join it to the inset's shared boundary. No backing face remains
at the mouth.

```ts
import { mesh } from "@aperture-engine/app/systems";
import { insetSurface, windowPanel, type Point } from "./panels.ts";

// A sloped front panel, facing generally +Z. All corners share a plane.
const front: Point[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0.8, 1.2, -0.2],
  [-0.8, 1.2, -0.2],
];
const opening = windowPanel(front, [0.12, 0.15, 0.88, 0.86]).pane.outline;
const window = insetSurface(front, opening, 0.04, "front window");
const body = mesh.polygons({ faces: [window.surround] });
const trim = mesh.polygons({ faces: window.reveals });
const glass = mesh.polygons({ faces: [window.inset] });
// Spawn these with chosen materials under the same ECS parent.
```

For a distinct frame band, author an outer frame loop and a smaller pane loop
in the panel plane. Cut the outer frame loop out of the body, then call
`insetSurface(frameLoop, paneLoop, depth)`. Its surround becomes the frame band.
Use those same arrays in the neighboring faces. An opening can have chamfered
corners; it need not have the outer outline's corner count.

The helper checks finite points, positive depth and a shared plane. The public
polygon builder performs full simple-boundary, containment and intersection
checks during strict extraction. Keep the surround as **one face with a hole**.
A valid array of unrelated triangles does not establish a valid opening or
nonoverlapping surface. The helper does not repair crossing boundaries, inset
curved surfaces, round corners or choose a useful depth for you.

## A flat ground surface with a lower pool

These XZ boundaries face +Y, so the pool moves down. Keep both boundaries
coplanar at bank height. Strict extraction rejects a shore that crosses or
touches the outside boundary.

```ts
const outside: Point[] = [
  [-3, 0.3, 2],
  [3, 0.3, 2],
  [3, 0.3, -2],
  [1, 0.3, -2],
  [1, 0.3, -1],
  [-3, 0.3, -1],
];
const shore: Point[] = [
  [-1, 0.3, 1],
  [1.5, 0.3, 1],
  [1.2, 0.3, 0],
  [-0.8, 0.3, -0.5],
];
const pool = insetSurface(outside, shore, 0.08, "courtyard pool");
const ground = mesh.polygons({ faces: [pool.surround] });
const banks = mesh.polygons({ faces: pool.reveals });
const water = mesh.polygons({ faces: [pool.inset] });
// Water is at Y=0.22: set render.planarReflection.height to that height.
```

Add outside walls separately. For the +Y-wound `outside` above, create a lower
corresponding loop with the same corner order and call
`bridgeProfiles(lower, outside, true)` so the walls face outward. This bridge
follows one boundary; the ground top uses polygon-hole triangulation between
different boundaries. Pairing an
outer loop with an offset shore by angle/index can fold even when both loops
look reasonable in isolation. Calling `facing()` on each folded triangle hides
its reversed orientation without removing the overlap.

This recipe gives a planar top and banks, not arbitrary uneven terrain.
Use a separate [surface-color extension](../planar-reflections/SURFACES.md)
for restrained variation, or author deliberate additional geometry with valid
shared boundaries. Do not jitter the top's boundary heights and keep calling it
a planar face. For a river reaching the edge, author the bank as part of the
outside outline; an internal hole must remain strictly contained.

## Explicit bent end caps

`triangleFan(profile, center, outward, closed?, label?)` connects each adjacent
profile pair to a caller-owned center. The default open chain omits the
last-to-first edge. This matters when the center lies on the closing edge:

```ts
import { triangleFan } from "./panels.ts";

const arch: Point[] = [
  [-1, 0, 0],
  [-0.8, 0.6, -0.1],
  [-0.4, 0.9, -0.2],
  [0.4, 0.9, -0.2],
  [0.8, 0.6, -0.1],
  [1, 0, 0],
];
const cap = mesh.polygons({
  faces: triangleFan(arch, [0, 0, 0], [0, 0, 1], false, "arched end"),
});
```

These noncoplanar profile points produce five planar triangles. Passing the
whole bent boundary as one polygon is invalid; `facing()` changes only winding.
Set `closed` to true only when the last-to-first triangle is intended and
nondegenerate. The helper rejects degenerate, edge-on or mixed-direction
triangles and overlapping angular sweeps about the center, and can reverse a
consistent fan as a whole. Choose a center from which the projected boundary is
star-shaped; otherwise split the cap into deliberately authored faces. This is
not a general triangulator for arbitrary concave/nonplanar outlines.

Run strict CPU extraction before spending a render. The
[geometry checks](../../test/mesh/inset-surface.test.ts) inspect emitted float32
triangles, shared edges, rays through the opening, edited/sloped construction,
invalid shore containment and explicit cap failure cases.
