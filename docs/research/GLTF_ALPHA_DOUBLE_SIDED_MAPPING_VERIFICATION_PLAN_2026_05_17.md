# glTF Alpha/Double-Sided Mapping Verification Plan

Date: 2026-05-17

Task: `task-1061`

## Goal

Identify the smallest coverage gap for glTF `alphaMode`, `alphaCutoff`, and
`doubleSided` mapping into Aperture StandardMaterial render state.

## References Inspected

- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/webgpu/standard-render-state-summary.test.ts`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_pbr/src/pbr_material.rs`

## Current State

`createMaterialAssetFromGltfMaterial()` already maps:

- missing/`OPAQUE` to `alphaMode: "opaque"`;
- `MASK` to `alphaMode: "mask"` with `alphaCutoff` fallback `0.5`;
- `BLEND` to `alphaMode: "blend"`, alpha blending, and depth writes disabled;
- `doubleSided: true` to `cullMode: "none"`;
- otherwise `cullMode: "back"`.

This matches the Bevy/glTF pattern conceptually: glTF alpha mode and
double-sided flags become material render-state data, not backend-owned GPU
state.

## Coverage Gap

Existing StandardMaterial render-state summary tests cover authored
StandardMaterial render-state behavior, but `test/assets/gltf-asset-mapping.test.ts`
does not cover the orchestration layer where glTF material JSON becomes planned
Aperture material assets.

## Recommendation

Add test-only coverage in `test/assets/gltf-asset-mapping.test.ts`.

The test should create a small glTF root with StandardMaterial materials for:

- default/`OPAQUE`;
- `MASK` with explicit `alphaCutoff`;
- `MASK` without `alphaCutoff` to lock the `0.5` fallback;
- `BLEND`;
- `doubleSided: true`.

Assertions should inspect planned material assets and verify only source
render-state fields. No WebGPU backend behavior should change.

## Follow-Up Task

Use `task-1062` to add the mapping tests and run targeted asset tests. If the
existing implementation fails, fix only the mapping behavior needed to satisfy
the documented glTF render-state contract.
