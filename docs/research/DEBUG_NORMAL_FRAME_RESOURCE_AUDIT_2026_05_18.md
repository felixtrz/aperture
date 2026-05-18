# DebugNormal Frame Resource Audit

Date: 2026-05-18

## Scope

Audit the implemented DebugNormalMaterial frame-resource helper.

## References Inspected

- `docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`
- `test/webgpu/debug-normal-frame-resources.test.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `docs/ARCHITECTURE.md`

## Findings

- The implementation adds a focused frame-resource helper that uploads mesh,
  view uniforms, world transforms, the debug-normal material buffer, shared
  bind groups, and the group-2 material bind group.
- Prepared mesh and prepared material resource inputs are accepted, preserving a
  path for later app cache/reuse integration.
- Missing required inputs return diagnostics and no resources.
- The helper remains renderer-owned and WebGPU-only. It does not introduce a
  scene graph, app route activation, browser rendering, or GLB behavior.

## Validation

- `pnpm exec vitest run test/webgpu/debug-normal-frame-resources.test.ts`

## Recommendation

Update the tracker/backlog for the frame-resource prerequisite, then plan the
next DebugNormalMaterial app cache/reuse or route activation slice.
