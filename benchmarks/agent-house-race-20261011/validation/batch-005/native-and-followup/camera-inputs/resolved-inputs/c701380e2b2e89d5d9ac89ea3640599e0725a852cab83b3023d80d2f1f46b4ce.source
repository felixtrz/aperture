export const GPU_TIMESTAMP_QUERY_BYTES = BigUint64Array.BYTES_PER_ELEMENT;
export const GPU_TIMESTAMP_MAP_READ = 0x1;
const GPU_BUFFER_USAGE_MAP_READ = 0x1;
const GPU_BUFFER_USAGE_COPY_SRC = 0x4;
const GPU_BUFFER_USAGE_COPY_DST = 0x8;
const GPU_BUFFER_USAGE_QUERY_RESOLVE = 0x200;
export function createGpuTimestampQueryResources(options) {
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
            message: "WebGPU timestamp queries require the 'timestamp-query' device feature.",
        });
    }
    if (options.device.createQuerySet === undefined ||
        options.device.createBuffer === undefined) {
        return createUnsupportedResult({
            code: "gpuTiming.missingDeviceSupport",
            severity: "warning",
            message: "GPU timestamp query resources require createQuerySet and createBuffer support.",
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
    }
    catch (cause) {
        return createUnsupportedResult({
            code: "gpuTiming.resourceCreationFailed",
            severity: "warning",
            message: `GPU timestamp query resource creation failed: ${String(cause)}`,
        });
    }
}
export async function createGpuTimestampQueryResourcesChecked(options) {
    if (options.device.pushErrorScope === undefined ||
        options.device.popErrorScope === undefined) {
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
        message: `GPU timestamp query resource creation failed validation: ${validationError.message ?? "unknown validation error"}`,
    });
}
export function writeGpuTimestampQuery(encoder, resources, queryIndex) {
    if (!isValidQueryIndex(queryIndex, resources.queryCount)) {
        return commandFailure("gpuTiming.invalidQueryCount", `GPU timestamp query index ${queryIndex} is outside the allocated query range.`);
    }
    if (encoder.writeTimestamp === undefined) {
        return commandFailure("gpuTiming.commandEncodingUnsupported", "GPU timestamp writes require commandEncoder.writeTimestamp.");
    }
    encoder.writeTimestamp(resources.querySet, queryIndex);
    return { valid: true, diagnostics: [] };
}
export function resolveGpuTimestampQueries(encoder, resources, queryCount = resources.queryCount) {
    const count = Math.floor(queryCount);
    if (!Number.isFinite(count) || count < 1 || count > resources.queryCount) {
        return commandFailure("gpuTiming.invalidQueryCount", "GPU timestamp resolve count must be within the allocated query range.");
    }
    if (encoder.resolveQuerySet === undefined ||
        encoder.copyBufferToBuffer === undefined) {
        return commandFailure("gpuTiming.commandEncodingUnsupported", "GPU timestamp resolve requires resolveQuerySet and copyBufferToBuffer.");
    }
    const byteLength = count * GPU_TIMESTAMP_QUERY_BYTES;
    encoder.resolveQuerySet(resources.querySet, 0, count, resources.resolveBuffer, 0);
    encoder.copyBufferToBuffer(resources.resolveBuffer, 0, resources.readbackBuffer, 0, byteLength);
    return { valid: true, diagnostics: [] };
}
export async function readGpuTimestampQueryResults(resources, options = {}) {
    const queryCount = Math.floor(options.queryCount ?? resources.queryCount);
    if (!Number.isFinite(queryCount) ||
        queryCount < 1 ||
        queryCount > resources.queryCount) {
        return readbackFailure("gpuTiming.invalidQueryCount", "GPU timestamp readback count must be within the allocated query range.");
    }
    const byteLength = queryCount * GPU_TIMESTAMP_QUERY_BYTES;
    if (resources.readbackBuffer.mapAsync === undefined ||
        resources.readbackBuffer.getMappedRange === undefined) {
        return readbackFailure("gpuTiming.readbackUnavailable", "GPU timestamp readback requires a mappable result buffer.");
    }
    await resources.readbackBuffer.mapAsync(options.mapModeRead ?? GPU_TIMESTAMP_MAP_READ, 0, byteLength);
    try {
        const mapped = resources.readbackBuffer.getMappedRange(0, byteLength);
        const values = Array.from(new BigUint64Array(mapped, 0, queryCount));
        return {
            valid: true,
            timestamps: values,
            durations: timestampPairDurations(values),
            diagnostics: [],
        };
    }
    finally {
        // A readback buffer left mapped poisons every later frame that submits a
        // copy into it ("used in submit while mapped"), so unmap even when the
        // mapped-range read throws.
        resources.readbackBuffer.unmap?.();
    }
}
/**
 * Creates one additional MAP_READ readback buffer compatible with
 * `resolveGpuTimestampQueries` copies for the given query resources. Frame
 * paths rotate these so a frame never submits a copy into a readback buffer
 * that an earlier in-flight frame still has mapped (or pending map).
 */
export function createGpuTimestampReadbackBuffer(options) {
    if (options.device.createBuffer === undefined) {
        return null;
    }
    try {
        return options.device.createBuffer({
            label: options.label,
            size: options.byteLength,
            usage: GPU_BUFFER_USAGE_MAP_READ | GPU_BUFFER_USAGE_COPY_DST,
        });
    }
    catch {
        return null;
    }
}
export function createGpuPassTimingReport(options) {
    const diagnostics = [
        ...(options.diagnostics ?? []),
        ...options.readback.diagnostics,
    ];
    const passes = [];
    for (let passIndex = 0; passIndex < options.passNames.length; passIndex++) {
        const pass = options.passNames[passIndex] ?? "unknown";
        const startQuery = passIndex * 2;
        const endQuery = startQuery + 1;
        const duration = options.readback.durations.find((entry) => entry.startQuery === startQuery && entry.endQuery === endQuery);
        const rawMicroseconds = duration === undefined ? 0 : Number(duration.nanoseconds) / 1_000;
        const microseconds = rawMicroseconds === 0 &&
            options.readback.valid &&
            diagnostics.length === 0
            ? 0.001
            : rawMicroseconds;
        passes.push({
            pass,
            startQuery,
            endQuery,
            microseconds,
        });
    }
    return {
        ready: options.readback.valid &&
            diagnostics.length === 0 &&
            passes.every((pass) => pass.microseconds > 0),
        supported: options.readback.valid,
        queryCount: options.passNames.length * 2,
        passes,
        diagnostics,
    };
}
export function createUnsupportedGpuPassTimingReport(options) {
    return {
        ready: false,
        supported: false,
        queryCount: options.queryCount,
        passes: [],
        diagnostics: options.diagnostics,
    };
}
function timestampPairDurations(timestamps) {
    const durations = [];
    for (let startQuery = 0; startQuery + 1 < timestamps.length; startQuery += 2) {
        const endQuery = startQuery + 1;
        const start = timestamps[startQuery] ?? 0n;
        const end = timestamps[endQuery] ?? 0n;
        durations.push({
            startQuery,
            endQuery,
            nanoseconds: start > 0n && end > start ? end - start : 0n,
        });
    }
    return durations;
}
function isValidQueryIndex(queryIndex, queryCount) {
    return (Number.isInteger(queryIndex) && queryIndex >= 0 && queryIndex < queryCount);
}
function createUnsupportedResult(diagnostic) {
    return {
        supported: false,
        resources: null,
        diagnostics: [diagnostic],
    };
}
function commandFailure(code, message) {
    return {
        valid: false,
        diagnostics: [{ code, severity: "warning", message }],
    };
}
function readbackFailure(code, message) {
    return {
        valid: false,
        timestamps: [],
        durations: [],
        diagnostics: [{ code, severity: "warning", message }],
    };
}
//# sourceMappingURL=gpu-timing.js.map