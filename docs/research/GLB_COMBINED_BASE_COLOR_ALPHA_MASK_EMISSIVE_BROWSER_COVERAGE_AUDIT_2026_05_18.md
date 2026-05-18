# GLB Combined Base Color Alpha Mask Emissive Browser Coverage Audit - 2026-05-18

## Scope

Audit `task-1466`, which added combined base-color, alpha-mask, and emissive
StandardMaterial browser coverage.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The new `base-color-alpha-mask-emissive` scenario is GLB-shaped and stays within
existing StandardMaterial behavior:

- base-color texture supplies visible and masked alpha samples;
- emissive texture maps through a second glTF texture/sampler binding;
- alpha mode remains `MASK` with double-sided no-cull state;
- the combined pipeline key is
  `standard|baseColorTexture|emissiveTexture|mask|none|less|none`;
- resource counts cover two texture resources, two sampler resources, one
  material buffer, and no material bind groups;
- readiness covers both `baseColorTexture` and `emissiveTexture` slots with no
  diagnostics.

The Playwright test uses the shared multi-texture helper for JSON-safe status,
mapping, readiness, resource-count, and pipeline-key assertions. It keeps
scenario-specific screenshot/readback checks for opaque versus masked pixels,
matching the existing alpha-mask texture test shape.

No app-level non-built-in material rendering, binary GLB loading, route rename,
IBL, shadow, or broad PBR work was added.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec prettier --check examples/standard-gltf-texture.js test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "combined base-color alpha-mask and emissive"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. Public tracker pages should mention the
new combined alpha-mask/emissive browser coverage.
