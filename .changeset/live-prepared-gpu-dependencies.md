---
"@aperture-engine/webgpu": patch
---

Keep prepared mesh and material dependencies live when cached GPU resources are reused, including static shadow casters. Long-running static scenes retain verifiable geometry inspection receipts, while idle entries still expire and reactivation prepares current assets. Shared-mesh multi-material unlit scenes use cached queued resources instead of allocating and uploading new buffers every frame.
