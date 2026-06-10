# Recipe: Spawn a glTF Scene

**Status:** reference

## Goal

Declare a GLB asset in `aperture.config.ts` and spawn it from a worker system
with `this.spawn.gltf(...)`, so the loaded scene renders without any
main-thread scene-graph code. Verify the asset loaded, the entities exist, and
the draws reach the GPU.

## Code

### 1. Declare the GLB asset in config

```ts
import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";
import { TOTAL_GEMS } from "./src/level.js";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    hero: asset.gltf("/assets/kenney/character-ooli.glb", {
      preload: "blocking",
    }),
    coin: asset.gltf("/assets/kenney/coin-gold.glb", {
      preload: "blocking",
    }),
    // … 14 more asset.gltf entries elided …
  },
  // signals, input, render, and diagnostics sections elided — see the source.
});
```

Source: `playground/aperture.config.ts` (excerpt; elisions marked).

`preload: "blocking"` keeps the asset out of the first simulation step until it
is decoded; `"background"` and `"manual"` are the other policies (see
`examples/developer-api/aperture.config.ts` for all three in one config).

### 2. Spawn the GLB from a system

The playground spawns every platform from its config-declared assets inside the
setup system's `init()`:

```ts
#spawnPlatforms(): void {
  for (const platform of LEVEL.platforms) {
    this.spawn.gltf(this.assets.gltf(platform.asset), {
      key: `level.platform.asset.${platform.key}`,
      name: `platform.asset.${platform.key}`,
      tags: ["platformAsset"],
      transform: {
        translation: platform.position,
        scale: platform.scale,
      },
    });
  }
}
```

Source: `playground/src/systems/setup.system.ts` (`#spawnPlatforms`).

A single spawn with rotation looks like the playground's hero spawn:

```ts
this.spawn.gltf(this.assets.gltf("hero"), {
  key: "player.hero.asset",
  name: "player.asset",
  tags: ["playerAsset"],
  transform: {
    translation: [PLAYER.start[0], PLAYER.start[1], -0.05],
    scale: PLAYER.assetScale,
    rotationEulerDegrees: [0, 20, 0],
  },
});
```

Source: `playground/src/systems/setup.system.ts` (`#spawnPlayer`).

The same shape is used by the e2e-verified developer-api example app:

```ts
this.spawn.gltf(this.assets.gltf("robot"), {
  key: "level.robot",
  name: "robot",
  tags: ["asset", "robot"],
  transform: { translation: [1, 0, 0] },
});
```

Source: `examples/developer-api/src/systems/setup.system.ts`.

## Verify

The following tool calls were recorded against `examples/developer-api` (asset
id `robot`, key `level.robot`) by the committed e2e suite. Against the
playground, substitute its ids (asset `hero`, key `player.hero.asset`, or
`level.platform.asset.*`).

1. The asset is configured and ready:

```ts
const cliAssets = JSON.parse(
  (await runCli(["tool", "asset_list"])).stdout,
) as unknown;
expect(cliAssets).toMatchObject({
  ok: true,
  result: {
    assets: expect.arrayContaining([
      expect.objectContaining({
        id: "robot",
        kind: "gltf",
        ready: true,
      }),
    ]),
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` ("Aperture CLI manages a browser
session and exposes browser/ECS tools over MCP").

2. The spawned entities exist, carry mesh/material components, and trace back
   to the asset id:

```ts
const sourceFind = await callMcpTool("ecs_find_entities", {
  source: { assetId: "robot" },
  withComponents: ["aperture.render.mesh", "aperture.render.material"],
  limit: 5,
});
expect(sourceFind.structuredContent).toMatchObject({
  ok: true,
  result: {
    summaries: expect.arrayContaining([
      expect.objectContaining({
        componentIds: expect.arrayContaining([
          "aperture.render.mesh",
          "aperture.render.material",
        ]),
        source: expect.objectContaining({
          assetId: "robot",
        }),
      }),
    ]),
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test).

3. The entity actually renders:

```ts
const renderExplain = await callMcpTool("render_explain_entity", {
  key: "level.crate.primary",
});
expect(renderExplain.structuredContent).toMatchObject({
  ok: true,
  report: {
    entity: expect.objectContaining({
      key: "level.crate.primary",
    }),
    rendered: true,
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test; pass your spawn `key`
instead of `level.crate.primary`).

4. Frame-level proof that draws are flowing:

```ts
const frame = await callMcpTool("render_get_frame_report", {});
expect(frame.structuredContent).toMatchObject({
  ok: true,
  report: {
    lastFrame: {
      counts: {
        views: expect.any(Number),
        meshDraws: expect.any(Number),
      },
    },
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test). For a GLB scene expect
`meshDraws` ≥ 1 once the asset is `ready`.

From the command line the same calls are
`pnpm exec aperture tool asset_list`,
`pnpm exec aperture tool ecs_find_entities --json '{"source":{"assetId":"hero"}}'`,
`pnpm exec aperture tool render_explain_entity --json '{"key":"player.hero.asset"}'`,
and `pnpm exec aperture tool render_get_frame_report`.

## Revert / cleanup

Spawning is authoring-time code: remove the `spawn.gltf` call (or the config
asset entry) and reload. For runtime experiments, transform fields of the
spawned root can be mutated and restored through the
`ecs_snapshot` → `ecs_set_component_field` → `ecs_diff` loop — see
[inspect-mutate-verify-revert.md](./inspect-mutate-verify-revert.md).

Worked example: the playground level in `playground/GAME_PLAN.md` builds an
entire platformer level this way from Kenney GLB assets.
