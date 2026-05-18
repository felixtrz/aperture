# Next Material Route Or DebugNormal Follow-Up Plan

Date: 2026-05-18

## Scope

Plan the next focused slice after DebugNormalMaterial active app routing and
browser pixel coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BROWSER_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`

## Candidate Comparison

### Material Route Architecture Candidate

Start reducing the closed built-in route naming by renaming the internal
`built-in` app route resource set to a material-family route set.

Why defer:

- DebugNormal just entered the existing built-in family table, and a rename now
  would be mostly broad terminology churn.
- The actual generic boundary still needs a public custom material source
  contract before non-built-in app rendering can be honest.

### DebugNormal Cleanup Or Cache Candidate

Add a prepared DebugNormal material cache that mirrors the scalar built-in
material caches and lets app route frame resources reuse the DebugNormal
material uniform buffer and bind group across frame-resource cache slot misses.

Why now:

- Active routing and browser pixels are proven, so the remaining DebugNormal
  material-resource gap is cache/lifetime parity with unlit, matcap, and
  standard scalar material paths.
- The scope can stay small: one prepared cache module, app helper integration,
  cache summary extension, and targeted tests.
- This improves renderer-owned resource lifetime without changing ECS
  authoring, render extraction, or shader behavior.

### StandardMaterial / glTF Fidelity Candidate

Return to StandardMaterial texture/PBR fidelity, such as another texture slot or
sampler behavior edge case.

Why defer:

- The current route architecture work just added a fourth material family. A
  small cache parity slice is a cleaner end to this DebugNormal activation
  thread before switching back to StandardMaterial fidelity.

## Selected Follow-Up

Select prepared DebugNormal material cache parity.

### task-1411 Selection

Category: `webgpu-render`

Package/write-scope:
`packages/webgpu/src/webgpu/prepared-debug-normal-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`,
`packages/webgpu/src/webgpu/prepared-app-material-resource.ts`,
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/app.ts`, targeted tests, and exports if needed.

Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`, and
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`.

Acceptance criteria:

- Add a renderer-owned prepared DebugNormal material cache keyed by source
  material handle/version and pipeline key where applicable.
- Integrate the cache into DebugNormal app frame resources so material buffer
  and material bind group resources can be reused across frame-resource cache
  misses.
- Extend prepared app material cache summaries to report `debug-normal`
  entries.
- Add targeted tests covering first creation, reuse after mesh-only frame
  resource misses, JSON-safe summaries, and no raw GPU handles.
- Keep non-built-in custom material rendering, GLB loading, IBL, shadows, and
  broader route renames deferred.

## Recommendation

Audit this selected cache-parity plan next. If it passes, implement it as the
next focused WebGPU-render slice.
