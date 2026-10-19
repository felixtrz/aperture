---
"@aperture-engine/cli": minor
---

Add CPU `aperture camera unproject` for placing named pixels on an explicit world
plane with perspective or orthographic cameras. Report unit rays, intersections,
clip/frustum validity and Float32 engine reprojection residuals, with structured
failure reports for parallel, poorly conditioned, behind-camera or clipped rays.

Fix camera report output guards to reject input/output collisions through input
symlinks or aliased parent directories before writing any report. Ordinary project
and fit report contents are unchanged.
