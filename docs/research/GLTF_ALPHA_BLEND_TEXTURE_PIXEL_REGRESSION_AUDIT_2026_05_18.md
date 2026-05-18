# glTF Alpha Blend Texture Pixel Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1358` translucent glTF alpha-blend texture browser regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_RENDER_STATE_PLAN_2026_05_18.md`
- `docs/research/GLTF_ALPHA_BLEND_TEXTURE_PIXEL_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

What is now pinned:

- the app-facing glTF fixture has an `alpha-blend-texture` scenario that authors
  `alphaMode: "BLEND"` with a base-color texture containing opaque and
  translucent texels;
- the browser status keeps the mapped StandardMaterial render state on the
  alpha-blend path with disabled depth writes, back-face culling, and alpha
  blending;
- the successful app report still emits transparent material queue routing and
  the deterministic `standard|baseColorTexture|blend|back|less|alpha` pipeline
  key;
- screenshot and optional readback checks prove the translucent sample is drawn,
  remains distinguishable from clear, and is closer to clear than the opaque
  source sample.

Boundary checks:

- No ECS component, source asset contract, render extraction contract, shader,
  WebGPU upload path, or public API shape changed.
- GPU resources remain backend-owned and only JSON-safe counters, route
  summaries, pipeline keys, screenshots, and readback samples are inspected.
- The regression does not claim full transparency sorting; it proves one
  translucent base-color sample in the existing single-plane browser fixture.

## Recommendation

Run tracker/backlog alignment next. The next planning slice can return to a
route/prepared-resource contract question or another narrow StandardMaterial
glTF fidelity branch, with alpha blending now covered at both render-state and
pixel levels.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "blends translucent"`
