# Browser E2E Rendering Workflow

This document describes the current browser verification path for Aperture's
WebGPU examples. The workflow is intentionally narrow: ECS remains
authoritative, rendering is derived from snapshots and render-world state, and
Playwright verifies browser-visible status without making the renderer own
simulation state.

## Frame Path

The browser examples exercise this vertical path:

```text
ECS authoring components
-> extractRenderSnapshot
-> RenderWorld.applySnapshot
-> explicit resource binding updates
-> draw readiness report
-> render-world draw packages
-> WebGPU draw command descriptors
-> render pass command plan
-> queue submission
-> JSON-safe example status
```

The root clear example only initializes WebGPU, clears the current canvas
texture, waits for submitted work when the browser exposes
`queue.onSubmittedWorkDone`, and publishes a status object.

The ECS triangle and ECS multi-entity examples author entities through ECS
components, extract render snapshots, upload WebGPU resources outside ECS, apply
snapshots to a caller-owned `RenderWorld`, and submit WebGPU commands from
derived draw data. GPU devices, contexts, queues, pipelines, bind groups,
buffers, and command encoders stay in the renderer/browser path, not in ECS
components.

## Local Commands

Install dependencies once:

```sh
npm install
```

Build the package used by browser examples:

```sh
npm run examples:build
```

Syntax-check the example server and browser modules:

```sh
npm run check:examples
```

Serve the examples:

```sh
npm run examples:serve
```

Open these pages from the local server:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/examples/triangle.html`
- `http://127.0.0.1:4173/examples/multi-entity.html`

Run the Playwright browser checks:

```sh
npm run test:e2e
```

The standard `npm run check` command includes `check:examples`. The Playwright
web server command builds the package before serving, so `npm run test:e2e` is
enough for browser verification.

## Playwright Checks

The e2e tests wait for each page to publish
`window.__APERTURE_EXAMPLE_STATUS__`.

Current checks:

- Root clear example: verifies WebGPU initialization and clear status in a
  status-only smoke test, then verifies the canvas screenshot in a separate
  pixel test if Chromium exposes presented WebGPU pixels.
- ECS triangle example: verifies extraction, binding, render-world readiness,
  command planning, and submission counts in a status-only smoke test, then
  verifies non-clear pixels in a separate pixel test if Chromium exposes
  presented WebGPU pixels.
- ECS multi-entity example: verifies status-only two-draw execution, including
  two extracted mesh draws, two applied bindings, two ready render-world draws,
  two draw packages, and two submitted draw calls.
- ECS multi-entity pixel test: verifies two distinct colored regions if
  Chromium exposes presented WebGPU pixels.

The multi-entity status test attaches the published status JSON to the
Playwright report so failures show whether the blank or failed frame came from
extraction, resource binding, draw planning, command execution, or queue
submission.

## WebGPU Support And Skips

The Chromium project launches with `--enable-unsafe-webgpu`. If WebGPU is not
available, tests skip only for explicit Aperture initialization reasons:

- `navigator-gpu-unavailable`
- `adapter-unavailable`
- `device-request-failed`
- `context-unavailable`
- `device-lost`

Some headless Chromium environments execute WebGPU work and publish successful
frame status, but screenshots of the canvas still expose the canvas CSS
background instead of the presented WebGPU texture. Pixel tests detect this by
comparing the screenshot center pixel with the computed canvas CSS background.
When they match, the test skips with a diagnostic that includes both pixels.

That skip means the renderer path reached ready browser status, but the current
browser capture path cannot prove presented pixels. New pixel-based scene tests
should wait until the clear and triangle screenshots expose real WebGPU pixels
in the target browser environment.

## Failure Triage

Use the published status first:

- `ok: false` with an unsupported WebGPU reason means the browser environment
  cannot run the WebGPU path.
- `phase: "extract"` points to ECS authoring, asset readiness, transforms, or
  snapshot extraction.
- `phase: "resources"` points to GPU upload or bind group creation.
- `phase: "draw-plan"` points to draw packages, descriptors, draw-list
  resolution, or render pass command planning.
- `phase: "submit"` with `ok: true` means the browser path submitted command
  buffers; any pixel skip after that is a presentation-capture limitation.

Keep future browser checks JSON-safe. Assertions should use serializable counts,
stable keys, status fields, and diagnostics, not raw WebGPU handles.

## Status Payloads

All browser examples publish a JSON-safe status object on
`window.__APERTURE_EXAMPLE_STATUS__`.

Common fields:

- `example`: stable example id.
- `ok`: whether the example reached its intended ready state.
- `phase`: the last completed phase or failed phase.
- `reason` and `message`: failure details when `ok` is false.
- `apertureVersion` and `renderingBackend`: package identity and backend.
- `format`: WebGPU canvas format when initialization succeeds.
- `clearColor`: color used to clear the WebGPU render target.

Clear example status:

- `phase: "clear"` means WebGPU initialized, a clear pass was submitted, and
  submitted work was awaited when the browser exposed `queue.onSubmittedWorkDone`.
- `clearColor` is WebGPU submission-derived diagnostic data. It is not ECS
  state.

Triangle example status:

- `extraction` reports ECS-derived render snapshot counts such as views,
  mesh draws, transforms, view matrices, and extraction diagnostics.
- `binding` reports render-world resource binding planning and application
  counts.
- `renderWorld` reports active, ready, and blocked render-world draw counts
  derived from the extracted snapshot plus explicit resource bindings.
- `draw`, `command`, and `submission` report renderer/WebGPU planning and
  queue-submission counts.

Multi-entity example status:

- `extraction.meshDraws: 2` proves two ECS mesh renderers extracted into
  render packets.
- `resources.materials: 2` and `resources.bindGroups: 4` describe uploaded
  renderer-owned unlit resources.
- `binding.ready: 2`, `draw.packages: 2`, and `submission.drawCalls: 2` prove
  the two-entity frame reached the derived render path.
- `draw.renderIds` and `command.firstInstances` expose stable diagnostics for
  draw ordering and transform-instance selection.

Status payloads are inspection surfaces. They must remain serializable and must
not include raw WebGPU devices, contexts, buffers, textures, command encoders,
pipelines, bind groups, or pass encoders.
