# Street-corner diorama — vGPU 0.6.0

Final capture: **composed**. Authoring is frozen.

This still recreates the supplied street corner using procedural 3D triangle meshes, native vGPU resources and explicit passes. It includes the cream corner cafe, sage bookshop, striped awnings, paved sidewalk, L-shaped road and crossing, two compact cars, faceted trees, street lamps and outdoor furniture.

## Implementation

`main.js` authors a single deterministic mesh stream with per-vertex normals and colors. `shadow.wgsl` renders sun depth into a native vGPU offscreen target; `scene.wgsl` shades the geometry with warm directional/fill illumination and a 25-tap filtered shadow. `sign.wgsl` renders a small procedural Canvas2D serif text atlas on the two world-space shop signs. There are no reference-image textures or billboard scene substitutes. `wgpu-matrix` supplies view/projection math. No Three.js or Aperture renderer is imported.

The surface uses 4x MSAA at 1200 × 900 and DPR 1. One frame is submitted; the code awaits vGPU frame completion, settled errors and the verifier's GPU-completion hook before reporting readiness. The fixed seed is 91373.

## Reproduce

From `/workspace/aperture`, use an unused capture label:

```sh
node benchmarks/street-corner-20261017/shared/capture.mjs vgpu reproduction
```

The shared harness is the only browser-launch route. For a static build only:

```sh
cd benchmarks/street-corner-20261017/authors/vgpu
node /workspace/aperture/node_modules/vite/bin/vite.js build
```

See `journal.md` for iterations and resolved failures, and `result.json` for the final object list and visual limitations. Five capture attempts were used; three succeeded. The final verified image is `../../evidence/vgpu/composed/render.png`.
