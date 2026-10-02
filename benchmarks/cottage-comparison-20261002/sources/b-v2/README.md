# Editable cottage: native three.js control

Independent revised source submission (submission 2, the single allowed revision) by `/root/author_three_cottage`.

## Serving

Use a trusted loopback static server with these two read-only mounts:

- This directory at the root `/` (or any prefix, retaining relative index/module linkage)
- `/workspace/scratch/0190a8c72f8a/aperture-recovery-20261002` at `/engine/`

No import map, bundling, installed package, remote request, browser worker, external asset or application server is required. The scene imports `/engine/shadow-lab/src/compare/three.webgpu.js`, which imports its sibling `three.core.js`. Both must be the exact unchanged supplied vendor bytes. The runtime verifies the actual `REVISION` is `185dev`; it makes no release-label assertion.

Use only the parent-authorized `pnpm run render:cloud` or `runVerifiedScene` path. Capture 800 × 800 at pixel ratio 1 and wait for `__COTTAGE_READY__.ok`. This author submission does not start a server or launch a browser.

## Views and edits

- `/?view=front&edit=base`: reference-facing three-quarter composition
- `/?view=rear&edit=base`: opposite three-quarter camera, genuine back walls
- `/?view=side&edit=base`: fixed right-side camera
- `/?view=front&edit=roof`: the roof rise above its fixed eaves increases by exactly 30%, from 1.61 to 2.093. Ridge Y therefore changes from 3.55 to 4.033, while both outer eave edges stay at Y=1.94. The solid roof, gables and narrow wall-to-roof closure adjust together
- `/?view=front&edit=bench`: seat and back slat width increase from 1.93 to 2.4125. Leg attachment positions are recomputed from the width with the same 0.13 end inset. Individual legs retain their thickness
- `/?view=front&edit=trees`: both entire tree groups move outward along X by exactly 0.6, leaving their Z coordinates and geometry unchanged

All view/edit combinations are supported. Unknown names fail explicitly.

## Editable structure and independent checks

`parametersFor(edit)` returns the deterministic authored dimensions. `createCottage(edit, view)` returns the real scene, camera, root, parameters, and manifest without creating a renderer. It can be used for independent structural checks. All geometry is standard boxes/cylinders or explicit convex polygon solids. The doorway is a hole between actual wall segments with an actual enclosed room behind it; no dark door decal blocks the opening. The blue window is a recessed physical pane within a second real wall opening. Four separate slabs, two separate cone tiers per tree, and individual bench slats/supports/legs are retained.

The manifest is exposed as `__COTTAGE_PARTS__` and within `__COTTAGE_READY__.parts`, including per-part world-space bounds measured from real transformed vertices, triangle counts, named groups, parameters, palette and fixed camera values. `__COTTAGE_SCENE__` exposes the editable objects and constructor functions for inspection. Grounds used only as a neutral shadow receiver are excluded from editable scene bounds.

No image, texture, imported mesh, random geometry, animation or screenshot-based construction is used. The exact vendor is imported unmodified. The renderer instance's fallback callback is cleared before initialization and the backend type is checked after initialization; lack of native WebGPU fails instead of attempting WebGL.

## Submission status

This is the single revised source submission. The parent's first retained render stopped during initialization because the original ready global was assigned too early; no screenshot existed and no visual tuning was done. Initialization now uses a separate `__COTTAGE_PROGRESS__` global, while `__COTTAGE_READY__` is assigned only upon terminal success or failure. This revision also applies the shared clarification that the roof edit multiplies the rise above fixed eaves by 1.30. All baseline visual parameters remain unchanged.

This author performed no browser launch, server start, test producing writes, package install, engine change or external effect. The parent owns retained render attempts. The original submission is preserved in the parent directory; no further author revision remains in the budget.
