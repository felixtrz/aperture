# DebugNormal Material Buffer Resource Audit

Date: 2026-05-18

## Scope

Audit the `task-1381` debug-normal material buffer resource helper.

## References Inspected

- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `test/webgpu/debug-normal-material-buffer.test.ts`
- `packages/webgpu/src/webgpu/unlit-material-buffer.ts`
- `packages/webgpu/src/webgpu/matcap-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

What is now present:

- a documented 16-byte debug-normal material uniform layout matching the shader's
  `mode` plus padding contract;
- source material packing for `DebugNormalMaterialAsset` with renderer-owned
  uniform bytes and empty dependencies;
- descriptor and preparation-plan helpers with stable material-buffer resource
  keys;
- a WebGPU buffer resource helper that owns the raw uniform buffer on the
  renderer side;
- a JSON-safe resource inspection helper that omits the raw `uniformBuffer`;
- targeted tests for packing, descriptor shape, resource creation, JSON safety,
  and failure diagnostics.

Boundary checks:

- No ECS component, render extraction contract, source asset schema, app route
  adapter, frame-resource helper, bind group, browser rendering, IBL, shadows,
  or GLB viewer behavior changed.
- GPU resources remain in `@aperture-engine/webgpu`; source material data
  remains renderer-independent.
- Active built-in app routing still excludes `debug-normal`.

## Recommendation

Run tracker/backlog alignment next. Then plan the next DebugNormalMaterial route
activation prerequisite, likely bind group layout/resource helpers before frame
resources or route activation.

## Validation

- `pnpm exec vitest run test/webgpu/debug-normal-material-buffer.test.ts`
