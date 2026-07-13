---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Opt-in lit-surface bind contract for custom WGSL materials (parity plan A1).
`material.customWgsl({ lighting: "lit", ... })` makes the renderer bind a
versioned, renderer-owned `@group(3)` (packed light storage buffers + counts,
directional shadow matrices/map/comparison sampler, IBL irradiance/PMREM/
BRDF-LUT textures + samplers, fog params — the SAME renderer-owned resources
the StandardMaterial path consumes, with 1x1/zeroed fallbacks when a frame
lacks them) and prepend `APERTURE_LIT_WGSL_HEADER` to the material's module,
so shaders call `apertureCountLights` / `apertureEvaluateLight(Surface)` /
`apertureDirectionalShadow` / `apertureSampleIblIrradiance` /
`apertureSampleIblSpecular` / `apertureEnvironmentBrdf` / `apertureApplyFog` /
`apertureLinearToSrgb` with StandardMaterial math parity and zero app-side GPU
wiring. Lit pipelines compile against an explicit pipeline layout so one
shared group(3) bind group serves every lit material and is cached across
frames (`resourceReuse.litBindGroups*` counters, dirty-window
`queue.writeBuffer` light updates); the `lit:v1` contract-version segment
joins the pipeline key ONLY when lit, so absent/`"unlit"` materials keep
byte-identical keys and behavior. User WGSL declaring `@group(3)` on a lit
material is rejected (`customMaterialSource.litReservedBindGroup`); devices
missing the required creators degrade with `customWgslMaterial.lit*`
diagnostics. Ships with `examples/lit-custom-material.html` — a striped lit
custom sphere reproducing a StandardMaterial reference sphere's response
under a shared ambient + shadow-casting directional + point light rig — and
its A/B readback e2e. Contract table and versioning story:
`docs/LIGHT_SHADER_WGSL_CONTRACT.md` and `docs/DECISIONS.md` 0024.
