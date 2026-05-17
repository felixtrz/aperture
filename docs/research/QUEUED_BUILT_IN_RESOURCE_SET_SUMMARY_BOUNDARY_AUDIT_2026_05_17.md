# Queued Built-In Resource Set Summary Boundary Audit - 2026-05-17

## Scope

Audit the queued built-in resource-set summary helper added after the planning
slice. This audit checks ownership, JSON safety, and report boundaries only.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/QUEUED_BUILT_IN_RESOURCE_SET_SUMMARY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`

## Findings

No corrective code changes are required.

`QueuedBuiltInResourceSetSummary` describes current-frame derived route state,
not retained backend cache state. It reports:

- total queued built-in resource-set items;
- item counts by material family;
- item counts by pipeline key;
- item counts by material family plus pipeline key.

The helper accepts only `materialFamily`, `pipelineKey`, and `renderPhase`.
Those fields are already stable material queue metadata. The helper does not
accept or return draw packets, ECS state, source mesh/material assets, material
adapters, prepared resources, WebGPU buffers/textures/samplers, bind groups,
pipelines, devices, queues, or route failure diagnostics.

The implementation is a standalone WebGPU module exported through the package
barrel. It does not wire summary data into `WebGpuAppRenderReport` or
`WebGpuAppResourceReuseReport`, so retained cache/reuse reporting remains
separate from current-frame route inspection.

Tests cover empty and mixed-family inputs, deterministic bucket ordering, and
JSON stringification checks for obvious source/GPU handle strings.

## Boundary Notes

- Direction remains valid: WebGPU imports renderer material-queue metadata;
  render does not import WebGPU.
- The helper allocates small maps/arrays by design because it is an explicit
  diagnostic helper, not a per-frame app report path.
- `renderPhase` is included in the input type to keep the helper compatible
  with routed material queue items, but the first summary shape intentionally
  counts only family and pipeline dimensions requested by the task.
- If this summary is later emitted per frame, add caller-owned scratch and a
  dedicated app diagnostics section rather than placing it in
  `WebGpuAppResourceReuseReport`.

## Follow-Up

The immediate ready queue is now exhausted. Suggested next work should keep
advancing the material/queue/render-frame diagnostics spine with small vertical
slices:

- audit public summary exports and examples for diagnostics discoverability;
- plan app-level diagnostics grouping for material queue, route resource set,
  and render-frame queue summaries;
- add an optional JSON helper for diagnostics grouping only after a concrete
  consumer is identified.

No existing backlog wording needed tightening for this audit.

## Validation

- `pnpm exec vitest run test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
