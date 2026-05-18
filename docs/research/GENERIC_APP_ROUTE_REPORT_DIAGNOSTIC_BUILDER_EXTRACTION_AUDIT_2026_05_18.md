# Generic App Route Report Diagnostic Builder Extraction Audit - 2026-05-18

## Scope

Audit the generic app route report diagnostic builder extraction.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_FOLLOW_UP_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

The extraction matches the selected scope. Generic route-report assembly now
lives with the queued material app resource item contract:

- `materialQueueItemToRouteQueueItem()` serializes the JSON-safe queued item
  metadata used by material queue route reports.
- `createQueuedMaterialAppRouteReportDiagnostic()` builds the
  `webGpuApp.materialQueueRouteReport` diagnostic from generic queue items,
  generic routed app resource items, normalized route diagnostics, and a
  reusable route report shell.
- `collectQueuedBuiltInAppResourceSet()` now normalizes its compatibility
  diagnostics locally, then delegates route-report assembly to the generic
  helper.

The built-in collector still owns the current built-in compatibility behavior:
missing adapter and material mismatch diagnostics are translated into the
existing `webGpuApp.*` codes before the generic report helper sees them. That
keeps current app diagnostics stable and avoids implying non-built-in app-level
rendering is active.

The non-built-in test fixture proves the generic helper can report queued and
routed item metadata for a test-only material family without serializing source
assets, adapter objects, app objects, or raw GPU-shaped fields.

## Architecture Check

- ECS authority is unchanged; the helper consumes extracted queue metadata.
- Render extraction is unchanged; no ECS world or source asset registry access
  moved into the helper.
- WebGPU ownership is preserved; the helper emits JSON-safe diagnostics only.
- No scene graph, WebGL fallback, or app-level non-built-in rendering path was
  introduced.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. The next implementation should avoid
another broad collector move until the remaining route diagnostics and source
asset lookup responsibilities have similarly narrow seams and tests.
