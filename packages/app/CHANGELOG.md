# @aperture-engine/app

## 0.3.0

### Minor Changes

- Add provisional app feature composition with deterministic dependency ordering, rollback, reverse-order disposal, typed diagnostics, feature descriptors for physics, particles, and UI, and worker-safe `features` config support.

- Add the smaller validation loop and hardened headless route: Node-native headless loading, deterministic seeded context time/random, session snapshot/restore fixes, render bundle tonemap/exposure/bloom metadata, warm render/browser sessions, MCP frame capture reuse, and clearer validation diagnostics.

- Resolve issues #59-#76 across app authoring, runtime-spawned components/resources, default headless asset mode, config clear colors, injected input validation, and scaffolded TypeScript coverage.

- Add Shuriken-style particle module authoring support through the app surface.

- Fix packed-engine battle-test follow-ups, generated app production builds, physics helpers, resource/physics status summaries, and scaffolded app defaults.

### Patch Changes

- Updated dependencies:
  - @aperture-engine/audio@0.3.0
  - @aperture-engine/particles@0.3.0
  - @aperture-engine/physics@0.3.0
  - @aperture-engine/physics-rapier@0.3.0
  - @aperture-engine/render@0.3.0
  - @aperture-engine/runtime@0.3.0
  - @aperture-engine/simulation@0.3.0
  - @aperture-engine/vite-plugin@0.3.0
  - @aperture-engine/webgpu@0.3.0

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
