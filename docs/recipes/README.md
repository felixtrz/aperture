# Aperture Task Recipes

**Status:** reference

End-to-end recipes for agents (and humans) building _with_ Aperture. Each
recipe follows the same shape:

1. **Goal** — what you are building.
2. **Code** — the `aperture.config.ts` and/or system code that does it.
3. **Verify** — the MCP/devtools `aperture tool ...` calls or committed test
   assertions that prove it worked, with the expected report fields.
4. **Revert / cleanup** — how to undo the change, where applicable.

Every code block in these recipes is lifted from a committed, passing test,
the playground app, or a committed example — never invented. Each block carries
a `Source:` line pointing at the file (and test name where helpful) it came
from. If a snippet is an excerpt, elisions are marked explicitly.

## Recipes

| Recipe                                                               | What it covers                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [spawn-gltf-scene.md](./spawn-gltf-scene.md)                         | Declare a GLB asset in config and spawn it from a system with `this.spawn.gltf`                        |
| [custom-wgsl-material.md](./custom-wgsl-material.md)                 | Author a custom WGSL material through the data-only spawn descriptors                                  |
| [physics-body-and-character.md](./physics-body-and-character.md)     | `spawn.mesh` with a physics descriptor (rigidBody + collider + velocity) and the character controller  |
| [hud-from-signals.md](./hud-from-signals.md)                         | Config signals written by worker systems and read by a DOM HUD                                         |
| [spatial-queries-from-systems.md](./spatial-queries-from-systems.md) | Raycast, overlap, and closest-point queries from a system via `this.spatial`                           |
| [inspect-mutate-verify-revert.md](./inspect-mutate-verify-revert.md) | The agent loop: `ecs_find_entities` → `ecs_snapshot` → `ecs_set_component_field` → `ecs_diff` → revert |

## The worked end-to-end example

[`playground/GAME_PLAN.md`](../../playground/GAME_PLAN.md) is the worked
example of the whole flow: it records how the playground platformer was
scaffolded with `aperture create`, planned against the warmed reference corpus,
built from config-declared GLB assets, signals, input actions, and worker
systems, and then verified with scripted managed-browser checks (WebGPU running
status, nonzero draw calls, input-driven state changes, and a playthrough that
reaches `runState: "clear"` with `gems === totalGems`). The recipes here are
the per-task slices of that same flow; the playground sources
(`playground/aperture.config.ts`, `playground/src/systems/*.system.ts`,
`playground/src/hud.ts`) are quoted throughout.

## Running the verification calls

The `Verify` sections use the managed dev session and tool surface documented
in [`docs/AI_TOOLING.md`](../AI_TOOLING.md):

```sh
pnpm exec aperture dev up --headless
pnpm exec aperture dev status
pnpm exec aperture tool browser_canvas_status
pnpm exec aperture tool asset_list
pnpm exec aperture mcp stdio
pnpm exec aperture dev down
```

Source: `docs/AI_TOOLING.md` (CLI Flow); exercised end-to-end by
`test/e2e/cli-ai-tools.spec.ts` ("Aperture CLI manages a browser session and
exposes browser/ECS tools over MCP").

`aperture tool <name> --json '<object>'` passes arguments to a tool; the same
contracts are exposed over MCP via `aperture mcp stdio`. Browser-backed tools
require an active managed dev session.

## Related docs

- [`docs/AUTHORING.md`](../AUTHORING.md) — the concept-level authoring guide
  these recipes complement.
- [`docs/AI_TOOLING.md`](../AI_TOOLING.md) — the tool surface, state-ownership
  rules, and restoring-state guidance used in the Verify/Revert sections.
- [`docs/DIAGNOSTICS_CATALOG.md`](../DIAGNOSTICS_CATALOG.md) — lookup table for
  every structured diagnostic `code` the tools can return.
