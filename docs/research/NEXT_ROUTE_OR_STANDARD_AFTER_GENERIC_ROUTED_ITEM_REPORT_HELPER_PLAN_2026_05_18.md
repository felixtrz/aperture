# Next Route Or StandardMaterial Follow-Up After Generic Routed Item Report Helper Plan - 2026-05-18

## Scope

Select the next focused task after generic routed-item report serialization.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_ROUTED_ITEM_SERIALIZATION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`

## Candidate A - Material Route Architecture

Audit the remaining built-in-specific app route collector diagnostics surfaces.

Why now:

- The route item, resource set, routed resource summary, and routed-item report
  serializer have been generalized.
- `queued-built-in-app-resource-set.ts` still contains built-in-specific
  diagnostic translation and route-report wiring. Some of that is intentional
  compatibility behavior; some may be the next genericization candidate.
- A focused audit can distinguish acceptable compatibility wrappers from
  architecture blockers before code is moved.

Risks:

- The audit must stay narrow and should not become a broad collector rewrite.
- It should recommend only one small follow-up.

## Candidate B - StandardMaterial/glTF Fidelity

Add another StandardMaterial browser fixture for a remaining texture or
render-state combination.

Why not next:

- Recent browser coverage already exercises the highest-risk combined
  StandardMaterial texture paths.
- The architecture risk is now more visible in the app route collector, where
  the generic material-family spine still terminates in built-in-specific
  diagnostics.

## Candidate C - Diagnostics/Tooling

Add another public tracker refinement or route-contract overview doc.

Why not next:

- The tracker has been updated for the generic routed-item report helper.
- A route collector surface audit will produce more actionable next work than a
  summary-only document.

## Selected Follow-Up

Select the material route architecture audit: inspect the remaining
built-in-specific app route collector diagnostics surfaces and recommend one
small next cleanup or confirm no immediate cleanup is needed.

Proposed task:

```md
### task-1479 — Audit remaining built-in-specific app route collector diagnostics surfaces

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and recent
generic route-contract audits.

Acceptance criteria:

- Identify remaining built-in-specific app route collector diagnostics or
  serialization helpers.
- Separate acceptable built-in compatibility wrappers from surfaces that block
  future non-built-in material-family routing.
- Recommend one small follow-up, or state that no immediate cleanup is needed.
```

## Notes

This keeps the next step in audit mode because several recent implementation
tasks landed on the route-contract path. The audit should keep the next code
slice small and avoid premature collector extraction.
