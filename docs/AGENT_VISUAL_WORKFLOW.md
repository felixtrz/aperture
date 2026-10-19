# Agent workflow for low-poly scenes

For fitted props, dioramas and shader-driven scenes, first read the task's shared
instructions and [visual quality defaults](VISUAL_QUALITY.md). Follow this short
path to a useful image; open the linked refinement guides after inspecting it.

## First useful image

1. Inspect the reference. Note the principal masses, their image-space bounds,
   relative dimensions, camera elevation and negative space. Choose orthographic
   or perspective from parallel edges and near/far scale; keep the scene in frame.
2. Scaffold with `aperture create my-scene --template diorama`. The starter supplies
   browser/headless configs, an orthographic camera, lit masses, real reflections,
   a compiled procedural water shader and `src/palette.ts` for linear colors.
   Dependencies must be installed for local preview; use provided dependencies
   when working in an already prepared project.
3. Edit `src/systems/scene.system.ts`: replace the disposable masses with 5–10
   meaningful assemblies from the assigned subject (ground, main structures and
   hero silhouettes). Reuse its named `spawn.group()` roots and
   `box(key, size, localPosition, hex, parent)` helper. Pose each root to move its
   fittings together; add parts in local coordinates. Edit presentation in
   `aperture.config.ts`; its headless wrapper already shares that config.
4. Keep the lit baseline: default environment, ACES, 4x MSAA, shadow-casting sun,
   receiving ground and subtle bloom. Use the palette's `color(hex)` for materials.
   Positions are `[x, y, z]` tuples; `mesh.box({ size })` is centered, cylinders use
   Y, and `mesh.plane({ size })` lies in XY (rotate `[-90, 0, 0]` for horizontal +Y).
   Match water height to `render.planarReflection.height`, retain the compiled
   shader and `camera.frustumCulling: false`, and use actual reflected geometry.
   Remove the water entity and planar reflection only for a dry scene.
5. Capture and inspect now, before trim, individual tiles, windows, leaf detail
   or optional API research. A useful image must show the subject's principal
   volumes, framing and spatial relationships; the untouched starter is not one.
   Write the three largest visible mismatches, then correct camera/layout first.

### Capture the blockout

Use the assigned capture harness when one is provided; retain its resolution,
seed/time, attempt budget, failed attempts and timing phases. Otherwise, from the
app directory with dependencies installed, run CPU extraction followed by render:

```sh
aperture headless aperture.headless.config.ts --out scene.bundle.json --asset-mode strict --render-width 1200 --render-height 900
aperture render scene.bundle.json --backend dawn --adapter software --out scene.png --json
```

Only render after extraction succeeds. Read the image before continuing. For
repeated portable previews use `aperture render serve --backend dawn --adapter software`.
The supplied water artifact needs rebuilding only after editing `src/water.wgsl`:
`aperture shader build src/water.wgsl --out src/water.shader.json`.

## After the first image

Use the [refinement reference](AGENT_VISUAL_REFINEMENT.md) for the full contracts
and worked snippets. Read only the material needed for the next visible correction:

- **Composition:** compare projected bounds and gaps. For a saved bundle,
  [project selected static mesh vertices](PROJECTED_BOUNDS_INSPECTION.md) with
  `aperture inspect projected-bounds` to find pixel extrema without decoding
  buffers by hand; the envelope does not establish visibility. Optional
  [finite CPU inspection](CAMERA_LOCAL_INSPECTION.md#finite-cpu-probe-after-the-first-image)
  reads local features sharing the geometry's construction variables through
  current ECS transforms, without a render. Re-probe after edits; saved reports
  are snapshots. If projection is uncertain, compare
  [explicit camera jobs with the same landmarks](CAMERA_LANDMARKS.md#compare-projection-families)
  and tolerance. These tools cannot infer correct geometry or choose a projection
  from a low residual; pixel-to-plane placement also requires an explicit plane.
- **Fitted shapes:** use [polygons](POLYGON_SURFACE_AUTHORING.md),
  [profiles/panels](FITTED_PROP_PROFILES.md) and [connected parts](CONNECTED_PARTS.md).
  Keep shared boundaries, outward winding, useful thickness and clean contacts.
  For suspicious surface slivers, use selected
  [coplanar overlap inspection](COPLANAR_OVERLAP_INSPECTION.md) on the exported
  bundle before changing lighting.
- **Detail that the reference needs:** [roof courses](../examples/planar-reflections/ROOF.md),
  [foliage](../examples/planar-reflections/FOLIAGE.md), or optional
  [surface variation](../examples/planar-reflections/SURFACES.md). Match proportions
  and foliage granularity before increasing detail.
- **Lighting and reflections:** use the [controlled lighting pass](AGENT_VISUAL_REFINEMENT.md#3-get-depth-from-lighting-then-add-surface-effects).
  Read [resolved light directions](LIGHTING_DIRECTION_EVIDENCE.md) in render
  reports; check bright/shaded planes and cast shadows before changing fill.
  Preserve readable reflected forms and the procedural shader.

Before delivery, inspect front/side/three-quarter views, central silhouettes,
contacts, shadow diagnostics, shader/compiler errors and reflection alignment.
Keep each pass focused on the largest mismatch; reserve the final preview for
known corrections and stop optional detail when the main forms read cleanly.
Verify final browser compatibility separately; in this cloud environment use the
[verified browser route](CLOUD_LOCAL_RENDERING.md). A successful PNG alone does
not establish visual correctness.
