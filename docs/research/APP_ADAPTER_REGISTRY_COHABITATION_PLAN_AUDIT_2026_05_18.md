# App Adapter Registry Coexistence Plan Audit

Date: 2026-05-18

Task: `task-1677`

## Scope

Audit the `task-1676` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_FACTOR_BROWSER_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md` Decision 0010
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Findings

- The selected test is concrete enough for one focused run: it stays in the
  generic adapter registry validation surface and should not require changes to
  `createWebGpuApp()`, source `MaterialAsset` kinds, shaders, pipelines, or
  browser fixtures.
- The plan preserves Decision 0010. A test-only app-owned family key at the
  adapter registry boundary does not create a public custom material source API
  and does not imply rendered support.
- The Bevy reference pattern supports the direction conceptually: source
  material families and render-asset preparation are explicit contracts, not
  implicit fallbacks. Aperture's smaller TypeScript test should only validate
  family-key registration and diagnostics at this boundary.
- JSON-safety is covered by the selected acceptance criteria because output
  should contain family strings and diagnostics, not adapter functions or GPU
  objects.

## Recommendation

Implement `task-1678` as selected. Keep the change test-only unless the
regression exposes a narrow defect in `queued-material-adapter.ts`.
