# Next Route Or StandardMaterial Follow-Up After Generic Route Report Diagnostic Builder Plan - 2026-05-18

## Scope

Select the next route or StandardMaterial follow-up after the collector
genericization plan audit and tracker/backlog alignment.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_COLLECTOR_GENERICIZATION_AFTER_ROUTE_SURFACE_AUDIT_PLAN_2026_05_18.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`

## Candidate A - Material Route Architecture

Implement the generic app material queue route report diagnostic builder
selected by the collector genericization plan.

Why now:

- The plan and audit agree this is the next small code seam in the material
  route spine.
- It removes one more generic diagnostic/report responsibility from the
  built-in collector without pretending non-built-in app rendering exists.
- The test can use a non-built-in fixture to prove generic JSON-safe
  serialization while preserving the built-in app diagnostic shape.

Risks:

- The helper should normalize only report serialization. It should not own
  built-in compatibility messages, source asset lookup, or frame-resource
  preparation.

## Candidate B - StandardMaterial/glTF Fidelity

Add another StandardMaterial/glTF fixture for a remaining texture or render
state combination.

Why not next:

- Recent browser coverage already exercises combined metallic-roughness,
  normal, occlusion, emissive, and alpha-mask paths.
- The generic app route spine is the current architecture risk, and the selected
  builder extraction is small enough to finish before returning to fidelity
  fixtures.

## Candidate C - Diagnostics/Tooling

Add a route-contract overview or another tracker-only refinement.

Why not next:

- The tracker/backlog alignment has a concrete implementation target.
- Another documentation-only task would delay the low-risk extraction that the
  last audit already identified.

## Selected Follow-Up

Select Candidate A: implement the generic app route report diagnostic builder
extraction.

Proposed task:

```md
### task-1485 — Extract generic app route report diagnostic builder

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`,
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic helper that builds the
  `webGpuApp.materialQueueRouteReport` diagnostic from `MaterialQueueItem[]`,
  `QueuedMaterialAppResourceItem[]`, normalized route diagnostics, and a reusable
  route report shell.
- Route `collectQueuedBuiltInAppResourceSet()` through the helper without
  changing its public diagnostic JSON shape.
- Add a test-only non-built-in material family fixture proving queue-item and
  routed-item serialization stays JSON-safe and excludes source assets,
  adapters, app objects, and raw GPU handles.
- Keep built-in missing-family diagnostic translation in the built-in collector
  and do not add app-level non-built-in rendering.
```

## Notes

This is the right next implementation because it converts the latest audit
result into a small, testable route-contract cleanup. StandardMaterial fidelity
can resume after the app route diagnostic/report surface is no longer
built-in-local.
