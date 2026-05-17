# App Diagnostics Example Summary Usage Plan - 2026-05-17

## Scope

Plan how the existing app diagnostics browser example should use the new
summary helpers without changing core app report shape.

This is a planning slice only. It does not change examples, app reports,
resource reuse reports, or rendering behavior.

## References Inspected

- `examples/app-diagnostics.js`
- `scripts/serve-examples.mjs`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current Example Shape

`examples/app-diagnostics.js` runs several diagnostic scenarios and publishes a
single `window.__APERTURE_EXAMPLE_STATUS__` object plus pretty JSON in the page:

- mixed unlit/matcap dependency failure;
- unlit material dependency failure;
- StandardMaterial dependency failure;
- mixed material success.

Failure scenarios already expose detailed material dependency fields:

- failed material kind;
- failed material key;
- failed dependency fields;
- failed dependency resource keys;
- full app render report JSON.

Those detailed fields are useful for a diagnostics example, but they are
handle-level failure data. They should not be confused with the aggregate,
handle-free summary helpers.

## Recommendation

Add `dependencySummary` to failure scenario statuses by calling:

```js
aperture.createMaterialDependencyDiagnosticsSummary(
  reportJson.materialDependencyReadiness ?? [],
);
```

This is the best first example use because the app report JSON already exposes
`materialDependencyReadiness` for failure scenarios. The example can demonstrate
the aggregate, handle-free summary without changing `WebGpuAppRenderReport`,
`WebGpuAppRenderReportJsonValue`, or `WebGpuAppResourceReuseReport`.

Do not force `WebGpuAppDiagnosticsSummary` into this example yet. That helper
composes material queue, routed resource-set, and render-frame queue summaries,
but the app report does not currently emit those stage summaries. Using it in
the example would require new core report wiring or reconstructing stage state
from private internals, which is out of scope.

## Proposed Example Output

For failure scenarios, add:

```js
dependencySummary: aperture.createMaterialDependencyDiagnosticsSummary(
  reportJson.materialDependencyReadiness ?? [],
);
```

Keep existing detailed `failedMaterialKey` and `failedResourceKeys` fields for
debugging. The new field should be explicitly aggregate-only:

- counts by material kind;
- counts by dependency kind;
- counts by readiness status;
- diagnostic code totals.

It should not contain material, texture, sampler, or dependency handle strings.

## Validation

Use the existing example checks:

- `pnpm run check:examples`

If a browser validation task follows, use the browser app or Playwright to open
`/examples/app-diagnostics.html` and assert that `dependencySummary` exists for
failure scenarios and does not contain handle-key substrings.

## Non-Goals

- No `WebGpuAppRenderReport` field changes.
- No `WebGpuAppResourceReuseReport` field changes.
- No successful route report emission.
- No use of private app internals.
- No removal of detailed failure diagnostics from the example.

## Recommended Implementation Slice

Proceed with `task-0946`:

- add `dependencySummary` to `scenarioStatus()`;
- compute it only from `reportJson.materialDependencyReadiness ?? []`;
- keep `successScenarioStatus()` unchanged unless a consumer needs an explicit
  empty dependency summary;
- run `pnpm run check:examples`.
