# Backlog

This file contains immediate executable tasks.

Agents should work on one task at a time, but should continue into the next ready task when the current task finishes before the 45-minute run window has elapsed.

Do not stop merely because one task is complete. Stop only when the 45-minute work window has elapsed, no ready task remains, or a stop condition applies.

When tasks are completed, move them to `agent/COMPLETED.md` or mark them complete here and summarize in handoff.

## Execution Note

The MVP 3D concept coverage gate is complete. Ready tasks are now implementation slices derived from:

- `docs/MVP_3D_CONCEPTS.md`
- `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`
- `docs/research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md`
- `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/ANIMATION_SKINNING_MORPH_COVERAGE.md`
- `docs/research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md`
- `docs/research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md`

Keep implementation vertical, typed, and testable. Do not introduce a public mutable scene graph, renderer-owned ECS/game state, or WebGL fallback.

## Recommended Next Task

Start with `task-0190`. Browser E2E now has status-only coverage for clear, triangle, and multi-entity examples, and pixel specs skip with a precise CSS-background presentation diagnostic when headless Chromium cannot expose WebGPU-presented screenshot pixels. The next useful slice is a GPU readback proof so pixel verification can become deterministic without depending on screenshot capture.

## Ready Tasks

### task-0190 — Prototype WebGPU current-texture readback for clear pixels

Add a narrow browser proof that can read one pixel from WebGPU-rendered output when the canvas/current texture supports copy-source usage.

Acceptance criteria:

- The clear example can opt into any required WebGPU canvas texture usage without changing ECS/render ownership boundaries.
- A JSON-safe clear readback result is published when GPU readback succeeds.
- Unsupported copy-source, map, or browser capability failures are reported as explicit diagnostics.
- Existing screenshot pixel tests continue to skip with the current presentation diagnostic if readback is unavailable.
- Unit or injected tests cover the readback helper's failure modes where practical.

### task-0191 — Use GPU readback in triangle and multi-entity pixel tests

Apply the clear readback proof to scene pixel verification so triangle and multi-entity tests can assert rendered colors when browser screenshot capture only exposes CSS pixels.

Acceptance criteria:

- Triangle status includes an optional JSON-safe readback sample or explicit readback diagnostic.
- Multi-entity status includes enough optional readback samples to distinguish the red and blue regions.
- Playwright prefers GPU readback samples for pixel assertions and falls back to screenshot assertions only when readback is unavailable.
- Pixel tests still skip with precise diagnostics rather than failing on CSS-background screenshots.

### task-0202 — Add browser example import-map parsing helper

Replace ad hoc import-map string checks with a small test-side parser that extracts and validates import-map JSON from each example page.

Acceptance criteria:

- Root, triangle, and multi-entity pages are covered.
- The parser returns actionable errors for missing or invalid import maps.
- Tests assert all expected imports from parsed JSON rather than broad string matching.
- No production code or new dependency is added.
- Existing static navigation/structure tests keep passing.

### task-0197 — Add unsupported WebGPU status smoke coverage

Add browser coverage for the unsupported WebGPU path without depending on the host browser actually lacking WebGPU.

Acceptance criteria:

- Playwright injects a controlled missing-`navigator.gpu` environment before example scripts run.
- Clear example publishes `navigator-gpu-unavailable` with `ok: false`.
- The test attaches status JSON and skips only when the setup cannot override the browser environment.
- No production WebGPU support behavior changes.

### task-0198 — Add example server invalid-port CLI smoke test

Cover invalid examples-server CLI input without opening a listening server.

Acceptance criteria:

- A Node built-in child-process test runs `scripts/serve-examples.mjs` with an invalid port.
- The process exits non-zero and reports the actionable invalid-port message.
- The test does not bind a TCP port.
- Valid CLI startup remains covered by existing Playwright/server usage.

### task-0199 — Add import-map consistency checks

Ensure all browser example pages keep their import maps in sync.

Acceptance criteria:

- Static tests parse or inspect root, triangle, and multi-entity import maps.
- Tests assert each page maps `elics`, `wgpu-matrix`, and `@preact/signals-core` to the same server paths.
- Tests fail with clear page/path messages when maps drift.
- No new parser dependency is added.

### task-0200 — Add browser e2e artifact guide

Document how to inspect Playwright status, presentation, screenshot, video, and trace artifacts from browser rendering failures.

Acceptance criteria:

- `docs/BROWSER_E2E_RENDERING.md` explains where Playwright writes failure artifacts.
- The doc explains the difference between status attachments, presentation samples, screenshots, videos, and traces.
- The doc includes commands for running a single e2e spec and opening a retained trace.
- The doc reiterates that raw WebGPU handles must not be serialized into artifacts.

## Post-Unlit E2E Verification Targets

Do not start these until the unlit browser path above is working end-to-end and Playwright can verify real rendered pixels reliably. Once that foundation is stable, expand browser E2E coverage across the broader runtime surface:

- Geometry coverage: verify all built-in primitive meshes and mesh upload paths render correctly in browser.
- Material coverage: verify unlit variants first, then add matcap/standard/PBR material paths as they exist.
- Texture coverage: verify texture upload, sampling, UV correctness, and missing-texture diagnostics.
- Lighting coverage: verify directional, point, spot, ambient/environment lighting when those paths are implemented.
- Camera/render-target coverage: verify multiple cameras, viewport/scissor behavior, and offscreen/render-target flows.
- Visibility/sorting coverage: verify layers, hidden/disabled renderables, opaque ordering, and transparency ordering.
- Diagnostics coverage: verify Playwright failure output exposes enough frame status to explain blank canvases, missing resources, or unsupported WebGPU.

Each expansion should keep the same rule: ECS is authoritative, rendering is derived from snapshots/render-world state, and browser verification proves pixels plus JSON-safe frame diagnostics.

## Superseded / Rewritten Tasks

The following pre-gate tasks are superseded by the EliCS adoption and MVP synthesis, or rewritten into the ready tasks above:

- `task-0004 — Implement component registry and storage`: superseded by EliCS adoption; remaining Aperture-specific component work is in `task-0028` and `task-0033`.
- `task-0005 — Implement ECS query API`: superseded by EliCS adoption; query usage should be tested in component and extraction tasks.
- `task-0006 — Implement system schedule`: rewritten into targeted system tasks beginning with `task-0029` and `task-0035`.
- `task-0007 — Add command and event model`: deferred until after the transform/render extraction foundation or rewritten as an input/command task when interaction work begins.
- `task-0008 — Add transform component types`: rewritten as `task-0028`.
- `task-0009 — Implement transform resolution system`: rewritten as `task-0029`.
- `task-0010 — Add render authoring components`: rewritten as `task-0033`.
- `task-0011 — Define asset handle types`: rewritten as `task-0030`.
- `task-0012 — Define RenderPacket and RenderSnapshot`: rewritten as `task-0034`.
- `task-0013 — Implement RenderExtractSystem`: rewritten as `task-0035`.
- `task-0014 — Add architecture invariant tests or checks`: distributed into `task-0030`, `task-0034`, `task-0035`, and `task-0036`.
- `task-0015 — Add WebGPU support detection`: rewritten as `task-0036`.

## Backlog Maintenance Rules

At the end of a run:

- Mark completed task(s).
- Add new tasks if the backlog has fewer than five ready tasks.
- New tasks must align with roadmap and the MVP feature contract.
- New tasks must have acceptance criteria.
- Prefer vertical slices that preserve the ECS/render-extraction boundary.
