export type WebGpuBindGroupLayoutCacheFailureReason =
  "create-bind-group-layout-unavailable";

export type WebGpuBindGroupLayoutCacheStatus = "hit" | "miss";

export interface WebGpuBindGroupLayoutEntryDescriptor {
  readonly binding: number;
  readonly label?: string;
  readonly [key: string]: unknown;
}

export interface WebGpuBindGroupLayoutDescriptor {
  readonly label?: string;
  readonly entries: readonly WebGpuBindGroupLayoutEntryDescriptor[];
  readonly [key: string]: unknown;
}

export interface WebGpuBindGroupLayoutDeviceLike {
  createBindGroupLayout?: (
    descriptor: WebGpuBindGroupLayoutDescriptor,
  ) => unknown;
}

export interface WebGpuBindGroupLayoutCacheRequest {
  readonly device: WebGpuBindGroupLayoutDeviceLike;
  readonly descriptor: WebGpuBindGroupLayoutDescriptor;
}

export interface WebGpuBindGroupLayoutCacheSuccess {
  readonly ok: true;
  readonly status: WebGpuBindGroupLayoutCacheStatus;
  readonly key: string;
  readonly layout: unknown;
}

export interface WebGpuBindGroupLayoutCacheFailure {
  readonly ok: false;
  readonly reason: WebGpuBindGroupLayoutCacheFailureReason;
  readonly message: string;
  readonly key: string;
}

export type WebGpuBindGroupLayoutCacheResult =
  | WebGpuBindGroupLayoutCacheSuccess
  | WebGpuBindGroupLayoutCacheFailure;

export class WebGpuBindGroupLayoutCache {
  readonly #layouts = new Map<string, unknown>();

  get size(): number {
    return this.#layouts.size;
  }

  has(input: WebGpuBindGroupLayoutDescriptor | string): boolean {
    return this.#layouts.has(resolveKey(input));
  }

  clear(): void {
    this.#layouts.clear();
  }

  getOrCreate(
    request: WebGpuBindGroupLayoutCacheRequest,
  ): WebGpuBindGroupLayoutCacheResult {
    const key = createWebGpuBindGroupLayoutCacheKey(request.descriptor);
    const existing = this.#layouts.get(key);

    if (existing !== undefined) {
      return { ok: true, status: "hit", key, layout: existing };
    }

    if (request.device.createBindGroupLayout === undefined) {
      return {
        ok: false,
        reason: "create-bind-group-layout-unavailable",
        key,
        message: "WebGPU device cannot create bind group layouts.",
      };
    }

    const layout = request.device.createBindGroupLayout(request.descriptor);

    this.#layouts.set(key, layout);
    return { ok: true, status: "miss", key, layout };
  }
}

export function createWebGpuBindGroupLayoutCacheKey(
  descriptor: WebGpuBindGroupLayoutDescriptor,
): string {
  return JSON.stringify({
    entries: descriptor.entries
      .map((entry) => normalizedEntry(entry))
      .sort(compareNormalizedEntries),
  });
}

function resolveKey(input: WebGpuBindGroupLayoutDescriptor | string): string {
  return typeof input === "string"
    ? input
    : createWebGpuBindGroupLayoutCacheKey(input);
}

function normalizedEntry(
  entry: WebGpuBindGroupLayoutEntryDescriptor,
): Readonly<Record<string, unknown>> {
  return stableDescriptorValue(entry) as Readonly<Record<string, unknown>>;
}

function compareNormalizedEntries(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): number {
  const bindingDelta = numberValue(a.binding) - numberValue(b.binding);

  if (bindingDelta !== 0) {
    return bindingDelta;
  }

  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

function stableDescriptorValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableDescriptorValue);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const object = value as Readonly<Record<string, unknown>>;
  const normalized: Record<string, unknown> = {};

  for (const key of Object.keys(object).sort()) {
    if (key === "label" || object[key] === undefined) {
      continue;
    }

    normalized[key] = stableDescriptorValue(object[key]);
  }

  return normalized;
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}
