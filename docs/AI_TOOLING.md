# Aperture AI Tooling

Aperture apps can expose a local AI tooling surface during development through
the `@aperture-engine/cli` package. The tooling is intentionally dev-only:
production app bundles should not include the browser bridge unless the Vite
plugin is running in development with AI mode enabled.

## CLI Flow

Create an app:

```sh
npx @aperture-engine/cli create my-app
```

Run a managed dev session from an Aperture app root:

```sh
pnpm exec aperture dev up --headless
pnpm exec aperture dev status
pnpm exec aperture mcp stdio
pnpm exec aperture dev down
```

Useful supporting commands:

```sh
pnpm exec aperture dev logs
pnpm exec aperture adapter sync
pnpm exec aperture reference build
pnpm exec aperture reference search createSystem
```

`aperture dev up` starts Vite, launches a managed Playwright browser, and writes
`.aperture/runtime/session.json`. MCP tools use that session file rather than
hard-coded ports.

## State Ownership

The tools do not introduce a scene graph. ECS remains the source of truth,
rendering remains a derived view of ECS snapshots, and browser/WebGPU logic
stays in dev tooling paths.

Reference tools are read-only and work without a running app. Browser, ECS,
input, camera, and render tools require an active managed dev session.

## Mutating Tools

Most tools only inspect state. These tools intentionally change development
state:

- `ecs_set_component_field`: mutates allowlisted ECS component fields only.
  The initial allowlist is `aperture.metadata.debug.tag` and
  `aperture.metadata.debug.note`. Unsupported components, unsupported fields,
  stale entity refs, missing components, and invalid value types return
  structured diagnostics.
- `ecs_pause`, `ecs_resume`, `ecs_step`: change simulation control state in the
  generated worker.
- `input_key`, `input_pointer_move`, `input_pointer_click`, `input_drag`,
  `input_action_set`, `input_reset`: drive the same generated input path used
  by real browser events.
- `camera_create_agent`, `camera_set_transform`, `camera_look_at`,
  `camera_orbit`, `camera_fit_entity`, `camera_use_agent_view`: create or
  mutate camera entities for inspection in the managed browser.
- `camera_save` and `camera_restore`: store and restore camera state in the
  devtools session.
- `browser_reload`: reloads the managed page but does not directly mutate ECS.

## Restoring State

For camera inspection, call `camera_save` before changing a camera and
`camera_restore` when finished. Prefer creating an agent camera with
`camera_create_agent` and switching the managed browser to it with
`camera_use_agent_view` instead of modifying a user-authored app camera.

For input inspection, call `input_reset` after pointer or action experiments to
release transient input state.

For ECS edits, use `ecs_snapshot` before mutation and `ecs_diff` after mutation
to make changes explicit. There is no broad ECS undo tool; use app systems or a
fresh dev session when a mutation should be discarded.
