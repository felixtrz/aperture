# Built-In Prepared Material Fallback Diagnostics Plan - 2026-05-17

## Scope

Plan how unlit, Matcap, and Standard prepared material helper failures should be
reported when app-frame resource creation falls back to the older direct
material buffer/bind-group path.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/GENERIC_BUILT_IN_MATERIAL_PREPARATION_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`

## Current Behavior

Prepared material helper failures are intentionally local to the app-frame
resource helper. When a helper cannot create a prepared material resource, the
route returns `null` and the frame resource path creates the material buffer and
bind group directly.

This preserves rendering in cases where prepared-resource reuse is unavailable,
but it hides useful information from app diagnostics when the failure is due to
a real route issue.

## Decision

Keep fallback silent for expected shape mismatches, but add JSON-safe
diagnostics for unexpected prepared-route failures after `task-0845` moves
selection behind the adapter registry.

Silent fallback should remain acceptable when:

- a family-specific helper reports `skipped` or equivalent because the material
  shape belongs to another prepared route;
- a helper declines because the material is not ready and the main app
  readiness diagnostics already explain the issue;
- the app is on a path that intentionally has no prepared material route yet.

Diagnostics should be emitted when:

- the group-2 material layout is missing for a material family that should have
  one;
- prepared texture/sampler source dependency keys are ready, but the
  corresponding WebGPU texture/sampler resources are missing;
- a prepared material helper fails after creating partial resources;
- a family adapter selects a helper that does not match the source material
  kind or expected texture-family route.

## Diagnostic Shape

Use one app-level diagnostic code and include the family plus sanitized helper
diagnostics:

```ts
interface WebGpuAppPreparedMaterialFallbackDiagnostic {
  readonly code: "webGpuApp.preparedMaterialFallback";
  readonly materialFamily: "unlit" | "matcap" | "standard";
  readonly materialKey: string;
  readonly reason:
    | "missing-layout"
    | "missing-prepared-dependency"
    | "helper-failed"
    | "adapter-mismatch";
  readonly diagnostics: readonly WebGpuAppJsonValue[];
  readonly message: string;
}
```

Do not include raw buffers, bind groups, textures, samplers, device objects, or
exception objects. Existing helper diagnostics already use resource keys and
status strings; app-level conversion should preserve only JSON-safe fields.

## Test Plan

Direct helper tests:

- Missing layout returns a helper failure with material key and no raw GPU
  handles.
- Missing prepared texture/sampler GPU resources report logical texture/sampler
  keys for unlit, Matcap, and Standard.
- Unsupported or mismatched helper selection returns a skipped/null prepared
  result without an app-level fallback diagnostic.

App-route tests after adapter selection exists:

- Removing the group-2 layout from a test pipeline route emits
  `webGpuApp.preparedMaterialFallback` and still renders through the direct
  frame-resource path when possible.
- Supplying ready source texture/sampler assets but withholding prepared
  WebGPU texture/sampler resources emits the fallback diagnostic with logical
  keys only.
- Public `webGpuAppRenderReportToJsonValue` output remains serializable and
  contains no raw GPU handles.

## Guardrails

- Fallback diagnostics must not make prepared caches authoritative.
- Source asset readiness remains reported by render/material readiness
  diagnostics.
- Texture/sampler GPU resources remain outside material caches.
- Standard group-3 light resources remain frame-derived and outside material
  cache keys.
- Do not add a public material plugin API while adding fallback diagnostics.
