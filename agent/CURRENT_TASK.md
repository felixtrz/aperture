# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3138` — add mixed clustered point and spot local-shadow
proof.

Status: `task-3137` completed mixed clustered local-light cookies per frame.

Key findings:

- Compatible clustered spot-cookie 2D textures and point cube-cookie textures
  now pack into one renderer-owned `texture_2d_array` path when their source
  dimensions/format/sampler descriptors are compatible.
- Point cube-cookie faces flatten into six consecutive array layers, and the
  clustered metadata word stores each light's base layer so the
  StandardMaterial shader can derive the cube face layer at sample time.
- `examples/clustered-lights.html?enable-cluster-mixed-cookie=1` reports three
  supported cookie lights, the array-cookie pipeline key, non-clear readback
  pixels, and zero relevant WebGPU validation warnings in the narrow headed
  Chrome proof.
- The post-task-3137 audit still finds a PlayCanvas-style gap around clustered
  local shadow/cookie atlas breadth. Aperture now has strong fixed-resource
  proofs, but it still needs broader mixed local-shadow permutations and
  metadata-driven resource packing.

Next step: implement `task-3138`.

Reference anchors for `task-3138`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
