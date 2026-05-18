# Generic Route Diagnostic Normalizer Extraction Audit - 2026-05-18

## Scope

Audit the generic route diagnostic normalizer extraction.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/material-queue-route-report-diagnostics.test.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

The extraction matches the selected scope. The route report module now exports
`unknownToWebGpuAppMaterialQueueRouteDiagnostics()`, which converts unknown
diagnostic values into zero or one JSON-safe
`WebGpuAppMaterialQueueRouteDiagnostic` entries.

`collectQueuedBuiltInAppResourceSet()` still owns built-in app-family policy:
it translates missing adapters and material mismatches into the existing
`webGpuApp.*` compatibility diagnostics before calling the generic normalizer.
The normalizer only copies the route-report allowlist fields and omits invalid
optional values.

Targeted coverage now verifies:

- non-object diagnostics and objects without string `code` are skipped;
- code/message/severity/render identity/material/render phase/blend/entity
  fields are preserved when valid;
- invalid optional fields are omitted;
- raw GPU/source-shaped fields do not leak into report diagnostics.

## Architecture Check

- ECS authority and render extraction are unchanged.
- The helper is pure diagnostic serialization over already-derived route data.
- WebGPU resources remain backend-owned and are not serialized through the
  route-report diagnostic path.
- No app-level non-built-in rendering, scene graph state, or WebGL fallback was
  added.

## Validation

- `pnpm exec vitest run test/webgpu/material-queue-route-report-diagnostics.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/queued-material-app-resource-item.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should decide
whether to continue peeling small generic route diagnostics helpers away from
the built-in collector or return to StandardMaterial/glTF fidelity coverage.
