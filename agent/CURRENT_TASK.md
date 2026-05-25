# Current Task

No active task is currently checked out.

Status: `task-3176` completed the Developer API beginner authoring docs
restructure. `docs/AUTHORING.md` now leads with the Vite/config/system app
shape and treats programmatic app/runtime/WebGPU orchestration as advanced.

Key findings:

- The authoring guide now starts with `vite.config.ts`, `aperture.config.ts`,
  system globs, config-declared assets, input actions, signals, and diagnostics.
- Setup examples use worker-side `this.spawn.camera`, `this.spawn.light`,
  `this.spawn.mesh`, and `this.spawn.gltf(this.assets.gltf(...))`.
- Runtime examples cover EliCS queries, schedule priority, lifecycle-owned
  `this.effects.watch(...)`, forwarded input, spatial raycast usage, command
  draining, and manual asset requests.
- The advanced section points readers to `ADVANCED_ORCHESTRATION.md` for
  `createApertureApp`, manual stepping, snapshot posting, source asset transfer
  packages, and direct WebGPU presentation.

Recommended next task:

- `task-3177` — add the optional `@aperture-engine/app/vite` convenience
  subpath while keeping the root app export plugin-free and keeping
  `@aperture-engine/vite-plugin` as the canonical documented default import.
