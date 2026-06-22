import { afterEach, describe, expect, it, vi } from "vitest";

import { renderExplainEntity } from "../../packages/cli/src/tools/render.js";
import type { AperturePage } from "../../packages/cli/src/tools/browser.js";
import { RENDER_DIAGNOSTICS_PROPERTY } from "../../packages/cli/src/tools/types.js";

describe("render CLI tools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves render_explain_entity through the runtime bridge without retained status entities", async () => {
    vi.stubGlobal("__APERTURE_MCP_RUNTIME__", {
      async callTool(tool: string, payload?: unknown) {
        expect(tool).toBe("ecs_find_entities");
        expect(payload).toEqual({ key: "level.crate.primary", limit: 1 });

        return {
          ok: true,
          result: {
            total: 1,
            summaries: [
              {
                key: "level.crate.primary",
                entity: { index: 12, generation: 1 },
              },
            ],
          },
          diagnostics: [],
        };
      },
    });
    vi.stubGlobal("__APERTURE_GENERATED_APP__", {
      [RENDER_DIAGNOSTICS_PROPERTY]: {
        getDiagnostics() {
          return {
            lastFrame: {
              frame: 7,
              counts: { meshDraws: 1 },
              renderChangeSet: {
                keys: {
                  meshDraws: {
                    changed: [],
                    unchanged: ["mesh-draw:12"],
                  },
                  bounds: {
                    changed: [],
                    unchanged: ["bounds:12:1"],
                  },
                },
              },
              diagnostics: [],
            },
          };
        },
      },
      diagnostics: {
        lastFrame: {
          frame: 7,
          counts: { meshDraws: 1 },
          renderChangeSet: {
            keys: {
              meshDraws: {
                changed: { count: 0, sample: [], omitted: 0 },
                unchanged: { count: 1, sample: [], omitted: 1 },
              },
              bounds: {
                changed: { count: 0, sample: [], omitted: 0 },
                unchanged: { count: 1, sample: [], omitted: 1 },
              },
            },
          },
          diagnostics: [],
        },
      },
      lastWorkerSummary: {
        particles: {},
      },
    });

    const page = {
      async evaluate<R, A>(
        fn: string | ((arg: A) => R | Promise<R>),
        arg?: A,
      ): Promise<R> {
        if (typeof fn === "string") {
          throw new Error("string evaluation is not used in this test");
        }

        return fn(arg as A);
      },
    } as Pick<AperturePage, "evaluate"> as AperturePage;

    await expect(
      renderExplainEntity(page, { key: "level.crate.primary" }),
    ).resolves.toEqual({
      ok: true,
      report: {
        entity: {
          key: "level.crate.primary",
          entity: { index: 12, generation: 1 },
        },
        rendered: true,
        hasBounds: true,
        renderKey: "mesh-draw:12",
        boundsKey: "bounds:12:1",
        frame: 7,
        counts: { meshDraws: 1 },
        diagnostics: [],
      },
    });
  });
});
