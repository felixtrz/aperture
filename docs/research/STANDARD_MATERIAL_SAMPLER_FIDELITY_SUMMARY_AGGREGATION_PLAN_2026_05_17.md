# StandardMaterial Sampler Fidelity Summary Aggregation Plan

Date: 2026-05-17

Task: `task-1020`

## Context

Aperture now has:

- `createStandardMaterialTextureFidelitySummary()` in `@aperture-engine/webgpu`
  for aggregate texture readiness/fidelity issue counts.
- `createStandardMaterialSamplerFidelityReport()` in `@aperture-engine/render`
  for per-material sampler fidelity warnings.

The sampler report is useful for detailed inspection, but dashboards and
examples will eventually need a compact aggregate surface like the texture
fidelity summary.

## Reference Anchors Inspected

- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `examples/app-diagnostics.js`

## Recommendation

Add a WebGPU/package-level aggregate helper only when an example or app
diagnostics surface needs multiple sampler fidelity reports summarized together.
The helper should not be added to default successful app reports.

Suggested helper:

```ts
createStandardMaterialSamplerFidelitySummary(reports);
```

Suggested counts:

- `materialCount`
- `slotCount`
- `warningCount`
- `mipmapIssueCount`
- `lodIssueCount`
- `anisotropyIssueCount`
- `byField`
- `byCode`

The helper should accept JSON values or structural report-like objects so it
does not need raw source assets, texture data, sampler objects, prepared
resources, or GPU handles.

## Non-Goals

- Do not wire this into every app frame by default.
- Do not change sampler report behavior.
- Do not alter texture upload, mip generation, IBL, shadows, or WebGPU sampler
  creation.
- Do not expose material, texture, or sampler handles in the aggregate summary.

## Implementation Follow-Up

Add a new ready task:

```md
### task-1021 — Add StandardMaterial sampler fidelity summary helper

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted tests, and
diagnostics docs if public helper status changes.
Reference anchor:
Plan from `task-1020`,
`packages/render/src/materials/standard-sampler-fidelity.ts`, and
`packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`.

Acceptance criteria:

- Helper summarizes sampler fidelity report JSON by field and diagnostic code.
- Counts separate mip filtering, LOD range, and anisotropy warnings.
- Output omits material/texture/sampler handles and raw report payloads.
- Targeted tests and WebGPU typecheck pass.
```
