---
"@aperture-engine/app": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/cli": minor
---

Generated apps now default to a filmic, lit baseline instead of a raw neutral one.

- **ACES tonemapping by default**: generated apps (and the CLI headless render path) resolve `render.tonemap` to `"aces"` through the HDR scene buffer at `exposure: 1`. An explicit `tonemap: "none"` with no exposure/bloom keeps the legacy byte-identical 8-bit path for golden baselines. The low-level `createWebGpuApp` default is unchanged (`"none"`).
- **Zero-config default environment**: a daylight gradient sky (`ProceduralSky`) plus matching image-based lighting (synthesized equirect fed through the PMREM/irradiance chain) installs automatically unless the app authors its own `ProceduralSky`, `Skybox`, or environment light — or sets `render.defaultEnvironment: false`.
- **Environment lights now work in generated apps**: `createWebGpuApp` auto-prepares environment-map assets from the source registry per snapshot (memoized by asset version); previously `prepareWebGpuAppEnvironmentAssets` was only reachable from hand-written harnesses, so authored IBL never rendered in generated apps.
- **`render.ssao`**: screen-space ambient occlusion is now reachable from generated-app config (boolean or `{ radiusPixels, intensity, power, sampleCount }`), wired before bloom.
- **`material.standard()` defaults to a dielectric** (`metallic: 0`); glTF imports keep the glTF spec default (`metallicFactor: 1`).
- **CLI templates upgraded to the showcase recipe**: shadow-casting sun (no ambient fill — the environment supplies it), ground shadow receiver, `castShadow`/`receiveShadow` on meshes, subtle bloom, and the ACES/HDR render block.

New docs: `docs/VISUAL_QUALITY.md` (the default look, suppression rules, flat-scene checklist) and an AGENTS.md "Visual Quality Defaults" section; decision 0023 records the rationale.
