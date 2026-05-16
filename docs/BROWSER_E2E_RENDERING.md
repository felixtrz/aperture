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
  and verifies four UV-separated readback samples across all texture
  quadrants.
- Sampler filter/address smoke: loads the multi-entity page with
  `?scenario=sampler-filter-address`, uploads a 2x1 texture, uses
  mirror-repeat U addressing with linear filtering, and verifies the expected
  blended readback sample.
- Vertical sampler address smoke: loads the multi-entity page with
  `?scenario=sampler-v-address`, uploads a two-row texture, uses mirror-repeat
  V addressing with linear filtering, and verifies the expected blended
  readback sample.
- Textured unlit tint smoke: loads the multi-entity page with
  `?scenario=textured-unlit-tint`, applies a non-white `baseColorFactor` to a
  texture-backed unlit material, and verifies the multiplied readback color.
- Multi-textured unlit smoke: loads the multi-entity page with
  `?scenario=multi-textured-unlit`, renders two texture-backed unlit materials
  with distinct texture/sampler resources, and verifies both readback colors.
- Shared-sampler multi-textured smoke: loads the multi-entity page with
  `?scenario=shared-sampler-multi-textured`, renders two texture-backed unlit
  materials using distinct textures and one shared sampler, and verifies both
  readback colors.
- Shared-texture tinted smoke: loads the multi-entity page with
  `?scenario=shared-texture-tinted-unlit`, renders two texture-backed unlit
  materials using one shared texture/sampler pair and different tints, and
  verifies both multiplied colors.
- Shared-texture missing sampler resource smoke: loads the multi-entity page
  with `?scenario=shared-texture-missing-sampler-resource`, withholds the
  shared sampler GPU resource, and verifies both material bind groups report
  the same missing sampler key before draw submission.
- Shared-texture missing texture resource smoke: loads the multi-entity page
  with `?scenario=shared-texture-missing-texture-resource`, withholds the
  shared texture GPU resource, and verifies both material bind groups report
  the same missing texture key before draw submission.
- Shared-texture missing texture/sampler resource smoke: loads the multi-entity
  page with `?scenario=shared-texture-missing-texture-sampler-resources`,
  withholds both shared GPU resources, and verifies both material bind groups
  report both missing resource keys before draw submission.
- Mixed unlit pipeline smoke: loads the multi-entity page with
  `?scenario=mixed-unlit-pipelines`, renders factor-only and texture-backed
  unlit materials in one frame, verifies two distinct pipeline keys, and
  checks both colors through readback.
- Texture dependency status smoke: loads the multi-entity page with missing,
  loading, and failed texture/sampler dependency scenarios and verifies
  extraction stops before draw submission with stable asset-key diagnostics.
- Multi-textured missing texture asset smoke: loads the multi-entity page with
  two texture-backed materials and one unregistered texture asset, then verifies
  extraction reports the missing texture asset key before resource creation.
- Multi-textured missing sampler asset smoke: loads the multi-entity page with
  two texture-backed materials and one unregistered sampler asset, then verifies
  extraction reports the missing sampler asset key before resource creation.
- Shared-sampler missing texture asset smoke: loads the multi-entity page with
  two texture-backed materials sharing one sampler asset and one unregistered
  texture asset, then verifies extraction reports the missing texture asset key
  before resource creation.
- Shared-sampler missing sampler asset smoke: loads the multi-entity page with
  two texture-backed materials sharing one unregistered sampler asset, then
  verifies extraction reports the shared sampler asset key twice before
  resource creation.
- Shared-texture missing asset smokes: load the multi-entity page with two
  texture-backed materials sharing one texture/sampler pair, leave the shared
  texture asset, shared sampler asset, or both assets unregistered, then verify
  extraction reports the shared asset keys before resource creation.
- Shared-sampler missing sampler resource smoke: loads the multi-entity page
  with two texture-backed materials sharing one sampler asset, withholds the
  shared sampler GPU resource, and verifies both material bind groups report the
  same missing sampler key before draw submission.
- Shared-sampler missing texture resource smoke: loads the multi-entity page
  with two texture-backed materials sharing one sampler asset, withholds one
  texture GPU resource, and verifies the affected material reports the missing
  texture key before draw submission.
- Missing texture/sampler resource smoke: loads the multi-entity page with a
  ready textured draw but intentionally withheld GPU texture/sampler resources,
  then verifies resource creation stops with JSON-safe diagnostics.
- Multi-textured missing texture resource smoke: loads the multi-entity page
  with two textured draws and one withheld texture GPU resource, then verifies
  the missing texture resource key is reported before draw submission.
- Multi-textured missing sampler resource smoke: loads the multi-entity page
  with two textured draws and one withheld sampler GPU resource, then verifies
  the missing sampler resource key is reported before draw submission.
- Multi-textured missing texture/sampler resource smoke: loads the multi-entity
  page with two textured draws and one material missing both texture and sampler
  GPU resources, then verifies both resource keys before draw submission.
- Invalid texture upload smoke: loads the multi-entity page with intentionally
  invalid texture upload row-stride, rows-per-image, and data-size scenarios,
  then verifies resource creation stops with JSON-safe texture diagnostics
  before draw submission.
- Unknown scenario smoke: loads the multi-entity page with an unsupported
  `scenario` query value and verifies the harness publishes an explicit
  zero-submission `unknown-scenario` diagnostic.

The multi-entity status test attaches the published status JSON to the
Playwright report so failures show whether the blank or failed frame came from
extraction, resource binding, draw planning, command execution, or queue
submission.

The shared-sampler and shared-texture asset route specs are lightweight guards:
they verify URL scenarios reach `phase: "extract"` and stay at zero submitted
draws. The deeper multi-textured tests continue to own duplicate diagnostic
order and asset-key assertions for those same scenarios.

The no-browser `test/examples/multi-entity-scenarios.test.mjs` guard keeps the
ordered scenario id list aligned with the explicit dispatch table and verifies
literal e2e scenario routes/fixtures are registered. This catches route drift
before Playwright starts a browser; it complements but does not replace browser
coverage for status shape, pixels, and WebGPU execution.

Route smoke specs cover broad scenario families without duplicating pixel
assertions:

- `test/e2e/primitive-routing.spec.ts` loads every built-in primitive route and
  asserts a submitted frame plus matching `geometry.primitive` status.
- `test/e2e/camera-routing.spec.ts` loads perspective and orthographic camera
  routes and asserts submitted frames plus camera projection status.
- `test/e2e/visibility-routing.spec.ts` loads visibility, layer, ordering, and
  depth routes and asserts submitted frames plus representative status fields.
- `test/e2e/texture-routing.spec.ts` loads texture, sampler, and mixed material
  routes and asserts submitted frames plus representative texture, sampler, and
  pipeline status fields.

Extraction failure statuses include `diagnosticCounts` with non-zero extraction
counts and zero downstream resource, binding, draw, submission, and readback
counts. This keeps failed-route summaries comparable with successful frame
summaries while preserving the extraction boundary.

Texture/sampler scenario index:

- `textured-unlit`: four quadrant samples verify U/V texture orientation.
- `sampler-filter-address`: mirror-repeat U plus linear filtering verifies
  sampler behavior.
- `sampler-v-address`: mirror-repeat V plus linear filtering verifies vertical
  sampler behavior.
- `textured-unlit-tint`: verifies texture color multiplied by
  `baseColorFactor`.
- `multi-textured-unlit`: verifies two distinct texture/sampler resources in
  one frame.
- `shared-sampler-multi-textured`: verifies two textures using one shared
  sampler resource.
- `shared-texture-tinted-unlit`: verifies one shared texture/sampler pair with
  two different material tints.
- `shared-texture-missing-sampler-resource`: verifies one missing shared
  sampler resource across two texture-backed materials.
- `shared-texture-missing-texture-resource`: verifies one missing shared
  texture resource across two texture-backed materials.
- `shared-texture-missing-texture-sampler-resources`: verifies missing shared
  texture and sampler resources across two texture-backed materials.
- `mixed-unlit-pipelines`: verifies factor-only and texture-backed unlit
  pipeline variants in one frame.
- `missing-texture-asset`, `loading-texture-asset`, `failed-texture-asset`,
  `missing-sampler-asset`, `loading-sampler-asset`,
  `failed-sampler-asset`: verify extraction-time asset dependency diagnostics.
- `multi-textured-missing-texture-asset`: verifies one missing texture asset
  among multiple texture-backed materials before resource creation.
- `multi-textured-missing-sampler-asset`: verifies one missing sampler asset
  among multiple texture-backed materials before resource creation.
- `shared-sampler-missing-texture-asset`: verifies one missing texture asset in a
  shared-sampler two-material scene before resource creation.
- `shared-sampler-missing-sampler-asset`: verifies one missing shared sampler
  asset across two texture-backed materials before resource creation.
- `shared-texture-missing-texture-asset`: verifies one missing shared texture
  asset across two texture-backed materials before resource creation.
- `shared-texture-missing-sampler-asset`: verifies one missing shared sampler
  asset across two texture-backed materials before resource creation.
- `shared-texture-missing-texture-sampler-assets`: verifies missing shared
  texture and sampler assets across two texture-backed materials before resource
  creation.
- `shared-sampler-missing-sampler-resource`: verifies one missing shared sampler
  resource across two texture-backed materials.
- `shared-sampler-missing-texture-resource`: verifies one missing texture
  resource in a shared-sampler two-material scene.
- `shared-sampler-missing-texture-sampler-resources`: verifies one missing
  texture resource plus the missing shared sampler resource in a shared-sampler
  two-material scene.
- `missing-texture-sampler-resources`: verifies missing renderer-owned texture
  and sampler resources.
- `multi-textured-missing-texture-resource`: verifies one missing texture
  resource among multiple textured draws.
- `multi-textured-missing-sampler-resource`: verifies one missing sampler
  resource among multiple textured draws.
- `multi-textured-missing-texture-sampler-resources`: verifies one draw missing
  both texture and sampler resources among multiple textured draws.
- `invalid-texture-upload`, `invalid-texture-rows-per-image`,
  `short-texture-upload`: verify texture upload layout and data-size
  diagnostics.

Texture/sampler diagnostic matrix:

| Category             | Scenario                                           | Phase       | Primary diagnostic                                                                                |
| -------------------- | -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| Missing asset        | `missing-texture-asset`                            | `extract`   | `render.texture.missing`                                                                          |
| Missing asset        | `missing-sampler-asset`                            | `extract`   | `render.sampler.missing`                                                                          |
| Missing asset        | `multi-textured-missing-texture-asset`             | `extract`   | `render.texture.missing`                                                                          |
| Missing asset        | `multi-textured-missing-sampler-asset`             | `extract`   | `render.sampler.missing`                                                                          |
| Missing asset        | `shared-sampler-missing-texture-asset`             | `extract`   | `render.texture.missing`                                                                          |
| Missing asset        | `shared-sampler-missing-sampler-asset`             | `extract`   | `render.sampler.missing`                                                                          |
| Missing asset        | `shared-texture-missing-texture-asset`             | `extract`   | `render.texture.missing`                                                                          |
| Missing asset        | `shared-texture-missing-sampler-asset`             | `extract`   | `render.sampler.missing`                                                                          |
| Missing asset        | `shared-texture-missing-texture-sampler-assets`    | `extract`   | `render.texture.missing` / `render.sampler.missing`                                               |
| Missing GPU resource | `missing-texture-sampler-resources`                | `resources` | `unlitBindGroupResource.missingTextureResource` / `unlitBindGroupResource.missingSamplerResource` |
| Missing GPU resource | `multi-textured-missing-texture-resource`          | `resources` | `unlitBindGroupResource.missingTextureResource`                                                   |
| Missing GPU resource | `multi-textured-missing-sampler-resource`          | `resources` | `unlitBindGroupResource.missingSamplerResource`                                                   |
| Missing GPU resource | `shared-texture-missing-texture-resource`          | `resources` | `unlitBindGroupResource.missingTextureResource`                                                   |
| Missing GPU resource | `shared-texture-missing-sampler-resource`          | `resources` | `unlitBindGroupResource.missingSamplerResource`                                                   |
| Missing GPU resource | `shared-sampler-missing-texture-resource`          | `resources` | `unlitBindGroupResource.missingTextureResource`                                                   |
| Missing GPU resource | `shared-sampler-missing-sampler-resource`          | `resources` | `unlitBindGroupResource.missingSamplerResource`                                                   |
| Missing GPU resource | `shared-sampler-missing-texture-sampler-resources` | `resources` | `unlitBindGroupResource.missingTextureResource` / `unlitBindGroupResource.missingSamplerResource` |
| Upload validation    | `invalid-texture-upload`                           | `resources` | `textureResource.invalidBytesPerRow`                                                              |
| Upload validation    | `invalid-texture-rows-per-image`                   | `resources` | `textureResource.invalidRowsPerImage`                                                             |
| Upload validation    | `short-texture-upload`                             | `resources` | `textureResource.uploadDataTooSmall`                                                              |

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

Browser specs should prefer the shared helpers in `test/e2e/webgpu-status.ts`
when adding common status assertions:

- Use `expectedDiagnosticCounts` for `diagnosticCounts` expectations so omitted
  buckets default to zero consistently.
- Use `expectNoDrawSubmissionStatus` for failure routes that must not submit
  draw work. The helper checks any published draw, command, and submission
  numeric counts are zero without requiring specs to repeat every field.
- Use `expectStatusJsonSafeForGpu` on failure statuses that pass through
  texture, sampler, or resource diagnostics to keep raw WebGPU handles and
  creation calls out of JSON payloads.

## Diagnostic Count Phases

`diagnosticCounts` is a JSON-safe phase summary for browser statuses. It is a
triage aid, not an alternate source of render state. ECS authoring state still
flows through extraction first, renderer-owned resources stay outside ECS, and
the browser status only reports counts and stable diagnostic codes.

Current buckets:

- `extraction`: diagnostics emitted while reading ECS-derived authoring data
  and producing the render snapshot. Missing, loading, failed, hidden, disabled,
  or layer-filtered authoring data should appear here before GPU resource
  creation.
- `resources`: diagnostics emitted while uploading or validating renderer-owned
  GPU resources, such as texture upload validation or missing texture/sampler
  resource inputs.
- `binding`: diagnostics emitted while applying an extracted snapshot to the
  render world with explicit renderer resource bindings.
- `draw`: diagnostics emitted while resolving render-world draw packages,
  draw-command descriptors, or draw-list records.
- `submission`: diagnostics emitted while creating or submitting WebGPU command
  buffers.
- `readback`: diagnostics emitted by optional current-texture readback. Readback
  failures explain browser capture limitations and do not imply ECS extraction
  or WebGPU submission failed.

Interpret the buckets relative to `phase`. A failed `phase: "extract"` status
can have non-zero `extraction` counts with every downstream bucket at zero
because resource upload, binding, draw planning, submission, and readback were
not attempted. A failed `phase: "resources"` status has succeeded extraction
but stopped before render-world binding or draw submission. A failed
`phase: "resource-bindings"` status has an extracted snapshot and reached
render-world binding, but no draw submission should be expected. Successful
`phase: "submit"` statuses normally carry zero counts across all buckets; if a
future submitted frame reports a non-zero bucket, tests should assert the
specific phase and code rather than infer raw WebGPU object state.

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
