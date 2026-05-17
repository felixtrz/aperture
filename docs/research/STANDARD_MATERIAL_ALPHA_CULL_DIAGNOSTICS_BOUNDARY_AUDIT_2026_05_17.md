# StandardMaterial Alpha/Cull Diagnostics Boundary Audit - 2026-05-17

## Scope

Audit the `task-0964` StandardMaterial render-state summary helper and the
project progress tracker changes made in the same render-pipeline work slice.

This audit verifies that the helper is an inspection surface only, does not
mutate source material assets, does not expose raw GPU handles, and does not
change queue or pipeline behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_ALPHA_CULL_DIAGNOSTICS_PLAN_2026_05_17.md`
- `packages/render/src/materials/validation.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/webgpu/src/webgpu/material-render-state.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-render-state-summary.ts`
- `test/webgpu/standard-render-state-summary.test.ts`
- `test/webgpu/built-in-material-queue-phase.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Findings

The new helper stays within the intended WebGPU diagnostics boundary:

- `createStandardMaterialRenderStateSummary()` accepts a
  `StandardMaterialAsset`, optional string keys/tokens, render phase, and depth
  format. It returns only JSON-safe values.
- It calls existing renderer-independent material validation and existing
  WebGPU render-state token resolution. It does not prepare resources, create
  buffers, create bind groups, create pipelines, submit commands, or read ECS.
- It does not mutate the source `StandardMaterialAsset`; all returned source
  render-state values are copied into plain summary fields.
- It reports source validation warnings and optional source/pipeline/render-phase
  mismatches. These diagnostics are inspection data only and do not block or
  reroute draws.
- The helper is exported from `@aperture-engine/webgpu`, which is appropriate
  because it summarizes WebGPU pipeline-token behavior while consuming
  renderer-independent material source data.

## Render-Pipeline Behavior

No runtime render behavior changed:

- Existing StandardMaterial opaque, alpha-test, and transparent queue behavior
  is unchanged.
- Existing pipeline descriptor behavior for cull mode, depth writes, and blend
  state is unchanged.
- Existing StandardMaterial uniform packing for alpha mask, alpha blend, and
  double-sided flags is unchanged.

## Public Tracker

The new public dashboard is static and GitHub Pages friendly:

- `docs/index.html` now summarizes overall project state, current/next work,
  recently completed task groups, render-pipeline estimates, and missing pieces.
- `docs/render-pipeline-comparison.html` now includes an upfront phase status
  band with rough completion percentages and concrete missing work per phase.
- `AGENTS.md` and `agent/WAKE.md` now require future project-status changes to
  update the dashboard, and future render-pipeline work to update the detailed
  comparison page.

## Validation

- `pnpm exec vitest run test/webgpu/standard-render-state-summary.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/webgpu/standard-render-state-summary.test.ts test/webgpu/built-in-material-queue-phase.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- Browser smoke check of `http://127.0.0.1:4173/index.html`
- Browser smoke check of
  `http://127.0.0.1:4173/render-pipeline-comparison.html`
