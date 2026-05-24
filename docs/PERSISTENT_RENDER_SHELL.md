# Persistent Render Shell

The persistent render shell is an E2E proof harness for renderer reuse across
scenario resets.

Use `examples/persistent-render-shell.html` when the test needs one browser
page, one canvas, and one `createWebGpuApp(...)` instance to stay alive while
fresh ECS/extraction scenario producers are swapped underneath it. The renderer
continues to consume snapshots; it does not own ECS/game state and does not add
a mutable scene graph.

## Shell Mode

The shell exposes `globalThis.__APERTURE_RENDER_PROOF_SHELL__`:

- `ready`: resolves after the persistent WebGPU app is initialized.
- `runScenario(id)`: starts a fresh scenario producer, renders its snapshots
  through the existing WebGPU app, and resolves to the latest JSON-safe shell
  status.
- `getStatus()`: returns the most recent published shell status.

Each scenario status includes:

- scenario `id`, `runId`, frame count, elapsed time, and renderer instance id;
- readback evidence from the persistent canvas;
- a `webGpuWarnings` array for test-side warning attachment;
- worker snapshot transport evidence and per-scenario proof telemetry.

The focused Playwright proof is
`test/e2e/persistent-render-shell.spec.ts`. It currently runs:

- `transparent-pressure`, backed by the StandardMaterial queue pressure worker;
- `clustered-pressure-history`, backed by the clustered-lights pressure worker.

The spec asserts both scenarios run in one page, the URL is unchanged, the
renderer instance id is stable, `appCreatedCount` remains `1`, and each
scenario has JSON-safe status, readback evidence, and zero relevant WebGPU
validation warnings.

## Standalone Route Mode

Keep standalone route tests for cold-start coverage. Route tests still prove
first page load, worker initialization, source asset registration, first-frame
resource creation, and route-specific UI/status behavior. Shell mode is for
stress and reset efficiency after those cold-start paths already exist.

Use both modes:

- standalone route proof: validate boot, first-frame resources, and route
  completeness;
- persistent shell proof: validate renderer lifetime, repeated scenario reset,
  per-scenario telemetry, and reduced Playwright page/device churn.
