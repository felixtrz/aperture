# @aperture-engine/app

## 0.2.0

### Minor Changes

- 9ba6e2c: Improve authoring ergonomics for headless systems, runtime uniforms, character
  movement, and animation controls.

  `physics.moveCharacter` now accepts a live `Entity` as well as a serialized
  entity ref, `spawn.runtimeUniform` updates existing uniforms by key, update
  phase effects flush during app steps, and animation access returns no-op
  controls for non-animated entities.

### Patch Changes

- Updated dependencies [9ba6e2c]
  - @aperture-engine/runtime@0.2.0
  - @aperture-engine/vite-plugin@0.2.0
  - @aperture-engine/simulation@0.2.0
  - @aperture-engine/physics@0.2.0
  - @aperture-engine/physics-rapier@0.2.0
  - @aperture-engine/render@0.2.0
  - @aperture-engine/webgpu@0.2.0
  - @aperture-engine/audio@0.2.0
