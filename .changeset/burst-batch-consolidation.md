---
"@aperture-engine/webgpu": minor
---

Batch GPU-analytic particle bursts by what the draw actually fixes — pipeline,
blend mode and texture/atlas identity — instead of by effect asset.

A batched burst draw is determined by its render pipeline (color/depth formats,
sample count, blend mode, render mode, soft-particle variant, output stage), the
texture/sampler pair it binds, and where it sorts. The effect asset was in the
compatibility key only because the batch bound ONE params uniform, taken from
the group's first record, so every effect needed its own group even when the two
draws were otherwise identical. A scene that fires several authored effects at
the same instant therefore paid one draw per effect: six draws for a saturated
six-recipe burst that the pipeline state could have covered in three.

The batch's params buffer is now an array with one block per effect present,
uploaded as a read-only storage buffer (so a batch is not capped by the uniform
binding size) and indexed per instance in the vertex shader. Each particle
carries its block index in the reserved spare float of the appended
emitter-origin vec4 — float 19 of the existing 20-float burst record — so the
per-particle wire stride is unchanged and no offset moved. Gravity, damping,
stretch factors, the texture sheet, and every packed curve and modulation-module
table stay per effect and are read per particle; nothing is collapsed onto a
representative effect.

Frozen-batch layout reuse now pins each slice's effect identity and params slot,
because reusing the layout skips the slot rewrite that would otherwise correct a
changed block index; a changed effect set re-uploads the params array even when
the render clock has not moved. A params buffer replaced by a resize goes
through the retirement queue instead of an inline destroy, matching the
particle buffers.

The CPU-simulated continuous batch path keeps the effect in its grouping key: it
concatenates slices into one contiguous draw range, so merging across effects
there would reorder alpha compositing between them.
