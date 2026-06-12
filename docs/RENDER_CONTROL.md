# Render Control

Updated: 2026-05-24

Render control is the shared development and E2E control plane for renderer
examples. It keeps route tests focused on feature behavior while giving humans
and agents one way to open examples, inspect status, capture artifacts, compare
snapshots, and drive examples that expose pause/step/scenario capabilities.

The controller does not own app state. ECS workers and extraction producers
remain authoritative, and rendering remains a derived view of snapshots.

## Browser Protocol

Renderer-backed examples load `examples/example-control.js`, which installs:

```ts
globalThis.__APERTURE_EXAMPLE_CONTROL__;
```

Every controlled route exposes:

- `version`
- `capabilities`
- `getStatus()`
- `getWarnings()`
- `snapshot(label)`
- `getFrameState()`

Optional capabilities are explicit booleans:

- `pause`
- `resume`
- `step`
- `scenario`
- `readback`

Examples that do not support an optional command return a structured
`unsupported-capability` result. Existing
`globalThis.__APERTURE_EXAMPLE_STATUS__` remains supported for compatibility.

## CLI

Run the examples server first, or let Playwright start it during tests:

```sh
pnpm run examples:serve
```

Useful commands:

```sh
pnpm render-control start
pnpm render-control open /examples/glb-viewer.html
pnpm render-control status
pnpm render-control warnings
pnpm render-control pixels center center:0.5:0.5
pnpm render-control snapshot baseline
pnpm render-control screenshot baseline
pnpm render-control pause
pnpm render-control step 3
pnpm render-control resume
pnpm render-control scenario fxaa-bloom
pnpm render-control diff baseline after
pnpm render-control refresh
pnpm render-control pilot
pnpm render-control smoke-all
```

Artifacts default to `test-results/render-control-cli`. Override with:

```sh
APERTURE_RENDER_CONTROL_ARTIFACT_DIR=test-results/my-run pnpm render-control start
```

Use `APERTURE_RENDER_CONTROL_BASE_URL` when the examples server is not
`http://127.0.0.1:4173`.

The CLI browser launches with the same SwiftShader Vulkan WebGPU flags as
`playwright.ci.config.ts`, so GPU-less machines render deterministically
instead of losing the WebGPU device on the first presented frame. Override the
flags with `APERTURE_RENDER_CONTROL_BROWSER_ARGS` (space-separated), e.g. to
probe a real GPU:

```sh
APERTURE_RENDER_CONTROL_BROWSER_ARGS="--enable-unsafe-webgpu" pnpm render-control start
```

## Writing Tests

Use `createRenderControlPage(page)` when a Playwright test should reuse the
test runner's browser page:

```ts
const controller = createRenderControlPage(page);

await controller.navigate("/examples/spinning-cube.html");
await controller.pauseFrames();
const before = await controller.captureSnapshot("paused");
await controller.stepFrames(3);
const after = await controller.captureSnapshot("stepped");
const diff = controller.diffStatus(before, after);
await controller.saveArtifact("diff", "spinning-cube-step", diff);
await controller.assertNoWebGpuValidationWarnings();
```

Keep feature-specific assertions in the spec. Controller snapshots are evidence
and debugging aids, not a replacement for checking the behavior that matters.

Use `startBrowser()` for standalone Node tools or one-off local probes that
need to own a browser outside the Playwright runner.

## Modes

Use standalone route mode for:

- route boot;
- unsupported WebGPU handling;
- first-frame resource creation;
- query-param coverage;
- route-specific UI and controls.

Use persistent route mode for running multiple standalone routes through one
Playwright page while preserving cold-start navigation for each route.

Use persistent shell mode for renderer-lifetime scenarios where one canvas and
one `createWebGpuApp(...)` instance must stay alive while fresh ECS/extraction
scenario producers reset underneath it. See
[`PERSISTENT_RENDER_SHELL.md`](./PERSISTENT_RENDER_SHELL.md).

## Smoke Coverage

`pnpm render-control pilot` runs the five-route controller pilot used by
`test/e2e/render-control.spec.ts`: persistent shell, triangle, spinning cube,
post effects, and GLB viewer.

`pnpm render-control:smoke-all` visits every renderer-backed example except
`index.html` in one browser session and writes status plus warning artifacts.

`pnpm run check:examples` statically verifies that every renderer-backed HTML
example loads `example-control.js`, that `index.html` remains static
navigation content, and that every import-map target in the example pages
resolves to a real file through the example server's own path resolution.

## Golden Baselines

`test/e2e/golden-baselines.spec.ts` compares seven deterministic (frame-stable)
example routes against committed full-canvas screenshots under the CI
SwiftShader configuration: `auto-shadow`, `multi-light-shadow`,
`area-light-shapes`, `ibl-irradiance`, `standard-gltf-texture`, `msdf-text`,
and `ui-interaction`. A change of more than ~0.3% of canvas pixels in any of
those scenes fails CI.

After an intentional rendering change (or a documented SwiftShader/Chrome
update), refresh the baselines with:

```sh
CI=true xvfb-run -a pnpm exec playwright test \
  --config=playwright.ci.config.ts test/e2e/golden-baselines.spec.ts \
  --update-snapshots
```

Review the regenerated PNGs like any other diff before committing. Animated
routes cannot be goldens; their behavior is asserted by their own specs.

## Troubleshooting

Unsupported WebGPU:

- Check route status `reason` values such as `navigator-gpu-unavailable`,
  `adapter-unavailable`, `device-request-failed`, `context-unavailable`, or
  `device-lost`.

Validation warnings:

- Run `pnpm render-control warnings`.
- Controller errors include the current URL, phase, status summary, and recent
  WebGPU warnings.

Stale status:

- Use `refresh` for cold route reloads.
- Use `reset` or `resetToBlank()` between unrelated route probes.

Blank canvas:

- Capture `status`, `warnings`, and `screenshot`.
- Check extraction counts, draw counts, diagnostics, and readback sections in
  the status artifact.

Missing capability:

- Inspect `capabilities`.
- Keep query-param-only routes in standalone route tests until a route-specific
  `setScenario(...)` bridge is implemented.
