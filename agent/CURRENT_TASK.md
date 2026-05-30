# Current Task

**M5-T4 is ✅ done** (`f85b7fe`) — HDR rgba16float scene buffer + exposure
post-tonemap stage, fully proven and gate-green. SOTA roadmap **M5 (Close core
PBR/IBL correctness gaps)** is at **4/6 done** (T1, T2, T3, T4 all ✅).

Source of truth is `docs/SOTA_ROADMAP.md` (its 📋 Status block + completion log

- Resume notes are authoritative). **Next task: M5-T5** (refractive
  transmission; dependsOn M5-T4, now unblocked), then **M5-T6** (SSAO →
  indirect-only; dependsOn none).

Completed this run (fully proven, gate-green, pushed):

- **M5-T1** (`7beb1ca`) — split-sum environment-BRDF (DFG) specular IBL.
- **M5-T2** (`3cc58d9`) — cosine irradiance-convolution compute pass for
  diffuse IBL.
- **M5-T3** (`4afc17e`) — equirect → cube projection + single-asset auto-IBL.
- **M5-T4** (`f85b7fe`) — persistent rgba16float HDR scene buffer; tonemap +
  exposure + sRGB moved to a final post stage. `exposure?` on
  `CreateWebGpuAppOptions` → `app.sceneRenderFormat='rgba16float'`; the lit pass
  renders linear HDR (in-material tonemap skipped: pipeline-resources passes
  `tonemap:none`/`output-color:linear` when HDR); `create-webgpu-app` appends a
  new `post/post-tonemap.ts` `createWebGpuTonemapPostEffect` as the LAST stage
  (HDR buffer → `color*exposure` + operator + sRGB → 8-bit swapchain);
  `attachments.ts` routes the swapchain MSAA color attachment to
  `sceneRenderFormat` so HDR+MSAA resolves. Default (no exposure) byte-identical.
  Fixed a WGSL param-shadowing compile bug (`let color = color * exposure` →
  renamed param to `inputColor`) that string-only vitest missed and the e2e GPU
  readback caught. Proof: `examples/hdr-exposure.*` +
  `test/e2e/hdr-exposure.spec.ts` (sweep 0.25/1/4: monotonic brightening,
  pixelDistance>40, lit cacheKey carries no `tonemap:` token) + the unchanged
  `tonemap-showcase` regression.

Gate: `pnpm run check` = pass (391 files / 2205 tests). All named Playwright
proofs pass under SwiftShader + xvfb via `scripts/webgpu-e2e.sh`.

## Next: M5-T5 — Refractive transmission (IOR + thickness + Beer-Lambert)

dependsOn M5-T4 ✅. Plan (see the M5-T5 task block + Resume notes in
`docs/SOTA_ROADMAP.md`):

- Add `ior`/`thickness`/`attenuationColor`/`attenuationDistance` to
  `StandardMaterialAsset` (`packages/render/src/materials/types.ts`) +
  factory defaults (`factories.ts`, ior=1.5, thickness=0, large attenuation
  distance). Parse `KHR_materials_volume`/`KHR_materials_ior` in
  `gltf-material-extensions.ts`.
- Pack into `StandardMaterialUniform` (`standard-shader-source.ts` struct +
  `standard-material-buffer.ts`) — keep the std140/wgsl layout and the buffer
  packing in lockstep or bindings corrupt.
- Rewrite `applyStandardTransmissionSampling`
  (`standard-shader-extension-sampling.ts` ~473-531): `refract(-viewDir, normal,
1/ior)` → thickness-scaled screen offset over the grab buffer (now linear HDR
  from T4) + Beer-Lambert `exp(-coeff*thickness)` from
  attenuationColor/Distance (guard Distance>0; LOD from roughness, not a magic
  blur constant).
- Proof: extend `examples/transmission` (or a `transmission-ior` route) for
  ior=1.0/1.5/2.0 + thick/thin attenuation probes; `test/e2e/transmission-ior.spec.ts`
  (ior-shift + thickness-tint deltas); vitest for the glTF extension parse.

**LESSON (carry forward):** post-effect / shader WGSL must be proven by an
actual GPU draw + readback, not string assertions — a shader compile error
still counts a draw but writes nothing to the target.
