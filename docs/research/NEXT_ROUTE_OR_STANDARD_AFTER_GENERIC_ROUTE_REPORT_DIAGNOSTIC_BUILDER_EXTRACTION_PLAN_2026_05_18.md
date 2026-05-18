# Next Route Or StandardMaterial Follow-Up After Generic Route Report Diagnostic Builder Extraction Plan - 2026-05-18

## Scope

Select the next focused follow-up after the generic app route-report diagnostic
builder extraction.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Candidate A - Material Route Architecture

Extract the generic unknown-to-route-diagnostic normalizer from the built-in
collector into the material queue route report module.

Why now:

- `createQueuedMaterialAppRouteReportDiagnostic()` now expects normalized route
  diagnostics, but the normalizer that converts unknown diagnostics into
  `WebGpuAppMaterialQueueRouteDiagnostic` still lives in
  `queued-built-in-app-resource-set.ts`.
- That normalizer is already generic in practice: it copies code, message,
  severity, render identity, material family/kind, render phase, blend preset,
  and serializable entity fields.
- Moving it next would keep built-in compatibility translation local while
  giving future non-built-in route collectors the same JSON-safe diagnostic
  normalization helper.

Risks:

- Built-in compatibility translation must not move with the generic normalizer.
  `queuedPrepareRouteDiagnosticToAppDiagnostic()` should remain in the built-in
  collector until custom app-level rendering exists.
- The helper should not broaden the diagnostic schema or accept raw GPU/resource
  handles.

## Candidate B - StandardMaterial/glTF Fidelity

Add another StandardMaterial/glTF browser fixture for a remaining texture or
render-state combination.

Why not next:

- The generic route-report path just moved one layer outward, and the diagnostic
  normalizer is the next small built-in-local generic seam.
- Recent StandardMaterial/glTF browser work already covers the highest-risk
  combined texture paths, including alpha-mask plus emissive.

## Candidate C - Diagnostics/Tooling

Add a route-diagnostics overview document describing queue item, routed item,
and diagnostic normalization boundaries.

Why not next:

- The code seam is clear enough to implement with a targeted unit test.
- A summary document would be more useful after the normalizer and report
  builder are both generic helpers.

## Selected Follow-Up

Select Candidate A: extract a generic route diagnostic normalizer into the
material queue route report module.

Proposed task:

```md
### task-1493 — Extract generic route diagnostic normalizer

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`,
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic exported helper that converts unknown diagnostics into zero or
  one `WebGpuAppMaterialQueueRouteDiagnostic` values using the current JSON-safe
  field allowlist.
- Route `collectQueuedBuiltInAppResourceSet()` through the generic normalizer
  after its built-in compatibility diagnostic translation.
- Add targeted coverage proving non-object diagnostics are skipped, JSON-safe
  fields are preserved, invalid entity fields are omitted, and raw GPU/source
  fields do not leak.
- Keep built-in missing-family and material-mismatch diagnostic translation in
  the built-in collector, and do not add app-level non-built-in rendering.
```

## Notes

This is a natural follow-up to the generic report builder: the builder should
receive normalized route diagnostics, and the normalizer should be reusable
without inheriting built-in app-family policy.
