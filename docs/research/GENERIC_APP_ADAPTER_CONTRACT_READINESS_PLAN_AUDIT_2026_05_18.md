# Generic App Adapter Contract Readiness Plan Audit

Date: 2026-05-18

Task: `task-1646`

## Scope

Audit the `task-1645` plan to assess generic app adapter contract readiness for
future non-built-in material families.

## Findings

- The selected follow-up is concrete and bounded as an audit-refactor task.
- It follows the non-built-in adapter decomposition recommendation without
  implementing custom material rendering.
- The audit can classify current contracts as generic-ready, built-in policy,
  or blocked by the closed source `MaterialKind` union.
- The task may recommend a tiny type/test slice, but should not edit runtime
  behavior during the audit unless a trivial mismatch is found.

## Boundary Check

- ECS authority, render extraction, WebGPU-only backend ownership, and JSON-safe
  diagnostics are preserved.
- The task must not add public custom material source assets, shader code,
  examples, browser fixtures, or app-level custom material rendering.
- No decision record is needed unless the audit decides the next step must be a
  public custom material source API decision.

## Recommendation

Proceed to `task-1647`. Keep the output focused on current contract readiness
and exactly one recommended next route/prepared-resource task.
