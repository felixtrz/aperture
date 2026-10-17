import type * as WebGpuBinding from "webgpu";
import type {} from "webgpu";
import { createNodeDeviceCache } from "./device-cache.js";

export type NodeAdapterPolicy = "auto" | "hardware" | "software";
export type DawnBackend = "vulkan" | "metal" | "d3d12";

export interface NodeDeviceOptions {
  readonly adapter?: NodeAdapterPolicy;
  readonly backend?: DawnBackend;
  readonly adapterName?: string;
  readonly powerPreference?: GPUPowerPreference;
  readonly requiredFeatures?: readonly GPUFeatureName[];
  readonly optionalFeatures?: readonly GPUFeatureName[];
  readonly requiredLimits?: Readonly<Record<string, number>>;
  readonly label?: string;
}

export interface NodeDeviceMetadata {
  readonly cache?: {
    readonly hits: number;
    readonly misses: number;
    readonly entries: number;
  };
  readonly binding: "webgpu";
  readonly bindingVersion: "0.6.2";
  readonly backend: DawnBackend;
  readonly policy: NodeAdapterPolicy;
  readonly adapterType: "hardware" | "software" | "unknown";
  readonly adapterInfo: Readonly<Record<string, string | number | boolean>>;
  readonly adapterFeatures: readonly string[];
  readonly deviceFeatures: readonly string[];
}

export class NodeGpuError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NodeGpuError";
  }
}

export interface NodeDevice {
  readonly device: GPUDevice;
  readonly adapter: GPUAdapter;
  readonly metadata: NodeDeviceMetadata;
  readonly lost: Promise<GPUDeviceLostInfo>;
  readonly errors: readonly string[];
  readonly disposed: boolean;
  assertHealthy(): void;
  dispose(): Promise<void>;
}

export function classifyNodeAdapter(
  info: Readonly<Record<string, unknown>>,
  fallback?: boolean,
): NodeDeviceMetadata["adapterType"] {
  const identity = [
    info.description,
    info.vendor,
    info.device,
    info.architecture,
    info.adapterType,
    info.type,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");
  if (
    fallback === true ||
    /swiftshader|lavapipe|llvmpipe|software|\bcpu\b/i.test(identity)
  )
    return "software";
  if (
    /discrete|integrated|nvidia|amd|radeon|intel|apple|qualcomm|adreno|mali/i.test(
      identity,
    )
  )
    return "hardware";
  return "unknown";
}

/** Loads Dawn only when requested. No navigator, browser, driver install, or process-global GPU instance. */
export async function createNodeDevice(
  options: NodeDeviceOptions = {},
): Promise<NodeDevice> {
  const policy = options.adapter ?? "auto";
  if (!["auto", "hardware", "software"].includes(policy))
    throw new NodeGpuError(
      "aperture.dawn.invalidAdapter",
      `Unknown adapter policy '${policy}'.`,
    );
  const backend =
    options.backend ??
    (process.platform === "darwin"
      ? "metal"
      : process.platform === "win32"
        ? "d3d12"
        : "vulkan");
  if (!["metal", "vulkan", "d3d12"].includes(backend))
    throw new NodeGpuError(
      "aperture.dawn.invalidBackend",
      `Unsupported Dawn backend '${backend}'.`,
    );
  let binding: typeof WebGpuBinding;
  try {
    binding = await import("webgpu");
  } catch (cause) {
    throw new NodeGpuError(
      "aperture.dawn.bindingUnavailable",
      "Cannot load the webgpu native binding. Install the pinned package for this OS/architecture and its runtime libraries.",
      { cause },
    );
  }
  let gpu: GPU | null = binding.create([
    `backend=${backend}`,
    ...(options.adapterName === undefined
      ? []
      : [`adapter=${options.adapterName}`]),
  ]);
  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter({
      ...(options.powerPreference === undefined
        ? {}
        : { powerPreference: options.powerPreference }),
    });
  } catch (cause) {
    throw new NodeGpuError(
      "aperture.dawn.adapterUnavailable",
      `Dawn could not request a ${backend} adapter. Provision a compatible GPU driver or software Vulkan ICD before rendering.`,
      { cause },
    );
  }
  if (adapter === null) {
    throw new NodeGpuError(
      "aperture.dawn.adapterUnavailable",
      `No ${backend} WebGPU adapter is available. Software mode requires a provisioned software driver; it does not install one.`,
    );
  }
  const info: Record<string, string | number | boolean> = {};
  const rawInfo = adapter.info as unknown as Record<string, unknown>;
  for (const key of [
    "vendor",
    "architecture",
    "device",
    "description",
    "subgroupMinSize",
    "subgroupMaxSize",
    "isFallbackAdapter",
    "adapterType",
    "type",
  ]) {
    const value = rawInfo[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      info[key] = value;
  }
  const fallback =
    rawInfo.isFallbackAdapter ??
    (adapter as unknown as { isFallbackAdapter?: boolean }).isFallbackAdapter;
  const adapterType = classifyNodeAdapter(info, fallback === true);
  if (policy !== "auto" && adapterType !== policy) {
    throw new NodeGpuError(
      "aperture.dawn.adapterPolicyMismatch",
      `Requested ${policy} rendering, but Dawn selected ${adapterType} adapter '${info.description ?? info.device ?? "unknown"}'. Configure the driver/adapter explicitly.`,
    );
  }
  const features = new Set(options.requiredFeatures ?? []);
  for (const feature of features) {
    if (!adapter.features.has(feature)) {
      throw new NodeGpuError(
        "aperture.dawn.featureUnavailable",
        `Required WebGPU feature '${feature}' is unavailable on this adapter.`,
      );
    }
  }
  for (const feature of options.optionalFeatures ??
    ([
      "timestamp-query",
      "texture-compression-bc",
      "texture-compression-etc2",
      "texture-compression-astc",
      "indirect-first-instance",
    ] as GPUFeatureName[])) {
    if (adapter.features.has(feature)) features.add(feature);
  }
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({
      requiredFeatures: [...features],
      ...(options.requiredLimits === undefined
        ? {}
        : { requiredLimits: options.requiredLimits }),
      label: options.label ?? "aperture:dawn",
    });
  } catch (cause) {
    throw new NodeGpuError(
      "aperture.dawn.deviceUnavailable",
      "Dawn device creation failed; inspect the requested features/limits and adapter driver.",
      { cause },
    );
  }
  const cache = createNodeDeviceCache(device);
  const errors: string[] = [];
  let disposed = false;
  let loss: GPUDeviceLostInfo | null = null;
  let disposal: Promise<void> | null = null;
  const onError = (event: GPUUncapturedErrorEvent): void => {
    errors.push(event.error.message);
  };
  device.addEventListener("uncapturederror", onError);
  const lost = device.lost.then((info) => {
    loss = info;
    return info;
  });
  return {
    device: cache.device,
    adapter,
    lost,
    errors,
    get metadata(): NodeDeviceMetadata {
      return {
        binding: "webgpu",
        bindingVersion: "0.6.2",
        backend,
        policy,
        adapterType,
        adapterInfo: info,
        adapterFeatures: [...adapter.features].sort(),
        deviceFeatures: [...device.features].sort(),
        cache: cache.inspect(),
      };
    },
    get disposed() {
      return disposed;
    },
    assertHealthy() {
      if (disposed || gpu === null)
        throw new NodeGpuError(
          "aperture.dawn.disposed",
          "Dawn session has been disposed.",
        );
      if (loss !== null)
        throw new NodeGpuError("aperture.dawn.deviceLost", loss.message);
      if (errors.length)
        throw new NodeGpuError(
          "aperture.dawn.validationFailed",
          errors.join("\n"),
        );
    },
    dispose() {
      if (disposal !== null) return disposal;
      disposed = true;
      disposal = (async () => {
        try {
          if (loss === null) await device.queue.onSubmittedWorkDone();
        } finally {
          device.removeEventListener("uncapturederror", onError);
          cache.clear();
          device.destroy();
          gpu = null;
        }
      })();
      return disposal;
    },
  };
}
