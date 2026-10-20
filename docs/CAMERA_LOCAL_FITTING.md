# Fit a camera from fresh construction features

`aperture camera fit-local` combines [local CPU inspection](CAMERA_LOCAL_INSPECTION.md)
with the existing [landmark fitter](CAMERA_LANDMARKS.md). It initializes the current
headless app once, exports the complete source-owned probe, and fits the explicitly
selected points. You supply correspondences, bounds and tolerance; the command
returns a proposed camera and leaves application to you.

## Prepare the source-owned probe

Use a resource's `values.request` as in the
[construction-feature example](CAMERA_LOCAL_INSPECTION.md#share-construction-features).
It owns the camera selector, viewport, named local features, measured target
pixels, optional weights and explicit `cameraJob.referenceDistance`. Derive local
features from the same dimensions as the mesh. The fit-plan contains selection
and optimizer settings only; it cannot override those source-owned values.

For example, define a subject `ground` with four named rectangular-base corners
`back-left`, `back-right`, `front-right`, and `front-left`. Each needs a measured
reference `target: [x, y]`. Keep independent upper features in a separate subject
so you can check proportions without fitting them away. The diorama starter
includes optional `CAMERA_WORKSHEET.md`, `camera-observations.json` and a complete
`camera-fit-plan.json`. Its source-owned land/main-mass corners follow actual
beveled top faces; they are not outer AABB corners. Fill only credible visible
correspondences, then adapt the selection and settings. Unfilled pixels remain
untargeted; fitting an empty selection fails without changing the scene. The
main-mass top-center point remains an untargeted inspection probe.

Only calibrate against dimensions and correspondences you trust. A source-box
corner need not be a visible surface corner. The command cannot identify
occluded points, choose the reference's projection, or recover unknown geometry.
Follow the [camera and shape correction sequence](CAMERA_COMPOSITION_WORKFLOW.md)
to separate those decisions.

## Select points and explicit settings

Save this as `camera-fit-plan.json` for an orthographic camera whose initial values
fall within these example bounds. Choose bounds appropriate to your scene before
running the fit; these are not inferred defaults.

```json
{
  "selection": [
    { "subject": "ground", "point": "back-left" },
    { "subject": "ground", "point": "back-right" },
    { "subject": "ground", "point": "front-right" },
    { "subject": "ground", "point": "front-left" }
  ],
  "fit": {
    "parameters": {
      "azimuthDegrees": { "min": 15, "max": 75 },
      "elevationDegrees": { "min": 10, "max": 70 },
      "distance": "fixed",
      "panX": { "min": -4, "max": 4 },
      "panY": { "min": -4, "max": 4 },
      "orthographicHeight": { "min": 4, "max": 20 }
    },
    "tolerancePixels": 1
  }
}
```

Use the existing [parameter contract](CAMERA_LANDMARKS.md#coordinates-and-parameters):
each relevant parameter is explicitly fixed or bounded. Orthographic distance
must stay fixed. For perspective, use `fovYDegrees` instead of
`orthographicHeight`, with enough independent observations and suitable fixed
parameters to avoid ambiguities. Observation count alone does not establish
conditioning. `tolerancePixels` is required and positive; `maxIterations` is
optional and follows the existing fitter's validation.

Run from the app directory, using the capture's seed and the probe's actual
render-pixel viewport:

```sh
aperture camera fit-local aperture.headless.config.ts --request-resource authoring.cameraProbe --fit-plan camera-fit-plan.json --seed 7 --out camera-fit.report.json
```

Selection order is preserved. Duplicate or unknown pairs and selected points
without targets fail. Omitted weights retain the fitter's unit-weight default.
The **complete** source-owned job must pass export before selection: unsupported
camera representation, camera-dependent points or engine/analytic precision
failure on a nonselected feature cannot be bypassed by filtering it out.

## Read and apply the result

Stdout and `--out` contain the same `aperture.camera.fit-local.v1` report:

- `inputs` and `plan` identify the config, resource, seed and supplied settings.
- `inspection` retains the full inspection envelope. Its features describe the
  **current authored camera**, including independent check features. They have
  not been reprojected through the candidate.
- `job` retains the selected fresh job; `result` retains the complete existing
  fitter output, including residuals, clipping, bounds, conditioning, engine
  precision checks and `spawnCamera`.
- `ok` means the fit was accepted. `stage` identifies inspection, export or fit;
  `cameraApplied` is always false. Failed inspection/export retains diagnostics
  with null `job` and `result`.

Read `result.fit.accepted`, conditioning and every selected point's evidence.
Convergence alone does not establish acceptance. Engine representation precision
and agreement with reference pixels are separate checks. Do not relax tolerance
or drop a difficult observation merely to obtain acceptance.

Apply the accepted **complete** `result.spawnCamera` to the existing scene camera,
preserving presentation settings and its entity key. Keep the emitted rotation,
projection, fixed aspect, clipping fields and height/FOV together. Explicit
rotation takes precedence over a later `lookAt` edit. Then run `inspect-local`
again to check the actually spawned camera and independent shape features:

```sh
aperture camera inspect-local aperture.headless.config.ts --request-resource authoring.cameraProbe --seed 7 --out composition-calibrated.json
```

Hold the camera fixed during shape correction. Rerun inspection after changing
construction dimensions; old reports remain snapshots. A small residual does
not establish rendered silhouette, visibility, materials or visual quality.

## Lifecycle and failure behavior

The command runs normal app initialization and refreshes derived transforms. It
adds no simulation step, extraction, render or GPU work, and does not edit source,
authored geometry or camera state. Apps constructed in update systems need the
existing stepped headless workflow instead. This route uses strict local assets,
public directory `public`, and no HTTP asset fetching.

| Exit | Meaning                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 0    | Accepted fit; the complete report is retained.                                                              |
| 2    | Inspection/export failure or completed unaccepted fit; the report is retained for review.                   |
| 1    | Invalid plan/job, initial ill-conditioning, bootstrap, disposal or I/O failure; no new report is published. |

Disposal completes before publication. `--out` atomically replaces a file in an
existing directory; config and fit-plan paths and their aliases are protected.
An unrelated output symlink is replaced rather than followed. On a typed failure
the previous output remains untouched, so always check the current invocation's
exit status. No old output is read as a fallback input.

The existing `inspect-local` → explicit job selection → `camera fit` route remains
available for workflows needing separate inspection and job files. `fit-local`
uses the same exporter and solver, and does not change their acceptance rules.
