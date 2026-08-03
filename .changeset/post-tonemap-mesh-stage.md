---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Add a post-tonemap render stage to unlit mesh materials, and stop input resets
from swallowing input recorded earlier in the same frame.

`material.unlit({ renderStage: "post-tonemap", toneMapped: false })` routes a
mesh draw into the overlay boundary the post stack encodes AFTER its tonemap
pass, so the draw composites into the presentation target and blends in DISPLAY
space. This is the mesh sibling of the particle renderer's `renderStage` /
`toneMapped` options and the direct equivalent of a three.js
`MeshBasicMaterial({ toneMapped: false })` overlay.

Without it, a translucent board decal, glow disc, reticle or ring authored as an
unlit material wrote its color into the HDR scene buffer, blended there in
linear space, and was then tone-mapped — which washes it out. Pre-inverting the
authored color does not fix a TRANSLUCENT overlay: the inverse pushes the color
above 1, and the blended fraction of that HDR value tone-maps somewhere else
entirely. A measured case: a `0x7ef6dc` pad at alpha 0.21 over a `33,34,35`
board reads `51,75,71` when blended in display space and `144,180,173` when
blended in the HDR buffer; inverting the pad's green to HDR 2.05 makes 20% of it
tonemap to ~200 instead of 80. Apps that worked around this by hand-rolling an
inverse-ACES helper inside custom WGSL shaders (`sourceOutputToHdr()`-style)
should move those draws to this option — it is the supported route, and it
removes the need for the shader-side inverse entirely.

The option lives on unlit materials only. A standard material's fragment output
is scene radiance the post stack owns — exposure, bloom and tonemap — so moving
it past that stack would clip its highlights and desync it from every other lit
surface; `StandardMaterialOptions` therefore rejects the field at compile time.

Details: the stage travels authoring -> material asset -> pipeline key ->
`MeshDrawPacket.renderStage` -> packed snapshot -> draw-stage selection. A
post-tonemap pipeline is built for the boundary it lands in (swapchain color
format, one color target, sample count 1, read-only depth that it tests but
never writes), and the frame plan writes those draws into their own command
stream so neither stream inherits the other's elided pipeline/bind-group state.
The stage applies only when an HDR scene pass and an enabled post stack exist;
without them mesh materials already tonemap in-material and write display-space
color, so a scene-stage draw already blends in display space and the option is a
no-op rather than a degradation. Under MSAA the overlay boundary cannot bind the
multisampled depth attachment, so post-tonemap draws lose depth testing there —
the same limitation post-tonemap particles have.

Separately, an input reset (`window-blur`, `document-hidden`, or an app-sent
one) now releases held virtual-action state without erasing press edges already
recorded in the same frame, matching what keyboard and pointer resets have
always done. Previously the reset cleared the virtual-action map outright, so
any `dispatchApertureInputAction(...)` sent from an app's own
`visibilitychange`/`blur` listener was silently wiped: same-event listeners fire
in registration order, an app listener registered at module scope always runs
before the generated forwarder's, and both landed in one frame's input batch —
so a "pause when the tab hides" handler shipped as a complete no-op with no
diagnostic. Input reset semantics are now documented in `docs/AUTHORING.md`.
