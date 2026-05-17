# StandardMaterial Dependency Diagnostics Summary Boundary Audit - 2026-05-17

## Scope

Audit the aggregate material dependency diagnostics summary helper added after
the StandardMaterial dependency diagnostics summary plan.

This audit checks ownership, JSON safety, and report/cache boundaries only. It
does not change dependency readiness generation, app report wiring, retained
texture/sampler caches, or rendering behavior.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_MATERIAL_DEPENDENCY_DIAGNOSTICS_SUMMARY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `test/webgpu/material-dependency-diagnostics-summary.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

No corrective code changes are required.

`MaterialDependencyDiagnosticsSummary` is aggregate-only. It reports:

- material readiness counts;
- slot readiness counts;
- buckets by material kind, dependency kind, and status;
- diagnostic code totals.

The helper consumes detailed readiness JSON reports but does not return material
keys, texture keys, sampler keys, dependency keys, handle keys, source asset
objects, prepared resources, or WebGPU handles.

Detailed failure diagnostics remain available through
`materialDependencyReadiness` in app report JSON. That remains the correct place
for exact source handle explanations when a frame is blocked.

Retained texture/sampler resource behavior remains in
`WebGpuAppResourceReuseReport.textureSamplerCache`. The new helper does not
touch that report and does not count cache hits, misses, evictions, writes, or
GPU resource identities.

## Boundary Notes

- The helper lives in WebGPU diagnostics because it is intended for app-facing
  summary views over existing readiness JSON.
- It imports renderer dependency-readiness types only; renderer packages do not
  import WebGPU.
- The helper allocates maps/arrays, which is acceptable while it is a direct
  inspection helper. If it is wired into every app frame later, add caller-owned
  scratch in a separate task.
- Bucket strings are constrained to material kind, dependency kind, readiness
  status, and diagnostic code values.

## Follow-Up

No backlog wording changes are needed. The next tasks should keep this helper
out of core frame reports unless an example or diagnostics consumer makes the
desired report shape concrete.

## Validation

- `pnpm exec vitest run test/webgpu/material-dependency-diagnostics-summary.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
