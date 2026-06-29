# Headless Validation

Headless validation moves the routine iteration loop into Node while keeping
the browser as the compatibility and pixel-confidence gate.

The inner loop is:

1. Load a `mode: "headless"` config.
2. Load app systems in Node.
3. Step ECS with fixed delta/time.
4. Drain generated input events at the same boundary as the browser worker.
5. Extract a `RenderSnapshot`.
6. Optionally write a render bundle.
7. Render the bundle later only when pixels are needed.

This is not a browser replacement. It is a smaller default loop for ECS logic,
3D math, deterministic replay, asset closure, snapshot production, and
renderer-only bundle checks. Browser runs remain necessary for real DOM input,
browser UI, audio device behavior, WebGPU adapter/device differences,
presentation behavior, and final smoke tests.

Determinism is opt-in and enforceable:

```sh
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --determinism warn
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --determinism error
```

`warn` records system lifecycle calls to `Math.random`, `Date.now`,
`new Date()`, and `performance.now()`. `error` records the same diagnostics as
errors and fails one-shot headless runs. App systems should use
`context.random` and `context.time` for replayable behavior. Current coverage
wraps `init`, `update`, `fixedUpdate`, and queued effect callbacks.

Warm serve mode keeps one Node runtime alive for inspection:

```sh
pnpm exec aperture headless serve aperture.headless.config.ts --seed 7
```

It accepts newline-delimited JSON commands such as `step`, `extract`, `inject`,
`get-status`, `bundle`, `reset`, `tool`, and `shutdown`.

Regression gates:

```sh
pnpm run check:headless-boundaries
pnpm run check:render-bundles
pnpm run check:pack-cli
pnpm run test:session-snapshot
pnpm run test:e2e:render-bundle
```
