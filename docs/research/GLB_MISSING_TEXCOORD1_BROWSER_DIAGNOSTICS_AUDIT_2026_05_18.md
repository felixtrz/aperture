# GLB Missing TEXCOORD_1 Browser Diagnostics Audit

Date: 2026-05-18

## Scope

Audit the paired `standard-gltf-texture` browser fixtures for glTF-shaped
`baseColorTexture.texCoord = 1` coverage:

- `base-color-uv1`
- `base-color-uv1-missing`

This audit checks that the positive and negative paths remain paired,
JSON-safe, and honest about current GLB support.

## References Inspected

- `docs/research/STANDARD_GLB_NON_UV0_TEXTURE_COORDINATE_FIXTURE_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/rendering/extraction.ts`

## Findings

The positive browser fixture remains aligned with the plan:

- The glTF-shaped material authors `pbrMetallicRoughness.baseColorTexture` with
  `texCoord: 1`.
- `createUv1PlaneMeshAsset()` appends a local `TEXCOORD_1` `float32x2`
  attribute to the generated plane mesh and fills it with deterministic UV1
  coordinates.
- Playwright asserts the UV1 StandardMaterial pipeline key:
  `standard|baseColorTexture|uv1|opaque|back|less|none`.
- Playwright asserts the mesh layout key includes
  `POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1`.
- Screenshot/readback assertions compare the UV1-selected texel against the
  rejected UV0 texel.
- The status remains JSON-safe through `expectStatusJsonSafeForGpu()`.

The negative browser fixture is paired with the positive path:

- It authors the same `baseColorTexture.texCoord = 1` material shape while
  keeping the mesh UV0-only.
- Extraction reports
  `render.standardMaterialTexture.missingTexCoord1` before queueing or draw
  submission.
- Playwright asserts zero draw calls, no pipeline keys, and no mesh layout keys.
- The failure status remains JSON-safe and does not expose raw GPU handles,
  source texture payload bytes, or sampler objects.

## Boundary

These fixtures do not imply binary GLB mesh import support for `TEXCOORD_1`.
They are GLB-shaped browser scenarios built from report-driven source asset
registration and a manually constructed mesh asset. Binary GLB mesh loading
remains deferred.

## Remaining Gaps

- There is not yet a dedicated `standard-gltf-texture` transformed-UV1 fixture
  that combines `texCoord: 1`, a present `TEXCOORD_1` mesh attribute, and a
  non-identity texture transform. `task-1164` covers that next negative browser
  slice.
- The current missing-UV1 diagnostic is specific to `TEXCOORD_1`; broader
  multi-UV-set diagnostics should wait until additional UV sets are actually
  supported.

## Outcome

No corrective code change was needed. The paired fixtures remain aligned with
the ECS-authored render boundary: the renderer consumes extracted diagnostics
and never invents fallback UV state or renderer-owned mesh attributes.
