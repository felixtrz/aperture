# Built-In App Adapter Validation App Diagnostics Audit - 2026-05-18

## Scope

Audited the `task-1436` change that surfaces built-in app resource adapter
registry validation through `WebGpuAppDiagnosticsSummary`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`

## Findings

- The default queued built-in app resource adapter registry now reports a
  JSON-safe validation section with `valid: true`, the expected built-in family
  list, the registered family list, and no diagnostics.
- Test-only invalid registry coverage surfaces both generic duplicate-family
  warnings and built-in missing-family errors through app diagnostics without
  requiring production registry mutation.
- The app diagnostics section only contains strings, booleans, arrays, and
  copied diagnostic records. It does not expose callbacks, app instances, source
  asset payloads, descriptors, or raw GPU handles.
- ECS authority remains intact: registry validation describes the app render
  adapter table and does not create, own, or mutate ECS/world state.
- WebGPU ownership remains in the WebGPU package. No WebGL fallback or renderer
  scene graph was introduced.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`

## Follow-Up

Public tracker wording should mention that app-level built-in adapter validation
now reaches JSON-safe frame diagnostics.
