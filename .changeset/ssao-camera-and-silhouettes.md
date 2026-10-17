---
"@aperture-engine/webgpu": patch
---

Fix SSAO outlines on orthographic and perspective scenes by reconstructing from
the extracted camera projection, resolving MSAA depth to a real surface, and
choosing depth neighbors that stay on the same surface. Camera changes update a
uniform without rebuilding the post pipeline. Improve low-sample AO tap coverage.
