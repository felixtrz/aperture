---
"@aperture-engine/webgpu": patch
---

Narrow the public WebGPU renderer-frame summary barrel to the snapshot
resource-binding planner/writer surface while keeping injected frame runner and
summary diagnostics available through the test-support subpath.
