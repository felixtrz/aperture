# @aperture-engine/runtime

## 0.3.0

### Minor Changes

- Move particle contracts behind compatibility exports, add feature-package plumbing for worker-safe app composition, and resolve runtime issues #59-#76 around animation controls and session snapshot restore.

### Patch Changes

- Updated dependencies:
  - @aperture-engine/particles@0.3.0
  - @aperture-engine/physics@0.3.0
  - @aperture-engine/render@0.3.0
  - @aperture-engine/simulation@0.3.0

## 0.2.0

### Patch Changes

- 9ba6e2c: Improve authoring ergonomics for headless systems, runtime uniforms, character
  movement, and animation controls.

  `physics.moveCharacter` now accepts a live `Entity` as well as a serialized
  entity ref, `spawn.runtimeUniform` updates existing uniforms by key, update
  phase effects flush during app steps, and animation access returns no-op
  controls for non-animated entities.
  - @aperture-engine/simulation@0.2.0
  - @aperture-engine/physics@0.2.0
  - @aperture-engine/render@0.2.0
