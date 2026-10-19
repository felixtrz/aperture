export const GPU_TIMESTAMP_QUERY_BYTES = BigUint64Array.BYTES_PER_ELEMENT;
export const GPU_TIMESTAMP_MAP_READ = 0x1;

const GPU_BUFFER_USAGE_MAP_READ = 0x1;
const GPU_BUFFER_USAGE_COPY_SRC = 0x4;
const GPU_BUFFER_USAGE_COPY_DST = 0x8;
const GPU_BUFFER_USAGE_QUERY_RESOLVE = 0x200;

export type GpuTimestampQueryDiagnosticCode =
  | "gpuTiming.timestampQueryUnavailable"
  | "gpuTiming.invalidQueryCount"
  | "gpuTiming.missingDeviceSupport"
  | "gpuTiming.resourceCreationFailed"
  | "gpuTiming.commandEncodingUnsupported"
  | "gpuTiming.readbackUnavailable"
  | "gpuTiming.partialCoverage";

export interface GpuTimestampQueryDiagnostic {
  readonly code: GpuTimestampQueryDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface GpuTimestampFeatureSetLike {
  has?(feature: string): boolean;
}

export interface GpuTimestampQueryDeviceLike {
  readonly features?: GpuTimestampFeatureSetLike;
  readonly pushErrorScope?: (filter: "validation") => void;
  readonly popErrorScope?: () => Promise<{ readonly message?: string } | null>;
  readonly createQuerySet?: (descriptor: {
    readonly label?: string;
    readonly type: "timestamp";
    readonly count: number;
  }) => unknown;
  readonly createBuffer?: (descriptor: {
    readonly label?: string;
    readonly size: number;
    readonly usage: number;
  }) => GpuTimestampBufferLike;
}

export interface GpuPassTimestampWrites {
  readonly querySet: unknown;
  readonly beginningOfPassWriteIndex: number;
  readonly endOfPassWriteIndex: number;
}

export interface GpuPassTimestampWritesResult extends GpuTimestampCommandReport {
  readonly timestampWrites: GpuPassTimestampWrites | null;
}

export interface GpuTimestampCommandEncoderLike {
  readonly writeTimestamp?: (querySet: unknown, queryIndex: number) => void;
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

export interface GpuTimestampBufferLike {
  readonly mapAsync?: (
    mode: number,
    offset?: number,
    size?: number,
  ) => Promise<void>;
  readonly getMappedRange?: (offset?: number, size?: number) => ArrayBuffer;
  readonly unmap?: () => void;
}

export interface GpuTimestampQueryResources {
  readonly label: string;
  readonly queryCount: number;
  readonly byteLength: number;
  readonly querySet: unknown;
  readonly resolveBuffer: GpuTimestampBufferLike;
  readonly readbackBuffer: GpuTimestampBufferLike;
}

export interface CreateGpuTimestampQueryResourcesOptions {
  readonly device: GpuTimestampQueryDeviceLike;
  readonly label?: string;
  readonly queryCount?: number;
}

export interface CreateGpuTimestampQueryResourcesResult {
  readonly supported: boolean;
  readonly resources: GpuTimestampQueryResources | null;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}

export interface GpuTimestampCommandReport {
  readonly valid: boolean;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}

export interface GpuTimestampDuration {
  readonly startQuery: number;
  readonly endQuery: number;
  readonly nanoseconds: bigint;
}

export interface GpuTimestampReadbackResult {
  readonly valid: boolean;
  readonly timestamps: readonly bigint[];
  readonly durations: readonly GpuTimestampDuration[];
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}

export interface GpuPassTiming {
  readonly pass: string;
  readonly startQuery: number;
  readonly endQuery: number;
  readonly microseconds: number;
}

export interface GpuPassTimingReport {
  /** Reported samples are valid, including quantized zero; coverage may be partial. */
  readonly ready: boolean;
  readonly supported: boolean;
  readonly queryCount: number;
  readonly passes: readonly GpuPassTiming[];
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}

export function createGpuTimestampQueryResources(
  options: CreateGpuTimestampQueryResourcesOptions,
): CreateGpuTimestampQueryResourcesResult {
  const label = options.label ?? "aperture-gpu-timing";
  const queryCount = Math.floor(options.queryCount ?? 2);

  if (!Number.isFinite(queryCount) || queryCount < 2) {
    return createUnsupportedResult({
      code: "gpuTiming.invalidQueryCount",
      severity: "error",
      message: "GPU timestamp query resources require at least two queries.",
    });
  }

  if (options.device.features?.has?.("timestamp-query") === false) {
    return createUnsupportedResult({
      code: "gpuTiming.timestampQueryUnavailable",
      severity: "warning",
      message:
        "WebGPU timestamp queries require the 'timestamp-query' device feature.",
    });
  }

  if (
    options.device.createQuerySet === undefined ||
    options.device.createBuffer === undefined
  ) {
    return createUnsupportedResult({
      code: "gpuTiming.missingDeviceSupport",
      severity: "warning",
      message:
        "GPU timestamp query resources require createQuerySet and createBuffer support.",
    });
  }

  try {
    const byteLength = queryCount * GPU_TIMESTAMP_QUERY_BYTES;
    const querySet = options.device.createQuerySet({
      label: `${label}/queries`,
      type: "timestamp",
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
      code: "gpuTiming.resourceCreationFailed",
      severity: "warning",
      message: `GPU timestamp query resource creation failed: ${String(cause)}`,
    });
  }
}

export async function createGpuTimestampQueryResourcesChecked(
  options: CreateGpuTimestampQueryResourcesOptions,
): Promise<CreateGpuTimestampQueryResourcesResult> {
  if (
    options.device.pushErrorScope === undefined ||
    options.device.popErrorScope === undefined
  ) {
    return createGpuTimestampQueryResources(options);
  }

  options.device.pushErrorScope("validation");
  const created = createGpuTimestampQueryResources(options);
  const validationError = await options.device.popErrorScope();

  if (validationError === null) {
    return created;
  }

  return createUnsupportedResult({
    code: "gpuTiming.resourceCreationFailed",
    severity: "warning",
    message: `GPU timestamp query resource creation failed validation: ${
      validationError.message ?? "unknown validation error"
    }`,
  });
}

/** Creates the standard WebGPU render/compute pass timestamp descriptor. */
export function createGpuPassTimestampWrites(
  resources: GpuTimestampQueryResources,
  startQuery = 0,
  endQuery = startQuery + 1,
): GpuPassTimestampWritesResult {
  if (
    !isValidQueryIndex(startQuery, resources.queryCount) ||
    !isValidQueryIndex(endQuery, resources.queryCount) ||
    startQuery === endQuery
  ) {
    return {
      ...commandFailure(
        "gpuTiming.invalidQueryCount",
        "GPU pass timestamps require two distinct indices within the allocated query range.",
      ),
      timestampWrites: null,
    };
  }
  return {
    valid: true,
    diagnostics: [],
    timestampWrites: {
      querySet: resources.querySet,
      beginningOfPassWriteIndex: startQuery,
      endOfPassWriteIndex: endQuery,
    },
  };
}

/** @deprecated Use createGpuPassTimestampWrites on the pass descriptor. */
export function writeGpuTimestampQuery(
  encoder: GpuTimestampCommandEncoderLike,
  resources: GpuTimestampQueryResources,
  queryIndex: number,
): GpuTimestampCommandReport {
  if (!isValidQueryIndex(queryIndex, resources.queryCount)) {
    return commandFailure(
      "gpuTiming.invalidQueryCount",
      `GPU timestamp query index ${queryIndex} is outside the allocated query range.`,
    );
  }

  if (encoder.writeTimestamp === undefined) {
    return commandFailure(
      "gpuTiming.commandEncodingUnsupported",
      "GPU timestamp writes require commandEncoder.writeTimestamp.",
    );
  }

  try {
    encoder.writeTimestamp(resources.querySet, queryIndex);
    return { valid: true, diagnostics: [] };
  } catch (cause) {
    return commandFailure(
      "gpuTiming.commandEncodingUnsupported",
      `Legacy command encoder timestamp write failed: ${String(cause)}`,
    );
  }
}

export function resolveGpuTimestampQueries(
  encoder: GpuTimestampCommandEncoderLike,
  resources: GpuTimestampQueryResources,
  queryCount = resources.queryCount,
): GpuTimestampCommandReport {
  const count = Math.floor(queryCount);

  if (!Number.isFinite(count) || count < 1 || count > resources.queryCount) {
    return commandFailure(
      "gpuTiming.invalidQueryCount",
      "GPU timestamp resolve count must be within the allocated query range.",
    );
  }

  if (
    encoder.resolveQuerySet === undefined ||
    encoder.copyBufferToBuffer === undefined
  ) {
    return commandFailure(
      "gpuTiming.commandEncodingUnsupported",
      "GPU timestamp resolve requires resolveQuerySet and copyBufferToBuffer.",
    );
  }

  const byteLength = count * GPU_TIMESTAMP_QUERY_BYTES;

  try {
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
  } catch (cause) {
    return commandFailure(
      "gpuTiming.commandEncodingUnsupported",
      `GPU timestamp resolve/copy failed: ${String(cause)}`,
    );
  }
}

export async function readGpuTimestampQueryResults(
  resources: GpuTimestampQueryResources,
  options: {
    readonly queryCount?: number;
    readonly mapModeRead?: number;
  } = {},
): Promise<GpuTimestampReadbackResult> {
  const queryCount = Math.floor(options.queryCount ?? resources.queryCount);

  if (
    !Number.isFinite(queryCount) ||
    queryCount < 1 ||
    queryCount > resources.queryCount
  ) {
    return readbackFailure(
      "gpuTiming.invalidQueryCount",
      "GPU timestamp readback count must be within the allocated query range.",
    );
  }

  const byteLength = queryCount * GPU_TIMESTAMP_QUERY_BYTES;

  if (
    resources.readbackBuffer.mapAsync === undefined ||
    resources.readbackBuffer.getMappedRange === undefined
  ) {
    return readbackFailure(
      "gpuTiming.readbackUnavailable",
      "GPU timestamp readback requires a mappable result buffer.",
    );
  }

  let mappedSuccessfully = false;
  try {
    await resources.readbackBuffer.mapAsync(
      options.mapModeRead ?? GPU_TIMESTAMP_MAP_READ,
      0,
      byteLength,
    );
    mappedSuccessfully = true;
    const mapped = resources.readbackBuffer.getMappedRange(0, byteLength);
    const values = Array.from(new BigUint64Array(mapped, 0, queryCount));

    return {
      valid: true,
      timestamps: values,
      durations: timestampPairDurations(values),
      diagnostics: [],
    };
  } catch (cause) {
    return readbackFailure(
      "gpuTiming.readbackUnavailable",
      `GPU timestamp readback failed: ${String(cause)}`,
    );
  } finally {
    // A readback buffer left mapped poisons every later frame that submits a
    // copy into it ("used in submit while mapped"), so unmap even when the
    // mapped-range read throws.
    if (mappedSuccessfully) resources.readbackBuffer.unmap?.();
  }
}

/**
 * Creates one additional MAP_READ readback buffer compatible with
 * `resolveGpuTimestampQueries` copies for the given query resources. Frame
 * paths rotate these so a frame never submits a copy into a readback buffer
 * that an earlier in-flight frame still has mapped (or pending map).
 */
export function createGpuTimestampReadbackBuffer(options: {
  readonly device: GpuTimestampQueryDeviceLike;
  readonly label: string;
  readonly byteLength: number;
}): GpuTimestampBufferLike | null {
  if (options.device.createBuffer === undefined) {
    return null;
  }

  try {
    return options.device.createBuffer({
      label: options.label,
      size: options.byteLength,
      usage: GPU_BUFFER_USAGE_MAP_READ | GPU_BUFFER_USAGE_COPY_DST,
    });
  } catch {
    return null;
  }
}

export function createGpuPassTimingReport(options: {
  readonly passNames: readonly string[];
  readonly readback: GpuTimestampReadbackResult;
  readonly diagnostics?: readonly GpuTimestampQueryDiagnostic[];
}): GpuPassTimingReport {
  const diagnostics = [
    ...(options.diagnostics ?? []),
    ...options.readback.diagnostics,
  ];
  const passes: GpuPassTiming[] = [];

  for (let passIndex = 0; passIndex < options.passNames.length; passIndex++) {
    const pass = options.passNames[passIndex] ?? "unknown";
    const startQuery = passIndex * 2;
    const endQuery = startQuery + 1;
    const duration = options.readback.durations.find(
      (entry) => entry.startQuery === startQuery && entry.endQuery === endQuery,
    );
    const start = options.readback.timestamps[startQuery];
    const end = options.readback.timestamps[endQuery];
    if (
      duration === undefined ||
      start === undefined ||
      end === undefined ||
      end < start ||
      duration.nanoseconds < 0n ||
      duration.nanoseconds !== end - start
    ) {
      diagnostics.push({
        code: "gpuTiming.readbackUnavailable",
        severity: "warning",
        message: `GPU timestamp pair for '${pass}' is missing or invalid.`,
      });
      continue;
    }
    const microseconds = Number(duration.nanoseconds) / 1_000;

    passes.push({
      pass,
      startQuery,
      endQuery,
      microseconds,
    });
  }

  return {
    ready:
      options.readback.valid &&
      diagnostics.every(
        (diagnostic) => diagnostic.code === "gpuTiming.partialCoverage",
      ) &&
      passes.length === options.passNames.length &&
      passes.every(
        (pass) => Number.isFinite(pass.microseconds) && pass.microseconds >= 0,
      ),
    supported: options.readback.valid,
    queryCount: options.passNames.length * 2,
    passes,
    diagnostics,
  };
}

export function createUnsupportedGpuPassTimingReport(options: {
  readonly queryCount: number;
  readonly diagnostics: readonly GpuTimestampQueryDiagnostic[];
}): GpuPassTimingReport {
  return {
    ready: false,
    supported: false,
    queryCount: options.queryCount,
    passes: [],
    diagnostics: options.diagnostics,
  };
}

function timestampPairDurations(
  timestamps: readonly bigint[],
): readonly GpuTimestampDuration[] {
  const durations: GpuTimestampDuration[] = [];

  for (
    let startQuery = 0;
    startQuery + 1 < timestamps.length;
    startQuery += 2
  ) {
    const endQuery = startQuery + 1;
    const start = timestamps[startQuery] ?? 0n;
    const end = timestamps[endQuery] ?? 0n;

    durations.push({
      startQuery,
      endQuery,
      nanoseconds: end - start,
    });
  }

  return durations;
}

function isValidQueryIndex(queryIndex: number, queryCount: number): boolean {
  return (
    Number.isInteger(queryIndex) && queryIndex >= 0 && queryIndex < queryCount
  );
}

function createUnsupportedResult(
  diagnostic: GpuTimestampQueryDiagnostic,
): CreateGpuTimestampQueryResourcesResult {
  return {
    supported: false,
    resources: null,
    diagnostics: [diagnostic],
  };
}

function commandFailure(
  code: GpuTimestampQueryDiagnosticCode,
  message: string,
): GpuTimestampCommandReport {
  return {
    valid: false,
    diagnostics: [{ code, severity: "warning", message }],
  };
}

function readbackFailure(
  code: GpuTimestampQueryDiagnosticCode,
  message: string,
): GpuTimestampReadbackResult {
  return {
    valid: false,
    timestamps: [],
    durations: [],
    diagnostics: [{ code, severity: "warning", message }],
  };
}
