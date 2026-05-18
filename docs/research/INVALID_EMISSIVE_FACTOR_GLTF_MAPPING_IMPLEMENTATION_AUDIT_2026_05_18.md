# Invalid Emissive-Factor glTF Mapping Implementation Audit

Date: 2026-05-18

Task: `task-1613`

## Scope

Audit the `task-1612` invalid `emissiveFactor` glTF mapping regression.

## Findings

- The new unit test authors malformed `emissiveFactor` data without changing
  WebGPU or browser fixtures.
- It asserts the report is invalid, the mapped asset remains a StandardMaterial,
  the emissive factor falls back to `[0, 0, 0]`, and the diagnostic uses
  `gltfMaterial.invalidField` for `emissiveFactor`.
- The test also verifies the mapping report JSON helper remains aligned with
  the JSON value helper.

## Boundary Check

- The implementation is test-only and stays at the render-bridge mapping layer.
- ECS authority and render extraction boundaries are unchanged.
- No WebGPU route, shader, browser, binary GLB, IBL, shadow, or non-built-in
  rendering behavior changed.

## Validation

- `pnpm exec vitest run test/materials/gltf-material.test.ts --testNamePattern "emissive factor"`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task can move away from
emissive-factor coverage unless a new defect appears.
