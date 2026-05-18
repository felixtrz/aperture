# Metallic-roughness dependency diagnostics browser coverage audit - 2026-05-18

## Scope

Audit the `task-1536` implementation that adds browser coverage for unavailable
`metallicRoughnessTexture` dependencies.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/METALLIC_ROUGHNESS_DEPENDENCY_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Findings

- The new `metallic-roughness-delayed-dependencies` scenario maps a
  glTF-shaped `metallicRoughnessTexture` binding, then marks the texture loading
  and sampler failed before render.
- The Playwright assertion verifies the slot-specific dependency report,
  texture readiness diagnostics, no draw submission, zero texture/sampler/
  material-buffer resources, no pipeline keys, and JSON-safe status.
- The implementation reuses source asset registration and existing dependency
  readiness paths rather than adding renderer-owned fallback material state.
- The small fixture helper fix converts full status keys back to handle IDs
  before marking source assets loading/failed, avoiding double-prefixed handles.

## Architecture check

- ECS remains authoritative: renderability is still authored through ECS
  components and source material assets.
- Rendering remains derived: invalid dependency readiness prevents draw
  submission instead of letting WebGPU invent substitute source state.
- WebGPU ownership is preserved: GPU resources are not created for the failed
  path and status JSON exposes no raw backend handles.
- The task does not add binary GLB loading, IBL, shadows, broad PBR behavior, or
  app-level non-built-in material rendering.

## Recommendation

Proceed to tracker/backlog alignment. The next implementation slice can be
selected after the tracker reflects this new metallic-roughness dependency
coverage.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "metallic-roughness delayed dependencies"`
