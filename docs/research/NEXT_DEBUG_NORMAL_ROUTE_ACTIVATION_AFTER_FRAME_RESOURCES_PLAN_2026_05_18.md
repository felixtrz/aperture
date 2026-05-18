# Next DebugNormal Route Activation Plan After Frame Resources

Date: 2026-05-18

## Scope

Plan the next DebugNormalMaterial route activation slice after lower-level frame
resources exist.

## References Inspected

- `docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`
- `references/engine/src/scene/frame-graph.js`
- `references/three.js/src/renderers/common/Bindings.js`

## Candidate Comparison

### DebugNormal App Frame-Resource Cache/Reuse

Wrap `createDebugNormalFrameGpuResources()` in an app-level helper that can
reuse same-key frame resources, update dynamic view/transform buffers, and
track reuse counters.

Why now:

- The low-level frame-resource helper is available and tested.
- Existing Unlit and Matcap app helpers establish the app cache/reuse pattern.
- Active route wiring needs this app-level resource boundary to keep routing
  from directly owning ad hoc GPU setup.

### Direct App Route Activation

Add DebugNormalMaterial to the active built-in route table.

Why defer:

- Route activation should not bypass cache/reuse accounting.
- Diagnostics and summaries are easier to keep honest once the app helper shape
  exists.

### Browser Pixel Coverage

Add an end-to-end debug-normal browser fixture.

Why defer:

- Browser verification should follow active app route resources. Otherwise it
  would need special-case setup outside the intended material-family route.

## Selected Follow-Up

Select DebugNormal app frame-resource cache/reuse integration.

### task-1396 Selection

Category: `webgpu-render`

Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`, targeted tests,
and exports only if needed.

Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_FRAME_RESOURCES_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/app-frame-resource-utils.ts`,
`packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a DebugNormalMaterial app frame-resource helper that wraps
  `createDebugNormalFrameGpuResources()`.
- Reuse same-key cached mesh/material/bind-group resources and update dynamic
  view/transform buffers in place when sizes match.
- Track creation/reuse counters consistently with existing built-in app frame
  resource reports.
- Add targeted tests for first-frame creation and same-key dynamic-buffer reuse.
- Do not add active app routing, browser rendering, binary GLB loading, IBL,
  shadows, or GLB viewer behavior.

## Recommendation

Audit this plan next. If it passes, implement the app frame-resource helper as
the next prerequisite before route activation.
