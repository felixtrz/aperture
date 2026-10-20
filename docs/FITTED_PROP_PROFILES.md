# Fitted props from profiles and panels

After a useful blockout, use the [runnable shape sheet](../examples/fitted-props/SHAPES.md)
to refine shoulders, taper and a sloped top. Its vehicle study and instrument
housing use the same short recipe and caller-owned measurements. The existing
[worked utility vehicle](../examples/fitted-props/README.md) adds recessed wheel
clearance. Both return ordinary `mesh.polygons()` faces; they need no vehicle
primitive or renderer-side object graph.

```ts
import { mesh } from "@aperture-engine/app/systems";
import { profileShell } from "./profile-shell.ts";

// X is width, Y height, Z rear to front. Copy profile-shell.ts and panels.ts.
const parts = profileShell({
  baseY: 0,
  sideSlope: 0.1,
  sections: [
    {
      z: -0.5,
      halfWidth: 0.7,
      shoulderY: 0.8,
      crownY: 0.95,
      crownHalfWidth: 0.5,
    },
    {
      z: 0.6,
      halfWidth: 0.6,
      shoulderY: 0.35,
      crownY: 0.5,
      crownHalfWidth: 0.4,
    },
  ],
  windows: [{ section: 0, band: "top" }],
});
const shellTop = mesh.polygons(parts.top);
const glass = mesh.polygons(parts.glazing);
// Spawn every nonempty part under one ECS group; choose a material per role.
// sides + shoulders + top + base + ends + glazing form one closed boundary.
```

The example-local [profile helper](../examples/fitted-props/src/profile-shell.ts)
creates six corresponding corners per section: right belt, right shoulder,
right crown, left crown, left shoulder, left belt. `baseY` is the belt height.
`sideSlope` is inward width per unit of height. Shoulder height, crown height,
crown width, belt width and longitudinal position remain separate inputs. This
produces a real shoulder bevel; a four-corner trapezoid cannot supply that band.
A shared side slope keeps glazing planar as section width/height change.

Window `section` selects the interval to the next section. Its `band` is
`"right"`, `"left"` or `"top"`; one window is allowed per cell. Optional
`bounds: [u0, v0, u1, v1]` uses the panel coordinates described below. The helper
returns `sides`, `shoulders`, `top`, `base`, `ends` and `glazing` descriptors.
These roles partition the same boundary, so different colors do not need
overlapping solids. It caps the two ends and base; it does not cut wheel wells,
add thickness to an open vessel, infer proportions or repair intersections.

For arbitrary profiles, copy the lower-level [panel helpers](../examples/fitted-props/src/panels.ts):

`bridgeProfiles(a, b, closed?)` joins corresponding corners with flat faces.
Keep the same semantic corner order in every section. Open chains produce a
strip; closed loops also join their last corner to their first. Caps remain your
choice. Bent quads become two explicit triangles. The helper preserves input
positions and never resamples the profiles, repairs intersections or merges
overlapping solids. `facing(outline, outwardDirection)` controls winding when a
surface's intended visible side is known.

`windowPanel(quad, [u0, v0, u1, v1]?, label?)` partitions one **strictly convex,
planar** quad. Concave, self-crossed and collinear boundaries are rejected.
Bounds are fractions along its two directions, strictly inside the panel. Its
surround hole and its pane share the very same corner array, including winding.
The remaining surface is the sill, pillars and rail. There is no face behind the
glass. A warped panel fails with the supplied section/cell label; put a section at
the bend or author individual planar panes. Do not turn on double-sided rendering
to conceal reversed faces. For recessed glass, add a reveal strip before its pane.

The [shared-surface recipe](../examples/fitted-props/SURFACES.md) supplies
`insetSurface(outline, opening, depth)` for those reveals and the recessed pane,
using the same boundaries. It also works for a planar ground face and lower pool.
For a bent end cap, `triangleFan(profile, center, outward, closed?)` emits
explicit planar triangles; an open chain can omit a degenerate closing edge.
Both keep measurements caller-owned and preserve strict polygon validation.

After the first useful blockout, compare overall image bounds plus internal
ratios: belt-to-roof height, forepart/cabin/rear lengths, wheel diameter/body
length, and visible front width. Inspect front, side and rear before detailing.
The shape sheet keeps the same outer bounds while changing these internal
shapes, and includes a [measurement worksheet](../examples/fitted-props/SHAPES.md#measure-before-detailing).
Changing paint or adding mirrors cannot fix the silhouette. The original
[instrument housing](../examples/fitted-props/src/housing.ts) remains a short
direct use of the panel operations with a sloped display.

## A body with wheel clearance

The [utility vehicle source](../examples/fitted-props/src/vehicle.ts) is an
editable construction recipe. Its dimensions are example inputs. Choose axle
positions, base height, cavity depth, cabin sections and hood length for your prop.

1. Cut a sampled arch into the **side boundary**. Keep the bottom of the arch
   open; an internal polygon hole cannot touch its surrounding face boundary.
2. Sample the lip and inner opening with the same angles and number of corners.
   Bridge the side cutout to the lip. This strip owns the painted arch surround;
   no complete side panel remains underneath it.
3. Bridge the lip to an inner copy of the opening. These faces form a real wheel
   cavity: their normals point toward its empty space. Add its recessed back
   wall. Shape the underside around the cavity's lower edges, leaving its mouth
   open to the exterior. A closed **material shell** can still have these concave
   recesses; closedness must not mean filling the mouth in front of the tire.
4. Leave both radial and axial clearance. Compare the tire against the opening's
   polygon chords, not just its nominal circle radius. In this example the
   smallest arch radius is `openingRadius * cos(π / (2 * archSegments))`.
5. Use a separate belt/deck boundary with the cabin footprint removed. The cabin
   fits that opening. There is no lower solid or roof slab intersecting it.

The cabin's sections have independent width, height and longitudinal positions.
Each section distinguishes belt, shoulder and crown. A fixed side slope keeps a
side panel planar while width and height change between sections; a separate
bevel rounds the roof. The final cabin section ends before the nose, reserving a
substantial hood. For arbitrary freeform profiles, `bridgeProfiles` can triangulate
the bends, but broad glazing still needs deliberately planar panels.

Wheels, mirrors and lamps are separate physical parts. The tire uses an annular
lathe profile, with rim and hub ends at distinct depths. The vehicle body is one
shared boundary partitioned into materials, not overlapping lower-body and cabin
primitives. All scene state lives in ECS entities, and all geometry/materials
survive portable bundle extraction.

The [geometry tests](../test/mesh/fitted-props.test.ts) check geometric edge
incidence, winding, nondegenerate triangles and unit normals for the intended
closed shell. Rays through all four tire spaces hit the recessed back walls,
proving that an uncut body face does not obstruct them. Other checks cover exact
window ownership, taper, the hood and nonplanar-panel diagnostics. These checks
complement close views; they do not establish a match to an arbitrary reference.
