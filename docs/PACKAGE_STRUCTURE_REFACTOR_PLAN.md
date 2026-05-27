# Package Structure Refactor Plan

Date: 2026-05-27
Status: in progress

## Implementation Progress

- Track 1 is implemented. `packages/webgpu/src/webgpu/` was removed as an
  implementation folder; WebGPU backend files now live under domain folders
  such as `app/`, `gpu/`, `materials/`, `lighting/`, `shadows/`, `post/`,
  `render/`, `resources/`, `output/`, and `picking/`.
- The public package root still preserves the previous broad export surface for
  now. Track 9 remains responsible for tightening those exports after internal
  imports and tests no longer depend on broad barrels.
- Track 2 has started. Render-target asset creation/validation/diagnostics now
  live in `packages/webgpu/src/app/render-target.ts`, and canvas backing
  dimension resolution lives in `packages/webgpu/src/app/canvas.ts`.
- Frame-boundary target planning now lives in
  `packages/webgpu/src/app/frame-target.ts`, covering swapchain/offscreen view
  targets, per-target submission keys, and viewport/scissor rectangle
  normalization.
- Render and pick report assembly now lives in
  `packages/webgpu/src/app/report.ts`, covering JSON-safe report conversion,
  render report construction, depth-attachment summaries, resource-reuse
  summary helpers, and submitted-work waiting.
- Source asset facade preparation now lives in
  `packages/webgpu/src/app/source-assets.ts`, covering snapshot mesh/material
  facade updates and resource-reuse summary synchronization.
- Low-level app picking helpers now live in
  `packages/webgpu/src/app/picking.ts`, covering pick-pixel normalization,
  pick-pass error scopes, shared bind group creation, and ID-buffer pick
  pipeline caching.
- Material dependency diagnostics now live in
  `packages/webgpu/src/app/material-dependencies.ts`, covering snapshot
  dependency diagnostics and JSON-safe app diagnostic creation.
- Pipeline layout resolution now lives in
  `packages/webgpu/src/app/pipeline-layouts.ts`, covering cached layout
  lookup and built-in material family layout construction.
- Resource cache and frame scratch construction now live in
  `packages/webgpu/src/app/resource-cache.ts`, covering app resource cache
  types, post-pass cache state, frame scratch buffers, and cache factory setup.
- Snapshot defaults and frame update metadata now live in
  `packages/webgpu/src/app/snapshot.ts`, covering empty render snapshots and
  render snapshot change-set/update-schedule creation.
- Draw resource set planning now lives in
  `packages/webgpu/src/app/draw-resource-set.ts`, while the existing public
  root export remains available through `app.ts`.
- Standard material app pipeline-key routing now lives in
  `packages/webgpu/src/materials/standard/standard-app-pipeline-keys.ts`,
  covering shadow, IBL, and clustered-local-light feature key rewriting.
- App depth/MSAA attachment helpers now live in
  `packages/webgpu/src/app/attachments.ts`, covering per-target depth texture
  reuse, MSAA color texture reuse, and MSAA report assembly while preserving
  the existing public `WebGpuAppMsaaReport` export through `app.ts`.
- App GPU readback helpers now live in
  `packages/webgpu/src/app/gpu-readback.ts`, covering timestamp query
  readback, occlusion query readback, occlusion feedback updates, and GPU
  timing diagnostics summary merging.
- StandardMaterial transmission-grab resource setup now lives in
  `packages/webgpu/src/app/transmission-grab.ts`, covering scene-color
  post-pass texture reuse, sampler creation/reuse, transmission resource
  diagnostics, grab-pass assembly, transmission draw filtering, and grab-pass
  report creation for queued app frames.
- Frame-boundary support helpers now live in
  `packages/webgpu/src/app/frame-boundary-support.ts`, covering indirect draw
  preparation, occlusion-query resource allocation, render-bundle command keys,
  render-bundle report assembly, and static-snapshot render-bundle heuristics.
- Occlusion command filtering and culling report helpers now live in
  `packages/webgpu/src/app/occlusion-culling.ts`, covering culling report
  accumulation, skipped-draw filtering, occlusion-query command stripping, and
  query-index normalization.
- View command filtering helpers now live in
  `packages/webgpu/src/app/view-commands.ts`, covering per-view command
  visibility, pending render-pass state coalescing, draw-command detection, and
  draw counting.
- Queued built-in support helpers now live in
  `packages/webgpu/src/app/queued-built-in-support.ts`, covering queued-frame
  diagnostics summaries, standard-material route checks, transmission route
  checks, instance-tint resource collection, and StandardMaterial area-light
  LTC resource resolution.
- App skybox command helpers now live in
  `packages/webgpu/src/app/skybox.ts`, covering skybox selection, pipeline
  caching, view uniform packing, default sampler creation, bind group creation,
  and command emission.
- App sprite frame helpers now live in
  `packages/webgpu/src/app/sprites.ts`, covering sprite pipeline caching,
  sprite buffer packing, default sampler creation, texture/sampler resource
  preparation, bind group creation, and sprite draw command emission.
- Multi-unlit app resource helpers now live in
  `packages/webgpu/src/app/multi-unlit.ts`, covering multi-material unlit
  resource-set detection, frame-resource preparation, and reuse accounting.
- Queued built-in frame-resource preparation now lives in
  `packages/webgpu/src/app/queued-frame-resources.ts`, covering queued resource
  preparation, frame-resource option construction, pipeline plan results, and
  queued bind-group reuse accounting.
- App motion-vector helpers now live in
  `packages/webgpu/src/app/motion-vectors.ts`, covering scene motion-vector
  eligibility, previous object-transform GPU resources, motion-vector reports,
  and view-projection history for post passes.
- App post-processing assembly now lives in
  `packages/webgpu/src/app/post-processing.ts`, covering swapchain scene
  offscreen capture, post-effect pass/graph assembly, post readbacks, and
  post-effect submission reports.
- Full app picking orchestration now lives in
  `packages/webgpu/src/app/picking-frame.ts`, covering ID-buffer pick resource
  preparation, pick-frame planning, pick pass assembly/readback, and app-owned
  pipeline/layout callbacks.
- App pipeline resource creation now lives in
  `packages/webgpu/src/app/pipeline-resources.ts`, covering built-in material
  render-pipeline cache keys, creation, reuse accounting, and the public
  `WebGpuAppPipelineResourceResult` type re-export.
- Queued built-in app adapters now live in
  `packages/webgpu/src/app/queued-built-in-adapters.ts`, covering built-in
  material texture-resource preparation, frame-resource adapter registration,
  and adapter validation.
- App frame-boundary assembly now lives in
  `packages/webgpu/src/app/frame-boundaries.ts`, covering render target
  submission planning, per-view command filtering, skybox insertion, occlusion
  queries, GPU timings, MSAA/depth target setup, post-processing handoff,
  transmission grab passes, and render-bundle reporting.
- Sprite-only app frame rendering now lives in
  `packages/webgpu/src/app/sprite-frame.ts`, covering sprite-only view packing,
  sprite pipeline/resource preparation, frame-boundary delegation, submitted
  work waiting, readback mapping, and sprite-only render report assembly.
- Queued built-in app frame rendering now lives in
  `packages/webgpu/src/app/queued-built-in-frame.ts`, covering built-in
  material frame preparation, material queue rewriting, render-frame planning,
  sprite overlay preparation, indirect draw preparation, frame-boundary
  delegation, motion-vector history, GPU timing and occlusion readback, and
  queued render report assembly.
- App frame-loop routing now lives in
  `packages/webgpu/src/app/frame-loop.ts`, covering snapshot validation,
  standard-material route key rewriting, local-light cookie preparation,
  material dependency checks, sprite-only routing, queued built-in routing, and
  the remaining non-queued fallback frame path.
- App creation/startup now lives in
  `packages/webgpu/src/app/create-webgpu-app.ts`, covering WebGPU
  initialization, app resource-cache creation, snapshot transport startup,
  worker snapshot/error subscription handling, diagnostics snapshots, picking
  delegation, render delegation, source asset facade pruning, and environment
  resource cache registration.
- StandardMaterial shader feature contracts now live in
  `packages/webgpu/src/materials/standard/standard-shader-features.ts`,
  covering shader variant constants, the `StandardTextureShaderFeatures`
  contract, MVP lighting-model metadata, texture feature naming, fog/generic
  feature predicates, and variant-key selection.
- StandardMaterial shader sampling injectors now live in
  `packages/webgpu/src/materials/standard/standard-shader-sampling.ts`,
  covering clearcoat, sheen, iridescence, transmission, fog, clustered-local
  light, shadow-map, point-shadow, multi-shadow, diffuse IBL, and specular IBL
  proof WGSL patching.
- StandardMaterial shader sampling injectors are further split into
  `standard-shader-extension-sampling.ts` for PBR extension/fog WGSL patching
  and `standard-shader-light-sampling.ts` for clustered-local-light WGSL
  patching, with `standard-shader-sampling.ts` kept as the existing import-path
  barrel.
- StandardMaterial shadow and IBL shader sampling injectors now live in
  `standard-shader-shadow-sampling.ts` for directional, point, and multi-shadow
  WGSL patching, and `standard-shader-ibl-sampling.ts` for diffuse/specular IBL
  WGSL patching.
- StandardMaterial base WGSL source now lives in
  `packages/webgpu/src/materials/standard/standard-shader-source.ts`, while
  `standard-shader.ts` re-exports the source and focuses on metadata, variant
  WGSL assembly, and shader module descriptors.
- StandardMaterial shader variant helpers now live in
  `packages/webgpu/src/materials/standard/standard-shader-variant.ts`,
  covering texture variant comments, UV routing, WGSL declaration assembly,
  binding metadata, compact clustered-local multi-shadow detection, and shader
  label selection.
- StandardMaterial shader variant helpers are further split into focused
  utility, declaration, binding, and label modules, with
  `standard-shader-variant.ts` kept as the import-path barrel.
- StandardMaterial vertex buffer layout constants, dynamic mesh-layout parsing,
  and skinning attribute format selection now live in
  `packages/webgpu/src/materials/standard/standard-vertex-layout.ts`, while
  `standard-pipeline.ts` focuses on shader creation, render-state descriptors,
  pipeline creation, and diagnostics.
- StandardMaterial prepared texture dependency contracts and cache-key helpers
  now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-dependencies.ts`,
  while `prepared-standard-material-cache.ts` preserves the previous public
  exports and focuses on prepared material resource creation and reuse.
- StandardMaterial prepared material classification predicates now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-classification.ts`,
  covering scalar, single-texture-family, and occlusion/emissive material shape
  checks used by prepared resource routing.
- StandardMaterial prepared resource contracts now live in
  `packages/webgpu/src/materials/standard/prepared-standard-material-types.ts`,
  covering prepared resource records, diagnostics, prepare options, and prepare
  results while `prepared-standard-material-cache.ts` remains the resource
  creation implementation.
- StandardMaterial frame local-light cluster resource helpers now live in
  `packages/webgpu/src/materials/standard/standard-frame-local-light-resources.ts`,
  covering clustered-local-light pipeline-key checks, local-light cluster GPU
  resource creation, and supported point/spot shadow resource extraction.
- StandardMaterial frame base GPU resource builders now live in
  `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts`,
  covering mesh, view-uniform, world-transform, instance-tint, skinning,
  morph-target, and material uniform buffer resource creation.
- StandardMaterial app prepared mesh/material routing now lives in
  `packages/webgpu/src/materials/standard/standard-app-prepared-resources.ts`,
  while `standard-app-frame-resources.ts` focuses on frame-resource cache
  routing, dynamic buffer updates, resource creation, and reuse accounting.
- StandardMaterial light/shadow bind-group descriptor entry helpers now live in
  `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-entries.ts`,
  covering area-light LTC, clustered local-light, local-light cookie, and
  shadow receiver descriptor entries.
- StandardMaterial light/shadow bind-group layout keys and descriptor builders
  now live in
  `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-constants.ts`
  and
  `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-layouts.ts`,
  while the previous bind-group module re-exports the public layout surface.

## Purpose

Refactor the internal source layout of the Aperture packages so module
structure matches runtime architecture, ownership boundaries, and render
pipeline stages.

This is not a proposal to split the workspace into more npm packages. The
current package boundaries are still aligned with the architecture:

- `@aperture-engine/simulation`: headless ECS, math, assets, transforms,
  diagnostics, and spatial queries.
- `@aperture-engine/render`: renderer-independent authoring contracts,
  extraction, snapshots, render-world data, mesh/material assets, and render
  diagnostics.
- `@aperture-engine/webgpu`: WebGPU backend, browser app facade, GPU resources,
  render passes, pipelines, command encoding, and submission.
- `@aperture-engine/app`: developer-facing config, systems, generated browser
  and worker bootstrap, input, assets, and runtime ergonomics.
- `@aperture-engine/vite-plugin`: config discovery, system discovery, generated
  virtual modules, and dev-session build integration.
- `@aperture-engine/cli`: app creation, managed browser/dev sessions, MCP
  tools, runtime tools, and reference/RAG tooling.
- `@aperture-engine/runtime`: focused headless simulation and extraction
  facades.

The problem is inside several packages, especially `webgpu`: folders are too
flat, filename prefixes are acting as fake directories, and some root exports
make internal renderer machinery look public.

## Current State

Initial observed package source file counts before Track 1:

- `packages/webgpu/src`: 223 files, almost all under `src/webgpu`.
- `packages/render/src`: 88 files, already split into broad domains.
- `packages/simulation/src`: 25 files, already reasonably organized.
- `packages/app/src`: 15 files, but several files are large and mix concerns.
- `packages/cli/src`: 8 files, with very large command/reference modules.
- `packages/vite-plugin/src`: 1 large `index.ts`.
- `packages/runtime/src`: 4 small facade files.

Largest pressure points:

- `packages/webgpu/src/app/app.ts`: app startup, frame loop, presentation,
  asset mirroring, diagnostics, transport, picking, and resource setup are all
  mixed together.
- `packages/webgpu/src/materials/standard/standard-shader.ts`: shader chunks, feature
  flags, variant assembly, and validation are mixed in one file.
- `packages/webgpu/src/materials/standard/prepared-standard-material-cache.ts`,
  `local-light-cookie-resources.ts`, `renderer-frame-summary.ts`,
  `local-light-clusters.ts`, and `standard-frame-resources.ts` are all large
  enough to deserve clearer ownership.
- `packages/app/src/systems.ts`, `worker.ts`, `browser.ts`, and
  `input-state.ts` are broad modules that now cover multiple public and runtime
  concerns.
- `packages/cli/src/cli.ts` and `reference.ts` are large modules that combine
  command wiring, implementation, and data/tooling logic.
- `packages/vite-plugin/src/index.ts` combines plugin creation, config
  analysis, system discovery, virtual modules, and generated type output.

The `webgpu` package also has obvious filename-prefix clusters:

- `standard-*`
- `shadow-*`
- `queued-*`
- `prepared-*`
- `render-*`
- `frame-*`
- `unlit-*`
- `matcap-*`
- `debug-normal-*`
- `post-*`
- `ibl-*`

Those prefixes should become real folders.

## Goals

- Keep package boundaries aligned with the North Star architecture.
- Make source folders mirror ownership and frame-pipeline stages.
- Make WebGPU internals easier to navigate without creating a renderer-owned
  scene graph.
- Keep ECS/render extraction and worker-ready snapshot boundaries explicit.
- Make public exports intentional rather than accidental barrel exports of
  internal implementation details.
- Keep the migration mostly mechanical at first so behavior does not change
  while files move.
- Reduce the size and responsibility of the largest modules after the
  mechanical move is stable.

## Non-Goals

- No new npm package split in this refactor.
- No WebGL fallback.
- No mutable scene graph or renderer-owned gameplay state.
- No broad render-pipeline redesign during the file move.
- No API churn unless it is part of explicit export hygiene.
- No unrelated formatting churn outside moved/touched files.

## Target Shape: `packages/webgpu`

The redundant `src/webgpu/` nesting is removed by Track 1. The package root should
be `packages/webgpu/src`, with subfolders by backend responsibility:

```text
packages/webgpu/src/
  index.ts
  app/
    create-webgpu-app.ts
    frame-loop.ts
    presentation.ts
    canvas.ts
    resize.ts
    source-assets.ts
    snapshot-transport.ts
    diagnostics.ts
    picking.ts
  gpu/
    adapter.ts
    device.ts
    canvas-context.ts
    buffers.ts
    textures.ts
    samplers.ts
    bind-groups.ts
    pipelines.ts
    commands.ts
    timing.ts
  resources/
    keys.ts
    lifecycle.ts
    summaries.ts
    prepared-meshes.ts
    prepared-materials.ts
    textures.ts
    samplers.ts
    caches.ts
  render/
    frame.ts
    queues/
    passes/
      main.ts
      shadows.ts
      post.ts
      readback.ts
      picking.ts
    draw-commands.ts
    bundles.ts
  materials/
    core/
    standard/
      shader.ts
      shader-chunks.ts
      features.ts
      pipeline.ts
      bind-groups.ts
      buffers.ts
      textures.ts
      ibl.ts
      shadows.ts
      skinning.ts
      morphing.ts
    unlit/
    matcap/
    debug-normal/
    custom-wgsl/
  lighting/
    packing.ts
    clusters.ts
    environment.ts
    area-lights.ts
    cookies.ts
  shadows/
    core.ts
    directional.ts
    point.ts
    spot.ts
    atlas.ts
  post/
    bloom.ts
    ssao.ts
    ssr.ts
    dof.ts
    taa.ts
    fxaa.ts
  output/
    color-space.ts
    tonemap.ts
  diagnostics/
  test-support/
```

### WebGPU Migration Notes

- Move files by prefix/domain first with no logic changes.
- Keep temporary compatibility barrels only inside the package while imports
  are being migrated.
- Prefer explicit internal imports from the new folders over one large
  `webgpu/index.ts` barrel.
- Split `app.ts` after the mechanical move into startup, presentation,
  frame-loop, asset mirroring, diagnostics, picking, and transport modules.
- Split `standard-shader.ts` after the mechanical move into chunks, feature
  flags, variant assembly, validation, and material-family integration.
- Move `standard-*`, `unlit-*`, `matcap-*`, and `debug-normal-*` into material
  family folders.
- Move `shadow-*`, `point-shadow-*`, `spot-shadow-*`, and
  `directional-shadow-*` into `shadows/`.
- Move `post-*` into `post/`.
- Move `queued-*` and `prepared-*` into queue/resource preparation folders.

## Target Shape: `packages/render`

`render` already has useful top-level domains, but the asset and rendering
folders should be deepened around importer, preparation, and snapshot concerns:

```text
packages/render/src/
  index.ts
  assets/
    registry/
    loaders/
      glb.ts
      gltf.ts
      hdr.ts
      ktx2.ts
      draco.ts
      meshopt.ts
    gltf/
      parsing.ts
      decoding.ts
      scene-import.ts
      ecs-authoring.ts
      material-import.ts
      diagnostics.ts
    preparation/
  materials/
    core/
    families/
      unlit/
      matcap/
      standard/
      debug-normal/
      custom-wgsl/
    gltf/
    dependencies/
  mesh/
    primitives/
    geometry/
    bounds/
  rendering/
    extraction/
    snapshot/
    render-world/
    queues/
    preparation/
    diagnostics/
```

The goal is to keep `render` renderer-independent while making it obvious
which modules describe authoring assets, imported data, extracted snapshots,
and prepared render-world contracts.

## Target Shape: `packages/app`

`app` should stay the developer-facing facade, but its internals should separate
public authoring contracts from generated browser/worker runtime code:

```text
packages/app/src/
  index.ts
  config/
    define-config.ts
    assets.ts
    input.ts
    render.ts
    diagnostics.ts
  systems/
    create-system.ts
    context.ts
    spawn.ts
    assets.ts
    materials.ts
    meshes.ts
    resources.ts
  input/
    resource.ts
    keyboard.ts
    gamepad.ts
    pointer.ts
    actions.ts
    protocol.ts
  assets/
    manifest.ts
    mirror.ts
    preload.ts
  generated/
    browser/
    worker/
    commands/
    devtools/
  runtime/
    advanced.ts
    headless.ts
  tooling/
    entity-lookup.ts
    spatial-queries.ts
```

Root and subpath exports should stay focused:

- `@aperture-engine/app`
- `@aperture-engine/app/config`
- `@aperture-engine/app/systems`
- `@aperture-engine/app/advanced`
- `@aperture-engine/app/browser`
- `@aperture-engine/app/worker`
- `@aperture-engine/app/vite`

Internal generated/runtime modules should not leak through the root export.

## Target Shape: `packages/vite-plugin`

Split the single large plugin module into focused build-time concerns:

```text
packages/vite-plugin/src/
  index.ts
  plugin.ts
  config.ts
  system-discovery.ts
  descriptor-analysis.ts
  virtual-modules.ts
  generated-action-types.ts
  asset-manifest.ts
  dev-session.ts
  diagnostics.ts
```

This should make automatic system registration, system priority extraction,
generated input action types, virtual browser/worker modules, and dev-session
metadata independently testable.

## Target Shape: `packages/cli`

Split CLI command wiring from command implementation and reusable tool
transports:

```text
packages/cli/src/
  index.ts
  bin/
  commands/
    create.ts
    dev.ts
    tool.ts
    mcp.ts
    reference.ts
  templates/
    minimal/
    glb-viewer/
    game/
  dev-session/
    session-file.ts
    managed-browser.ts
    transport.ts
    lifecycle.ts
  mcp/
    server.ts
    tools.ts
    schemas.ts
  browser-tools/
    input.ts
    camera.ts
    ecs.ts
    render.ts
    screenshot.ts
  reference/
    ingest.ts
    index.ts
    query.ts
    assets.ts
    filters.ts
```

The command modules should parse CLI arguments and delegate to reusable
implementations. MCP tools and CLI tools should continue sharing the same
backend contracts.

## Target Shape: `packages/simulation` And `packages/runtime`

`simulation` is already relatively well organized. Keep it mostly stable, with
only targeted refinements:

- Preserve `assets/`, `diagnostics/`, `ecs/`, `math/`, `spatial/`, and
  `transform/`.
- Consider splitting `spatial/mesh-bvh.ts` only when a real maintenance or
  testability issue requires it.
- Do not import render, WebGPU, browser APIs, or app-generated runtime modules.

`runtime` should stay small:

- Keep it as focused headless simulation/extraction facade code.
- Do not turn it into a new umbrella package.
- Do not reintroduce the retired `core` package role.

## Export Hygiene

The current `@aperture-engine/webgpu` root and internal barrel exports expose
too much backend machinery. After imports are stable:

- Curate public root exports to intentional app facade and low-level contracts.
- Move implementation-only exports behind internal paths or remove them from
  package export maps.
- Keep test-only helpers under `test-support/` or package-private imports.
- Avoid broad `export *` barrels that make every internal file de facto public.
- Preserve explicitly documented public entry points while the project is still
  prelaunch.

Candidate public WebGPU exports:

- `createWebGpuApp`
- public app/browser diagnostics types
- intentional WebGPU app options
- intentional low-level material/custom-WGSL contracts, if documented

Candidate internal-only exports:

- pipeline cache details
- bind group builders
- per-family prepared resource caches
- pass encoders
- draw command planners
- shader assembly helpers
- queue/package internals

## Implementation Tracks

### Track 1: Mechanical WebGPU Move

Create the target folder structure under `packages/webgpu/src`, move files by
domain/prefix, and update internal imports without changing behavior.

Acceptance criteria:

- `packages/webgpu/src/webgpu/` is removed or reduced to a temporary
  compatibility barrel with no implementation files.
- Existing WebGPU tests and examples pass with no intended behavior changes.
- `pnpm --filter @aperture-engine/webgpu run typecheck` passes.
- `pnpm --filter @aperture-engine/webgpu run build` passes.
- Targeted WebGPU/render Playwright coverage for at least the primary examples
  still passes.
- `git diff --stat` shows mostly file moves and import updates.

### Track 2: Split WebGPU App Orchestration

Split the large WebGPU app module into focused app, presentation, frame-loop,
diagnostics, picking, asset, and transport modules.

Acceptance criteria:

- App startup, frame loop, canvas/presentation, source asset mirroring,
  snapshot transport, diagnostics, and picking each live in focused modules.
- Public `createWebGpuApp(...)` behavior and types remain stable.
- Generated Vite apps still render through the same worker/main boundary.
- Browser diagnostics still report canvas, render, asset, input, and frame
  status.
- Existing app, developer API, and managed-browser tests pass.

### Track 3: Split Material Families

Move material-family implementation into dedicated folders and split the
standard shader into smaller ownership units.

Acceptance criteria:

- `standard`, `unlit`, `matcap`, `debug-normal`, and `custom-wgsl` have
  separate WebGPU material-family folders.
- StandardMaterial shader chunks, feature flags, variant assembly, pipeline
  setup, bind group resources, textures, IBL, shadows, skinning, and morphing
  are separately navigable.
- Built-in material examples render unchanged.
- Custom WGSL examples and tests still pass.
- Material diagnostics and queue-family reports are unchanged except for
  intentional wording updates.

### Track 4: Split Shadows, Lighting, Post, And Output

Move render-stage subsystems into dedicated domains.

Acceptance criteria:

- Shadow resources and passes live under `shadows/`.
- Clustered/local/environment lighting resources live under `lighting/`.
- Bloom, SSAO, SSR, DOF, TAA, FXAA, and related passes live under `post/`.
- Tonemap and color-space code lives under `output/`.
- Existing shadow, lighting, post-effect, and tonemap examples pass.
- Render-pipeline diagnostics retain the same JSON-safe shape.

### Track 5: Render Package Deepening

Deepen `packages/render/src` around glTF import, material families, render
snapshot/extraction, render-world contracts, and asset preparation.

Acceptance criteria:

- glTF parsing/import/authorship code is grouped by responsibility.
- Render extraction and render snapshot code are separated from render-world
  preparation contracts.
- Renderer-independent material-family source contracts remain free of WebGPU
  imports.
- Existing render package tests pass.
- Existing app examples still use public render/app contracts, not internal
  import paths.

### Track 6: App Package Split

Split developer config/systems APIs, input state, assets, generated runtime,
and tooling helpers into focused folders.

Acceptance criteria:

- `config`, `systems`, `input`, `assets`, `generated`, `runtime`, and `tooling`
  concerns are separated.
- Existing subpath exports remain stable.
- The root app export remains browser-safe and does not expose generated worker
  internals by accident.
- Generated action types, input actions, browser forwarding, and worker input
  processing still pass targeted tests.
- Playground and create templates typecheck and build.

### Track 7: Vite Plugin Split

Split the Vite plugin into plugin wiring, config loading, system discovery,
descriptor analysis, virtual modules, generated action types, asset manifests,
dev-session metadata, and diagnostics.

Acceptance criteria:

- `packages/vite-plugin/src/index.ts` is a small public entry point.
- System discovery and generated action type logic are independently tested.
- System priority extraction remains deterministic and documented.
- Generated browser and worker virtual modules are unchanged in behavior.
- Create-template, developer API, and app type-generation tests pass.

### Track 8: CLI Split

Split CLI commands, templates, dev-session transport, MCP tools, browser tools,
and reference/RAG tooling into focused modules.

Acceptance criteria:

- `packages/cli/src/cli.ts` contains command registration/wiring only, or is
  small enough to review comfortably.
- `create`, `dev`, `tool`, `mcp`, and `reference` command implementation lives
  in command modules.
- CLI tools and MCP tools continue to share one backend implementation.
- Create templates still pass install, typecheck, build, managed-browser, and
  browser smoke validation in temporary projects.
- MCP and CLI runtime-tool end-to-end tests pass.
- Reference/RAG tests pass, and ingestion filters remain explicit about
  developer-facing API sources.

### Track 9: Public Export Tightening

Once internal imports use the new folder structure, tighten package root exports
and package `exports` maps to expose only intentional public surfaces.

Acceptance criteria:

- `@aperture-engine/webgpu` root no longer exports every internal backend file.
- Public exports are documented or intentionally test-covered.
- Internal tests use `test-support/` or package-internal paths rather than
  public barrels.
- Package-boundary checks pass.
- Existing examples and generated apps import only public APIs.
- TypeScript consumers receive actionable errors for removed accidental
  internals if they attempt to import them.

## Suggested Order

1. Do a no-behavior-change WebGPU mechanical move first.
2. Split WebGPU app orchestration while examples still provide coverage.
3. Split material families, starting with `standard`.
4. Split shadows, lighting, post, and output modules.
5. Deepen `render` package folders around importer/extraction/preparation.
6. Split `app` internals after the current input/config APIs stabilize.
7. Split `vite-plugin` so generated app behavior is independently testable.
8. Split `cli` command/tool/reference modules.
9. Tighten public exports after internal imports are no longer barrel-dependent.

## Global Acceptance Criteria

- No package-level architecture boundary regresses:
  - `simulation` does not import render, WebGPU, app, browser APIs, or Vite.
  - `render` does not import WebGPU, app runtime, browser APIs, or Vite.
  - `webgpu` owns GPU resources and does not become authoritative gameplay
    state.
  - `app` remains the developer facade over lower packages and generated
    browser/worker bootstrap.
  - `vite-plugin` remains build-time only.
  - `cli` remains tooling/runtime orchestration and does not become required
    runtime state.
- No hidden scene graph is introduced.
- Worker-targeted system modules remain worker-safe.
- Existing examples continue to run through public APIs.
- Existing generated app workflow still works from `aperture.config.ts`,
  automatic system discovery, and generated browser/worker virtual modules.
- `pnpm run typecheck` passes.
- `pnpm run typecheck:test` passes.
- `pnpm run check:boundaries` passes.
- `pnpm run check:examples` passes.
- Relevant package builds pass after each track.
- Targeted unit and Playwright tests pass for every moved domain.
- Any full-suite failures that remain are documented as pre-existing and not
  caused by the refactor.
- Public docs are updated when an export path or package entry point changes.

## Risks And Mitigations

- Risk: Large mechanical moves make review difficult.
  Mitigation: Commit by coherent track and keep the first track import-only.

- Risk: Broad barrels hide accidental public API.
  Mitigation: Migrate internal imports first, then tighten exports in a separate
  track with package-boundary tests.

- Risk: WebGPU files have circular dependencies that are easier to miss after
  moves.
  Mitigation: run package typecheck/build after each small move group and keep
  temporary barrels only during migration.

- Risk: Examples import internals.
  Mitigation: include `check:examples`, package-boundary checks, and targeted
  browser tests in every track that changes exports.

- Risk: Refactor work stalls after broad folders are created.
  Mitigation: do not create empty architecture-only folders except as part of
  moving real files into them.
