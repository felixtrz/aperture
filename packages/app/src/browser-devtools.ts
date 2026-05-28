import type { SimulationWorker } from "@aperture-engine/runtime";
import type { CreateWebGpuAppResult } from "@aperture-engine/webgpu";
import {
  APERTURE_DEVTOOLS_PROTOCOL_VERSION,
  createApertureDevtoolsRequest,
  createApertureDevtoolsResponse,
  isApertureDevtoolsResponse,
  type ApertureDevtoolsResponse,
} from "./commands.js";

export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";

export interface ApertureMcpRuntime {
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  callTool(tool: string, payload?: unknown): Promise<ApertureDevtoolsResponse>;
}

export function installGeneratedDevtoolsRuntime(input: {
  readonly worker: SimulationWorker;
  readonly getWebGpuResult: () => CreateWebGpuAppResult | null;
}): void {
  const scope = globalThis as Record<string, unknown>;

  if (scope[APERTURE_MCP_MANAGED_GLOBAL] !== true) {
    return;
  }

  let nextRequestId = 0;
  const pending = new Map<
    string,
    {
      readonly resolve: (response: ApertureDevtoolsResponse) => void;
      readonly reject: (error: Error) => void;
      readonly timeout: ReturnType<typeof setTimeout>;
    }
  >();

  input.worker.onMessage((message) => {
    if (!isApertureDevtoolsResponse(message)) {
      return;
    }

    const request = pending.get(message.requestId);
    if (request === undefined) {
      return;
    }

    clearTimeout(request.timeout);
    pending.delete(message.requestId);
    request.resolve(message);
  });

  const runtime: ApertureMcpRuntime = {
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    async callTool(tool, payload) {
      nextRequestId += 1;
      const requestId = `browser-${Date.now()}-${nextRequestId}`;
      const browserResult = await callGeneratedBrowserDevtoolsTool({
        tool,
        payload,
        getWebGpuResult: input.getWebGpuResult,
      });

      if (browserResult !== null) {
        return createApertureDevtoolsResponse({
          requestId,
          ok: browserResult.ok,
          ...(Object.prototype.hasOwnProperty.call(browserResult, "result")
            ? { result: browserResult.result }
            : {}),
          ...(browserResult.diagnostics === undefined
            ? {}
            : { diagnostics: browserResult.diagnostics }),
        });
      }

      return new Promise<ApertureDevtoolsResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Aperture devtools request '${tool}' timed out.`));
        }, 10_000);

        pending.set(requestId, {
          resolve,
          reject,
          timeout,
        });
        input.worker.postMessage(
          createApertureDevtoolsRequest({
            requestId,
            tool,
            payload,
          }),
        );
      });
    },
  };

  scope[APERTURE_MCP_RUNTIME_GLOBAL] = runtime;
}

interface GeneratedBrowserDevtoolsToolResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}

interface PixelSampleRequest {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly coordinateSpace: "auto" | "normalized" | "pixel";
}

async function callGeneratedBrowserDevtoolsTool(input: {
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

async function readGeneratedCanvasSamples(payload: unknown): Promise<{
  readonly ok: boolean;
  readonly width: number;
  readonly height: number;
  readonly samples: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly pixel: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  }[];
  readonly diagnostics: readonly unknown[];
}> {
  const canvas = document.querySelector("canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    return canvasReadbackFailure("aperture.render.canvasMissing", {
      message: "No HTML canvas was found for managed-browser pixel readback.",
    });
  }

  if (typeof createImageBitmap !== "function") {
    return canvasReadbackFailure("aperture.render.createImageBitmapMissing", {
      message:
        "This browser does not expose createImageBitmap for canvas readback.",
    });
  }

  const requestedSamples = pixelSampleRequestsFromPayload(payload);
  const dimensions = canvasDimensions(canvas);
  const diagnostics: unknown[] = [];
  const pixels = requestedSamples
    .map((sample) => {
      const pixel = pixelFromSample(dimensions, sample);

      if (pixel === null) {
        diagnostics.push({
          code: "aperture.render.readbackSampleOutOfBounds",
          severity: "error",
          message: `Readback sample '${sample.id}' is outside the ${dimensions.width}x${dimensions.height} canvas.`,
          data: sample,
        });
      }

      return pixel === null ? null : { sample, pixel };
    })
    .filter(
      (
        entry,
      ): entry is {
        readonly sample: PixelSampleRequest;
        readonly pixel: { readonly x: number; readonly y: number };
      } => entry !== null,
    );

  if (pixels.length === 0) {
    return {
      ok: false,
      width: dimensions.width,
      height: dimensions.height,
      samples: [],
      diagnostics,
    };
  }

  try {
    const bitmap = await createImageBitmap(canvas);

    try {
      const readbackCanvas =
        typeof OffscreenCanvas === "function"
          ? new OffscreenCanvas(bitmap.width, bitmap.height)
          : document.createElement("canvas");

      readbackCanvas.width = bitmap.width;
      readbackCanvas.height = bitmap.height;

      const context = readbackCanvas.getContext("2d", {
        willReadFrequently: true,
      }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

      if (context === null) {
        return canvasReadbackFailure("aperture.render.readbackContextMissing", {
          width: dimensions.width,
          height: dimensions.height,
          message: "Could not create a 2D canvas context for pixel readback.",
        });
      }

      context.drawImage(bitmap, 0, 0);

      return {
        ok: diagnostics.length === 0,
        width: dimensions.width,
        height: dimensions.height,
        samples: pixels.map(({ sample, pixel }) => {
          const rgba = context.getImageData(pixel.x, pixel.y, 1, 1).data;

          return {
            id: sample.id,
            x: pixel.x,
            y: pixel.y,
            pixel: {
              r: rgba[0] ?? 0,
              g: rgba[1] ?? 0,
              b: rgba[2] ?? 0,
              a: rgba[3] ?? 0,
            },
          };
        }),
        diagnostics,
      };
    } finally {
      bitmap.close();
    }
  } catch (error: unknown) {
    return canvasReadbackFailure("aperture.render.readbackFailed", {
      width: dimensions.width,
      height: dimensions.height,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function pickGeneratedBrowserEntity(
  webgpuResult: CreateWebGpuAppResult | null,
  payload: unknown,
): Promise<GeneratedBrowserDevtoolsToolResult> {
  if (webgpuResult === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.render.webgpuNotReady",
          severity: "error",
          message: "WebGPU has not finished initializing in this managed tab.",
        },
      ],
    };
  }

  if (!webgpuResult.ok) {
    return {
      ok: false,
      result: webgpuResult,
      diagnostics: [
        {
          code: "aperture.render.webgpuUnavailable",
          severity: "error",
          message:
            "WebGPU initialization failed, so entity picking is unavailable.",
        },
      ],
    };
  }

  const request = pixelSampleRequestsFromPayload(payload)[0] ?? {
    id: "pick",
    x: 0.5,
    y: 0.5,
    coordinateSpace: "normalized" as const,
  };
  const canvas = document.querySelector("canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.render.canvasMissing",
          severity: "error",
          message: "No HTML canvas was found for managed-browser entity pick.",
        },
      ],
    };
  }

  const dimensions = canvasDimensions(canvas);
  const pixel = pixelFromSample(dimensions, request);

  if (pixel === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.render.pickOutOfBounds",
          severity: "error",
          message: `Pick point is outside the ${dimensions.width}x${dimensions.height} canvas.`,
          data: request,
        },
      ],
    };
  }

  const entity = await webgpuResult.app.pick(pixel.x, pixel.y);
  const diagnostics = webgpuDiagnosticsArray(
    webgpuResult.app.getDiagnostics(),
    "lastPick",
  );

  return {
    ok: entity !== null && diagnostics.length === 0,
    result: {
      entity,
      x: pixel.x,
      y: pixel.y,
      pick: webgpuDiagnosticValue(
        webgpuResult.app.getDiagnostics(),
        "lastPick",
      ),
    },
    diagnostics,
  };
}

function canvasReadbackFailure(
  code: string,
  data: Readonly<Record<string, unknown>>,
): {
  readonly ok: false;
  readonly width: number;
  readonly height: number;
  readonly samples: readonly [];
  readonly diagnostics: readonly unknown[];
} {
  return {
    ok: false,
    width: numberFromValue(data["width"]) ?? 0,
    height: numberFromValue(data["height"]) ?? 0,
    samples: [],
    diagnostics: [
      {
        code,
        severity: "error",
        message: String(data["message"] ?? code),
        data,
      },
    ],
  };
}

function pixelSampleRequestsFromPayload(
  payload: unknown,
): readonly PixelSampleRequest[] {
  const record = isRecord(payload) ? payload : {};
  const samples = Array.isArray(record["samples"]) ? record["samples"] : null;

  if (samples !== null && samples.length > 0) {
    return samples.map((sample, index) =>
      pixelSampleRequestFromValue(sample, index),
    );
  }

  return [pixelSampleRequestFromValue(record, 0)];
}

function pixelSampleRequestFromValue(
  value: unknown,
  index: number,
): PixelSampleRequest {
  const record = isRecord(value) ? value : {};
  const coordinateSpace = stringFromValue(record["coordinateSpace"]);

  return {
    id: stringFromValue(record["id"]) ?? `sample-${index + 1}`,
    x: numberFromValue(record["x"]) ?? 0.5,
    y: numberFromValue(record["y"]) ?? 0.5,
    coordinateSpace:
      coordinateSpace === "pixel" || coordinateSpace === "normalized"
        ? coordinateSpace
        : "auto",
  };
}

function pixelFromSample(
  dimensions: { readonly width: number; readonly height: number },
  sample: PixelSampleRequest,
): { readonly x: number; readonly y: number } | null {
  const usePixelCoordinates =
    sample.coordinateSpace === "pixel" ||
    (sample.coordinateSpace === "auto" &&
      (Math.abs(sample.x) > 1 || Math.abs(sample.y) > 1));
  const x = usePixelCoordinates
    ? Math.floor(sample.x)
    : Math.round(clamp01(sample.x) * Math.max(0, dimensions.width - 1));
  const y = usePixelCoordinates
    ? Math.floor(sample.y)
    : Math.round(clamp01(sample.y) * Math.max(0, dimensions.height - 1));

  if (x < 0 || y < 0 || x >= dimensions.width || y >= dimensions.height) {
    return null;
  }

  return { x, y };
}

function canvasDimensions(canvas: {
  readonly width: number;
  readonly height: number;
}): { readonly width: number; readonly height: number } {
  return {
    width: Math.max(1, Math.floor(canvas.width)),
    height: Math.max(1, Math.floor(canvas.height)),
  };
}

function webgpuDiagnosticsArray(
  diagnostics: unknown,
  key: string,
): readonly unknown[] {
  const value = webgpuDiagnosticValue(diagnostics, key);
  const nested = isRecord(value) ? value["diagnostics"] : undefined;

  return Array.isArray(nested) ? nested : [];
}

function webgpuDiagnosticValue(diagnostics: unknown, key: string): unknown {
  return isRecord(diagnostics) ? diagnostics[key] : null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFromValue(value: unknown): number | undefined {
  return Number.isFinite(value) ? (value as number) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
