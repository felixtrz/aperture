export type WebGpuBufferFailureReason =
  | "invalid-size"
  | "create-buffer-unavailable"
  | "queue-write-buffer-unavailable"
  | "empty-initial-data";

export interface WebGpuBufferFailure {
  readonly ok: false;
  readonly reason: WebGpuBufferFailureReason;
  readonly message: string;
}

export interface WebGpuBufferSuccess {
  readonly ok: true;
  readonly buffer: unknown;
}

export type WebGpuBufferResult = WebGpuBufferSuccess | WebGpuBufferFailure;

export interface WebGpuBufferDescriptor {
  readonly label?: string;
  readonly size: number;
  readonly usage: number;
  readonly mappedAtCreation?: boolean;
  readonly initialData?: ArrayBufferView;
}

export interface WebGpuBufferCreateDescriptor {
  readonly label?: string;
  readonly size: number;
  readonly usage: number;
  readonly mappedAtCreation?: boolean;
}

export interface WebGpuBufferDeviceLike {
  readonly queue?: {
    writeBuffer?: (
      buffer: unknown,
      bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView,
      dataOffset?: number,
      size?: number,
    ) => void;
  };
  createBuffer?: (descriptor: WebGpuBufferCreateDescriptor) => unknown;
}

export interface CreateWebGpuBufferOptions {
  readonly device: WebGpuBufferDeviceLike;
  readonly descriptor: WebGpuBufferDescriptor;
}

export function createWebGpuBuffer(
  options: CreateWebGpuBufferOptions,
): WebGpuBufferResult {
  const { descriptor, device } = options;

  if (!Number.isFinite(descriptor.size) || descriptor.size <= 0) {
    return failure(
      "invalid-size",
      "WebGPU buffer size must be a positive finite number.",
    );
  }

  if (descriptor.initialData !== undefined) {
    if (descriptor.initialData.byteLength === 0) {
      return failure(
        "empty-initial-data",
        "WebGPU buffer initial data must not be zero length.",
      );
    }

    if (descriptor.initialData.byteLength > descriptor.size) {
      return failure(
        "invalid-size",
        "WebGPU buffer initial data cannot exceed buffer size.",
      );
    }

    if (device.queue?.writeBuffer === undefined) {
      return failure(
        "queue-write-buffer-unavailable",
        "WebGPU buffer initial data requires queue.writeBuffer.",
      );
    }
  }

  if (device.createBuffer === undefined) {
    return failure(
      "create-buffer-unavailable",
      "WebGPU device cannot create buffers.",
    );
  }

  const buffer = device.createBuffer(createDescriptor(descriptor));

  if (descriptor.initialData !== undefined) {
    const upload = createInitialDataUpload(descriptor.initialData);

    device.queue?.writeBuffer?.(
      buffer,
      0,
      upload.data,
      upload.dataOffset,
      upload.size,
    );
  }

  return { ok: true, buffer };
}

export function destroyWebGpuBuffer(buffer: unknown): void {
  if (typeof buffer !== "object" || buffer === null) {
    return;
  }

  const destroy = (buffer as { readonly destroy?: unknown }).destroy;
  if (typeof destroy === "function") {
    destroy.call(buffer);
  }
}

function createDescriptor(
  descriptor: WebGpuBufferDescriptor,
): WebGpuBufferCreateDescriptor {
  const result: WebGpuBufferCreateDescriptor = {
    size: alignTo4(descriptor.size),
    usage: descriptor.usage,
    mappedAtCreation: descriptor.mappedAtCreation ?? false,
  };

  if (descriptor.label !== undefined) {
    return { ...result, label: descriptor.label };
  }

  return result;
}

interface InitialDataUpload {
  readonly data: ArrayBufferLike | ArrayBufferView;
  readonly dataOffset: number;
  readonly size: number;
}

function createInitialDataUpload(data: ArrayBufferView): InitialDataUpload {
  const size = alignTo4(data.byteLength);

  if (size === data.byteLength) {
    return {
      data: data.buffer,
      dataOffset: data.byteOffset,
      size,
    };
  }

  const padded = new Uint8Array(size);
  padded.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));

  return {
    data: padded.buffer,
    dataOffset: 0,
    size,
  };
}

function alignTo4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

function failure(
  reason: WebGpuBufferFailureReason,
  message: string,
): WebGpuBufferFailure {
  return { ok: false, reason, message };
}
