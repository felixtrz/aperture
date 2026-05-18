# Standard glTF Normal Scale Browser Coverage Audit - 2026-05-18

## Scope

Audit the normal texture scale browser coverage added after the occlusion
strength fixture.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`
- `docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_PLAN_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

The browser fixture now maps a glTF `normalTexture.scale` value of `0.25`
through the app facade into JSON-safe status alongside the normal texture
binding, readiness slot, tangent mesh layout, resources, and pipeline key. The
existing full-scale `normal-map` path reports scale `2`, so browser status can
distinguish the default control from the reduced-scale fixture.

During validation, a stronger readback assertion showed that the current
single-plane glTF normal-map fixture is not a good visual proof for scalar
normal strength: full-scale and reduced-scale normal scenarios render identical
sample pixels under the current direct-light setup. This is a fixture/lighting
coverage gap, not evidence that mapping failed: glTF parsing, material fields,
uniform packing, shader code, and browser status all expose the scalar.

## Recommendation

Keep the browser mapping coverage and add a separate focused follow-up to create
a deterministic visual normal-scale comparison. That follow-up should avoid a
broad lighting rewrite and should either add a scalar-vs-normal control within
the glTF fixture or reuse the proven Standard texture control layout pattern.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "normal texture scale"`
