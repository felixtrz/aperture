# Prepared DebugNormal Material Cache Parity Audit — 2026-05-18

## Scope

Audited `task-1411`, which added prepared DebugNormal material cache parity
after the DebugNormal app route and browser pixel coverage were active.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`

## Findings

- The implementation preserves renderer-owned GPU resources. The new
  `PreparedDebugNormalMaterialCache` stores WebGPU buffer and bind group
  resources under `packages/webgpu`; ECS assets remain source data only.
- Cache keys include source material handle, source version, pipeline key, and
  material layout key. This matches the existing prepared material cache
  pattern and avoids accidental reuse across route/layout variants.
- `createOrReuseDebugNormalAppFrameResources()` still derives frame resources
  from extracted item data. It now passes a prepared material into
  `createDebugNormalFrameGpuResources()` when available, matching the
  Matcap/Unlit app-frame pattern.
- Prepared material cache summaries and built-in cache eviction now include the
  `debug-normal` family. The summaries remain JSON-safe and expose counts, not
  raw GPU handles.
- Focused tests cover first creation, direct cache reuse, reuse after
  mesh-only frame-resource misses, family summary counts, and app route
  compatibility.

## Boundaries

- No central mutable scene graph was introduced.
- No renderer-owned ECS/game state was introduced.
- No WebGL fallback or non-built-in custom material rendering was introduced.
- No GLB loading, IBL, shadows, or route-renaming work was pulled into this
  slice.

## Recommendation

Proceed with `task-1413`: update public tracker/backlog alignment for prepared
DebugNormal cache parity, then select the next material route or
StandardMaterial follow-up.
