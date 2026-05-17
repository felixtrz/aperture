# Prepared/Sampler Diagnostics Example Consolidation Plan

Date: 2026-05-17

Task: `task-1036`

## Context

The diagnostics example now exposes example-owned dependency, texture fidelity,
and sampler fidelity summaries. Prepared facade and lifetime alignment summaries
also exist, but they are not yet shown in the example.

The next slice should prove these summaries can be composed by consumers without
turning them into default successful-frame app report fields.

## Reference Anchors Inspected

- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `packages/render/src/rendering/render-world-prepared-resource-summary.ts`
- `packages/webgpu/src/webgpu/prepared-resource-lifetime-alignment-summary.ts`
- `packages/webgpu/src/webgpu/standard-material-sampler-fidelity-summary.ts`

## Existing Pattern

`examples/app-diagnostics.js` already uses a good opt-in pattern:

- run focused scenarios through the public app facade;
- convert detailed reports to JSON where needed;
- publish aggregate summaries as example-owned top-level fields;
- verify with Playwright that aggregate summaries omit material, texture,
  sampler, and GPU handles.

That pattern should be reused for prepared-resource summaries.

## Recommended Slice

Add a new `preparedResourceSummary` group to the diagnostics example, derived
from the already-rendered successful mixed-material scenario.

Recommended fields:

- `preparedResourceSummary`: output from
  `createRenderWorldPreparedResourceSummary()` using compact prepared facade
  counts and current-frame draw readiness facts available from the successful
  report JSON.
- `preparedLifetimeSummary`: output from
  `createPreparedResourceLifetimeAlignmentSummary()` using the compact prepared
  facade counts plus backend resource summary counts already exposed in the
  successful report's `resourceReuse`/resource summary JSON.

If the current app report JSON does not expose enough compact prepared facade
input without reaching into raw resources, defer `preparedResourceSummary` and
add only a synthetic example summary, matching the current texture/sampler
fidelity example style. Do not pull raw frame resources into the public example
JSON just to make the summary possible.

## Acceptance Criteria For Implementation

- `examples/app-diagnostics.js` exposes selected prepared/lifetime summaries as
  example-owned JSON fields only.
- `test/e2e/app-diagnostics.spec.ts` asserts compact counts and verifies the
  summaries omit backend cache keys, raw resource labels, and `GPU` strings.
- Existing `dependencySummary`, `textureFidelitySummary`, and
  `samplerFidelitySummary` assertions continue to pass.
- No default app report field is added for successful frames.

## Non-Goals

- Do not add prepared/lifetime summaries to every app frame by default.
- Do not expose raw prepared resources, backend cache maps, `GPUBuffer`,
  `GPUBindGroup`, texture payloads, or sampler objects in the example JSON.
- Do not change resource lifetime policy or cache eviction behavior.
- Do not broaden the example into a GLB/material viewer.

## Follow-Up Task

Add or keep the ready task:

```md
### task-1037 — Add prepared/lifetime diagnostics example summary coverage

Category: `runtime-orchestration`
Package/write-scope: `examples/app-diagnostics.js`,
`test/e2e/app-diagnostics.spec.ts`, and targeted validation.
Reference anchor:
Plan from `task-1036`, `createRenderWorldPreparedResourceSummary()`,
`createPreparedResourceLifetimeAlignmentSummary()`, and existing app diagnostics
example summary assertions.

Acceptance criteria:

- The diagnostics example exposes any selected prepared-resource summary only as
  example-owned JSON, not a default app report field.
- Playwright assertions prove aggregate counts are present and raw GPU/resource
  handles are omitted.
- Existing dependency, texture fidelity, and sampler fidelity example summaries
  continue to pass.
```
