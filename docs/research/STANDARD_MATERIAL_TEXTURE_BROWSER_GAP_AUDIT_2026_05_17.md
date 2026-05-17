# StandardMaterial Texture Browser Gap Audit - 2026-05-17

## Scope

Audit remaining browser-visible StandardMaterial texture coverage after the
controlled base-color texture example and missing-texture diagnostics scenario.

This is an audit slice. It does not change shader behavior, app report schemas,
texture upload, sampler creation, GLB import, IBL, shadows, or texture
transforms.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_METALLIC_ROUGHNESS_BROWSER_COVERAGE_PLAN_2026_05_17.md`
- `docs/research/STANDARD_TEXTURE_NEGATIVE_BROWSER_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_UV1_PER_FIELD_COVERAGE_BOUNDARY_AUDIT_2026_05_17.md`

## Current Browser Coverage

The dedicated controlled browser path covers the narrowest reliable
StandardMaterial texture proof:

- `examples/standard-texture-control.js` renders a scalar StandardMaterial peer
  and a base-color textured StandardMaterial peer through `createWebGpuApp`.
- `test/e2e/standard-texture-control.spec.ts` verifies the
  `standard|baseColorTexture|opaque|back|less|none` pipeline key, one texture
  resource, one sampler resource, two material buffers, and two draw calls.
- The same Playwright test samples the canvas screenshot and proves the
  textured side is visually closer to the authored base-color texture than the
  scalar side.
- The `missing-texture` scenario verifies a not-ready base-color texture blocks
  the textured draw, emits
  `render.standardMaterialTexture.textureNotReady`, and submits no draw calls.

The materials showcase is useful smoke coverage but not slot-specific browser
proof:

- It authors `baseColorTexture`, `metallicRoughnessTexture`,
  `occlusionTexture`, and `emissiveTexture` on one animated StandardMaterial.
- Its Playwright test verifies those feature names are published and that the
  StandardMaterial cube is visible and distinct from Unlit and Matcap regions.
- It does not isolate which StandardMaterial slot caused the visible result,
  and it does not assert fixed metallic, roughness, occlusion, or emissive pixel
  effects.

## Slot Gap Matrix

| StandardMaterial slot      | Browser status                                                      | Non-browser support already covered                                                                                                                                                                                                                                          | Remaining browser-visible gap                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `baseColorTexture`         | Controlled positive browser proof plus missing-texture diagnostics. | Readiness validates semantic `base-color`, sRGB color space, sampler state, `TEXCOORD_0/1`, and unsupported transforms. Shader samples base color and multiplies `baseColorFactor`.                                                                                          | Loading/failed texture and sampler variants are not yet covered in the controlled browser harness.                                                           |
| `metallicRoughnessTexture` | Showcase smoke only.                                                | Readiness validates semantic `metallic-roughness`, data/linear color space, sampler state, `TEXCOORD_0/1`, and unsupported transforms. Shader samples roughness from G and metallic from B. Prepared-resource and pipeline paths can specialize metallic-roughness variants. | No controlled browser assertion proves authored G/B channels visibly affect roughness/metallic output.                                                       |
| `normalTexture`            | No browser proof.                                                   | Readiness validates semantic `normal`, data/linear color space, sampler state, `TEXCOORD_0/1`, and unsupported transforms. Extraction blocks missing tangents. Shader variant samples tangent-space normals when tangents are present.                                       | No browser scene proves tangent-gated normal mapping changes lit pixels, and no browser negative path proves missing tangents for a normal-mapped app scene. |
| `occlusionTexture`         | Showcase smoke only.                                                | Readiness validates semantic `occlusion`, data/linear color space, sampler state, `TEXCOORD_0/1`, and unsupported transforms. Shader samples red channel and applies `occlusionStrength` to ambient diffuse.                                                                 | No controlled browser assertion isolates ambient occlusion contribution from direct light and base color.                                                    |
| `emissiveTexture`          | Showcase smoke only.                                                | Readiness validates semantic `emissive`, sRGB color space, sampler state, `TEXCOORD_0/1`, and unsupported transforms. Shader multiplies emissive sample by `emissiveFactor`.                                                                                                 | No controlled browser assertion proves emissive texture contribution independently of direct/ambient lighting.                                               |

## Cross-Cutting Gaps

- Sampler behavior is diagnosed through readiness/fidelity summaries, but no
  StandardMaterial browser test compares nearest versus linear sampling or wrap
  modes. This should wait until slot-specific color assertions are stable.
- `TEXCOORD_1` is covered by unit and extraction tests for every rendered slot,
  but no browser scene proves a second UV stream changes StandardMaterial
  sampling.
- Unsupported texture transforms are currently diagnostic-only. There is no
  browser scenario for transform diagnostics, and rendering transformed UVs is
  intentionally deferred.
- GLB material mapping remains deferred. Browser texture coverage should first
  prove the authored `StandardMaterial` behavior before using imported GLB
  materials as test fixtures.
- Exact app-facade current-texture readback is still deferred to the readback
  task. Current StandardMaterial browser assertions rely on screenshots.

## Next Follow-Up

Proceed with the existing `task-1078` plan slice before adding another browser
fixture. The next controlled browser-visible implementation should focus on
`metallicRoughnessTexture` because it is the highest-value glTF PBR slot after
base color and has a direct shader path already in place.

The test should not claim full glTF PBR fidelity. It should use fixed lighting,
fixed geometry, and tiny authored textures to prove a visible difference between
two StandardMaterial peers caused by metallic/roughness channels, while keeping
IBL, shadows, GLB import, sampler comparisons, UV1, and texture transforms
deferred.

## Result

No ECS/render/WebGPU ownership drift was found. The renderer still treats
StandardMaterial textures as source assets referenced by ECS-authored material
handles, then derives GPU texture/sampler resources and bind groups inside the
WebGPU backend.
