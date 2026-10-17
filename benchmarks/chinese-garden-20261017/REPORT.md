# Chinese garden: Aperture, vGPU and Three.js

**Aperture matched the reference best; Three.js was the appeal favorite and finished fastest; vGPU produced the earliest useful preview.** Those are findings from this single trial, with small score differences, rather than a general framework ranking.

The result supports the concern about Aperture's visual workflow: its composition and architecture were competitive, while its water, material contrast and initial capture turnaround lagged. It does not establish a limitation of Aperture's shader compiler or GPU abstraction: its author used standard materials and mesh wavelets, without exercising the new shader-authoring route.

[Open the private hosted comparison gallery](https://garden-framework-comparison-20261016.felixtrz.chatgpt.site) to switch all three scenes between their first verified and final images. [Reference image](reference/garden.png) · [Frozen protocol](PROTOCOL.md).

## Results

Two independent blind judges scored the final images against the reference. Weights were composition 25%, landmarks 25%, low-poly coherence 15%, lighting/materials 20% and finish 15%. Appeal was ranked separately. Code quality was not graded.

| Framework / final image                         | Weighted visual score / 10 | First verified image | Final image available | Author finished | Captures passed |
| ----------------------------------------------- | -------------------------: | -------------------: | --------------------: | --------------: | --------------: |
| [Aperture](evidence/aperture/framed/render.png) |                   **7.26** |               5m 58s |               13m 40s |         14m 27s |       **6 / 6** |
| [vGPU](evidence/vgpu/final-06/render.png)       |                       6.75 |           **3m 22s** |               13m 04s |         13m 35s |           5 / 6 |
| [Three.js](evidence/three/final/render.png)     |                       6.91 |               3m 39s |           **11m 40s** |     **12m 30s** |           5 / 6 |

Times run from each author's dispatch. Completion includes documentation after the final capture. First verified means technical success, which can include visible geometry mistakes. These are elapsed-time and attempt-count proxies for cost; actual tokens, billing and active work time were unavailable.

| Average dimension / 10             |  Aperture |  vGPU | Three.js |
| ---------------------------------- | --------: | ----: | -------: |
| Composition                        |  **7.75** |  6.50 |     6.50 |
| Landmarks                          |  **7.75** |  6.75 |     6.75 |
| Low-poly coherence                 |  **7.25** |  7.00 |     6.50 |
| Lighting / materials               |      6.25 |  6.50 | **7.50** |
| Finish                             |      7.00 |  7.25 | **7.50** |
| Fidelity judge weighted total      | **7.225** | 6.600 |    6.850 |
| Art-direction judge weighted total | **7.300** | 6.900 |    6.975 |

Both visual judges ranked reference fidelity **Aperture → Three.js → vGPU**, and subjective appeal **Three.js → Aperture → vGPU**. The independent effort reviewer put vGPU and Three.js together on final visual finish, with Three.js narrowly leading quality versus elapsed time. This disagreement is useful: fidelity, finish and speed produce different preferences. Decimal totals are arithmetic, not evidence of equivalent perceptual precision.

The anonymous mapping was A = vGPU, B = Three.js, C = Aperture. Raw reviews: [fidelity](judging/fidelity.json), [art direction](judging/art-direction.json), [authoring effort](judging/effort-review.json). [Calculated assessment](judging/assessment.json).

## What the images show

**Aperture:** the bridge's orientation and slender curve, visible moon-gate opening, pavilion furnishings and ornamental rails best preserved the target's relationships. Its pond remained comparatively opaque and flat, with visible radial divisions and no reflections of the surrounding scene. Pale materials and unsettled fine edges weakened the finish. Judges also noted an oversized left pine and a steeper roof than the reference.

**vGPU:** a useful, coherent first preview developed into a reflective pond with custom lighting, shadows and contact occlusion. Its final camera exposed more of the rear wall corner, foreshortened the gate and changed the bridge relationship. Heavy bridge rails, dense roof ribs and the continuous front hedge moved it away from the target. It demonstrated that native shader/pass APIs can reach a complete illustration within this budget, despite requiring substantial custom rendering work.

**Three.js:** reflected water, material separation and contact shadows made the most inviting final image to both visual judges. It also finished 1m 57s before Aperture. A smaller pond, chunky bridge, rounded foliage and large pale boulders reduced fidelity. The first preview had missing roof faces, so its early technical success did not imply a visually complete scene.

All three captured the landmark set. None reached the reference's warm light, irregular planting, broad pond, shallow roof and sculptural perforated rocks. These remaining modeling and composition differences should not be attributed automatically to renderer capability.

## Where the time went

| Recorded measure                                                | Aperture |    vGPU | Three.js |
| --------------------------------------------------------------- | -------: | ------: | -------: |
| Shared capture-queue wait                                       |     0.0s |   79.5s |    81.7s |
| Elapsed minus queue, arithmetic only                            |  14m 27s | 12m 16s |  11m 09s |
| Capture builds, accumulated                                     |     7.7s |    2.7s |     4.4s |
| Capture launch/readiness/render/screenshot/cleanup, accumulated |   202.5s |   22.9s |    27.7s |
| Final capture lifecycle including build, excluding queue        |     8.2s |    5.6s |     6.0s |

Queue-subtracted elapsed is **not measured active work**: vGPU and Three.js authors reported useful API reading or planning while queued. The long Aperture captures held the shared slot, so the other authors' queue durations must not be presented as their rendering latency. Capture lifecycle times are also not frame times or GPU throughput. Common provisioning, reference generation and judging are excluded from author times.

Aperture's first two capture lifecycles took approximately 81 and 89 seconds. After the author discovered existing `render.cadence: "demand"`, later captures took 8–12 seconds. Geometry and configuration changed at the same time; this is a strong workflow lead to investigate, not a controlled speedup measurement. Even after that change, its first useful feedback had already arrived substantially later.

The [effort reviewer](judging/effort-review.json) found vGPU's first image most useful: it was both earliest and already had a solid roof and readable pond. Aperture and Three.js first captures were useful diagnostic previews but contained obvious surface defects. A screenshot passing verification is insufficient as a visual acceptance test.

## Author errors and framework friction

| Framework | Author-controlled corrections                                                          | Framework / integration work                                                                                                                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aperture  | Roof/land/wall-cap winding; coplanar water and foundation; framing, plants and palette | Generated-app completion signaling required diagnostics plus the GPU completion hook. Discovering demand cadence materially changed observed turnaround. No failed capture or reported engine blocker.                                                                                                  |
| vGPU      | Initial winding/normals; shader variable named the reserved word `patch`; composition  | Native scene utilities did not supply the complete material/light/shadow renderer for this task, so the author built WGSL lighting, shadow, reflection and post passes. Precise shader diagnostics helped fix the name. A resolved color attachment carried depth after an MSAA depth-lifetime problem. |
| Three.js  | Triangle winding/sidedness hid roof, caps and paving                                   | Disabled automatic WebGL fallback; adapted to a removed shadow-filter option. AO with multisampled depth produced invalid WGSL and failed capture 3. A non-MSAA scene pass plus FXAA resolved it.                                                                                                       |

All authors made winding corrections. That shared pattern argues for better geometry inspection and recipes; it is not evidence that all three renderers failed. Likewise, Aperture's zero failed captures is useful, but does not erase long successful captures or visual mistakes.

## Recommended Aperture work

Preserve the full app, ECS and worker route used here. Improve how quickly an agent reaches a good still image through that route, then test whether those changes improve repeat trials.

| Priority | Concrete change                                                                                                                                                                                                                    | Evidence and acceptance check                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Ship a documented static-scene recipe using existing demand cadence, a fixed seed/camera and a supported capture-ready signal. Instrument startup, snapshot arrival, resource readiness, GPU completion and screenshot separately. | The author had to inspect generated diagnostics and discovered demand cadence late. Run identical geometry under continuous and demand cadence, with repeated cold captures; check no blank or premature captures and preserve normal animated-app behavior.           |
| 2        | Provide an app-compatible water/reflection recipe with a known-working lighting, AO and antialiasing combination. Show how to customize it with the shader/material facilities.                                                    | The pond is a large part of this target, and Aperture scored lowest on lighting/materials. Validate reflected scene geometry, warm material separation and MSAA/depth behavior through the app route. Rejudge the same scene with geometry/camera fixed.               |
| 3        | Make procedural-mesh inspection and correction cheap: front-face/normal views, overlap/depth checks, and an early solid-surface preview checklist. Build on existing camera-framing tools.                                         | All three authors repaired winding; Aperture also repaired coplanarity. Give fresh agents deliberately reversed roof faces and a water/slab overlap; measure diagnosis and correction time, with actionable diagnostics rather than silent repairs.                    |
| 4        | Add small, composable diorama examples for faceted canopies, curved roofs, bridge railings, stone variation and coherent lighting. Keep them editable as ordinary scene parts.                                                     | Most remaining gaps were shape, palette and composition choices. Test on new references so improvement is not just memorizing this garden.                                                                                                                             |
| 5        | Extend the benchmark to repeated, randomized scenes and measured authoring cost where tooling exposes it.                                                                                                                          | One agent per framework cannot separate model familiarity, scene choices and API ergonomics. Record useful-preview acceptance, final blind scores, failures, elapsed time and available token usage; include both quality-at-fixed-budget and time-to-quality targets. |

Several foundations already exist. `mesh.triangleList` and `mesh.extrude({ holes })` were useful in this trial; do not implement them again. Aperture already has standard PBR, environment lighting, shadows, bloom/SSAO, `spawn.lightRig`, camera framing, and a renderer-level SSR effect. The reflection task should first make the appropriate existing capability usable through the generated-app workflow and supply a tested recipe; it should not assume that all reflection support is absent. A planar-water recipe may be preferable for this target, but that choice needs validation.

Relevant existing docs: [visual quality](../../docs/VISUAL_QUALITY.md), [authoring](../../docs/AUTHORING.md), [post effects](../../docs/POST_EFFECTS.md), [shader materials](../../docs/SHADER_MATERIALS.md), [shader-first workflows](../../docs/SHADER_FIRST.md). These recommendations are follow-up work, not changes silently applied during the trial.

The next shader-specific experiment should hold geometry and camera constant while agents implement water, procedural surface detail and a custom post effect. That would isolate shader authoring better than this combined modeling exercise. vGPU's explicit pass/binding workflow and early WGSL diagnostics are worth comparing directly; Three.js shows the benefit of reusable visual effects and the risk of incompatible combinations.

## Verification and reproduction

All final captures and all post-trial rerenders passed the approved native WebGPU verifier on Chromium **153.0.8010.0 / SwiftShader**, at 1200×900, DPR 1. They recorded zero WebGL attempts, GPU errors or device loss. “Native WebGPU” here means the browser's WebGPU API backed by software Vulkan; it does not mean native Node rendering or a physical GPU.

Post-trial rerenders rebuilt the retained source without edits. Aperture and vGPU reproduced byte-identical PNGs. Three.js varied slightly, with mean absolute RGB channel differences of 0.134, 0.132 and 0.127 on the 0–255 scale. Its denoiser initializes random noise, a plausible source that was not isolated experimentally. Original trial images were used for judging. [Reproducibility evidence](evidence/reproducibility.json).

All final author sources matched their capture snapshots, and the 1,237 files in the engine/package baseline manifest remained unchanged. [Source integrity](evidence/source-integrity.json). The coordinator's initial rerun-script environment error and its correction are recorded separately in [coordinator notes](evidence/coordinator-notes.md); they did not affect author timing or failure counts.

Versions: Aperture 0.3.0 working tree including the completed Dawn/shader implementation, based on `8b8275b82c23ddd61690fe975e45b3f10842408b`; vGPU 0.6.0; Three.js 0.186.1; Node 24.19.0; Playwright Core 1.60.0. See [run metadata](evidence/run.json), [baseline hashes](evidence/framework-snapshot.json) and [dependency lock](package-lock.json). vGPU is an isolated benchmark dependency; it was not added to Aperture's engine.

In this prepared repository/runtime, run from `/workspace/aperture`:

```sh
node benchmarks/chinese-garden-20261017/shared/reproduce.mjs aperture
node benchmarks/chinese-garden-20261017/shared/reproduce.mjs vgpu
node benchmarks/chinese-garden-20261017/shared/reproduce.mjs three
```

Run those sequentially. Each writes new evidence under `evidence/reproductions/`, uses the approved runtime-pressure wrapper and verifier, and leaves the six-attempt trial untouched. The author READMEs describe the original allocation; use these coordinator reproduction commands after that allocation is exhausted. A different checkout requires rebuilding Aperture and provisioning the approved runtime first, as described in [cloud rendering](../../docs/CLOUD_LOCAL_RENDERING.md).

To rebuild the derived score table and gallery without changing the frozen mapping:

```sh
node benchmarks/chinese-garden-20261017/shared/assess.mjs
node benchmarks/chinese-garden-20261017/shared/build-gallery.mjs
```

## Limits of this comparison

This was one fresh-context author per framework, with the same inherited model/reasoning, reference and brief, a 25-minute ceiling and six capture attempts. All finished early after exhausting that capture allowance. Framework abstraction levels differ: a full app facade, native GPU APIs and a mature scene renderer require different work. That is relevant to the user experience, but confounds claims about any individual subsystem.

Authors had local docs/source and could use framework examples. Familiarity, documentation coverage, simultaneous CPU use and model variability were not controlled away. The two visual judges were independent contexts of the same model family, not independent human raters. Blinding was procedural on a shared filesystem. The generated reference was 1448×1086; reconstructions were uniformly 1200×900, limiting fine-detail comparisons. The effort review saw first/final images, not every intermediate frame.

This trial measured a shared browser route. It does **not** measure Aperture's Dawn-backed Node path, development-server/HMR latency, interactive app development, animation, real-time frame rate, memory, or shader-only authoring. A separate identical-scene Node-versus-browser capture experiment is needed before claiming a tooling advantage there.
