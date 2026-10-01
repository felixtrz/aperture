---
"@aperture-engine/render": minor
"@aperture-engine/app": minor
---

Add validated custom triangle geometry through `createTriangleListMeshAsset` and
`mesh.triangleList`. Author position tuples, optional indices, UVs and explicit
normals; default flat normals preserve low-poly edges. Own output buffers, choose
safe index widths, compute bounds from stored float32 geometry, and reject
malformed attributes or degenerate faces with actionable diagnostics. Reuse the
existing ECS, triangle-list renderer, asset mirror and headless bundle paths.
