# Low-poly street corner: agent authoring benchmark

Date: 2026-10-17. Exploratory single trial per framework. This measures authoring
quality and effort; it is not a statistically conclusive framework ranking.

## Frozen task

Recreate `reference/street.png` as a real procedural 3D scene. Preserve the
reference's elevated three-quarter view, restrained low-poly style, warm soft
light and compact square diorama. Major landmarks: cream three-storey corner cafe
with striped awning; adjoining sage-green two-storey bookshop; pale sidewalk;
L-shaped asphalt street and zebra crossing; blue and mustard compact cars;
faceted trees, lamps, a bench and a small cafe table/chairs. Keep details modest.
The image controls actual placement/proportions if this shorthand is ambiguous.
Output 1200 × 900, no UI, watermark or image overlay; keep the whole diorama in view.
Simple shop signs are scene elements, not an overlay.

Use only your assigned framework. No reference-image texture/billboard/background,
no generated or stock scene meshes/textures, no image-generation assistance, no
copying another participant or the previous garden benchmark. Procedural meshes,
procedural textures/shaders, framework primitives, docs/examples and ordinary math
helpers are allowed. Procedural text textures for shop signs are allowed.
Aperture uses its current app facade/ECS/worker route. Three.js must use
WebGPURenderer with WebGL fallback disabled. vGPU uses its native APIs, without
rendering through Three.js or Aperture.

## Equal conditions

- Three fresh-context author agents, same inherited model and reasoning, no model
  override and no author subagents. All receive this brief and the same reference.
- 25-minute ceiling per author from dispatch; finish sooner when satisfied.
- At most six captured render attempts, including failed attempts. No extra
  preview route may bypass the capture budget. Static builds and source reads
  do not consume capture attempts, but count toward elapsed author time.
- Same 1200 × 900, DPR 1, Chromium 153 / Playwright Core 1.60 native WebGPU /
  SwiftShader route. Captures serialized; queue wait recorded separately.
- Dependency provisioning, reference generation and harness preparation happen
  centrally before dispatch and are excluded from author times.
- Aperture 0.3.0 current working tree including AO, explicit capture and Dawn
  follow-up; vGPU 0.6.0; Three.js 0.186.1. No engine/library changes during trial.
- Authors may read framework docs/examples/source and their own files. Do not read
  peer author directories, captures, summaries or previous benchmark scene code.
- Authors write only `authors/FRAMEWORK/`. Coordinator owns shared tooling.

## Capture contract

Create `index.html`, `vite.config.mjs` (or .ts), and source in your author directory.
Imports resolve through benchmark/repository node_modules. Use deterministic
random seeds and a fixed camera. Canvas fills the viewport with no scrolling.

**Aperture:** use the generated app via the Vite plugin and `render.cadence:
"demand"`. The capture harness uses the public exact-frame controller at time 0;
you do not need a custom readiness script. Read
`docs/PROCEDURAL_STILL_IMAGES.md` and `docs/VISUAL_QUALITY.md`.

**vGPU and Three.js:** render a still frame, await completed GPU work, then set
`globalThis.__APERTURE_RENDER_STATUS__ = {ok:true}`. The verifier installs
`globalThis.__APERTURE_WAIT_GPU__()` before page code; it may be awaited for GPU
completion. Stop rendering after the intended frame. Signal `{ok:false,error}`
on failure. Do not suppress GPU errors or use a continuous render loop for a still.

From `/workspace/aperture`:

```sh
node benchmarks/street-corner-20261017/shared/capture.mjs FRAMEWORK LABEL
```

Labels are unique lowercase words/digits/hyphens. Capture snapshots source, builds
with repository Vite, and writes PNG, proof, phase timings and logs to
`evidence/FRAMEWORK/LABEL/`. The tool wraps `runVerifiedScene` in the required
runtime-pressure lifecycle wrapper. This is the only browser launch route: no
direct Playwright/browser/WebGL launch. Read the resulting image with `view_image`
before revising. Investigate failures from retained build/capture logs.

## Deliverables

Keep a short `journal.md`: timestamped iterations, discoveries, failures and
workarounds. On completion write a README plus `result.json` containing:
`finishedAt` (UTC ISO), `finalCaptureLabel`, `frameworkVersion`, implemented
objects, known visual gaps, blockers, qualitative effort notes and reproduction
command. Notify the coordinator immediately. Stop editing after completion or the
budget deadline. Coordinator captures after freeze are verification only and do
not improve the judged image.

## Measurement and judging

Retain dispatch, first capture request, first verified image, final image and
completion times; capture/build counts, build/render phases, queue waits and
blockers. Exact tokens and dollar billing are unavailable. Elapsed and attempts
are cost proxies; queue-subtracted time is not measured active work because an
author can keep reading/planning while queued. Shared-host CPU contention remains.

Two independent fresh-context visual judges receive only the reference and
randomized anonymous final images. Score half-point increments from 0 to 10 for
composition (25%), landmark fidelity (25%), low-poly coherence (15%), lighting /
materials (20%) and completeness / artifacts (15%). Record reasons, confidence,
fidelity ranking and separate appeal preference. No code-quality grading.
A third independent judge receives anonymized first/final images and timing /
iteration evidence, assessing useful-first-image time and authoring friction.
Reveal framework identities only after all judge files are saved. Blinding is
procedural on the shared filesystem, and judges are contexts of one model family.

The garden trial is historical context, not a controlled before/after test: the
scene and author samples differ. Aperture's improved capture/AO implementation is
part of this trial's declared baseline. Primary judging uses the common browser
route; any extra Dawn capture is separately labeled verification and excluded
from author time, capture budget and blind scoring.
