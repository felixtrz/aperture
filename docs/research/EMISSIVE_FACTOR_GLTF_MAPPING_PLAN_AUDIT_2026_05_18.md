# Emissive-Factor glTF Mapping Plan Audit

Date: 2026-05-18

Task: `task-1606`

## Scope

Audit the `task-1605` plan to add mapper-level coverage for
`emissiveFactor` without `emissiveTexture`.

## Findings

- The selected follow-up is concrete enough for one focused run.
- The existing browser proof verifies rendered behavior; mapper-level unit
  coverage will pin the renderer-independent source material contract.
- The scope is limited to tests and does not require implementation changes
  unless a focused defect is exposed.

## Boundary Check

- ECS authority and render extraction boundaries are preserved.
- WebGPU ownership is untouched because this is render-bridge unit coverage.
- No browser fixture, shader, route, binary GLB loading, IBL, shadow, or
  non-built-in rendering work is required.

## Recommendation

Proceed to `task-1607` in `test/materials/gltf-material.test.ts`.
