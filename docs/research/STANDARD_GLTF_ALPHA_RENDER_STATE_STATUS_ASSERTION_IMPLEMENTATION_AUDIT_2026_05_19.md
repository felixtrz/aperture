# Standard glTF Alpha Render-State Status Assertion Implementation Audit

Date: 2026-05-19

Tasks: `task-1758`, `task-1759`

## Scope

Audit the focused alpha/render-state assertion hardening slice for existing
StandardMaterial/glTF browser fixtures.

Files inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_2026_05_19.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`
- `references/three.js/build/three.webgpu.js`
- `references/engine/src/scene/materials/material.js`
- `references/engine/src/scene/materials/standard-material.js`

## Implementation

- Tightened the alpha-blend texture browser fixture to assert the JSON-safe
  source render state (`alphaMode: "BLEND"`, `alphaCutoff: 0.5`,
  `doubleSided: false`) and the exact mapped `alphaCutoff`.
- Tightened the alpha-mask texture browser fixture to assert the JSON-safe
  source render state (`alphaMode: "MASK"`, `alphaCutoff: 0.5`,
  `doubleSided: true`) and exact mapped depth state.
- Tightened the alpha-mask backface fixture to assert exact mapped depth state.

## Reference Notes

The local three.js and PlayCanvas references both keep alpha, blend, culling,
and depth behavior as material/render-state concerns that feed renderer
pipeline decisions. Aperture's existing status surface follows the same broad
shape while keeping source glTF material data renderer-independent and exposing
only JSON-safe mapped render-state values.

## Boundary Audit

- ECS authority is unchanged. The slice edits tests only.
- Render extraction and source asset contracts are unchanged.
- WebGPU ownership is unchanged; no GPU resources or backend handles are added
  to status JSON.
- Public API shape is unchanged.
- The browser assertions now better pin the existing material mapping contract
  without adding IBL, shadows, binary GLB loading, public custom material APIs,
  or app-owned adapter facades.

## Validation

- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "(blends translucent base-color pixels|masks pixels with base-color alpha|alpha-mask backface)"`

## Recommendation

Proceed to tracker/backlog alignment, then keep `task-1761` as the next
implementation slice because the depth-attachment issue is a real render
correctness blocker for overlapping opaque draws.
