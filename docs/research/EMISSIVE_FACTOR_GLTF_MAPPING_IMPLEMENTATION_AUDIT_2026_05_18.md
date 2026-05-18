# Emissive-Factor glTF Mapping Implementation Audit

Date: 2026-05-18

Task: `task-1608`

## Scope

Audit the `task-1607` mapper-level regression for glTF `emissiveFactor`
without `emissiveTexture`.

## Findings

- The new glTF material mapping test authors `emissiveFactor` without
  `emissiveTexture`.
- It asserts the mapped StandardMaterial is valid, emits no diagnostics,
  preserves the factor, stores the expected scalar material values, and has no
  active emissive texture binding.
- The test revealed that absent texture bindings are represented as `null`,
  which is consistent with existing material asset shape.

## Boundary Check

- The implementation is test-only and stays in render-bridge mapping coverage.
- ECS authority and render extraction boundaries are unchanged.
- No WebGPU route, shader, browser, binary GLB, IBL, shadow, or non-built-in
  rendering behavior changed.

## Validation

- `pnpm exec vitest run test/materials/gltf-material.test.ts --testNamePattern "emissive factor"`

## Recommendation

Proceed to tracker/backlog alignment. The next task should select either a
substantive route/prepared-resource cleanup or another small material fidelity
unit/browser slice.
