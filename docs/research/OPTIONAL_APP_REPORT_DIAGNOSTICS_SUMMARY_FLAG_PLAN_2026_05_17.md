# Optional App Report Diagnostics Summary Flag Plan - 2026-05-17

## Scope

Evaluate whether Aperture should add an opt-in app report diagnostics summary
flag after introducing the current summary helpers.

This is a planning slice only. It does not change app reports, options, or
rendering behavior.

## References Inspected

- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `docs/research/DIAGNOSTICS_SUMMARY_SCRATCH_REUSE_PLAN_2026_05_17.md`

## Recommendation

Do not add an app report diagnostics summary flag yet.

The current helper set is useful, but there is not yet a concrete production
consumer that needs every app render report to carry composed diagnostics
summary data. The app diagnostics example already proves an example-level
aggregate dependency summary without changing core report shape.

## Why Not Yet

Adding a flag now would force decisions that are still premature:

- whether summaries are emitted every frame or only on failures;
- whether summaries live in `WebGpuAppRenderReport` or only JSON output;
- whether material queue, routed resource-set, and render-frame queue summaries
  should always be computed together;
- which summaries need scratch shells for steady-state frame-loop use.

Without a consumer, those choices risk turning inspection helpers into a
semi-permanent report schema before the renderer/material pipeline settles.

## Future Shape If Needed

If a concrete consumer appears, prefer an explicit option:

```ts
render({ diagnosticsSummary: true });
```

or an app-level configuration flag with the same meaning. The emitted data
should be a sibling of `resourceReuse`, for example:

```ts
readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
```

Every-frame emission must use caller-owned scratch or stable result shells for
any summary that allocates today. Failure-only emission may continue using
allocating helpers if it remains outside the steady-state success path.

## Follow-Up Tasks

No immediate implementation task is justified. Add a new task only when one of
these exists:

- a browser example needs composed queue/route/frame summaries;
- CI diagnostics need aggregate summaries for flaky blank-frame failures;
- a public API consumer asks for opt-in summary reports;
- repeated tests start reconstructing the same summary grouping.

## Validation

No code validation was required for this planning task.
