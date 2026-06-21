import { assetHandleKey } from "@aperture-engine/simulation";
import { createMeshGpuUploadPlan, } from "@aperture-engine/render";
import { createMeshUploadBufferDescriptors, } from "./mesh-buffer-descriptors.js";
import { createMeshGpuBuffers, } from "./mesh-buffer-resources.js";
import { writeWebGpuBufferData, writeWebGpuBufferSubData, } from "../../gpu/buffer.js";
import { meshBufferResourceKey, meshIndexBufferResourceKey, meshVertexBufferResourceKey, } from "../core/resource-keys.js";
export function createPreparedMeshGpuResourceCache() {
    return { resources: new Map() };
}
export function createPreparedMeshGpuResourceCacheSummary() {
    return { totalEntries: 0, layouts: [] };
}
export function writePreparedMeshGpuResourceCacheSummary(summary, cache) {
    summary.totalEntries = cache.resources.size;
    for (const layout of summary.layouts) {
        layout.entries = 0;
    }
    for (const resource of cache.resources.values()) {
        const existing = summary.layouts.find((layout) => layout.layoutKey === resource.layoutKey);
        if (existing !== undefined) {
            existing.entries += 1;
            continue;
        }
        summary.layouts.push({ layoutKey: resource.layoutKey, entries: 1 });
    }
    for (let index = summary.layouts.length - 1; index >= 0; index -= 1) {
        if (summary.layouts[index]?.entries === 0) {
            summary.layouts.splice(index, 1);
        }
    }
    summary.layouts.sort((a, b) => a.layoutKey.localeCompare(b.layoutKey));
    return summary;
}
export function evictPreparedMeshGpuResourceCacheEntries(cache, options) {
    let checked = 0;
    let retained = 0;
    let evicted = 0;
    let skippedInUse = 0;
    for (const [key, entry] of cache.resources) {
        checked += 1;
        if (entry.lastUsedFrame >= options.currentFrame) {
            skippedInUse += 1;
            continue;
        }
        if (options.currentFrame - entry.lastUsedFrame <= options.maxUnusedFrames) {
            retained += 1;
            continue;
        }
        cache.resources.delete(key);
        evicted += 1;
    }
    return { checked, retained, evicted, skippedInUse };
}
export function prepareMeshGpuResource(options) {
    const sourceMeshKey = assetHandleKey(options.handle);
    const upload = createMeshGpuUploadPlan(options.mesh);
    if (!upload.valid || upload.plan === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: upload.diagnostics,
        };
    }
    const descriptors = createMeshUploadBufferDescriptors(upload.plan);
    if (!descriptors.valid || descriptors.plan === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: descriptors.diagnostics,
        };
    }
    const layoutKey = preparedMeshGpuResourceLayoutKey(descriptors.plan);
    const cacheKey = preparedMeshGpuResourceCacheKey({
        sourceMeshKey,
        sourceVersion: options.sourceVersion,
        layoutKey,
    });
    const cached = options.cache.resources.get(cacheKey);
    if (cached !== undefined) {
        cached.lastUsedFrame = options.frame ?? 0;
        pruneSupersededSameLayoutMeshGpuResourceAliases(options.cache, cached);
        return {
            valid: true,
            status: "reused",
            resource: cached,
            diagnostics: [],
        };
    }
    const reusable = findReusableSameLayoutResource(options.cache, sourceMeshKey, layoutKey, options.sourceVersion);
    if (reusable !== null &&
        updateReusableMeshGpuResource({
            device: options.device,
            plan: descriptors.plan,
            mesh: reusable.mesh,
        })) {
        const resource = {
            cacheKey,
            sourceMeshKey,
            sourceVersion: options.sourceVersion,
            layoutKey,
            lastUsedFrame: options.frame ?? 0,
            mesh: aliasMeshGpuBufferResource(descriptors.plan, sourceMeshKey, options.sourceVersion, reusable.mesh),
        };
        options.cache.resources.set(cacheKey, resource);
        pruneSupersededSameLayoutMeshGpuResourceAliases(options.cache, resource);
        return {
            valid: true,
            status: "reused",
            resource,
            diagnostics: [],
        };
    }
    const mesh = createMeshGpuBuffers({
        device: options.device,
        plan: withPreparedMeshResourceLabel(descriptors.plan, sourceMeshKey, options.sourceVersion),
    });
    if (!mesh.valid || mesh.resource === null) {
        return {
            valid: false,
            status: "failed",
            resource: null,
            diagnostics: mesh.diagnostics,
        };
    }
    const resource = {
        cacheKey,
        sourceMeshKey,
        sourceVersion: options.sourceVersion,
        layoutKey,
        lastUsedFrame: options.frame ?? 0,
        mesh: mesh.resource,
    };
    options.cache.resources.set(cacheKey, resource);
    pruneSupersededSameLayoutMeshGpuResourceAliases(options.cache, resource);
    return {
        valid: true,
        status: "created",
        resource,
        diagnostics: [],
    };
}
export function preparedMeshGpuResourceCacheKey(input) {
    return [
        input.sourceMeshKey,
        `version:${input.sourceVersion}`,
        `layout:${input.layoutKey}`,
    ].join("|");
}
function pruneSupersededSameLayoutMeshGpuResourceAliases(cache, keep) {
    for (const [key, resource] of cache.resources) {
        if (key === keep.cacheKey ||
            resource.sourceMeshKey !== keep.sourceMeshKey ||
            resource.layoutKey !== keep.layoutKey ||
            resource.sourceVersion === keep.sourceVersion) {
            continue;
        }
        cache.resources.delete(key);
    }
}
function withPreparedMeshResourceLabel(plan, sourceMeshKey, sourceVersion) {
    return {
        ...plan,
        label: `${sourceMeshKey}@v${sourceVersion}`,
    };
}
export function preparedMeshGpuResourceLayoutKey(plan) {
    const vertexSegments = plan.vertexBuffers.map((vertex) => [
        "vertex",
        vertex.streamId,
        `count:${vertex.vertexCount}`,
        `bytes:${vertex.descriptor.size}`,
        `usage:${vertex.descriptor.usage}`,
    ].join(":"));
    const indexSegment = plan.indexBuffer === undefined
        ? "index:none"
        : [
            "index",
            plan.indexBuffer.format,
            `count:${plan.indexBuffer.indexCount}`,
            `bytes:${plan.indexBuffer.descriptor.size}`,
            `usage:${plan.indexBuffer.descriptor.usage}`,
        ].join(":");
    return ["mesh-upload-layout", ...vertexSegments, indexSegment].join("|");
}
function findReusableSameLayoutResource(cache, sourceMeshKey, layoutKey, sourceVersion) {
    let best = null;
    for (const resource of cache.resources.values()) {
        if (resource.sourceMeshKey !== sourceMeshKey ||
            resource.layoutKey !== layoutKey ||
            resource.sourceVersion === sourceVersion) {
            continue;
        }
        if (best === null || resource.sourceVersion > best.sourceVersion) {
            best = resource;
        }
    }
    return best;
}
function updateReusableMeshGpuResource(options) {
    if (options.device.queue?.writeBuffer === undefined) {
        return false;
    }
    for (const vertex of options.plan.vertexBuffers) {
        const resource = options.mesh.vertexBuffers.find((buffer) => buffer.streamId === vertex.streamId);
        if (resource === undefined) {
            return false;
        }
        if (!writeMeshBufferDataOrRanges(options.device, resource.buffer, vertex.source, vertex.updateRanges)) {
            return false;
        }
    }
    if (options.plan.indexBuffer === undefined) {
        return true;
    }
    const indexBuffer = options.mesh.indexBuffer;
    return (indexBuffer !== undefined &&
        writeMeshBufferDataOrRanges(options.device, indexBuffer.buffer, options.plan.indexBuffer.source, options.plan.indexBuffer.updateRanges));
}
function writeMeshBufferDataOrRanges(device, buffer, source, ranges) {
    if (ranges === undefined) {
        return writeWebGpuBufferData(device, buffer, source);
    }
    for (const range of ranges) {
        if (!writeWebGpuBufferSubData(device, buffer, source, {
            bufferOffset: range.byteOffset,
            dataByteOffset: range.byteOffset,
            byteLength: range.byteLength,
        })) {
            return false;
        }
    }
    return true;
}
function aliasMeshGpuBufferResource(plan, sourceMeshKey, sourceVersion, source) {
    const label = `${sourceMeshKey}@v${sourceVersion}`;
    const vertexBuffers = plan.vertexBuffers.flatMap((vertex) => {
        const existing = source.vertexBuffers.find((buffer) => buffer.streamId === vertex.streamId);
        return existing === undefined
            ? []
            : [
                {
                    streamId: vertex.streamId,
                    resourceKey: meshVertexBufferResourceKey(label, vertex.streamId),
                    buffer: existing.buffer,
                    vertexCount: vertex.vertexCount,
                },
            ];
    });
    const base = {
        resourceKey: meshBufferResourceKey(label),
        vertexCount: meshVertexCount(vertexBuffers),
        vertexBuffers,
    };
    if (plan.indexBuffer === undefined || source.indexBuffer === undefined) {
        return base;
    }
    return {
        ...base,
        indexBuffer: {
            resourceKey: meshIndexBufferResourceKey(label),
            buffer: source.indexBuffer.buffer,
            format: plan.indexBuffer.format,
            indexCount: plan.indexBuffer.indexCount,
        },
    };
}
function meshVertexCount(vertexBuffers) {
    if (vertexBuffers.length === 0) {
        return 0;
    }
    return Math.min(...vertexBuffers.map((buffer) => buffer.vertexCount));
}
//# sourceMappingURL=prepared-mesh-cache.js.map