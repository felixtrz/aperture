# Current Task

**M5 is ✅ COMPLETE (6/6).** The SOTA roadmap milestone **M5 (Close core PBR/IBL
correctness gaps)** is fully done, committed, pushed, and gate-green. Per the
active directive, no other milestone was started.

Source of truth is `docs/SOTA_ROADMAP.md` (its 📋 Status block + completion log +
Resume notes are authoritative).

Completed this milestone (each fully proven, gate-green, pushed):

- **M5-T1** (`7beb1ca`) — split-sum environment-BRDF (DFG) specular IBL.
- **M5-T2** (`3cc58d9`) — cosine irradiance-convolution compute pass for diffuse IBL.
- **M5-T3** (`4afc17e`) — equirect → cube projection + single-asset auto-IBL.
- **M5-T4** (`f85b7fe`) — persistent rgba16float HDR scene buffer; tonemap +
  exposure + sRGB moved to a final post stage.
- **M5-T5** (`bfa7e39`) — refractive transmission: IOR refraction + thickness +
  Beer-Lambert (KHR_materials_ior/volume).
- **M5-T6** (`64eb481`) — SSAO attenuates only indirect (ambient/IBL) light, not
  direct or emissive. Approach A: the lit pass emits a second color attachment
  carrying the separated indirect term (new `standard-indirect-channel-shader.ts`,
  threaded as `indirectColorFormat` alongside `motionVectorColorFormat`); SSAO
  removes only `indirect * (1 - visibility)`. Proof: `examples/ssao-indirect.*` +
  `test/e2e/ssao-indirect.spec.ts` (emissive cube in a high-AO corner preserved
  while the diffuse crease darkens).

Gate: `pnpm run check` = pass (392 files / 2211 tests). E2E proofs ibl-brdf,
ibl-irradiance, ibl-equirect, hdr-exposure, transmission-ior, ssao-indirect +
the tonemap-showcase / transmission / ssao / post-effects / taa regressions all
pass under SwiftShader + xvfb via `scripts/webgpu-e2e.sh`.

**KNOWN ENV ISSUE (pre-existing, not M5):** `test/e2e/dof.spec.ts` times out at
"loading" under SwiftShader — it fails on a clean tree too (verified by
stashing), so it is a pre-existing environment limitation, not an M5 regression.

## Next (out of scope for this run)

The active directive was to complete M5 only and not start another milestone.
The next milestone in wave/dependsOn order is **M3 (Render Graph, wave 2)** —
M3-T1 is the lowest-numbered todo. A future run should pick up there.

**LESSONS (carry forward):** (1) post-effect/shader WGSL must be proven by an
actual GPU draw + readback — a shader compile error still counts a draw but
writes nothing (caught the T4 parameter-shadowing and T6 `textureSample`-in-
non-uniform-flow bugs). (2) For view-dependent shading on transmissive/double-
sided surfaces, force the normal to face the viewer before refract/reflect;
read GPU inputs back as color when a term looks input-insensitive. (3) Infinity
is not JSON-safe — use a finite sentinel for "unbounded" material params. (4)
Some e2e specs hardcode environment-dependent values (swapchain format, scene
draw counts) — assert shapes/relations, not absolutes.
