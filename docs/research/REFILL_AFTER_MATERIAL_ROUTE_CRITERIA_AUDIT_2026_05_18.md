# Refill After Material Route Criteria Audit

Date: 2026-05-18

## Scope

Check whether the ready backlog needs refill after the material-family route
migration criteria audit and the post-extension planning pass.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/NEXT_POST_EXTENSION_FIDELITY_OR_ROUTE_SLICE_PLAN_2026_05_18.md`
- `agent/BACKLOG.md`

## Findings

No additional refill is needed.

The ready queue still has enough concrete work after `task-1249`:

- `task-1250` audits the route summary group clean-after-failed regression.
- `task-1251` implements the selected invalid glTF render-state browser
  diagnostic fixture.

The current queue remains aligned with the material architecture spine:

```text
source material asset
  -> readiness and mapping diagnostics
  -> render queue route summaries
  -> prepared resources and pipeline diagnostics
  -> draw submission
```

The new follow-up added by `task-1247` includes category, package/write-scope,
reference anchor, and acceptance criteria. It keeps IBL, shadows, binary GLB
loading, GLB viewer behavior, and broad material-family rewrites deferred.

## Recommendation

Proceed to `task-1250`, then implement `task-1251` if the work window remains
open.

## Validation

Documentation-only refill check. Validate with touched-file formatting and
final `git diff --check`.
