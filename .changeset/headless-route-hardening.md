---
"@aperture-engine/cli": minor
"@aperture-engine/app": minor
"@aperture-engine/simulation": minor
---

Harden the headless route.

- The headless command loads `aperture.config.ts` + `*.system.ts` via native
  Node TypeScript import instead of an in-process Vite SSR server — one shared
  module realm (no ECS double-registration), fewer moving parts. Headless
  configs/systems must be erasable TypeScript.
- `aperture render` is portable: it resolves the engine packages from its own
  install and ships its harness as a package asset, so it works from an
  arbitrary install rather than only the source tree.
- New `aperture headless serve`: a warm session that boots once and runs
  newline-delimited JSON commands (step/extract/inject/get-status/bundle/reset/
  ecs_* tools/shutdown) over stdin. New port-free public subpath
  `@aperture-engine/app/headless-tools`.
- Determinism: seeded `context.random` and sanctioned `context.time` on the
  system context (and `this.random` / `this.time` on systems) for bit-identical
  replay.
- Asset honesty: assets carry `provenance` ("loaded" | "placeholder"); the
  snapshot bundle and headless status report which assets were stubbed, and
  `aperture render` warns when rendering a placeholder bundle.
