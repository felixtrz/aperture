# Render-plan architecture experiment — 2026-10-14

The prototype was implemented and measured, but it did **not** pass the predeclared performance acceptance gate. Do not promote it as a speed rewrite or claim a meaningful lead over Three.js. The earlier shader specialization removes most of the original slowdown; the added planning, explicit layouts, uniform transport and facing shortcut did not establish another gain.

## Scope and design

The main thread derives one typed render plan from extracted snapshot facts. Its feature selection, light ABI, binding schema, pipeline layout and frame resources share that plan. The worker/extraction boundary remains intact. Device-owned explicit layouts have bounded admission and a general fallback. Numeric light updates retain buffer-version behavior; structural changes select matching variants. Transmission declares a scene-color producer and consumes its actual texture before HDR scene draws.

The retained code is a research implementation. Small-light uniforms remain disabled. The losing shadow-facing shortcut was removed from live composition; its source and measurements are preserved. Pure plan caching remains in the prototype, without a performance benefit claim. See [design](../../docs/RENDER_PLAN.md) and [decision 0024](../../docs/DECISIONS.md).

## Controlled measurements

These are causal diagnostics of an existing controlled workload, not new independent author rounds. They do not reuse a concept image to score a new author round. Future author rounds still require a different feasible low-poly reference image for each round.

Both engines use **WebGPU**. This environment exposes **SwiftShader software WebGPU**, not a physical GPU. “Queue” is elapsed queue-completion latency measured with a fence, not a hardware GPU timestamp. CPU submission and end-to-end latency are retained separately.

Each comparison ran five variants serially in one order and then in reverse, with fresh native runs, five warmup frames, twelve measured frames and three diagnostic views per run. Other agents and root builds were quiet during timed windows. The scene, geometry, camera, resolution (1024×768, DPR 1), ACES exposure 1, 4× MSAA and public shadow recipe were fixed. There is no IBL, bloom or SSAO. Static shadows are reused. Aperture has 12 steady draws and Three.js 13, each with two passes and 25,725 triangles. The engines retain their own PCF algorithms; this is not an identical-kernel comparison.

The gate was declared before rendering: at least 10% lower median queue time than the prior owner-specialized Aperture in **both** orders, improvement greater than reference drift, and no median end-to-end regression. No candidate passed. A comparison window is evaluated against its own contemporaneous reference; medians from different windows are not pooled.

### Initial plan and uniform transport

All values below are per-run medians in milliseconds. Each cell lists first / reverse order.

| Variant                |             Queue | CPU submission |        End to end |
| ---------------------- | ----------------: | -------------: | ----------------: |
| three-baseline         |   239.93 / 234.60 |    1.39 / 1.47 |   241.32 / 236.16 |
| aperture-original      | 1607.54 / 1795.16 |  14.14 / 14.88 | 1623.41 / 1810.16 |
| aperture-owner-v4      |   242.08 / 249.79 |  15.81 / 15.99 |   257.89 / 263.33 |
| aperture-typed-storage |   246.68 / 247.00 |  19.87 / 21.46 |   269.48 / 269.01 |
| aperture-small-uniform |   258.64 / 309.74 |  22.10 / 21.93 |   281.87 / 330.81 |

Plan SHA-256: `b995bec8c5208692cff3d372d7336020f1c9ababd1822abe31915e78013eb82d`.

### Cached plan and facing shortcut

All values below are per-run medians in milliseconds. Each cell lists first / reverse order.

| Variant                |             Queue | CPU submission |        End to end |
| ---------------------- | ----------------: | -------------: | ----------------: |
| three-baseline         |   270.17 / 244.80 |    1.44 / 1.34 |   272.01 / 246.33 |
| aperture-original      | 1663.10 / 1494.70 |  15.15 / 14.65 | 1678.40 / 1509.35 |
| aperture-owner-v4      |   275.16 / 261.52 |  16.26 / 16.16 |   291.45 / 278.90 |
| aperture-typed-storage |   273.03 / 303.57 |  20.82 / 22.01 |   296.50 / 327.26 |
| aperture-facing-shadow |   278.65 / 268.10 |  20.16 / 20.82 |   298.41 / 288.96 |

Plan SHA-256: `b029a803151d9f0dbd427891434dfdffbc1caecdc5d262e1877881019d99590f`.

Across both comparisons, all twenty native children closed successfully, with no reported validation errors or device loss. Candidate rasters exactly matched the retained Aperture reference and corresponding Aperture comparisons. This does **not** assert pixel equality between Aperture and Three.js. Independent review checked actual submitted pipelines, whole shader sources, native resource/buffer ranges, artifact receipts and source pins. Steady measured frames created no new GPU resources.

The original Aperture queue time was about 1.5–1.8 seconds; owner specialization reduced it to roughly 0.24–0.28 seconds. The shared-plan candidates did not improve on that specialization. The uniform candidate regressed in both orders. After CPU plan caching, storage queue time changed by +0.8% / −16.1% relative to owner (positive means faster), and the facing candidate by −1.3% / −2.5%; all end-to-end gates failed.

## Disposition

Keep this as a measured research candidate. Review transmission correctness separately. Further performance work should begin with physical-GPU profiling of the existing specialized path and its remaining CPU submission overhead; these software results do not justify a wholesale renderer replacement. No Three.js superiority claim, physical-GPU claim or accepted production-adoption decision is made.

## Repository validation and evidence

The final source completed `pnpm run check` through all pre-test checks. Vitest
reported 5,345 passing tests and four CLI browser-rendering failures because
`/opt/google/chrome/chrome` is unavailable. No alternate browser was installed.
This is an explicitly incomplete full-suite result, not an all-green check.

The [evidence manifest](evidence/manifest.json) retains 139,014 original file
identities as 7,250 deduplicated raw payloads in three verified gzip archives
(total 47,851,852 bytes). All source/build failures and native attempts remain.
See the [readable summary](evidence/summary.json),
[reconstruction instructions](evidence/RECONSTRUCTION.md) and
[exact freeze](freezes/architecture-comparisons.json). Safety and validation
closures are separate addenda. The [acceptance goal](GOAL.md) records the later
Three.js advantage criterion and the user-confirmed physical-GPU blocker.

### Final native correctness closure

The [validation addendum](validation/RECONSTRUCTION.md) retains 17,430 regular
file identities as 2,145 verified payloads in six archives. It includes the
unattempted safety007 preparation and the failed safety008 verifier attempt.
That verifier incorrectly required every transmission consumer to have a direct
positive draw; the actual pass had nine indirect consumers and one direct
consumer. Safety009 corrected the witness without changing renderer source.

All four safety009 native runs closed successfully. The two full runs each
covered 43 states, 94 worker frames and 50 images. All 50 paired images and both
canonical restorations matched exactly, with no native validation errors or
device loss. Independent review checked 173,530 current light-buffer words per
full mode, actual binding and transmission resource joins, and worker disposal.
The general and storage modes disposed 2,063/2,063 and 2,079/2,079 buffers,
respectively, and 37/37 textures each, leaving zero live buffer bytes.

See the [native summary](validation/native-summary.json),
[independent review](validation/native-independent-review.json) and
[repository check outcome](validation/full-check-outcome.json). These establish
correctness on software WebGPU. They do not establish hardware speed, per-fragment
shader invocation counts, or indirect transmission draw counts.
