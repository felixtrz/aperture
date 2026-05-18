# Invalid glTF Sampler-Index Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1287` invalid glTF sampler-index browser diagnostic fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_STANDARD_GLTF_FIDELITY_DIAGNOSTIC_AFTER_ROUTE_DEFER_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-texture.ts`

## Findings

Pass. The fixture is a narrow glTF source-mapping and browser-status
diagnostic.

The new `invalid-sampler-index` scenario keeps the material authored through the
existing StandardMaterial glTF fixture and does not change shader behavior,
pipeline creation, draw submission, route migration, or public material-family
APIs. It reports the source texture diagnostic
`gltfTexture.invalidSamplerIndex`, propagates
`gltfMaterial.unresolvedTextureBinding` with `dependencyKind: "sampler"` and
`samplerIndex: 3`, and then prevents invalid material registration.

The browser regression asserts the no-work contract for this invalid source:

- no material registration;
- no mesh draw extraction for the invalid material;
- no texture, sampler, material-buffer, or bind-group resources;
- no pipeline keys or mesh layout keys;
- no draw packages, commands, or draw calls.

The fixture also documents the existing mapper behavior that a planned sampler
status may still include a default mapped sampler object for the planned handle
even when the glTF texture's sampler index is invalid. That object is
inspection data only; the registration and render path remain blocked by the
invalid mapping report.

## Recommendation

Plan the next narrow glTF fidelity diagnostic with `task-1289`. Compare invalid
sampler enum coverage against optional-extension warning semantics and one
route-boundary candidate before implementing another fixture.

Keep deferred:

- app-level non-built-in material routing;
- material-family extensibility implementation;
- IBL, shadows, binary GLB loading, and GLB viewer behavior.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid sampler indices"`
