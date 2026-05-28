import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import { readGeneratedCanvasSamples } from "./canvas-readback.js";
import { pickGeneratedBrowserEntity } from "./picking.js";
import type { GeneratedBrowserDevtoolsToolResult } from "./types.js";

export async function callGeneratedBrowserDevtoolsTool(input: {
  readonly tool: string;
  readonly payload: unknown;
  readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
}): Promise<GeneratedBrowserDevtoolsToolResult | null> {
  if (input.tool === "browser_pick_pixel") {
    const readback = await readGeneratedCanvasSamples(input.payload);

    return {
      ok: readback.ok,
      result: {
        sample: readback.samples[0] ?? null,
        readback,
      },
      diagnostics: readback.diagnostics,
    };
  }

  if (input.tool === "render_readback_samples") {
    const readback = await readGeneratedCanvasSamples(input.payload);

    return {
      ok: readback.ok,
      result: readback,
      diagnostics: readback.diagnostics,
    };
  }

  if (input.tool === "render_pick_entity") {
    return pickGeneratedBrowserEntity(input.getWebGpuResult(), input.payload);
  }

  return null;
}
