# Invalid glTF Sampler Enum Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1292` invalid glTF sampler enum browser diagnostic fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_GLTF_SAMPLER_OR_OPTIONAL_EXTENSION_DIAGNOSTIC_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The new `invalid-sampler-enum` fixture is a narrow source-mapping and
browser-status diagnostic.

The fixture sets an invalid glTF sampler `wrapS` value, then proves the status
surface reports:

- `gltfTexture.invalidSampler` with `field: "sampler.wrapS"` and the invalid
  value;
- `gltfMaterial.unresolvedTextureBinding` with `dependencyKind: "sampler"`;
- no material registration for the invalid source;
- no texture, sampler, material-buffer, or bind-group resources;
- no pipeline keys or mesh layout keys;
- no draw packages, commands, or draw calls.

The implementation also fixed a narrow diagnostic propagation gap in
`gltf-asset-mapping.ts`: texture-layer diagnostics now preserve
`diagnostic.value`, which was already part of the public
`GltfAssetMappingDiagnostic` shape. This is JSON-safe source context and does
not expose raw asset payloads or WebGPU handles.

Boundary checks:

- no shader behavior changed;
- no WebGPU upload, bind group, pipeline, or draw submission behavior changed;
- no app-level material route migration was added;
- no IBL, shadow, binary GLB, or GLB viewer behavior changed.

## Recommendation

Run tracker/backlog alignment next, then plan material-family extensibility or
optional glTF material-extension warning status depending on the desired next
focus.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid sampler"`
