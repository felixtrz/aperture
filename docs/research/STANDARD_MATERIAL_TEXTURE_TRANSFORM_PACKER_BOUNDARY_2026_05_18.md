# StandardMaterial Texture-Transform Packer Boundary

Date: 2026-05-18

## Scope

Document the current boundary around `packStandardMaterial()` after adding
base-color offset/scale texture-transform sampling. This note checks whether
docs or tests imply the packer is a validation boundary for unsupported texture
transforms.

## References Inspected

- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_FIXTURE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/rendering/extraction.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`

## Boundary

`packStandardMaterial()` is a GPU uniform/dependency packing step. It should
assume the material reached it through the app's readiness and extraction gates.

The current validation boundary is earlier:

- `standard-texture-readiness.ts` diagnoses unsupported texture transforms on
  material texture bindings.
- `extraction.ts` diagnoses mesh/material incompatibilities such as
  `TEXCOORD_1` textures on meshes without a `TEXCOORD_1` attribute.
- browser examples assert these diagnostics before queue/draw submission.

The packer currently serializes:

- base-color factor
- emissive factor
- scalar StandardMaterial factors
- render-state feature flags
- texture dependency handles/texcoord indices
- base-color texture offset and scale, defaulting to `[0, 0]` and `[1, 1]`

It does not diagnose unsupported rotation, transformed UV1, transformed
non-base-color slots, or missing mesh UV streams. That is intentional for now.

## Test Implications

Existing packer tests correctly assert byte layout, feature flags, texture
dependency keys, texcoord packing, and base-color offset/scale packing. They do
not claim the packer rejects unsupported transforms.

Existing readiness/extraction tests own unsupported-transform and missing-UV
coverage:

- rotation on base-color UV0 is unsupported today
- offset/scale on base-color UV1 is unsupported today
- missing mesh `TEXCOORD_1` blocks extraction before draw submission

## Future Rotation Work

When `task-1161` implements base-color rotation sampling, keep the same
boundary:

- add rotation packing as data serialization
- update readiness support predicates to accept rotation only for base-color
  `TEXCOORD_0`
- keep transformed UV1 and transformed non-base-color slots diagnosed before
  draw submission
- do not make `packStandardMaterial()` responsible for app-path diagnostics

If the packer becomes a public low-level API meant to validate arbitrary user
materials directly, add a separate task to introduce packer diagnostics. That is
not needed for the current app path.
