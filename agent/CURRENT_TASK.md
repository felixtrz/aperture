# Current Task

**M5-T5 is ✅ done** (`bfa7e39`) — refractive transmission (IOR refraction +
thickness + Beer-Lambert), fully proven and gate-green. SOTA roadmap **M5 (Close
core PBR/IBL correctness gaps)** is at **5/6 done** (T1–T5 all ✅).

Source of truth is `docs/SOTA_ROADMAP.md` (its 📋 Status block + completion log +
Resume notes are authoritative). **Next task: M5-T6** (SSAO → indirect/ambient/
IBL only, not direct light; dependsOn none) — the last remaining M5 task.

Completed this run (fully proven, gate-green, pushed):

- **M5-T1** (`7beb1ca`) — split-sum environment-BRDF (DFG) specular IBL.
- **M5-T2** (`3cc58d9`) — cosine irradiance-convolution compute pass for diffuse IBL.
- **M5-T3** (`4afc17e`) — equirect → cube projection + single-asset auto-IBL.
- **M5-T4** (`f85b7fe`) — persistent rgba16float HDR scene buffer; tonemap +
  exposure + sRGB moved to a final post stage.
- **M5-T5** (`bfa7e39`) — refractive transmission. Added ior/thickness/
  attenuationColor/attenuationDistance to StandardMaterialAsset (attenuationDistance=0
  is the JSON-safe "no absorption" sentinel for the glTF +Infinity default).
  Parsed KHR_materials_ior + KHR_materials_volume. Packed transmissionVolume +
  attenuationColor vec4s into StandardMaterialUniform (68→76 floats). Rewrote
  applyStandardTransmissionSampling: `refract(-viewDir, N, 1/ior)` → walk
  thickness → project exit to the grab buffer (ior=1 ⇒ no shift) + Beer-Lambert
  `pow(attenuationColor, thickness/attenuationDistance)`. KEY FIX: the
  transmissive fragment's shading normal faced away from the camera, making
  refract() ior-insensitive; forced a viewer-facing normal
  (`select(-N, N, dot(N,viewDir) >= 0)`) before refract. Proof:
  examples/transmission-ior.\* + test/e2e/transmission-ior.spec.ts (IOR sweep
  shifts the background monotonically; amber volume absorbs blue by thickness).

Gate: `pnpm run check` = pass (391 files / 2208 tests). All named Playwright
proofs pass under SwiftShader + xvfb via `scripts/webgpu-e2e.sh`.

## Next: M5-T6 — SSAO applies to indirect/ambient/IBL only, not direct light

dependsOn none. Approach (B) (see the M5-T6 task block + Resume notes in
`docs/SOTA_ROADMAP.md`):

- Stop the final-color multiply in `post-ssao.ts` (~line 561 returns
  `source.rgb * visibility` over the whole composited color).
- Bind the SSAO visibility texture into the standard shader and fold it into the
  ambient + IBL occlusion factor (combine with the existing occlusionTexture
  term ~`standard-shader-source.ts:695`; multiply diffuseIbl/specularIbl by AO in
  `standard-shader-ibl-sampling.ts`); add a binding in
  `standard-shader-variant-bindings.ts` if approach B needs one. Keep the SSAO
  pass PRODUCING visibility; change its CONSUMPTION so direct light is untouched.
- Proof: `examples/ssao-indirect` (or extend `examples/ssao`) — a creased
  surface lit by ONE strong direct light + ambient/IBL; with SSAO on, the crease
  GPU-readback probe darkens (> large threshold) while a direct-lit probe barely
  changes (< small threshold) vs SSAO-off.

**LESSONS (carry forward):** (1) post-effect/shader WGSL must be proven by an
actual GPU draw + readback — a shader compile error still counts a draw but
writes nothing. (2) For view-dependent shading (refraction/reflection) on
transmissive/double-sided surfaces, force the normal to face the viewer before
refract/reflect; when a term looks input-insensitive, read the GPU inputs
(normal/viewDir/worldPos) back as color to diagnose. (3) Infinity is not
JSON-safe — use a finite sentinel for "unbounded" material params.
