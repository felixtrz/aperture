# Unregistered Route-Key App Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1303` app-level diagnostic coverage for syntactically valid but
unregistered material route keys.

## References Inspected

- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/ROUTE_FAMILY_KEY_TYPE_BOUNDARY_TEST_AUDIT_2026_05_18.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Pass. The test proves Decision 0010's unsupported-route behavior at the app
diagnostics boundary.

The fixture modifies an extracted unlit draw to use the valid route family key
`toon-shaded`. The render queue accepts the route key, but the WebGPU app
resource collector reports `webGpuApp.unsupportedMaterialQueueFamily`, produces
a route report with zero routed items, and does not submit draw work.

Boundary checks:

- no app-level non-built-in rendering was added;
- no fallback to the unlit source material family occurs;
- no shader, pipeline, bind group, or draw submission behavior changed;
- no public custom material source asset was added.

## Recommendation

Run tracker/backlog alignment next. Future route work can now choose between a
small app diagnostics refinement or a real non-built-in route design, but the
latter still needs a source asset and prepared-resource contract.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "unregistered route family"`
