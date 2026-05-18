# Opaque Double-Sided glTF Browser Coverage Plan Audit

Date: 2026-05-18

Task: `task-1571`

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_SAMPLER_WRAP_VISUAL_PROOF_PLAN_2026_05_18.md`:
add a glTF-shaped browser proof for opaque `doubleSided: true` render-state
mapping and backface rendering.

## Assessment

The selected follow-up is concrete enough for one focused run:

- The implementation can reuse the existing StandardMaterial glTF browser
  fixture and the existing backface sampling pattern used by alpha-mask and
  alpha-blend double-sided cases.
- The acceptance criteria are narrow: one opaque render-state scenario,
  JSON-safe render-state status, and a non-clear backface pixel/readback proof.
- The task does not require shader architecture, material-family routing,
  binary GLB loading, IBL, shadows, or broader alpha/cull matrices.

## Boundary Check

- ECS authority remains intact because the scenario still authors ECS
  components and source material assets.
- Render extraction remains the boundary; WebGPU rendering consumes the app
  snapshot/report path.
- WebGPU remains the only backend and GPU resources stay renderer-owned.
- The task is fixture/test coverage unless it exposes a focused defect.

## Recommendation

Proceed with `task-1572` as scoped. Stop and document a fixture-design issue if
the backface sample cannot be made deterministic without broadening the
scenario.
