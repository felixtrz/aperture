# Standard glTF Fidelity Gap Audit - 2026-05-18

## Scope

Inventory remaining near-term StandardMaterial/glTF fidelity gaps after route
helper cleanup and select one browser-verifiable follow-up.

Reference anchors inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Current Coverage

Already covered by browser fixtures:

- base-color texture mapping, sampler mapping, readback, UV1, transformed UV1,
  and missing UV1 diagnostics;
- base-color texture transform offset/scale and rotation sampling;
- metallic-roughness texture mapping, transformed sampling, UV1, and transformed
  UV1;
- normal, occlusion, emissive, alpha-mask, alpha-blend, double-sided, and
  combined texture scenarios;
- invalid sampler index/enum, invalid scalar/vector/render-state fields,
  unsupported required/optional extensions, unresolved bindings, loading/failed
  dependencies, and format/color-space mismatch diagnostics.

## Candidate A - Occlusion Strength Browser Coverage

Add a glTF-shaped StandardMaterial browser fixture where
`occlusionTexture.strength` is neither `0` nor `1`, and compare it against the
existing full-strength occlusion texture path.

Why now:

- glTF mapping already parses `occlusionTexture.strength`.
- The shader already applies `material.occlusionStrength`, but current browser
  coverage uses strength `1` only.
- This is a narrow user-visible fidelity check with JSON-safe status and
  readback/pixel assertions.

Risks:

- Pixel expectations should compare against a control rather than require a
  brittle exact lighting value.

## Candidate B - Normal Texture Scale Browser Coverage

Add a browser fixture for non-default `normalTexture.scale`.

Why not next:

- It is important, but it depends on tangent-space lighting and may be more
  sensitive to face orientation and direct-light setup than occlusion strength.
- Unit tests already cover normal scale packing and shader usage; browser
  coverage can follow after a simpler scalar texture-strength fixture.

## Candidate C - Larger Combined PBR Texture Fixture

Add a four- or five-texture combined StandardMaterial fixture.

Why not next:

- Existing combined fixtures already cover the route/resource pressure of two
  and three simultaneous texture slots.
- A larger fixture would be useful later, but it is less targeted than testing a
  glTF scalar factor that currently lacks browser verification.

## Selected Follow-Up

Select Candidate A: add occlusion texture strength browser coverage.

Proposed task:

```md
### task-1519 — Add StandardMaterial glTF occlusion strength browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with `occlusionTexture.strength` set to a
  finite non-default value such as `0.25`.
- Assert status JSON reports the mapped occlusion texture, strength value,
  resource counts, pipeline key, and JSON-safe diagnostics.
- Compare screenshot/readback output against the existing full-strength
  occlusion path or another deterministic control so the test proves the
  strength changes rendered output.
- Keep IBL, shadows, binary GLB loading, larger combined PBR fixtures, and
  app-level non-built-in rendering deferred.
```

## Validation

Documentation-only audit; covered by final formatting and progress checks.
