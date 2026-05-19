# GLTF Scene Shadow Caster Draw-List Plan Implementation

Date: 2026-05-19

## Summary

Added `ShadowCasterDrawListPlanReport` in `packages/webgpu`.

The report consumes extracted `MeshDrawPacket` data, extracted shadow requests,
and `ShadowPassPlanReport`, then derives JSON-safe caster draw-list records:

- matching shadow pass keys,
- caster and receiver layer masks,
- included and skipped draw counts,
- stable mesh/material resource keys, and
- deferred command-encoding diagnostics.

The GLTF scene now reports that all three extracted mesh draws are included by
the fixture's caster layer mask, while shadow command encoding remains
deferred.

## Reference Notes

- `references/engine/src/scene/renderer/shadow-renderer.js` culls and sorts
  shadow casters separately from the main scene draw list.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js` builds shadow-map
  render work from shadow-casting objects before the main scene render.
- Aperture adapts this as a flat extracted-packet filter over render snapshot
  data, not as renderer-owned scene traversal.

## Next

`task-1809` should add JSON-safe IBL/shadow shader binding readiness metadata
before any WGSL or bind-group layout changes are attempted.
