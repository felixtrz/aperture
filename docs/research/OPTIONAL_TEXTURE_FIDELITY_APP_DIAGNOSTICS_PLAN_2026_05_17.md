# Optional Texture Fidelity App Diagnostics Plan - 2026-05-17

## Goal

Decide whether `createStandardMaterialTextureFidelitySummary()` should remain a
manual helper or become an optional WebGPU app diagnostics surface.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_FIDELITY_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`

## Current Recommendation

Keep the texture fidelity summary as a manual helper for now.

Reason:

- StandardMaterial texture readiness reports are already detailed failure data.
- The new summary is useful for dashboards/tests, but the app does not yet have
  a stable opt-in diagnostics summary field for successful frames.
- Adding the summary to every successful app frame would allocate and expand
  report shape on the valid-frame path.
- Failure cases can still be inspected by constructing the summary from
  existing readiness reports in examples or tests.

## Future Optional Surface

If app exposure becomes useful, add it as an explicit opt-in diagnostics summary
surface, not as part of `resourceReuse`.

Possible shape:

```ts
interface WebGpuAppRenderOptions {
  readonly diagnosticsSummary?: {
    readonly materialDependencies?: boolean;
    readonly standardTextureFidelity?: boolean;
  };
}
```

Only populate the summary when requested or when building an explicit
diagnostics example. Do not attach it to every successful frame by default.

## Non-Goals

- No app report shape change now.
- No successful-frame default allocation.
- No `resourceReuse` changes.
- No shader, bind group, pipeline, texture upload, sampler creation, IBL, or
  shadow work.

## Recommended Follow-Up

Do not implement app wiring immediately.

Prefer `task-0994`: add a diagnostics-doc/example note that shows how to build
the summary from readiness report JSON manually. Revisit opt-in app wiring only
after the diagnostics summary surface has a broader design that covers material
dependency summaries and texture fidelity summaries together.
