# Controlled StandardMaterial Metallic-Roughness Browser Verification Plan - 2026-05-17

## Scope

Plan the smallest browser-visible verification for
`StandardMaterial.metallicRoughnessTexture` after the base-color texture control
example landed.

This is a planning slice. It does not implement a new example, shader behavior,
texture upload behavior, GLB loading, IBL, shadows, sampler comparison, UV1
browser coverage, or texture-transform support.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_METALLIC_ROUGHNESS_BROWSER_COVERAGE_PLAN_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `packages/render/src/materials/gltf-material.ts`
- `test/assets/gltf-asset-mapping.test.ts`

## Current State

The shader and resource route already have enough support for a controlled
metallic-roughness browser proof:

- `standard-shader.ts` samples roughness from the metallic-roughness texture's G
  channel and metallic from the B channel.
- `standard-app-frame-resources.ts` routes StandardMaterial materials with a
  `metallicRoughnessTexture` through the textured StandardMaterial resource
  preparation path.
- `prepared-standard-material-cache.ts` derives source-version dependency keys
  for `metallicRoughnessTexture` texture and sampler resources.
- Unit tests verify metallic-roughness shader bindings, WGSL channel reads,
  dependency keys, readiness metadata, and glTF mapping into StandardMaterial
  fields.

The browser gap is not shader support. The gap is a deterministic app-facade
scene that proves the authored G/B channels cause a visible result.

## Selected Browser Assertion

Add a dedicated controlled scenario rather than expanding the animated
materials showcase.

Preferred shape:

- Reuse `examples/standard-texture-control.html` and extend
  `examples/standard-texture-control.js` with a scenario such as
  `?scenario=metallic-roughness`.
- Keep fixed camera, fixed clear color, fixed ambient light, and one fixed
  directional light.
- Render two StandardMaterial peers with the same mesh and same base color:
  - a scalar baseline using low metallic and high roughness factors;
  - a textured peer using `metallicRoughnessTexture` with intentionally distinct
    G/B channels, for example roughness near `0.05` and metallic near `1.0`.
- Keep the base-color texture slot disabled in this first scenario so the
  assertion isolates the metallic-roughness texture path.
- Publish JSON-safe status containing the selected scenario, expected
  metallic/roughness channel values, stable sample coordinates, pipeline keys,
  texture/sampler resource counters, draw counts, and diagnostic codes.

Expected assertions:

- The snapshot includes two StandardMaterial draws and no extraction
  diagnostics.
- The pipeline keys include
  `standard|metallicRoughnessTexture|opaque|back|less|none`.
- One metallic-roughness texture resource and one sampler resource are created
  for the textured peer.
- The textured sample is visibly distinct from the scalar baseline and from the
  clear color.
- The test uses tolerant screenshot pixel-distance assertions, not exact PBR
  color matching.

## Non-Goals

- Do not claim complete glTF PBR fidelity. This only proves the authored
  metallic-roughness texture path affects a direct-lit StandardMaterial frame.
- Do not add IBL or shadows. The shader remains the current direct-lit MVP.
- Do not add GLB import/browser viewer coverage. Imported materials should wait
  until authored StandardMaterial behavior is browser-proven.
- Do not test sampler wrap/filter differences in this scenario.
- Do not add UV1 browser coverage or texture transform rendering here.
- Do not expose GPU textures, bind groups, command encoders, queues, or raw
  readback surfaces through the app facade.

## Risk And Mitigation

Metallic and roughness are lighting-dependent, so the test is less direct than
the base-color texture proof. Use a deliberately high-contrast pair and assert a
relative pixel difference rather than an exact expected color. If screenshot
sampling is too unstable across WebGPU implementations, defer the precise pixel
assertion until optional app-facade current-texture readback support lands and
keep the first browser scenario limited to pipeline/resource/diagnostic
verification.

## Follow-Up Task

Add `task-1082` for the implementation slice:

- extend the controlled StandardMaterial texture browser example with a
  `metallic-roughness` scenario;
- add focused Playwright coverage for pipeline key, resource counters, JSON-safe
  status, and tolerant visual distinction;
- keep GLB import, IBL, shadows, sampler comparisons, UV1, and texture
  transforms deferred.

## Result

No architecture decision is needed. The planned scenario remains inside the
current ECS-authored material asset, render extraction, WebGPU-owned prepared
resource, and app-facade boundaries.
