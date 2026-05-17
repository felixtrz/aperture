# App Diagnostics Summary Boundary Audit - 2026-05-17

## Scope

Audit the `createWebGpuAppDiagnosticsSummary()` helper added after the app
diagnostics grouping plan.

This audit checks ownership, JSON safety, and report boundaries only. It does
not change app report wiring, resource reuse reporting, frame planning, or
rendering behavior.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_DIAGNOSTICS_SUMMARY_GROUPING_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`

## Findings

No corrective code changes are required.

`WebGpuAppDiagnosticsSummary` composes optional current-frame inspection
sections:

- renderer-independent material queue phase summary;
- WebGPU app routed resource-set summary;
- WebGPU render-frame queue diagnostics summary.

The helper does not compute or retain backend state. It does not touch
`WebGpuAppRenderReport`, `WebGpuAppRenderReportJsonValue`, or
`WebGpuAppResourceReuseReport`. Retained cache metrics therefore remain
separate from current-frame queue/route diagnostics.

The helper accepts only already-summary-shaped inputs and returns a shallow
grouping plus `sectionCount`. It does not accept snapshots, ECS worlds, source
assets, material adapters, prepared resources, frame resources, command
encoders, command buffers, pipelines, queues, or WebGPU handles.

Tests cover empty, partial, and full groupings and verify JSON stringification
does not contain obvious snapshot/source/GPU handle strings.

## Boundary Notes

- Keeping app report wiring out of this slice was the right boundary. There is
  no concrete diagnostics consumer yet that requires every frame report to carry
  these summaries.
- Future app integration should add a sibling diagnostics field, not a child of
  `resourceReuse`.
- If a future app report emits this every frame, add caller-owned scratch for
  any per-frame summary creation that becomes hot-path sensitive.

## Follow-Up

No backlog wording changes are needed for this audit. The next queued planning
task should focus on StandardMaterial dependency diagnostics, where app tests
already expose texture/sampler readiness and cache-reuse separation.

## Validation

- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
