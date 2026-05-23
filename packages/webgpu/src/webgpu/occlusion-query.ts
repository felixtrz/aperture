export const GPU_OCCLUSION_QUERY_BYTES = BigUint64Array.BYTES_PER_ELEMENT;
export const GPU_OCCLUSION_MAP_READ = 0x1;

const GPU_BUFFER_USAGE_MAP_READ = 0x1;
const GPU_BUFFER_USAGE_COPY_SRC = 0x4;
const GPU_BUFFER_USAGE_COPY_DST = 0x8;
const GPU_BUFFER_USAGE_QUERY_RESOLVE = 0x200;

export type GpuOcclusionQueryDiagnosticCode =
  | "gpuOcclusion.invalidQueryCount"
  | "gpuOcclusion.missingDeviceSupport"
  | "gpuOcclusion.resourceCreationFailed"
  | "gpuOcclusion.commandEncodingUnsupported"
  | "gpuOcclusion.readbackUnavailable";

export interface GpuOcclusionQueryDiagnostic {
  readonly code: GpuOcclusionQueryDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface GpuOcclusionQueryDeviceLike {
  readonly createQuerySet?: (descriptor: {
    readonly label?: string;
    readonly type: "occlusion";
    readonly count: number;
  }) => unknown;
  readonly createBuffer?: (descriptor: {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
  }) => GpuOcclusionBufferLike;
}

export interface GpuOcclusionCommandEncoderLike {
  readonly resolveQuerySet?: (
    querySet: unknown,
    firstQuery: number,
    queryCount: number,
    destination: unknown,
    destinationOffset: number,
  ) => void;
  readonly copyBufferToBuffer?: (
    source: unknown,
    sourceOffset: number,
    destination: unknown,
    destinationOffset: number,
    size: number,
  ) => void;
}

export interface GpuOcclusionBufferLike {
  readonly mapAsync?: (
    mode: number,
    offset?: number,
    size?: number,
  ) => Promise<void>;
  readonly getMappedRange?: (
    offset?: number,
    size?: number,
  ) => ArrayBuffer | ArrayBufferView;
  readonly unmap?: () => void;
}

export interface GpuOcclusionQueryResources {
  readonly label: string;
  readonly queryCount: number;
  readonly byteLength: number;
  readonly querySet: unknown;
  readonly resolveBuffer: GpuOcclusionBufferLike;
  readonly readbackBuffer: GpuOcclusionBufferLike;
}

export interface CreateGpuOcclusionQueryResourcesOptions {
  readonly device: GpuOcclusionQueryDeviceLike;
  readonly label?: string;
  readonly queryCount: number;
}

export interface CreateGpuOcclusionQueryResourcesResult {
  readonly supported: boolean;
  readonly resources: GpuOcclusionQueryResources | null;
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
}

export interface GpuOcclusionQueryResolveReport {
  readonly valid: boolean;
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
}

export interface GpuOcclusionQueryReadbackResult {
  readonly valid: boolean;
  readonly testedRenderIds: readonly number[];
  readonly visibleRenderIds: readonly number[];
  readonly occludedRenderIds: readonly number[];
  readonly sampleCounts: readonly string[];
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
}

export function createGpuOcclusionQueryResources(
  options: CreateGpuOcclusionQueryResourcesOptions,
): CreateGpuOcclusionQueryResourcesResult {
  const label = options.label ?? "aperture-gpu-occlusion";
  const queryCount = Math.floor(options.queryCount);

  if (!Number.isFinite(queryCount) || queryCount < 1) {
    return createUnsupportedResult({
      code: "gpuOcclusion.invalidQueryCount",
      severity: "error",
      message: "GPU occlusion query resources require at least one query.",
    });
  }

  if (
    options.device.createQuerySet === undefined ||
    options.device.createBuffer === undefined
  ) {
    return createUnsupportedResult({
      code: "gpuOcclusion.missingDeviceSupport",
      severity: "warning",
      message:
        "GPU occlusion query resources require createQuerySet and createBuffer support.",
    });
  }

  try {
    const byteLength = queryCount * GPU_OCCLUSION_QUERY_BYTES;
    const querySet = options.device.createQuerySet({
      label: `${label}/queries`,
      type: "occlusion",
      count: queryCount,
    });
    const resolveBuffer = options.device.createBuffer({
      label: `${label}/resolve`,
      size: byteLength,
      usage: GPU_BUFFER_USAGE_QUERY_RESOLVE | GPU_BUFFER_USAGE_COPY_SRC,
    });
    const readbackBuffer = options.device.createBuffer({
      label: `${label}/readback`,
      size: byteLength,
      usage: GPU_BUFFER_USAGE_MAP_READ | GPU_BUFFER_USAGE_COPY_DST,
    });

    return {
      supported: true,
      resources: {
        label,
        queryCount,
        byteLength,
        querySet,
        resolveBuffer,
        readbackBuffer,
      },
      diagnostics: [],
    };
  } catch (cause) {
    return createUnsupportedResult({
      code: "gpuOcclusion.resourceCreationFailed",
      severity: "warning",
      message: `GPU occlusion query resource creation failed: ${String(cause)}`,
    });
  }
}

export function resolveGpuOcclusionQueries(
  encoder: GpuOcclusionCommandEncoderLike,
  resources: GpuOcclusionQueryResources,
  queryCount = resources.queryCount,
): GpuOcclusionQueryResolveReport {
  const count = Math.floor(queryCount);

  if (!Number.isFinite(count) || count < 1 || count > resources.queryCount) {
    return commandFailure(
      "gpuOcclusion.invalidQueryCount",
      "GPU occlusion query resolve count must be within the allocated query range.",
    );
  }

  if (
    encoder.resolveQuerySet === undefined ||
    encoder.copyBufferToBuffer === undefined
  ) {
    return commandFailure(
      "gpuOcclusion.commandEncodingUnsupported",
      "GPU occlusion query readback requires resolveQuerySet and copyBufferToBuffer.",
    );
  }

  const byteLength = count * GPU_OCCLUSION_QUERY_BYTES;

  encoder.resolveQuerySet(
    resources.querySet,
    0,
    count,
    resources.resolveBuffer,
    0,
  );
  encoder.copyBufferToBuffer(
    resources.resolveBuffer,
    0,
    resources.readbackBuffer,
    0,
    byteLength,
  );

  return { valid: true, diagnostics: [] };
}

export async function readGpuOcclusionQueryResults(
  resources: GpuOcclusionQueryResources,
  renderIds: readonly number[],
): Promise<GpuOcclusionQueryReadbackResult> {
  if (
    resources.readbackBuffer.mapAsync === undefined ||
    resources.readbackBuffer.getMappedRange === undefined
  ) {
    return readbackFailure(
      "gpuOcclusion.readbackUnavailable",
      "GPU occlusion query readback requires mapAsync and getMappedRange.",
      renderIds,
    );
  }

  try {
    const byteLength = renderIds.length * GPU_OCCLUSION_QUERY_BYTES;

    await resources.readbackBuffer.mapAsync(
      GPU_OCCLUSION_MAP_READ,
      0,
      byteLength,
    );

    const mapped = resources.readbackBuffer.getMappedRange(0, byteLength);
    const counts = bigUint64View(mapped, byteLength);
    const visibleRenderIds: number[] = [];
    const occludedRenderIds: number[] = [];
    const sampleCounts: string[] = [];

    for (let index = 0; index < renderIds.length; index += 1) {
      const renderId = renderIds[index];
      const samples = counts[index] ?? 0n;

      sampleCounts.push(samples.toString());

      if (renderId === undefined) {
        continue;
      }

      if (samples === 0n) {
        occludedRenderIds.push(renderId);
      } else {
        visibleRenderIds.push(renderId);
      }
    }

    resources.readbackBuffer.unmap?.();

    return {
      valid: true,
      testedRenderIds: [...renderIds],
      visibleRenderIds,
      occludedRenderIds,
      sampleCounts,
      diagnostics: [],
    };
  } catch (cause) {
    return readbackFailure(
      "gpuOcclusion.readbackUnavailable",
      `GPU occlusion query readback failed: ${String(cause)}`,
      renderIds,
    );
  }
}

function bigUint64View(
  mapped: ArrayBuffer | ArrayBufferView,
  byteLength: number,
): BigUint64Array {
  if (ArrayBuffer.isView(mapped)) {
    return new BigUint64Array(
      mapped.buffer,
      mapped.byteOffset,
      Math.floor(Math.min(mapped.byteLength, byteLength) / 8),
    );
  }

  return new BigUint64Array(mapped, 0, Math.floor(byteLength / 8));
}

function createUnsupportedResult(
  diagnostic: GpuOcclusionQueryDiagnostic,
): CreateGpuOcclusionQueryResourcesResult {
  return { supported: false, resources: null, diagnostics: [diagnostic] };
}

function commandFailure(
  code: GpuOcclusionQueryDiagnosticCode,
  message: string,
): GpuOcclusionQueryResolveReport {
  return {
    valid: false,
    diagnostics: [{ code, severity: "error", message }],
  };
}

function readbackFailure(
  code: GpuOcclusionQueryDiagnosticCode,
  message: string,
  renderIds: readonly number[],
): GpuOcclusionQueryReadbackResult {
  return {
    valid: false,
    testedRenderIds: [...renderIds],
    visibleRenderIds: [],
    occludedRenderIds: [],
    sampleCounts: [],
    diagnostics: [{ code, severity: "warning", message }],
  };
}
