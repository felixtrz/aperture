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

Start with `task-0163`. It creates the browser example harness needed for real WebGPU verification.

## Ready Tasks

### task-0163 — Add browser example harness

Add the minimal browser-facing example structure needed to run Aperture examples outside Vitest.

Acceptance criteria:

- Add an `examples/` browser entry that can import the built Aperture package from `dist`.
- Add a tiny static server script using Node built-ins, not a framework dependency.
- Add npm scripts for building and serving browser examples.
- Document how to run the example locally.
- Keep the page focused on an actual canvas/runtime surface, not a marketing page.

### task-0164 — Add browser WebGPU clear smoke example

Add the first real browser WebGPU example using the existing device initialization and clear helpers.

Acceptance criteria:

- Example initializes WebGPU against a canvas and clears to a distinctive non-black color.
- Example writes a small JSON-safe status object on `window.__APERTURE_EXAMPLE_STATUS__`.
- Unsupported WebGPU paths show the existing actionable error reason.
- The example does not query ECS or introduce renderer-owned scene state.

### task-0165 — Add Playwright browser smoke verification

Add the first Playwright-based verification for the browser clear example. Playwright dependencies, Chromium browser install, config, and npm scripts are already in place.

Acceptance criteria:

- Use the existing `playwright.config.ts` and `npm run test:e2e` script.
- Test launches the clear example, waits for the status object, and asserts readiness.
- Test samples canvas pixels or screenshot data to prove the canvas changed to the expected clear color.
- If WebGPU is unavailable in the local browser, the test reports a clear skipped/unsupported state rather than a vague failure.
- Document any browser flags needed for local Chromium/WebGPU execution.

### task-0166 — Create real unlit WebGPU pipeline bridge

Turn the existing unlit shader and pipeline plans into browser-valid WebGPU pipeline creation.

Acceptance criteria:

- Create a real `GPUShaderModule` from `UNLIT_MESH_WGSL`.
- Build a browser-valid unlit `GPURenderPipeline` descriptor with explicit vertex layouts for the current mesh upload shape.
- Keep pipeline creation behind typed helpers and diagnostics.
- Tests cover descriptor correctness with injected device/pipeline handles.
- No WebGL fallback or three.js-style scene object is introduced.

### task-0167 — Upload simple mesh and frame GPU resources

Add the resource upload bridge needed for one unlit draw from extracted snapshot data.

Acceptance criteria:

- Upload a simple mesh asset into real vertex/index `GPUBuffer` resources.
- Upload view projection, packed transform, and unlit material buffers.
- Create real bind groups using actual `{ buffer: GPUBuffer }` resources, not placeholder resource-key objects.
- Return stable resource keys for use by the existing snapshot binding planner and draw pipeline.
- Tests cover missing buffers, successful resource creation with injected devices, and stable keys.

### task-0168 — Render ECS-extracted triangle scene in browser

Add the first end-to-end rendered scene example from ECS authoring through WebGPU submission.

Acceptance criteria:

- Example creates an ECS world with a camera and at least one mesh-renderer entity.
- Example extracts a `RenderSnapshot`, applies it to a `RenderWorld`, plans bindings, uploads GPU resources, and submits a real unlit render pass.
- Example exposes JSON-safe frame status with extraction, binding, draw, command, and submission counts.
- The canvas visibly contains non-background rendered geometry.
- Production WebGPU code still consumes snapshots/resource plans rather than querying ECS directly.

### task-0169 — Add Playwright triangle scene pixel verification

Verify the ECS-extracted triangle scene in a real browser.

Acceptance criteria:

- Playwright opens the triangle example and waits for a successful frame status.
- Test asserts extraction, binding, draw, command, and submission counts from the page status.
- Test samples pixels or screenshots the canvas to verify rendered geometry differs from the clear color.
- Failure output includes the page status and enough diagnostics to explain missing WebGPU, missing resources, or blank canvas.

### task-0170 — Render multi-entity simple scene in browser

Extend browser rendering from one mesh entity to a tiny simple scene.

Acceptance criteria:

- Example renders at least two ECS mesh entities with distinct transforms and unlit colors/materials.
- Frame status reports two extracted draws, two ready bindings, two draw packages, and two draw calls.
- Render order remains deterministic through the existing snapshot/draw planning path.
- No mutable scene graph or renderer-owned gameplay state is introduced.

### task-0171 — Add Playwright multi-entity scene verification

Add browser E2E coverage for the simple multi-entity scene.

Acceptance criteria:

- Playwright verifies the multi-entity example reaches a successful frame status.
- Test asserts expected draw counts and command counts.
- Pixel/screenshot checks prove at least two non-background colored regions are present.
- Test artifacts or failure logs make blank canvas and resource binding failures easy to diagnose.

### task-0172 — Document browser E2E rendering workflow

Document the new browser rendering path and verification workflow.

Acceptance criteria:

- Add docs explaining how ECS authoring flows into snapshots, render-world resources, WebGPU submission, and Playwright verification.
- Document local commands for build, serve, and browser tests.
- Explain WebGPU browser support expectations and skipped/unsupported behavior.
- Keep architecture language explicit that ECS remains authoritative and rendering remains derived.

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
