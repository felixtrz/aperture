# StandardMaterial Texture Fidelity Example Usage Plan - 2026-05-17

## Goal

Plan a small example/test slice showing manual
`createStandardMaterialTextureFidelitySummary()` usage without changing the
default WebGPU app report shape.

## References Inspected

- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/OPTIONAL_TEXTURE_FIDELITY_APP_DIAGNOSTICS_PLAN_2026_05_17.md`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `test/webgpu/standard-material-texture-fidelity-summary.test.ts`

## Current State

`examples/app-diagnostics.js` already computes an aggregate
`dependencySummary` manually from app report JSON for failure scenarios. This is
the right pattern for texture fidelity summaries too: example-specific
diagnostic aggregation, outside the default successful app report shape.

The app report currently exposes material dependency readiness JSON for
dependency failures. StandardMaterial texture fidelity readiness is generated
earlier during extraction and normally appears as render diagnostics, not as a
dedicated app summary.

## Proposed Example Slice

For `task-1000`, add a small manual summary scenario to
`examples/app-diagnostics.js`:

1. Build one or more synthetic StandardMaterial texture readiness report JSON
   objects in the example script, matching the public JSON shape.
2. Pass them to `createStandardMaterialTextureFidelitySummary()`.
3. Publish the result under an example-only field such as
   `textureFidelitySummary`.
4. Add Playwright assertions that the summary counts sampler, color-space,
   semantic, UV, and transform issues and omits material/texture/sampler handle
   strings.

This keeps the example useful without requiring app report wiring.

## Non-Goals

- No `WebGpuAppRenderReport` schema changes.
- No default successful-frame summary.
- No extraction or app diagnostics rewiring.
- No new shader, texture upload, sampler, bind group, IBL, or shadow behavior.

## Validation

Suggested commands:

- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm run check:examples`
- `pnpm run check`
