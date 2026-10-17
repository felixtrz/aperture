# Chinese garden authoring comparison

Date: 2026-10-17. This is an exploratory, one-trial-per-framework agent benchmark,
not a statistically conclusive ranking or a GPU performance benchmark.

## Frozen task

Recreate `reference/garden.png` as a real procedural 3D scene. Match the elevated
three-quarter view, square diorama, restrained faceted style, warm soft lighting,
pavilion in the back-left, jade pond, stone bridge, open circular moon gate,
plaster walls, pines, bamboo, scholar rocks, shrubs and lotus pads. Prioritize the
composition and major forms before tiny detail. Output is 1200 × 900 with no UI,
labels, frame, watermark, or image overlay. Keep all elements comfortably in view.

Use only the assigned rendering framework. The reference must not appear as a
texture, background or billboard. No generated/stock scene meshes or textures,
no image-generation assistance, and no copying another participant's scene.
Procedural geometry, procedural shaders, framework primitives, examples and docs
are allowed. Ordinary math helpers are allowed. vGPU may use its native scene/GPU
APIs but must not route rendering through Three.js or Aperture. Three.js must use
WebGPURenderer. Aperture uses its current app facade, ECS and worker defaults.

## Equal conditions

- Three fresh-context author agents, same inherited model and reasoning setting;
  no model override, no author subagents, same image and brief.
- 25 minutes maximum per author, starting at dispatch. Finish sooner when done.
- Up to six captured render attempts per author, including failed attempts.
- Same Chromium 153 / Playwright Core 1.60 approved WebGPU SwiftShader route,
  resolution, machine and capture harness. GPU captures are serialized, and
  queue wait is recorded separately. Normal preparation and package installation
  are performed centrally before dispatch and excluded from author times.
- Aperture: current working-tree implementation over commit recorded in
  `evidence/framework-snapshot.json`; no engine fixes during the trial.
- vGPU 0.6.0; Three.js 0.186.1. Dependency versions are locked in package-lock.json.
- Authors write only their own `authors/<framework>/` directory. Shared harness
  changes are coordinator-owned and must be recorded if needed.

## Rendering and deliverables

Create `index.html`, `vite.config.mjs` (or .ts), and scene source in your directory.
Imports resolve through the benchmark or repository node_modules. The shared
capture tool builds the app with the repository Vite. Set
`globalThis.__APERTURE_RENDER_STATUS__ = { ok: true }` only after a real rendered
frame, completed GPU work, and scene initialization. Set `{ok:false,error}` on
failure; do not suppress actual errors. Browser viewport/device DPR is 1200×900/1.
Canvas fills viewport; no scrolling. Use deterministic seeds and a fixed camera.

Capture, from /workspace/aperture:

```sh
node benchmarks/chinese-garden-20261017/shared/capture.mjs FRAMEWORK LABEL
```

The tool is the only browser-launch route. It wraps `runVerifiedScene` in the
existing runtime-pressure lifecycle wrapper. Do not launch Playwright, a browser,
WebGL, or another renderer directly. You may read AGENTS.md and
`docs/CLOUD_LOCAL_RENDERING.md` for details. Use `view_image` on your screenshots
before revising. Do not inspect peer directories or results.

Keep a concise `journal.md` with discoveries, failures, workarounds and iterations.
At completion write `result.json` with `finishedAt` (UTC ISO), final capture label,
framework version, main objects implemented, known gaps, blockers, estimated
active reasoning/build/debug tasks (qualitative only), and reproduction command.
Write a short README. Notify the coordinator immediately when finished.
Do not continue polishing after declaring completion or exceeding the budget.

## Measures and judging

Author elapsed time, first verified render time, final capture time, build/render
attempts, infrastructure queue time and reported blockers are retained. These are
cost/effort proxies: exact tokens, model billing and dollar cost are unavailable.
Wall-clock includes tool latency, and concurrent agents can share CPU contention.
Common setup is excluded explicitly. We do not grade code quality.

Two independent fresh-context visual judges receive only the reference and
randomized anonymous final images. They score the same 0–10 dimensions:
reference composition (25%), landmark fidelity (25%), low-poly coherence (15%),
lighting/materials (20%), completeness/artifacts (15%). One emphasizes fidelity,
one art direction. They report confidence and concrete visible reasons, plus a
separate appeal preference. They do not see timing or framework identities.
A third independent judge receives anonymized timing/iteration/blocker evidence
and assesses authoring friction and time-to-usable-output without grading code.
Framework identities are revealed only after judge files are saved. Scores and
judge disagreements remain visible; no single trial establishes general superiority.
