# Next Route Or StandardMaterial Follow-Up After Generic Routed Item Report Helper Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up plan from
`NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_ROUTED_ITEM_SERIALIZATION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Findings

The selected follow-up is concrete enough for one focused run. It asks for an
audit of remaining built-in-specific diagnostics and serialization surfaces in
the app route collector rather than an immediate collector rewrite.

The plan preserves the architecture constraints:

- ECS remains authoritative because the audit is limited to route diagnostics
  and collector boundaries.
- Render extraction and source asset ownership remain unchanged.
- JSON-safe diagnostics stay central to the acceptance criteria.
- WebGPU resources remain backend-owned; no WebGL fallback or custom material
  rendering path is introduced.

The audit should explicitly distinguish built-in compatibility wrappers from
surfaces that should become generic. That distinction is important because
built-in app rendering is still the only active app-level route, while
non-built-in route rendering remains intentionally deferred.

## Validation

Documentation-only audit; covered by final formatting and progress checks.

## Recommendation

Proceed with `task-1479`: audit remaining built-in-specific app route collector
diagnostics surfaces.
