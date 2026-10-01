import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import { callGeneratedBrowserDevtoolsTool } from "../../packages/app/src/browser/devtools/dispatch.js";
import { pickGeneratedBrowserEntity } from "../../packages/app/src/browser/devtools/picking.js";
import {
  webgpuDiagnosticsArray,
  webgpuDiagnosticValue,
} from "../../packages/app/src/browser/devtools/webgpu-diagnostics.js";

class FakeCanvas {
  width = 9;
  height = 5;
}

function installPicking() {
  const canvas = new FakeCanvas();
  const querySelector = vi.fn(() => canvas as FakeCanvas | null);
  vi.stubGlobal("HTMLCanvasElement", FakeCanvas);
  vi.stubGlobal("document", { querySelector });
  const pick = vi.fn(
    async () =>
      ({ index: 8, generation: 3 }) as {
        index: number;
        generation: number;
      } | null,
  );
  const getDiagnostics = vi.fn(
    () => ({ lastPick: { diagnostics: [], draws: 2 } }) as unknown,
  );
  const postEffects = [
    { id: "bloom", label: "Bloom", enabled: true },
    { id: "tonemap", enabled: false },
    { id: "outline" },
  ];
  const setPostEffectEnabled = vi.fn((id: string, enabled: boolean) => {
    const effect = postEffects.find((candidate) => candidate.id === id);
    if (effect !== undefined) effect.enabled = enabled;
    return effect !== undefined;
  });
  // Only the API boundary consumed by dispatch is faked; no renderer or pixels
  // are claimed to have run by these orchestration tests.
  const webgpu = {
    ok: true,
    app: { pick, getDiagnostics, postEffects, setPostEffectEnabled },
  } as unknown as CreateWebGpuAppResult;
  return {
    canvas,
    querySelector,
    pick,
    getDiagnostics,
    postEffects,
    setPostEffectEnabled,
    webgpu,
  };
}

const failedWebgpu: CreateWebGpuAppResult = {
  ok: false,
  reason: "adapter-unavailable",
  message: "No adapter",
};

afterEach(() => vi.unstubAllGlobals());

describe("managed browser entity picking", () => {
  it("returns readiness and initialization diagnostics before touching the canvas", async () => {
    const fixture = installPicking();
    expect(await pickGeneratedBrowserEntity(null, {})).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.render.webgpuNotReady" }],
    });
    expect(await pickGeneratedBrowserEntity(failedWebgpu, {})).toMatchObject({
      ok: false,
      result: failedWebgpu,
      diagnostics: [{ code: "aperture.render.webgpuUnavailable" }],
    });
    expect(fixture.querySelector).not.toHaveBeenCalled();
    expect(fixture.pick).not.toHaveBeenCalled();
  });

  it("rejects missing canvases and out-of-bounds points without dispatching GPU work", async () => {
    const fixture = installPicking();
    fixture.querySelector.mockReturnValue(null);
    expect(await pickGeneratedBrowserEntity(fixture.webgpu, {})).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.render.canvasMissing" }],
    });
    fixture.querySelector.mockReturnValue(fixture.canvas);
    expect(
      await pickGeneratedBrowserEntity(fixture.webgpu, { x: -2, y: 0 }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.render.pickOutOfBounds" }],
    });
    expect(fixture.pick).not.toHaveBeenCalled();
  });

  it("picks only the first requested point and preserves renderer diagnostics", async () => {
    const fixture = installPicking();
    const result = await pickGeneratedBrowserEntity(fixture.webgpu, {
      samples: [
        { x: 1, y: 1, coordinateSpace: "normalized" },
        { x: 0, y: 0 },
      ],
    });
    expect(fixture.pick).toHaveBeenCalledExactlyOnceWith(8, 4);
    expect(result).toEqual({
      ok: true,
      result: {
        entity: { index: 8, generation: 3 },
        x: 8,
        y: 4,
        pick: { diagnostics: [], draws: 2 },
      },
      diagnostics: [],
    });
    fixture.getDiagnostics.mockReturnValue({
      lastPick: { diagnostics: [{ code: "readback-failed" }] },
    });
    expect(await pickGeneratedBrowserEntity(fixture.webgpu, {})).toMatchObject({
      ok: false,
      result: { entity: { index: 8, generation: 3 }, x: 4, y: 2 },
      diagnostics: [{ code: "readback-failed" }],
    });
    fixture.pick.mockResolvedValue(null);
    fixture.getDiagnostics.mockReturnValue(null);
    expect(await pickGeneratedBrowserEntity(fixture.webgpu, {})).toEqual({
      ok: false,
      result: { entity: null, x: 4, y: 2, pick: null },
      diagnostics: [],
    });
  });

  it("only extracts actual diagnostic arrays from nested renderer reports", () => {
    for (const value of [
      null,
      3,
      {},
      { lastPick: null },
      { lastPick: { diagnostics: "failed" } },
    ]) {
      expect(webgpuDiagnosticsArray(value, "lastPick")).toEqual([]);
    }
    expect(webgpuDiagnosticValue(undefined, "lastPick")).toBeNull();
    expect(webgpuDiagnosticValue({}, "lastPick")).toBeUndefined();
  });
});

describe("managed browser tool dispatch", () => {
  it("leaves worker tools untouched and routes browser entity picks locally", async () => {
    const fixture = installPicking();
    const getWebGpuResult = vi.fn(() => fixture.webgpu);
    expect(
      await callGeneratedBrowserDevtoolsTool({
        tool: "ecs_query",
        payload: {},
        getWebGpuResult,
      }),
    ).toBeNull();
    expect(getWebGpuResult).not.toHaveBeenCalled();
    expect(
      await callGeneratedBrowserDevtoolsTool({
        tool: "render_pick_entity",
        payload: {},
        getWebGpuResult,
      }),
    ).toMatchObject({ ok: true });
    expect(fixture.pick).toHaveBeenCalledExactlyOnceWith(4, 2);
  });

  it.each(["browser_pick_pixel", "render_readback_samples"])(
    "routes %s through readback and preserves its failure",
    async (tool) => {
      const fixture = installPicking();
      fixture.querySelector.mockReturnValue(null);
      const getWebGpuResult = vi.fn(() => fixture.webgpu);
      const result = await callGeneratedBrowserDevtoolsTool({
        tool,
        payload: {},
        getWebGpuResult,
      });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.render.canvasMissing" }],
      });
      if (tool === "browser_pick_pixel") {
        expect(result?.result).toMatchObject({
          sample: null,
          readback: { ok: false, samples: [] },
        });
      } else {
        expect(result?.result).toMatchObject({ ok: false, samples: [] });
      }
      expect(getWebGpuResult).not.toHaveBeenCalled();
    },
  );

  it("reports missing or failed renderer state before applying a post-effect toggle", async () => {
    for (const [webgpu, code] of [
      [null, "aperture.devtools.webgpuUnavailable"],
      [failedWebgpu, "aperture.devtools.webgpuFailed"],
    ] as const) {
      expect(
        await callGeneratedBrowserDevtoolsTool({
          tool: "render_set_post_effect_enabled",
          payload: { effectId: "bloom", enabled: false },
          getWebGpuResult: () => webgpu,
        }),
      ).toMatchObject({ ok: false, diagnostics: [{ code }] });
    }
  });

  it("rejects malformed toggle payloads and reports available effects for unknown ids", async () => {
    const fixture = installPicking();
    for (const payload of [
      null,
      "bloom",
      {},
      { enabled: true },
      { effectId: "", enabled: true },
      { effectId: "bloom", enabled: 1 },
    ]) {
      expect(
        await callGeneratedBrowserDevtoolsTool({
          tool: "render_set_post_effect_enabled",
          payload,
          getWebGpuResult: () => fixture.webgpu,
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.devtools.invalidPostEffectToggle" }],
      });
    }
    expect(
      await callGeneratedBrowserDevtoolsTool({
        tool: "render_set_post_effect_enabled",
        payload: { effectId: "missing", enabled: true },
        getWebGpuResult: () => fixture.webgpu,
      }),
    ).toMatchObject({
      ok: false,
      result: {
        postEffects: [
          { id: "bloom", label: "Bloom", enabled: true },
          { id: "tonemap", enabled: false },
          { id: "outline", enabled: true },
        ],
      },
      diagnostics: [
        { code: "aperture.devtools.postEffectNotFound", effectId: "missing" },
      ],
    });
    expect(fixture.setPostEffectEnabled).not.toHaveBeenCalled();
  });

  it("toggles an exact effect id or id alias and reports the updated state", async () => {
    const fixture = installPicking();
    for (const payload of [
      { effectId: "bloom", enabled: false },
      { id: "bloom", enabled: true },
    ]) {
      expect(
        await callGeneratedBrowserDevtoolsTool({
          tool: "render_set_post_effect_enabled",
          payload,
          getWebGpuResult: () => fixture.webgpu,
        }),
      ).toMatchObject({
        ok: true,
        result: {
          effectId: "bloom",
          enabled: payload.enabled,
          postEffects: [
            { id: "bloom", label: "Bloom", enabled: payload.enabled },
            { id: "tonemap", enabled: false },
            { id: "outline", enabled: true },
          ],
        },
      });
    }
    expect(fixture.setPostEffectEnabled.mock.calls).toEqual([
      ["bloom", false],
      ["bloom", true],
    ]);
  });
});
