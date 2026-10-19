# Fitted props from profiles and panels

Use the [worked public example](../examples/fitted-props/README.md) when a prop
needs rounded shoulders, independently tapered sections, fitted windows or
recessed wheel clearance. The example-local [panel helpers](../examples/fitted-props/src/panels.ts)
return ordinary `mesh.polygons()` faces. Copy them with your own profiles; the
engine needs no vehicle primitive or renderer-side object graph.

```ts
import { mesh } from "@aperture-engine/app/systems";
import { bridgeProfiles, windowPanel } from "./panels.ts";

// Two matching open chains: right base → shoulder → crown → left base.
// X is width, Y is height, Z runs from rear to front.
const rear = [
  [0.6, 0, -0.5],
  [0.6, 0.7, -0.5],
  [-0.6, 0.7, -0.5],
  [-0.6, 0, -0.5],
] as const;
const front = [
  [0.5, 0, 0.5],
  [0.5, 0.4, 0.5],
  [-0.5, 0.4, 0.5],
  [-0.5, 0, 0.5],
] as const;
const panels = bridgeProfiles(rear, front);
const display = windowPanel(panels[1]!.outline);
panels[1] = display.surround;
const shell = mesh.polygons({ faces: panels });
const glass = mesh.polygons({ faces: [display.pane] });
// Spawn shell and glass as children of one ECS spawn.group(). Add end/base
// faces if this is a closed housing. This snippet intentionally leaves them open.
```

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

For the first useful blockout, author only sections, end faces, the belt/deck and
glass. Inspect front, side and rear. Changing paint or adding mirrors cannot fix
the silhouette. The worked [instrument housing](../examples/fitted-props/src/housing.ts)
is a short independent use of these operations with a sloped display.

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
