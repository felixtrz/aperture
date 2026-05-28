# App And CLI Structure Refactor Plan

Date: 2026-05-28
Status: in progress

## Implementation Progress

- Track 2 has started. App config implementation now lives under
  `packages/app/src/config/`, with `packages/app/src/config.ts` kept as the
  public `@aperture-engine/app/config` facade. Input event/resource state now
  lives under `packages/app/src/input/`, with `packages/app/src/input.ts` kept
  as a compatibility facade for generated input event helpers. The removed
  top-level `config-*` and `input-state-*` implementation files no longer act
  as implicit folders.
- Track 3 has started. Non-spawn app system implementation now lives under
  `packages/app/src/systems/`, with `packages/app/src/systems.ts` kept as the
  public `@aperture-engine/app/systems` facade. System assets, cameras,
  commands, components, context, diagnostics, effects, errors, JSON helpers, and
  signal helpers no longer live as top-level `systems-*` implementation files.
- Track 4 has started. Spawn descriptors, command construction, metadata,
  transform writing, primitive/material asset conversion, and glTF replay now
  live in focused modules under `packages/app/src/systems/spawn/`. The public
  `mesh`, `material`, spawn option types, and `SpawnCommands` surface still
  comes through `@aperture-engine/app/systems`.
- Track 5 has started. Entity lookup implementation now lives under
  `packages/app/src/entities/lookup/`, with `packages/app/src/entity-lookup.ts`
  kept as the public `@aperture-engine/app/entity-lookup` facade. Spatial query
  contracts, bounds raycasts, mesh raycasts, filters, and math helpers now live
  under `packages/app/src/spatial/`, with the public system facade still
  re-exporting spatial query APIs.
- Track 6 has started. Generated browser bootstrap implementation now lives
  under `packages/app/src/browser/`, with `packages/app/src/browser.ts` kept as
  the public `@aperture-engine/app/browser` facade. Browser startup, status
  installation, source-asset mirroring, command forwarding, canvas resize sync,
  render-default normalization, input forwarding, and generated devtools tools
  are split by responsibility. The browser devtools bridge now separates runtime
  installation, dispatch, canvas readback, entity picking, payload parsing, and
  WebGPU diagnostic helpers.
- Track 7 has started. Generated worker bootstrap implementation now lives
  under `packages/app/src/worker/`, with `packages/app/src/worker.ts` kept as
  the public `@aperture-engine/app/worker` facade. Worker port attachment, run
  loop startup, snapshot publication, source-asset serialization, asset
  summaries, generated command handling, viewport resize handling, payload
  parsing, and generated devtools bridge dispatch are split by responsibility.
  Worker entity, camera, and input devtools tools now live under
  `packages/app/src/worker/devtools/`.
- Track 8 has started. CLI command parsing and help/output wrappers now live
  under `packages/cli/src/commands/`, while `packages/cli/src/cli.ts` remains
  the public command router and shared top-level error handler. Create, dev,
  tool, MCP, reference, and adapter command modules moved without changing
  command names, help text, backend delegation, or output shapes.
- Track 9 has started. `createApertureProject()` now lives in
  `packages/cli/src/create/project.ts`, with `packages/cli/src/create-project.ts`
  kept as the public facade. Target validation, package-name/dependency metadata,
  shared starter files, per-template source strings, and the embedded sample GLB
  payload are split under `packages/cli/src/create/` and
  `packages/cli/src/create/templates/` without changing generated template
  behavior.

## Summary

`packages/app` and `packages/cli` are both functionally split, but they still
use a mostly flat `src/` layout. The next structure pass should turn filename
prefix groups into real folders while preserving the existing public package
entry points.

This plan is intentionally a no-behavior-change refactor. It should improve
reviewability, ownership clarity, and future AI-agent navigation without
changing the app runtime model, package boundaries, system authoring API,
generated browser/worker behavior, CLI commands, MCP tools, or reference/RAG
results.

## Current Findings

### `packages/app`

The app package has the clearest folder pressure. It currently has many
top-level files that already form implicit groups:

- `systems-*`
- `input-state-*`
- `entity-lookup-*`
- `worker-*`
- `browser-*`
- `config-*`

Large files that should be split or moved behind focused folder boundaries:

- `packages/app/src/systems-spawn.ts` at about 843 lines.
  - Mixes public spawn descriptors, spawn command construction, transform
    helpers, look-at math, primitive mesh asset creation, material asset
    creation, metadata, and glTF scene replay helpers.
- `packages/app/src/worker-entity-tools.ts` at about 654 lines.
  - Mixes devtools dispatch, entity lookup calls, query payload parsing,
    component schema reporting, mutation request parsing, and snapshot option
    parsing.
- `packages/app/src/worker.ts` at about 524 lines.
  - Mixes worker port attachment, app run loop, input draining, snapshot
    publication, generated command handling, viewport resize handling, devtools
    dispatch, and worker start-message validation.
- `packages/app/src/spatial-queries.ts` at about 506 lines.
  - Mostly cohesive, but large enough to benefit from a `spatial/` folder if
    ray, bounds, mesh-hit, and filtering helpers grow.
- `packages/app/src/browser-devtools.ts` at about 489 lines.
  - Mixes browser runtime bridge installation, tool dispatch, canvas readback,
    browser picking, payload parsing, and WebGPU diagnostic normalization.

The existing app package export map expects these public subpaths:

- `@aperture-engine/app`
- `@aperture-engine/app/config`
- `@aperture-engine/app/systems`
- `@aperture-engine/app/advanced`
- `@aperture-engine/app/headless`
- `@aperture-engine/app/entity-lookup`
- `@aperture-engine/app/commands`
- `@aperture-engine/app/diagnostics`
- `@aperture-engine/app/vite`
- `@aperture-engine/app/browser`
- `@aperture-engine/app/worker`

Those subpaths are good API seams. The refactor should keep the top-level files
that back those subpaths as small public barrels/facades, while moving
implementation into folders.

### `packages/cli`

The CLI package is in better shape after the previous refactor: command
routing is separated from command implementations, and reference/RAG helpers
have been split into focused modules. The remaining problem is folder shape and
some large modules:

- `packages/cli/src/reference.ts` at about 1195 lines.
  - Still owns public reference contracts, index building, warm/status IO,
    payload install, manifest validation, search facade, source file readback,
    component/system listing, and dependent lookup facade.
- `packages/cli/src/create-project.ts` at about 772 lines.
  - Mixes project creation, target validation, package metadata, template
    selection, inline template text, binary sample asset payloads, and starter
    system source strings.
- `packages/cli/src/dev-session.ts` at about 706 lines.
  - Mixes managed session lifecycle, daemon startup, Vite process management,
    browser launch, port selection, status reading, logs, process stopping, and
    polling.
- `packages/cli/src/devtools-client.ts` at about 602 lines.
  - Mixes tool dispatch, browser tools, input tools, render tools, runtime
    bridge calls, status shaping, unsupported-tool diagnostics, and log tailing.

The CLI package has only one public package export, `@aperture-engine/cli`, and
one bin entry, `aperture`. That makes internal folder moves lower risk than app
folder moves, as long as `src/index.ts`, `src/cli.ts`, and
`src/bin/aperture.ts` keep their public contracts.

## Target Shape

### App Package

Keep current public entry files at the top level. Move implementation details
under domain folders.

```text
packages/app/src/
  index.ts
  config.ts
  systems.ts
  advanced.ts
  headless.ts
  entity-lookup.ts
  commands.ts
  diagnostics.ts
  vite.ts
  browser.ts
  worker.ts

  config/
    errors.ts
    validation.ts
    descriptors.ts
    input-descriptors.ts

  systems/
    assets.ts
    cameras.ts
    commands.ts
    components.ts
    context.ts
    diagnostics.ts
    effects.ts
    errors.ts
    json.ts
    signals.ts
    spawn/
      index.ts
      descriptors.ts
      commands.ts
      metadata.ts
      transforms.ts
      primitives.ts
      materials.ts
      gltf.ts

  input/
    index.ts
    state.ts
    actions.ts
    bindings.ts
    gamepads.ts
    keyboard.ts
    summary.ts
    types.ts
    browser-events.ts

  entities/
    lookup/
      index.ts
      hierarchy.ts
      mutation.ts
      query.ts
      snapshot.ts
      summary.ts
      types.ts

  spatial/
    index.ts
    raycast.ts
    bounds.ts
    mesh.ts
    filters.ts
    math.ts

  browser/
    app.ts
    devtools/
      index.ts
      runtime.ts
      dispatch.ts
      canvas-readback.ts
      picking.ts
      payloads.ts
      webgpu-diagnostics.ts
    input.ts
    render.ts

  worker/
    start.ts
    loop.ts
    commands.ts
    viewport.ts
    devtools/
      bridge.ts
      types.ts
      entities.ts
      camera.ts
      input.ts
    payload.ts
    assets.ts
```

The exact names can change during implementation, but the direction should not:
public top-level files stay small, implementation lives in folders, and folder
names reflect runtime ownership rather than previous filename prefixes.

### CLI Package

Keep current public root and bin files. Move command and implementation groups
under folders.

```text
packages/cli/src/
  index.ts
  cli.ts
  errors.ts
  bin/
    aperture.ts

  commands/
    create.ts
    dev.ts
    tool.ts
    mcp.ts
    reference.ts
    adapter.ts

  create/
    project.ts
    target.ts
    package-json.ts
    templates/
      index.ts
      minimal.ts
      glb-viewer.ts
      game.ts
      files.ts
      sample-cube.ts

  dev/
    session.ts
    daemon.ts
    server.ts
    browser.ts
    ports.ts
    logs.ts
    process.ts

  tools/
    client.ts
    dispatch.ts
    browser.ts
    input.ts
    render.ts
    runtime.ts
    args.ts
    reference.ts

  mcp/
    server.ts
    contracts.ts

  reference/
    index.ts
    contracts.ts
    build.ts
    corpus.ts
    entries.ts
    embedding.ts
    chunking.ts
    search.ts
    source-collection.ts
    source-filter.ts
    status.ts
    warm.ts
    payload.ts
    manifest.ts
    paths.ts
    tools.ts

  adapters/
    sync.ts
    templates.ts
```

The current `src/cli.ts` should remain the command router and public CLI API.
The current `src/index.ts` should remain the package root export surface.

## Non-Goals

- Do not redesign the app authoring API.
- Do not change `aperture.config.ts` semantics.
- Do not change system discovery or Vite plugin behavior.
- Do not change worker/main-thread transport behavior.
- Do not change CLI command names, flags, output shapes, exit codes, or MCP
  tool contracts.
- Do not change reference/RAG ingestion policy or search scoring behavior.
- Do not use this refactor to introduce a scene graph, WebGL fallback, or
  renderer-owned gameplay state.
- Do not add new dependencies.

## Implementation Tracks

### Track 1: App Folder Skeleton And Public Barrels

Move app implementation modules into folders while keeping current top-level
public entry files as small facades.

Acceptance criteria:

- `packages/app/src/config.ts`, `systems.ts`, `browser.ts`, `worker.ts`,
  `entity-lookup.ts`, `advanced.ts`, `headless.ts`, `commands.ts`,
  `diagnostics.ts`, and `vite.ts` still exist when required by the package
  export map.
- Those top-level public files contain public re-exports or thin entrypoint
  orchestration only.
- Internal imports are rewritten to folder-local paths where practical.
- `pnpm --filter @aperture-engine/app run typecheck` passes.
- Package boundary checks pass.

### Track 2: App Config And Input Folders

Move config validation and input state implementation into `config/` and
`input/` folders.

Acceptance criteria:

- Config public helpers and types remain exported from
  `@aperture-engine/app/config`.
- Config validation/errors are no longer top-level files.
- Input state actions, bindings, keyboard, gamepad, summary, and types live
  under `input/`.
- Browser input event conversion is clearly separated from worker/input state
  mutation.
- Existing input tests and app typecheck pass.

### Track 3: App Systems Folder

Move system context, assets, signals, commands, cameras, diagnostics, JSON,
effects, components, and errors into `systems/`.

Acceptance criteria:

- `@aperture-engine/app/systems` remains the public worker-safe system authoring
  entry point.
- System context and signal APIs remain headless-safe.
- Browser-only and WebGPU-only imports do not enter system authoring modules.
- Existing generated app systems still typecheck.
- Relevant app/system tests pass.

### Track 4: App Spawn Decomposition

Split `systems-spawn.ts` into a focused `systems/spawn/` folder.

Acceptance criteria:

- Public `mesh`, `material`, `SpawnCommands`, and spawn option types remain
  exported from `@aperture-engine/app/systems`.
- Spawn command construction is separate from descriptor factories.
- Transform writing and look-at/quaternion helpers are separate from primitive
  mesh/material asset creation.
- glTF scene replay helper logic is isolated from primitive spawning.
- No app-facing behavior changes in existing scaffolded examples.
- Focused tests cover primitive spawn, material spawn, transform input, unique
  key diagnostics, and glTF spawn behavior if equivalent coverage exists today.

### Track 5: App Entity Tools And Spatial Folders

Move entity lookup and spatial query implementation into `entities/lookup/`
and `spatial/`.

Acceptance criteria:

- `@aperture-engine/app/entity-lookup` keeps the same exported contract.
- Entity lookup query, mutation, hierarchy, snapshot, summary, and types live
  under one folder.
- Worker devtools entity tools consume the same entity lookup surface instead
  of duplicating lookup logic.
- Spatial query public contracts remain stable.
- Spatial ray/bounds/mesh/filter helpers are separated enough that future BVH
  or layer filtering work has an obvious home.
- Existing entity lookup, spatial, and worker devtools tests pass.

### Track 6: App Browser Runtime Split

Move generated browser implementation into `browser/`, including devtools
runtime internals.

Acceptance criteria:

- `@aperture-engine/app/browser` remains the generated browser bootstrap entry.
- Browser app startup, render wiring, input forwarding, status installation,
  command forwarding, and resize sync are separated by responsibility.
- Browser devtools runtime bridge is split into runtime installation, dispatch,
  canvas readback, picking, payload parsing, and WebGPU diagnostic helpers.
- Browser-only globals are contained under `browser/` entry implementation.
- Generated browser examples still launch and publish the same status shape.

### Track 7: App Worker Runtime Split

Move generated worker implementation into `worker/`, including devtools bridge
internals.

Acceptance criteria:

- `@aperture-engine/app/worker` remains the generated worker bootstrap entry.
- Worker port setup, run loop, input draining, snapshot publication, command
  handling, viewport resize handling, and devtools bridge logic are separated.
- Worker camera, entity, and input devtools tools live under
  `worker/devtools/`.
- Worker payload parsing helpers live under `worker/`.
- Worker code remains free of browser presentation and WebGPU resource
  ownership.
- Existing generated worker/browser integration tests pass.

### Track 8: CLI Command Folder

Move command modules into `commands/` while keeping `src/cli.ts` as the compact
router.

Acceptance criteria:

- `src/cli.ts` remains small and only routes commands, handles top-level help,
  version, and shared error reporting.
- `create`, `dev`, `tool`, `mcp`, `reference`, and `adapter` command parsing
  lives under `commands/`.
- CLI command help text and exit codes remain unchanged unless a test records
  an intentional correction.
- `pnpm --filter @aperture-engine/cli run typecheck` passes.
- CLI command tests pass.

### Track 9: CLI Create Folder And Templates

Split `create-project.ts` into project orchestration, target validation,
package metadata, and template files.

Acceptance criteria:

- `createApertureProject()` keeps the same public contract.
- Template-specific source strings live under `create/templates/`.
- The binary sample GLB payload is isolated from project orchestration.
- Minimal, GLB viewer, and game templates remain generated byte-for-byte where
  practical. If formatting changes are intentional, tests should assert the new
  output.
- Create template end-to-end tests still install, typecheck, build, run a
  managed browser session, and pass browser smoke validation.

### Track 10: CLI Dev Session And Browser Folder

Split managed dev session and browser orchestration into `dev/`.

Acceptance criteria:

- `startApertureDevSession()`, `runApertureDevSessionDaemon()`,
  `stopApertureDevSession()`, `readApertureDevStatus()`,
  `readApertureDevLogs()`, `openApertureDevSession()`, and
  `resolveApertureDevServerPort()` keep the same public contracts.
- Session lifecycle, daemon startup, Vite server startup, managed browser
  launch, port selection, logs, and process handling are separated.
- Dev-session status files remain unchanged.
- Managed browser start/status/down/logs tests pass.
- MCP/browser tools still work against a managed dev session.

### Track 11: CLI Tool Client Folder

Split `devtools-client.ts` into browser connection, dispatch, input tools,
render tools, runtime bridge calls, argument parsing, and reference tool
delegation.

Acceptance criteria:

- `callApertureTool()` keeps the same public contract.
- Tool dispatch is easy to scan without scrolling through tool
  implementations.
- Input emulation helpers, render report helpers, browser helpers, and runtime
  tool forwarding live in focused modules.
- Unsupported tool diagnostics remain unchanged.
- MCP and `aperture tool` end-to-end tests pass.

### Track 12: CLI Reference Folder Completion

Move remaining reference/RAG implementation from `reference.ts` into
`reference/` while keeping the package public exports stable.

Acceptance criteria:

- `reference.ts` becomes either a small public barrel/facade or is replaced by
  `reference/index.ts` plus a top-level barrel if the package root still needs
  it.
- Public contracts live in `reference/contracts.ts`.
- Index building, corpus ingestion, entries, warm/status IO, payload install,
  manifest validation, source file readback, search facade, component/system
  listing, and dependent lookup are separated.
- Ingestion filters remain explicit about developer-facing API sources.
- Search results and dependent lookup behavior remain stable.
- Reference/RAG tests pass.

### Track 13: Export And Boundary Guards

Add focused tests or checks that prevent the refactor from silently widening
public surfaces or crossing package boundaries.

Acceptance criteria:

- App public subpaths export the same intentional API surface before and after
  the move, or changes are documented in this plan and covered by tests.
- CLI package root exports remain intentional and do not expose internal folder
  modules accidentally.
- Package-boundary checks pass.
- TypeScript consumers get actionable module-resolution errors for non-exported
  internals.
- Generated app examples import only public APIs.

## Suggested Order

1. Move app config/input files first because they are lower-risk implicit
   groups.
2. Move app systems files except spawn, preserving `@aperture-engine/app/systems`
   as the public facade.
3. Split app spawn after the systems folder exists.
4. Move app entity lookup and spatial query groups.
5. Split app browser runtime.
6. Split app worker runtime.
7. Move CLI commands into `commands/`.
8. Split CLI create templates.
9. Split CLI dev session and browser orchestration.
10. Split CLI tool client.
11. Finish CLI reference folderization.
12. Add or tighten public export and boundary guards.

## Global Acceptance Criteria

- No package-level architecture boundary regresses:
  - `app` remains the developer facade over lower packages and generated
    browser/worker bootstrap.
  - `app` system authoring remains headless-safe.
  - Browser-only code remains behind browser entry implementation.
  - Worker code does not own WebGPU resources or presentation state.
  - `cli` remains tooling/runtime orchestration and does not become required
    runtime state.
- Public package entry points keep working:
  - `@aperture-engine/app`
  - `@aperture-engine/app/config`
  - `@aperture-engine/app/systems`
  - `@aperture-engine/app/advanced`
  - `@aperture-engine/app/headless`
  - `@aperture-engine/app/entity-lookup`
  - `@aperture-engine/app/commands`
  - `@aperture-engine/app/diagnostics`
  - `@aperture-engine/app/vite`
  - `@aperture-engine/app/browser`
  - `@aperture-engine/app/worker`
  - `@aperture-engine/cli`
- Top-level public files in both packages are reviewable facades, not large
  implementation modules.
- Existing examples and generated apps continue to compile and run.
- CLI create/dev/tool/mcp/reference/adapter commands keep their documented
  behavior.
- MCP tool contracts and reference/RAG behavior do not regress.
- Tests near moved code are updated rather than bypassed.
- `pnpm --filter @aperture-engine/app run typecheck` passes.
- `pnpm --filter @aperture-engine/cli run typecheck` passes.
- `pnpm run typecheck:test` passes.
- `pnpm run check:boundaries` passes.
- `pnpm run build` passes.
- Relevant app, CLI, MCP, reference, and generated-app tests pass.
- `git diff --check` passes.

## Review Guidance

This refactor should be done in small coherent slices. Prefer commits that
move one implicit group into one folder and update only the imports/tests needed
for that group. Avoid mixing app and CLI changes in the same commit unless the
change is a shared export/boundary guard.

After each slice, check for:

- Top-level files that are still large implementation modules.
- New folders that are too generic, such as `utils/` or `common/`.
- Circular imports introduced by barrels.
- Browser or WebGPU imports leaking into headless-safe app/system modules.
- CLI command modules importing implementation details they should receive as
  injected dependencies.
- Reference/RAG ingestion changes that accidentally broaden the corpus beyond
  developer-facing API sources.

## Completion Definition

The plan is complete when `packages/app/src` and `packages/cli/src` both have
folder structures that match their domain responsibilities, the previous
filename-prefix clusters are gone or reduced to public barrels, large remaining
files have a clear reason to stay large, and the validation matrix above passes
without regressions.
