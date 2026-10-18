# Agent workflow for low-poly scenes

Use this sequence for fitted props, dioramas and shader-driven scenes. The goal
is a useful first image quickly, followed by deliberate visual refinement.

Start with `aperture create my-scene --template diorama`. It supplies browser and
headless configs, an orthographic camera, lit blockout masses, real reflections,
a compiled procedural water shader, and a linear palette helper. Replace the
blockout content in `src/systems/scene.system.ts` instead of rebuilding boilerplate.
Read its `DIORAMA.md`; inspect a first image as soon as the principal masses exist.
The starter contains no finished reference-specific models.

## 1. Measure the reference before detailing

Write down the hero object's width/height/length ratios, its image-space bounds,
the horizon/camera elevation, and the masses occupying each quadrant. A tall
building on a tiny island cannot be corrected by adding crates or roof tiles.
Block out only the ground, main structures and hero silhouette first. Inspect
that first image before spending time on trim. Keep the whole scene in frame.
Use image-space ratios: roof width/building height, vehicle length/building width,
tree crown/building width, water/ground area, and the distances between landmarks.
Write down the three largest mismatches after each image and correct those first.

Make that comparison numeric before a second detailing pass. For each principal
mass, record its left/top/right/bottom image coordinates divided by image width
and height. Compare the rendered and reference rectangles, plus the centers and
gaps between neighboring objects. These are projected measurements, not inferred
world dimensions. If several objects have the same directional error, check the
camera first; if one object is too tall or narrow, change that assembly. For an
arched structure, measure the opening width/height, the wall above its crown and
the visible side-wall width separately. Extra trim cannot correct those ratios.

Keep each principal assembly in local coordinates under an ECS transform group,
so proportion and placement corrections move its fitted parts together:

```ts
const structure = this.spawn.group({
  key: "structure",
  transform: { translation: [2, 0, -1], scale: [1, 1, 1] },
});
this.spawn.mesh({
  key: "structure.wall",
  mesh: mesh.box({ size: [2, 3, 0.25] }),
  material: material.standard({ baseColor: [0.6, 0.4, 0.2, 1] }),
  transform: { parent: structure, translation: [0, 1.5, 0] },
  castShadow: true,
  receiveShadow: true,
});
```

This is ECS parent/transform data, not a second renderer-owned scene. Nonuniform
group scaling is useful for blockout corrections; regenerate final curved trim
or tiles from the corrected dimensions when their thickness must stay constant.

For a pitched roof, compare the viewing elevation to the roof pitch. A camera
above a shallow roof shows its reverse slope, even when the reference only shows
the front. Compute the approximate view elevation as atan2(cameraY-targetY,
hypot(cameraX-targetX,cameraZ-targetZ)), then check the projected roof in the actual
camera. Adjust camera and large masses before adding repeated tiles. Match tile
relief to course width; half-cylinder tiles often protrude too far for a small
roof. Inspect their silhouette, not just their count.

For a boat or vehicle, inspect a side view as well as the final three-quarter
view. Give the lower sections independent length and width: using almost the
same perimeter at every height creates a vertical bow and slab-like sides.
Use a small number of purposeful facets; extra triangles do not fix proportions.

## 2. Use fitted surfaces and corresponding sections

`mesh.polygons({ faces })` supplies planar faces, concave outlines and holes.
Use the same corner arrays for a window hole and its glazing. Pillars/sills are
the remaining surface, not additional boxes placed on top of a solid cabin.
See [fitted surfaces](POLYGON_SURFACE_AUTHORING.md).

`mesh.loft({ sections, closed, flipWinding })` joins corresponding 3D corners in
successive sections. Change each section's width, length, height and offset
independently. It supports closed perimeters and open strips; end caps are
separate `mesh.polygons()` faces. Bent connecting quads split into triangles.
It returns the ordinary portable triangle-list descriptor and generates flat
normals through the existing mesh validator. There are no hidden mesh assets.

```ts
const lower = [
  [-1, 0, -0.8],
  [1, 0, -0.8],
  [1, 0, 0.8],
  [-1, 0, 0.8],
] as const;
const upper = [
  [-0.7, 1, -0.6],
  [0.7, 1, -0.6],
  [0.7, 1, 0.6],
  [-0.7, 1, 0.6],
] as const;
const shell = mesh.loft({ sections: [lower, upper] });
```

Corners must correspond and retain the same order. Each cell emits triangles
`[start[i], end[i], end[j]]` and `[start[i], end[j], start[j]]`; use
`flipWinding: true` for the opposite facing. Inspect visible outward normals;
do not hide reversed geometry with two-sided materials. Never repeat a closing
corner or collapse a whole section to one point. Use explicit triangle fans for
a pointed tip. Each of 2–256 sections has 3–256 corners (2 minimum for open strips).

`mesh.tube({ path, radius, radialSegments: 6 })` builds one connected rope,
branch, cable or pipe. It joins shared cross-section rings along an open polyline;
`radius` may be a scalar or one value per path point. End caps default to enabled.
Use a sufficiently sampled curve and keep the radius small relative to the bends.
It rejects repeated points and reversing corners; it does not resolve arbitrary
self-intersections. This avoids the easily misordered Euler rotations of separate
cylinders. Two points and two radii also make a tapered branch with exact endpoints.

`mesh.extrudeBetween({ outline, holes, start, end, up })` extrudes a closed 2D
profile between exact 3D endpoints. The profile's +Y follows the projected `up`
vector (default world +Y, or +Z on a vertical path); +Z runs from start to end.
An explicit `up` must not be parallel to that path. Concave outlines and holes
retain their boundaries. Use it for angled beams, gutter sections and roof tiles.
See [connected architectural parts](CONNECTED_PARTS.md) for runnable profile
recipes and the shared-boundary checks that prevent arch fragments and roof gaps.

The [section-and-reflection example](../examples/planar-reflections/README.md)
uses this API for both a full-bellied skiff and an arched canopy. Adapt its geometry
principles to the reference rather than copying its proportions unchanged.

A rim may rise toward a bow while the interior floor stays level. Do not pass
the raised rim to a single planar floor polygon: build that floor at a constant
local Y and join the rim with loft strips. Preflight errors retain their authored
stack, so locate the failing call site rather than searching every `faces[0]`.

For architecture, use actual thickness and overlap where they affect silhouette.
`mesh.beveledBox({ size: [1, .4, .6], bevel: .04 })` supplies a single closed
solid with flat chamfers, useful for masonry, roof pieces and compact props. Its
24 shared input corners form fitted main faces, edge strips and corner faces;
the renderer receives ordinary triangle geometry. Keep bevel below half the
smallest dimension, and small enough to preserve the intended silhouette. It is
a box helper; use polygons with openings or lofts for fitted vehicle bodies.
A barrel roof tile can be an extruded crescent in XY, extending along local Z;
repeat short courses with slight overlap down a shared roof slope. Long unbroken
strips read as corrugated sheets. Derive the tile transform from the roof's slope
and endpoints, and clip the final course at hips instead of leaving bare patches.
Keep tile radius small relative to the building: oversized tubes dominate a roof.
The [fitted roof recipe](../examples/planar-reflections/ROOF.md) supplies seeded
material batches with raised course lips, tapered tails and closed cuts at hip
boundaries. Use it when repeated tile geometry would otherwise require manual
overlap and clipping calculations; supply your own roof planes and proportions.

`mesh.icosphere({ radius: 1, subdivisions: 1 })` supplies a closed, outward-facing
faceted sphere without hand-written icosahedron vertices. Subdivisions 0, 1 and 2
produce 20, 80 and 320 triangles; the supported range is 0–4 and the default is 1.
Use nonuniform entity scale and rotation for foliage or rocks. It generates flat
face normals; use `mesh.sphere()` when a smooth latitude/longitude sphere is wanted.

Match foliage construction to the reference's visible granularity. A chunky
stylized crown can use 5–9 overlapping asymmetric faceted masses on a branching
trunk. A leafy olive or willow needs thin leaflet clusters and visible air gaps;
large separated balls will change its species and style. Start with the overall
crown width/height and branching silhouette, then set leaflet size and density.
The [foliage study](../examples/planar-reflections/FOLIAGE.md) provides a seeded,
batched closed-leaflet generator with independently adjustable dimensions. Its
`branchFoliageBatches` alternative attaches pairs along caller-authored branch
paths, with branch-relative orientation, gaps and thinning. Use it for visible
spreading shoots; ellipsoid scattering suits denser crowns. Match the branch
silhouette before leaf count, and inspect the distribution at final resolution.

Closed geometry still needs outward winding. For each convex leaflet, verify
normal dot (face centroid minus interior point) is positive. Reversed triangles
can expose the inner side and distort shading even when every edge is paired.
Keep the same camera, light and palette when checking a foliage change. Do not
compensate for wrong normals or oversized leaves by changing the whole scene's
exposure. Inspect against the reference at the final image size; a dense pale
cloud of leaves and disconnected crown balls are different failure modes.

Use a side profile to check a vehicle's hood, windshield rake and cabin height.
Round or chamfer only the intended edges; a large diagonal front face changes
the whole vehicle into a wedge. For wheels, do not put a hub's face in the same
plane as a capped tire. The [connected-parts recipe](CONNECTED_PARTS.md) keeps
the annular tire, rim and hub surfaces distinct. For floating hulls, let the lower
shell cross the water plane; a hull wholly above it cannot acquire a believable
waterline merely by enabling reflections.

Common contracts: positions are `[x,y,z]` tuples, not a flattened scalar array;
`mesh.plane({ size: [width,height] })` lies in XY, so rotate `[-90,0,0]` for
horizontal +Y water; cylinders and lathe profiles use Y; `mesh.torus()` is Y-up.
Put assemblies under `spawn.group()` and work in local coordinates. Convert
display sRGB hex palettes to linear values before passing `baseColor`.

## 3. Get depth from lighting, then add surface effects

Keep the default environment, ACES, 4x MSAA and a shadow-casting directional sun.
Use `render.defaultEnvironmentIntensity` to control the default image-based fill
independently of the sky (default 1; start around 0.3–0.4 for a sunny diorama). Authored
environment lights use their own `light.intensity` and linear `light.color`.
Keep ambient fill below the key-light contribution. Give shadows a receiver and
inspect light/dark planes before increasing exposure or bloom. A small SSAO radius
and moderate intensity can ground props; exaggerated AO creates graphic edges.
See [visual quality](VISUAL_QUALITY.md). Compare the same geometry when diagnosing
a lighting problem so a different silhouette does not confound the comparison.
For a sunny diorama start with a relatively high sun (roughly 55–65 degrees),
shadow strength around 0.85, and PCSS (`shadowType: 2`) with a modest filter radius.
Check the projected shadow's length in the actual camera. A high filter radius
cannot rescue a giant low-angle shadow covering half the composition. Keep enough
fill to read shaded plaster, under-eave details and the interior of fitted openings.

For single-map directional PCSS, `filterRadius` is capped at 16 shadow texels.
Increasing it beyond 16 does not soften the image further. Its world-space extent
also depends on shadow-map resolution and the shadow camera's orthographic span.
Compare a lower map resolution at the same camera before increasing span, which
can waste coverage and clip casters. Inspect contact detail and distant penumbra
in the actual image; lowering resolution trades shadow detail for wider filtering.

Use `material.standard({ extension: ... })` for WGSL tint/normal/deformation hooks
while retaining lighting and engine passes. Import compiled JSON portably:

```ts
import waterShader from "../water.shader.json" with { type: "json" };
```

For actual reflections on horizontal water, configure the renderer:

```ts
render: {
  cadence: 'demand', tonemap: 'aces', exposure: 1, sampleCount: 4,
  planarReflection: {
    height: 0, strength: .24, resolutionScale: .65,
    distortion: .002, distortionFrequency: 4, blurPixels: 1, tint: [.28, .75, .78],
  },
}
```

Use `camera: { frustumCulling: false }` so objects outside the main camera remain
available to its reflected view. The renderer also includes extracted shadow
casters, but that does not cover every non-shadow-casting offscreen object.
Keep the receiver itself at `height`, with `clipBias` above its surface. Default
`surfaceTolerance: .02` matches receiver pixels in world units. Avoid moving the
water vertices beyond that tolerance; use normal perturbation for small ripples.
An unusually thick/raised water surface needs an explicit matching height.

This renders real reflected mesh geometry through a mirrored camera and clips
below the plane. Depth masks composition to visible surfaces at that plane, before
tone mapping. It supports one full-output perspective or orthographic camera and
one horizontal plane; all coplanar surfaces are reflective. UI, particles and
sprites are not reflected. This is a focused scene-reflection feature, not a
general arbitrary material texture binding API. It has a real additional scene
render cost. Start at half resolution, subtle strength, and restrained distortion.
Browser and portable Dawn bundles retain the same options.

`tint` is a linear RGB multiplier on reflected radiance; white `[1,1,1]` is the
default. Use a restrained teal tint for stylized water when neutral reflections
wash out its color. This is independent of the WGSL water base color, because
reflections are composed afterward. Preserve recognizable reflected forms; high
strength or distortion can turn them into broad pale streaks. Tint is an artistic
control, not a physical water-absorption simulation.

`distortionFrequency` sets the world-space ripple frequency multiplier (default
1, range 0.1–32), independently of the UV displacement amplitude `distortion`.
Use a larger frequency for shorter ripples when large warped reflection patches
look like glass. Values around 3–6 are a useful starting range for small dioramas;
inspect at the output resolution and reduce amplitude if edges become jagged.
Frequency has no effect at zero distortion. This is an artistic two-sine UV
perturbation, not a water simulation.

## 4. Make CPU preflight the normal preview path

Keep `aperture.headless.config.ts` as a thin wrapper around the browser config:

```ts
import config from "./aperture.config.ts";
export default { ...config, mode: "headless" as const };
```

Then run:

```sh
aperture headless aperture.headless.config.ts --out scene.bundle.json --asset-mode strict --render-width 1200 --render-height 900
aperture render scene.bundle.json --backend dawn --adapter software --out scene.png --json
```

Only render if extraction succeeds. Read the image, fix the largest shape or
composition mismatch, then repeat. Use a warm render/MCP session for repeated
portable frames (`aperture render serve --backend dawn --adapter software`).
Retain failed attempts and timing phases when benchmarking. Browser compatibility
verification is a separate final check; in this cloud environment it uses the
[verified browser route](CLOUD_LOCAL_RENDERING.md).

Before final delivery, inspect front/side/three-quarter views, detached surfaces,
missing shadow diagnostics, shader/compiler errors and reflection alignment. A
successful PNG alone does not establish visual correctness.

Keep each refinement focused on the largest visible mismatch. Once silhouettes,
contacts and lighting read well, stop adding optional detail. Repeated foliage
changes or a new plaster shader can consume minutes while leaving proportions
unchanged. Reserve the last preview for corrections already identified in the
previous image; avoid introducing a new wheel, roof or foliage construction in
that final pass without time to inspect and repair it.
