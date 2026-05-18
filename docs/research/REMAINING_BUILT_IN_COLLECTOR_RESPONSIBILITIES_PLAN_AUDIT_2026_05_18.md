# Remaining Built-In Collector Responsibilities Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Findings

The selected follow-up is concrete enough for one focused audit run. It asks for
classification of the remaining built-in collector responsibilities rather than
another immediate code extraction.

That is the right next step because the current collector now has a smaller
surface:

- generic route item and resource set contracts live outside the collector;
- generic route-report queue/routed item serialization lives outside the
  collector;
- generic unknown diagnostic normalization lives outside the collector;
- built-in compatibility translation, source asset indexing, queue traversal,
  and app resource item creation remain local.

The audit should decide whether source asset indexing or route item creation is
the next useful extraction candidate, or whether the generic route spine is
clean enough for the near term and StandardMaterial/glTF fidelity should resume.

## Recommendation

Proceed with the selected audit. Keep it classification-focused and recommend
one small follow-up only.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
