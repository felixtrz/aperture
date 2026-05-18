# App Adapter Built-In Collision Plan Audit

Date: 2026-05-18

Task: `task-1682`

## Scope

Audit the `task-1681` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_REGISTRY_COHABITATION_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md` Decision 0010
- `docs/research/APP_ADAPTER_REGISTRY_COHABITATION_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Findings

- The selected follow-up is concrete enough for one focused run and should stay
  test-only.
- The policy is consistent with the current registry implementation:
  duplicate family keys produce warnings and `get()` returns the first
  registered adapter. A regression should lock that behavior before any app
  facade can accept additional adapters.
- The plan preserves ECS authority, render extraction boundaries, and WebGPU
  ownership because it only tests adapter metadata and JSON-safe diagnostics.
- The Bevy reference supports explicit material/render-asset registration
  contracts. Aperture's smaller guard should make collisions visible rather
  than creating implicit override or fallback behavior.

## Recommendation

Implement `task-1683` as selected. Do not add app-level custom material source
authoring, rendered custom family pixels, IBL, shadows, or binary GLB loading.
