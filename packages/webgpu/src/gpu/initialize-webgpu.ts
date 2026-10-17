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
  readonly displayColorSpace: "srgb";
  readonly deviceLost: Promise<WebGpuFailure> | null;
}

/** An externally owned device; adopting it never creates or destroys a device. */
export interface WebGpuDeviceContext {
  readonly device: WebGpuDeviceLike;
  readonly adapter?: WebGpuAdapterLike;
}

export interface WebGpuRendererInitializationSuccess extends Omit<
  WebGpuInitializationSuccess,
  "gpu" | "adapter" | "context"
> {
  readonly gpu: WebGpuLike | null;
  readonly adapter: WebGpuAdapterLike | null;
  readonly context: WebGpuCanvasContextLike | null;
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
  readonly features?: {
    readonly has?: (feature: string) => boolean;
  };
  requestDevice(descriptor?: unknown): Promise<WebGpuDeviceLike>;
}

export interface WebGpuDeviceLostInfoLike {
  readonly reason?: string;
  readonly message?: string;
}

export interface WebGpuDeviceLike {
  readonly features?: {
    readonly has?: (feature: string) => boolean;
  };
  readonly lost?: Promise<WebGpuDeviceLostInfoLike>;
}

export interface WebGpuCanvasLike {
  getContext(contextId: "webgpu"): WebGpuCanvasContextLike | null;
}

export interface WebGpuCanvasContextLike {
  configure(configuration: {
    readonly device: WebGpuDeviceLike;
    readonly format: string;
    readonly colorSpace?: "srgb";
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
  readonly timestampQuery?: "auto" | boolean;
  readonly textureCompression?: "auto" | boolean;
  readonly indirectFirstInstance?: "auto" | boolean;
  readonly alphaMode?: "opaque" | "premultiplied";
  readonly textureUsage?: number;
  readonly displayColorSpace?: "srgb";
}

const WEBGPU_TEXTURE_COMPRESSION_FEATURES = [
  "texture-compression-astc",
  "texture-compression-bc",
  "texture-compression-etc2",
] as const;

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
    device = await adapter.requestDevice(
      deviceDescriptorWithOptionalFeatures(adapter, options.deviceDescriptor, {
        timestampQuery: options.timestampQuery ?? "auto",
        textureCompression: options.textureCompression ?? "auto",
        indirectFirstInstance: options.indirectFirstInstance ?? "auto",
      }),
    );
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
      colorSpace: options.displayColorSpace ?? "srgb",
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
    displayColorSpace: options.displayColorSpace ?? "srgb",
    deviceLost: webGpuDeviceLost(device),
  };
}

function defaultEnvironment(): WebGpuEnvironment {
  return globalThis as unknown as WebGpuEnvironment;
}

function deviceDescriptorWithOptionalFeatures(
  adapter: WebGpuAdapterLike,
  descriptor: unknown,
  options: {
    readonly timestampQuery: "auto" | boolean;
    readonly textureCompression: "auto" | boolean;
    readonly indirectFirstInstance: "auto" | boolean;
  },
): unknown {
  const features: string[] = [];

  if (options.timestampQuery !== false) {
    const timestampSupported =
      adapter.features?.has?.("timestamp-query") === true;
    if (timestampSupported || options.timestampQuery === true) {
      features.push("timestamp-query");
    }
  }

  if (options.textureCompression !== false) {
    for (const feature of WEBGPU_TEXTURE_COMPRESSION_FEATURES) {
      if (adapter.features?.has?.(feature) === true) {
        features.push(feature);
      }
    }
  }

  if (options.indirectFirstInstance !== false) {
    const indirectFirstInstanceSupported =
      adapter.features?.has?.("indirect-first-instance") === true;
    if (
      indirectFirstInstanceSupported ||
      options.indirectFirstInstance === true
    ) {
      features.push("indirect-first-instance");
    }
  }

  return deviceDescriptorWithRequiredFeatures(descriptor, features);
}

function deviceDescriptorWithRequiredFeatures(
  descriptor: unknown,
  features: readonly string[],
): unknown {
  if (features.length === 0) {
    return descriptor;
  }

  const source =
    typeof descriptor === "object" && descriptor !== null ? descriptor : {};
  const requiredFeatures = requiredFeatureList(source);
  const mergedFeatures = [...requiredFeatures];

  for (const feature of features) {
    if (!mergedFeatures.includes(feature)) {
      mergedFeatures.push(feature);
    }
  }

  if (mergedFeatures.length === requiredFeatures.length) {
    return descriptor;
  }

  return {
    ...source,
    requiredFeatures: mergedFeatures,
  };
}

function requiredFeatureList(descriptor: object): string[] {
  const candidate = (descriptor as { readonly requiredFeatures?: unknown })
    .requiredFeatures;

  if (Array.isArray(candidate)) {
    return candidate.filter(
      (feature): feature is string => typeof feature === "string",
    );
  }

  if (
    candidate !== null &&
    typeof candidate === "object" &&
    Symbol.iterator in candidate
  ) {
    return Array.from(candidate as Iterable<unknown>).filter(
      (feature): feature is string => typeof feature === "string",
    );
  }

  return [];
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

const deviceLossReports = new WeakMap<
  WebGpuDeviceLike,
  Promise<WebGpuFailure>
>();
/** One listener per borrowed device, outside any app's closure/lifetime. */
export function webGpuDeviceLost(
  device: WebGpuDeviceLike,
): Promise<WebGpuFailure> | null {
  if (device.lost === undefined) return null;
  let report = deviceLossReports.get(device);
  if (report === undefined) {
    report = device.lost.then(deviceLossFailure);
    deviceLossReports.set(device, report);
  }
  return report;
}
function deviceLossFailure(info: WebGpuDeviceLostInfoLike): WebGpuFailure {
  return failure(
    "device-lost",
    info,
    info.message ?? WEBGPU_FAILURE_MESSAGES["device-lost"],
  );
}
