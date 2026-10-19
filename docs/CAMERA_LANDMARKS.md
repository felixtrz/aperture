# CPU camera landmarks

Use named world points and measured reference pixels to check composition early,
before detailed geometry or a render. `aperture camera project` projects the
initial camera. `aperture camera fit` adjusts only explicitly bounded camera
parameters. Both run on the CPU, preserve the job in their JSON report, and accept
`--out report.json` in addition to printing JSON on stdout.

This complements `camera_frame_entities`, which frames existing ECS mesh bounds.
Landmark jobs do not load a scene, infer geometry, read screenshots, find image
features, or choose a projection family. Supply world points from the actual
authored scene and select `perspective` or `orthographic` explicitly. Compare
separate jobs if both projection families are plausible.

## Runnable example

Save this synthetic example as `camera-job.json`. The three target pixels describe
an orthographic camera panned one world unit right. The last point has no target;
it is a projection-only check.

```json
{
  "viewport": { "width": 800, "height": 600 },
  "camera": {
    "projection": "orthographic",
    "translation": [0, 0, 10],
    "lookAt": [0, 0, 0],
    "near": 0.1,
    "far": 100,
    "orthographicHeight": 6
  },
  "landmarks": [
    { "name": "left-base", "world": [-1, 0, 0], "target": [200, 300] },
    { "name": "right-base", "world": [2, 0, 0], "target": [500, 300] },
    { "name": "top", "world": [0, 2, -1], "target": [300, 100] },
    { "name": "rear-check", "world": [0, 1, -3] }
  ],
  "fit": {
    "parameters": {
      "azimuthDegrees": "fixed",
      "elevationDegrees": "fixed",
      "distance": "fixed",
      "panX": { "min": -2, "max": 2 },
      "panY": "fixed",
      "orthographicHeight": "fixed"
    },
    "maxIterations": 100,
    "tolerancePixels": 1
  }
}
```

```sh
aperture camera project camera-job.json --out camera-before.json
aperture camera fit camera-job.json --out camera-fit.json
```

The fit should return `panX` approximately `1`, `fit.accepted: true`, and
`spawnCamera.transform.translation` approximately `[1, 0, 10]`. Apply the report
inside an Aperture system's `init` with `this.spawn.camera(report.spawnCamera)`.
The descriptor contains an unparented `transform` and a `camera` object with
explicit aspect, near/far planes and `autoAspect: false`. Use the job viewport
dimensions when rendering. The report is a candidate for review; the command
does not modify your scene or make that camera active in an existing scene.
The transform includes an explicit checked quaternion `rotation` as well as
`lookAt`. Spawn uses that rotation to preserve the exact Float32 camera checked
by the report. Remove `rotation` if editing `lookAt` manually later, since an
explicit rotation takes precedence over lookAt.

For a perspective projection example, replace the entire `camera` object with:

```json
{
  "projection": "perspective",
  "translation": [6, 4, 8],
  "lookAt": [0, 1, 0],
  "near": 0.1,
  "far": 100,
  "fovYDegrees": 52
}
```

Remove `fit` and target pixels from the orthographic example, then run `project`
to inspect the perspective view. For a perspective fit, measure matching pixels
and supply all six parameters, for example:

```json
{
  "parameters": {
    "azimuthDegrees": { "min": 20, "max": 60 },
    "elevationDegrees": { "min": 5, "max": 40 },
    "distance": { "min": 7, "max": 18 },
    "panX": { "min": -2, "max": 2 },
    "panY": { "min": -2, "max": 2 },
    "fovYDegrees": { "min": 35, "max": 75 }
  },
  "tolerancePixels": 2
}
```

Use more independent landmarks than the minimum, including depth and height
variation, and narrow the free parameters when the camera is poorly constrained.
Three points provide only six scalar measurements; they leave no residual degrees
of freedom for a six-parameter fit. A frontal plane can make FOV and distance
indistinguishable. Fix either parameter or provide independently known depth.

## Coordinates and parameters

- World is Y-up. Camera forward is local -Z. World-up is fixed at `[0,1,0]`
  and roll is zero. Parenting, lens distortion, jitter, cropping, skew, off-center
  principal points and non-square pixels are unsupported.
- Pixels use top-left origin, positive X right and positive Y down. The viewport
  center is `[width/2,height/2]`; these are continuous coordinates, without a
  half-pixel offset. NDC uses X/Y in `[-1,1]` and WebGPU depth in `[0,1]`.
- Every landmark has a unique `name` and a three-number `world`. Optional `target`
  has two pixel coordinates. Optional positive `weight` requires a target and
  defaults to 1. Both coordinates receive the same weight. Weights are relative
  confidence; a global weight multiplier does not affect the solve.
- Camera translation, lookAt, near and far are mandatory. Perspective requires
  `fovYDegrees` in `[0.1,179]`; orthographic requires `orthographicHeight > 0`.
  Width and height are integers from 1 to 1,000,000. Numbers must be finite and
  within ±1e12; successful Float32 checks impose further practical limits.
- The original lookAt remains the fixed base. Initial distance and angles are
  derived from `translation - lookAt`; pans start at zero. For azimuth `a` and
  elevation `e`, back is `[sin(a)cos(e),sin(e),cos(a)cos(e)]`, right is
  `[cos(a),0,-sin(a)]`, and up is `back × right`. The final lookAt is
  `base + panX*right + panY*up`; translation is `lookAt + distance*back`.
  This avoids the redundant freedom of independently fitting a full 3D target
  and distance. `panX` and `panY` use world units in the rotated camera plane.
- Every applicable fit parameter must be `"fixed"` or `{ "min", "max" }`, with
  ordered finite bounds containing its initial value. Perspective has six free
  parameters at most. Orthographic distance **must be fixed** because pixels
  cannot constrain it; it still affects depth/frustum checks.
- Elevation stays within ±89.9°, azimuth bounds span at most 360°, and distance
  exceeds 1e-6 world units to avoid the spawn look-at identity fallback.
  Bounded orthographic height also has a lower bound above 1e-6.
  Near/far planes, world-up, roll, base lookAt and geometry are always fixed.

## Reading the report

`landmarks` contains predicted `pixel`, signed `residual = pixel - target`,
Euclidean `residualDistance`, positive-forward world-space `depth`, `ndcDepth`,
`ndc`, and separate `inFront`, `depthInRange`, `insideViewport`, `inFrustum` flags.
An undefined perspective divide produces `null` pixel/residual/NDC values.
Behind-camera points can have mathematical pixel coordinates but are invalid
for fitting. Every targeted point must stay between the near and far planes;
off-screen pixel targets are allowed. Projection-only points may remain invalid.
Frustum flags use double precision; leave some depth margin at clip planes,
where Float32 rounding can change whether the rendered point is clipped.

For N measured points with errors `(dx,dy)`, `metrics` distinguishes:

| Field                               | Definition                          |
| ----------------------------------- | ----------------------------------- |
| `scalarCoordinateRmsPixels`         | `sqrt(sum(dx²+dy²)/(2N))`           |
| `pointRmsPixels`                    | `sqrt(sum(dx²+dy²)/N)`              |
| `weightedScalarCoordinateRmsPixels` | `sqrt(sum(w*(dx²+dy²))/(2*sum(w)))` |
| `weightedPointRmsPixels`            | `sqrt(sum(w*(dx²+dy²))/sum(w))`     |
| `maxPointErrorPixels`               | Largest unweighted `sqrt(dx²+dy²)`  |

Point RMS is √2 times scalar-coordinate RMS, including the weighted pair.
These are landmark errors, not image-similarity scores. Metrics are `null` when
there are no targets or a target cannot be projected. Confidence weights never
hide individual residuals or alter the acceptance threshold.

`fit` reports free-parameter and residual-coordinate counts, residual degrees of
freedom, constraints, bound hits, initial/final metrics and conditioning, iteration
limit, iterations completed and termination. The solver uses bounded damped least
squares with finite differences, normalizing parameters by their bound spans and
weights by their mean. Conditioning uses the resulting weighted Jacobian's
singular values; the reported condition estimate must be below 1e6 and the
Jacobian must have full rank. Bounds affect this scaling, so use plausible ranges.
This is a local diagnostic, not a covariance estimate or a uniqueness proof.

`fit.converged` requires first-order stationarity (including active bounds) or a
negligible residual. A stalled loss, rejected step or iteration limit alone is
**not convergence**. `fit.withinTolerance` requires every targeted point's
unweighted Euclidean residual to be at most `tolerancePixels` (default 1).
`fit.engineWithinTolerance` applies the same target threshold to the emitted
Float32 engine camera. `fit.accepted` requires both tolerances, convergence and
the engine precision check.
An optimizer can converge while the proposed geometry and measured pixels remain
inconsistent. Inspect large and patterned residuals before changing camera or
geometry; the fit never deforms the supplied world points.

`enginePrecision` independently projects the emitted camera through Aperture's
Float32 look-at and projection matrices and reports named pixel differences from
the double-precision solver, plus engine target residuals and
`maxTargetPointErrorPixels`. Differences over 0.05 pixels, collapsed clip planes,
or other representation failures prevent fit acceptance. Recenter or rescale the
scene when this fails. This checks camera representation with fixed input world
points; it does not validate mesh vertices, scene extraction, occlusion, or a
rendered silhouette. Apply only to an unparented, unjittered camera with the
reported viewport/aspect.

Exit codes are 0 for a projection report or accepted fit, 2 for a fit that needs
review, and 1 for invalid/insufficient/initially ill-conditioned inputs or I/O
failures. Exit 2 still prints/writes the complete candidate report. Inspect
`enginePrecision` even on a projection-only report. Unknown fields are rejected
to catch typos and accidental unsupported camera freedoms.
