# Aperture AI Tooling Plan

## Summary

Aperture should offer first-class AI tooling for apps built with the runtime:
a managed browser launched from the CLI, an MCP surface over that browser,
ECS inspection and mutation tools, input emulation, agent camera controls,
render diagnostics, and reference/RAG tools for docs and code search.

The tooling should keep Aperture's architecture intact:

- ECS remains the authoritative source of truth.
- Rendering remains a derived view of ECS state.
- No mutable renderer-owned scene graph is introduced.
- Browser/WebGPU and Playwright dependencies stay in dev tooling paths.
- Production app bundles do not include the AI bridge by default.

## Package Decision

Use one real CLI package:

- Package: `@aperture-engine/cli`
- Binary: `aperture`
- Primary commands:
  - `aperture create`
  - `aperture dev up`
  - `aperture dev down`
  - `aperture dev status`
  - `aperture dev open`
  - `aperture dev logs`
  - `aperture mcp stdio`
  - `aperture adapter sync`
  - `aperture reference build`
  - `aperture reference search`

Users should scaffold apps with:

```sh
npx @aperture-engine/cli create my-app
```

The plan does not require a separate `@aperture-engine/create` package. A tiny
alias package can be added later for discoverability if needed, but it should
not own implementation.

The CLI package should own creation, managed browser lifecycle, MCP stdio,
adapter sync, and reference indexing/search command surfaces. Heavy dependencies
such as Playwright, MCP server helpers, and reference-indexing libraries should
be CLI dependencies and loaded only by commands that need them.

## Existing Aperture Foundations

Aperture already has useful primitives to build on:

- Generated browser apps expose a JSON-safe status global.
- Generated browser apps forward input and generic command messages to the
  worker.
- The generated worker already supports entity find/get/snapshot/diff and a
  narrow mutation channel.
- The Vite plugin already owns `aperture.config.ts`, system discovery, and
  generated browser/worker virtual modules.
- The ECS layer already has `Parent`, `LocalTransform`, `WorldTransform`,
  `Name`, `DebugMetadata`, `AppEntityKey`, `AppEntityTags`, and
  `AppEntitySource`.
- The WebGPU app already exposes frame diagnostics and entity picking.

The first implementation should reuse these seams instead of creating a second
debug runtime.

## Architecture

```text
aperture CLI
  -> dev session manager
  -> managed Playwright browser
  -> Vite dev bridge
  -> generated browser runtime bridge
  -> generated worker devtools protocol
  -> ECS world / render extraction / WebGPU app

aperture mcp stdio
  -> active .aperture/runtime/session.json
  -> CLI session client
  -> same managed browser bridge
```

### CLI Layer

`@aperture-engine/cli` owns:

- App creation.
- Adapter file generation/sync for AI coding tools.
- Dev server orchestration.
- Managed browser lifecycle.
- MCP stdio server.
- Reference index build/search commands.
- End-to-end smoke harnesses for the full CLI surface.

The CLI should not become runtime app state. It should orchestrate and proxy.

### Vite Plugin Layer

`@aperture-engine/vite-plugin` should gain dev-only AI tooling options:

```ts
aperture({
  ai: {
    mode: "agent",
  },
});
```

The plugin should:

- Register a local dev WebSocket endpoint.
- Write `.aperture/runtime/session.json` with the active app, port, bridge URL,
  browser status, and protocol version.
- Inject the browser bridge only in dev mode when AI tooling is enabled.
- Keep production builds free of the bridge.

### Browser Bridge

The generated browser bootstrap should expose a typed devtools runtime object in
managed sessions only, for example:

```ts
globalThis.__APERTURE_MCP_RUNTIME__;
```

The browser bridge should:

- Identify managed tabs with a marker such as `__APERTURE_MCP_MANAGED__`.
- Route browser-only tools locally.
- Route ECS and simulation tools to the worker protocol.
- Route render tools to the WebGPU app facade.
- Return direct request/response results instead of requiring polling of the
  status global.

The current status global should remain useful for simple dashboards and tests,
but MCP tools should use request/response commands for precision.

### Worker Devtools Protocol

Add a versioned request/response protocol:

```ts
interface ApertureDevtoolsRequest {
  readonly version: 1;
  readonly requestId: string;
  readonly tool: string;
  readonly payload?: unknown;
}

interface ApertureDevtoolsResponse {
  readonly version: 1;
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}
```

Existing command channels can be adapted behind this protocol, but MCP should
not rely on "dispatch event, wait for next status frame" behavior.

## Tool Surface

### Browser Tools

- `browser_status`
- `browser_screenshot`
- `browser_console_logs`
- `browser_reload`
- `browser_wait_for_webgpu`
- `browser_pick_pixel`

### ECS Tools

- `ecs_find_entities`
- `ecs_get_entity`
- `ecs_query`
- `ecs_get_component_schema`
- `ecs_snapshot`
- `ecs_diff`
- `ecs_list_systems`
- `ecs_pause`
- `ecs_resume`
- `ecs_step`
- `ecs_set_component_field`

Mutation must stay allowlisted. Initial allowed mutations should include debug
metadata and focused transform/camera fields. Broad arbitrary component writes
should wait until there is a schema-safe mutation design.

### Derived Hierarchy Tool

Add a `scene_get_hierarchy` or `ecs_get_hierarchy` tool, backed by ECS data.

This is not a scene graph. It is a derived view:

- Parent/child edges come from `Parent`.
- Local pose comes from `LocalTransform`.
- World pose comes from `WorldTransform`.
- Names and keys come from `Name`, `AppEntityKey`, and `DebugMetadata`.
- Tags come from `AppEntityTags`.
- Asset/source details come from `AppEntitySource`.
- Renderability comes from render-facing components and snapshot packets.

Entities without `Parent` are roots. Entities with stale parent references
should be returned with diagnostics from transform resolution.

### Input Tools

- `input_key`
- `input_pointer_move`
- `input_pointer_click`
- `input_drag`
- `input_action_set`
- `input_reset`

These tools should drive the same generated input path as real browser events
so app systems observe the same input signals.

Gamepad and XR input should not be copied from IWSDK until Aperture has real
runtime support for those domains.

### Agent Camera Tools

Provide an agent camera facility instead of permanently hijacking app cameras.

Tools:

- `camera_list`
- `camera_get`
- `camera_save`
- `camera_restore`
- `camera_create_agent`
- `camera_set_transform`
- `camera_look_at`
- `camera_orbit`
- `camera_fit_entity`
- `camera_use_agent_view`

The first version can present the agent camera in the managed browser tab only.
Later versions can render to an offscreen target for inspection while leaving
the user-facing app camera untouched.

### Render Tools

- `render_get_frame_report`
- `render_get_snapshot_summary`
- `render_get_packets`
- `render_explain_entity`
- `render_get_diagnostics`
- `render_readback_samples`
- `render_pick_entity`

`render_explain_entity` should combine ECS summary, transform state, visibility,
layers, asset readiness, extraction diagnostics, render snapshot packets, and
WebGPU frame diagnostics into one answerable report.

### Reference/RAG Tools

The CLI should expose reference commands and the MCP server should expose
reference tools.

Initial corpus:

- `docs/`
- `packages/*/src`
- `examples/`
- `test/`
- public package exports
- component and system definitions
- diagnostic codes and suggested fixes
- curated local reference anchors under `references/`

Tools:

- `reference_search`
- `reference_api_lookup`
- `reference_file_content`
- `reference_find_examples`
- `reference_list_components`
- `reference_list_systems`
- `reference_find_dependents`
- `reference_explain_diagnostic`

The first version can use lexical search plus structured indexes. Semantic
embeddings can be added behind the same tool names when the corpus and update
workflow are stable.

## App Creation and Adapter Sync

`aperture create` should scaffold apps with:

- `aperture.config.ts`
- `vite.config.ts`
- generated starter systems
- a real first screen, not a marketing page
- `AGENTS.md`
- `CLAUDE.md`
- `.claude/settings.json`
- `.cursor/rules/aperture.mdc`
- `.github/copilot-instructions.md`
- `.codex/config.toml`
- MCP config pointing at the workspace-local Aperture CLI

`aperture adapter sync` should:

- Create missing adapter files.
- Update managed sections.
- Preserve user-owned content.
- Report what changed.
- Be idempotent.

## Implementation Phases

### Phase 1: CLI Package and Create Command

Add `@aperture-engine/cli` with the `aperture` binary and a `create` command.

Acceptance criteria:

- `npx @aperture-engine/cli create my-app` scaffolds a runnable Aperture app.
- The scaffold uses the current Vite metaframework path.
- The scaffold includes AI adapter files and MCP config.
- The package has no production runtime coupling to Playwright or MCP in app
  bundles.
- `aperture --help`, `aperture create --help`, and invalid create invocations
  return useful output and correct exit codes.
- End-to-end tests create a temp app, install dependencies, run typecheck/build,
  start the app, and verify the generated page reaches WebGPU-ready status.

### Phase 2: Managed Dev Session

Add `aperture dev up/down/status/open/logs`.

Acceptance criteria:

- `aperture dev up --open` starts or attaches to Vite and opens a managed
  Playwright browser.
- `.aperture/runtime/session.json` records protocol version, app root, URL,
  bridge endpoint, process ids where available, and managed browser state.
- `aperture dev status` reports whether the dev server, bridge, and managed
  browser are alive.
- `aperture dev logs` streams or prints recent server/browser logs.
- `aperture dev down` closes the managed browser and stops owned processes
  without killing unrelated user processes.
- End-to-end tests cover every `dev` subcommand, stale session recovery, port
  changes, and repeated start/stop cycles.

### Phase 3: MCP Server and Browser Tools

Add `aperture mcp stdio` and browser-level MCP tools.

Acceptance criteria:

- MCP `tools/list` exposes browser tools when an Aperture dev session is
  active.
- MCP reports a clear diagnostic when no session exists.
- Browser tools can capture a screenshot, collect console logs, reload the app,
  wait for WebGPU readiness, and report status.
- Tool calls use the active session file rather than hard-coded ports.
- End-to-end tests launch the MCP server over stdio and invoke every browser
  tool through an MCP client harness.

### Phase 4: ECS Tools

Expose request/response ECS tools through the browser bridge and worker
devtools protocol.

Acceptance criteria:

- Tools can find entities by key, name pattern, tags, component ids, and glTF
  source metadata.
- Tools can get entity summaries and component schemas.
- Tools can snapshot and diff entity sets.
- Tools can return a derived ECS hierarchy without introducing scene graph
  ownership.
- Tools can pause, resume, and single-step simulation.
- Allowed mutations are schema-checked and produce diagnostics.
- End-to-end tests invoke every ECS MCP tool against a scaffolded app and verify
  returned data, pause/step behavior, mutation effects, and error cases.

### Phase 5: Input and Agent Camera Tools

Add input emulation and agent camera controls.

Acceptance criteria:

- Input tools update the same generated input signals as real browser events.
- Pointer and keyboard tools can trigger systems in the scaffolded app.
- Agent camera tools can create or select an agent camera, fit an entity,
  orbit around it, restore previous camera state, and render from the agent
  view in the managed browser.
- User app camera state is restored after agent inspection unless the tool call
  explicitly requests persistence.
- End-to-end tests cover every input and camera tool, including restore and
  invalid target diagnostics.

### Phase 6: Render Inspection Tools

Expose render diagnostics, packet summaries, entity explanations, readback, and
picking.

Acceptance criteria:

- `render_get_frame_report` returns the latest WebGPU frame report.
- `render_get_snapshot_summary` returns snapshot counts and diagnostics.
- `render_get_packets` can filter views, mesh draws, lights, environments,
  shadows, and bounds.
- `render_explain_entity` explains rendered, skipped, and unknown entities.
- `render_pick_entity` uses the existing WebGPU ID-buffer picking path where
  available.
- `render_readback_samples` returns JSON-safe pixel samples or clear
  unsupported diagnostics.
- End-to-end tests invoke every render MCP tool and validate both success and
  failure/unsupported paths.

### Phase 7: Reference Tools

Add reference index build/search and MCP reference tools.

Acceptance criteria:

- `aperture reference build` creates a workspace-local index.
- `aperture reference search` works from the CLI without a browser session.
- MCP reference tools work with or without a running Aperture app.
- The index includes docs, package exports, examples, tests, components,
  systems, and diagnostics.
- Results cite files and symbols, not only prose snippets.
- End-to-end tests build the index in a temp workspace and invoke every
  reference CLI and MCP tool.

### Phase 8: Adapter Sync

Add `aperture adapter sync`.

Acceptance criteria:

- Sync creates missing Codex, Claude, Cursor, and Copilot files.
- Sync updates managed sections without overwriting user sections.
- Sync is idempotent.
- Sync reports changed, unchanged, skipped, and conflicted files.
- End-to-end tests cover fresh apps, partially edited apps, repeated sync,
  and no-clobber behavior.

## Global Acceptance Criteria

- All CLI commands and subcommands have help output, useful error messages, and
  deterministic exit codes.
- Every CLI command has automated end-to-end coverage through a temp workspace.
- Every MCP tool has automated end-to-end coverage through an MCP stdio client
  harness.
- Browser-dependent E2E tests prove managed browser launch, reconnect, reload,
  screenshot, logs, input, camera, ECS, render, and teardown behavior.
- The generated app from `aperture create` passes install, typecheck, build,
  dev startup, WebGPU readiness, MCP browser tools, MCP ECS tools, MCP input
  tools, MCP camera tools, MCP render tools, and reference tools.
- Tests cover stale sessions, missing sessions, invalid app roots, unavailable
  WebGPU, port conflicts, bridge disconnects, browser crashes, and worker
  startup failures.
- Production builds do not include the devtools bridge unless explicitly
  enabled for development.
- `@aperture-engine/simulation` remains headless-safe.
- `@aperture-engine/render` remains WebGPU-free.
- The Vite plugin remains the integration point for generated browser/worker
  modules.
- No hidden scene graph is introduced.
- Documentation explains which tools mutate state and how to restore state.

## Recommended First Slice

Start with the smallest useful end-to-end vertical slice:

1. Add `@aperture-engine/cli` and `aperture create`.
2. Scaffold one AI-enabled starter app.
3. Add `aperture dev up/status/down`.
4. Add `aperture mcp stdio`.
5. Expose browser status, screenshot, console logs, and the existing ECS
   find/get/snapshot/diff tools through MCP.
6. Add E2E coverage for the full slice.

That slice proves the packaging, managed browser, session discovery, MCP
transport, app bridge, and worker bridge before adding camera, input, render,
and reference depth.
