# Next Route Or StandardMaterial Follow-Up After Occlusion Strength Plan - 2026-05-18

## Scope

Select the next focused follow-up after StandardMaterial/glTF occlusion strength
browser coverage.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_GLTF_OCCLUSION_STRENGTH_BROWSER_COVERAGE_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Candidate A - Material Route Architecture

Resume collector genericization or app route diagnostics cleanup.

Why not next:

- The route helper cleanup has been audited and the next extraction would be
  broader than the helper slices already completed.
- The latest StandardMaterial browser slice was small and successful, so the
  route spine can continue to be exercised through fidelity fixtures.

## Candidate B - StandardMaterial/glTF Fidelity

Add browser coverage for non-default `normalTexture.scale`.

Why now:

- glTF material mapping already parses `normalTexture.scale`.
- The StandardMaterial buffer and shader already expose/use `normalScale`.
- Browser coverage currently exercises normal maps with scale `1`; a non-default
  scale fixture would prove the scalar affects rendered output through the
  app facade and WebGPU shader path.

Risks:

- Normal output is more lighting/tangent sensitive than occlusion strength, so
  the test should compare against the existing normal-map control rather than
  hard-code exact colors.

## Candidate C - Larger Combined PBR Texture Fixture

Add a four- or five-texture combined StandardMaterial fixture.

Why not next:

- It would increase route/resource pressure, but it is less targeted than
  pinning another glTF scalar field that already has source mapping and shader
  support.

## Selected Follow-Up

Select Candidate B: add StandardMaterial/glTF normal texture scale browser
coverage.

Proposed task:

```md
### task-1527 — Add StandardMaterial glTF normal scale browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with `normalTexture.scale` set to a finite
  non-default value such as `0.25`.
- Assert status JSON reports the mapped normal texture, scale value, tangent
  mesh layout, resource counts, pipeline key, and JSON-safe diagnostics.
- Compare screenshot/readback output against the existing full-scale normal-map
  path or another deterministic control so the test proves the scale changes
  rendered output.
- Keep IBL, shadows, binary GLB loading, larger combined PBR fixtures, and
  app-level non-built-in rendering deferred.
```

## Notes

This continues the scalar fidelity path opened by occlusion strength while
keeping each browser slice small and attributable.
