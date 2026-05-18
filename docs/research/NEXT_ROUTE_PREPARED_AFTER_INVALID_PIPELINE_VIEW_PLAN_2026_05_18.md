# Next Route Prepared After Invalid Pipeline View Plan

Date: 2026-05-18

## Scope

Plan the next focused route/prepared-resource slice after invalid pipeline-view
coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_INVALID_PIPELINE_VIEW_AUDIT_2026_05_18.md`
- `packages/render/src/materials/debug-normal-preparation.ts`
- `packages/render/src/materials/factories.ts`
- `packages/render/src/materials/types.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `test/webgpu/built-in-material-queue-family.test.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`
- `test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `test/webgpu/debug-normal-shader.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Candidate Comparison

### Remaining Generic Route Diagnostic Candidate

Add another generic frame-resource diagnostic regression.

Why defer:

- The generic collector now has successful route coverage, dependency-failure
  coverage, missing-layout coverage, and invalid-pipeline-view coverage.
- Additional generic failures would be useful, but the current risk has shifted
  toward deciding how a real next material family should enter the app route.

### DebugNormalMaterial Route-Readiness Candidate

Document DebugNormalMaterial app route activation readiness and blockers.

Why now:

- DebugNormalMaterial already has source material factories/types, a
  renderer-independent preparation plan, WGSL metadata, and pipeline descriptor
  planning.
- It is intentionally not in the active built-in app route family table yet.
- A readiness map can define the smallest safe activation sequence before
  adding material buffers, bind groups, frame resources, route adapters, and
  browser pixel coverage.

Expected scope:

- `docs/research`
- No implementation code unless the audit finds a tiny documentation
  correction.

### StandardMaterial / glTF Fidelity Candidate

Return to another StandardMaterial/glTF texture or alpha fidelity branch.

Why defer:

- Recent runs already added several glTF alpha-blend browser slices.
- DebugNormalMaterial readiness is a better next architecture checkpoint before
  adding another material-family route.

## Selected Follow-Up

Select the DebugNormalMaterial route-readiness candidate.

### task-1378 Selection

Category: `docs-tooling`

Package/write-scope: `docs/research`.

Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/debug-normal-preparation.ts`,
`packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`,
`test/webgpu/built-in-material-queue-family.test.ts`,
`test/webgpu/built-in-material-queue-adapter.test.ts`, and recent
route/prepared-resource audits.

Acceptance criteria:

- Document which DebugNormalMaterial pieces are already present: source asset
  type/factory, preparation plan, shader metadata, and pipeline descriptor plan.
- Document why it is not active in app-level built-in routing yet.
- Define the smallest safe activation sequence and tests needed before browser
  rendering can be enabled.
- Keep app-level DebugNormalMaterial rendering, binary GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

## Recommendation

Audit this plan next. If it passes, add the DebugNormalMaterial route-readiness
map as the next focused docs/tooling slice.
