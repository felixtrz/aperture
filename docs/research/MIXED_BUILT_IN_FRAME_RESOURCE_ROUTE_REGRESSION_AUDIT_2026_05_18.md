# Mixed Built-In Frame Resource Route Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1338` mixed built-in frame-resource route regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_DEPENDENCY_FAILURE_PLAN_2026_05_18.md`
- `docs/research/MIXED_BUILT_IN_FRAME_RESOURCE_ROUTE_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `references/engine/src/scene/frame-graph.js`
- `references/engine/src/scene/layer.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/webgl-fallback/WebGLBackend.js`

## Findings

Pass. The regression satisfies the selected acceptance criteria and stays on the
WebGPU route/prepared-resource boundary.

What is now pinned:

- a single preparation call routes mixed built-in `unlit` and `matcap` items
  through `prepareQueuedBuiltInFrameResourceSet`;
- duplicate unlit pipeline keys create one pipeline plan while both unlit items
  still append frame resources;
- the matcap item creates a second pipeline plan and family bucket entry;
- `byFamilySummary`, family-specific buckets, mesh resources,
  source-to-prepared mesh/material key maps, and pipeline-scoped bind group keys
  are deterministic;
- serialized results omit raw GPU handles and source material payload labels.

Boundary checks:

- No ECS components, source asset schemas, render extraction, snapshots, app
  facade behavior, shader code, GPU upload code, or draw submission changed.
- WebGPU resources remain backend-owned; the test uses fake resource shells and
  validates JSON-safe summaries.
- App-level non-built-in material rendering, binary GLB loading, IBL, shadows,
  and GLB viewer behavior remain deferred.

## Recommendation

Run tracker/backlog alignment next. The next implementation slice can either
continue route-spine hardening with app-level mixed built-in route diagnostics
or return to a narrow StandardMaterial/glTF fidelity diagnostic.

## Validation

- `pnpm exec vitest run test/webgpu/queued-built-in-frame-resource-set.test.ts`
