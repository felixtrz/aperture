# Next glTF Sampler Or Optional Extension Diagnostic Plan

Date: 2026-05-18

## Scope

Select the next narrow diagnostic after the invalid glTF sampler-index browser
fixture.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/INVALID_GLTF_SAMPLER_INDEX_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### Invalid glTF sampler enum browser diagnostic

Add a browser fixture where `samplers[0]` contains an invalid wrap or filter
enum. Assert source diagnostics such as `gltfTexture.invalidSampler`, sampler
dependency propagation through `gltfMaterial.unresolvedTextureBinding`, and no
registration/resources/pipelines/draws for the invalid material.

Why this is preferred:

- It follows directly from the invalid sampler-index fixture while covering a
  different failure source: malformed sampler object values instead of a
  missing sampler reference.
- `gltf-sampler.ts` already preserves invalid enum field names, values, and
  expected enum sets; browser status should prove that context survives through
  asset mapping.
- It stays in glTF source mapping and app status without changing shader logic,
  WebGPU upload paths, or material routing.

### Unsupported optional material-extension status fixture

Add browser coverage for optional unsupported material extensions.

Why this is deferred:

- Optional unsupported extensions are warning-like semantics and should not
  necessarily block registration or drawing.
- That status contract should be planned separately so the example can
  distinguish "rendered with warning" from the current expected-failure
  no-work fixtures.

### Route-boundary candidate

Plan material-family extensibility across `MaterialKind`, `MaterialQueueFamily`,
pipeline keys, prepared-resource adapters, and app diagnostics.

Why this is deferred for implementation:

- The route boundary still needs an audit, but it should not be mixed into the
  sampler diagnostic implementation.
- The route task remains planning/audit work until the material-family extension
  story has an explicit, reviewable contract.

## Selected Follow-Up

Select `task-1292 — Add invalid glTF sampler enum browser diagnostic if
selected`.

Category: `runtime-orchestration`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- targeted unit tests only if existing sampler coverage needs a small
  assertion.

Reference anchor:

- this plan;
- `packages/render/src/materials/gltf-sampler.ts`;
- `packages/render/src/materials/gltf-texture.ts`;
- `packages/render/src/assets/gltf-asset-mapping.ts`;
- `examples/standard-gltf-texture.js`;
- `test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Add a scenario with an invalid glTF sampler wrap or filter enum.
- Browser status exposes `gltfTexture.invalidSampler` and sampler dependency
  context without registering/drawing an invalid material.
- Playwright covers JSON-safe diagnostics and no prepared resources, pipelines,
  or draws for the invalid source.
- Do not change shader behavior, route migration, IBL, shadows, binary GLB
  loading, or GLB viewer behavior.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
