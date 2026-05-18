# Generic App Adapter Registration Policy Plan Audit

Date: 2026-05-18

Task: `task-1654`

## Scope

Audit the `task-1653` plan that selected generic app adapter registration
policy as the next follow-up after the test-only generic contract proof.

## Findings

- The selected follow-up is concrete and bounded as an audit-refactor task.
- It directly follows the newly proven generic prepare-route/app-item/frame-
  resource-set path.
- It focuses on app registration policy, not public source material authoring.
- It should classify generic registration helpers, built-in validation, app
  cache ownership, and diagnostics boundaries before any runtime registration
  API is added.
- No decision record is needed before this audit. A decision may be needed if
  the audit recommends public custom material source authoring or app-level
  registration options.

## Boundary Check

- ECS authority, render extraction boundaries, JSON-safe diagnostics, and
  WebGPU-only backend ownership are preserved.
- The audit must not add custom material shaders, GPU resources, browser
  fixtures, public `MaterialKind` variants, or app options.
- Built-in adapter validation should remain intact unless the audit finds a
  tiny naming or docs mismatch.

## Recommendation

Proceed to `task-1655`. Keep the output focused on registration policy and one
recommended implementation slice or decision-record requirement.
