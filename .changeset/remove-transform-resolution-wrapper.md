---
"@aperture-engine/simulation": patch
---

Remove the unused `TransformResolutionSystem` wrapper, transform-resolution
global report key, and getter exports. Use `resolveWorldTransforms(world)`
directly to compute world transforms and receive the resolution report.
