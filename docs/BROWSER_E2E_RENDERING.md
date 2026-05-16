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
derived draw data. The multi-entity example uses Aperture's built-in plane
primitive mesh asset rather than inline browser-only vertex data. GPU devices,
contexts, queues, pipelines, bind groups, buffers, and command encoders stay in
the renderer/browser path, not in ECS components.

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
  status-only smoke test, then verifies the clear color from GPU readback when
  available. Screenshot pixels remain as a fallback.
- ECS triangle example: verifies extraction, binding, render-world readiness,
  command planning, and submission counts in a status-only smoke test, then
  verifies non-clear pixels from GPU readback when available. Screenshot pixels
  remain as a fallback.
- ECS multi-entity example: verifies status-only three-draw execution from four
  authored renderables, including one intentionally hidden renderable, three
  extracted mesh draws, three applied bindings, three ready render-world draws,
  three draw packages, three submitted draw calls, and built-in primitive mesh
  metadata.
- ECS multi-entity pixel test: verifies three distinct colored regions from GPU
  readback when available and verifies the hidden renderable's magenta material
  is absent from sampled regions. Screenshot pixels remain as a fallback.
- Missing-resource smoke: loads the multi-entity page with
  `?scenario=missing-resource`, extracts a valid ECS-authored renderable, then
  intentionally withholds its renderer-side material resource binding and
  verifies that no draw submission occurs.
- Missing mesh resource smoke: loads the multi-entity page with
  `?scenario=missing-mesh-resource`, extracts a valid ECS-authored renderable,
  then intentionally withholds its renderer-side mesh resource binding and
  verifies that no draw submission occurs.
- Layer-mismatch smoke: loads the multi-entity page with
  `?scenario=layer-mismatch`, authors a renderable outside the camera layer
  mask, and verifies extraction skips it before any resource binding or draw
  submission.
- Missing mesh asset smoke: loads the multi-entity page with
  `?scenario=missing-mesh-asset`, authors a renderable with an unavailable mesh
  asset handle, and verifies extraction reports the missing asset before any
  resource binding or draw submission.
- Missing material asset smoke: loads the multi-entity page with
  `?scenario=missing-material-asset`, authors a renderable with a ready mesh and
  unavailable material asset handle, and verifies extraction reports the missing
  material before any resource binding or draw submission.
- Mesh asset status smoke: loads the multi-entity page with
  `?scenario=loading-mesh-asset` and `?scenario=failed-mesh-asset`, authors a
  renderable with a loading or failed mesh asset, and verifies extraction
  reports the asset state before any resource binding or draw submission.
- Material asset status smoke: loads the multi-entity page with
  `?scenario=loading-material-asset` and `?scenario=failed-material-asset`,
  authors a renderable with a loading or failed material asset, and verifies
  extraction reports the asset state before any resource binding or draw
  submission.
- Disabled renderable smoke: loads the multi-entity page with
  `?scenario=disabled-renderable`, authors a renderable with
  `Enabled.value = false`, and verifies extraction skips it before resource
  binding or draw submission.
- Disabled visible peer smoke: loads the multi-entity page with
  `?scenario=disabled-visible-peer`, authors one enabled renderable and one
  disabled peer, then verifies only the enabled color renders.
- Box primitive smoke: loads the multi-entity page with
  `?scenario=box-primitive`, renders a built-in `createBoxMeshAsset` mesh, and
  verifies a non-clear center pixel through readback.
- Sphere primitive smoke: loads the multi-entity page with
  `?scenario=sphere-primitive`, renders a built-in `createSphereMeshAsset`
  mesh, and verifies a non-clear center pixel through readback.
- Cylinder primitive smoke: loads the multi-entity page with
  `?scenario=cylinder-primitive`, renders a built-in
  `createCylinderMeshAsset` mesh, and verifies a non-clear center pixel through
  readback.
- Cone primitive smoke: loads the multi-entity page with
  `?scenario=cone-primitive`, renders a built-in `createConeMeshAsset` mesh,
  and verifies a non-clear center pixel through readback.
- Capsule primitive smoke: loads the multi-entity page with
  `?scenario=capsule-primitive`, renders a built-in
  `createCapsuleMeshAsset` mesh, and verifies a non-clear center pixel through
  readback.
- Torus primitive smoke: loads the multi-entity page with
  `?scenario=torus-primitive`, renders a built-in `createTorusMeshAsset` mesh,
  and verifies a non-clear center pixel through readback.
- Perspective FOV camera smoke: loads the multi-entity page with
  `?scenario=perspective-fov-camera`, authors a perspective ECS camera with a
  non-default vertical FOV, and verifies a primitive plane through readback.
- Orthographic camera smoke: loads the multi-entity page with
  `?scenario=orthographic-camera`, authors an orthographic ECS camera, and
  verifies a primitive plane through readback.
- Render layer filter smoke: loads the multi-entity page with
  `?scenario=render-layer-filter`, authors one renderable matching the camera
  layer and one mismatched peer, then verifies only the matching color renders.
- Render-order overlap smoke: loads the multi-entity page with
  `?scenario=render-order-overlap`, authors two overlapping primitive planes
  with explicit `RenderOrder` values, and verifies the expected top color
  through readback.
- Depth overlap smoke: loads the multi-entity page with
  `?scenario=depth-overlap`, creates a depth attachment and depth-enabled
  unlit pipeline, then verifies the nearer 3D renderable wins even when the
  farther renderable is submitted later.
- Textured unlit smoke: loads the multi-entity page with
  `?scenario=textured-unlit`, uploads a 2x2 base-color texture plus sampler,
  and verifies two UV-separated readback samples.
- Mixed unlit pipeline smoke: loads the multi-entity page with
  `?scenario=mixed-unlit-pipelines`, renders factor-only and texture-backed
  unlit materials in one frame, verifies two distinct pipeline keys, and
  checks both colors through readback.
- Texture dependency status smoke: loads the multi-entity page with missing,
  loading, and failed texture/sampler dependency scenarios and verifies
  extraction stops before draw submission with stable asset-key diagnostics.
- Missing texture/sampler resource smoke: loads the multi-entity page with a
  ready textured draw but intentionally withheld GPU texture/sampler resources,
  then verifies resource creation stops with JSON-safe diagnostics.
- Unknown scenario smoke: loads the multi-entity page with an unsupported
  `scenario` query value and verifies the harness publishes an explicit
  zero-submission `unknown-scenario` diagnostic.

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

The browser examples opt the canvas texture into `COPY_SRC` usage when the
browser exposes WebGPU texture usage flags. Pixel tests prefer JSON-safe GPU
readback samples copied from the current texture before presentation. If
readback setup, copy, map, or format support is unavailable, the status payload
includes an explicit `readback` diagnostic and tests fall back to screenshot
sampling.

Some headless Chromium environments execute WebGPU work and publish successful
frame status, but screenshots of the canvas still expose the canvas CSS
background instead of the presented WebGPU texture. Fallback pixel tests detect
this by comparing the screenshot center pixel with the computed canvas CSS
background. When they match, the test skips with a diagnostic that includes both
pixels.

That skip means the renderer path reached ready browser status, but the fallback
browser capture path cannot prove presented pixels. Prefer adding GPU readback
samples before adding new screenshot-only assertions.

The unsupported-path smoke test removes `navigator.gpu` before example startup
and verifies the clear example publishes `navigator-gpu-unavailable`.

## Playwright Artifacts

Playwright writes browser artifacts under `test-results/playwright/` and the
HTML report under `playwright-report/`.

Artifact types:

- Status attachments are JSON files written by `attachExampleStatus`. They are
  the first place to inspect because they show the example phase, failure
  reason, counts, diagnostics, and optional readback samples.
- Presentation samples are JSON attachments created by screenshot fallback
  helpers. They compare sampled screenshot pixels with the computed canvas CSS
  background and explain presentation-capture skips.
- Screenshots are retained on failure by Playwright. They show what Chromium's
  screenshot API captured, which may be CSS background rather than presented
  WebGPU pixels in some headless environments.
- Videos are retained on failure and show page-level behavior around the failed
  assertion.
- Traces are retained on failure and include the browser timeline, console
  output, network activity, screenshots, and attachments.

Run one e2e spec:

```sh
npm run test:e2e -- test/e2e/ecs-multi-entity-pixels.spec.ts --reporter=line
```

Open the HTML report:

```sh
npx playwright show-report playwright-report
```

Open a retained trace from a failure directory:

```sh
npx playwright show-trace test-results/playwright/<failure-directory>/trace.zip
```

Do not serialize raw WebGPU devices, contexts, textures, buffers, command
encoders, command buffers, pass encoders, pipelines, bind groups, or views into
status payloads or artifacts. Use JSON-safe counts, stable keys, diagnostics,
and copied pixel bytes instead.

## Failure Triage

Use the published status first:

- `ok: false` with an unsupported WebGPU reason means the browser environment
  cannot run the WebGPU path.
- `phase: "extract"` points to ECS authoring, asset readiness, transforms, or
  snapshot extraction.
- `phase: "resources"` points to GPU upload or bind group creation.
- `phase: "draw-plan"` points to draw packages, descriptors, draw-list
  resolution, or render pass command planning.
- `phase: "resource-bindings"` points to missing renderer-side resource
  bindings after ECS extraction has succeeded.
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
- `readback`: optional current-texture readback result. Success values contain
  copied pixel bytes and texture origins. Failure values contain `reason`,
  `message`, and `clearOk` so tests can distinguish render success from
  readback capability limits.

Clear example status:

- `phase: "clear"` means WebGPU initialized, a clear pass was submitted, and
  submitted work was awaited when the browser exposed `queue.onSubmittedWorkDone`.
- `clearColor` is WebGPU submission-derived diagnostic data. It is not ECS
  state.
- `readback.ok: true` includes one copied current-texture pixel from the clear
  target. `readback.ok: false` keeps the clear status usable while explaining
  why readback was unavailable.

Triangle example status:

- `extraction` reports ECS-derived render snapshot counts such as views,
  mesh draws, transforms, view matrices, and extraction diagnostics.
- `binding` reports render-world resource binding planning and application
  counts.
- `renderWorld` reports active, ready, and blocked render-world draw counts
  derived from the extracted snapshot plus explicit resource bindings.
- `draw`, `command`, and `submission` report renderer/WebGPU planning and
  queue-submission counts.
- `readback.ok: true` includes the copied center pixel used by the pixel e2e
  assertion. A failure value is diagnostic only and does not make ECS state
  renderer-owned.

Multi-entity example status:

- `extraction.meshDraws: 3` with `extraction.diagnostics: 1` proves three ECS
  mesh renderers extracted into render packets while one hidden renderable was
  skipped before draw submission.
- `resources.materials: 3` and `resources.bindGroups: 5` describe uploaded
  renderer-owned unlit resources.
- `binding.ready: 3`, `draw.packages: 3`, and `submission.drawCalls: 3` prove
  the three-entity frame reached the derived render path.
- `draw.renderIds` and `command.firstInstances` expose stable diagnostics for
  draw ordering and transform-instance selection.
- `geometry` reports that the browser path rendered the built-in
  `createPlaneMeshAsset` primitive, including vertex/index counts and topology.
- `visibility` reports four authored renderables, three extracted draw packets,
  one skipped renderable, the hidden material key/color, and the JSON-safe
  `render.invisible` diagnostic code.
- `diagnosticCounts` summarizes extraction, resource, binding, draw,
  submission, and readback diagnostics without serializing raw WebGPU handles.
- `readback.ok: true` includes copied samples from left, center, and right
  regions so tests can distinguish the red, green, and blue material outputs
  without relying on screenshots.

Missing-resource scenario status:

- `scenario: "missing-resource"` uses the same browser page with a diagnostic
  mode selected by URL query string.
- `ok: false` and `phase: "resource-bindings"` are expected in this scenario:
  ECS extraction succeeds, but a renderer-side material resource binding is
  intentionally withheld.
- `binding.diagnosticCodes` and `renderWorld.diagnostics` include JSON-safe
  missing-resource codes, while `draw`, `command`, and `submission` counts stay
  at zero.

Missing mesh resource scenario status:

- `scenario: "missing-mesh-resource"` uses the same browser page with a
  diagnostic mode selected by URL query string.
- `ok: false` and `phase: "resource-bindings"` are expected: ECS extraction
  succeeds, but a renderer-side mesh resource binding is intentionally withheld.
- `binding.diagnosticCodes` and `renderWorld.diagnostics` include JSON-safe
  missing-mesh-resource codes, while `draw`, `command`, and `submission` counts
  stay at zero.

Layer-mismatch scenario status:

- `scenario: "layer-mismatch"` uses the same browser page with a diagnostic
  mode selected by URL query string.
- `ok: false`, `phase: "extract"`, and `reason: "layer-mismatch"` are expected:
  the ECS-authored renderable exists, but its layer mask does not intersect the
  camera layer mask.
- `layerFiltering` reports both masks and the `render.layerMismatch`
  diagnostic, while resource binding and submission counts stay at zero.

Missing mesh asset scenario status:

- `scenario: "missing-mesh-asset"` uses the same browser page with a diagnostic
  mode selected by URL query string.
- `ok: false`, `phase: "extract"`, and `reason: "missing-mesh-asset"` are
  expected: the ECS renderable stores only a mesh handle, and that mesh asset is
  intentionally unavailable in the asset registry.
- `diagnostics` includes `render.missingMeshHandle`, while resource binding and
  submission counts stay at zero.

Missing material asset scenario status:

- `scenario: "missing-material-asset"` uses the same browser page with a
  diagnostic mode selected by URL query string.
- `ok: false`, `phase: "extract"`, and `reason: "missing-material-asset"` are
  expected: the mesh asset is ready, but the material asset handle is
  intentionally unavailable in the asset registry.
- `diagnostics` includes `render.missingMaterialHandle`, while resource binding
  and submission counts stay at zero.

Mesh asset status scenario:

- `scenario: "loading-mesh-asset"` and `scenario: "failed-mesh-asset"` use the
  same browser page with asset-state diagnostic modes selected by URL query
  string.
- `assetStatus.mesh` reports the asset registry state and
  `assetStatus.diagnostics` includes `render.mesh.loading` or
  `render.mesh.failed`.
- Resource binding and submission counts stay at zero.

Material asset status scenario:

- `scenario: "loading-material-asset"` and
  `scenario: "failed-material-asset"` use the same browser page with
  asset-state diagnostic modes selected by URL query string.
- `assetStatus.material` reports the asset registry state and
  `assetStatus.diagnostics` includes `render.material.loading` or
  `render.material.failed`.
- Resource binding and submission counts stay at zero.

Disabled renderable scenario:

- `scenario: "disabled-renderable"` uses the same browser page with a metadata
  diagnostic mode selected by URL query string.
- `disabled` reports the authored/extracted counts and the `render.disabled`
  diagnostic.
- Resource binding and submission counts stay at zero.

Box primitive scenario status:

- `scenario: "box-primitive"` uses the same browser page with a primitive
  geometry mode selected by URL query string.
- `geometry` reports the built-in box primitive, including 24 vertices, 36
  indices, triangle-list topology, and the `createBoxMeshAsset` source.
- `readback.ok: true` includes the center sample used to verify the box material
  color without relying on screenshots.

Orthographic camera scenario status:

- `scenario: "orthographic-camera"` uses the same browser page with a camera
  mode selected by URL query string.
- `camera` reports the orthographic projection and height authored through the
  ECS camera component.
- `readback.ok: true` includes the center sample used to verify the
  orthographic view rendered a non-clear primitive pixel.

Render-order overlap scenario status:

- `scenario: "render-order-overlap"` uses the same browser page with an overlap
  mode selected by URL query string.
- `renderOrder` reports the back/front order values and the expected top
  material id.
- `readback.ok: true` includes the center sample used to verify the expected
  overlapping material color.

Unknown scenario status:

- Unknown multi-entity query scenarios publish `ok: false`,
  `phase: "scenario"`, and `reason: "unknown-scenario"`.
- `availableScenarios` lists the accepted scenario ids for agent-readable
  diagnostics.
- Extraction, resource, draw, command, and submission counts stay at zero.

Status payloads are inspection surfaces. They must remain serializable and must
not include raw WebGPU devices, contexts, buffers, textures, command encoders,
pipelines, bind groups, or pass encoders.
