# Controlled StandardMaterial Normal-Map Browser Verification Plan - 2026-05-17

## Scope

Plan the smallest browser-visible verification for `StandardMaterial.normalTexture`
after app-facade readback and controlled base-color/metallic-roughness browser
coverage landed.

This is a planning slice. It does not implement a browser scenario, tangent
generation, GLB import, IBL, shadows, UV1 browser coverage, or texture-transform
support.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/mesh/primitives.ts`
- `packages/render/src/materials/standard-normal-map-readiness.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/standard-normal-map-readiness.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current State

Normal-map rendering is implemented below the browser layer:

- `standard-shader.ts` can generate a tangent-space normal-map variant that
  reads `normalTexture`, applies `normalScale`, and builds a TBN basis from
  normal, tangent, and tangent sign.
- `standard-pipeline.ts` and `standard-pipeline-descriptor.ts` select a vertex
  layout with `TANGENT` when the pipeline key includes `normalTexture`.
- `standard-normal-map-readiness.ts` blocks authored normal maps unless the mesh
  has a `TANGENT` vertex attribute.
- Unit and WebGPU app tests already cover prepared normal-map resources and the
  tangent layout.

The browser gap is the mesh fixture. Aperture's built-in primitive mesh helpers
currently emit `POSITION`, `NORMAL`, and `TEXCOORD_0`; they do not include
`TANGENT`. Existing tests add a local tangent stream wrapper, which is the right
pattern for a controlled browser fixture until tangent generation becomes a
separate simulation/asset task.

## Selected Browser Assertion

Extend the controlled StandardMaterial texture browser harness with a scenario
such as `?scenario=normal-map`.

Preferred positive-path shape:

- Use `createBoxMeshAsset()` wrapped by a small local example helper that adds a
  `TANGENT` `float32x4` attribute to the interleaved stream, matching the
  existing test fixture pattern.
- Render two StandardMaterial peers through `createWebGpuApp`:
  - a scalar baseline with no normal texture;
  - a normal-mapped peer using a tiny normal texture and the tangent-enriched
    mesh.
- Keep base-color, metallic-roughness, occlusion, and emissive textures disabled
  in this first scenario so the assertion isolates the normal-map slot.
- Use fixed camera and directional light placement that makes the normal-map
  perturbation visible.
- Publish JSON-safe status with texture slot, normal texture semantic/color
  space, normal scale, tangent availability, pipeline keys, resource counters,
  app-facade readback samples, and diagnostic codes.

Expected assertions:

- The snapshot includes two StandardMaterial draws and no diagnostics.
- The pipeline keys include `standard|normalTexture|opaque|back|less|none`.
- The mesh layout key includes `TANGENT`.
- One normal texture resource and one sampler resource are created.
- Screenshot and/or app-facade readback samples show the normal-mapped peer is
  visibly distinct from the scalar peer and clear color.

## Negative Path

Add a paired scenario such as `?scenario=normal-map-missing-tangents` in the
same implementation slice if it stays small.

The negative scenario should:

- author a normal-mapped StandardMaterial on the regular built-in box or plane
  mesh without a `TANGENT` attribute;
- keep a scalar peer ready when possible;
- assert extraction blocks the normal-mapped draw with
  `render.standardNormalMap.missingTangents`;
- submit no draw calls for the invalid frame, matching existing source-readiness
  failure behavior in the controlled texture harness.

If adding the negative path makes the implementation slice too broad, keep it as
the first follow-up after the positive normal-map browser proof.

## Non-Goals

- Do not add automatic tangent generation in this task. Tangent generation
  belongs in a separate asset/simulation-safe slice.
- Do not use a GLB fixture to prove normal maps yet. Browser coverage should
  first prove authored StandardMaterial behavior.
- Do not add IBL, shadows, UV1 browser coverage, sampler comparison, or
  texture-transform support.
- Do not claim full glTF PBR fidelity; this only proves Aperture's current
  tangent-space normal-map path affects direct-lit StandardMaterial pixels.

## Follow-Up

Proceed with `task-1086`: add the positive normal-map browser scenario and, if
small, the missing-tangent negative scenario. Keep `task-1087` as the boundary
audit afterward because the implementation will introduce a local tangent mesh
fixture in a browser example.
