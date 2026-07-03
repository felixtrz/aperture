# @aperture-engine/cli

## 0.3.0

### Minor Changes

- Add the smaller validation loop: `aperture headless`, `aperture render`, render bundles, typed-array-safe snapshot JSON, and asset registry mirroring support.

- Harden the headless route with Node-native TypeScript loading, portable render harness package assets, `aperture headless serve`, sanctioned deterministic context time/random, honest asset provenance, and clearer diagnostics.

- Resolve issues #59-#76 for codegen, headless/browser mode mismatch errors, injected input validation, normalized `frame_capture`, `input_inject`/`logs_read`, warm render sessions, and scaffolded TypeScript coverage.

- Fix packed-engine battle-test and follow-up issues around blank-frame detection, headed Linux rendering, deterministic serve enforcement, ECS/devtools selectors, session snapshot/restore, command dispatch, seed reporting, and diagnostics.

### Patch Changes

- Updated dependencies:
  - @aperture-engine/app@0.3.0
  - @aperture-engine/render@0.3.0
  - @aperture-engine/simulation@0.3.0
  - @aperture-engine/vite-plugin@0.3.0

## 0.2.0
