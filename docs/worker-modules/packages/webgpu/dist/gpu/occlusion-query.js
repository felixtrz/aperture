export const GPU_OCCLUSION_QUERY_BYTES = BigUint64Array.BYTES_PER_ELEMENT;
export const GPU_OCCLUSION_MAP_READ = 0x1;
const GPU_BUFFER_USAGE_MAP_READ = 0x1;
const GPU_BUFFER_USAGE_COPY_SRC = 0x4;
const GPU_BUFFER_USAGE_COPY_DST = 0x8;
const GPU_BUFFER_USAGE_QUERY_RESOLVE = 0x200;
const DEFAULT_OCCLUSION_FEEDBACK_FORCE_PROBE_INTERVAL = 4;
export function createGpuOcclusionQueryResources(options) {
    const label = options.label ?? "aperture-gpu-occlusion";
    const queryCount = Math.floor(options.queryCount);
    if (!Number.isFinite(queryCount) || queryCount < 1) {
        return createUnsupportedResult({
            code: "gpuOcclusion.invalidQueryCount",
            severity: "error",
            message: "GPU occlusion query resources require at least one query.",
        });
    }
    if (options.device.createQuerySet === undefined ||
        options.device.createBuffer === undefined) {
        return createUnsupportedResult({
            code: "gpuOcclusion.missingDeviceSupport",
            severity: "warning",
            message: "GPU occlusion query resources require createQuerySet and createBuffer support.",
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
    }
    catch (cause) {
        return createUnsupportedResult({
            code: "gpuOcclusion.resourceCreationFailed",
            severity: "warning",
            message: `GPU occlusion query resource creation failed: ${String(cause)}`,
        });
    }
}
export function createGpuOcclusionFeedbackState() {
    return {
        occludedQueryKeys: new Set(),
        lastTestedFrameByQueryKey: new Map(),
        status: "empty",
    };
}
export function planGpuOcclusionFeedbackCulling(options) {
    const candidateDraws = options.candidateRenderIds.length;
    if (candidateDraws === 0) {
        return {
            candidateDraws: 0,
            skippedRenderIds: [],
            forcedProbeRenderIds: [],
            fallbackReason: null,
        };
    }
    if (options.state.status !== "ready") {
        return {
            candidateDraws,
            skippedRenderIds: [],
            forcedProbeRenderIds: [],
            fallbackReason: options.state.status === "unsupported" ? "unsupported" : "not-ready",
        };
    }
    const forceProbeInterval = options.forceProbeInterval ??
        DEFAULT_OCCLUSION_FEEDBACK_FORCE_PROBE_INTERVAL;
    const skippedRenderIds = [];
    const forcedProbeRenderIds = [];
    for (const renderId of options.candidateRenderIds) {
        const queryKey = occlusionFeedbackQueryKey(options.viewId, renderId);
        if (!options.state.occludedQueryKeys.has(queryKey)) {
            continue;
        }
        const lastTestedFrame = options.state.lastTestedFrameByQueryKey.get(queryKey) ?? options.frame;
        if (options.frame - lastTestedFrame >= forceProbeInterval) {
            forcedProbeRenderIds.push(renderId);
            continue;
        }
        skippedRenderIds.push(renderId);
    }
    return {
        candidateDraws,
        skippedRenderIds,
        forcedProbeRenderIds,
        fallbackReason: null,
    };
}
export function updateGpuOcclusionFeedbackState(options) {
    if (options.status === "inactive") {
        return;
    }
    if (options.status === "unsupported") {
        options.state.status = "unsupported";
        options.state.occludedQueryKeys.clear();
        options.state.lastTestedFrameByQueryKey.clear();
        return;
    }
    options.state.status = "ready";
    for (const renderId of options.testedRenderIds) {
        options.state.lastTestedFrameByQueryKey.set(occlusionFeedbackQueryKey(options.viewId, renderId), options.frame);
    }
    for (const renderId of options.visibleRenderIds) {
        options.state.occludedQueryKeys.delete(occlusionFeedbackQueryKey(options.viewId, renderId));
    }
    for (const renderId of options.occludedRenderIds) {
        options.state.occludedQueryKeys.add(occlusionFeedbackQueryKey(options.viewId, renderId));
    }
}
export function resolveGpuOcclusionQueries(encoder, resources, queryCount = resources.queryCount) {
    const count = Math.floor(queryCount);
    if (!Number.isFinite(count) || count < 1 || count > resources.queryCount) {
        return commandFailure("gpuOcclusion.invalidQueryCount", "GPU occlusion query resolve count must be within the allocated query range.");
    }
    if (encoder.resolveQuerySet === undefined ||
        encoder.copyBufferToBuffer === undefined) {
        return commandFailure("gpuOcclusion.commandEncodingUnsupported", "GPU occlusion query readback requires resolveQuerySet and copyBufferToBuffer.");
    }
    const byteLength = count * GPU_OCCLUSION_QUERY_BYTES;
    encoder.resolveQuerySet(resources.querySet, 0, count, resources.resolveBuffer, 0);
    encoder.copyBufferToBuffer(resources.resolveBuffer, 0, resources.readbackBuffer, 0, byteLength);
    return { valid: true, diagnostics: [] };
}
export async function readGpuOcclusionQueryResults(resources, renderIds) {
    if (resources.readbackBuffer.mapAsync === undefined ||
        resources.readbackBuffer.getMappedRange === undefined) {
        return readbackFailure("gpuOcclusion.readbackUnavailable", "GPU occlusion query readback requires mapAsync and getMappedRange.", renderIds);
    }
    try {
        const byteLength = renderIds.length * GPU_OCCLUSION_QUERY_BYTES;
        await resources.readbackBuffer.mapAsync(GPU_OCCLUSION_MAP_READ, 0, byteLength);
        const mapped = resources.readbackBuffer.getMappedRange(0, byteLength);
        const counts = bigUint64View(mapped, byteLength);
        const visibleRenderIds = [];
        const occludedRenderIds = [];
        const sampleCounts = [];
        for (let index = 0; index < renderIds.length; index += 1) {
            const renderId = renderIds[index];
            const samples = counts[index] ?? 0n;
            sampleCounts.push(samples.toString());
            if (renderId === undefined) {
                continue;
            }
            if (samples === 0n) {
                occludedRenderIds.push(renderId);
            }
            else {
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
    }
    catch (cause) {
        return readbackFailure("gpuOcclusion.readbackUnavailable", `GPU occlusion query readback failed: ${String(cause)}`, renderIds);
    }
}
function bigUint64View(mapped, byteLength) {
    if (ArrayBuffer.isView(mapped)) {
        return new BigUint64Array(mapped.buffer, mapped.byteOffset, Math.floor(Math.min(mapped.byteLength, byteLength) / 8));
    }
    return new BigUint64Array(mapped, 0, Math.floor(byteLength / 8));
}
function occlusionFeedbackQueryKey(viewId, renderId) {
    return `${String(viewId)}:${String(renderId)}`;
}
function createUnsupportedResult(diagnostic) {
    return { supported: false, resources: null, diagnostics: [diagnostic] };
}
function commandFailure(code, message) {
    return {
        valid: false,
        diagnostics: [{ code, severity: "error", message }],
    };
}
function readbackFailure(code, message, renderIds) {
    return {
        valid: false,
        testedRenderIds: [...renderIds],
        visibleRenderIds: [],
        occludedRenderIds: [],
        sampleCounts: [],
        diagnostics: [{ code, severity: "warning", message }],
    };
}
//# sourceMappingURL=occlusion-query.js.map