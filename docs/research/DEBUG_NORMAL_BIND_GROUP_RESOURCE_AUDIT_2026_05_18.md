# DebugNormal Bind Group Resource Audit

Date: 2026-05-18

## Scope

Audit the `task-1386` DebugNormalMaterial group-2 bind group layout/resource
helpers.

## References Inspected

- `docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_BIND_GROUP_PLAN_AUDIT_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/debug-normal-bind-group.ts`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `test/webgpu/debug-normal-bind-group.test.ts`

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

What is now present:

- DebugNormalMaterial group-2 layout metadata and descriptor planning for the
  shader's material uniform buffer binding;
- bind group descriptor/resource helpers that consume a renderer-owned material
  buffer resource key and raw buffer resource;
- JSON-safe bind group resource inspection that omits the raw bind group handle;
- targeted tests for descriptor planning, resource creation, stable resource
  keys, JSON safety, layout metadata, and missing material/buffer diagnostics.

Boundary checks:

- No ECS component, render extraction contract, source asset schema, app route
  adapter, frame-resource helper, browser rendering, IBL, shadows, or GLB viewer
  behavior changed.
- GPU resources remain in `@aperture-engine/webgpu`.
- Active built-in app routing still excludes `debug-normal`.

## Recommendation

Run tracker/backlog alignment next. The next DebugNormalMaterial prerequisite
should be planned after this bind group helper, likely frame resources before
route adapter activation.

## Validation

- `pnpm exec vitest run test/webgpu/debug-normal-bind-group.test.ts`
