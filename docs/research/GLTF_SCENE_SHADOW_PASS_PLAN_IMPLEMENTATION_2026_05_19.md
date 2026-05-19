# GLTF Scene Shadow Pass Plan Implementation

Date: 2026-05-19

## Summary

Added `ShadowPassPlanReport` in `packages/webgpu`.

The report consumes extracted `ShadowRequestPacket` data plus the renderer-owned
`ShadowTextureResourceReport` and produces JSON-safe pass planning records:

- stable shadow pass keys,
- shadow texture and view resource keys,
- depth attachment format and dimensions,
- caster and receiver layer masks,
- clear/store depth attachment intent, and
- explicit submission status.

The default submission status is `deferred`, so the GLTF scene can show that a
shadow pass is planned without claiming visible shadows or submitting GPU
commands. The report can also classify future injected submission policy as
`unsupported` or `ready` while keeping `gpuCommands` false in JSON output.

## Reference Notes

- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
  models shadow work as an explicit pass over light faces.
- `references/engine/src/scene/renderer/shadow-renderer.js` separates caster
  culling, render-state setup, and shadow matrix/viewport dispatch from the main
  scene pass.
- `references/three.js/src/renderers/WebGLRenderer.js` renders shadow maps
  before the main scene render.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js` owns shadow
  render targets/textures in renderer code rather than scene authoring state.

## Next

`task-1802` should add StandardMaterial shadow readiness diagnostics from the
new pass plan and existing descriptor/resource reports. It should not enable
shader shadow sampling or visible shadows yet.
