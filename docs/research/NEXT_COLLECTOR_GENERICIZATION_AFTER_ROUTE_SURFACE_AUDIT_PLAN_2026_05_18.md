# Next Collector Genericization After Route Surface Audit Plan - 2026-05-18

## Scope

Select the next focused task after the built-in app route collector diagnostics
surface audit.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BUILT_IN_APP_ROUTE_COLLECTOR_DIAGNOSTICS_SURFACE_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_ROUTED_ITEM_SERIALIZATION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Candidate A - Collector Genericization

Extract a generic app material queue route report diagnostic builder from
`queued-built-in-app-resource-set.ts`.

Why now:

- The queue item and routed item report shapes are already generic
  `MaterialQueueItem` / `QueuedMaterialAppResourceItem` metadata.
- `queuedMaterialAppResourceItemToRouteRoutedItem()` removed one
  built-in-specific serialization step, but the failure report builder still
  lives in the built-in collector and accepts `QueuedBuiltInAppResourceItem[]`.
- A narrow extraction can preserve the current
  `webGpuApp.materialQueueRouteReport` diagnostic JSON while making the report
  path testable with a non-built-in material family fixture.

Risks:

- The implementation must not rewrite `collectQueuedBuiltInAppResourceSet()` or
  imply app-level custom material rendering is supported.
- Built-in-specific diagnostic translation for unsupported app families should
  remain in the built-in collector until non-built-in app rendering exists.

## Candidate B - StandardMaterial/glTF Fidelity

Add another StandardMaterial browser fixture for a remaining glTF texture,
sampler, or render-state combination.

Why not next:

- Recent runs already added high-risk combined texture and alpha-mask/emissive
  browser coverage.
- The active architectural risk is still the material-family app route spine.
  Adding another StandardMaterial fixture now would improve coverage but would
  not reduce the built-in collector coupling called out by the audit.

## Candidate C - Diagnostics/Tooling

Add a route-contract overview document or public tracker refinement.

Why not next:

- The route audit already identifies a specific implementation seam.
- A summary-only document would not improve the generic route path enough to
  justify another planning cycle before the extracted builder is covered.

## Selected Follow-Up

Select Candidate A: extract a generic app material queue route report diagnostic
builder over `MaterialQueueItem` and `QueuedMaterialAppResourceItem`.

Proposed task:

```md
### task-1485 — Extract generic app route report diagnostic builder

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_COLLECTOR_GENERICIZATION_AFTER_ROUTE_SURFACE_AUDIT_PLAN_2026_05_18.md`,
`docs/research/BUILT_IN_APP_ROUTE_COLLECTOR_DIAGNOSTICS_SURFACE_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

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

This should be an extraction, not a collector rewrite. The built-in collector
can keep source asset indexing and app-family compatibility messages while the
route report diagnostic becomes a reusable generic surface for future material
families.
