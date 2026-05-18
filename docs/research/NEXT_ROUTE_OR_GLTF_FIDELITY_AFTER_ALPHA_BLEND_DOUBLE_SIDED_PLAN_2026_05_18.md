# Next Route Or glTF Fidelity After Alpha Blend Double-Sided Plan

Date: 2026-05-18

## Scope

Plan the next focused route or glTF fidelity slice after glTF alpha-blend
double-sided browser coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLTF_ALPHA_BLEND_DOUBLE_SIDED_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_BLEND_DOUBLE_SIDED_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`
- `references/engine/src/scene/layer.js`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Add a generic frame-resource regression for a valid routed material item whose
pipeline object does not expose `getBindGroupLayout`.

Why now:

- Alpha-blend render-state, translucent texture pixels, and double-sided culling
  are pinned, so the next slice should return to the material route and
  prepared-resource spine.
- The generic `prepareQueuedMaterialFrameResourceSet()` already treats bind
  group layout access as a route prerequisite, but the failure branch is not
  pinned by a focused test.
- three.js keeps pipeline and binding preparation as renderer-owned state, and
  PlayCanvas compiles explicit per-frame render passes/layers before submission.
  Aperture's equivalent should continue to reject incomplete renderer-owned
  pipeline resources before creating per-item material resources.

Expected scope:

- `test/webgpu/queued-material-frame-resource-set.test.ts`
- Implementation files only if the regression exposes a focused defect.

### StandardMaterial / glTF Fidelity Candidate

Add another alpha-mode or double-sided browser branch.

Why defer:

- The recent group already covers alpha-blend render state, translucent pixels,
  and double-sided no-cull behavior.
- More glTF alpha coverage would be useful, but it would not address the current
  architecture risk around generic material-family route preparation.

### Diagnostics / Tooling Candidate

Add a tracker-only or docs-only audit for DebugNormalMaterial app activation
readiness.

Why defer:

- DebugNormalMaterial is a real future material family, but app activation needs
  material buffer/bind group/resource-set work. A small prepared-resource
  contract test gives a tighter next step without selecting that larger route.
- Tracker/backlog alignment already reflects the alpha-blend group.

## Selected Follow-Up

Select the route / prepared-resource candidate.

### task-1368 Selection

Category: `webgpu-render`

Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.

Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a generic frame-resource-set regression where `getPipelineView()` returns
  a valid pipeline resource whose `pipeline` lacks `getBindGroupLayout`.
- Assert the result is invalid, reports `webGpuApp.missingPipelineLayouts`,
  appends no frame resources, creates no mesh/material resource-key mappings,
  and exposes no raw GPU handles in JSON.
- Keep source assets, ECS extraction, app-level built-in routing,
  StandardMaterial/glTF behavior, IBL, shadows, and GLB viewer behavior
  unchanged.
- Run `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`.

## Recommendation

Audit this plan next. If it passes, implement the missing pipeline-layout
regression as the next focused prepared-resource contract slice.
