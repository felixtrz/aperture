# StandardMaterial Metallic-Roughness Texture Browser Coverage Plan

Date: 2026-05-17

Task: `task-1064`

## Goal

Decide the smallest browser-visible coverage for StandardMaterial base-color
plus metallic-roughness textures.

## References Inspected

- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`

## Current State

The materials showcase already authors a StandardMaterial with:

- `baseColorTexture`;
- `metallicRoughnessTexture`;
- `occlusionTexture`;
- `emissiveTexture`.

The Playwright test verifies the example publishes those texture feature names,
renders three visible material regions, and keeps the StandardMaterial region
visibly distinct from Unlit and Matcap regions.

Unit coverage already verifies StandardMaterial shader/bind-group/cache support
for base-color and metallic-roughness texture variants.

## Decision

Do not add a broad new browser example now. The next browser slice should be a
controlled StandardMaterial texture verification scenario, not a GLB viewer and
not another broad showcase assertion.

The smallest useful future test would:

- render two or three StandardMaterial quads/cubes with fixed camera/light setup;
- use tiny authored textures with intentionally different base color and
  metallic-roughness channels;
- assert resource feature metadata and stable sampled pixel differences;
- include frame diagnostics when the texture resources are missing or not ready.

## Non-Goals

- Do not start GLB viewer work in this slice.
- Do not claim full glTF PBR fidelity from the current showcase.
- Do not add IBL, shadows, UV transforms, UV1 shader support, or sampler
  conversion in this browser coverage task.

## Follow-Up

Prefer the next implementation work on StandardMaterial texture
semantic/color-space readiness diagnostics or a controlled texture browser test.
Keep GLB material mapping deferred until those diagnostics are honest.
