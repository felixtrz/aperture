---
"@aperture-engine/app": patch
"@aperture-engine/cli": patch
---

Preserve bounded error stacks and cause chains in structured diagnostics so agents
can locate system lifecycle failures after worker/browser or headless transport.
Keep canonical diagnostic source and data intact during normalization, and point
recovery suggestions to the serialized original error.
Carry the same diagnostics through explicit worker frame requests, MCP tool
failure envelopes and headless resource validation failures.
