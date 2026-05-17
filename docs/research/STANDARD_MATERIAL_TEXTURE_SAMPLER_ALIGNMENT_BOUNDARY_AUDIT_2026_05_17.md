# StandardMaterial Texture/Sampler Alignment Boundary Audit

Date: 2026-05-17

Task: `task-1045`

## Scope

This audit covers `createStandardMaterialTextureSamplerAlignmentSummary()` in
the render package.

## Reference Anchors Inspected

- `packages/render/src/materials/standard-texture-sampler-alignment.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `test/materials/standard-texture-sampler-alignment.test.ts`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`

## Findings

The helper consumes existing JSON-safe texture readiness and sampler fidelity
reports. It produces compact alignment facts:

- material key;
- texture readiness boolean;
- sampler fidelity readiness boolean;
- blocking texture diagnostic count;
- sampler warning count;
- deterministic per-field texture readiness and sampler warning counts.

It does not inspect the asset registry, create GPU resources, generate mipmaps,
mutate source material assets, or change StandardMaterial readiness semantics.

## Boundary Check

- Texture readiness blockers remain separate from non-blocking sampler fidelity
  warnings.
- Sampler fidelity warnings remain honest diagnostics for rendered-output
  differences, not hard render blockers.
- The helper lives in the render package and does not depend on WebGPU backend
  caches or app reports.
- The test verifies the summary omits texture handles, sampler handles, and GPU
  strings.

## Validation

- `pnpm exec vitest run test/materials/standard-texture-sampler-alignment.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`

Result: passed.

## Follow-Up

The next ready task is `task-1046`, planning whether the new frame-resource
route shell summary helper needs a diagnostics consumer now or should remain
helper-only.
