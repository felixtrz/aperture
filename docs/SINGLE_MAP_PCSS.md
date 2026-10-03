# Single-map directional contact-hardening shadows

For a non-cascaded directional light, `shadowType: 2` performs a raw-depth
blocker search followed by a variable-radius disk PCF filter. This also applies
to the directional owner of the supported directional-plus-point route. The
hard (`0`) and weighted-PCF (`1`) modes are unchanged. This change does not alter
spot, point, array-local, or cascaded filtering, shadow strength, or bias.

## Radius interpretation

`filterRadius` is an artistic maximum radius in shadow-map texels, bounded to
1–16 on this path. As before, non-hard authored radii below one use one as the
base radius. The actual PCSS radius tends toward zero at receiver–blocker
contact and reaches the maximum when their light-space separation is 1/12 of
the orthographic shadow-camera span. This is a documented artistic response,
not a physical angular-emitter model; Aperture does not expose a sun angular
size in this API.

For orthographic projection times a rigid light view, the length of the
matrix's depth row is `1 / (far - near)` and half the length of its x row is
`1 / span`. Their ratio converts the receiver–average-blocker clip-depth
difference into separation divided by span. Unlike dividing by the blocker's
normalized depth, this removes dependence on the arbitrary shadow-camera depth
origin. Equivalent near/far ranges and light-distance translations retain the
same radius, subject to finite texture precision and clipping. Changing the
footprint deliberately changes this artistic response. Authored normalized
bias is unchanged and is a separate source of depth-range dependence.

## Sampling and boundaries

- A fixed 32-point disk plus its center searches within the bounded maximum
  radius. No blockers returns fully lit visibility.
- The final filter uses 32 disk gathers with explicit bilinear reconstruction.
  The shared nearest comparison sampler remains unchanged, preserving other
  filter modes. Subtexel contact edges remain filtered at texture resolution.
- Search loads and filter coordinates clamp to the map edge. Existing
  outside-frustum handling remains fully lit.
- Degenerate or non-finite projection scales fall back to the existing hard
  center comparison rather than divide by an invalid scale. Existing receiver
  visibility sanitization remains in effect.

The bounded worst case is 33 raw depth loads plus 32 comparison gathers (four
comparison results each). No-blocker pixels skip the final gathers. This is a
structural work count, not a GPU timing claim. Sparse blocker searches remain
an approximation and can miss very small off-center blockers.

The separate cascaded PCSS implementation is unchanged. Its normalized-depth
ratio should not be taken as evidence of equivalent projection invariance;
reviewing that behavior requires its own compatibility work.
