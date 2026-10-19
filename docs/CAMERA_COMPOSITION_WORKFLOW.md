# Separate camera calibration from shape correction

Use this workflow after inspecting a useful blockout, before adding detail. A
camera change moves every projected assembly. A proportion change should fix a
particular assembly. Keep those decisions separate so the next measurement tells
you which change helped.

First compare the reference and preview at the same pixel dimensions. Record the
largest framing, plane-angle and proportion differences. If matching landmarks
or the reference projection are uncertain, record that uncertainty. An illustrated
reference can be geometrically inconsistent; a small fitting residual does not
prove its camera family or your assumed dimensions.

## Measure actual construction

The diorama starter already exposes `authoring.cameraProbe`. Its main-mass top,
ordered front face and own mesh bounds come from the same dimensions as the mesh.
Run this from the app directory, using the capture's actual seed and viewport:

```sh
aperture camera inspect-local aperture.headless.config.ts --request-resource authoring.cameraProbe --seed 7 --out composition-before.json
```

Read the `{ok,result}` envelope, point clipping, face facing and complete bounds
status. A saved report is a snapshot; rerun after source edits. The starter's
single untargeted point supports inspection, not camera fitting.

For calibration, extend that source-owned request with named points on geometry
whose dimensions and reference correspondences you trust. The
[local inspection guide](CAMERA_LOCAL_INSPECTION.md#share-construction-features)
shows the resource and point definitions. Keep local coordinates derived from the
same variables as the mesh, and store measured reference pixels in `target`.
Do not copy resolved world positions into a separate handwritten model.

For the orthographic example below, define four non-collinear rectangular-base
corners under a subject named `ground`, each with an explicit target and `weight: 1`.
Keep that base fixed. Also define independent upper features under another
subject: those will check proportions after camera calibration. Use genuine
construction features, including any bevel or inset; source AABB corners need
not be visible surface corners. Do not invent an occluded correspondence.

Request a camera job with an explicit `cameraJob.referenceDistance` in the
source-owned request. This distance chooses the orbit gauge; orthographic images
do not determine it. Export requires an unparented, unit-scale, zero-roll, Y-up
camera and an aspect matching the viewport. Inspect `cameraJobDiagnostics` if
`result.cameraJob` is null. Preserve the inspection evidence instead of
fabricating an export.

## Calibrate the camera while geometry stays fixed

After adding those features and targets, use
[`camera fit-local`](CAMERA_LOCAL_FITTING.md) to initialize, inspect, select and fit
in one CPU command. Its fit-plan lists the four `ground` point names and complete
fit settings. The report retains both the current-camera inspection and proposed
camera; independent features in the inspection still describe the current camera.

```sh
aperture camera fit-local aperture.headless.config.ts --request-resource authoring.cameraProbe --fit-plan camera-fit-plan.json --seed 7 --out camera-fit.report.json
```

Choose parameter bounds and a pixel tolerance before fitting. If you need separate
inspection and job files, create a fresh `composition-before.json` and save a complete
`fit` object as `camera-fit-settings.json`, following the
[parameter contract](CAMERA_LANDMARKS.md#coordinates-and-parameters): orthographic
distance must be `"fixed"`; azimuth, elevation, pan X/Y and orthographic height
can be bounded. Four corners supply eight scalar observations for those five
free parameters. Check actual conditioning rather than assuming the count
guarantees a usable fit.

This script selects the four explicit base points from the current inspection;
the independent upper features do not enter the optimizer:

```sh
set -eu
node --input-type=module - <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const envelope = JSON.parse(fs.readFileSync('composition-before.json', 'utf8'));
assert.equal(envelope.ok, true);
const seed = envelope.result.cameraJob;
assert(seed, 'Read cameraJobDiagnostics before fitting');
assert.equal(seed.camera.projection, 'orthographic');
const landmarks = seed.landmarks.filter(point => JSON.parse(point.name)[0] === 'ground');
assert.equal(landmarks.length, 4);
assert(landmarks.every(point => point.target && point.weight === 1));
const fit = JSON.parse(fs.readFileSync('camera-fit-settings.json', 'utf8'));
assert.equal(fit.parameters.distance, 'fixed');
fs.writeFileSync('camera-base.job.json', JSON.stringify({...seed, landmarks, fit}, null, 2) + '\n', {flag:'wx'});
JS
aperture camera fit camera-base.job.json --out camera-fit.report.json
```

The direct `fit` command returns the fitter output; `fit-local` retains it under
`result`. Read `fit.accepted`, every point residual and clipping flag, bound hits,
`fit.conditioning`, and `enginePrecision.withinTolerance`. Require full rank for
the chosen free parameters. `converged:true` alone means the optimizer stopped;
it can converge on inconsistent observations. Exit 2 retains a candidate needing
review. Do not drop a difficult corner, change the known base or loosen tolerance
to turn rejection into success. Keep the report and revisit the uncertain model
or correspondence explicitly.

The fit checks two different tolerances: `fit.engineWithinTolerance` compares the
emitted engine camera with the observed target pixels; `enginePrecision` compares
the analytic and engine representations. Passing the latter does not mean the
camera matches the reference.

## Apply once, then correct independent proportions

Apply the accepted report's `spawnCamera` to the scene's existing camera. Preserve
the complete checked transform, including `rotation`, plus its projection,
height, fixed aspect and clipping fields. Retain your camera key and presentation
options, such as the diorama's `frustumCulling:false` and clear color. The
[application example](CAMERA_LANDMARKS.md#runnable-example) explains the descriptor;
the fit command does not modify your scene itself. An explicit rotation takes
precedence over a subsequently edited `lookAt`.

Run the same inspection with a new output name, `composition-calibrated.json`.
Verify the base still meets the chosen tolerance through the camera actually
spawned by the app. Then read the independent upper-feature residuals. A passing
base fit has not established correct upper dimensions.

Hold the entire camera descriptor fixed while adjusting one dimension or a small
declared set of dimensions. Use the current projected feature separations and
the construction's known directions to estimate the correction; for example,
with an orthographic camera and a fixed pose, a width-controlled edge's projected
separation scales linearly with that width. This relationship does not hold for
an arbitrary perspective edge or a simultaneous pose change. Change the mesh's
dimension variable, never just the landmark. Inspect again under a new filename
and check all independent features, including ones unused by your estimate.

If a camera or base change is necessary, reopen calibration explicitly with fresh
measurements. Keep each earlier state/report identifiable. Do not treat old world
coordinates or a saved projection as a measurement of edited geometry.

## Check the rendered result

Capture and inspect again after the measured correction. Check the reference's
negative space, dominant wall proportions, roof silhouette and object contacts.
Point projections establish locations, ordered faces establish geometric facing,
and static source bounds establish an envelope. None establishes visibility,
occlusion, a rendered silhouette, materials or visual quality. Incomplete bounds
must remain incomplete; a successful subset is not an aggregate result.

This workflow separates assumptions and measurements. It does not recover an
unknown reference's true geometry automatically or replace visual review.
