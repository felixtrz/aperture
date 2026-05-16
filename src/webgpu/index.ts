export * from "./buffer.js";
export * from "./bind-group-layout-cache.js";
export * from "./clear.js";
export * from "./clear-readback.js";
export * from "./clear-compatibility.js";
export * from "./clear-parity.js";
export * from "./clear-parity-json.js";
export * from "./command-buffer.js";
export * from "./command-encoder.js";
export * from "./command-submission-metrics.js";
export * from "./current-texture-view.js";
export * from "./draw-command.js";
export * from "./environment-resource-planning.js";
export * from "./frame-boundary.js";
export * from "./frame-boundary-diagnostics.js";
export * from "./frame-boundary-diagnostics-merge.js";
export * from "./frame-boundary-json.js";
export * from "./frame-boundary-smoke.js";
export * from "./frame-boundary-validation.js";
export * from "./frame-execution-report.js";
export * from "./frame-submission-smoke.js";
export * from "./frame-report.js";
export * from "./render-frame-plan.js";
export * from "./frame-readiness.js";
export * from "./material-dependency-readiness.js";
export * from "./light-bind-group.js";
export * from "./light-bind-group-layout.js";
export * from "./light-packing.js";
export * from "./light-shader-metadata.js";
export * from "./lighting-resource-plan.js";
export * from "./mesh-buffer-descriptors.js";
export * from "./mesh-buffer-resources.js";
export * from "./mvp-frame-readiness.js";
export * from "./pipeline-cache.js";
export * from "./pipeline-cache-integration.js";
export * from "./queue-submit.js";
export * from "./resource-lifecycle.js";
export * from "./resource-keys.js";
export * from "./resource-summary.js";
export * from "./renderer-frame-summary.js";
export * from "./renderer-assembly-smoke.js";
export * from "./render-pass-attachments.js";
export * from "./render-pass-assembly-smoke.js";
export * from "./render-pass-command-executor.js";
export * from "./render-pass-draw-list.js";
export * from "./render-pass-commands.js";
export * from "./render-pass-lifecycle.js";
export * from "./render-pass-resources.js";
export * from "./shader-resource.js";
export * from "./shader.js";
export * from "./texture-resources.js";
export * from "./unlit-material-buffer.js";
export * from "./unlit-material-buffer-resource.js";
export * from "./unlit-bind-group-layout.js";
export * from "./unlit-bind-group.js";
export * from "./unlit-frame-resources.js";
export * from "./unlit-pipeline.js";
export * from "./unlit-pipeline-descriptor.js";
export * from "./unlit-shader.js";
export * from "./view-uniform-buffer.js";
export * from "./view-uniform-buffer-resource.js";
export * from "./world-transform-buffer.js";

export type WebGpuFailureReason =
  | "navigator-gpu-unavailable"
  | "adapter-unavailable"
  | "device-request-failed"
  | "context-unavailable"
  | "context-configure-failed"
  | "device-lost";

export interface WebGpuFailure {
  readonly ok: false;
  readonly reason: WebGpuFailureReason;
  readonly message: string;
  readonly cause?: unknown;
}

export interface WebGpuSupportSuccess {
  readonly ok: true;
  readonly gpu: WebGpuLike;
}

export type WebGpuSupportResult = WebGpuSupportSuccess | WebGpuFailure;

export interface WebGpuInitializationSuccess {
  readonly ok: true;
  readonly gpu: WebGpuLike;
  readonly adapter: WebGpuAdapterLike;
  readonly device: WebGpuDeviceLike;
  readonly context: WebGpuCanvasContextLike;
  readonly format: string;
  readonly deviceLost: Promise<WebGpuFailure> | null;
}

export type WebGpuInitializationResult =
  | WebGpuInitializationSuccess
  | WebGpuFailure;

export interface WebGpuEnvironment {
  readonly navigator?: WebGpuNavigatorLike;
}

export interface WebGpuNavigatorLike {
  readonly gpu?: WebGpuLike;
}

export interface WebGpuLike {
  requestAdapter(options?: unknown): Promise<WebGpuAdapterLike | null>;
  getPreferredCanvasFormat?: () => string;
}

export interface WebGpuAdapterLike {
  requestDevice(descriptor?: unknown): Promise<WebGpuDeviceLike>;
}

export interface WebGpuDeviceLostInfoLike {
  readonly reason?: string;
  readonly message?: string;
}

export interface WebGpuDeviceLike {
  readonly lost?: Promise<WebGpuDeviceLostInfoLike>;
}

export interface WebGpuCanvasLike {
  getContext(contextId: "webgpu"): WebGpuCanvasContextLike | null;
}

export interface WebGpuCanvasContextLike {
  configure(configuration: {
    readonly device: WebGpuDeviceLike;
    readonly format: string;
    readonly alphaMode?: "opaque" | "premultiplied";
    readonly usage?: number;
  }): void;
}

export interface InitializeWebGpuOptions {
  readonly environment?: WebGpuEnvironment;
  readonly canvas?: WebGpuCanvasLike;
  readonly context?: WebGpuCanvasContextLike;
  readonly adapterOptions?: unknown;
  readonly deviceDescriptor?: unknown;
  readonly alphaMode?: "opaque" | "premultiplied";
  readonly textureUsage?: number;
}

export const WEBGPU_FAILURE_MESSAGES: Record<WebGpuFailureReason, string> = {
  "navigator-gpu-unavailable":
    "WebGPU is unavailable because navigator.gpu is missing.",
  "adapter-unavailable": "WebGPU adapter request returned no adapter.",
  "device-request-failed": "WebGPU device request failed.",
  "context-unavailable": "WebGPU canvas context is unavailable.",
  "context-configure-failed": "WebGPU canvas context configuration failed.",
  "device-lost": "WebGPU device was lost.",
};

export function detectWebGpuSupport(
  environment: WebGpuEnvironment = defaultEnvironment(),
): WebGpuSupportResult {
  const gpu = environment.navigator?.gpu;

  if (gpu === undefined) {
    return failure("navigator-gpu-unavailable");
  }

  return { ok: true, gpu };
}

export async function initializeWebGpu(
  options: InitializeWebGpuOptions = {},
): Promise<WebGpuInitializationResult> {
  const support = detectWebGpuSupport(options.environment);

  if (!support.ok) {
    return support;
  }

  const adapter = await support.gpu.requestAdapter(options.adapterOptions);

  if (adapter === null) {
    return failure("adapter-unavailable");
  }

  let device: WebGpuDeviceLike;

  try {
    device = await adapter.requestDevice(options.deviceDescriptor);
  } catch (cause) {
    return failure("device-request-failed", cause);
  }

  const context =
    options.context ?? options.canvas?.getContext("webgpu") ?? null;

  if (context === null) {
    return failure("context-unavailable");
  }

  const format = support.gpu.getPreferredCanvasFormat?.() ?? "bgra8unorm";

  try {
    context.configure({
      device,
      format,
      alphaMode: options.alphaMode ?? "opaque",
      ...(options.textureUsage === undefined
        ? {}
        : { usage: options.textureUsage }),
    });
  } catch (cause) {
    return failure("context-configure-failed", cause);
  }

  return {
    ok: true,
    gpu: support.gpu,
    adapter,
    device,
    context,
    format,
    deviceLost:
      device.lost === undefined
        ? null
        : device.lost.then((info) =>
            failure(
              "device-lost",
              info,
              info.message ?? WEBGPU_FAILURE_MESSAGES["device-lost"],
            ),
          ),
  };
}

function defaultEnvironment(): WebGpuEnvironment {
  return globalThis as unknown as WebGpuEnvironment;
}

function failure(
  reason: WebGpuFailureReason,
  cause?: unknown,
  message: string = WEBGPU_FAILURE_MESSAGES[reason],
): WebGpuFailure {
  const result: WebGpuFailure = { ok: false, reason, message };

  if (cause !== undefined) {
    return { ...result, cause };
  }

  return result;
}
