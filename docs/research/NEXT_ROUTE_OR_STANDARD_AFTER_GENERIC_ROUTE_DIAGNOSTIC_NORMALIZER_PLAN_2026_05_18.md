# Next Route Or StandardMaterial Follow-Up After Generic Route Diagnostic Normalizer Plan - 2026-05-18

## Scope

Select the next focused follow-up after generic route-report diagnostic assembly
and diagnostic normalization moved out of the built-in collector path.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Candidate A - Material Route Architecture

Audit remaining built-in collector responsibilities after the route report
builder and diagnostic normalizer extractions.

Why now:

- Two generic diagnostic/report helpers have moved out of the built-in collector.
- The remaining collector-owned pieces are now clearer: source asset indexing,
  route preparation iteration, built-in compatibility diagnostic translation,
  and app resource item creation.
- A focused audit can identify whether the next code slice should extract source
  asset indexing, queue-to-item collection, compatibility diagnostics, or stop
  route genericization and return to StandardMaterial fidelity.

Risks:

- The audit must not become a broad collector rewrite plan.
- It should explicitly preserve built-in compatibility wrappers until real
  app-level non-built-in material rendering exists.

## Candidate B - StandardMaterial/glTF Fidelity

Add another StandardMaterial/glTF browser fixture or diagnostic around a
remaining texture/render-state gap.

Why not next:

- The route collector has just changed twice in one run. A small audit is the
  appropriate next step before another implementation slice.
- Recent browser coverage already covers the highest-risk combined
  StandardMaterial texture paths.

## Candidate C - Diagnostics/Tooling

Add a route diagnostics overview document now that the builder and normalizer
are generic.

Why not next:

- The audit can decide whether such a document is useful, but the immediate
  question is whether more built-in collector responsibilities should move.

## Selected Follow-Up

Select Candidate A: audit remaining built-in collector responsibilities after
the generic route-report diagnostic helper extractions.

Proposed task:

```md
### task-1501 — Audit remaining built-in collector responsibilities after route diagnostic helper extraction

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`,
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`, and recent
route-contract audits.

Acceptance criteria:

- Identify remaining built-in collector responsibilities and classify each as
  built-in compatibility, generic extraction candidate, or deferred until
  non-built-in app rendering exists.
- Recommend exactly one next implementation or documentation follow-up, or state
  that StandardMaterial/glTF fidelity should resume.
- Confirm no proposed follow-up introduces app-level non-built-in rendering,
  renderer-owned ECS state, WebGL fallback, or a broad collector rewrite.
```

## Notes

This keeps audit cadence after two implementation slices touched the route
diagnostic boundary and prevents the genericization work from drifting into an
unbounded collector refactor.
