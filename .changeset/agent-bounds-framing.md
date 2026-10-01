---
"@aperture-engine/app": minor
"@aperture-engine/cli": minor
---

Add `camera_frame_entities` to the shared agent tooling surface. Frame multiple
ECS subjects and descendant meshes from static source bounds, with perspective
or orthographic fitting, viewport-aware aspect, padding and clipping planes.
Return selected meshes, world bounds and a Float32 projection check so agents
can inspect a fit without guessing a camera radius. Preserve the existing
`camera_fit_entity` origin/radius behavior.
