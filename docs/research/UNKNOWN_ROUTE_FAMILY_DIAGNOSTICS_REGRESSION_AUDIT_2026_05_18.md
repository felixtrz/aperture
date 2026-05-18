# Unknown route family diagnostics regression audit - 2026-05-18

## Scope

Audit the `task-1550` regression for unsupported material route family
diagnostics.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Findings

- The regression uses a test-only `toon-shaded` route family key against a
  prepared built-in source material. It does not add public custom material
  authoring.
- The collector returns `valid: false`, no resource set, an
  `webGpuApp.unsupportedMaterialQueueFamily` diagnostic, and a grouped
  `webGpuApp.materialQueueRouteReport`.
- The report records one queued item, zero routed items, one skipped item, and
  family/phase bucket summaries for the unsupported route.
- JSON inspection asserts raw GPU handles, source assets, app objects, and
  backend resource names do not leak through the result.

## Architecture check

Decision 0010 remains intact: unsupported route family keys are diagnostic
metadata, not valid source material asset kinds or app-renderable custom
families. The route collector still requires a registered adapter before
creating routed resources.

## Recommendation

Proceed to tracker/backlog alignment. After that, the next planning slice should
compare a real route-boundary implementation against the next StandardMaterial
fidelity gap rather than adding more dependency matrix breadth immediately.

## Validation

- `pnpm exec vitest run test/webgpu/queued-built-in-app-resource-set.test.ts`
