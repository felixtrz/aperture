---
"@aperture-engine/render": minor
"@aperture-engine/app": minor
---

Add `createHeightfieldMeshAsset()` and `mesh.heightfield()` for explicit rectangular Y-up height grids, with predictable dimensions, grid UVs, upward winding, and low-poly flat normals. Validate grid shape, finite float32 samples and dimensions, reporting offending rows/samples through `HeightfieldMeshError` and the app diagnostic `aperture.spawn.invalidHeightfieldMesh`. Heightfields use ordinary owned mesh buffers and the existing dynamic mesh publication, extraction, and bundle paths.
