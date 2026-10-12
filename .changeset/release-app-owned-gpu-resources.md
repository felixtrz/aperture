---
"@aperture-engine/webgpu": patch
---

Release all app-owned GPU buffers, textures and query sets after in-flight
rendering and picking drain during disposal. Preserve borrowed resources and
the public device, attempt every cleanup after errors, clear derived caches and
reject new work once disposal starts. Also release a newly requested device
when canvas initialization fails.
