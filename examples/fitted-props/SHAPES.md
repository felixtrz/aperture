# A profile shape sheet

Use this after the first useful blockout. A simple delivery vehicle and a sloped
instrument housing share the same [profile recipe](src/profile-shell.ts).
[shape-sheet.ts](src/shape-sheet.ts) owns every section, wheel dimension,
material and ECS entity. It contains no fuel-stop scene or finished pickup.
The default fitted-props example is unchanged; this study is opt-in.

## Edit the shape, then inspect it

`profileShell(shape)` returns six surface roles: sides, shoulders, top, base,
ends and glazing. Spawn each nonempty descriptor with `mesh.polygons()` and its
own standard material beneath one `spawn.group()`. The shell's surface has one
owner at every material boundary, including window holes and their infills.

Each section has independent `z`, `halfWidth`, `shoulderY`, `crownY` and
`crownHalfWidth`. A common `baseY` defines the belt; `sideSlope` determines inward
side slope per unit of height. The six corners are:

```text
             left crown ───── right crown
            /                             \
   left shoulder                       right shoulder
         /                                 \
   left belt ───────────────────────── right belt
```

Corners are ordered right belt → right shoulder → right crown → left crown →
left shoulder → left belt. Increasing Z goes from rear to front. The recipe
joins matching corners, closes the base and end caps, and partitions selected
side/top cells into a surround and an exact pane. Shoulders can triangulate
where their sections bend; panes must stay planar. Invalid/collapsed sections
fail with a section label. This helper models a solid shell surface, not a hollow
container with wall thickness. Use the original vehicle recipe for wheel-well
recesses and an authored interior boundary for an open vessel.

The vehicle study reserves a lowered, sloping forepart in front of its cabin.
The housing uses the same operation for an inclined display. The vehicle's
wheels sit below the body with real clearance; its separate chassis and axles
connect them. This is deliberately a proportion study, without trim that could
distract from an incorrect outline.

`studyShape("vehicle", "boxy")` and `studyShape("vehicle", "shaped")` have the
same overall length, width and height. The same is true for the housing. The
boxy variant uses nearly square shoulders and a constant-height top; the shaped
variant changes each section. Both retain fitted windows, identical wheels,
materials and camera settings. Bounding rectangles alone cannot distinguish a
good shape from a box occupying the same space.

Each `studyShape()` call returns independent sections, window selections and
bounds. Editing a returned study does not alter the defaults or later controls.

Change the data in `shapeStudies`, not a renderer-owned object. Changing the
upper sections need not move the wheels. Keep their dimensions together when
changing the body length or width; scaling the whole assembly nonuniformly also
stretches its wheels and bevel thickness.

## Run the study

From the repository root, after building the packages, copy the example to a
scratch app so the existing demonstration remains available:

```sh
mkdir -p tmp
cp -R examples/fitted-props tmp/profile-shape-sheet
```

In the copy's `aperture.config.ts`, replace `systems` with:

```ts
systems: ["src/shape-sheet.ts"],
```

Its browser config already supplies ACES, daylight fill, 4× MSAA, subtle bloom
and AO; the scene supplies a sun and shadow receiver. The headless wrapper uses
the same scene/config. Use the existing binaries without installing anything:

```sh
node packages/cli/dist/bin/aperture.js headless \
  tmp/profile-shape-sheet/aperture.headless.config.ts \
  --out /tmp/profile-shape-sheet.bundle.json \
  --render-width 1200 --render-height 900 --asset-mode strict

node packages/cli/dist/bin/aperture.js render /tmp/profile-shape-sheet.bundle.json \
  --backend dawn --out /tmp/profile-shape-sheet.png

node node_modules/vite/bin/vite.js build tmp/profile-shape-sheet \
  --config tmp/profile-shape-sheet/vite.config.ts
```

Dawn requires a provisioned adapter; follow [the Dawn runbook](../../docs/DAWN_NODE_RENDERING.md).
Cloud browser captures must use the approved `render:cloud` / `runVerifiedScene`
route in [the cloud runbook](../../docs/CLOUD_LOCAL_RENDERING.md).

For isolated controls, change only the final line of the copied
`src/shape-sheet.ts`:

```ts
export default makeShapeSheetSystem({
  subject: "vehicle", // "vehicle", "housing" or "both"
  variant: "shaped", // "boxy" or "shaped"
  view: "side", // "hero", "side", "front" or "rear"
});
```

Use the same subject/view for a boxy-versus-shaped pair. Capture vehicle and
housing separately for side/front/rear inspection: the default combined hero
view is an overview, and a side camera can make two separate objects overlap.
Keep materials, lighting, viewport and render settings fixed. Export each
combination to a new file; do not overwrite an earlier control.

## Measure before detailing

Write the reference and current image values side by side. For projected bounds
use `[left/width, top/height, right/width, bottom/height]`. These are image-space
measurements; inferred local dimensions belong in a separate column.

| Question                                     | Measurement                                                      | First variable to inspect                    |
| -------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Is the whole object placed/framed correctly? | Overall projected bounds and gap to its neighbor                 | Camera or whole assembly transform           |
| Is the top too tall?                         | Belt-to-crown height / body length; projected silhouette height  | Section shoulder/crown heights               |
| Is the front too blunt?                      | Forepart length / body length; front/rear forepart crown heights | Longitudinal stations and crown heights      |
| Does the body look slablike?                 | Front/center/rear width and crown/shoulder width                 | Each section's width and shoulder bevel      |
| Does the cab crowd the rear?                 | Cabin/forepart/rear lengths and projected visible gaps           | Section stations; then view direction        |
| Are the wheels oversized?                    | Tire diameter / body length; tire top versus shell bottom        | Wheel radius, axle spacing and clearance     |
| Is the front face too narrow?                | Projected front width / projected body length                    | Assembly yaw before changing all body widths |
| Does the display fit its surface?            | Pane boundary versus surround, side view of top slope            | Window bounds and shared panel plane         |

For the shaped vehicle, body length is 3.8, width 1.4, crown height 1.61, belt
height .66 and tire diameter .60. Diameter/length is .1579; belt-to-crown rise
/ length is .25. Its cabin roof interval is 1.30 long and forepart interval is
1.20 long. These are example measurements, not target ratios for every vehicle.
The housing's length is 1.20 and its top falls from 1.02 at the rear to .57 at
the front. Both variants retain the same outer envelope.

Correct the three largest measured shape/placement errors first. Only then add
door seams, reflections, glass divisions or handles. A long-looking cabin or
short-looking rear in a three-quarter image does not uniquely establish its
world length: camera/object yaw and height also change that impression. Use
[CPU camera landmarks](../../docs/CAMERA_LANDMARKS.md) to check the chosen view.

## CPU checks and visual limits

```sh
node node_modules/vitest/vitest.mjs run \
  test/mesh/profile-shape-sheet.test.ts test/mesh/fitted-props.test.ts
```

The shape-sheet tests inspect emitted Float32 triangles at several scales:
closed edge incidence across material partitions, winding, nonzero triangle
area and unit normals. Rays through pane centers prove that paint does not
cover intended openings. Other checks cover exact shared pane boundaries,
preserved caller measurements, changed silhouettes inside equal outer bounds,
and wheel/body clearance. These checks complement hero/side/rear images; they
cannot establish fidelity to a reference or authoring speed.
