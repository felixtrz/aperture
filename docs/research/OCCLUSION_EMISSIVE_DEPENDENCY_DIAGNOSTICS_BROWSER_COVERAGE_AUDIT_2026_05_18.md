# Occlusion/emissive dependency diagnostics browser coverage audit - 2026-05-18

## Scope

Audit the `task-1542` implementation that adds browser coverage for unavailable
occlusion/emissive texture dependencies.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/OCCLUSION_EMISSIVE_DEPENDENCY_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Findings

- The new `occlusion-emissive-delayed-dependencies` scenario maps a
  GLB-shaped StandardMaterial with both `occlusionTexture` and
  `emissiveTexture` bindings.
- The fixture marks the occlusion texture loading and the emissive sampler
  failed, then verifies slot-specific material dependency and texture readiness
  diagnostics.
- The browser test asserts no draw submission, no pipeline keys, zero prepared
  texture/sampler/material-buffer resources, and JSON-safe status.
- The two-texture fixture correctly uses custom assertions instead of the older
  one-texture expected-failure helper.

## Architecture check

- ECS remains authoritative because entities and source assets are authored
  through the existing ECS/app facade path.
- Render extraction remains the boundary because unavailable dependencies
  prevent extracted mesh draws from becoming WebGPU work.
- WebGPU ownership is preserved because no prepared GPU resources are created
  for the failed path and status JSON exposes no raw handles.
- The task does not add binary GLB loading, IBL, shadows, broad PBR behavior, or
  app-level non-built-in rendering.

## Recommendation

Proceed to tracker/backlog alignment. The remaining StandardMaterial/glTF
dependency work is now mostly matrix breadth; the next planning step should
compare route-boundary cleanup against one more narrowly scoped fidelity slice.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "occlusion and emissive delayed dependencies"`
