---
"@aperture-engine/math": patch
---

Replace the absolute matrix-inversion determinant cutoff with column scaling and
an arithmetic roundoff bound, restoring skinning at very small model scales.
Reject non-finite inputs, numerically unresolved determinants and Float32 output
overflow or whole-row/column underflow without changing the destination.
Resolvable near-singular matrices are allowed; this does not guarantee their
conditioning or Float32 accuracy. Keep the legacy singularity constant exported
for compatibility, and leave the unchecked math kernels unchanged.
