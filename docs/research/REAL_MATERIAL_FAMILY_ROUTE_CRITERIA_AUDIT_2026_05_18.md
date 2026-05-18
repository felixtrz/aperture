# Real Material Family Route Criteria Audit

Date: 2026-05-18

## Scope

Audit
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
before any implementation task uses it.

## References Inspected

- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`

## Findings

The criteria align with the material-family priority order:

- They do not propose a new arbitrary family.
- They keep Unlit, Matcap, Standard, and DebugNormal as the known near-term
  families.
- They recommend existing-family route cleanup, likely StandardMaterial, before
  adding any brand-new product-facing family.

The criteria do not skip required boundaries:

- Source material data must stay renderer-independent and ECS-referenced by
  handles.
- Queue items must remain derived render data.
- Prepared resources must remain WebGPU-owned.
- App route items must not serialize raw GPU handles, route items, bucket maps,
  or source asset payloads.
- Public diagnostics remain summary-based under existing fields such as
  `routedResourceSet`.

## Risk Check

The criteria intentionally avoid shader/PBR scope. That matters because
StandardMaterial still has deferred PBR work, IBL, and shadows. Route cleanup
should improve the material-family spine without claiming new visual capability.

No decision record is needed because the plan follows existing decisions:

- WebGPU-only backend.
- ECS authoritative state.
- Rendering as derived view.
- Bevy-inspired ECS/render bridge.
- No steady-state render hot-path allocations.

## Recommendation

Proceed with a StandardMaterial route cleanup planning slice, not direct
implementation. The plan should identify a route/preparation cleanup that can
be validated with focused WebGPU tests and should avoid adding new shader,
lighting, or GLB viewer features.

## Outcome

The criteria are safe to use. The next work should remain route/preparation
focused and should not start new product-facing material-family support yet.
