# glTF Alpha Blend Render-State Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1353` alpha-blend glTF browser render-state regression.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_THREE_FAMILY_ROUTE_SUMMARY_PLAN_2026_05_18.md`
- `docs/research/GLTF_ALPHA_BLEND_RENDER_STATE_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

What is now pinned:

- the app-facing glTF fixture has an `alpha-blend` scenario authored from
  `alphaMode: "BLEND"` source material data;
- the published browser status records the source render state and mapped
  StandardMaterial render state with `alphaMode: "blend"`, `depth.write: false`,
  `cullMode: "back"`, and alpha blending;
- the extracted material queue reports the transparent phase for the blended
  StandardMaterial;
- the routed resource summary reports the deterministic
  `standard|baseColorTexture|blend|back|less|alpha` pipeline key;
- the successful path remains JSON-safe, creates the expected texture, sampler,
  and material buffer resources, and reports no route failure diagnostics.

Boundary checks:

- No ECS component, source asset contract, render extraction contract, shader,
  WebGPU upload path, or public API shape changed.
- ECS remains authoritative; the example still authors a camera, lights, mesh,
  material handle, transform, layer, and visibility through the app facade.
- WebGPU resources remain backend-owned and are exposed only through JSON-safe
  counters and summary keys.
- The regression does not claim full transparency sorting or physically correct
  blending; it pins the glTF render-state branch and pipeline/resource routing.

## Recommendation

Run tracker/backlog alignment next. The next implementation planning slice can
choose between another narrow StandardMaterial/glTF fidelity branch and a
generic material-family route/prepared-resource contract follow-up.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "alpha-blend"`
