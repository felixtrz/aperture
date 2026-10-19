# CPU camera landmarks

Use named world points and measured reference pixels to check composition early,
before detailed geometry or a render. `aperture camera project` projects the
initial camera. `aperture camera fit` adjusts only explicitly bounded camera
parameters. Both run on the CPU, preserve the job in their JSON report, and accept
`--out report.json` in addition to printing JSON on stdout.
`aperture camera unproject` performs the inverse placement step: intersect named
pixel rays with an explicit world plane, using the same camera schema. All three
commands run without a browser or GPU and leave scene geometry untouched.

This complements `camera_frame_entities`, which frames existing ECS mesh bounds.
Landmark jobs do not load a scene, infer geometry, read screenshots, find image
features, or choose a projection family. Supply world points from the actual
authored scene and select `perspective` or `orthographic` explicitly. Compare
separate jobs if both projection families are plausible. For grouped geometry,
the optional [finite CPU probe](CAMERA_LOCAL_INSPECTION.md#finite-cpu-probe-after-the-first-image)
exports current world points from construction-owned local features, without
manually expanding parent transforms. Re-probe after relevant scene edits.

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

## Compare projection families

Keep one resolved scene state and exactly the same landmark names, world points,
targets, weights and viewport in both jobs. Keep source identity beside the jobs;
the strict job schema does not accept provenance fields. Include independent
depth/height observations where available. Changing the observations or pixel
tolerance between candidates prevents a controlled comparison.

This small example reuses `camera-job.json` above. It holds the known orientation
and distance fixed, allowing only horizontal pan and projection scale. These
seeds and bounds belong to this synthetic example; choose explicit plausible
ones for your own scene. A local probe exports only the current camera family.

```sh
set -eu
node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const source = JSON.parse(readFileSync('camera-job.json', 'utf8'));
for (const projection of ['orthographic', 'perspective']) {
  const orthographic = projection === 'orthographic';
  const job = {
    viewport: source.viewport,
    landmarks: source.landmarks,
    camera: {
      projection, translation: [0, 0, 10], lookAt: [0, 0, 0], near: 0.1, far: 100,
      ...(orthographic ? { orthographicHeight: 6 } : { fovYDegrees: 34 }),
    },
    fit: {
      parameters: {
        azimuthDegrees: 'fixed', elevationDegrees: 'fixed', distance: 'fixed',
        panX: { min: -2, max: 2 }, panY: 'fixed',
        ...(orthographic
          ? { orthographicHeight: { min: 4, max: 8 } }
          : { fovYDegrees: { min: 20, max: 50 } }),
      },
      maxIterations: 100, tolerancePixels: 1,
    },
  };
  writeFileSync(`${projection}.job.json`, JSON.stringify(job, null, 2) + '\n');
}
JS
for family in orthographic perspective; do
  status=0
  aperture camera fit "$family.job.json" --out "$family.fit.json" || status=$?
  case "$status" in 0|2) ;; *) exit "$status" ;; esac
done
```

Exit 2 retains a complete candidate requiring review; keep its report. Both jobs
have three targeted points (six scalar observations), two free parameters and
four residual degrees of freedom. Compare the signed residual for each feature,
RMS/max error, constraints and bound hits, conditioning, engine precision,
termination and `fit.converged`/`fit.accepted`. More general fits can have
different free-parameter counts; report those differences explicitly.

A lower residual does not select the reference's projection model. More freedom
can absorb geometric or annotation errors, and distant narrow-FOV perspective
can approximate orthographic within the same tolerance. Both may be accepted;
a bound hit or iteration limit can also leave a plausible family unresolved.
Keep that ambiguity rather than loosening tolerance or automatically applying a
winner. Review a candidate, then re-probe the live scene after applying it or
changing geometry; the saved pre-edit landmarks remain historical evidence.

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

## Pixel-to-plane placement

Use `unproject` when a feature's image coordinates and its world plane are known.
For example, place corners on a vertical facade or points on a caller-defined
ground plane. A pixel alone gives a ray, not a depth: the plane is an explicit
authoring assumption. This command does not read images, infer depth, inspect
occlusion, or modify a scene. Use separate jobs for points on different planes.

Save this complete example as `plane-job.json`:

```json
{
  "viewport": { "width": 800, "height": 600 },
  "camera": {
    "projection": "orthographic",
    "translation": [0, 0, 10],
    "lookAt": [0, 0, 0],
    "near": 1,
    "far": 20,
    "orthographicHeight": 6
  },
  "plane": { "normal": [0, 0, 1], "constant": 0 },
  "pixels": [
    { "name": "left-top", "pixel": [200, 200] },
    { "name": "right-bottom", "pixel": [600, 400] },
    { "name": "outside", "pixel": [-100, 300] }
  ]
}
```

```sh
aperture camera unproject plane-job.json --out placement.json
```

Expected world intersections are approximately `[-2,1,0]`, `[2,-1,0]` and
`[-5,0,0]`. All are accepted; the last is offscreen and has `inFrustum: false`.
For a perspective example, replace `projection` with `"perspective"` and
`orthographicHeight` with `"fovYDegrees": 90`. The first intersection becomes
approximately `[-6.666667,3.333333,0]`. Adopt the reported world positions in
caller-owned scene geometry only after reviewing the plane and camera assumptions.
The report's `spawnCamera` descriptor pins the same checked camera quaternion
and aspect for rendering these points.

The strict job shape is `viewport`, `camera`, `plane`, `pixels`; do not include
`landmarks` or `fit`. Each of 1–4096 pixels needs a unique nonempty `name` and a
finite two-number `pixel` within ±1e12. Viewport and camera requirements match
`project`, including Y-up, zero roll, the direction/pole limits, and explicit
near/far planes. Coordinates are continuous top-left pixels: X right, Y down,
center `[width/2,height/2]`, and no half-pixel adjustment. Offscreen coordinates
are valid extrapolation and are never clamped.

The plane equation is **`dot(normal, world) + constant = 0`**. For `z = 2`, use
`normal: [0,0,1], constant: -2`; for `y = 3`, use `[0,1,0], -3`.
The three-component normal must be finite and nonzero. The constant must be
finite. Unlike camera fields, plane coefficients have no ±1e12 restriction:
scaling every coefficient by the same nonzero factor, including a negative or
tiny factor, preserves the plane. The report normalizes the normal to unit
length and scales the constant with it, using the largest normal coefficient
first to avoid squared-length overflow or underflow. A normalized constant
outside the finite numeric range is invalid input. Once normalized, the constant
and signed plane residual use the caller's world units.

Rays use Aperture's actual Float32 camera view and projection, including rounded
ECS camera fields. Their inverse view calculation and intersections use double
precision. `ray.origin` is the eye of that engine view for perspective cameras.
For orthographic cameras it is the pixel's point on the camera-depth-zero plane,
so origins vary across pixels and directions are parallel. Origins are **not** on
the near clip plane. The effective eye may differ slightly from the submitted
translation due to Float32 representation. `ray.direction` is a unit world vector
with camera forward along local -Z; perspective directions vary across pixels.
`distance` is signed world distance from origin,
with `world = origin + distance * direction`.

The report preserves `input` and supplies a normalized `plane`, `spawnCamera`,
`cameraFailure` and named `points`. Each point includes:

| Field                                                 | Meaning                                                                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accepted`, `failure`                                 | Whether this intersection meets all numerical and depth requirements, and a failure code otherwise.                                                              |
| `ray`, `incidenceCosine`                              | Origin/unit direction and signed dot product of the normalized plane normal with the direction.                                                                  |
| `distance`, `world`                                   | Signed ray distance and computed intersection; `null` when no reliable finite intersection was computed.                                                         |
| `planeResidualWorldUnits`, `planeToleranceWorldUnits` | Signed normalized plane equation at the intersection and a roundoff allowance of `64 * Number.EPSILON * max(1, abs(normalizedConstant), abs(world components))`. |
| `reprojectedPixel`, `residual`, `residualDistance`    | Forward projection through the actual Float32 combined camera matrix, signed `reprojectedPixel - pixel`, and Euclidean error in pixels.                          |
| `depth`, `ndc`                                        | Positive-forward engine view depth in world units and WebGPU NDC, whose visible depth interval is `[0,1]`.                                                       |
| `inFront`, `depthInRange`, `clipDepthInRange`         | Positive ray distance/depth, inclusive rounded near/far check, and inclusive actual NDC depth `[0,1]` check.                                                     |
| `insideViewport`, `clipXYInRange`, `inFrustum`        | Requested pixel inside the inclusive viewport, actual NDC X/Y inside `[-1,1]`, and actual clip X/Y plus both depth checks and positive ray distance/depth.       |

Acceptance requires a stable unique forward intersection, both depth checks,
plane residual within its reported roundoff allowance, and an engine reprojection
error of at most **0.05 pixels**. It does not require an onscreen pixel. Near/far
and actual clip checks are deliberately separate: Float32 rounding can clip a
point exactly at a nominal boundary. These checks are strict, with no hidden clip
epsilon; leave a depth margin for placement intended to render. `inFrustum`
describes geometric visibility bounds, not occlusion or pixel accuracy.

An exactly zero incidence is `parallel`, including a coplanar ray with no unique
intersection. An absolute incidence at or below **1e-8** is `ill-conditioned`;
the command retains the ray and omits its unstable intersection. Other failure
codes are `behind-camera` (including zero distance), `outside-clip-range`,
`reprojection-error`, `plane-residual`, `nonfinite-ray`,
`nonfinite-intersection`, `nonfinite-reprojection`, and `invalid-engine-camera`.
Finite intersections behind the camera or outside clip range remain in the
report for inspection. Undefined projections are `null`. Collapsed or nonfinite
Float32 cameras produce `invalid-engine-camera` for every point and a top-level
explanation in `cameraFailure`. Recenter or rescale the camera/scene if engine
representation or precision fails; these checks do not validate mesh storage or
transforms applied later.

Exit **0** means every point is accepted. Exit **2** means one or more points need
review and still prints/writes the complete structured report, including successful
points. Exit **1** means malformed input (including zero/nonfinite plane normals)
or an I/O error. `--out` atomically replaces the report file and stdout contains
the identical JSON. The input job and scene are never rewritten.
All camera commands resolve the input file and the report's parent directory
before checking for collisions. Input symlinks and directory aliases cannot
bypass the guard against replacing the input file or its directory entry.
An independent output symlink is replaced atomically; its target is not rewritten.
