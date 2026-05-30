# Current Task

No active task is currently checked out.

Status: SOTA roadmap **M5 (Close core PBR/IBL correctness gaps)** is at **3/6
done** (T1, T2, T3 all ✅ done & fully proven). Source of truth is
`docs/SOTA_ROADMAP.md` (its 📋 Status block + completion log + Resume notes are
authoritative). Recommended next task: **M5-T4** (persistent rgba16float HDR
scene buffer + exposure; no deps, no asset blocker) — see the roadmap Resume
notes for the T4 plan. M5-T6 (SSAO→indirect) is also ready; M5-T5 depends on T4.

Completed this run (both fully proven, gate-green, pushed):

- **M5-T1** (`7beb1ca`) — split-sum environment-BRDF (DFG) specular IBL. New
  `brdf-lut-compute-pipeline.ts` (rg16float GGX DFG integration +
  `integrateEnvironmentBrdf` CPU mirror) + `brdf-lut-resource.ts`. New
  `iblSpecularBrdf` shader variant (analytic Karis DFGApprox) supersedes
  `iblSpecularProof`, reusing the specular cube (group 3 binding 7).
  Proof: `examples/ibl-brdf.*` + `test/e2e/ibl-brdf.spec.ts`.
- **M5-T2** (`3cc58d9`) — cosine irradiance-convolution compute pass for
  diffuse IBL. New `irradiance-convolution-compute-pipeline.ts` +
  `createDiffuseIblTextureResourceReport` convolves by default (32² cube) when
  the device supports compute. Proof: `examples/ibl-irradiance.*` +
  `test/e2e/ibl-irradiance.spec.ts`.

Gate: `pnpm run check` = pass (387 files / 2188 tests). Both named Playwright
proofs pass under SwiftShader + xvfb via `scripts/webgpu-e2e.sh`.

Recommended next task: **M5-T3** (equirectangular HDR → cubemap projection +
auto-wire single-asset IBL). Deps (M5-T2) are met.

- BLOCKER to verify first: M5-T3 Done-when #1 wants a **real equirect `.hdr`
  loaded via `loadHdrFromUri`**, but the repo only ships
  `examples/assets/pisa-studio-rgbe-cube.hdr` (a 6:1 cube atlas, NOT a 2:1
  equirect). Either author a small valid Radiance/RGBE equirect `.hdr` asset,
  or feed synthesized equirect float/byte data through the same projection
  path and document the deviation.
- Projection math (from `references/three.js/src/nodes/utils/EquirectUV.js`):
  `u = atan2(dir.z, dir.x) / (2π) + 0.5`, `v = asin(clamp(dir.y,-1,1)) / π + 0.5`.
  Reuse `cubeDirection()` from `pmrem-compute-pipeline.ts` (lines 220-243) for
  face orientation so reflections are not mirrored/rotated.

**M5-T4** (HDR rgba16float scene buffer + exposure) and **M5-T6** (SSAO →
indirect-only) are ALSO ready (no deps) and have no external-asset blocker — a
good alternative if the T3 equirect asset is deferred. T5 depends on T4.
