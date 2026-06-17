import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readGeneratedStatus,
  type AperturePage,
} from "../../packages/cli/src/tools/browser.js";

describe("browser status DOM state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports pointer-lock target state for managed pages", async () => {
    const canvas = {
      tagName: "CANVAS",
      id: "aperture",
    };
    vi.stubGlobal("location", { href: "http://127.0.0.1:5173/" });
    vi.stubGlobal("__APERTURE_MCP_MANAGED__", true);
    vi.stubGlobal("__APERTURE_GENERATED_APP__", {
      status: "running",
      webgpuOk: true,
    });
    vi.stubGlobal("document", {
      pointerLockElement: canvas,
      querySelector: vi.fn(() => canvas),
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

    await expect(readGeneratedStatus(page)).resolves.toMatchObject({
      url: "http://127.0.0.1:5173/",
      managed: true,
      status: {
        status: "running",
        webgpuOk: true,
      },
      dom: {
        pointerLock: {
          locked: true,
          canvasLocked: true,
          target: {
            tagName: "canvas",
            id: "aperture",
          },
        },
      },
    });
  });
});
