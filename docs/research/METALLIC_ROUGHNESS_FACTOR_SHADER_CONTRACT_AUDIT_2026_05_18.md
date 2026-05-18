# Metallic-Roughness Factor Shader Contract Audit

Date: 2026-05-18

Task: `task-1669`

## Scope

Audit the `task-1668` StandardMaterial metallic-roughness texture factor shader
contract regression.

Reference files inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_SHELL_PLAN_2026_05_18.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_SHELL_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/standard-shader.test.ts`

## Findings

- The regression locks both standalone metallic-roughness texture WGSL and
  combined base-color plus metallic-roughness WGSL to multiply texture blue by
  `material.metallicFactor` and texture green by `material.roughnessFactor`.
- No production shader change was needed; the generated WGSL already followed
  the expected glTF metallic-roughness factor contract.
- The change is test-only and does not alter app routing, public material source
  APIs, browser fixtures, GPU resources, IBL, shadows, or non-built-in adapter
  registration.

## Boundary Check

- ECS and render extraction remain untouched.
- WebGPU ownership remains backend-only; the test validates generated WGSL
  strings and metadata without creating device resources.
- The regression supports the StandardMaterial fidelity track without expanding
  PBR scope.

## Validation

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Update tracker/backlog state and recommend a broader validation pass before the
next automation run continues into either app-level adapter registration
planning or another StandardMaterial/glTF browser fidelity slice.
