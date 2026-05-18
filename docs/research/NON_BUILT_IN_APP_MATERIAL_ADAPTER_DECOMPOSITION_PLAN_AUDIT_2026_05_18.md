# Non-Built-In App Material Adapter Decomposition Plan Audit

Date: 2026-05-18

Task: `task-1641`

## Scope

Audit the `task-1640` plan to decompose real non-built-in app material adapter
support into small vertical slices.

## Findings

- The selected follow-up is concrete enough for one focused docs/tooling run.
- The plan correctly keeps source `MaterialKind` closed under Decision 0010
  until a separate public custom material source API decision exists.
- The decomposition should focus on contracts, diagnostics, tests, and
  sequencing rather than adding shader code or app rendering support.
- The reference modules expose the right current boundaries: generic adapter
  registration is already string-keyed, while source material asset kinds remain
  a closed built-in union.

## Boundary Check

- ECS authority, render extraction, WebGPU backend ownership, and JSON-safe
  diagnostics are unaffected.
- The task must not introduce public custom material source assets, custom
  shader APIs, browser examples, or backend adapter registration behavior.
- No decision record is required for the decomposition itself because it should
  identify decision points rather than decide the public custom material API.

## Recommendation

Proceed to `task-1642`. Keep the decomposition ordered, small, and explicit
about non-goals so a later implementation run can select one safe slice.
