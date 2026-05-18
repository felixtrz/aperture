# Invalid Emissive-Factor glTF Mapping Plan Audit

Date: 2026-05-18

Task: `task-1611`

## Scope

Audit the `task-1610` plan to add invalid `emissiveFactor` mapper coverage.

## Findings

- The selected follow-up is concrete enough for one focused run.
- It complements the valid emissive-factor-only mapper test added in
  `task-1607`.
- The expected behavior already exists in `gltf-material.ts`; the work should
  be test-only unless the regression exposes a focused defect.

## Boundary Check

- ECS authority and render extraction boundaries are preserved.
- WebGPU ownership is untouched because this is render-bridge unit coverage.
- No browser fixture, shader, route, binary GLB loading, IBL, shadow, or
  non-built-in rendering work is required.

## Recommendation

Proceed to `task-1612` in `test/materials/gltf-material.test.ts`.
