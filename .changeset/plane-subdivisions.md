---
"@aperture-engine/render": minor
"@aperture-engine/app": patch
---

Support independent width and height segments in plane mesh assets, and honor
the existing `mesh.plane({ subdivisions })` authoring option. Grid planes retain
the existing XY orientation, positive-Z normals, UV range and bounds. Default
single-cell planes preserve their original vertex and index layout. Segment
counts are floored and bounded to 1–128 per axis.
