---
"@aperture-engine/app": minor
"@aperture-engine/render": patch
---

Expose the full PBR extension factor set on the app-facade standard material
surface. `material.standard()` now accepts transmission/volume/IOR, clearcoat,
sheen, iridescence, occlusion-strength, and normal-scale factors plus
render-state control, matching `StandardMaterialAsset`; `StandardMaterialPatch`
(and therefore `this.materials.set`) gains the clearcoat and iridescence
fields. Patches inside the active shader variant keep the pipeline key stable
and never recompile.
