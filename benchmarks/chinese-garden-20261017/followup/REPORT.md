# Garden follow-up: reliable captures and measured startup costs

Completed 2026-10-17. This follows the [AO/timing diagnosis](../diagnostics/REPORT.md).
The original three-agent trial and independent judging remain unchanged.

## Implemented

- Public generated-app `captureFrame` / `captureGeneratedFrame` and renderer-only
  `captureSnapshot`. Capture selects an explicit simulation step, transfers an
  owned snapshot and source assets, awaits GPU completion, and holds presentation
  through readback. Release restores previous simulation cadence; resize is
  deferred while held. Concurrent captures and conflicting renderer operations
  fail clearly. Disposal cancels a pending selection.
- `render:cloud --capture-time 0` uses that contract without an author-written
  readiness poll. It starts generated simulation paused and verifies that draws
  and submissions do not change during screenshot capture.
- Portable bundles now preserve SSAO along with tone mapping, MSAA and bloom.
  This fixed a real parity gap discovered during the follow-up: the previous
  portable renderer silently omitted the app's AO configuration.
- Detailed portable render phase timings and separate Dawn GPU fence/readback
  timings. A fence wait is wall time, not a GPU timestamp.
- Platform base64 decoding after existing syntax validation, with the portable
  fallback retained. No Node-specific import enters the browser dependency graph.
- [Procedural scene and capture guidance](../../../docs/PROCEDURAL_STILL_IMAGES.md):
  blockout-first workflow, winding/flat normals, openings, coplanar water,
  materials, exact-frame capture, and choosing ECS/material/fullscreen shaders.

## Same-image render measurements

1200 × 900; final garden geometry and camera; corrected AO; 4× MSAA; shadows,
IBL, ACES and bloom retained. Direct Dawn uses `webgpu@0.6.2`, Vulkan and the
provisioned SwiftShader ICD. Browser captures use the pinned Chromium 153 /
Playwright Core 1.60 verified native-WebGPU route and cleanup wrapper.

| Route | Median | Range | What is timed |
| --- | ---: | ---: | --- |
| Dawn, fresh child/device | 6.49 s | 6.27–6.86 s | Session initialization plus render-to-PNG |
| Dawn, retained child/device | 4.44 s | 4.18–4.60 s | Render-to-PNG on the existing session |
| Browser, portable bundle | 6.52 s | 5.95–8.04 s | Verified capture lifecycle, including browser cleanup |
| Browser, generated app + explicit capture | 4.86 s | 4.85–6.63 s | Verified capture lifecycle, including release/cleanup |

Three samples per row. These timings start with scene source already built or a
bundle already extracted. They exclude author reasoning, build, headless export,
judge time and benchmark wrapper cleanup. Browser captures create fresh browsers
and contexts; the Node measurement host and OS/runtime caches persist between
samples. First browser startup is materially slower than subsequent startups.
Dawn's cold row creates a fresh native child/device each time; its warm row uses
the third child's existing device. This is not a full cold-machine benchmark.

These measurements establish pixel parity and practical route costs, not a
universal renderer ranking. In particular, the generated browser route is a
bundled application; the portable browser harness serves an unbundled module
graph. Their loading costs differ. The latter's navigation median was 1.15 s.
No Three.js/vGPU authoring trial was rerun, so these rows cannot update the
original agent-effort rankings or establish a new overall cost advantage.

### Quality and capture stability

[Pixel comparison](summary.json): **all 15 verification images were RGB-identical**
to the retained AO-corrected garden. This includes three generated captures,
three optimized browser bundle captures, three cold and three warm Dawn captures,
and three diagnostic phase-profile captures. Maximum and mean channel error were
both zero, within the predeclared mean ≤ 0.5 / max ≤ 12 tolerance.

The generated captures each made **4 submissions / 77 draws**. Both counters
stayed unchanged through the screenshot. The scene used no custom WGSL material:
it is an ECS procedural garden rendered through Aperture's standard pipeline.
It benefits from shared Dawn tooling, without importing vGPU or rewriting the
scene as a fullscreen shader.

### What became faster

The controlled, seven-sample, alternating-order codec measurement decoded the
same embedded asset tree before and after the change, and deep-compared results:

| Asset-tree decode | Median | Minimum |
| --- | ---: | ---: |
| JavaScript base64 loop | 294.4 ms | 247.4 ms |
| Platform decoder | 46.4 ms | 43.0 ms |

That removes about **248 ms** from this measured decode stage (84% median
reduction). Integrated asset restoration measured about 48 ms in cold Dawn and
28 ms in the browser, versus approximately 260–300 ms before. The codec timings
are observational evidence, not a relative-speed unit-test gate.

The initial end-to-end native samples overlapped development test/build work;
they are retained in the root `native-summary.json` for transparency but are
**not used to claim an end-to-end optimization percentage**. The table above
uses the later isolated `optimized/` run. Browser full-capture ranges overlap
before/after the codec change, so this is a proven stage improvement rather than
proof of an overall browser speedup.

### Why time remains

Median warm Dawn phases: **99 ms** CPU preparation/submission, **4,161 ms** GPU
completion wait, **96 ms** readback, and **45 ms** PNG encoding. These independent
medians need not sum to the median total. Cold Dawn also pays child/device startup
and colder pipeline preparation. PNG compression and the codec are no longer
credible explanations for most of the delay.

A separate diagnostic fence between environment preparation and scene rendering
measured environment GPU waits of **28–56 ms**, then scene-frame waits of
**5.00–6.09 s**. This rules out repeated environment preparation as the dominant
cost in these runs. The extra diagnostic fence changes scheduling; those samples
are phase attribution evidence, not directly interchangeable with throughput
measurements. They do not yet distinguish shadow rasterization, main shading,
MSAA and post processing within that scene-frame wait.

The AO-off ablation produced warm totals of **3.92, 5.64 and 5.41 s**. They overlap
and sometimes exceed the AO-on timings, so this small noisy experiment does not
support a reliable AO cost estimate. Removing AO changes the image and is not an
optimization adopted here. The next GPU optimization should be selected from
per-pass timestamps or a larger interleaved ablation, with image parity checked.
This follow-up does not claim that all remaining GPU costs have been optimized.

## Validation

- TypeScript package build and test typecheck.
- 216 targeted unit tests, including capture fence waiting, pause restoration,
  token ownership, concurrent operation rejection, release/selection failure,
  timeout cleanup, disposal, deferred resize, codec parity/fallback and bundle
  post-effect round trips.
- 35 verified-renderer checks; package, headless and GPU import boundaries.
- 44 actual native Dawn regressions and retained browser execution proof.
- Fifteen full-quality image comparisons against the corrected baseline.

Exact validation outcomes are recorded in `validation.json`. The benchmark is a
single garden on a software GPU. It does not measure hardware-GPU performance,
agent token usage or billed cost. Local image/pixel checks verify the render
artifacts; hosted gallery deployment confirmation is separate from browser UI QA.

## Reproduction and evidence

`garden/` retains the final scene, headless config and generated build. The index
uses the Vite plugin's generated entry; it has no custom readiness script.
`garden.bundle.json` contains the strict asset closure and SSAO configuration.

- `measure.mjs native 3`: three fresh Dawn sessions, then three warm jobs.
- `measure.mjs browser 3`: the same portable bundle through the approved browser
  verifier. `measure.mjs generated 3`: the generated app with `captureTime: 0`.
  Both browser modes **must run inside the runtime-pressure wrapper**; retained
  audit receipts are in `../evidence/audits/`.
- Set `APERTURE_MEASURE_OUT` to a new retained output directory to preserve existing
  evidence. Set `APERTURE_MEASURE_BUNDLE` only for an explicitly labeled variant.
- `codec-bench.mjs`: alternating original/platform decoder comparison.
- `profile-gpu.mjs`: diagnostic environment/frame GPU fences, same output.
- `summarize.mjs`: numeric summaries and pixel assertions for retained runs.

Native commands require the provisioned `VK_ICD_FILENAMES` and
`LD_LIBRARY_PATH`. The browser additionally requires `APERTURE_WEBGPU_RUNTIME`
and wrapper-owned `APERTURE_TMP_RUN`. Follow the repository rendering runbook.
