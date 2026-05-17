# glTF Alpha/Double-Sided Mapping Boundary Audit

Date: 2026-05-17

Task: `task-1063`

## Scope

Audit the `task-1062` glTF alpha-mode and double-sided mapping coverage.

## Reference Anchors Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GLTF_ALPHA_DOUBLE_SIDED_MAPPING_VERIFICATION_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/webgpu/standard-render-state-summary.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`

## Findings

### Source Asset Boundary

Pass. The added coverage exercises glTF JSON to Aperture material asset mapping.
It verifies StandardMaterial source render-state fields only. No WebGPU backend
state, GPU resources, pipeline caches, or app routing behavior changed.

### glTF Fidelity

Pass. The tests lock the intended glTF mapping:

- missing alpha mode maps to opaque;
- `MASK` maps to mask with explicit or default `alphaCutoff`;
- `BLEND` maps to alpha blend with depth writes disabled;
- `doubleSided: true` maps to `cullMode: "none"`;
- omitted `doubleSided` keeps back-face culling.

This matches the local Bevy/glTF reference pattern conceptually while preserving
Aperture's TypeScript material asset shape.

### Deferred Features

Pass. The task does not imply full GLB viewer readiness, IBL, shadows, advanced
glTF extensions, or broader material imports. Unsupported material features
remain governed by existing diagnostics and deferred follow-up tasks.

## Validation

- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/assets/gltf-asset-mapping-json.test.ts test/webgpu/standard-render-state-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

Result: passed.

## Follow-Up

Next concrete StandardMaterial/glTF fidelity follow-up: plan browser-visible
coverage for StandardMaterial base-color plus metallic-roughness textures,
without advancing the GLB viewer ahead of honest material support.
