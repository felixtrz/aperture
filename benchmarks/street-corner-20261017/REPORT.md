# Low-poly street corner: Aperture, vGPU and Three.js

17 October 2026. [Open the image gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site/street-corner/).

Three.js delivered the strongest observed combination of useful first image,
final appeal and elapsed time in this trial. Aperture remained close in visual
score, and one judge preferred its reference fidelity, but took more time and
used all six capture attempts. vGPU finished essentially tied with Three.js and
produced a pleasing, simpler shader-driven result with weaker reference fidelity.

This is one author per framework, not a general framework ranking. The 0.23-point
gap between Three.js and Aperture is small relative to subjective judge variation.
Both judges nevertheless independently preferred Three.js for visual appeal.

## Results

| Framework | Blind visual score / 10 | First capture requested | First verified image | Final image available | Author finished | Attempts / failures |
|---|---:|---:|---:|---:|---:|---:|
| Aperture | 7.93 | 4:31 | 7:45 | 15:18 | 16:19 | 6 / 1 |
| vGPU | 7.60 | 4:42 | 8:04 | 12:32 | 13:37 | 5 / 2 |
| Three.js | 8.15 | 4:19 | 5:31 | 12:34 | 13:30 | 5 / 2 |

Times run from each author's dispatch. Completion includes the final inspection,
journal and reproduction notes; it is distinct from the PNG becoming available.
The independent effort reviewer considered all first successful images useful
for composition review, while Three.js's first image also conveyed the intended
palette and presentation most convincingly.

| Framework | Shared capture queue | First verified image, subtracting queue | Completion, subtracting queue | Capture-managed builds, total | Capture lifecycle, total |
|---|---:|---:|---:|---:|---:|
| Aperture | <0.01 s | 7:45 | 16:19 | 8.06 s | 160.58 s |
| vGPU | 76.69 s | 6:48 | 12:21 | 1.55 s | 15.85 s |
| Three.js | 67.19 s | 4:24 | 12:23 | 3.05 s | 25.88 s |

Queue-subtracted time is descriptive, **not measured active labor**: authors could
read or plan while waiting. Capture lifecycle includes launch, readiness, render,
screenshot and cleanup, not just GPU work. Standalone builds are included in
author elapsed time but not the capture-managed build totals. Exact token counts
and dollar billing are unavailable; time and attempts are cost proxies only.

[Raw timing evidence](evidence/summary.json) · [Frozen protocol](PROTOCOL.md) ·
[Run configuration](evidence/run.json)

## What was compared

All authors received the same [reference image](reference/street.png): a cream
three-storey cafe, sage bookshop, striped awnings, L-shaped street and crossing,
two compact cars, faceted trees, lamps and modest sidewalk furniture. Major forms
and layout took precedence over tiny interior details. The reference was created
once centrally; authors reconstructed real procedural 3D scenes without generated
assets, stock scene meshes, reference-image billboards or peer scene code.

Three fresh-context agents inherited the same model/reasoning settings, each with
a 25-minute ceiling and six capture attempts including failures. Dependencies and
the harness were prepared centrally. Authors could consult framework docs and
source, but could not inspect peer or prior garden implementations. All finished
before the deadline. The ceiling included queue waits, which disadvantaged the
two queued authors; no author reached the time ceiling.

Versions: Aperture 0.3.0 current working tree, including the prior AO/capture/Dawn
work; vGPU 0.6.0; Three.js 0.186.1. All primary captures used the approved common
Chromium 153.0.8010.0 native WebGPU / SwiftShader route, 1200 × 900, DPR 1. Captures
were serialized. No WebGL fallback was allowed.

- Aperture used its public app facade, ECS systems, generated worker application,
  standard materials, custom mesh helpers and explicit frame capture at time zero.
- vGPU used native resources/passes and authored WGSL shaders: a sun-depth pass,
  diffuse/fill lighting with filtered shadows, and procedural text signs. It did
  not use Aperture or Three.js as its renderer.
- Three.js used WebGPURenderer, procedural meshes, PBR materials, shadows and
  node-based GTAO/denoising, with automatic WebGL fallback disabled.

These are task-level authoring comparisons. Shaders, geometry organization and
effect choices differ, so render times do not isolate engine efficiency.

## Independent visual findings

Two fresh-context visual judges saw only the reference and randomized anonymous
final images. A third reviewed anonymous first/final pairs and timing/friction
evidence. They saved reviews before identities were revealed. Mapping: A was
Aperture, B Three.js, C vGPU. Code quality was not graded.

| Framework | Composition | Landmarks | Low-poly style | Lighting/materials | Finish | Judge weighted totals |
|---|---:|---:|---:|---:|---:|---:|
| Aperture | 7.75 | 8.25 | 8.50 | 7.25 | 8.00 | 7.85 / 8.00 |
| vGPU | 7.00 | 7.75 | 8.25 | 7.75 | 7.50 | 7.33 / 7.88 |
| Three.js | 7.75 | 8.50 | 8.25 | 8.25 | 8.00 | 7.68 / 8.63 |

Scores average the two judges. Weights: composition 25%, landmarks 25%, low-poly
style 15%, lighting/materials 20%, finish 15%. Rankings were recorded separately
from the weighted score.

**Aperture:** strong landmark coverage, consistent faceting, and relatively
faithful cafe seating/lamp placement. The fidelity-focused judge ranked it first,
narrowly ahead of Three.js. Both reviews found its lighting/storefront treatment
flatter, its bookshop frontage compressed, and its cafe lettering less polished.
Its first valid image was very pale; much of the later visual gain repaired color
handling, orientation and readability rather than adding missing landmarks.

**Three.js:** both judges' first choice for appeal; stronger shading, legible
storefronts and a more finished presentation. One judge ranked it first for
fidelity, while the other penalized its rotated camera, relocated cafe seating
and lamp overlap. Its first image was already useful for appearance decisions,
even before the later faceted-tree and contact-shading work.

**vGPU:** warm, coherent and appealing, with efficient visible improvement after
its first successful capture. Both judges ranked it second for appeal but third
for fidelity: excessive roof emphasis, small signs, simplified upper bookstore
windows and a few thin marks projecting beyond the right building edge.

Both visual judges' appeal order was **Three.js → vGPU → Aperture**. Their fidelity
orders disagreed on Aperture versus Three.js. The effort reviewer favored Three.js,
then vGPU, then Aperture for observed payoff versus elapsed time, while explicitly
noting that the latter two depend on how much extra detail is valued.

[Visual assessment](judging/assessment.json) · [Fidelity review](judging/fidelity.json) ·
[Art-direction review](judging/art-direction.json) · [Effort review](judging/effort-review.json)

## Why Aperture took longer here

The authors requested their first captures within a 23-second band: 4:19–4:42.
Initial scene construction time was therefore similar in this sample. The delay
emerged in getting valid feedback and refining the result.

1. **One error took unusually long to return.** Aperture correctly rejected
   zero-area triangles in the author's foliage mesh, with an actionable error.
   That failed capture nevertheless occupied 122.36 seconds of lifecycle time.
   The capture/release path needs investigation so a known fatal worker error
   rejects promptly. This delay is large relative to Aperture's 2:49 completion
   gap versus Three.js, but removing it has not been tested as a counterfactual.
2. **The first image needed broad correctness fixes.** The author converted
   display-space hex colors to linear material values, corrected mirrored
   lettering and car transforms, then revised framing, lighting and foliage.
   Aperture used five successful captures, versus three for each peer.
3. **Successful feedback cycles were also slower.** Aperture's successful capture
   lifecycles were 6.98–8.16 seconds; vGPU's were 3.27–4.28 seconds and Three.js's
   3.78–5.42 seconds. This compounds iteration cost, though it is much smaller
   than the long failure and the minutes spent revising.
4. **The final frame still does substantial GPU work.** Aperture's explicit-frame
   timings report 0.259 s selection/idle, 0.486 s CPU render and 5.223 s GPU
   completion wait. The wait is a wall-clock fence measurement on software
   rendering, not a GPU timestamp. Profile the shading and shadow workload before
   assuming the remaining cost comes from Node/browser startup or ECS extraction.

The final capture proof observed 1,567 draw calls for Aperture, 3 for vGPU and
2,691 for Three.js. vGPU batched the scene into a small number of custom passes;
the others used many individual objects and richer rendering paths. Draw count
alone does not explain timing: Three.js had more observed draws than Aperture and
still completed its capture faster. These counters are for the verified capture
session, not normalized cross-framework per-frame throughput.

The other frameworks also had friction. vGPU lost two attempts to shader-artifact
preparation and shader/geometry input matching; those failures returned in about
2.2 and 2.1 seconds after queue access. Three.js lost two later attempts to
multisampled-depth GTAO and a depth read/write conflict while integrating denoise;
those returned in about 4.0 and 7.3 seconds. Fast, specific failure feedback is a
valuable authoring feature independently of successful rendering speed.

Failure evidence: [Aperture mesh](evidence/aperture/first/report.json),
[vGPU preparation](evidence/vgpu/first/report.json),
[vGPU attributes](evidence/vgpu/prepared/report.json),
[Three.js AO](evidence/three/refined/report.json),
[Three.js denoise](evidence/three/final/report.json).

## AO and the new shader/Dawn work

This trial includes the current AO silhouette fix. Neither visual judge identified
the previous pervasive outline appearance as a dominant issue in this final
image; flatter lighting and storefronts were the stronger criticisms. This is
not a controlled AO on/off test and does not prove that every AO case is fixed.

Aperture used the new mesh helpers and explicit-frame capture workflow. It used
standard materials rather than authoring a custom WGSL material, so this trial
does not directly test the new shader-authoring experience. vGPU did author WGSL;
its small custom rendering pipeline is useful inspiration for an optional simple
lit authoring recipe, not evidence that Aperture should abandon its app model.

After freezing the trial, the coordinator exported the same Aperture systems to a
strict portable bundle and rendered it through **Node + Dawn**, using the direct
`webgpu@0.6.2` binding and SwiftShader/Vulkan. **The pixels matched the judged
browser image exactly.** No vGPU dependency or scene rewrite was introduced.

That one supplementary run took 1.29 s for extraction and 8.07 s for the render
command, including its lifecycle. Its renderer reported 5.60 s at the GPU fence.
This verifies compatibility; it is not a repeated cold/warm performance experiment
or an author-productivity comparison. It is excluded from trial time, capture
budgets and judging.

[Dawn compatibility summary](evidence/dawn-verification/summary.json) ·
[Dawn diagnostics](evidence/dawn-verification/render.json)

## Validation and reproduction

- All three frozen sources rebuilt and passed native browser WebGPU verification
  with zero WebGL attempts, GPU errors or device loss.
- Each reproduced PNG was byte-identical to its judged final PNG.
- The integrity audit found no changes among 6,171 engine/documentation/package
  baseline files or 3,276 dependency files. Current author implementation files
  matched their retained final capture snapshots.
- The additional Aperture Node/Dawn image was pixel-identical to its browser
  image. Bundle export used strict asset closure.

[Reproduction evidence](evidence/reproducibility.json) ·
[Source integrity](evidence/source-integrity.json)

From `/workspace/aperture`, with the provisioned runtime and pinned dependencies:

```sh
node benchmarks/street-corner-20261017/shared/reproduce.mjs aperture
node benchmarks/street-corner-20261017/shared/reproduce.mjs vgpu
node benchmarks/street-corner-20261017/shared/reproduce.mjs three
node benchmarks/street-corner-20261017/shared/compare-reproductions.mjs
```

The reproduction command preserves author-trial captures and uses the required
runtime-pressure wrapper and verifier. Do not re-run `summarize.mjs` to reshuffle
the anonymous mapping; it deliberately refuses after the mapping is frozen.
`verify-dawn.mjs` preserves its first validation directory and likewise refuses
silent overwrite. The gallery provides final source archives and author journals.

## What to improve next

The practical priority is **better feedback and first-image correctness**:
fail promptly on invalid scenes, make display-color conversion obvious, provide
a reliable lighting/shadow recipe, and make signs, local transforms and faceted
foliage easier to author. Then profile rendering with identical scene settings,
including retained Dawn sessions, before claiming speed gains.

The [follow-up implementation plan](FOLLOW_UP_PLAN.md) includes acceptance checks
for each change and a repeated-author experiment. These follow-ups are proposed;
this benchmark did not modify the engine.

## Limits

One scene and one author per framework cannot establish general superiority.
Judges are independent contexts from one model family, and filesystem blinding
was procedural rather than an access-control boundary. The scores are subjective,
the reference contains richer fine detail than the requested simplification, and
only one camera view was judged. Library familiarity and author choices remain
confounders. Shared-host CPU contention remains despite serialized captures.

The garden trial is historical context, not a controlled before/after test: both
the scene and author samples changed, and Aperture's baseline now includes the
earlier fixes. The common browser route tests app-oriented authoring; the separate
Dawn check does not measure agent productivity through a native-only workflow.
Full-app behavior, animation, editing, hardware GPUs and code quality were outside
this trial. Gallery assets and interaction logic are validated locally; no
connected browser was available for an authenticated visual inspection of the
hosted page.
