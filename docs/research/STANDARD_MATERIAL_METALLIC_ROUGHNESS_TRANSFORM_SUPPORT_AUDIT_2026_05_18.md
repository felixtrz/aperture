# StandardMaterial Metallic-Roughness Transform Support Audit

Date: 2026-05-18

## Scope

Audit the `task-1199` implementation of StandardMaterial
metallic-roughness texture transform support.

This audit checks whether the implementation stayed within the selected
StandardMaterial PBR fidelity slice and whether the next work should move to
lighting or remain in material/texture fidelity.

## References Inspected

- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_PLAN_AUDIT_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The implementation stayed within the intended fidelity slice:

- It targets one newly supported slot: `metallicRoughnessTexture`.
- Support remains limited to `TEXCOORD_0`.
- glTF material mapping and StandardMaterial readiness now accept finite
  metallic-roughness transforms on `TEXCOORD_0`.
- The shader reuses the existing texture-transform helper, so offset, scale,
  and rotation behave consistently with the base-color path.
- The GLB-shaped metallic-roughness transform fixture moved from an
  unsupported diagnostic path to a rendered browser path with WebGPU validation
  guarding.

The uniform layout correction is important:

- Adding six transform floats made the CPU buffer 120 bytes before padding.
- WGSL uniform structs require the bound uniform range to satisfy 16-byte
  alignment for the final struct size.
- `STANDARD_MATERIAL_UNIFORM_FLOATS` is now 32, producing a 128-byte material
  uniform buffer and avoiding invalid `standard/group-2` bind groups in the
  browser path.

The implementation did not jump ahead:

- No IBL or environment lighting was added.
- No shadow map pass or shadow sampling was added.
- No broad binary GLB loader/viewer path was added.
- No app diagnostics fields were added.
- No product-facing custom material family was added.

## Coverage

Current coverage is appropriate for this slice:

- Unit tests cover glTF transform acceptance, readiness acceptance, uniform
  packing, WGSL metadata, and shader text.
- Browser coverage verifies the GLB-shaped metallic-roughness transform
  scenario reaches `phase: "rendered"` with no unsupported transform
  diagnostics or WebGPU validation warnings.
- The browser test caught the initial 120-byte uniform alignment issue, and the
  fix is now part of the same implementation.

## Remaining Gaps

Keep these gaps explicit:

- Transformed `TEXCOORD_1` remains unsupported.
- Normal, occlusion, emissive, and alpha-mask transform support remains
  deferred unless selected by a later narrow slice.
- Binary `.gltf` / `.glb` scene loading is still not implemented.
- IBL and shadows are still deferred until StandardMaterial texture fidelity
  and generic material routing are more stable.

## Recommendation

Do not start shadows yet.

The next task should plan the lighting boundary from the current state and
decide whether direct lighting is stable enough for IBL planning or whether one
more texture-fidelity slice should come first. If the lighting plan proceeds,
it should stay limited to source contracts and diagnostics before adding
multi-pass shadow or environment-map rendering.
