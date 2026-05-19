# Alpha Render-State Status Assertion Plan Audit

Date: 2026-05-19

Task: `task-1757`

## Scope

Audit the `task-1756` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_ALPHA_OR_TRANSFORM_STATUS_AFTER_ASSERTION_AUDIT_PLAN_2026_05_19.md`
- `docs/research/STANDARD_GLTF_ASSERTION_HARDENING_AUDIT_2026_05_19.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Findings

- The selected follow-up is concrete, but the implementation should be careful:
  many alpha tests already assert source and mapped render-state fields.
- The best next slice is likely to identify one or two alpha tests where status
  assertions are still broad or implicit, rather than adding duplicate checks to
  every alpha fixture.
- The task preserves ECS authority and render extraction boundaries if it stays
  limited to Playwright assertions over JSON-safe status.
- It does not require shader changes, new scenarios, public APIs, custom
  material APIs, app-owned adapter facades, IBL, shadows, or binary GLB loading.

## Recommendation

Implement `task-1758` only after inspecting the alpha tests for real assertion
gaps. If no meaningful gap remains, switch to transform-status hardening rather
than adding duplicate alpha checks.
