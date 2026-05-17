# StandardMaterial Sampler Fidelity Example Usage Plan

Date: 2026-05-17

Task: `task-1023`

## Context

`examples/app-diagnostics.js` already publishes an example-owned
`textureFidelitySummary` built from synthetic StandardMaterial texture readiness
JSON. The new sampler fidelity summary should follow the same pattern:
example-only, explicit, and separate from default app reports.

## Reference Anchors Inspected

- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `packages/webgpu/src/webgpu/standard-material-sampler-fidelity-summary.ts`
- Existing texture fidelity example summary usage.

## Smallest Implementation Slice

Add a synthetic `samplerFidelitySummary` field beside `textureFidelitySummary`
in the final diagnostics-ready status payload.

Use `createStandardMaterialSamplerFidelitySummary()` with hand-authored JSON
reports that cover:

- mip filtering on a single-mip texture;
- LOD max exceeding available mip range;
- authored anisotropy.

Update the Playwright diagnostics example test to verify:

- aggregate counts for mip, LOD, and anisotropy issues;
- field ordering for the affected fields;
- issue codes are present;
- material/texture/sampler handles and GPU strings are omitted from the
  aggregate summary.

## Non-Goals

- Do not wire sampler fidelity summary into default successful app reports.
- Do not create real textures/samplers for this example slice.
- Do not alter texture upload, mip generation, WebGPU sampler creation, IBL, or
  shadows.

## Implementation Follow-Up

Proceed with `task-1024` using the scope above.
