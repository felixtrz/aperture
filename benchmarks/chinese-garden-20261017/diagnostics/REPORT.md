# Garden follow-up: AO repair and time-to-image diagnosis

Date: 2026-10-17 UTC / 2026-10-16 Pacific. These are post-trial diagnostics.
The original authors, captures, scores and comparison remain frozen.

## Result

The SSAO silhouette bug is fixed in the renderer. The frozen final garden was
rebuilt with **the same scene source and AO settings**, and verified through
native browser WebGPU. Outlines around bamboo, bridge, furniture and pond no
longer appear. AO remains enabled; contact shading remains measurable.

The largest measured time penalty was continuous rendering during a static
screenshot workflow. Three repeats of the identical first Aperture scene gave
**84.91 s median continuous versus 7.11 s demand** (91.6% less capture wall time).
The captured pixels are identical. This is a capture-workflow result on
SwiftShader, not a claim of 12× faster engine/shader execution.

## Original trial timing

| Framework | Dispatch to successful capture request | Build | Render/capture/cleanup | First verified from dispatch | Total author elapsed |
|---|---:|---:|---:|---:|---:|
| aperture | 276.9 s | 1.35 s | 80.03 s | 358.3 s | 867.3 s |
| vgpu | 198.0 s | 0.29 s | 3.33 s | 201.7 s | 815.1 s |
| three | 215.3 s | 0.43 s | 3.40 s | 219.2 s | 750.3 s |

Relative to Three.js, Aperture's first-image gap was 139.2 s: about **61.6 s
before the successful capture request** and **77.6 s inside the capture lifecycle**.
Relative to vGPU, the corresponding differences were 78.9 s and 77.8 s.
vGPU had a failed shader build before its first successful capture.
The pre-request period includes agent reasoning, documentation/API reading,
geometry construction, and any earlier failed attempts. We cannot split it into
those categories from this trial. It is not engine startup time.

Total author elapsed was 14:27 Aperture, 13:35 vGPU, and 12:30 Three.js.
Aperture's six capture lifecycles consumed 202.5 s; its first two alone consumed
167.6 s. Later demand-mode lifecycles were 6.9–10.2 s. Total build time was only
7.7 s. Three.js and vGPU spent 27.7 s and 22.9 s in capture lifecycles, plus
81.7 s and 79.5 s waiting for the shared capture slot. Aperture had effectively
no capture-queue wait. Queue waiting is contention, not rendering throughput.
Captures can overlap author work, so subtracting these totals does not produce
an exact active-authoring or billing estimate. Token/dollar cost was not logged.

The Aperture journal records a winding correction after the first preview,
a coplanar water/foundation correction after the second, and later composition
and detail revisions. Expensive first feedback made these ordinary revisions
costlier. It does not establish that the framework intrinsically needs more
agent reasoning; there was only one author per framework.

## Controlled capture measurements

Three runs per condition, sequential native verified Chromium/SwiftShader
captures at 1200×900. Continuous/demand use copies of the same original first
Aperture source; only cadence differs. Bundles were built before the AO fix.
Other frameworks replay their own frozen first successful sources. Their scenes
and lighting are not equivalent renderer workloads. Builds are outside these
measurements. Values below are median seconds; phase medians need not sum to the
total median.

| Phase | Aperture continuous | Aperture demand | Three.js | vGPU |
|---|---:|---:|---:|---:|
| launchAndContextMs | 1.511 | 1.309 | 1.269 | 1.175 |
| sceneReadyWaitMs | 24.104 | 4.937 | 1.525 | 1.104 |
| gpuDrainBeforeScreenshotMs | 16.930 | 0.031 | 0.032 | 0.031 |
| screenshotMs | 23.116 | 0.319 | 0.142 | 0.104 |
| gpuDrainAfterScreenshotMs | 16.403 | 0.015 | 0.026 | 0.012 |
| contextAndBrowserCleanupMs | 3.124 | 0.058 | 0.058 | 0.036 |
| totalMs | 84.906 | 7.113 | 3.657 | 2.850 |

Aperture continuous: 28 queue submissions / 409 draw calls in every run.
Aperture demand: 4 / 73. Three.js: 3 / 262. vGPU: 1 / 3. Draw calls differ in
geometry, pixel coverage, lighting and setup work, and cannot alone predict cost.
Three.js and vGPU render once for readiness; Aperture's original app kept
rendering while its readiness helper and verifier awaited GPU fences, animation
frames and screenshots. Demand mode removes this ongoing work without changing
the verified image or weakening proof checks.

There is still a **roughly 3.5–4.3 s capture gap** between Aperture demand and
these other first scenes. Most is in the readiness phase: about 4.94 s versus
1.53 s / 1.10 s. This phase combines worker startup, module loading, asset and
pipeline preparation, rendering and the authored readiness hook. Current
instrumentation cannot attribute those individual costs. Aperture runs its full
generated worker/ECS/PBR/environment/shadow/post path; vGPU uses a compact custom
shader and batched geometry; the first Three.js version does not yet use its
final GTAO pipeline. These differences are candidates to profile, not measured
percentages of the remaining gap.

A separate probe minified the exact demand bundles, preserving identical pixels.
Median total was 6.46 s versus 7.11 s, but the ranges overlap (6.08–9.29 s versus
6.29–8.21 s), and this was a later group of runs on a shared host. It does not
establish a reliable minification speedup. Bundle size is not the explanation
for the original 80-second penalty.

Raw phase reports, image equality and counts: [timing/summary.json](timing/summary.json).
Full per-run evidence is under `timing/<condition>/captures/<1..3>/`.
`runVerifiedScene` now retains wall-clock phase timings for future diagnosis.

## AO changes and regression proof

- Pass the selected extracted projection to effects in both legacy and graph
  paths. SSAO uses an inverse-projection uniform for correct orthographic and
  perspective reconstruction, updating camera data without pipeline recreation.
- Resolve MSAA depth to the nearest real surface for AO. The previous average
  manufactured intermediate depths along silhouettes. Other effects retain
  their existing resolve behavior.
- Reconstruct the normal from the closest-depth neighbor on each axis and
  reconstruct tap positions at actual texel centers. Avoid crossing depth
  discontinuities and skip offscreen/background taps.
- Use golden-angle taps instead of the old ten-turn pattern, which repeated
  only four directions at eight samples.

Native Dawn pixel tests exercise flat surfaces, distant silhouettes, contact
steps and indirect-only composition, with orthographic/perspective cameras and
1×/4× sampling. On the original shader, the distant-object test falsely darkened
532 / 641 orthographic pixels and 104 / 134 perspective pixels. All four cases
now have **zero false dark pixels** at the test threshold. Contact shading still
passes (391 dark contact pixels in the orthographic 4× case), and no false
foreground contour is introduced. The original shader fails four of six native
cases; the fix passes six of six. This negative control proves the tests detect
the reported defect.

The effect remains single-pass SSAO. It has no spatial denoiser or temporal
accumulation; genuine contact regions can retain low-sample grain. MSAA still
uses composite-color attenuation because the separate indirect channel is not
available on that route. Fixing the outline is not a claim of full GTAO parity.

## Implemented now

- Renderer AO correction and automatic camera propagation.
- Unit checks for projection round trips, camera updates without new pipeline or
  redundant uploads, and both renderer paths forwarding the selected matrix.
- Native pixel regressions included in `test:dawn` and its CI path triggers.
- Capture phase telemetry, static-scene demand-cadence documentation, AO API docs
  and a package changeset.
- Corrected final garden capture with native WebGPU proof, zero GPU errors and
  no WebGL use. Original benchmark results remain untouched.

## Next improvements, in order

1. **An explicit still-capture contract.** The tooling should request a specific
   simulation state, await its presented frame and GPU completion, and freeze
   presentation until capture completes. Support full app state, animation time
   and asset/environment readiness. Test with a deliberately expensive scene;
   prove no submissions occur between the completion fence and readback. Do not
   change live-app cadence globally. Demand mode is the immediate static recipe.
2. **Use the implemented Dawn route in the next tooling benchmark.** Export the
   same portable scene and compare cold Node, retained Node session and browser
   captures. Verify image parity, shadows/post effects and error handling. This
   benchmark used browser page screenshots and did not measure the new Dawn
   route or new shader-authoring APIs.
3. **Profile remaining cold startup before optimizing.** Timestamp module/worker
   start, asset readiness, pipeline compile, first submission/completion and
   capture. Include warmed repeated frames. Hold scene geometry, materials,
   shadows and AO constant to isolate engine overhead. Current readiness timing
   is too broad to identify the next bottleneck.
4. **Reduce procedural-authoring mistakes.** Provide discoverable roof/arch/path
   recipes and mesh-winding guidance, plus a documented await-presented-frame
   helper. Verify agents can reach a useful preview without searching internal
   diagnostics or fixing basic surface orientation.
5. **Improve remaining visual quality.** Add edge-aware AO denoising and evaluate
   indirect-only AO with MSAA; develop a reusable water/reflection recipe and
   lighting controls. Judge fixed scenes blind again before claiming a quality
   gain beyond the repaired artifact.
6. **Repeat the authoring trial.** Multiple runs, randomized framework order,
   equal capture budgets, and token/tool/wall-time logging. Separate a common
   browser lane from each framework's best native tooling lane. Report time to a
   technically valid image and time to an independently acceptable image.

## Verification

- Targeted post/app unit tests: 153 passing across eight files.
- Native SSAO pixel tests: 6 passing; original-shader negative control: 4 expected
  failures (the two indirect-composition checks already passed).
- Package build, test TypeScript checks, targeted lint and format checks.
- Native browser garden render: passed, 4 submissions, 77 draws, no GPU errors.
- Capture verifier Node regressions: 35 passing.

Evidence: [fixed garden](outlines/fixed/render.png),
[original](../evidence/aperture/framed/render.png),
[AO disabled control](outlines/no-ssao/render.png),
[native proof](outlines/fixed/report.json),
[pixel metrics](outlines/regressions/orthographic-4.json).
