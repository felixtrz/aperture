# Route-Family Key Type-Boundary Test Audit

Date: 2026-05-18

## Scope

Audit the `task-1301` route-family key type-boundary test and implementation.

## References Inspected

- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MATERIAL_FAMILY_EXTENSIBILITY_CONTRACT_PLAN_2026_05_18.md`
- `packages/render/src/rendering/material-queue.ts`
- `test/rendering/material-queue.test.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`

## Findings

Pass. The change is limited to the render queue route-key boundary.

`MaterialQueueFamily` can now represent registry-style string route keys, and
`materialQueueFamilyFromPipelineKey()` accepts syntactically valid lowercase
dash-separated family keys such as `toon` and `toon-shaded`. Malformed route
keys such as an empty family, whitespace, or uppercase names still return
`null` and stay diagnostic-only in queue building.

Boundary checks:

- source `MaterialKind` remains closed;
- no source material asset union was widened;
- no WebGPU app adapter or frame-resource route was added;
- unsupported custom route keys can be queued/diagnosed by later app routing but
  do not imply render support;
- no shader, pipeline, bind group, draw submission, IBL, shadow, binary GLB, or
  GLB viewer behavior changed.

## Recommendation

Before app-level non-built-in rendering, add diagnostics/status coverage proving
valid-but-unregistered route keys are reported through app route diagnostics
without fallback rendering.

## Validation

- `pnpm exec vitest run test/rendering/material-queue.test.ts`
