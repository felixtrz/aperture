# Tracker Backlog Alignment After Registry Validation

Date: 2026-05-18

Task: `task-1660`

## Scope

Align public tracker pages and ready backlog state after the generic app adapter
registry validation helper and its audit.

Reference files inspected:

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_APP_ADAPTER_REGISTRY_VALIDATION_HELPER_AUDIT_2026_05_18.md`
- `agent/BACKLOG.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Updates

- Updated `docs/index.html` with the registry validation helper, JSON-safe
  expected-family diagnostics, and the next focus on selecting the next route
  or StandardMaterial follow-up.
- Updated `docs/render-pipeline-comparison.html` queue-phase status to include
  generic app adapter registry validation with optional expected-family
  diagnostics.
- Confirmed categorized ready tasks remain for planning and auditing the next
  follow-up: `task-1661` and `task-1662`. The end-of-run refill should add more
  concrete implementation/audit tasks if the planning task has not already done
  so.

## Validation

- `pnpm run check:progress`

## Recommendation

Proceed to `task-1661`: compare route/prepared-resource,
StandardMaterial/glTF fidelity, and diagnostics/tooling candidates, then select
one concrete follow-up.
