---
"@aperture-engine/render": minor
"@aperture-engine/app": minor
---

Add `createLatheMeshAsset()` and `mesh.lathe()` for explicit radius/Y profiles revolved around Y, with flat normals, seam-safe UVs, owned buffers, and endpoint poles. Validate float32 geometry with actionable `LatheMeshError` paths and the `aperture.spawn.invalidLatheMesh` diagnostic. Support the existing dynamic publication, extraction, and bundle paths without automatic caps or self-intersection repair.
