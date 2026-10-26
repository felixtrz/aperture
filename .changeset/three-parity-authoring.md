---
"@aperture-engine/render": minor
"@aperture-engine/app": minor
"@aperture-engine/cli": patch
---

Close the authoring gaps agents hit when building the same scenes in three.js
and Aperture:

- `material.standard()` / `material.unlit()` accept `opacity` (or a translucent
  `baseColor` alpha), `doubleSided`, and (standard) `alphaMode` / `alphaCutoff`
  / `renderState`, producing a valid blend/mask render state with depth writes
  handled for you.
- `this.materials.create(id, descriptor)` and `this.meshes.create(id,
  descriptor)` return shareable handles; `this.meshes.publish()` and dynamic
  meshes accept primitive descriptors, so per-frame geometry needs no render
  imports. `MeshHandle`, `MaterialHandle`, `TextureHandle`,
  `EnvironmentMapHandle` and `MeshAsset` are re-exported from
  `@aperture-engine/app/systems`.
- `mesh.merge(parts, { flatShading })` bakes transformed primitives with
  per-part vertex colors into one mesh (`createMergedMeshAsset` in render);
  `mesh.triangleList` / `mesh.heightfield` accept per-vertex `colors` (COLOR_0).
- `mesh.cylinder` exposes `radiusTop` / `radiusBottom` / `height` /
  `heightSegments`; cone and capsule accept `height`.
- `color.hex()` / `color.srgb()` convert sRGB swatches to linear like three.js
  `Color`.
- An authored `ProceduralSky` without an environment or ambient light now gets
  sky-matched image-based lighting instead of none.
- Scaffolded `AGENTS.md` / `CLAUDE.md` gain a three.js-to-Aperture mapping.
