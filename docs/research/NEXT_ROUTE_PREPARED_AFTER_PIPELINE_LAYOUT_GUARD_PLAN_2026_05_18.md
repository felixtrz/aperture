# Next Route Prepared After Pipeline Layout Guard Plan

Date: 2026-05-18

## Scope

Plan the next focused route/prepared-resource slice after the generic
missing-pipeline-layout frame-resource guard.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_PIPELINE_LAYOUT_GUARD_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Candidate Comparison

### Generic Route / Prepared-Resource Candidate

Add a generic frame-resource-set regression where `getPipelineView()` returns an
invalid pipeline view with diagnostics.

Why now:

- The missing-layout guard covers a structurally incomplete pipeline resource
  after a valid pipeline view.
- The earlier dependency and frame-resource failure tests cover later stages.
- The remaining unpinned early failure branch is an invalid pipeline view before
  layout lookup, texture/sampler dependency preparation, and frame-resource
  creation.

Expected scope:

- `test/webgpu/queued-material-frame-resource-set.test.ts`
- Implementation files only if the regression exposes a focused defect.

### DebugNormalMaterial Route-Readiness Candidate

Plan DebugNormalMaterial app activation requirements.

Why defer:

- DebugNormalMaterial shader and descriptor metadata exist, but app activation
  still needs material buffer, bind group, resource-set, route adapter, and
  browser pixel coverage decisions.
- That is a larger route family slice. It should follow after the generic
  frame-resource failure surface is fully pinned.

### StandardMaterial / glTF Fidelity Candidate

Return to another StandardMaterial/glTF texture or alpha fidelity branch.

Why defer:

- The recent alpha-blend group just completed several browser fidelity slices.
- The current architecture priority is the generic route/prepared-resource
  spine.

## Selected Follow-Up

Select the generic route / prepared-resource candidate.

### task-1373 Selection

Category: `webgpu-render`

Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.

Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a generic frame-resource-set regression where `getPipelineView()` returns
  `valid: false` with a diagnostic.
- Assert the result is invalid, preserves the pipeline-view diagnostic, creates
  no pipeline plans, no frame resources, no mesh/material resource-key mappings,
  and exposes no raw GPU handles in JSON.
- Keep source assets, ECS extraction, app-level built-in routing,
  StandardMaterial/glTF behavior, IBL, shadows, and GLB viewer behavior
  unchanged.
- Run `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`.

## Recommendation

Audit this plan next. If it passes, implement the invalid pipeline-view
regression as the next focused prepared-resource contract slice.
