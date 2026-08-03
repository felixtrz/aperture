---
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Depth-test post-tonemap draws under MSAA, and add `mesh.torus`.

**Post-tonemap draws are now occluded by the scene at every sample count.** The
overlay boundary composites into the single-sample presentation target, and a
render pass cannot mix sample counts, so an MSAA app simply dropped the depth
attachment there: every `renderStage: "post-tonemap"` mesh and particle was
painted unconditionally over the resolved frame. A translucent board decal
covered the character standing on it; a spark behind a wall shone through it.
The identical app at `render.sampleCount: 1` occluded both correctly, so the
behavior depended on an unrelated quality setting — and the workaround was to
turn antialiasing off.

The frame now copies the multisampled scene depth into a single-sample
attachment (a fullscreen pass reading `texture_depth_multisampled_2d` and
writing `@builtin(frag_depth)`, with its color target masked off) and binds
that read-only for the overlay. Post-tonemap mesh and particle pipelines
therefore declare depth state at every sample count. WebGPU has no hardware
depth resolve and a single-sample attachment holds one value per pixel, so the
copy takes sample 0: an overlay's occlusion edge is aliased by one pixel where
a multisampled scene edge is not. Color is untouched — the occluder's own edge
stays fully antialiased. Single-sample apps keep binding their own depth
attachment and encode no extra pass.

**`mesh.torus({ radius, thickness, segments?, tubeSegments? })`** exposes the
ring/tube primitive the render package could already build. `radius` reaches
the middle of the tube and `thickness` is the band's drawn width, so a band
measured off a reference frame is authored with that number directly. Without
it, a flat ring — a selection marker, a charge arc, a decal outline — had to be
faked with concentric `mesh.lineList` loops, which read as separate hairline
strokes with gaps between them at any resolution instead of one solid band.
