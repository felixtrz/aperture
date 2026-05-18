# glTF Alpha Blend Double-Sided Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1363` glTF alpha-blend double-sided browser regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_TEXTURE_PLAN_2026_05_18.md`
- `docs/research/GLTF_ALPHA_BLEND_DOUBLE_SIDED_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

What is now pinned:

- the app-facing glTF fixture has an `alpha-blend-double-sided` scenario that
  authors `alphaMode: "BLEND"` and `doubleSided: true`;
- the mapped render state uses `alphaMode: "blend"`, `cullMode: "none"`,
  disabled depth writes, and alpha blending;
- the successful app report emits transparent material queue routing and the
  deterministic `standard|blend|none|less|alpha` pipeline key for the scalar
  material;
- screenshot and optional readback checks prove the rotated backface sample
  renders instead of clear.

Boundary checks:

- No ECS component, source asset contract, render extraction contract, shader,
  WebGPU upload path, or public API shape changed.
- GPU resources remain backend-owned and only JSON-safe status fields,
  screenshots, and readback samples are inspected.
- The regression does not claim complete transparent sorting or two-sided
  lighting quality; it pins no-cull transparent render-state behavior for one
  scalar-color plane.

## Recommendation

Run tracker/backlog alignment next. The next planning slice should give more
weight to route/prepared-resource contract work now that alpha blend render
state, translucent pixels, and double-sided culling are pinned.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "alpha-blend double-sided"`
