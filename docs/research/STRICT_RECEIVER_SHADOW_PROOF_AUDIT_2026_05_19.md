# Strict Receiver Shadow Proof Audit — 2026-05-19

## Scope

Audited the GLTF strict receiver shadow proof after adding
`shadow.depthProbe`, angling the directional light, moving the existing
StandardMaterial plane into the caster footprint, and removing the projected
receiver envelope from the StandardMaterial shadow receiver shader.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `packages/webgpu/src/webgpu/shadow-depth-probe.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`

## Findings

The strict receiver proof preserves the project boundaries:

- ECS remains authoritative for light, transform, material, mesh, and shadow
  authoring data.
- The shadow depth texture, comparison sampler, command buffer, depth probe
  pass, and readback buffer remain renderer/WebGPU-owned.
- `shadow.depthProbe` returns only JSON-safe keys, counts, UV/depth numbers,
  texels, compare results, statuses, and diagnostics. It does not expose raw
  GPU handles.
- The StandardMaterial receiver shader no longer uses the projected receiver
  envelope constants or fallback. It returns lit outside the light projection
  and uses the strict comparison result inside the projection.
- Playwright still proves the combined group 3 route, submitted shadow command
  buffer, strict probe pair, visible receiver pixel delta, and absence of WebGPU
  validation warnings.

The proof is still a narrow first-shadow slice. It does not add IBL shader
sampling, PCF filtering, cascades, bias tuning beyond the existing compare bias,
shadow atlas management, multi-light shadows, or binary GLB loading.

## Recommendation

Next focused task: start IBL shader sampling now that the strict receiver shadow
proof is stable. Keep it narrow:

- Consume the already-created StandardMaterial IBL group 4 bind group through
  the app frame-resource path.
- Add the smallest diffuse IBL shader contribution that can be proven with the
  GLTF scene status and a browser pixel/readback delta.
- Keep specular prefiltering, BRDF LUTs, skybox rendering, and broad PBR
  completeness deferred.
