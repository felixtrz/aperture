# Opaque Double-Sided glTF Browser Coverage Implementation Audit

Date: 2026-05-18

Task: `task-1573`

## Scope

Audit the `task-1572` implementation that added
`scenario=opaque-double-sided` to the StandardMaterial glTF browser fixture.

## Findings

- The implementation is limited to one render-state behavior: glTF opaque
  material authoring with `doubleSided: true`.
- Browser status now proves the source render state is preserved as
  `{ doubleSided: true }` and maps to `alphaMode: "opaque"`,
  `cullMode: "none"`, depth writes enabled, and no blending.
- The fixture reuses the existing backface sample pattern by rotating the plane
  and checking screenshot/readback pixels against the expected scalar material
  color.
- The change did not add an alpha/cull matrix, binary GLB loading, IBL,
  shadows, non-built-in app rendering, or route-collector changes.

## Boundary Check

- ECS remains authoritative: the scenario still spawns ECS components and source
  assets through the app facade.
- Render extraction remains the boundary between ECS state and WebGPU
  submission.
- GPU resources remain renderer-owned and are inspected only through JSON-safe
  app render reports.
- The implementation stays fixture/test scoped and does not alter public package
  boundaries.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "opaque double-sided"`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should choose
between returning to generic material-route architecture and another narrow
StandardMaterial/glTF fidelity gap.
