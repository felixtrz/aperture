# Unified Example Testing Infrastructure Plan

Updated: 2026-05-24

## Purpose

Build one reusable render-development control plane for Aperture examples.

The goal is not "MCP versus CLI." The goal is a shared controller that can keep
a browser alive, drive examples while they are still under active development,
inspect renderer/status state, freeze and step frames when the example supports
it, and turn exploratory checks into durable Playwright tests.

This infrastructure must preserve Aperture's architecture:

- ECS and worker-side logic remain the source of truth.
- Rendering remains a derived view of snapshots.
- The testing tool must not introduce a scene graph or renderer-owned app state.
- Standalone route tests remain the cold-start proof for boot, first-frame
  resources, query params, and route-specific UI.
- Persistent shell tests are used when repeated scenario swaps, renderer reuse,
  and reduced browser/device churn are the thing being proven.

## Current Audit

Current example and E2E shape:

- 50 HTML files exist under `examples/`, including `index.html` and
  `persistent-render-shell.html`.
- 103 E2E specs exist under `test/e2e/`.
- 50 specs perform explicit `page.goto(...)` route loading.
- 82 specs inspect screenshots, canvas pixels, readback samples, or other visual
  evidence.
- 101 specs inspect example status, diagnostics, JSON safety, or WebGPU
  validation warning behavior.
- 36 specs exercise UI interactions such as clicks, select controls, keyboard or
  mouse input, asset switching, animation controls, or camera controls.

The examples currently prove these broad behaviors:

1. Route boot and status publishing through `__APERTURE_EXAMPLE_STATUS__`.
2. WebGPU unsupported-device handling.
3. JSON-safe diagnostics that do not expose raw GPU handles.
4. WebGPU validation warning capture.
5. Canvas pixel proof through screenshots, PNG sampling, or example readback
   points.
6. Renderer telemetry such as draw counts, command pressure, resource reuse,
   render bundles, profiler history, clustered-light buffers, shadow/cookie
   atlases, occlusion feedback, and skipped writes.
7. Query-param scenario variants for routes such as clustered lights,
   standard queue phases, outdoor scene, triangle/custom WGSL, profiler history,
   GLB viewer assets, and failure diagnostics.
8. Interactive workflow checks in examples such as GLB viewer, material controls,
   camera controls, animation controls, and stop-after-ready routes.
9. Special renderer creation profiles such as MSAA, TAA, SSR, DOF, SSAO,
   render-to-texture, SharedArrayBuffer transport, GPU profiler, and the
   persistent render shell.
10. Failure and diagnostic routes for missing assets/resources, unsupported
    primitives, invalid texture upload, visibility/layer filtering, and disabled
    renderables.

Existing reusable pieces:

- `test/e2e/webgpu-status.ts` provides route status loading, unsupported WebGPU
  skipping, JSON safety checks, and validation-warning filtering.
- `test/e2e/persistent-route-harness.ts` reuses one Playwright page across
  standalone routes while preserving cold-start navigation behavior.
- `examples/persistent-render-shell.html` keeps one `createWebGpuApp(...)`
  instance alive while fresh ECS/extraction scenario producers are swapped
  underneath it.
- `docs/PERSISTENT_RENDER_SHELL.md` documents when to use standalone route mode
  versus shell mode.

## Target Shape

Create a shared render proof controller with thin frontends.

Recommended repository shape:

- `test/e2e/render-control/`
  - Playwright-backed browser/session controller.
  - Status, warning, screenshot, pixel, and diff helpers.
  - Types for the browser-side example control protocol.
- `scripts/render-control.mjs`
  - A human/agent-facing CLI over the same controller.
- Optional later wrapper:
  - MCP server or other agent connector over the same controller if it gives
    better interactive control than CLI in the local Codex environment.

The core controller is the product. CLI, MCP, and possible debug UI are
frontends.

## Example Control Protocol

Every renderer-backed example should expose a shared control object:

```ts
globalThis.__APERTURE_EXAMPLE_CONTROL__ = {
  version: 1,
  capabilities: {
    status: true,
    warnings: true,
    screenshot: true,
    pause: boolean,
    resume: boolean,
    step: boolean,
    scenario: boolean,
    snapshot: boolean,
    readback: boolean
  },
  getStatus(),
  getWarnings(),
  pause(),
  resume(),
  step(frames),
  setScenario(id, options),
  snapshot(label),
  getFrameState()
}
```

Required baseline for all examples:

- `version`
- `capabilities`
- `getStatus()`
- `getWarnings()`
- `snapshot(label)`

Optional capabilities must be explicit:

- Examples without an animation loop may report `pause/resume/step: false`.
- Query-param-only examples may report `scenario: false`.
- Existing interactive examples may map UI state to `setScenario(...)` over
  time, but route cold-start coverage must stay intact.
- Worker-backed examples must pause or step the producer loop, not just stop
  browser `requestAnimationFrame`.

Acceptance criteria:

- A new shared helper installs the protocol without duplicating boilerplate in
  every example.
- The protocol is JSON-safe and structured-clone friendly.
- Capability reporting is truthful.
- Existing `__APERTURE_EXAMPLE_STATUS__` remains supported for compatibility
  until all E2E specs use the controller.
- At least one static route, one worker-backed animated route, one post-effect
  route, one interactive route, and the persistent shell implement the protocol
  before broad migration begins.

## Controller Capabilities

The shared Node controller should expose:

- `startBrowser(options)`
- `stopBrowser()`
- `newPage()`
- `navigate(url)`
- `refresh()`
- `resetToBlank()`
- `waitReady(options)`
- `getStatus()`
- `getWarnings()`
- `assertNoWebGpuValidationWarnings()`
- `pauseFrames()`
- `resumeFrames()`
- `stepFrames(count)`
- `runScenario(id, options)`
- `captureSnapshot(label)`
- `captureScreenshot(label)`
- `samplePixels(points)`
- `diffStatus(before, after, options)`
- `diffPixels(before, after, options)`
- `saveArtifact(kind, label, payload)`

Acceptance criteria:

- One persistent Playwright browser/page can run at least five different
  examples without being recreated.
- The same controller can run standalone route mode and persistent shell mode.
- WebGPU validation warning capture is route/scenario scoped.
- Status snapshots are attached or written as JSON artifacts.
- Pixel snapshots are written as image artifacts when requested.
- Diff helpers ignore configured volatile fields such as elapsed time, frame
  count, timestamps, URLs with cache busters, GPU timing samples, and run ids.
- Controller methods throw actionable errors that include URL, phase, status
  summary, and recent WebGPU warnings.

## Tool Frontend

Build the first frontend in whichever format gives the best local control.
The initial recommendation is a CLI because it is easy to run manually, from
tests, and from agents:

```text
pnpm render-control start
pnpm render-control open /examples/glb-viewer.html
pnpm render-control status
pnpm render-control pause
pnpm render-control step 3
pnpm render-control snapshot baseline
pnpm render-control scenario clustered-pressure-history
pnpm render-control snapshot after
pnpm render-control diff baseline after
pnpm render-control refresh
pnpm render-control stop
```

MCP can wrap the same controller later if direct tool calls are more ergonomic
for agents than shell commands.

Acceptance criteria:

- A developer can open an unfinished example, inspect status, warnings, pixels,
  and snapshots without writing a new Playwright spec first.
- A developer can refresh cold, navigate to another example, and preserve the
  same browser session.
- A developer can pause, step, and resume examples that advertise those
  capabilities.
- A developer can diff two status snapshots and two screenshot/pixel snapshots.
- The frontend documents unsupported commands clearly when an example lacks a
  capability.

## Phased Implementation

### Phase 1: Shared Protocol And Controller Skeleton

Deliverables:

- Add shared browser-side control protocol helper.
- Add shared Playwright-backed controller module.
- Add one CLI or equivalent frontend over the controller.
- Migrate these pilot routes:
  - `triangle.html`
  - `spinning-cube.html`
  - `post-effects.html`
  - `glb-viewer.html`
  - `persistent-render-shell.html`

Acceptance criteria:

- The pilot examples expose `__APERTURE_EXAMPLE_CONTROL__`.
- The frontend can navigate to each pilot route, wait ready, read status, capture
  warnings, and capture a screenshot.
- `spinning-cube.html` can pause, step at least three frames, and resume.
- `post-effects.html` can snapshot raw/effect-visible state.
- `glb-viewer.html` can report current asset, playback state, and UI-derived
  scenario state.
- `persistent-render-shell.html` can run both existing shell scenarios through
  the controller.
- New focused E2E coverage proves controller behavior for all five pilot routes.
- `pnpm run typecheck:test` and the new focused Playwright suite pass.

### Phase 2: Snapshot And Diff Semantics

Deliverables:

- Add status snapshot normalization.
- Add configured volatile-field filtering.
- Add status diff reports.
- Add screenshot and pixel diff reports.
- Add artifact directory conventions.

Acceptance criteria:

- Diff reports identify added, removed, and changed status paths.
- Volatile fields are ignored by default but can be included on demand.
- Pixel diffs can compare named readback samples and full screenshots.
- At least three pilot examples have before/after proof scripts:
  - one route refresh proof,
  - one pause/step proof,
  - one scenario-swap proof.
- Diff artifacts are stable enough to be committed as E2E evidence when needed.

### Phase 3: Unify Existing E2E Helpers

Deliverables:

- Route loading helpers use the shared controller where practical.
- Persistent route harness delegates to the controller.
- Persistent render shell spec delegates to the controller.
- WebGPU warning guards and JSON-safety checks live in one reusable layer.

Acceptance criteria:

- Existing route tests keep their current assertions.
- Helper duplication around `page.goto`, `waitForExampleStatus`,
  validation-warning capture, screenshot capture, and status attachment is
  reduced.
- Standalone route cold-start behavior remains covered.
- Persistent browser reuse becomes available to tests without hiding cold-start
  regressions.
- No broad E2E test loses feature-specific assertions during migration.

### Phase 4: Broad Example Onboarding

Deliverables:

- Every renderer-backed example exposes the shared protocol.
- Examples declare truthful capabilities.
- Query-param scenario routes are represented in controller metadata.
- Existing ad hoc stop hooks are replaced or bridged by the shared control API.

Acceptance criteria:

- All HTML examples except `index.html` expose
  `__APERTURE_EXAMPLE_CONTROL__`.
- `index.html` is covered as static navigation/index content, not as a renderer
  control route.
- Existing route-specific E2E specs pass after migration.
- `pnpm run check:examples` verifies the new shared helper files.
- `pnpm run typecheck:test` passes.
- A controller smoke test visits every renderer-backed example in one browser
  session and records status plus warning artifacts.

### Phase 5: Development Workflow And Docs

Deliverables:

- Add a public developer guide for the controller.
- Document how to turn an exploratory controller session into a Playwright spec.
- Document when to use standalone route mode, persistent route mode, and
  persistent shell mode.
- Add troubleshooting guidance for unsupported WebGPU, device loss, validation
  warnings, stale status, blank canvas, and missing capabilities.

Acceptance criteria:

- A new example author can follow the guide to expose the protocol, run the
  frontend, pause/step when relevant, snapshot status, and add a focused E2E
  test.
- Existing `docs/PERSISTENT_RENDER_SHELL.md` is either updated or linked from
  the new guide.
- The public dashboard points to the tooling when it affects recommended next
  tasks or project status.

## Example Onboarding Matrix

Legend:

- `route`: standalone cold-start route proof.
- `visual`: screenshot, pixel, readback, or visible-output proof.
- `telemetry`: status, diagnostics, queue/resource/performance proof.
- `interactive`: UI, input, asset selection, playback, camera, or controls.
- `special`: custom renderer creation, worker/SAB, post stack, shell, or
  compute-oriented route.

| Example                         | Current proof lanes                            | Required controller onboarding                                                   |
| ------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `app-diagnostics.html`          | route, telemetry                               | status, warnings, diagnostic snapshot, route refresh                             |
| `area-light-shapes.html`        | route, visual, telemetry                       | status, warnings, readback samples, scenario snapshot                            |
| `atmosphere.html`               | route, visual                                  | status, warnings, readback samples, pause/step if animated                       |
| `batching.html`                 | route, visual, telemetry                       | status, warnings, draw/queue telemetry snapshot                                  |
| `clearcoat.html`                | route, visual, telemetry                       | status, warnings, material readback samples                                      |
| `clustered-lights.html`         | route, visual, telemetry, special              | status, warnings, query scenarios, cluster/shadow/cookie snapshots               |
| `csm-directional-shadow.html`   | route, visual, telemetry                       | status, warnings, shadow/cascade telemetry snapshot                              |
| `custom-material.html`          | route, visual, telemetry                       | status, warnings, custom material scenario snapshot                              |
| `debug-normal-app.html`         | route, visual                                  | status, warnings, readback samples                                               |
| `depth-app-overlap.html`        | route, visual, telemetry                       | status, warnings, overlap/presentation snapshot                                  |
| `dof.html`                      | route, visual, special                         | status, warnings, pause/step bridge, raw/effect diff                             |
| `fog.html`                      | route, visual                                  | status, warnings, readback samples                                               |
| `glb-viewer.html`               | route, visual, telemetry, interactive, special | status, warnings, asset/playback/camera controls, pause/step, scenario snapshots |
| `gltf-scene.html`               | route, visual, telemetry                       | status, warnings, asset/material snapshot                                        |
| `gpu-profiler.html`             | route, telemetry, special                      | status, warnings, phase-history snapshot, volatile timing filters                |
| `index.html`                    | static navigation                              | index/link coverage only, no renderer control required                           |
| `instance-attributes.html`      | route, visual, telemetry                       | status, warnings, attribute/readback snapshot                                    |
| `instance-tint.html`            | route, visual, telemetry                       | status, warnings, tint/readback snapshot                                         |
| `instancing.html`               | route, visual, telemetry                       | status, warnings, instancing telemetry snapshot                                  |
| `iridescence.html`              | route, visual, telemetry                       | status, warnings, material readback samples                                      |
| `matcap-app.html`               | route, visual                                  | status, warnings, readback samples                                               |
| `materials-showcase.html`       | route, visual, telemetry                       | status, warnings, material matrix snapshot                                       |
| `msaa.html`                     | route, visual, special                         | status, warnings, pause/step bridge, MSAA resource snapshot                      |
| `multi-entity.html`             | route, visual, telemetry                       | status, warnings, route scenarios, diagnostics snapshot                          |
| `multi-light-shadow.html`       | route, visual, telemetry                       | status, warnings, shadow/resource snapshot                                       |
| `multi-material-groups.html`    | route, visual, telemetry                       | status, warnings, material group/range snapshot                                  |
| `occlusion-feedback.html`       | route, visual, telemetry                       | status, warnings, occlusion query/skip snapshot                                  |
| `outdoor-scene.html`            | route, visual, telemetry, special              | status, warnings, query toggles, stop-after-ready bridge                         |
| `persistent-render-shell.html`  | route, visual, telemetry, special              | shell scenario control, renderer identity snapshot, run diff                     |
| `point-shadow.html`             | route, visual, telemetry                       | status, warnings, shadow/readback snapshot                                       |
| `post-effects.html`             | route, visual, telemetry, special              | status, warnings, post graph snapshot, raw/effect diff                           |
| `rect-area-light.html`          | route, visual, telemetry                       | status, warnings, LTC/resource snapshot                                          |
| `render-packet-inspector.html`  | route, telemetry, special                      | status, warnings, packet snapshot and diff                                       |
| `render-to-texture.html`        | route, visual, telemetry, special              | status, warnings, render-target snapshot                                         |
| `sab-cube.html`                 | route, visual, telemetry, special              | status, warnings, SAB transport snapshot                                         |
| `sheen.html`                    | route, visual, telemetry                       | status, warnings, material readback samples                                      |
| `skybox.html`                   | route, visual                                  | status, warnings, environment readback samples                                   |
| `spinning-cube.html`            | route, visual, telemetry                       | status, warnings, pause/step/resume, frame-state snapshots                       |
| `spot-shadow.html`              | route, visual, telemetry                       | status, warnings, shadow/readback snapshot                                       |
| `sprite-billboard.html`         | route, visual, telemetry                       | status, warnings, billboard/camera snapshot                                      |
| `ssao.html`                     | route, visual, special                         | status, warnings, pause/step bridge, raw/effect diff                             |
| `ssr.html`                      | route, visual, special                         | status, warnings, pause/step bridge, raw/effect diff                             |
| `standard-gltf-texture.html`    | route, visual, telemetry                       | status, warnings, texture/material snapshot                                      |
| `standard-queue-phases.html`    | route, visual, telemetry                       | status, warnings, queue/sort/pressure scenarios                                  |
| `standard-texture-control.html` | route, visual, telemetry, interactive          | status, warnings, material toggle snapshots                                      |
| `taa.html`                      | route, visual, telemetry, special              | status, warnings, pause/step bridge, motion-history snapshot                     |
| `tonemap-showcase.html`         | route, visual, telemetry                       | status, warnings, operator/readback snapshot                                     |
| `transmission.html`             | route, visual, telemetry                       | status, warnings, transmission filter snapshot                                   |
| `triangle.html`                 | route, visual                                  | status, warnings, minimal control smoke route                                    |
| `worker-cube.html`              | route, visual, telemetry, special              | status, warnings, worker transport snapshot, pause/step if supported             |

## Global Completion Criteria

The infrastructure is complete when:

- Every renderer-backed example exposes the shared control protocol.
- Every example declares accurate capabilities.
- The controller can cold-load every standalone route in one browser session.
- The persistent shell can run all scenarios that benefit from renderer reuse.
- Exploratory controller commands can be translated into Playwright assertions
  without changing the example under test.
- Existing tests keep feature-specific assertions instead of collapsing into
  generic "status ok" checks.
- `pnpm run check:examples` passes.
- `pnpm run typecheck:test` passes.
- A focused controller E2E suite passes.
- Existing high-value feature suites still pass for migrated examples.
- Documentation tells example authors how to use the control plane before their
  final test assertions are known.

## Non-Goals

- Do not remove standalone route tests.
- Do not require every example to support pause/step if it has no frame loop.
- Do not make the controller the renderer's source of truth.
- Do not introduce a mutable scene graph or renderer-owned app state.
- Do not replace feature-specific assertions with generic snapshots.
- Do not make MCP mandatory if CLI or another frontend gives better local
  control.
