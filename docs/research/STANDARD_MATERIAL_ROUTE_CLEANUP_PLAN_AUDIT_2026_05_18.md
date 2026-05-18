# StandardMaterial Route Cleanup Plan Audit

Date: 2026-05-18

## Scope

Audit
`docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_AFTER_GENERIC_BOUNDARY_PLAN_2026_05_18.md`
before implementation.

## References Inspected

- `docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_AFTER_GENERIC_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/REAL_MATERIAL_FAMILY_ROUTE_CRITERIA_AUDIT_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`

## Findings

The cleanup plan is appropriately narrow:

- It proposes a compatibility test for StandardMaterial route identity.
- It does not propose WGSL changes, PBR expansion, IBL, shadows, GLB viewer
  work, or new material-family APIs.
- It keeps app diagnostics JSON stable by preserving `routedResourceSet`.
- It keeps Standard frame-resource creation WebGPU-owned.

The plan preserves architecture boundaries:

- ECS remains authoritative for source authoring.
- Route items remain derived queue data.
- Prepared resources remain backend-owned.
- Diagnostics remain summary-based and JSON-safe.

## Implementation Readiness

Implementation can proceed as a focused test slice:

- Add StandardMaterial route identity assertions to existing WebGPU route tests.
- Reuse existing StandardMaterial assets and prepared store helpers.
- Avoid browser fixtures and shader changes.
- Keep validation to targeted WebGPU tests plus TypeScript.

## Outcome

No corrective plan change is needed. `task-1195` is safe to implement after the
generic route criteria fixture tasks, or sooner if the agent chooses the
StandardMaterial compatibility path as the next smallest validated slice.
