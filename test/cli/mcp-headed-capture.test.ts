import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import { ApertureToolClient } from "../../packages/cli/src/tools/client.js";

const tempRoots: string[] = [];
const managers: ApertureMcpSessionManager[] = [];

afterEach(async () => {
  for (const manager of managers.splice(0)) await manager.dispose();
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

// These tests cover the existing headed capture contract, not exact-size
// rendering support (#70). No browser is launched. The PNG header is a mock
// dimension-parser input, not a complete image or evidence about GPU pixels.
describe("MCP headed capture size contract", () => {
  it("advertises that output dimensions are only set on the headless target", () => {
    const { manager } = fixture();
    const tool = manager
      .toolDefinitions()
      .find((definition) => definition.name === "frame_capture");
    expect(tool?.description).toContain(
      "width/height set the render size on the headless target",
    );
    expect(tool?.description).toContain(
      "headed target captures the live canvas at its natural size",
    );
  });

  it("returns natural PNG dimensions and discloses an unapplied request", async () => {
    const { manager, calls } = fixture();
    const result = await manager.call({
      name: "frame_capture",
      args: { target: "headed", width: 480, height: 320, includeData: true },
    });

    expect(result).toMatchObject({
      ok: true,
      target: "headed",
      mode: "headed",
      source: "live-browser-canvas",
      dimensions: { width: 960, height: 640 },
      data: dimensionHeader().toString("base64"),
      diagnostics: [
        {
          code: "aperture.mcp.frameCaptureSizeIgnored",
          severity: "info",
          message: expect.stringContaining(
            "the requested 480x320 was not applied",
          ),
        },
      ],
    });
    // The adapter receives no resize command or dimensions. This is an
    // intentional capability boundary, not a successful exact-size render.
    expect(calls.mock.calls.map(([call]) => call.name)).toEqual([
      "browser_screenshot",
      "browser_canvas_status",
      "render_get_frame_report",
    ]);
    expect(calls.mock.calls[0]?.[0].arguments).toEqual({
      outputPath: undefined,
      includeData: true,
      region: "canvas",
    });
  });

  it.each([{}, { width: 960 }, { height: 640 }, { width: 960, height: 640 }])(
    "does not warn when the request matches the natural PNG size: %j",
    async (size) => {
      const { manager } = fixture();
      await expect(
        manager.call({
          name: "frame_capture",
          args: { target: "headed", ...size },
        }),
      ).resolves.toMatchObject({
        ok: true,
        dimensions: { width: 960, height: 640 },
        diagnostics: [],
      });
    },
  );

  it.each([{ width: 480 }, { height: 320 }, { width: 960, height: 320 }])(
    "discloses a mismatch in any requested dimension: %j",
    async (size) => {
      const { manager } = fixture();
      await expect(
        manager.call({
          name: "frame_capture",
          args: { target: "headed", ...size },
        }),
      ).resolves.toMatchObject({
        ok: true,
        dimensions: { width: 960, height: 640 },
        diagnostics: [
          expect.objectContaining({
            code: "aperture.mcp.frameCaptureSizeIgnored",
            message: expect.stringContaining('Use target: "headless"'),
          }),
        ],
      });
    },
  );

  it("keeps PNG, render backing, and CSS viewport dimensions distinct", async () => {
    const { manager } = fixture();
    await expect(
      manager.call({
        name: "frame_capture",
        args: { target: "headed", width: 960, height: 640, region: "viewport" },
      }),
    ).resolves.toMatchObject({
      ok: true,
      dimensions: { width: 960, height: 640 },
      canvas: { width: 1920, height: 1280 },
      viewport: { width: 480, height: 320, pixelRatio: 4 },
      renderTarget: { width: 1920, height: 1280 },
      diagnostics: [],
    });
  });

  it("checks file-only captures without fabricating inline image data", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aperture-headed-size-"));
    tempRoots.push(root);
    const out = path.join(root, "capture.png");
    await writeFile(out, dimensionHeader());
    const { manager, calls } = fixture({ ok: true, path: out });

    const result = await manager.call({
      name: "frame_capture",
      args: { target: "headed", width: 480, height: 320, out },
    });
    expect(result).toMatchObject({
      ok: true,
      path: out,
      pngPath: out,
      dimensions: { width: 960, height: 640 },
      diagnostics: [
        expect.objectContaining({
          code: "aperture.mcp.frameCaptureSizeIgnored",
        }),
      ],
    });
    expect(result).not.toHaveProperty("data");
    expect(calls.mock.calls[0]?.[0].arguments).toMatchObject({
      outputPath: out,
      includeData: false,
    });
  });

  it("preserves readiness failure and never captures an unready canvas", async () => {
    const { manager, calls } = fixture();
    calls.mockResolvedValueOnce({
      ok: false,
      diagnostic: { code: "aperture.mcp.webgpuUnavailable" },
    });
    await expect(
      manager.call({
        name: "frame_capture",
        args: {
          target: "headed",
          width: 480,
          height: 320,
          waitUntilReady: true,
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.mcp.webgpuUnavailable" }],
    });
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls.mock.calls[0]?.[0].name).toBe("browser_wait_for_webgpu");
  });
});

function fixture(
  screenshot: unknown = {
    ok: true,
    data: dimensionHeader().toString("base64"),
    encoding: "base64",
    mimeType: "image/png",
  },
) {
  const calls = vi
    .spyOn(ApertureToolClient.prototype, "call")
    .mockImplementation(async ({ name }) => {
      if (name === "browser_screenshot") return screenshot;
      if (name === "browser_canvas_status") {
        return {
          ok: true,
          status: {
            canvas: {
              width: 1920,
              height: 1280,
              displayWidth: 480,
              displayHeight: 320,
              pixelRatio: 4,
            },
            renderTarget: { width: 1920, height: 1280 },
          },
        };
      }
      if (name === "render_get_frame_report") return { ok: true };
      throw new Error(`Unexpected browser operation: ${name}`);
    });
  const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
  managers.push(manager);
  return { manager, calls };
}

function dimensionHeader(): Buffer {
  const header = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(header);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(960, 16);
  header.writeUInt32BE(640, 20);
  return header;
}
