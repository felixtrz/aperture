# StandardMaterial Dependency Diagnostics Summary Plan - 2026-05-17

## Scope

Plan a JSON-safe summary helper for StandardMaterial texture/sampler dependency
readiness diagnostics.

This is a planning slice only. It does not change dependency readiness
generation, texture/sampler cache behavior, app report wiring, or rendering.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/webgpu/src/webgpu/material-dependency-readiness.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current Surface

`createMaterialDependencyReadinessReport()` produces per-material readiness for
source texture/sampler dependencies. The app wraps failed reports in
`webGpuApp.materialDependenciesNotReady` diagnostics and
`webGpuAppRenderReportToJsonValue()` exposes the JSON readiness reports under
`materialDependencyReadiness`.

Those readiness reports are intentionally detailed. They include material keys,
dependency handle keys, fields, statuses, and diagnostics so failed app frames
can explain the exact missing/loading/failed source asset.

`WebGpuAppResourceReuseReport.textureSamplerCache` and related cache counters
describe retained backend resource behavior. They should remain separate from
source dependency readiness.

## Placement Recommendation

Add a helper in the WebGPU diagnostics area that summarizes existing
`MaterialAssetDependencyReadinessReportJsonValue` records into counts only.

The helper should not replace the detailed failure diagnostics. It should be an
optional inspection surface for dashboards/tests that need aggregate readiness
without exposing source asset handles.

## Proposed Helper Shape

```ts
export interface MaterialDependencyStatusBucketSummary {
  readonly status: MaterialAssetDependencyReadinessStatus;
  readonly slotCount: number;
}

export interface MaterialDependencyKindBucketSummary {
  readonly dependencyKind: MaterialDependencyKind;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
}

export interface MaterialDependencyMaterialKindBucketSummary {
  readonly materialKind: MaterialKind | "unknown";
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
}

export interface MaterialDependencyDiagnosticsSummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
  readonly byMaterialKind: readonly MaterialDependencyMaterialKindBucketSummary[];
  readonly byDependencyKind: readonly MaterialDependencyKindBucketSummary[];
  readonly byStatus: readonly MaterialDependencyStatusBucketSummary[];
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

export function createMaterialDependencyDiagnosticsSummary(
  reports: readonly MaterialAssetDependencyReadinessReportJsonValue[],
): MaterialDependencyDiagnosticsSummary;
```

Use material kind, dependency kind, status, and diagnostic code buckets. Do not
bucket by material key, texture key, sampler key, dependency key, or handle key.

## JSON Safety

The helper must not include:

- source material, texture, or sampler handle keys;
- dependency handle keys;
- source asset objects;
- prepared texture/sampler resources;
- WebGPU texture, sampler, bind group, buffer, pipeline, device, or queue
  handles;
- full readiness reports or detailed diagnostics arrays.

The only dynamic strings should be material kind, dependency kind, status, and
diagnostic code values.

## Relationship to Existing Reports

- Detailed `materialDependencyReadiness` app JSON should remain available for
  failures that need exact handle-level explanation.
- This summary should be aggregate-only and safe for broader dashboards.
- Retained texture/sampler cache summaries remain in `WebGpuAppResourceReuseReport`.
- Do not put dependency readiness counts into `textureSamplerCache`; source
  readiness and retained backend cache reuse are different domains.

## Focused Validation

Add tests covering:

- empty report list;
- a ready StandardMaterial dependency report;
- missing/loading texture and sampler slots;
- deterministic status/dependency/material-kind bucket ordering;
- JSON stringification without material, texture, sampler, dependency, or GPU
  handle strings.

Suggested commands:

- `pnpm exec vitest run test/webgpu/material-dependency-diagnostics-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Non-Goals

- No `WebGpuAppRenderReport` or `WebGpuAppRenderReportJsonValue` changes.
- No source dependency readiness behavior changes.
- No texture/sampler cache behavior changes.
- No retained backend cache summary changes.
- No WebGPU resource exposure.

## Recommended Implementation Slice

Proceed with `task-0943`:

- add a WebGPU helper that summarizes readiness JSON reports into aggregate
  counts;
- export it through the package barrel;
- test ready and missing/loading StandardMaterial dependency reports directly;
- keep app report wiring out of scope.
