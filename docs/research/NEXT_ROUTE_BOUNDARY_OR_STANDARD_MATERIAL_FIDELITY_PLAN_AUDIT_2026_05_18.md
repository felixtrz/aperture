# Next Route-Boundary Or StandardMaterial Fidelity Plan Audit

Date: 2026-05-18

## Scope

Audit the plan that selected an invalid glTF StandardMaterial scalar-factor
browser diagnostic as the next implementation slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_BOUNDARY_OR_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/MULTIPLE_OPTIONAL_EXTENSION_WARNING_STATUS_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`

## Findings

Pass. The selected follow-up is concrete and appropriately narrow.

The invalid scalar-factor fixture should exercise existing
`gltfMaterial.invalidField` behavior through the browser/app status path. It can
be implemented as an example scenario plus Playwright assertion unless the
asset-mapping bridge drops the diagnostic `field` or `value`.

Boundary checks:

- ECS authority is preserved because the invalid source asset should fail before
  producing renderable ECS material state.
- Rendering remains derived from extraction status; no renderer-owned gameplay
  state is introduced.
- WebGPU remains the only backend, and the selected test should assert no GPU
  resources or draw submissions are produced.
- The task does not add new material rendering behavior, app-level custom
  material routes, binary GLB loading, IBL, shadows, or GLB viewer behavior.

## Recommendation

Implement `task-1317` next.

## Validation

- Documentation-only audit; covered by final formatting and diff checks.
