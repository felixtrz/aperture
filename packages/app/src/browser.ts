import {
  createSimulationWorker,
  type SimulationWorker,
  type SimulationWorkerErrorEvent,
  type SimulationWorkerSnapshotEvent,
  type SimulationWorkerEntry,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  createWebGpuApp,
  type CreateWebGpuAppResult,
  type WebGpuCanvasLike,
} from "@aperture-engine/webgpu";
import { mirrorSourceAssetRegistryFromMessage } from "./asset-mirror.js";
import { defineApertureConfig, type ApertureConfig } from "./config.js";
import {
  createGeneratedInputEventMessage,
  type ApertureGeneratedInputEvent,
} from "./input.js";
import {
  APERTURE_GENERATED_COMMAND_EVENT,
  APERTURE_DEVTOOLS_PROTOCOL_VERSION,
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
  createApertureDevtoolsResponse,
  createApertureDevtoolsRequest,
  createGeneratedCommandMessage,
  isApertureDevtoolsResponse,
  parseGeneratedCommand,
  type ApertureDevtoolsResponse,
  type ApertureGeneratedCommand,
  type ApertureViewportResizeCommandPayload,
} from "./commands.js";
import {
  createApertureGeneratedDiagnosticsStatus,
  type ApertureGeneratedDiagnosticsStatus,
} from "./diagnostics.js";

export interface GeneratedBrowserSystemManifestEntry {
  readonly moduleUrl: string;
  readonly hasDefaultExport: boolean;
  readonly schedule: {
    readonly priority: number;
  };
}

export interface StartGeneratedBrowserAppOptions {
  readonly config: ApertureConfig;
  readonly workerEntry: SimulationWorkerEntry;
  readonly systemManifest?: readonly GeneratedBrowserSystemManifestEntry[];
  readonly devtools?: {
    readonly enabled?: boolean;
  };
  readonly workerFactory?: (
    entry: string | URL,
    options?: WorkerOptions,
  ) => Worker;
}

export interface GeneratedBrowserApp {
  readonly worker: SimulationWorker;
  readonly webgpu: CreateWebGpuAppResult;
}

export interface GeneratedBrowserAppStatus {
  status: "starting" | "running" | "webgpu-failed" | "worker-error";
  webgpuOk: boolean | null;
  snapshots: number;
  mirroredSourceAssets: number;
  skippedSourceAssets: number;
  forwardedInputEvents: number;
  lastInputEvent: unknown;
  forwardedCommandEvents: number;
  lastCommandEvent: unknown;
  lastFrame: number | null;
  lastError: unknown;
  lastFailure: ApertureGeneratedDiagnosticsStatus | null;
  lastWorkerSummary: unknown;
  diagnostics: unknown;
  canvas: ApertureViewportResizeCommandPayload | null;
  systems: readonly GeneratedBrowserSystemManifestEntry[];
}

export const APERTURE_GENERATED_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
export const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";

export interface ApertureMcpRuntime {
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  callTool(tool: string, payload?: unknown): Promise<ApertureDevtoolsResponse>;
}

export function readGeneratedBrowserAppStatus(
  scope: object = globalThis,
): GeneratedBrowserAppStatus | null {
  const value = (scope as Record<string, unknown>)[
    APERTURE_GENERATED_STATUS_GLOBAL
  ];

  return isGeneratedBrowserAppStatus(value) ? value : null;
}

export async function startGeneratedBrowserApp(
  options: StartGeneratedBrowserAppOptions,
): Promise<GeneratedBrowserApp> {
  const config = defineApertureConfig(options.config);
  const canvas = resolveCanvas(config);
  const sourceAssets = new AssetRegistry();
  const status = installGeneratedStatus();
  status.systems = options.systemManifest ?? [];
  let webgpuResult: CreateWebGpuAppResult | null = null;
  const worker = createSimulationWorker(options.workerEntry, {
    workerOptions: { type: "module" },
    ...(options.workerFactory === undefined
      ? {}
      : { workerFactory: options.workerFactory }),
  });
  installGeneratedInputForwarding(canvas, worker, status);
  installGeneratedCommandForwarding(worker, status);
  if (options.devtools?.enabled === true) {
    installGeneratedDevtoolsRuntime({
      worker,
      getWebGpuResult: () => webgpuResult,
    });
  }
  installCanvasResizeSync(canvas, worker, status);
  const mirroredWorker = mirrorSimulationWorkerSourceAssets(
    worker,
    sourceAssets,
    status,
  );
  const webgpu = await createWebGpuApp({
    canvas: canvas as unknown as WebGpuCanvasLike,
    simulationWorker: mirroredWorker,
    sourceAssets,
    autoStart: true,
  });
  webgpuResult = webgpu;

  status.webgpuOk = webgpu.ok;
  status.status = webgpu.ok ? "running" : "webgpu-failed";
  status.diagnostics = webgpu.ok ? webgpu.app.getDiagnostics() : webgpu;
  if (webgpu.ok) {
    syncGeneratedDiagnostics(webgpu.app.getDiagnostics, status);
  }

  return {
    worker,
    webgpu,
  };
}

function syncGeneratedDiagnostics(
  getDiagnostics: () => unknown,
  status: GeneratedBrowserAppStatus,
): void {
  const sync = () => {
    status.diagnostics = getDiagnostics();
    requestAnimationFrame(sync);
  };

  requestAnimationFrame(sync);
}

function mirrorSimulationWorkerSourceAssets(
  worker: SimulationWorker,
  sourceAssets: AssetRegistry,
  status: GeneratedBrowserAppStatus,
): SimulationWorker {
  return {
    ...worker,
    onSnapshot(callback) {
      return worker.onSnapshot((event: SimulationWorkerSnapshotEvent) => {
        const mirror = mirrorSourceAssetRegistryFromMessage(
          sourceAssets,
          event.message,
        );
        status.snapshots += 1;
        status.lastFrame = event.frame;
        status.mirroredSourceAssets += mirror.mirrored;
        status.skippedSourceAssets += mirror.skipped;
        status.lastWorkerSummary =
          typeof event.message === "object" && event.message !== null
            ? ((event.message as { readonly workerSummary?: unknown })
                .workerSummary ?? null)
            : null;
        callback(event);
      });
    },
    onError(callback) {
      return worker.onError((event: SimulationWorkerErrorEvent) => {
        status.status = "worker-error";
        status.lastFailure = createApertureGeneratedDiagnosticsStatus({
          status: "failed",
          diagnostics: event.diagnostics ?? [
            {
              code: event.reason,
              severity: "error",
              message: event.message,
              worker: event.source,
              suggestedFix:
                "Inspect generated worker diagnostics and restart the app after fixing the reported issue.",
            },
          ],
        });
        status.lastError = status.lastFailure;
        callback(event);
      });
    },
  };
}

function installGeneratedStatus(): GeneratedBrowserAppStatus {
  const status: GeneratedBrowserAppStatus = {
    status: "starting",
    webgpuOk: null,
    snapshots: 0,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
    forwardedInputEvents: 0,
    lastInputEvent: null,
    forwardedCommandEvents: 0,
    lastCommandEvent: null,
    lastFrame: null,
    lastError: null,
    lastFailure: null,
    lastWorkerSummary: null,
    diagnostics: null,
    canvas: null,
    systems: [],
  };

  (globalThis as Record<string, unknown>)[APERTURE_GENERATED_STATUS_GLOBAL] =
    status;

  return status;
}

function isGeneratedBrowserAppStatus(
  value: unknown,
): value is GeneratedBrowserAppStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly status?: unknown }).status === "string" &&
    "snapshots" in value
  );
}

function installGeneratedCommandForwarding(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
): void {
  window.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, (event) => {
    const command = parseGeneratedCommand((event as CustomEvent).detail);

    if (command === null) {
      status.lastCommandEvent = invalidGeneratedCommandDiagnostic(
        (event as CustomEvent).detail,
      );
      status.lastFailure = createApertureGeneratedDiagnosticsStatus({
        status: "failed",
        diagnostics: [status.lastCommandEvent],
      });
      status.lastError = status.lastFailure;
      return;
    }

    forwardCommand(worker, status, command);
  });
}

function forwardCommand(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  command: ApertureGeneratedCommand,
): void {
  worker.postMessage(createGeneratedCommandMessage(command));
  status.forwardedCommandEvents += 1;
  status.lastCommandEvent = command;
}

function installGeneratedDevtoolsRuntime(input: {
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

function invalidGeneratedCommandDiagnostic(detail: unknown): {
  readonly code: string;
  readonly severity: "error";
  readonly message: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly suggestedFix: string;
} {
  return {
    code: "aperture.command.invalid",
    severity: "error",
    message: "Generated Aperture command events require a non-empty channel.",
    data: {
      event: APERTURE_GENERATED_COMMAND_EVENT,
      detail: jsonSafeValue(detail),
    },
    suggestedFix:
      "Dispatch aperture:command with detail { channel: 'your.channel', payload: { ... } }.",
  };
}

function installGeneratedInputForwarding(
  canvas: HTMLCanvasElement,
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
): void {
  if (!canvas.hasAttribute("tabindex")) {
    canvas.tabIndex = 0;
  }

  canvas.addEventListener("pointermove", (event) => {
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus();
    canvas.setPointerCapture?.(event.pointerId);
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: true,
    });
  });

  canvas.addEventListener("pointerup", (event) => {
    canvas.releasePointerCapture?.(event.pointerId);
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: false,
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    forwardInput(worker, status, {
      kind: "keyboard",
      key: event.code || event.key,
      pressed: true,
    });
  });

  window.addEventListener("keyup", (event) => {
    forwardInput(worker, status, {
      kind: "keyboard",
      key: event.code || event.key,
      pressed: false,
    });
  });
}

function forwardInput(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  event: ApertureGeneratedInputEvent,
): void {
  worker.postMessage(createGeneratedInputEventMessage(event));
  status.forwardedInputEvents += 1;
  status.lastInputEvent = event;
}

function pointerPosition(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): readonly [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width <= 0 ? 0 : (event.clientX - rect.left) / rect.width;
  const y = rect.height <= 0 ? 0 : (event.clientY - rect.top) / rect.height;

  return [clamp01(x), clamp01(y)];
}

function jsonSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
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

function resolveCanvas(config: ApertureConfig): HTMLCanvasElement {
  if (config.mode !== "browser") {
    throw new Error(
      "Generated browser bootstrap can only run configs with mode: 'browser'.",
    );
  }

  const selector = config.canvas;
  if (selector === undefined) {
    throw new Error("Browser Aperture config is missing canvas.");
  }

  const element = document.querySelector(selector);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(
      `Aperture canvas selector '${selector}' did not match a canvas element.`,
    );
  }

  return element;
}

function installCanvasResizeSync(
  canvas: HTMLCanvasElement,
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
): void {
  let lastSignature = "";

  const resize = () => {
    const resizeStatus = measureCanvasResize(canvas);
    const signature = [
      resizeStatus.width,
      resizeStatus.height,
      resizeStatus.displayWidth,
      resizeStatus.displayHeight,
      resizeStatus.pixelRatio,
    ].join(":");

    if (canvas.width !== resizeStatus.width) {
      canvas.width = resizeStatus.width;
    }

    if (canvas.height !== resizeStatus.height) {
      canvas.height = resizeStatus.height;
    }

    status.canvas = resizeStatus;

    if (signature !== lastSignature) {
      worker.postMessage(
        createGeneratedCommandMessage({
          channel: APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
          payload: resizeStatus,
        }),
      );
      lastSignature = signature;
    }
  };

  resize();

  if ("ResizeObserver" in globalThis) {
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return;
  }

  window.addEventListener("resize", resize);
}

function measureCanvasResize(
  canvas: HTMLCanvasElement,
): ApertureViewportResizeCommandPayload {
  const rect = canvas.getBoundingClientRect();
  const displayWidth = Math.max(
    1,
    rect.width > 0 ? rect.width : canvas.clientWidth,
  );
  const displayHeight = Math.max(
    1,
    rect.height > 0 ? rect.height : canvas.clientHeight,
  );
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(displayWidth * pixelRatio));
  const height = Math.max(1, Math.floor(displayHeight * pixelRatio));

  return {
    width,
    height,
    displayWidth,
    displayHeight,
    pixelRatio,
    aspect: displayWidth / displayHeight,
  };
}
