# Active DebugNormal Route Integration Plan

Date: 2026-05-18

## Scope

Plan the next DebugNormalMaterial activation slice after app frame-resource
cache/reuse exists.

## References Inspected

- `docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Candidate Comparison

### Active App Route Resource Integration

Wire DebugNormalMaterial into the app resource path using the app
frame-resource helper and existing route summaries.

Why now:

- Source asset, preparation, shader metadata, pipeline descriptor, material
  buffer, bind group, frame-resource, and app frame-resource helpers now exist.
- This is the last resource-path prerequisite before browser pixel coverage.
- Existing app route summaries can verify the family route without adding a
  browser fixture yet.

### Browser DebugNormal Pixel Coverage

Add an end-to-end browser fixture that renders DebugNormalMaterial.

Why defer:

- Browser coverage should exercise the real app route. It should follow active
  resource integration rather than add one-off setup.

### Prepared DebugNormal Material Cache

Add a cross-cache-slot prepared material cache for DebugNormalMaterial.

Why defer:

- The current app frame-resource helper already covers same-key frame reuse.
- A prepared material cache can be selected later if route integration shows
  repeated cross-slot material preparation costs.

## Selected Follow-Up

Select active app route resource integration.

### task-1401 Selection

Category: `webgpu-render`

Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
targeted tests, and exports only if needed.

Reference anchor:
`docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and
analogous app route resource tests.

Acceptance criteria:

- Wire DebugNormalMaterial into the app route resource path using the
  app-frame-resource helper and existing generic route summaries.
- Report JSON-safe routed resource summaries and diagnostics for debug-normal
  family routes.
- Add targeted tests for app resource creation and route-summary shape.
- Keep browser pixel coverage, binary GLB loading, IBL, shadows, and GLB viewer
  behavior deferred.

## Recommendation

Audit this plan next. If it passes, implement route resource integration in one
focused slice.
