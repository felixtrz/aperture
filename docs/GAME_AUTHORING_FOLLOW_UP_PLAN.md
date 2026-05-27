# Game Authoring Follow-Up Plan

Status: implemented

## Context

The platformer playground exposed a useful set of product-quality gaps. The core
runtime can already build a real ECS-authored game, but the default path still
needs better pixels, stronger canvas invariants, explicit scheduling semantics,
first-class agent tooling, and scaffolded game/asset patterns.

This plan turns those follow-ups into implementation tracks with acceptance
criteria. The goal is not to add a full editor, physics engine, or scene graph.
The goal is to make generated Aperture apps feel reliable and inspectable by
default while preserving the ECS-first, WebGPU-only architecture.

## Goals

- Generated apps should look good without every app opting into render quality
  settings manually.
- Canvas backing size, CSS size, aspect ratio, and device pixel ratio should be
  synchronized by the runtime.
- Automatically discovered systems should run in a documented, deterministic
  order.
- The CLI and MCP surfaces should let humans and agents inspect, drive, and
  debug a running app without ad hoc browser scripts.
- New apps and examples should get practical asset and gameplay scaffolding
  patterns instead of hand-rolled setup boilerplate.

## Non-Goals

- No WebGL fallback.
- No renderer-owned scene graph.
- No broad physics engine in this slice.
- No visual editor.
- No hidden mutable app state outside the ECS world.

## Track 1: Render Quality Defaults

Make the generated browser app use quality defaults that match a modern game/app
expectation while keeping explicit performance opt-outs.

Implementation outline:

- Make generated browser apps default to `render.sampleCount: 4` when omitted.
- Preserve `render.sampleCount: 1` as the explicit MSAA opt-out.
- Keep diagnostics reporting requested sample count, effective sample count,
  clamping, and whether MSAA color targets are allocated.
- Add a `render.pixelRatio` / `render.maxPixelRatio` policy for generated apps.
- Default to device pixel ratio capped by a conservative value, likely `2`,
  unless a later benchmark shows a different default is better.
- Report CSS size, backing size, effective pixel ratio, aspect ratio, and resize
  source in generated-app diagnostics.

Acceptance criteria:

- A generated app with no `render.sampleCount` reports effective MSAA sample
  count `4`.
- A generated app with `render.sampleCount: 1` reports MSAA disabled and renders
  without allocating an MSAA color target.
- Invalid or unsupported sample counts are clamped with an actionable diagnostic.
- A generated app running at simulated DPR `2` creates a backing canvas at
  `cssWidth * effectivePixelRatio` by `cssHeight * effectivePixelRatio`.
- A generated app running above the default DPR cap reports the capped effective
  pixel ratio.
- Type tests cover the render config shape.
- Browser tests verify MSAA diagnostics and non-squeezed output after resize.
- `docs/AUTHORING.md` documents the defaults and opt-out knobs.

## Track 2: Canvas Sizing Invariants

Make canvas sizing a core generated-app invariant, not an example convention.

Implementation outline:

- Centralize generated canvas resize handling in `@aperture-engine/app`.
- Use `ResizeObserver` for CSS-size changes.
- Prefer `devicePixelContentBoxSize` when available and fall back to
  `getBoundingClientRect() * effectivePixelRatio`.
- Reconfigure WebGPU presentation and renderer-owned size-dependent resources
  only when the resolved backing size changes.
- Preserve app-authored aspect behavior without stretching the canvas.
- Keep diagnostics available to browser, CLI, and MCP tools.

Acceptance criteria:

- Resizing the canvas container updates CSS dimensions, backing dimensions,
  camera aspect, and WebGPU render target dimensions in the same frame or the
  next animation frame.
- Canvas diagnostics expose `displayWidth`, `displayHeight`, `width`, `height`,
  `pixelRatio`, and `aspect`.
- Playwright verifies that a generated app remains unsqueezed across at least
  two desktop sizes and one mobile-sized viewport.
- Playwright verifies that no render target is left at a stale size after
  resize.
- The platformer playground keeps a stable aspect ratio and centered camera
  after resize.

## Track 3: System Priority Semantics

Stabilize automatic system ordering as a first-class authoring contract.

Implementation outline:

- Keep the descriptor shape:

```ts
export default class SpinSystem extends createSystem({
  priority: 100,
  queries: {
    crates: { required: [Name, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 1 },
  },
}) {}
```

- Define scheduling semantics clearly: lower numeric priority runs earlier,
  higher numeric priority runs later, and omitted priority defaults to `0`.
- Keep equal-priority order deterministic by module id.
- Ensure `priority` is descriptor metadata, not a runtime config signal.
- Preserve `config.priority` as a valid user signal without colliding with
  descriptor priority.
- Ensure the Vite plugin validates static literal priorities during discovery.
- Ensure generated worker registration and headless app registration share the
  same ordering rules.

Acceptance criteria:

- Tests prove lower priority systems run before higher priority systems.
- Tests prove equal-priority systems run in deterministic module-id order.
- Tests prove omitted priority defaults to `0`.
- Tests prove non-finite or non-literal priorities fail with actionable
  diagnostics before registration.
- Tests prove `config.priority` remains accessible as a runtime signal and does
  not affect schedule ordering.
- The playground systems declare priorities where ordering matters.
- `docs/AUTHORING.md` documents the priority contract and recommended ranges.

## Track 4: CLI And MCP Runtime Tools

Expose the managed browser, ECS, render, input, and camera inspection workflow
through supported tooling instead of one-off page evaluation scripts.

Implementation outline:

- Keep a project-local runtime session file for generated-app dev sessions.
- Add or stabilize CLI commands for:
  - browser/session status
  - screenshot capture
  - console and diagnostic log retrieval
  - input emulation
  - ECS entity/component query
  - render diagnostics
  - canvas diagnostics
  - camera list/get/save/restore
  - agent camera creation and `lookAt` / `fitEntity` / orbit controls
  - clean teardown
- Surface matching MCP tools over the same transport and contracts.
- Keep agent camera state separate from user-authored cameras unless a command
  explicitly switches the active view.
- Return structured diagnostics when no dev session exists, the browser is gone,
  or a tool targets an unknown entity/camera/action.

Acceptance criteria:

- Every CLI runtime command has end-to-end coverage against a generated app.
- Every MCP runtime tool has end-to-end coverage against a generated app.
- A test can launch a generated app, query ECS state, emulate input, move or use
  an agent camera, capture a screenshot, read render/canvas diagnostics, and
  tear down the browser.
- Tooling can inspect the platformer player, gems, camera, canvas, and render
  frame without using `page.evaluate()` against private globals.
- Camera tools can save and restore the user camera state.
- Input tools can drive the platformer far enough to prove game state changes.
- Missing-session and unknown-target failures return actionable diagnostics.
- The CLI docs and MCP tool descriptions stay in sync.

## Track 5: Scaffolded Asset And Gameplay Patterns

Reduce the boilerplate required to create examples like the platformer.

Implementation outline:

- Extend the CLI create flow with practical templates such as:
  - minimal 3D app
  - GLB scene viewer
  - small game/platformer-style app
- Generate an `aperture.config.ts` with render quality defaults, input actions,
  signals, system globs, and a typed asset manifest.
- Generate a setup system that spawns assets through ECS components and stable
  handles.
- Provide a small documented kinematic-controller example pattern, or a helper
  if repeated examples prove the abstraction is worth owning.
- Keep templates free of hidden scene graph concepts.
- Ensure generated imports avoid surprising TypeScript/runtime mismatches where
  possible, and document when `.js` specifiers are required.

Acceptance criteria:

- `aperture create` can scaffold each template without a separate create
  package.
- Each scaffolded template passes install, typecheck, build, and browser smoke
  tests in a temporary directory.
- The game template includes input actions, camera follow, collectible or goal
  state, asset registration, and deterministic system priorities.
- The GLB viewer template loads at least one local GLB asset and reports asset
  readiness diagnostics.
- Generated asset manifests are typechecked and fail clearly when referenced
  files are missing.
- Template examples use public Aperture APIs only.
- Documentation explains how to add assets, systems, signals, input actions,
  and priorities to a generated app.

## Suggested Order

1. Land render-quality defaults and DPR/canvas diagnostics together.
2. Harden canvas resize behavior with browser tests.
3. Stabilize and document system priority semantics.
4. Build the runtime CLI/MCP inspection loop over the managed browser session.
5. Upgrade scaffolds/templates once the defaults and tooling are stable.

## Overall Acceptance Criteria

- A newly scaffolded generated app looks anti-aliased by default and reports
  MSAA/DPR/canvas diagnostics.
- The app can opt out of MSAA and lower DPR for performance.
- Resizing does not squeeze the canvas or leave stale WebGPU dimensions.
- Automatically discovered systems run in a documented deterministic order.
- Agents can inspect ECS, render, input, and camera state through CLI/MCP tools.
- Scaffolded examples demonstrate practical asset and gameplay patterns without
  introducing a mutable scene graph.
- All new CLI tools and templates have end-to-end tests.
- Existing platformer behavior remains covered by a scripted smoke test.
- Relevant docs are updated: `docs/AUTHORING.md`, `docs/AI_TOOLING_PLAN.md`,
  and CLI/template documentation.
