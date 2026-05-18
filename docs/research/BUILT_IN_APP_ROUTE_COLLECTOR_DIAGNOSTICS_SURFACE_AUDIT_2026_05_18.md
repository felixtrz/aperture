# Built-In App Route Collector Diagnostics Surface Audit - 2026-05-18

## Scope

Audit remaining built-in-specific app route collector diagnostics and
serialization surfaces after the generic routed-item report helper.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `docs/research/GENERIC_APP_ROUTE_REPORT_ROUTED_ITEM_SERIALIZATION_AUDIT_2026_05_18.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_AUDIT_2026_05_18.md`

## Findings

Acceptable built-in compatibility surfaces:

- `QueuedBuiltInAppResourceItem` and `QueuedBuiltInAppResourceSet` are now
  aliases over generic queued material app item/set contracts. They remain
  useful compatibility names for the currently active built-in app renderer.
- `QueuedBuiltInMaterialAdapter` and the built-in adapter registry are expected
  while only built-in material families have app-level rendering resources.
- `queuedPrepareRouteDiagnosticToAppDiagnostic()` intentionally translates
  generic missing-adapter and material-mismatch diagnostics into the current
  WebGPU app diagnostic codes and built-in support message.

Surfaces that are good candidates for genericization:

- `createWebGpuAppMaterialQueueRouteReportDiagnostic()` is still local to
  `queued-built-in-app-resource-set.ts` and accepts
  `QueuedBuiltInAppResourceItem[]`, even though routed-item serialization now
  only needs `QueuedMaterialAppResourceItem`.
- `materialQueueItemToRouteQueueItem()` is also local to the built-in collector
  but depends only on the generic `MaterialQueueItem` shape.
- The route report diagnostic builder combines generic queue/routed-item
  serialization with a built-in-local diagnostic wrapper. That is acceptable for
  compatibility, but it is the next obvious seam to make testable with a
  non-built-in fixture.

Non-blocking deferred surfaces:

- `indexQueuedSourceAssets()` is generic in practice, but it is coupled to the
  built-in collector's current source asset lookup path. Extracting it now would
  not improve diagnostics or app behavior enough to justify the churn.
- The built-in missing-family message should keep listing the supported
  built-in families until real app-level non-built-in material rendering exists.

## Recommendation

Use the next planning task to select a small implementation slice that extracts
or exposes a generic app material queue route report diagnostic builder. The
slice should preserve the current built-in diagnostic JSON shape while adding a
test-only non-built-in fixture for the generic queue-item and routed-item
serialization path.

Avoid rewriting `collectQueuedBuiltInAppResourceSet()` wholesale until the
diagnostic/report helpers around it are generic and covered.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
