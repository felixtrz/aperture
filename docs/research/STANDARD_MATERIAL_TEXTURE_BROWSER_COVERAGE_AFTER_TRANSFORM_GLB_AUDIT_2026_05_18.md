# StandardMaterial Texture Browser Coverage After Transform/GLB Audit - 2026-05-18

## Scope

Audit StandardMaterial browser texture coverage after the controlled
base-color texture-transform diagnostic scenario and the minimal
GLB-derived base-color texture fixture landed.

This audit does not add new renderer behavior, shader features, GLB parsing,
IBL, shadows, or sampler-address verification.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`
- `docs/research/GLB_STANDARD_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`
- `examples/standard-texture-control.js`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-texture-control.spec.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-texture.ts`

## Updated Browser Matrix

| Area                                       | Browser status                                                                                                                                        | Remaining browser-visible gap                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `baseColorTexture` authored source         | Positive proof, UV1 proof, linear-sampler proof, missing/loading/failed texture diagnostics, and unsupported texture-transform diagnostics.           | Address-mode sampler comparison remains unplanned/unstyled in browser.                                                                    |
| `metallicRoughnessTexture` authored source | Controlled positive proof.                                                                                                                            | No GLB browser handoff, UV1-specific proof, sampler address proof, texture-transform diagnostic fixture, IBL, or shadow-integrated proof. |
| `normalTexture` authored source            | Controlled positive proof with local tangent-enriched mesh plus missing-tangent no-submit diagnostics.                                                | No GLB normal-map fixture, UV1-specific proof, sampler address proof, or transform diagnostic fixture.                                    |
| `occlusionTexture` authored source         | Controlled positive proof under ambient-focused lighting.                                                                                             | No GLB browser handoff, UV1-specific proof, sampler address proof, or combined IBL/shadow proof.                                          |
| `emissiveTexture` authored source          | Controlled positive proof under low-light conditions.                                                                                                 | No GLB browser handoff, UV1-specific proof, sampler address proof, or transform diagnostic fixture.                                       |
| GLB/glTF source handoff                    | Minimal GLB-equivalent base-color texture fixture maps material, texture, sampler, and mesh source assets into the normal ECS/app-facade render path. | No real binary GLB container browser example, no GLB transform diagnostic fixture, and no broader glTF PBR slot browser handoff.          |

## Boundary Check

The current browser coverage remains aligned with the architecture:

- Authored scenarios still go through `createWebGpuApp`, typed assets, ECS mesh
  and material handles, extraction, and WebGPU-owned prepared resources.
- The GLB fixture uses report-driven glTF mapping and source registration before
  authoring ECS components. It does not create renderer-owned scene nodes or
  expose raw GPU state.
- Browser status reports JSON-safe handles, mapping summaries, stage counts,
  pipeline/layout keys, diagnostics, draw counts, and optional readback samples.
- The glTF texture mapper now marks decoded image texture assets with
  `["sampled", "copy-dst"]`, which matches the WebGPU upload requirement without
  moving GPU ownership into the source asset layer.
- Texture-transform sampling remains intentionally unsupported. The browser
  transform scenario proves the no-submit diagnostic path, not transform shader
  support.

## Findings

Implementation gaps:

- Address-mode sampler behavior still needs a focused browser plan and fixture.
- GLB texture-transform diagnostics still need a narrow browser plan.
- Full binary GLB loading and broader glTF PBR slot handoff remain future work.

Intentional unsupported-feature diagnostics:

- Texture transforms are detected and blocked before draw submission.
- Normal maps without tangents are detected and blocked before draw submission.
- IBL, shadows, and full glTF PBR fidelity are outside the current direct-lit
  StandardMaterial proof path.

## Recommendation

Keep the ready queue order:

1. Plan controlled StandardMaterial address-mode sampler browser verification.
2. Plan GLB StandardMaterial unsupported texture-transform diagnostics browser
   verification.
3. Add an audit/refactor task after those plans or after their implementation
   slices, whichever changes the harness first.

## Validation

- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm exec vitest run test/materials/gltf-texture.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
