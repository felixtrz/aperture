---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Custom shadow-caster displacement hook for custom WGSL materials (parity plan
A4) — the analog of three.js `customDepthMaterial`/`castShadowPositionNode`.
`material.customWgsl({ entryPoints: { shadowVertex } })` opts a material into a
per-material depth-only caster pipeline compiled from the SAME WGSL module, so
vertex displacement applied by the main vertex entry can be mirrored into the
shadow silhouette. The caster binds the shared caster's group(0) contract (the
pass's light view-projection uniform + caster world transforms indexed by
`instance_index`), an empty reserved group(1), and the material's own group(2)
bindings resolved to the same GPU resources as the main pass. `shadowVertex`
participates in the material pipeline key only when authored (materials without
it keep byte-identical keys and the shared position-only caster); caster
pipelines/bind groups are cached per material with create/reuse counters in the
frame report (`resourceReuse.customShadowCasterPipelines*`,
`report.shadow.resourceReuse.customWgslPipelines*`); realization failures
(`customWgslMaterial.shadowCaster*` diagnostics) fall back to the shared
caster. Ships with the `examples/shadow-displacement.html` wind-flag example
whose ground shadow waves in lockstep with the displaced mesh.
