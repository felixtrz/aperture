---
"@aperture-engine/app": patch
"@aperture-engine/cli": minor
"@aperture-engine/reference-assets": patch
"@aperture-engine/vite-plugin": patch
---

Improve agent-facing contracts and reliability: discover target capabilities,
advertise semantic action/gamepad controls and complete camera/input schemas,
separate camera `lookAt` from session routing, and bound simulation steps.
Correct devtools camera orientation to match authored -Z cameras, reject invalid
input values, preflight headless input batches, and always dispose warm renderers
when stopping a session. Refresh derived camera transforms immediately after
edits so captures do not require an extra simulation step. Harden MCP JSON-RPC
errors, negotiation, ping, and image metadata delivery. Deduplicate system
discovery, track shared-config changes in HMR, and roll back failed entity/light-rig
creation while keeping ECS key-query registration bounded.
Explain exact component-id and writable-field recovery in mutation diagnostics,
and reject inherited object properties as component or field selectors.
Refresh the precomputed reference corpus for these agent-facing contracts.
