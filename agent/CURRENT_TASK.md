# Current Task

No active task is currently checked out.

Status: `task-3177` completed the optional `@aperture-engine/app/vite`
convenience subpath. The root `@aperture-engine/app` export remains
plugin-free, while the subpath re-exports the canonical
`@aperture-engine/vite-plugin` API.

Key findings:

- `packages/app/src/vite.ts` re-exports `aperture`,
  `createApertureSystemManifest`, and the public Vite plugin types from
  `@aperture-engine/vite-plugin`.
- `packages/app/package.json` now publishes the `./vite` subpath without adding
  the plugin to the root app export.
- The Vite plugin package no longer needs a TypeScript project reference to the
  app package; generated virtual modules still import app browser/worker
  runtime entry points by package specifier.
- A focused `test/fixtures/app-vite/vite.config.ts` proves TypeScript can
  import `aperture` from `@aperture-engine/app/vite`.
- `docs/AUTHORING.md` still shows `@aperture-engine/vite-plugin` as the
  canonical Vite import and only mentions `@aperture-engine/app/vite` as an
  optional convenience.

Recommended next task:

- `task-3178` — add a small developer API browser control/status panel that
  dispatches select and manual asset-request command paths and displays
  JSON-safe worker input, command, entity, and diagnostic summaries.
