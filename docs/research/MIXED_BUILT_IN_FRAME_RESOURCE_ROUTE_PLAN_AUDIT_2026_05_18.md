# Mixed Built-In Frame Resource Route Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1336` plan selecting a mixed built-in frame-resource route
regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_DEPENDENCY_FAILURE_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and fits the
current material-route priority.

The regression is appropriately narrow because it:

- stays on the WebGPU route/prepared-resource test surface;
- exercises the production built-in wrapper over the generic collector;
- does not require new source asset schemas, ECS components, render extraction
  behavior, browser examples, shaders, GPU uploads, app-level non-built-in
  routing, GLB loading, IBL, shadows, or GLB viewer behavior;
- pins JSON-safe reporting and deterministic resource key summaries rather than
  changing public API shape.

Boundary checks:

- ECS remains authoritative because the test starts from queued app resource
  items and does not introduce renderer-owned gameplay state.
- Render extraction remains the boundary because no renderer code queries ECS.
- WebGPU resources remain backend-owned; the test uses fake resource shells and
  asserts raw handles are not serialized.
- The selected scope is compatible with Decision 0010 because it strengthens
  route-family behavior without opening source `MaterialKind`.

## Recommendation

Implement `task-1338` as planned. Keep it to one mixed built-in frame-resource
regression unless the test exposes a small focused defect in the wrapper.

## Validation

Documentation-only audit; covered by final formatting and diff checks.
