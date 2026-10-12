---
"@aperture-engine/app": minor
"@aperture-engine/webgpu": patch
"@aperture-engine/vite-plugin": patch
---

Add a public browser control facade with typed semantic requests, readiness,
manual frame production, detached frame inspection and disposal. Controlled
frames retain the simulation worker, ECS extraction, source asset mirroring and
native WebGPU submission boundary across transferable and shared snapshots.
The generated Vite browser entry also exports its app Promise.
Source asset mirrors now track producer versions independently of local update
counters, preventing duplicate or older remote payloads from replacing newer
geometry after a delayed first delivery.
