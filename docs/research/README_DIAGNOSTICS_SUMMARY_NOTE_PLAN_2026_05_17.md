# README Diagnostics Summary Note Plan - 2026-05-17

## Scope

Plan a small README update for the app diagnostics example's aggregate
dependency summary.

This is a planning slice only. It does not change README content.

## References Inspected

- `README.md`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`

## Recommendation

Update only the app diagnostics example paragraph.

The README currently says the example reports material dependency readiness,
missing resources, and submission state without exposing raw WebGPU/browser
objects. Extend that paragraph to mention that the example also publishes an
aggregate dependency summary for failure scenarios.

Suggested wording:

```md
It also publishes aggregate dependency summary counts for failure scenarios so
tests and tooling can inspect readiness by material kind, dependency kind,
status, and diagnostic code without parsing source asset handles.
```

Avoid promising that `WebGpuAppRenderReport` or `WebGpuAppRenderReportJsonValue`
always include a new `dependencySummary` field. The current field is an example
status view derived from public report JSON.

## Validation

Run:

- `pnpm exec prettier --check README.md`

## Non-Goals

- No API reference section.
- No report schema promise.
- No detailed list of every diagnostics helper.
- No broader README rewrite.

## Recommended Implementation Slice

Proceed with `task-0953`:

- update the app diagnostics example paragraph only;
- keep wording scoped to example status output and aggregate helper behavior;
- run README formatting validation.
