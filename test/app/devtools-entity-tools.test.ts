import { describe, expect, it } from "vitest";

import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createGeneratedEntityToolBridge } from "@aperture-engine/app/headless-tools";

// Regression coverage for the entity devtools tools' selector strictness:
//   F3 — ecs_get_entity resolves { key } directly and does not silently fall
//        back to the last query's first result.
//   F4 — ecs_query accepts a singular `tag` string and warns on unknown
//        filter keys instead of returning everything.

class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.mesh({
      key: "player",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [0, 0, 0] },
    });
    this.spawn.mesh({
      key: "coin.0",
      tags: ["coin"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [1, 0, 0] },
    });
    this.spawn.mesh({
      key: "coin.1",
      tags: ["coin"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [2, 0, 0] },
    });
    this.spawn.mesh({
      key: "enemy",
      tags: ["hazard"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [3, 0, 0] },
    });
  }
}

async function createBridge() {
  const runner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [{ default: SetupSystem }],
  });
  if (runner.app.preload) {
    await runner.app.preload;
  }
  runner.step(1 / 60, 0);
  return createGeneratedEntityToolBridge(runner.app.lowLevel.world);
}

describe("devtools entity tool selectors", () => {
  it("resolves ecs_get_entity by key regardless of the last query (F3)", async () => {
    const bridge = await createBridge();

    // Prime the last-find cache with a different entity.
    bridge.call("ecs_query", { key: "enemy" });

    const result = bridge.call("ecs_get_entity", { key: "player" }) as {
      ok: boolean;
      result?: { summary?: { key?: string } };
    };

    expect(result.ok).toBe(true);
    expect(result.result?.summary?.key).toBe("player");
  });

  it("errors (does not silently mis-resolve) on an unknown key (F3)", async () => {
    const bridge = await createBridge();
    bridge.call("ecs_query", { key: "enemy" });

    const result = bridge.call("ecs_get_entity", {
      key: "does-not-exist",
    }) as {
      ok: boolean;
      diagnostics?: readonly { code?: string }[];
      result?: { diagnostic?: { code?: string } };
    };

    expect(result.ok).toBe(false);
    const code =
      result.diagnostics?.[0]?.code ?? result.result?.diagnostic?.code;
    expect(code).toBe("aperture.entityTools.entitySelectorNotFound");
  });

  it("filters ecs_query by a singular `tag` string (F4)", async () => {
    const bridge = await createBridge();

    const result = bridge.call("ecs_query", { tag: "coin" }) as {
      result?: { summaries?: readonly { key?: string }[] };
    };
    const keys = (result.result?.summaries ?? [])
      .map((summary) => summary.key)
      .sort();

    expect(keys).toEqual(["coin.0", "coin.1"]);
  });

  it("rejects an unrecognized query filter key (F4)", async () => {
    const bridge = await createBridge();

    const result = bridge.call("ecs_query", { tagz: "coin" }) as {
      ok?: boolean;
      diagnostics?: readonly { code?: string }[];
    };

    expect(result.ok).toBe(false);
    expect(
      (result.diagnostics ?? []).map((diagnostic) => diagnostic.code),
    ).toContain("aperture.entityTools.unknownQueryFilter");
  });
});
