# GLTF Scene Directional Shadow View-Projection Plan Implementation

Date: 2026-05-19

## Summary

Added `DirectionalShadowViewProjectionPlanReport` in `packages/webgpu`.

The report consumes extracted `ShadowRequestPacket` and `LightPacket` data plus
`ShadowPassPlanReport`, then derives JSON-safe directional shadow planning
records:

- stable view/projection plan keys,
- matching shadow pass keys,
- light transform offsets,
- map size and layer masks,
- orthographic projection intent, and
- stable matrix resource keys.

The current GLTF scene reports matrix computation as `deferred`, so no live
shadow camera, scene graph node, matrix packing, GPU resource, or shadow-map
submission is created.

## Reference Notes

- `references/engine/src/scene/renderer/light-camera.js` creates orthographic
  cameras for directional shadow work.
- `references/engine/src/scene/renderer/shadow-renderer.js` dispatches shadow
  view/projection data from renderer-owned light/camera state.
- `references/three.js/src/lights/LightShadow.js` derives shadow matrices from
  light and target transforms before shadow sampling.
- Aperture keeps the plan snapshot-friendly by using extracted light transform
  offsets and stable matrix keys instead of live camera objects.

## Next

`task-1808` should plan shadow caster draw lists from extracted mesh draw
packets and shadow caster layer masks, still without command encoding.
