---
"@aperture-engine/adapter-node": minor
"@aperture-engine/shader": minor
"@aperture-engine/gpu": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/render": minor
"@aperture-engine/simulation": minor
"@aperture-engine/app": minor
"@aperture-engine/cli": minor
"@aperture-engine/vite-plugin": minor
---

Add direct Dawn-backed Node rendering for portable app bundles and shader jobs,
with explicit adapter policy, bounded readback, warm sessions and backend-specific
schema-v2 metadata. Keep browser rendering explicitly selectable.

Add modular WGSL artifacts and reflection, standalone effect/draw/compute APIs,
shared GPU resources and graph execution, portable capture/replay, transactional
shader replacement, Vite/CLI/MCP tools, standard-material surface/deformation
variants, reflected custom materials and portable storage-buffer assets.

Preserve the last usable shader and output when replacement allocation fails,
retain replay writes after rejected frames, and recreate failed MCP render slots.

Consumers of render metadata should branch on `backend` before reading `dawn` or
`browser`. See the Dawn migration and shader tutorials for runtime qualification,
ownership and supported material variants.
