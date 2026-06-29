import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readGeneratedStatus,
  screenshot,
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

  it("clips screenshots to the canvas region", async () => {
    class CanvasElement {
      getBoundingClientRect(): {
        readonly left: number;
        readonly top: number;
        readonly width: number;
        readonly height: number;
      } {
        return { left: 10, top: 20, width: 320, height: 180 };
      }
    }

    const canvas = new CanvasElement();
    const screenshotMock = vi.fn(async () => Buffer.from([1, 2, 3]));

    vi.stubGlobal("HTMLCanvasElement", CanvasElement);
    vi.stubGlobal("window", { scrollX: 4, scrollY: 8 });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => canvas),
    });

    const page = {
      screenshot: screenshotMock,
      async evaluate<R, A>(
        fn: string | ((arg: A) => R | Promise<R>),
        arg?: A,
      ): Promise<R> {
        if (typeof fn === "string") {
          throw new Error("string evaluation is not used in this test");
        }
        return fn(arg as A);
      },
    } as Pick<AperturePage, "evaluate" | "screenshot"> as AperturePage;

    await expect(
      screenshot(page, { includeData: true, region: "canvas" }),
    ).resolves.toMatchObject({
      ok: true,
      region: "canvas",
      clip: { x: 14, y: 28, width: 320, height: 180 },
      byteLength: 3,
      includeData: true,
      data: Buffer.from([1, 2, 3]).toString("base64"),
    });
    expect(screenshotMock).toHaveBeenCalledWith({
      type: "png",
      clip: { x: 14, y: 28, width: 320, height: 180 },
    });
  });
});
