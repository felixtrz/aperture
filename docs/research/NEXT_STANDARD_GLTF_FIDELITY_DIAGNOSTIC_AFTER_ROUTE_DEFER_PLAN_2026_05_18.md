# Next StandardMaterial glTF Fidelity Diagnostic After Route Defer Plan

Date: 2026-05-18

## Scope

Select the next narrow StandardMaterial/glTF fidelity diagnostic after the
material route migration readiness audit deferred app-level non-built-in
routing.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MATERIAL_ROUTE_MIGRATION_READINESS_AFTER_ROUTE_DETERMINISM_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `examples/standard-gltf-texture.js`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### Invalid glTF sampler-index browser diagnostic

Add a browser fixture where a StandardMaterial base-color texture references a
nonexistent glTF sampler index. Assert the status reports
`gltfTexture.invalidSamplerIndex`, propagates
`gltfMaterial.unresolvedTextureBinding` with `dependencyKind: "sampler"`, and
does not create texture/sampler/material resources, pipelines, or draws for the
invalid source.

Why this is preferred:

- Existing unit coverage proves sampler-index context, but the browser example
  does not yet cover a source-side sampler failure end to end.
- It complements the existing malformed-image unresolved texture-binding
  fixture by covering the sampler dependency branch.
- It stays inside current glTF asset mapping, registration, app status, and
  Playwright diagnostics without changing shaders, WebGPU resource creation, or
  material routing.

### Invalid glTF sampler enum browser diagnostic

Add a browser fixture where `samplers[0]` has an invalid wrap or filter enum and
assert `gltfTexture.invalidSampler` plus sampler dependency propagation.

Why this is deferred:

- It is also useful, but it exercises the same sampler dependency branch through
  sampler-field validation rather than the simpler missing-index path.
- It can follow once the invalid-index browser fixture locks the no-work status
  shape for sampler failures.

### Unsupported optional glTF material extension status

Add browser status coverage for optional unsupported material extensions.

Why this is deferred:

- Optional-extension warnings should not necessarily block material
  registration or draws, so they require a more careful success-with-warning
  status contract.
- The next slice should avoid mixing warning semantics with invalid-source
  no-work assertions.

### Route/prepared-resource candidate

Plan material-family extensibility across `MaterialKind`, `MaterialQueueFamily`,
pipeline keys, prepared-resource adapters, and app diagnostics.

Why this is deferred:

- The route readiness audit found this is necessary before app-level
  non-built-in routing, but it is an architecture planning task, not the next
  proof-point implementation diagnostic.
- Returning to glTF sampler fidelity keeps the current lit StandardMaterial
  proof path moving while the route-extension story remains intentionally
  deferred.

## Selected Follow-Up

Add `task-1287 — Add invalid glTF sampler-index browser diagnostic`.

Category: `runtime-orchestration`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- targeted unit tests only if the existing asset-mapping coverage needs a small
  assertion.

Reference anchor:

- this plan;
- `docs/ARCHITECTURE.md`;
- `docs/MEDIUM_LONG_TERM_GOALS.md`;
- `packages/render/src/assets/gltf-asset-mapping.ts`;
- `packages/render/src/materials/gltf-texture.ts`;
- `packages/render/src/materials/gltf-material.ts`;
- `examples/standard-gltf-texture.js`;
- `test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Add an `invalid-sampler-index` scenario to the standard glTF texture example.
- The example status exposes `gltfTexture.invalidSamplerIndex` and
  `gltfMaterial.unresolvedTextureBinding` with sampler dependency context.
- The invalid source does not register a material, prepare texture/sampler or
  material resources, create pipelines, or submit draws.
- Playwright covers the browser status and JSON-safe diagnostics.
- Do not change shader behavior, route migration, IBL, shadows, binary GLB
  loading, or GLB viewer behavior.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
